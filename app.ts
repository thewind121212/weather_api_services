import dotenv from 'dotenv';
import express from 'express';
import cors from 'cors';

import { LocationService as Location } from "./types/geo";
import { fetchLocationService } from './services/locations.services';
import { weatherService } from './services/weather.services';
import { airQualityService } from './services/airQuality.services';
import moment from 'moment-timezone';
import { Worker, isMainThread, parentPort } from 'worker_threads';
import { redisClient } from './helper/redis';
import { revalidateRedis } from './helper/revalidateRedis';


function createWorker(workerId: string, taskName: string) {
    return new Worker(__filename, { workerData: { task: taskName, id: workerId }, name: `Worker ${workerId}` });
}


export let IS_REDIS_HEALTHY = false;


export const setRedisStatus = (status: boolean) => {
    IS_REDIS_HEALTHY = status;
}

dotenv.config();

const app = express();

app.use(cors());

app.use(express.json());






app.get('/weather', async (req, res) => {
    const { locationName, manualTimezone, quickRetriveId } = req.query;
    const isQuickRetriveIdValid = quickRetriveId && await redisClient.get(`location:${quickRetriveId as string}`);
    const location = isQuickRetriveIdValid ? { locationId: quickRetriveId } : await fetchLocationService(locationName! as string);
    const { locationId, longitude, latitude, timezone } = location as Location;

    if (!location) {
        res.status(404).send({
            message: 'Location not found',
            current: moment().tz('Asia/Bangkok').format('HH:mm:ss'),
            data: null
        });
        return
    }

    const weatherData = await weatherService(
        true,
        locationId,
        {
            long: longitude,
            lat: latitude,
            tz: manualTimezone ? manualTimezone as string : timezone
        }
    );
    if (weatherData) {
        res.status(200).send({
            current: moment().tz('Asia/Bangkok').format('HH:mm:ss'),
            message: 'Data fetched successfully',
            data: weatherData
        });
        return
    }

    res.status(500).send({
        message: 'Error fetching data',
        current: moment().tz('Asia/Bangkok').format('HH:mm:ss'),
        data: null
    });
});



app.get('/air-quality', async (req, res) => {
    const { locationName, manualTimezone, quickRetriveId } = req.query;
    const isQuickRetriveIdValid = quickRetriveId && await redisClient.get(`location:${quickRetriveId as string}`);
    const location = isQuickRetriveIdValid ? { locationId: quickRetriveId } : await fetchLocationService(locationName! as string);
    const { locationId, longitude, latitude, timezone } = location as Location;

    if (!location) {
        res.status(404).send({
            message: 'Location not found',
            current: moment().tz('Asia/Bangkok').format('HH:mm:ss'),
            data: null
        });
        return
    }

    const airQualityData = await airQualityService(true,
        locationId,
        {
            long: longitude,
            lat: latitude,
            tz: manualTimezone ? manualTimezone as string : timezone
        });
    if (airQualityData) {
        res.status(200).send({
            current: moment().tz('Asia/Bangkok').format('HH:mm:ss'),
            message: 'Data fetched successfully',
            data: airQualityData
        });
        return
    }

    res.status(500).send({
        message: 'Error fetching data',
        current: moment().tz('Asia/Bangkok').format('HH:mm:ss'),
        data: null
    });
});




if (isMainThread) {
    (async () => {
        app.listen(3000, async () => {
            console.log('Server is running on port 3000');

            const worker = createWorker('1', 'redisRevalidation');
            worker.on('message', (msg) => {
                console.log('Revalidate Workder: ', msg);
            });
        })

    })();

}
else {
    if (parentPort) {
        revalidateRedis(parentPort);
    }
}

