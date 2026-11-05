import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
import { personalEventOccurs, checklistFromText, compareScheduleEntries } from './productivity-data.js';
import { dateKey } from './calendar-data.js';

const base = { date: '2026-01-31', title: 'Monthly' };
assert.equal(personalEventOccurs(base, '2026-02-01'), false, 'legacy events remain one-off');
assert.equal(personalEventOccurs({ ...base, repeat: 'monthly' }, '2026-03-31'), true);
assert.equal(personalEventOccurs({ ...base, repeat: 'monthly' }, '2026-02-28'), false, 'skip absent month days');
assert.equal(personalEventOccurs({ date: '2024-02-29', repeat: 'yearly' }, '2025-02-28'), false);
assert.equal(personalEventOccurs({ date: '2024-02-29', repeat: 'yearly' }, '2028-02-29'), true);
const weekly = { date: '2026-11-05', repeat: 'weekly', until: '2026-11-19' };
assert.equal(personalEventOccurs(weekly, '2026-11-12'), true);
assert.equal(personalEventOccurs(weekly, '2026-11-19'), true);
assert.equal(personalEventOccurs(weekly, '2026-11-26'), false);
assert.equal(personalEventOccurs(weekly, '2026-10-29'), false);
assert.equal(personalEventOccurs({ date: '2026-02-17', repeat: 'lunar-yearly' }, '2027-02-06'), true);
assert.equal(personalEventOccurs({ date: '2024-07-06', repeat: 'lunar-yearly' }, '2025-07-25'), false, 'do not duplicate annual events in leap month');
let nextId = 0;
const first = checklistFromText('Prepare\n\nCheck\nPrepare', [], () => `id-${++nextId}`);
assert.equal(first.length, 3);
const edited = checklistFromText('Check\nPrepare\nNew', first, () => `id-${++nextId}`);
assert.equal(edited[0].id, first[1].id, 'reordering preserves progress identity');
assert.equal(edited[1].id, first[0].id);
assert.notEqual(edited[2].id, first[2].id, 'new step starts unchecked');
assert.equal(checklistFromText(Array(100).fill('Step').join('\n'), [], () => `id-${++nextId}`).length, 50);

const source = fs.readFileSync('app.js', 'utf8');
const extract = (start, end) => source.slice(source.indexOf(start), source.indexOf(end));
const parseDate = key => new Date(`${key}T00:00:00`);
let saved = {}, selected = new Set(['2026-11-09']);
const job = { id: 'daily', title: 'Daily', time: '09:00', duration: 30, workOnSunday: false };
let override = null;
const ctx = vm.createContext({
    Date, jobs: [job], compareScheduleEntries, parseJobDate: parseDate, localDateKey: dateKey,
    getMyOffMap: () => saved,
    getDayOffDiff: () => ({ saved, added: [...selected].filter(k => !saved[k]), removed: Object.keys(saved).filter(k => !selected.has(k)) }),
    getHolidayName: () => '', getOverrideFor: (_, key) => key === '2026-11-09' ? override : null,
    getJobOccurrences: (_, from, to) => {
        const dates = [];
        for (const d = new Date(from); d <= to; d.setDate(d.getDate() + 1)) if (d.getDay() !== 0) dates.push(new Date(d));
        return dates;
    }
});
vm.runInContext(extract('function resolveShiftedDate(', 'function isJobScheduledOnDate(')
    + extract('function getDayOffJobPreview(', 'function previewMarkup('), ctx);
let preview = vm.runInContext('getDayOffJobPreview()', ctx);
assert.equal(preview.length, 1);
assert.equal(preview[0].beforeDate, '2026-11-09');
assert.equal(preview[0].date, '2026-11-07', 'skip Sunday when moving Monday off');
saved = { '2026-11-09': {} }; selected = new Set();
preview = vm.runInContext('getDayOffJobPreview()', ctx);
assert.equal(preview[0].beforeDate, '2026-11-07');
assert.equal(preview[0].date, '2026-11-09', 'canceling off restores job');
saved = {}; selected = new Set(['2026-11-09']); override = { overrideDate: '2026-11-12' };
assert.equal(vm.runInContext('getDayOffJobPreview()', ctx).length, 0, 'manual move overrides automatic shift');
override = null; selected = new Set(['2026-11-09', '2026-11-10']);
preview = vm.runInContext('getDayOffJobPreview()', ctx);
assert.equal(preview.length, 2);
assert.ok(preview.every(e => e.date === '2026-11-07'), 'consecutive off days shift together');

const current = { uid: 'me', displayName: 'My name' };
let stored = Array.from({ length: 200 }, (_, i) => ({ id: `old-${i}` }));
let fail = false, warning = '';
const history = vm.createContext({
    Date, currentUser: current, crypto: { randomUUID: () => 'new' }, db: {},
    collection() {}, where() {}, query() {},
    getDocs: async () => ({ empty: false, docs: [{ ref: 'user' }] }),
    runTransaction: async (_, fn) => {
        if (fail) throw new Error('Denied');
        await fn({ get: async () => ({ ref: 'user', data: () => ({ changeHistory: stored }) }),
            update: (_, data) => { stored = data.changeHistory; } });
    }, console: { error() {} }, showNotification: title => { warning = title; }
});
vm.runInContext(extract('async function recordChange(', 'function renderChangeHistory('), history);
await vm.runInContext("recordChange('job', 'Edit', 'Example', '09:00 → 10:00')", history);
assert.equal(stored.length, 200, 'bound document history size');
assert.equal(stored[0].id, 'old-1');
assert.equal(stored.at(-1).actorId, 'me');
assert.equal(stored.at(-1).detail, '09:00 → 10:00');
fail = true;
await vm.runInContext("recordChange('job', 'Edit', 'Example')", history);
assert.ok(warning, 'surface failed history writes without claiming main action failed');
assert.equal(stored.length, 200);

const extras = vm.createContext({});
vm.runInContext(extract('function overrideExtras(', 'function getOverrideFor('), extras);
assert.equal(vm.runInContext('overrideHasExtras(overrideExtras({ checklistDone: { a: true } }))', extras), true,
    'removing a date override must retain checklist progress');
console.log('Productivity passed: recurrence, checklist identity, off preview, bounded history and preserved progress.');
