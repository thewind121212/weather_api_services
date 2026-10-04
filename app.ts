import dotenv from 'dotenv';
import express from 'express';
import cors from 'cors';

import { weatherService } from './services/weather.services';
import { airQualityService } from './services/airQuality.services';
import moment from 'moment-timezone';
import { Worker, isMainThread, parentPort } from 'worker_threads';
import { redisClient } from './helper/redis';
import { revalidateRedis } from './helper/revalidateRedis';
import { geoFetcher } from './helper/fetcher';
import { moonPhaseServices } from './services/moonPhase.services';


function createWorker(workerId: string, taskName: string) {
    return new Worker(__filename, { workerData: { task: taskName, id: workerId }, name: `Worker ${workerId}` });
}


export let IS_REDIS_HEALTHY = false;
const corsOptions = {
    origin: ['https://weather.wliafdew.dev', 'http://localhost:3000'], 
    methods: 'GET,HEAD,PUT,PATCH,POST,DELETE', 
    credentials: true, 
};



export const setRedisStatus = (status: boolean) => {
    IS_REDIS_HEALTHY = status;
}

dotenv.config();

const app = express();

app.use(cors(corsOptions));

app.use(express.json());



app.post('/geo_search', async (req, res) => {
    const { geoQuery } = req.body;

    if (geoQuery === undefined || geoQuery === null || !geoQuery) {
        res.status(400).send({
            message: 'Invalid request',
            data: null
        });
        return
    }

    const data = await geoFetcher(geoQuery);

    if (data) {
        res.status(200).send({
            message: 'Data fetched successfully',
            data
        });
        return
    }



})


app.get('/weather', async (req, res) => {
    const { manualTimezone, quickRetriveId, latitudeRequest, longitudeRequest, locationIdRequest, timeZoneRequest } = req.query;
    const isQuickRetriveIdValid = quickRetriveId && await redisClient.get(`location:${quickRetriveId as string}`);

    let longitude = longitudeRequest
    let latitude = latitudeRequest
    let locationId = locationIdRequest as string
    let timezone = (timeZoneRequest ? timeZoneRequest : 'Asia/Ho_Chi_Minh') as string


    const data = await redisClient.get(`location:${quickRetriveId as string}`);
    if (!data) {
        const locationData = {
            locationId: locationId as string,
            longitude: Number(longitude),
            latitude: Number(latitude),
            timezone: timezone as string
        }
        await redisClient.set(`location:${locationId}`, JSON.stringify(locationData));
    }


    if (!isQuickRetriveIdValid && quickRetriveId) {
        res.status(404).send({
            message: 'Invalid Request Please Provide The Valid QuickRetriveId or try to fetch with out it',
            current: moment().tz(timezone).format('HH:mm:ss'),
            data: null
        });
        return
    }

    if (!longitude || !latitude || !locationId) {
        res.status(404).send({
            message: 'Invalid Request',
            current: moment().tz(timezone).format('HH:mm:ss'),
            data: null
        });
        return
    }



    const weatherData = await weatherService(
        true,
        locationId,
        {
            long: Number(longitude),
            lat: Number(latitude),
            tz: manualTimezone ? manualTimezone as string : timezone
        }
    );
    if (weatherData) {
        res.status(200).send({
            current: moment().tz(timezone).format('HH:mm:ss'),
            message: 'Data fetched successfully',
            data: weatherData
        });
        return
    }

    res.status(500).send({
        message: 'Error fetching data',
        current: moment().tz(timezone).format('HH:mm:ss'),
        data: null
    });
});



app.get('/air-quality', async (req, res) => {
    const { manualTimezone, quickRetriveId, latitudeRequest, longitudeRequest, locationIdRequest, timeZoneRequest } = req.query;
    const isQuickRetriveIdValid = quickRetriveId && await redisClient.get(`location:${quickRetriveId as string}`);

    let longitude = longitudeRequest
    let latitude = latitudeRequest
    let locationId = locationIdRequest as string
    let timezone = (timeZoneRequest ? timeZoneRequest : 'Asia/Ho_Chi_Minh') as string


    const data = await redisClient.get(`location:${quickRetriveId as string}`);
    if (!data) {
        const locationData = {
            locationId: locationId as string,
            longitude: Number(longitude),
            latitude: Number(latitude),
            timezone: timezone as string
        }
        await redisClient.set(`location:${locationId}`, JSON.stringify(locationData));
    }


    if (!isQuickRetriveIdValid && quickRetriveId) {
        res.status(404).send({
            message: 'Invalid Request Please Provide The Valid QuickRetriveId or try to fetch with out it',
            data: null
        });
        return
    }

    if (!longitude || !latitude || !locationId) {
        res.status(404).send({
            message: 'Invalid Request',
            current: moment().tz(timezone).format('HH:mm:ss'),
            data: null
        });
        return
    }
    const airQualityData = await airQualityService(true,
        locationId,
        {
            long: Number(longitude),
            lat: Number(latitude),
            tz: manualTimezone ? manualTimezone as string : timezone
        });
    if (airQualityData) {
        res.status(200).send({
            current: moment().tz(timezone).format('HH:mm:ss'),
            message: 'Data fetched successfully',
            data: airQualityData
        });
        return
    }

    res.status(500).send({
        message: 'Error fetching data',
        current: moment().tz(timezone).format('HH:mm:ss'),
        data: null
    });
});



app.get('/moon-phase', async (req, res) => {
    const { manualTimezone, quickRetriveId, latitudeRequest, longitudeRequest, locationIdRequest, timeZoneRequest } = req.query;
    const isQuickRetriveIdValid = quickRetriveId && await redisClient.get(`location:${quickRetriveId as string}`);

    let longitude = longitudeRequest
    let latitude = latitudeRequest
    let locationId = locationIdRequest as string
    let timezone = (timeZoneRequest ? timeZoneRequest : 'Asia/Ho_Chi_Minh') as string


    const data = await redisClient.get(`location:${quickRetriveId as string}`);
    if (!data) {
        const locationData = {
            locationId: locationId as string,
            longitude: Number(longitude),
            latitude: Number(latitude),
            timezone: timezone as string
        }
        await redisClient.set(`location:${locationId}`, JSON.stringify(locationData));
    }


    if (!isQuickRetriveIdValid && quickRetriveId) {
        res.status(404).send({
            message: 'Invalid Request Please Provide The Valid QuickRetriveId or try to fetch with out it',
            current: moment().tz(timezone).format('HH:mm:ss'),
            data: null
        });
        return
    }

    if (!longitude || !latitude || !locationId) {
        res.status(404).send({
            message: 'Invalid Request',
            current: moment().tz(timezone).format('HH:mm:ss'),
            data: null
        });
        return
    }
    const moonPhase = await moonPhaseServices(true,
        locationId,
        {
            long: Number(longitude),
            lat: Number(latitude),
            timezone: manualTimezone ? manualTimezone as string : timezone
        });

    if (moonPhase) {
        res.status(200).send({
            current: moment().tz(timezone).format('HH:mm:ss'),
            message: 'Data fetched successfully',
            data: moonPhase
        });
        return
    }

    res.status(500).send({
        message: 'Error fetching data',
        current: moment().tz(timezone).format('HH:mm:ss'),
        data: null
    });
});



if (isMainThread) {
    (async () => {
        app.listen(4100, async () => {
            console.log('Server is running on port 4100');

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

