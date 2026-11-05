import { vietnameseLunar } from './calendar-data.js';

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
