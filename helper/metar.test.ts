import { test, expect } from 'bun:test';
import { metarCode, nearStation, applyStation, Metar } from './metar';

test('present weather -> WMO code', () => {
    expect(metarCode('-TSRA', 75)).toBe(95);
    expect(metarCode('+TSRAGR', 100)).toBe(99);
    expect(metarCode('-SHRA', 75)).toBe(80);
    expect(metarCode('SHRA', 75)).toBe(81);
    expect(metarCode('+SHRA', 75)).toBe(82);
    expect(metarCode('-RA BR', 100)).toBe(61);
    expect(metarCode('RA', 100)).toBe(63);
    expect(metarCode('+RA', 100)).toBe(65);
    expect(metarCode('-DZ', 100)).toBe(51);
    expect(metarCode('FG', 100)).toBe(45);
    expect(metarCode('FZFG', 100)).toBe(48);
    expect(metarCode('SN', 100)).toBe(73);
    expect(metarCode('-SHSN', 100)).toBe(85);
});

test('vicinity / recent groups and mist fall back to clouds', () => {
    expect(metarCode('VCTS', 75)).toBe(2);
    expect(metarCode('VCSH', 100)).toBe(3);
    expect(metarCode('RETS', 44)).toBe(2);
    expect(metarCode('BR', 19)).toBe(1);
    expect(metarCode('', 0)).toBe(0);
});

test('only near Tan Son Nhat', () => {
    expect(nearStation(10.762622, 106.660172)).toBe(true);  // District 10
    expect(nearStation(10.95, 106.82)).toBe(true);          // Bien Hoa edge (~23 km)
    expect(nearStation(21.0285, 105.8542)).toBe(false);     // Ha Noi
    expect(nearStation(10.3460, 107.0843)).toBe(false);     // Vung Tau
});

// METAR VVTS 080730Z 28006KT 250V310 9999 -SHRA SCT021 FEW024CB BKN049 28/25 Q1008 NOSIG
const metar: Metar = {
    obsTime: Date.UTC(2026, 9, 8, 7, 30) / 1000, temp: 28, dewp: 25, wdir: 280, wspd: 6, wgst: null,
    wxString: '-SHRA', clouds: [{ cover: 'SCT' }, { cover: 'FEW' }, { cover: 'BKN' }], rawOb: 'METAR VVTS 080730Z ...',
};
const model = () => ({ temperature_2m: 30.4, relative_humidity_2m: 70, apparent_temperature: 35, weather_code: 95,
    cloud_cover: 92, precipitation: 0.5, rain: 0, wind_speed_10m: 10, wind_direction_10m: 200, wind_gusts_10m: 30 });

test('observation replaces the model', () => {
    const c: any = model();
    expect(applyStation(c, metar, Date.UTC(2026, 9, 8, 7, 40))).toBe(true);
    expect(c).toMatchObject({ temperature_2m: 28, relative_humidity_2m: 84, weather_code: 80, cloud_cover: 75,
        wind_speed_10m: 11.1, wind_direction_10m: 280, wind_gusts_10m: 30, precipitation: 0.5 });
    expect(c.apparent_temperature).toBeGreaterThan(30);
    expect(c.source).toMatchObject({ station: 'VVTS', observed: '2026-10-08T07:30:00.000Z' });
});

test('dry report zeroes the model rain; stale or missing report changes nothing', () => {
    const dry: any = model();
    applyStation(dry, { ...metar, wxString: null, clouds: [{ cover: 'FEW' }] }, Date.UTC(2026, 9, 8, 7, 40));
    expect([dry.weather_code, dry.precipitation, dry.rain]).toEqual([1, 0, 0]);

    for (const [m, now] of [[metar, Date.UTC(2026, 9, 8, 9, 30)], [null, Date.now()], [{ ...metar, temp: null }, Date.UTC(2026, 9, 8, 7, 40)]] as const) {
        const c: any = model();
        expect(applyStation(c, m as Metar | null, now)).toBe(false);
        expect(c).toEqual(model());
    }
});
