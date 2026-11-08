import { dateKey } from './calendar-data.js';

export function loungeJobColor(entry) {
    if (entry?.shiftedFrom || entry?.movedFrom) return '#ec4899';
    if (entry?.job?.isPresenterJob) return '#8b5cf6';
    return { daily: '#ef4444', weekly: '#14b8a6', biweekly: '#3b82f6', monthly: '#f59e0b', once: '#06b6d4', custom: '#8b5cf6' }[entry?.job?.type] || '#8b5cf6';
}

export function loungeJobState(entry, displayedDate, now = new Date()) {
    if (entry.completed) return 'completed';
    const time = entry.overrideTime || entry.job.time;
    if (!/^\d{2}:\d{2}$/.test(time || '')) return 'upcoming';
    const start = new Date(`${displayedDate}T${time}:00`);
    if (isNaN(start)) return 'upcoming';
    const minutes = Number(entry.job.duration);
    const end = new Date(start.getTime() + (Number.isFinite(minutes) && minutes > 0 ? minutes : 30) * 60000);
    if (now >= end) return 'past';
    return now >= start ? 'active' : 'upcoming';
}

export function loungeWeekStart(now, week = 0) {
    const start = new Date(now);
    start.setHours(0, 0, 0, 0);
    start.setDate(start.getDate() - (start.getDay() + 6) % 7 + (week === 1 ? 7 : 0));
    return start;
}

export function loungeDays(start, entries, { showSunday = true, off = {}, holiday = () => '', now = new Date() } = {}) {
    return Array.from({ length: showSunday ? 7 : 6 }, (_, i) => {
        const date = new Date(start); date.setDate(date.getDate() + i);
        const key = dateKey(date);
        return {
            key, label: ['Thứ Hai', 'Thứ Ba', 'Thứ Tư', 'Thứ Năm', 'Thứ Sáu', 'Thứ Bảy', 'Chủ nhật'][i],
            date: `${date.getDate()}/${date.getMonth() + 1}`, off: off[key]?.reason || (off[key] ? 'Ngày off' : ''), holiday: holiday(date),
            entries: (entries[key] || []).map(entry => ({ ...entry, loungeState: loungeJobState(entry, key, now) })).sort((a, b) =>
                (a.overrideTime || a.job.time || '').localeCompare(b.overrideTime || b.job.time || '') || String(a.job.title).localeCompare(String(b.job.title)))
        };
    });
}
