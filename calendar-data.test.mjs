import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
import { vietnameseLunar, holidaysForYear, monthPair, dateKey } from './calendar-data.js';
import { personalEventOccurs } from './productivity-data.js';
const date = s => new Date(`${s}T12:00:00`);
assert.deepEqual(vietnameseLunar(date('2026-02-17')), { day: 1, month: 1, year: 2026, leap: false });
assert.deepEqual(vietnameseLunar(date('2026-04-26')), { day: 10, month: 3, year: 2026, leap: false });
assert.deepEqual(vietnameseLunar(date('2025-07-25')), { day: 1, month: 6, year: 2025, leap: true });
// Vietnam and China have different lunar dates on this date (UTC+7 versus UTC+8).
assert.deepEqual(vietnameseLunar(date('2007-02-17')), { day: 1, month: 1, year: 2007, leap: false });
assert.deepEqual(monthPair(2026, 7).map(dateKey), ['2026-08-01', '2026-09-01']);
assert.deepEqual(monthPair(2026, 11).map(dateKey), ['2026-12-01', '2027-01-01']);
const holidays = holidaysForYear(2026);
assert.equal(Object.values(holidays).filter(n => n === 'Tết Nguyên Đán').length, 5);
assert.equal(holidays['2026-04-26'], 'Giỗ Tổ Hùng Vương');
assert.equal(holidays['2026-11-24'], 'Ngày Văn hóa Việt Nam');
assert.equal(holidaysForYear(2025)['2025-11-24'], undefined);
const adjusted = holidaysForYear(2026, { tetStart: '2026-02-15', nationalDay: 3 });
assert.equal(adjusted['2026-02-15'], 'Tết Nguyên Đán');
assert.equal(adjusted['2026-02-20'], undefined);
assert.equal(adjusted['2026-09-01'], undefined);
assert.equal(adjusted['2026-09-03'], 'Nghỉ liền kề Quốc khánh');
assert.equal(holidays['2026-09-01'], 'Nghỉ liền kề Quốc khánh', 'policy cache is isolated');

const source = fs.readFileSync('app.js', 'utf8');
const extract = (start, end) => source.slice(source.indexOf(start), source.indexOf(end));
const host = { innerHTML: '' };
const user = { uid: 'me', personalCalendarEvents: [{ id: 'birthday', date: '2026-08-12', title: 'Birthday', time: '10:00' }] };
const ctx = vm.createContext({
    Date, currentUser: user, dayOffViewYear: 2026, dayOffViewMonth: 7, DAYOFF_MONTHS_SHOWN: 2,
    dayOffsList: [], dayOffSelected: new Set(), dayOffFocusUid: null,
    getMyOffMap: () => ({}), dayOffInDept: () => true, getUserAvatarUrl: () => null,
    document: { getElementById: () => host }, localDateKey: dateKey, escapeHtml: s => s,
    vietnameseLunar, holidaysForYear, monthPair, personalEventOccurs
});
vm.runInContext(extract('function getHolidayName(', 'function syncDayOffFilters(')
    + extract('function renderDayOffCalendars(', 'function getDayOffDiff('), ctx);
vm.runInContext('renderDayOffCalendars()', ctx);
assert.match(host.innerHTML, /Tháng 8\/2026/);
assert.match(host.innerHTML, /Tháng 9\/2026/);
assert.match(host.innerHTML, /ÂL/);
assert.match(host.innerHTML, /Birthday/);
assert.match(host.innerHTML, /calendar-holiday-label/);
assert.equal(ctx.dayOffSelected.size, 0, 'personal events do not register time off');
assert.doesNotMatch(host.innerHTML, /class="dayoff-day [^"]*selected/);

vm.runInContext(extract('function resolveShiftedDate(', 'function buildScheduleEntries('), ctx);
const shifted = vm.runInContext("resolveShiftedDate({workOnSunday:false}, new Date(2026, 8, 2), {})", ctx);
assert.equal(dateKey(shifted), '2026-08-31', 'skip both National Day holidays');
const tetShift = vm.runInContext("resolveShiftedDate({workOnSunday:false}, new Date(2026, 1, 21), {})", ctx);
assert.equal(dateKey(tetShift), '2026-02-16', 'skip consecutive Tet holidays');
console.log('Calendar passed: Vietnamese lunar/leap dates, holiday policies, paired months, personal entries and job shifting.');

