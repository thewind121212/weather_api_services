
import { weatherFetcher } from '../helper/fetcher';
import { IS_REDIS_HEALTHY } from '../app';
import { redisClient } from '../helper/redis';
import { replace, isCurrentDayAfterTimestamp, geoKey } from '../helper/utils';
import { stationCurrent } from '../helper/metar';
import { WeatherData } from '../types/weather';


const DEFAULT_LOCATION_ID = '1566083';
const DEFAULT_LATITUDE = 10.762622;
const DEFAULT_LONGITUDE = 106.660172;
const DEFAULT_TIMEZONE = 'Asia/Ho_Chi_Minh';


const openMeteoUrl = process.env.OPEN_MEOTEO_URL || 'https://api.open-meteo.com';
const homeServerUrl = process.env.HOME_SERVER_URL || 'http://localhost:8080';

const KEY_REDIS_PREFIX = 'weather';
const TTL_REDIS = 60 * 5; // Open-Meteo's current is 15-minutely, the airport reports every 30 min

export const weatherService = async (isGetFromCache: boolean = true,
    locationId: string = DEFAULT_LOCATION_ID,
    {
        long: longitude = DEFAULT_LONGITUDE,
        lat: latitude = DEFAULT_LATITUDE,
        tz: timezone = DEFAULT_TIMEZONE
    }
): Promise<WeatherData | null> => {




    const key = `${KEY_REDIS_PREFIX}:${geoKey(latitude, longitude, timezone)}`;

    if (isGetFromCache && IS_REDIS_HEALTHY) {
        const redisRetrive = await redisClient.get(key);
        if (redisRetrive) {
            const cached = JSON.parse(redisRetrive);
            const isPastDay = isCurrentDayAfterTimestamp(cached.timestamp, timezone);
            if (!isPastDay) {
                return { ...cached, locationId };
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

    if (!fetcherData.latitude || !fetcherData.longitude || !fetcherData.timezone) {
        return null
    }

    const promiseFetcher = [
        weatherFetcher(openMeteoUrl, fetcherData.latitude!, fetcherData.longitude!, fetcherData.timezone!),
        weatherFetcher(homeServerUrl, fetcherData.latitude!, fetcherData.longitude!, fetcherData.timezone!),
    ]

    const [openMeteo, homeServer] = await Promise.all(promiseFetcher);


    if (!homeServer || !openMeteo) {
        return null
    }

    replace(homeServer, openMeteo);
    await stationCurrent(homeServer.current, fetcherData.latitude!, fetcherData.longitude!);
    homeServer.timestamp = Date.now();

    if (IS_REDIS_HEALTHY) {
        redisClient.set(key, JSON.stringify(homeServer), 'EX', TTL_REDIS);
    }

    return { ...homeServer, locationId }

}
