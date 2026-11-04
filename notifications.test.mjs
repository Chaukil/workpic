import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
const source = fs.readFileSync('app.js', 'utf8');
const code = source.slice(source.indexOf('const notificationClaims ='), source.indexOf('// Show Desktop Notification'));
let instant = new Date(2026, 10, 4, 9, 50);
class Clock extends Date { constructor(...args) { super(...(args.length ? args : [instant])); } }
const storage = new Map();
const sent = [];
const timers = [];
const ctx = vm.createContext({
    Date: Clock, Math, console, navigator: {}, currentUser: { uid: 'user' },
    notifyLeadMinutes: 10, jobCompletionEnabled: false, jobDayOverridesList: [],
    jobs: [{ id: 'job', title: 'Test', time: '10:00' }],
    localStorage: { getItem: k => storage.get(k), setItem: (k,v) => storage.set(k,v) },
    localDateKey: d => `${d.getFullYear()}-${d.getMonth()+1}-${d.getDate()}`,
    getScheduleEntryOnDate: (job, day) => day.getDate() === 4 ? { originDate: '2026-11-4' } : null,
    showNotification() {}, showDesktopNotification: (job, context) => sent.push(context),
    setTimeout: (fn, delay) => timers.push({ fn, delay })
});
vm.runInContext(code, ctx);
const check = () => vm.runInContext('checkNotifications()', ctx);
check(); check();
assert.equal(sent.length, 1);
assert.equal(sent[0].kind, 'lead');
instant = new Date(2026, 10, 4, 10, 0);
check();
assert.equal(sent.length, 1, 'no second alert at due time when lead is configured');
vm.runInContext('notifyLeadMinutes = 0', ctx);
check();
assert.equal(sent.length, 1, 'setting changes cannot repeat an already sent reminder');
storage.clear();
const ctx2 = vm.createContext({ ...ctx, jobs: [{ id: 'second', title: 'Test', time: '10:00' }], notifyLeadMinutes: 0 });
vm.runInContext(code, ctx2);
vm.runInContext('checkNotifications(); checkNotifications()', ctx2);
assert.equal(sent.length, 2);
assert.equal(sent[1].kind, 'due');
let options;
let closed = 0;
ctx.reg = {
    showNotification: async (title, value) => { options = value; },
    getNotifications: async () => [{ data: options.data, close: () => closed++ }, { data: { instanceId: 'newer' }, close: () => { throw Error('must not close replacement'); } }]
};
await vm.runInContext("showTimedDesktopNotification(reg, 'Test', { tag: 'job' })", ctx);
assert.equal(options.requireInteraction, false);
assert.equal(timers[0].delay, 15000);
await timers[0].fn();
assert.equal(closed, 1);
console.log('Notifications passed: single lead/due alert, repeated checks, settings changes and 15-second expiry.');
