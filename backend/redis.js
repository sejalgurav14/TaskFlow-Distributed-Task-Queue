
require("dotenv").config();

const IORedis = require("ioredis");

let redisConfig;

const redisHost = process.env.REDIS_HOST || "127.0.0.1";

if (redisHost.startsWith("redis://") || redisHost.startsWith("rediss://")) {
    const redisUrl = new URL(redisHost);

    redisConfig = {
        host: redisUrl.hostname,
        port: Number(redisUrl.port) || 6379,
        username: redisUrl.username || undefined,
        password: redisUrl.password || undefined,
        tls: redisUrl.protocol === "rediss:" ? {} : undefined,
        maxRetriesPerRequest: null
    };
} else {
    redisConfig = {
        host: redisHost,
        port: Number(process.env.REDIS_PORT) || 6379,
        maxRetriesPerRequest: null
    };
}

const redisConnection = new IORedis(redisConfig);

redisConnection.on("connect", () => {
    console.log("Redis connected successfully!");
});

redisConnection.on("error", (error) => {
    console.error("Redis connection error:", error.message);
});

module.exports = redisConnection;
