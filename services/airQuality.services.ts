
import { geoFetcher, airQualityFetcher } from '../helper/fetcher';
import { redisClient } from '../helper/redis';
import { isCurrentDayAfterTimestamp, replace, geoKey } from '../helper/utils';
import { AirQualityData } from '../types/air';
import { IS_REDIS_HEALTHY } from '../app';


const openMeteoUrl = process.env.OPEN_MEOTEO_URL_AIR || 'https://air-quality-api.open-meteo.com';
const homeServerUrl = process.env.HOME_SERVER_URL || 'http://localhost:8080';

const DEFAULT_LOCATION_ID = '1566083';
const DEFAULT_LATITUDE = 10.762622;
const DEFAULT_LONGITUDE = 106.660172;
const DEFAULT_TIMEZONE = 'Asia/Ho_Chi_Minh';

const KEY_REDIS_PREFIX = 'air-quality';
const TTL_REDIS = 60 * 30;

export const airQualityService = async (
    isGetFromCache: boolean = true,
    locationId: string = DEFAULT_LOCATION_ID,
    {
        long: longitude = DEFAULT_LONGITUDE,
        lat: latitude = DEFAULT_LATITUDE,
        tz: timezone = DEFAULT_TIMEZONE
    }

): Promise<AirQualityData | null> => {
    const key = `${KEY_REDIS_PREFIX}:${geoKey(latitude, longitude, timezone)}`;

    if (isGetFromCache && IS_REDIS_HEALTHY) {
        const redisRetrive = await redisClient.get(key);

        if (redisRetrive) {
            const cached = JSON.parse(redisRetrive);
            const isPastDay = isCurrentDayAfterTimestamp(cached.timestamp, timezone);
            if (!isPastDay) {
                return { ...cached, locaitonId: locationId };
            }
        }
    }


    const fetcherData: {
        latitude?: number,
        longitude?: number
        timezone?: string
    } = {
        latitude,
        longitude,
        timezone
    }


    const promiseFetcher = [
        airQualityFetcher(openMeteoUrl, fetcherData.latitude!, fetcherData.longitude!, fetcherData.timezone!),
        airQualityFetcher(homeServerUrl, fetcherData.latitude!, fetcherData.longitude!, fetcherData.timezone!),
    ]

    const [openMeteo, homeServer] = await Promise.all(promiseFetcher);


    if (!homeServer || !openMeteo) {
        return null
    }

    replace(homeServer, openMeteo);
    homeServer.timestamp = Date.now();
    if (IS_REDIS_HEALTHY) {
        redisClient.set(key, JSON.stringify(homeServer), 'EX', TTL_REDIS);
    }

    // response field name kept as-is for existing clients
    return { ...homeServer, locaitonId: locationId }

}
