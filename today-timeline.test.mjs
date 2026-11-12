import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
const source = fs.readFileSync('app.js', 'utf8');
const code = source.slice(source.indexOf('function renderTimeline('), source.indexOf('async function handleTimelineDrop'));
const helper = source.slice(source.indexOf('function getTodayShift('), source.indexOf('function renderTodayJobs('));
let instant = new Date(2026, 10, 8, 21, 15);
class Clock extends Date { constructor(...args) { super(...(args.length ? args : [instant])); } }
const key = d => `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`;
const container = { innerHTML: '', querySelector: () => ({ appendChild() {} }), querySelectorAll: () => [] };
let range;
const user = { workShift: 'night' };
const ctx = vm.createContext({
    Date: Clock, currentUser: user, showSunday: false, jobs: [],
    document: { getElementById: () => container, createElement: () => ({ style: {} }) },
    localDateKey: key, parseJobDate: s => new Clock(s + 'T00:00:00'), getMyOffMap: () => ({}),
    getHolidayName: () => '', getPersonalEvents: () => [], compactCalendarLabel: s => s,
    escapeHtml: s => s, getJobDuration: j => j.duration,
    buildScheduleEntries: (start, end) => {
        range = [key(start), key(end)];
        const entry = (title, time) => ({ job: { id: title, title, time, duration: 30 }, originDate: key(start) });
        return {
            '2026-11-08': [entry('Evening', '21:00'), entry('Daytime', '10:00'), entry('PreviousMorning', '02:00')],
            '2026-11-09': [entry('NextMorning', '02:00')]
        };
    }
});
vm.runInContext(helper + code, ctx);
const render = () => vm.runInContext("renderTimeline({ todayOnly: true, containerId: 'todayTimelineView' })", ctx);
render();
assert.deepEqual(range, ['2026-11-08','2026-11-09']);
assert.equal((container.innerHTML.match(/class="timeline-row/g) || []).length, 1);
assert.match(container.innerHTML, /Evening/);
assert.match(container.innerHTML, /NextMorning/);
assert.doesNotMatch(container.innerHTML, /PreviousMorning|Daytime/);
assert.match(container.innerHTML, /--cols:11/);
assert.match(container.innerHTML, /once (?:cross-day-job )?active/);
assert.match(container.innerHTML, /draggable="false"/);
instant = new Date(2026, 10, 9, 2, 15);
render();
assert.deepEqual(range, ['2026-11-08','2026-11-09'], 'night shift persists after midnight');
assert.match(container.innerHTML, /once (?:cross-day-job )?active/);
instant = new Date(2026, 10, 8, 10, 15);
user.workShift = 'day';
render();
assert.deepEqual(range, ['2026-11-08','2026-11-08']);
assert.match(container.innerHTML, /--cols:13/);
assert.match(container.innerHTML, /Daytime/);
assert.doesNotMatch(container.innerHTML, /Evening|NextMorning|PreviousMorning/);
console.log('Today shift timeline passed: wide day/night ranges, Sunday, next-day jobs and overnight active shift.');


// Opening a job must finish hiding the timeline before showing details.
const switchCode = source.slice(source.indexOf('function openJobFromToday('), source.indexOf('function getTodayShift('));
const events = {};
const actions = [];
const switchContext = vm.createContext({
    currentUser: {},
    document: { getElementById: id => ({ addEventListener: (event, handler) => { events[id + event] = handler; } }) },
    viewDataModal: { hide: () => actions.push('hide-today') },
    openViewJobModal: job => actions.push('show-' + job.id),
    openViewDataModal: () => actions.push('return-today')
});
vm.runInContext(switchCode, switchContext);
vm.runInContext("openJobFromToday({ id: 'job' })", switchContext);
assert.deepEqual(actions, ['hide-today']);
events['viewDataModalhidden.bs.modal']();
assert.deepEqual(actions, ['hide-today', 'show-job']);
events['viewJobModalhidden.bs.modal']();
assert.deepEqual(actions, ['hide-today', 'show-job', 'return-today']);
console.log('Job modal transition and return to today timeline passed.');

// Calendar cards stay lit until the occurrence's full duration has elapsed.
const calendarStateCode = source.slice(source.indexOf('const displayTimeForClass ='), source.indexOf('const displayTime = entry.overrideTime || job.time;'));
const calendarState = (time, duration, now, { date = '2026-11-08', shift = 'day', overrideTime = null } = {}) => {
    const context = vm.createContext({ Date, job: { time, duration }, entry: { overrideTime },
        cellDate: new Date(date + 'T00:00:00'), todayDate: new Date(now.slice(0, 10) + 'T00:00:00'),
        currentUser: { workShift: shift }, snoozeActive: false, timeClass: 'future',
        getJobDuration: job => job.duration || 30 });
    const fixedCode = calendarStateCode.replace('const now = new Date();', 'const now = new Date(' + JSON.stringify(now) + ');');
    vm.runInContext(fixedCode, context);
    return context.timeClass;
};
assert.equal(calendarState('09:00', 120, '2026-11-08T09:00:00'), 'today');
assert.equal(calendarState('09:00', 120, '2026-11-08T10:59:59'), 'today');
assert.equal(calendarState('09:00', 120, '2026-11-08T11:00:00'), 'past');
assert.equal(calendarState('09:00', null, '2026-11-08T09:29:59'), 'today');
assert.equal(calendarState('09:00', null, '2026-11-08T09:30:00'), 'past');
assert.equal(calendarState('09:00', 120, '2026-11-08T12:30:00', { overrideTime: '11:00' }), 'today');
assert.equal(calendarState('23:30', 120, '2026-11-09T00:30:00'), 'today');
assert.equal(calendarState('02:00', 120, '2026-11-09T03:59:59', { shift: 'night' }), 'today');
assert.equal(calendarState('02:00', 120, '2026-11-09T04:00:00', { shift: 'night' }), 'past');
console.log('Calendar duration passed: start/end boundaries, default duration, overrides and overnight work.');
