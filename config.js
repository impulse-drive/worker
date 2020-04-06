Array.chunks = function(array, size) {
  var results = [];
  while (array.length) {
    results.push(array.splice(0, size));
  }
  return results;
};

module.exports = {
    name: process.env.NAME,
    containerId: process.env.CONTAINER_ID,
    build: process.env.BUILD,
    nats: {
        url: process.env.QUEUE_URL
    },
    dir: {
        runtime: process.env.RUNTIME_DIR,
        output: process.env.OUTPUT_DIR
    },
    minio: {
        host: process.env.MINIO_HOST,
        port: process.env.MINIO_PORT && Number(process.env.MINIO_PORT),
        accessKey: process.env.MINIO_ACCESS_KEY,
        secretKey: process.env.MINIO_SECRET_KEY
    },
    output: (() => {
        const [bucket, object] = process.env.OUTPUT.split('|');
        return { bucket, object };
    })(),
    inputs: (() => {
        return Array.chunks(process.env.INPUTS.split('|'), 3).map(([name, bucket, object]) => {
            return { name, bucket, object };
        })
    })()
};

console.log(process.env)
console.log(module.exports);
