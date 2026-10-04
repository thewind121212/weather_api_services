

import { moonPhaseFetcher } from '../helper/fetcher';
import { IS_REDIS_HEALTHY } from '../app';
import { redisClient } from '../helper/redis';
import { getMonthRangeInTimezone, calculateRedisTTL, calcMoonPhase, geoKey } from '../helper/utils';
import { AstronomyData, Cell, MoonReturn, responseMoonPhaseType } from '../types/moonPhase';


const DEFAULT_LOCATION_ID = '1566083';
const DEFAULT_LATITUDE = 10.762622;
const DEFAULT_LONGITUDE = 106.660172;
const DEFAULT_TIMEZONE = 'Asia/Ho_Chi_Minh';


const KEY_REDIS_PREFIX = 'moon';

export const moonPhaseServices = async (isGetFromCache: boolean = true,
    locationId: string = DEFAULT_LOCATION_ID,
    {
        long: longitude = DEFAULT_LONGITUDE,
        lat: latitude = DEFAULT_LATITUDE,
        timezone = DEFAULT_TIMEZONE
    }
): Promise<MoonReturn[] | null> => {





    const key = `${KEY_REDIS_PREFIX}:${geoKey(latitude, longitude, timezone)}`;

    if (isGetFromCache && IS_REDIS_HEALTHY) {

        const redisRetrive = await redisClient.get(key);
        if (redisRetrive) {
            return JSON.parse(redisRetrive)
        }
    }


    const { start, end, endDayOfMonth } = getMonthRangeInTimezone(timezone)

    const fetcherData: {
        latitude?: number,
        longitude?: number
        from_date: string,
        to_date: string,

    } = {
        latitude,
        longitude,
        from_date: start,
        to_date: end,
    }

    if (!fetcherData.latitude || !fetcherData.longitude) {
        return null
    }


    const moonPhaseFetch: AstronomyData | null = await moonPhaseFetcher(fetcherData.latitude!, fetcherData.longitude!, fetcherData.from_date, fetcherData.to_date);


    if (!moonPhaseFetch) {
        return null
    }



    const moonReturn = calcMoonPhase(moonPhaseFetch)

    const TTL = calculateRedisTTL(endDayOfMonth, timezone);

    if (IS_REDIS_HEALTHY) {
        redisClient.set(key, JSON.stringify(moonReturn), 'EX', Number(TTL));
    }

    return moonReturn

}