import axios from 'axios';

// Near Ho Chi Minh City, "current" comes from Tân Sơn Nhất airport's METAR (a real observation every 30 min)
// instead of the model's guess for the grid cell. Hourly / daily stay Open-Meteo.
// Source: aviationweather.gov (NOAA), free, no key.

const STATION = { id: 'VVTS', name: 'Tan Son Nhat', lat: 10.8188, lon: 106.652 };
const RADIUS_KM = 30;           // the city; farther out the model is the better guess
const MAX_AGE_MIN = 90;         // an older report (station or feed down) is ignored
const CACHE_MS = 5 * 60 * 1000;
const RETRY_MS = 60 * 1000; // after a failed fetch, retry sooner

export interface Metar {
    obsTime: number;            // epoch seconds
    temp: number | null;
    dewp: number | null;
    wdir: number | string | null; // 'VRB' when variable
    wspd: number | null;        // knots
    wgst: number | null;
    wxString?: string | null;   // present weather: '-SHRA', '+TSRA', 'BR'...
    clouds?: { cover: string }[];
    rawOb: string;
}

export interface StationSource {
    station: string;
    name: string;
    observed: string;           // ISO time of the observation
    raw: string;
}

// cloud amount (oktas) -> %
const COVER_PCT: Record<string, number> = { SKC: 0, CLR: 0, NSC: 0, NCD: 0, CAVOK: 0, FEW: 19, SCT: 44, BKN: 75, OVC: 100, OVX: 100 };

export const distanceKm = (lat1: number, lon1: number, lat2: number, lon2: number): number => {
    const rad = (d: number) => d * Math.PI / 180;
    const a = Math.sin(rad(lat2 - lat1) / 2) ** 2
        + Math.cos(rad(lat1)) * Math.cos(rad(lat2)) * Math.sin(rad(lon2 - lon1) / 2) ** 2;
    return 6371 * 2 * Math.asin(Math.sqrt(a));
};

export const nearStation = (lat: number, lon: number): boolean =>
    distanceKm(lat, lon, STATION.lat, STATION.lon) <= RADIUS_KM;

// METAR present weather + cloud % -> WMO weather_code (the codes Open-Meteo uses)
export const metarCode = (wx: string, cloudPct: number): number => {
    // drop "in the vicinity" (VCTS, VCSH) and "recent" (RETS) groups: not at the station now
    const groups = wx.split(/\s+/).filter(g => g && !/^[-+]?(VC|RE)/.test(g));
    const find = (re: RegExp) => groups.find(g => re.test(g));
    const level = (g: string) => (g.startsWith('-') ? 0 : g.startsWith('+') ? 2 : 1); // light / moderate / heavy
    const pick = (g: string, codes: number[]) => codes[Math.min(level(g), codes.length - 1)];
    let g: string | undefined;

    if ((g = find(/TS/))) return /GR/.test(g) ? 99 : /GS/.test(g) ? 96 : 95;
    if ((g = find(/SH.*RA/))) return pick(g, [80, 81, 82]);
    if ((g = find(/SH.*SN/))) return pick(g, [85, 86]);
    if ((g = find(/FZRA/))) return pick(g, [66, 67]);
    if ((g = find(/FZDZ/))) return pick(g, [56, 57]);
    if ((g = find(/RA/))) return pick(g, [61, 63, 65]);
    if ((g = find(/DZ/))) return pick(g, [51, 53, 55]);
    if ((g = find(/SG/))) return 77;
    if ((g = find(/SN/))) return pick(g, [71, 73, 75]);
    if (find(/FZFG/)) return 48;
    if (find(/FG/)) return 45;

    if (cloudPct <= 0) return 0;
    if (cloudPct <= 25) return 1;
    if (cloudPct <= 75) return 2;
    return 3;
};

// relative humidity from temperature + dew point (Magnus)
const humidity = (t: number, td: number): number =>
    Math.round(100 * Math.exp(17.625 * td / (243.04 + td)) / Math.exp(17.625 * t / (243.04 + t)));

// apparent temperature (Steadman, the formula Open-Meteo uses); wind in km/h
const apparent = (t: number, rh: number, windKmh: number): number => {
    const e = rh / 100 * 6.105 * Math.exp(17.27 * t / (237.7 + t));
    return Math.round((t + 0.33 * e - 0.7 * (windKmh / 3.6) - 4) * 10) / 10;
};

const kmh = (kt: number) => Math.round(kt * 1.852 * 10) / 10;

let cache: { at: number; ok: boolean; metar: Metar | null } | null = null;

const latestMetar = async (): Promise<Metar | null> => {
    if (cache && Date.now() - cache.at < (cache.ok ? CACHE_MS : RETRY_MS)) return cache.metar;
    try {
        const { data } = await axios.get('https://aviationweather.gov/api/data/metar', {
            params: { ids: STATION.id, format: 'json' },
            timeout: 5000,
        });
        cache = { at: Date.now(), ok: true, metar: Array.isArray(data) && data[0] ? data[0] : null };
    } catch (error) {
        console.error('METAR fetch failed:', (error as Error).message);
        // keep the last good report (applyStation still drops it once it's over MAX_AGE_MIN old)
        cache = { at: Date.now(), ok: false, metar: cache?.metar ?? null };
    }
    return cache.metar;
};

// Overwrites `current` with the station's observation; returns false (current untouched) when the location is
// out of range or there's no fresh report.
export const applyStation = (current: any, metar: Metar | null, now: number = Date.now()): boolean => {
    if (!metar || metar.temp == null || now / 1000 - metar.obsTime > MAX_AGE_MIN * 60) return false;

    const cloud = Math.max(0, ...(metar.clouds ?? []).map(c => COVER_PCT[c.cover] ?? 0));
    const code = metarCode(metar.wxString ?? '', cloud);
    const wind = metar.wspd != null ? kmh(metar.wspd) : current.wind_speed_10m;

    current.temperature_2m = metar.temp;
    if (metar.dewp != null) current.relative_humidity_2m = humidity(metar.temp, metar.dewp);
    current.apparent_temperature = apparent(metar.temp, current.relative_humidity_2m, wind);
    current.weather_code = code;
    current.cloud_cover = cloud;
    current.wind_speed_10m = wind;
    if (typeof metar.wdir === 'number') current.wind_direction_10m = metar.wdir;
    if (metar.wgst != null) current.wind_gusts_10m = kmh(metar.wgst);
    if (code < 50) { // dry at the station: the model's drizzle doesn't count
        current.precipitation = 0;
        current.rain = 0;
    }
    current.source = {
        station: STATION.id,
        name: STATION.name,
        observed: new Date(metar.obsTime * 1000).toISOString(),
        raw: metar.rawOb,
    } as StationSource;
    return true;
};

export const stationCurrent = async (current: any, lat: number, lon: number): Promise<boolean> =>
    nearStation(lat, lon) ? applyStation(current, await latestMetar()) : false;
