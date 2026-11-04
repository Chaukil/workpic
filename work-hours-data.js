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
