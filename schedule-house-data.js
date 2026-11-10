import { dateKey } from './calendar-data.js';

export function houseWeekStart(now, week = 0) {
    const start = new Date(now); start.setHours(0, 0, 0, 0);
    start.setDate(start.getDate() - (start.getDay() + 6) % 7 + (week === 1 ? 7 : 0));
    return start;
}

export function houseTaskState(entry, day, now = new Date()) {
    if (entry.completed) return 'completed';
    const today = dateKey(now);
    if (day < today) return 'past';
    if (day > today) return 'upcoming';
    const time = entry.overrideTime || entry.job.time;
    if (!/^([01]\d|2[0-3]):[0-5]\d$/.test(time || '')) return 'active';
    const start = new Date(`${day}T${time}:00`).getTime();
    const duration = Number(entry.job.duration);
    const end = start + (Number.isFinite(duration) && duration > 0 ? duration : 30) * 60000;
    return now.getTime() >= end ? 'past' : now.getTime() >= start ? 'active' : 'upcoming';
}

export function houseDays(start, entries, { off = {}, holiday = () => '' } = {}) {
    return Array.from({ length: 7 }, (_, i) => {
        const day = new Date(start); day.setDate(day.getDate() + i);
        const key = dateKey(day);
        return { key, floor: i + 1,
            label: ['Thứ Hai', 'Thứ Ba', 'Thứ Tư', 'Thứ Năm', 'Thứ Sáu', 'Thứ Bảy', 'Chủ nhật'][i],
            date: `${day.getDate()}/${day.getMonth() + 1}`,
            off: off[key]?.reason || (off[key] ? 'Ngày off' : ''), holiday: holiday(day),
            entries: [...(entries[key] || [])].sort((a, b) =>
                (a.overrideTime || a.job.time || '').localeCompare(b.overrideTime || b.job.time || '') || String(a.job.title).localeCompare(String(b.job.title))) };
    });
}

export function houseLights(day, now, manual) {
    const states = day.entries.map(entry => houseTaskState(entry, day.key, now));
    const automatic = day.key === dateKey(now) && states.some(state => state === 'active' || state === 'upcoming');
    return { on: manual ?? automatic, states, automatic,
        signature: `${dateKey(now)}:${states.join(',')}` };
}
