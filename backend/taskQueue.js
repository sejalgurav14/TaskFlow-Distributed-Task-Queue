const { Queue } = require("bullmq");
const redisConnection = require("./redis");

const taskQueue = new Queue("taskflow-queue", {
    connection: redisConnection,

    defaultJobOptions: {
        attempts: 1,
        removeOnComplete: 100,
        removeOnFail: 100
    }
});

module.exports = taskQueue;