// Shared application data helpers, calendar calculations and admin persistence.

// ===== work-hours-data =====
// Pure conversion shared by the browser and regression checks.
export function convertWorkHoursRows(rows) {
    if (!Array.isArray(rows)) throw new Error('Dữ liệu query không hợp lệ.');
    const days = ['THU', 'FRI', 'SAT', 'SUN', 'MON', 'TUE', 'WED'];
    const result = new Map();
    const sources = new Map();
    const key = d => d.toISOString().slice(0, 10);
    for (const raw of rows) {
        const row = Object.fromEntries(Object.entries(raw).map(([k, v]) => [k.toUpperCase(), v]));
        const kind = String(row.KIND || '').trim().toUpperCase();
        const line = String(row.LINE || '').trim().toUpperCase();
        // The schedule uses O100 for Station; other lines do not contribute hours.
        if (!['M151', 'O100'].includes(line)) continue;
        if (!((kind === 'MOTION' && line === 'M151') || (kind === 'STATION' && line === 'O100'))) {
            throw new Error(`KIND/LINE không hợp lệ: ${kind}/${line}`);
        }
        let etd;
        const value = String(row.ETD || '').trim();
        if (/^\d+(\.0)?$/.test(value)) etd = new Date(Date.UTC(1899, 11, 30) + Number(value) * 86400000);
        else {
            const iso = value.match(/^(\d{4})-(\d{2})-(\d{2})(?:T.*)?$/);
            const us = value.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/);
            if (iso) etd = new Date(Date.UTC(+iso[1], +iso[2] - 1, +iso[3]));
            else if (us) etd = new Date(Date.UTC(+us[3], +us[1] - 1, +us[2]));
        }
        if (!etd || !Number.isFinite(etd.getTime()) || etd.getUTCDay() !== 6) throw new Error(`ETD phải là thứ Bảy: ${value}`);
        const mss = String(row.MSS || '').trim().match(/^MSS(\d{2})(\d{2})$/i);
        const wed = new Date(etd.getTime() - 3 * 86400000);
        if (!mss || wed.getUTCMonth() + 1 !== +mss[1] || wed.getUTCDate() !== +mss[2]) {
            throw new Error(`MSS ${row.MSS} không khớp ETD ${key(etd)}.`);
        }
        days.forEach((day, i) => {
            const date = key(new Date(wed.getTime() + (i - 6) * 86400000));
            const text = String(row[day] ?? '').trim().replace(',', '.');
            const hours = Number(text);
            if (!text || !Number.isFinite(hours) || hours < 0 || hours > 24) throw new Error(`Giờ không hợp lệ: ${row.MSS}/${line}/${day}`);
            const item = result.get(date) || { date, motion: null, station: null };
            const field = kind.toLowerCase();
            const sourceKey = `${date}/${field}`;
            const source = `SITE ${String(row.SITE ?? '').trim() || '?'} · ${line} · ${row.MSS} · ${day}`;
            if (item[field] !== null && item[field] !== hours) {
                throw new Error(`Giờ ${kind} ngày ${date} khác nhau giữa các dòng query.\nDòng trước: ${sources.get(sourceKey)} = ${item[field]}h\nDòng hiện tại: ${source} = ${hours}h\nLịch chỉ có một giá trị ${kind}/ngày. Cần chọn quy tắc lấy giờ trước khi cập nhật. Chưa ghi dữ liệu vào lịch.`);
            }
            item[field] = hours;
            sources.set(sourceKey, source);
            result.set(date, item);
        });
    }
    return [...result.values()].sort((a, b) => a.date.localeCompare(b.date));
}


// ===== api-client =====
// Both GitHub Pages and local previews read IBM data from this user's machine.
export function resolveApiUrl(page) {
    const sameServer = page.protocol === 'http:' && page.hostname === 'localhost' && page.port === '8080';
    return (sameServer ? '' : 'http://localhost:8080') + '/api/work-hours';
}


// ===== calendar-data =====
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


// ===== productivity-data =====

export function personalEventOccurs(event, key) {
    if (!event?.date || key < event.date || (event.until && key > event.until)) return false;
    if (key === event.date) return true;
    const start = new Date(`${event.date}T12:00:00`), day = new Date(`${key}T12:00:00`);
    if (isNaN(start) || isNaN(day)) return false;
    switch (event.repeat || 'none') {
        case 'weekly': return start.getDay() === day.getDay();
        case 'monthly': return start.getDate() === day.getDate();
        case 'yearly': return start.getDate() === day.getDate() && start.getMonth() === day.getMonth();
        case 'lunar-yearly': {
            const a = vietnameseLunar(start), b = vietnameseLunar(day);
            // Anniversaries use the ordinary month, avoiding two occurrences in leap years.
            return !b.leap && a.day === b.day && a.month === b.month;
        }
        default: return false;
    }
}

export function checklistFromText(text, previous = [], makeId = () => crypto.randomUUID()) {
    const remaining = [...previous];
    return String(text || '').split(/\r?\n/).map(s => s.trim()).filter(Boolean).slice(0, 50).map(label => {
        const index = remaining.findIndex(item => item.text === label);
        return index >= 0 ? remaining.splice(index, 1)[0] : { id: makeId(), text: label.slice(0, 160) };
    });
}

export function compareScheduleEntries(before, after) {
    const flatten = map => {
        const result = new Map();
        Object.entries(map).forEach(([date, entries]) => entries.forEach(e => {
            result.set(`${e.job.id}|${e.originDate}`, {
                jobId: e.job.id, title: e.job.title, originDate: e.originDate,
                date, time: e.overrideTime || e.job.time || '', duration: e.job.duration || 30
            });
        }));
        return result;
    };
    const oldEntries = flatten(before), newEntries = flatten(after), result = [];
    newEntries.forEach((entry, id) => {
        const old = oldEntries.get(id);
        if (old && old.date !== entry.date) result.push({ ...entry, beforeDate: old.date });
    });
    return result.sort((a, b) => a.date.localeCompare(b.date) || a.time.localeCompare(b.time));
}


