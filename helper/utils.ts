import moment from "moment";
import { addDays, subDays } from 'date-fns';
import { AstronomyData, Cell, MoonReturn, responseMoonPhaseType } from "../types/moonPhase";


export const replace = (dataOrigin: any, newData: any) => {
    for (const [key, value] of Object.entries(dataOrigin.current)) {
        if (!dataOrigin.current[key] || (newData.current[key] !== dataOrigin.current[key])) {
            dataOrigin.current[key] = newData.current[key];
        }
    }
    if (dataOrigin.hourly) {
        for (const [key, value] of Object.entries(dataOrigin.hourly)) {
            for (let i = 0; i < (value as any[]).length; i++) {
                if (!dataOrigin.hourly[key][i] || (dataOrigin.hourly[key][i] !== newData.hourly[key][i])) {
                    dataOrigin.hourly[key][i] = newData.hourly[key][i];
                }
            }
        }

    }

    if (dataOrigin.daily) {

        for (const [key, value] of Object.entries(dataOrigin.daily)) {
            for (let i = 0; i < (value as any[]).length; i++) {
                if (!dataOrigin.daily[key][i] || (dataOrigin.daily[key][i] !== newData.daily[key][i])) {
                    dataOrigin.daily[key][i] = newData.daily[key][i];
                }
            }
        }
    }


}

// cache by where, not by a client-supplied id: ~1 km grid + timezone
export const geoKey = (lat: number, lon: number, tz: string) =>
    `${lat.toFixed(2)},${lon.toFixed(2)}:${tz}`;

export const checkTime = (oldTimestamp: number, greaterThanMinute: number): boolean => {
    const currentTimestamp = Date.now();
    const timeDifference = currentTimestamp - oldTimestamp;
    if (timeDifference >= greaterThanMinute * 60 * 1000) {
        return true;
    } else {
        return false;
    }
};

export function isCurrentDayAfterTimestamp(timestamp: number, timezone: string): boolean {
    const timestampMoment = moment.tz(timestamp, timezone).startOf('day');

    const currentMoment = moment.tz(timezone).startOf('day');

    if (currentMoment.isAfter(timestampMoment, 'day')) {
        return true;
    } else {
        return false;
    }
}


export function getMonthRangeInTimezone(timezone: string): {
    start: string,
    end: string
    endDayOfMonth: string,
} {
    const now = new Date();

    const getYearMonth = new Intl.DateTimeFormat('en-US', { year: 'numeric', timeZone: timezone, month: '2-digit' }).format(now);
    const [currentMonth, currentYear] = getYearMonth.split('/')
    const startOfMonth = subDays(new Date(`${currentYear}-${currentMonth}-01`), 1).toISOString().split('T')[0];
    const endDayOfMonth = new Date(Number(currentYear), Number(currentMonth), 0).getDate();


    const endDayOfMonthString = `${currentYear}-${currentMonth}-${endDayOfMonth}`

    const endOfMonth = addDays(new Date(`${currentYear}-${currentMonth}-${endDayOfMonth}`), 1).toISOString().split('T')[0];
    return {
        start: startOfMonth,
        end: endOfMonth,
        endDayOfMonth: endDayOfMonthString
    };
}

export function calculateRedisTTL(endOfMonth: string, timezone: string) {
    const now = new Date();

    const currentTimestamp = now.getTime();


    const [year, month, day] = endOfMonth.split('-');
    const endDate = new Date(`${year}-${month}-${day}T23:59:00`);
    const endTimestamp = new Date(endDate.toLocaleString('en-US', { timeZone: timezone })).getTime();


    const ttl = Math.max(0, Math.floor((endTimestamp - currentTimestamp) / 1000));

    return ttl;
}


export const calcMoonPhase = (moonData: AstronomyData): MoonReturn[] => {
    const data: Cell[] = moonData.data.table.rows[1].cells;
    const dataReturn: MoonReturn[] = []



    for (let i = 1; i < data.length - 1; i++) {
        const previousPhase = data[i - 1].extraInfo.phase?.string
        const currentPhase = data[i].extraInfo.phase?.string
        const nextPhase = data[i + 1].extraInfo.phase?.string

        if (i === 1) {
            if (previousPhase === 'Waning Crescent' && currentPhase === 'Waxing Crescent') {
                dataReturn.push({
                    date: data[i].date,
                    moonPhase: 'New Moon'
                })
                continue;
            }
            if (previousPhase === 'Waning Crescent' && currentPhase === 'Waxing Crescent') {
                dataReturn.push({
                    date: data[i].date,
                    moonPhase: 'New Moon'
                })
                continue;
            }
            if (previousPhase === 'Waxing Crescent' && currentPhase === 'Waxing Gibbous') {
                dataReturn.push({
                    date: data[i].date,
                    moonPhase: 'First Quarter'
                })
                continue;
            }
            if (previousPhase === 'Waxing Gibbous' && currentPhase === 'Waning Gibbous') {
                dataReturn.push({
                    date: data[i].date,
                    moonPhase: 'Full Moon'
                })
                continue;
            }
            if (previousPhase === 'Waning Gibbous' && currentPhase === 'Waning Crescent') {
                dataReturn.push({
                    date: data[i].date,
                    moonPhase: 'Last Quarter'
                })
                continue;
            }

            dataReturn.push({
                date: data[i].date,
                moonPhase: data[i].extraInfo.phase?.string as responseMoonPhaseType
            })

            continue;
        }


        if (currentPhase === 'Waning Crescent' && nextPhase === 'Waxing Crescent') {
            dataReturn.push({
                date: data[i].date,
                moonPhase: 'New Moon'
            })
            continue;
        }
        if (currentPhase === 'Waxing Crescent' && nextPhase === 'Waxing Gibbous') {
            dataReturn.push({
                date: data[i].date,
                moonPhase: 'First Quarter'
            })
            continue;
        }
        if (currentPhase === 'Waxing Gibbous' && nextPhase === 'Waning Gibbous') {
            dataReturn.push({
                date: data[i].date,
                moonPhase: 'Full Moon'
            })
            continue;
        }
        if (currentPhase === 'Waning Gibbous' && nextPhase === 'Waning Crescent') {
            dataReturn.push({
                date: data[i].date,
                moonPhase: 'Last Quarter'
            })
            continue;
        }

        dataReturn.push({
            date: data[i].date,
            moonPhase: data[i].extraInfo.phase?.string as responseMoonPhaseType
        })
        continue;
    }


    return dataReturn;
}