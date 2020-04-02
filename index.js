const NAME = process.env.NAME;
const QUEUE_URL = process.env.QUEUE_URL;

if(!/^pipeline\.[0-9a-zA-Z\-\_]+\.job\.[0-9a-zA-Z\-\_]+\.task\.[0-9a-zA-Z\-\_]+$/.test(NAME)) {
    console.error(`NAME=${NAME}: bad name`);
    process.exit(1);
}

if(!QUEUE_URL) {
    console.error(`QUEUE_URL=${QUEUE_URL}`);
    process.exit(1);
}

const nats = require('nats').connect(QUEUE_URL, { json: true });
const spawn = require('child_process').spawn;
const os = require('os');

const cmd = process.argv[2];
const args = process.argv.slice(3);

console.log('spawning');
const proc = spawn(cmd, args);

proc.stdout.on('data', stdout => {
    console.log(stdout.toString());
    stdout.toString().split(os.EOL).map(x => nats.publish(NAME, {stdout: x}));
});

proc.stderr.on('data', stderr => {
    console.error(stderr.toString());
    stderr.toString().split(os.EOL).map(x => nats.publish(NAME, {stderr: x}));
});

proc.on('close', code => {
    nats.flush(() => {
        process.exit(code);
    });
});

