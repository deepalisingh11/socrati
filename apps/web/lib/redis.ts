import IORedis from 'ioredis';

function getRedisUrl() {
    const url =
        process.env.REDIS_URL ??
        process.env.UPSTASH_REDIS_URL ??
        process.env.UPSTASH_REDIS_CONNECTION_STRING;

    if (!url) {
        throw new Error(
            'Redis connection string is missing. Set REDIS_URL to your BullMQ-compatible Redis URL.',
        );
    }

    return url;
}

export function createRedisConnection() {
    return new IORedis(getRedisUrl(), {
        maxRetriesPerRequest: null,
    });
}
