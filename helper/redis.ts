import Redis from "ioredis";
import { setRedisStatus } from "../app";


const redisClient = new Redis(process.env.REDIS_URL!)

redisClient.on('connecting', () => {
    console.log('Connecting to Redis Server');
})

redisClient.on('ready', () => {
    console.log('Redis Server is ready');
    setRedisStatus(true);
})

redisClient.on('error', (error) => {
    console.log('Error connecting to Redis Server:', error);
    process.exit(1);
})







const checkRedisHealth = async () => {
    try {
        await redisClient.ping();
        return true;
    } catch (error) {
        return false;
    }
}


//redis set key 


const setKey = async (key: string, value: string, TTL: number) => {
    try {
        await redisClient.set(key, value, 'EX', TTL);
        return true;
    } catch (error) {
        return false;
    }
}

//redis get key

const getKey = async (key: string) => {
    try {
        return await redisClient.get(key);
    } catch (error) {
        return null;
    }
}

const getAllKeyValueMatchPatternRedis = async (pattern: string) => {
    const keyValuePairs: {
        key: string,
        value: {
            longitude: number,
            latitude: number,
            timezone: string
        }
    }[] = [];
    let cursor = '0';

    do {
        const [newCursor, foundKeys] = await redisClient.scan(cursor, 'MATCH', pattern, 'COUNT', 1000);
        cursor = newCursor;

        const pipeline = redisClient.pipeline();
        foundKeys.forEach((key) => pipeline.get(key));

        const values = await pipeline.exec();

        foundKeys.forEach((key, index) => {
            if (values && values[index]) {
                const value = JSON.parse(values[index][1] as any);
                keyValuePairs.push({ key, value: value });
            }
        });

    } while (cursor !== '0');

    return keyValuePairs;
}



export { redisClient, checkRedisHealth, setKey, getKey, getAllKeyValueMatchPatternRedis };
