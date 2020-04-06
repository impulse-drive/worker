const cfg = require('./config');
const nats = require('nats').connect(cfg.nats.url, { json: true });
const { spawn, exec } = require('child_process');
const os = require('os');
const path = require('path');
const request = require('request');
const compressing = require('compressing');
const pump = require('pump');
const mkdirp = require('mkdirp');

const cmd = process.argv[2];
const args = process.argv.slice(3);

const exit = code => msg => {
    nats.flush(() => {
        if(msg) {
            console.error(msg);
        }
        process.exit(code);
    });
};

const minio = (() => {
    const Minio= require('minio');
    const client = new Minio.Client({
        endPoint: cfg.minio.host,
        port: cfg.minio.port,
        useSSL: false,
        accessKey: cfg.minio.accessKey,
        secretKey: cfg.minio.secretKey
    });
    client.bucketExists(cfg.output.bucket, (error, exists) => {
        if(error) {
            exit(1)(error);
        }
        if(!exists) {
            console.log(`creating bucket ${cfg.output.bucket}`);
            client.makeBucket(cfg.output.bucket, (error) => {
                if(error) {
                    exit(1)(error);
                }
            });
        }
    });
    return client;
})();

cfg.inputs.map(({ name, bucket, object }) => {
    const dir = path.join(cfg.dir.runtime, name);
    mkdirp(dir)
        .then(() => {
            minio.getObject(bucket, object, (error, stream) => {
                if(error) {
                    exit(1)(error);
                }
                compressing.tgz.uncompress(stream, dir)
                    .then(() => console.log(`prepared ${dir}`))
                    .catch(exit(1));
            })
        })
        .catch(exit(1));
});

const proc = spawn('docker', [
    'run',
    '--volumes-from', cfg.containerId,
    '-w', cfg.dir.runtime,
    cmd, ...args
]);

const publishStdout = stdout => nats.publish(cfg.name, {stdout, build: cfg.build});
const publishStderr = stderr => nats.publish(cfg.name, {stderr, build: cfg.build});

proc.stdout.on('data', stdout => {
    console.log(stdout.toString());
    stdout.toString().split(os.EOL).map(publishStdout);
});

proc.stderr.on('data', stderr => {
    console.error(stderr.toString());
    stderr.toString().split(os.EOL).map(publishStderr);
});



proc.on('close', code => {
    publishStderr(`process exited with code ${code}`);

    if(code == 0) {
        minio.statObject(cfg.output.bucket, cfg.output.object, (error) => {
            if(error && error.code == 'NotFound') {
                const stream = (() => {
                    const stream = new compressing.tgz.Stream();
                    stream.addEntry(cfg.dir.output, { ignoreBase: true });
                    return stream;
                })();

                return minio.putObject(cfg.output.bucket, cfg.output.object, stream, (error, etag) => {
                    if(error) {
                        exit(1)(error);
                    }
                    exit(0)();
                })
            }
            if(!error) {
                exit(1)(`file exists ${object}`);
            }
            exit(1)(error);
        });
    }

    exit(code)();
});

