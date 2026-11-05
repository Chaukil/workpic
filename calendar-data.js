// Vietnamese lunar calendar: astronomical new moons and winter solstice at UTC+7.
// Meeus low-precision series; month numbering follows the Vietnamese calendar.
const RAD = Math.PI / 180;
const floor = Math.floor;
function julian(date) {
    const m = date.getMonth() + 1, y = date.getFullYear();
    const a = floor((14 - m) / 12), yy = y + 4800 - a, mm = m + 12 * a - 3;
    return date.getDate() + floor((153 * mm + 2) / 5) + 365 * yy + floor(yy / 4) - floor(yy / 100) + floor(yy / 400) - 32045;
}
function newMoon(k) {
    const t = k / 1236.85, t2 = t * t, t3 = t2 * t;
    const sin = x => Math.sin(x * RAD);
    let jd = 2415020.75933 + 29.53058868 * k + 0.0001178 * t2 - 0.000000155 * t3;
    jd += 0.00033 * sin(166.56 + 132.87 * t - 0.009173 * t2);
    const m = 359.2242 + 29.10535608 * k - 0.0000333 * t2 - 0.00000347 * t3;
    const mp = 306.0253 + 385.81691806 * k + 0.0107306 * t2 + 0.00001236 * t3;
    const f = 21.2964 + 390.67050646 * k - 0.0016528 * t2 - 0.00000239 * t3;
    const correction = (0.1734 - 0.000393 * t) * sin(m) + 0.0021 * sin(2 * m)
        - 0.4068 * sin(mp) + 0.0161 * sin(2 * mp) - 0.0004 * sin(3 * mp)
        + 0.0104 * sin(2 * f) - 0.0051 * sin(m + mp) - 0.0074 * sin(m - mp)
        + 0.0004 * sin(2 * f + m) - 0.0004 * sin(2 * f - m)
        - 0.0006 * sin(2 * f + mp) + 0.001 * sin(2 * f - mp) + 0.0005 * sin(2 * mp + m);
    const delta = t < -11
        ? 0.001 + 0.000839 * t + 0.0002261 * t2 - 0.00000845 * t3 - 0.000000081 * t * t3
        : -0.000278 + 0.000265 * t + 0.000262 * t2;
    return floor(jd + correction - delta + 0.5 + 7 / 24);
}
function sunSector(day) {
    const t = (day - 0.5 - 7 / 24 - 2451545) / 36525;
    const m = (357.5291 + 35999.0503 * t - 0.0001559 * t * t - 0.00000048 * t ** 3) * RAD;
    const longitude = (280.46645 + 36000.76983 * t + 0.0003032 * t * t
        + (1.9146 - 0.004817 * t - 0.000014 * t * t) * Math.sin(m)
        + (0.019993 - 0.000101 * t) * Math.sin(2 * m) + 0.00029 * Math.sin(3 * m)) * RAD;
    return floor(((longitude % (2 * Math.PI) + 2 * Math.PI) % (2 * Math.PI)) / Math.PI * 6);
}
function month11(year) {
    const k = floor((julian(new Date(year, 11, 31)) - 2415021) / 29.530588853);
    const moon = newMoon(k);
    return sunSector(moon) >= 9 ? newMoon(k - 1) : moon;
}
function leapOffset(a11) {
    const k = floor((a11 - 2415021.076998695) / 29.530588853 + 0.5);
    let last = -1, sector = sunSector(newMoon(k + 1)), i = 1;
    do { last = sector; sector = sunSector(newMoon(k + ++i)); } while (sector !== last && i < 14);
    return i - 1;
}
const lunarCache = new Map();
export function vietnameseLunar(date) {
    const day = julian(date);
    if (lunarCache.has(day)) return lunarCache.get(day);
    const k = floor((day - 2415021.076998695) / 29.530588853);
    let start = newMoon(k + 1);
    if (start > day) start = newMoon(k);
    let a11 = month11(date.getFullYear()), b11 = a11, year;
    if (a11 >= start) { year = date.getFullYear(); a11 = month11(year - 1); }
    else { year = date.getFullYear() + 1; b11 = month11(year); }
    const diff = floor((start - a11) / 29);
    let month = diff + 11, leap = false;
    if (b11 - a11 > 365) {
        const offset = leapOffset(a11);
        if (diff >= offset) { month = diff + 10; leap = diff === offset; }
    }
    if (month > 12) month -= 12;
    if (month >= 11 && diff < 4) year--;
    const result = { day: day - start + 1, month, year, leap };
    lunarCache.set(day, result);
    return result;
}
export function dateKey(date) {
    return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
}
export function monthPair(year, month) {
    return [new Date(year, month, 1), new Date(year, month + 1, 1)];
}
const holidayCache = new Map();
export function holidaysForYear(year, policy = {}) {
    const cacheKey = `${year}|${policy.tetStart || ''}|${policy.nationalDay || 1}`;
    if (holidayCache.has(cacheKey)) return holidayCache.get(cacheKey);
    const map = {};
    const add = (date, name) => { map[dateKey(date)] = name; };
    add(new Date(year, 0, 1), 'Tết Dương lịch');
    add(new Date(year, 3, 30), 'Ngày Chiến thắng');
    add(new Date(year, 4, 1), 'Quốc tế Lao động');
    add(new Date(year, 8, 2), 'Quốc khánh');
    add(new Date(year, 8, Number(policy.nationalDay) === 3 ? 3 : 1), 'Nghỉ liền kề Quốc khánh');
    if (year >= 2026) add(new Date(year, 10, 24), 'Ngày Văn hóa Việt Nam');
    let tet;
    for (let d = new Date(year, 0, 1); d < new Date(year, 5, 1); d.setDate(d.getDate() + 1)) {
        const lunar = vietnameseLunar(d);
        if (!lunar.leap && lunar.month === 3 && lunar.day === 10) add(d, 'Giỗ Tổ Hùng Vương');
        if (!lunar.leap && lunar.month === 1 && lunar.day === 1) tet = new Date(d);
    }
    // Five statutory Tet days. The employer can choose a different starting date.
    const configured = /^\d{4}-\d{2}-\d{2}$/.test(policy.tetStart || '') ? new Date(`${policy.tetStart}T12:00:00`) : null;
    const start = configured && configured.getFullYear() === year && !isNaN(configured) ? configured : tet;
    if (start) for (let i = 0; i < 5; i++) {
        const d = new Date(start); d.setDate(d.getDate() + i); add(d, 'Tết Nguyên Đán');
    }
    holidayCache.set(cacheKey, map);
    return map;
}