const fields = {
    personalEventId: { value: 'birthday' }, personalEventDate: { value: '2026-08-12' },
    personalEventTitle: { value: 'Edited birthday' }, personalEventTime: { value: '11:00' },
    personalEventNotes: { value: 'Bring cake' }, personalEventStatus: { textContent: '' },
    personalEventRepeat: { value: 'none' }, personalEventUntil: { value: '' }
};
let hidden = false;
const controls = [{ disabled: false }, { disabled: false }];
fields.personalEventForm = {
    reportValidity: () => true, querySelectorAll: () => controls,
    classList: { add: () => { hidden = true; } }
};
let stored = [...user.personalCalendarEvents, { id: 'other-device', date: '2026-09-01', title: 'Keep me' }];
let failSave = false;
const persistence = vm.createContext({
    currentUser: user, crypto: { randomUUID: () => 'new-event' },
    recordChange: async () => {}, repeatLabel: s => s,
    document: { getElementById: id => fields[id] }, db: {},
    collection: () => ({}), query: () => ({}), where: () => ({}),
    getDocs: async () => ({ empty: false, docs: [{ ref: 'user' }] }),
    runTransaction: async (_, callback) => {
        if (failSave) throw new Error('Offline');
        await callback({
            get: async () => ({ ref: 'user', data: () => ({ personalCalendarEvents: stored }) }),
            update: (_, patch) => { stored = patch.personalCalendarEvents; }
        });
    }, renderDayOffCalendars() {}, renderSchedule() {}
});
vm.runInContext(extract('async function updatePersonalCalendar(', 'function setupPersonalCalendar('), persistence);
await vm.runInContext('updatePersonalCalendar()', persistence);
assert.equal(stored.length, 2);
assert.equal(stored.find(e => e.id === 'birthday').title, 'Edited birthday');
assert.ok(stored.find(e => e.id === 'other-device'), 'preserve concurrent events');
assert.ok(hidden);
hidden = false;
failSave = true;
await vm.runInContext('updatePersonalCalendar(true)', persistence);
assert.equal(stored.length, 2, 'failed deletion must not remove saved data');
assert.equal(hidden, false, 'keep editor open when saving fails');
assert.match(fields.personalEventStatus.textContent, /Offline/);
assert.ok(controls.every(b => !b.disabled));
failSave = false;
await vm.runInContext('updatePersonalCalendar(true)', persistence);
assert.deepEqual(stored.map(e => e.id), ['other-device']);
assert.equal(user.personalCalendarEvents.length, 0, 'remove deleted event from local UI');
console.log('Personal calendar persistence passed: edit/delete, concurrent entries and failed save recovery.');

// Department events are read from their owner, without copying private events.
const sharedContext = vm.createContext({ currentUser: { uid: 'me', department: 'layout', personalCalendarEvents: [{id:'own',date:'2026-11-12'}] },
    departmentCalendarUsers: {
        colleague: {department:'layout',personalCalendarEvents:[{id:'shared',date:'2026-11-12',scope:'department',department:'layout'},{id:'private',date:'2026-11-12'}]},
        other: {department:'other',personalCalendarEvents:[{id:'outside',date:'2026-11-12',scope:'department',department:'other'}]},
        moved: {department:'layout',personalCalendarEvents:[{id:'old-department',date:'2026-11-12',scope:'department',department:'other'}]}
    }, personalEventOccurs });
vm.runInContext(extract('function getPersonalEvents(', 'function syncDayOffFilters('), sharedContext);
assert.equal(vm.runInContext("getPersonalEvents('2026-11-12').map(e=>e.id).sort().join(',')", sharedContext), 'own,shared');
assert.equal(vm.runInContext("getPersonalEvents('2026-11-12').find(e=>e.id==='shared').ownerUid", sharedContext), 'colleague');
vm.runInContext("currentUser.department = ''", sharedContext);
assert.equal(vm.runInContext("getPersonalEvents('2026-11-12').length", sharedContext), 1);
console.log('Department events passed: same-department sharing, private isolation, department changes and owner identity.');
