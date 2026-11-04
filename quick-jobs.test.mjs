import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
const source = fs.readFileSync('app.js','utf8');
const helper = source.slice(source.indexOf('function quickJobCompletionDetails('), source.indexOf('async function quickChatComplete('));
const complete = source.slice(source.indexOf('async function quickChatComplete('), source.indexOf('async function quickChatReject('));
let latest = { status: 'claimed', assigneeUid: 'worker', createdBy: 'creator', invitedBy: 'assigner', content: 'Test', claimedAt: '2026-11-04T09:00:00', dateKey: '2026-11-04', deadline: '10:00' };
const notifications = [];
const ctx = vm.createContext({
    Date, console, currentUser: { uid: 'worker', displayName: 'Worker' }, quickJobsList: [{ id: 'job' }], db: {},
    doc: (...args) => args, collection: (...args) => args, showNotification: () => assert.fail('unexpected error'),
    runTransaction: async (db, callback) => callback({
        get: async () => ({ exists: () => true, data: () => ({ ...latest }) }),
        update: (ref, data) => { latest = { ...latest, ...data }; },
        set: (ref, data) => notifications.push(data)
    })
});
vm.runInContext(helper + complete, ctx);
ctx.job = latest;
let result = vm.runInContext("quickJobCompletionDetails(job, '2026-11-04T09:30:00')", ctx);
assert.match(result, /30 ph\u00fat/);
assert.match(result, /tr\u01b0\u1edbc h\u1ea1n 30/);
result = vm.runInContext("quickJobCompletionDetails(job, '2026-11-04T10:10:00')", ctx);
assert.match(result, /tr\u1ec5 h\u1ea1n 10/);
ctx.job = { status: 'claimed', claimedAt: '2026-11-04T23:55:00' };
assert.match(vm.runInContext("quickJobCompletionDetails(job, '2026-11-05T00:05:00')", ctx), /10 ph\u00fat/);
ctx.job = {};
assert.equal(vm.runInContext("quickJobCompletionDetails(job, '2026-11-04T10:00:00')", ctx), '');
await vm.runInContext("quickChatComplete('job')", ctx);
assert.equal(latest.status, 'completed');
assert.deepEqual(notifications.map(n => n.userId).sort(), ['assigner','creator']);
assert.ok(notifications.every(n => n.type === 'quickjob_completed' && n.jobId === 'job'));
await vm.runInContext("quickChatComplete('job')", ctx);
assert.equal(notifications.length, 2, 'repeated completion does not send duplicates');
latest = { ...latest, status: 'claimed', invitedBy: 'creator' };
notifications.length = 0;
await vm.runInContext("quickChatComplete('job')", ctx);
assert.equal(notifications.length, 1, 'same creator/assigner receives only one result');
console.log('Quick jobs passed: timing, deadlines, overnight duration, completion recipients and duplicate prevention.');
