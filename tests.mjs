import assert from 'node:assert/strict';
import fs, { readFileSync } from 'node:fs';
import vm from 'node:vm';
import test from 'node:test';
import { convertWorkHoursRows, resolveApiUrl, vietnameseLunar, dateKey, monthPair, holidaysForYear, personalEventOccurs, checklistFromText, compareScheduleEntries, ADMIN_EMAIL, FEATURES, ACTIONS, adminJobGroup, USER_COLLECTIONS, hasPermission, normalizePolicy, profilePolicy, createAdminStore, blessingChanges, blessingNotice } from './app-data.js';

test('saving an account name updates duplicate profiles, keeps the dialog open and reports failures inline', async () => {
    const source = fs.readFileSync('app.js', 'utf8');
    const code = source.slice(source.indexOf('async function saveUserProfile('), source.indexOf('function handleChangePassword('));
    const classes = new Set(), writes = [];
    const fields = {
        profileDisplayName: { value: 'New display name' },
        saveProfileBtn: { innerHTML: 'Save', disabled: false },
        profileSaveStatus: { textContent: '', classList: { add: value => classes.add(value), remove: value => classes.delete(value) } }
    };
    let fail = false;
    const context = vm.createContext({
        currentUser: { uid: 'worker', displayName: 'Before' }, accessControl: { requireAccess: () => true },
        document: { getElementById: id => fields[id] }, db: {},
        collection: () => ({}), query: () => ({}), where: () => ({}),
        getDocs: async () => { if (fail) throw new Error('Offline'); return { empty: false, docs: [{ ref: 'first' }, { ref: 'duplicate' }] }; },
        writeBatch: () => ({ update: (ref, value) => writes.push({ ref, value }), commit: async () => {} }),
        updateUserProfileUI() {}, showNotification() {}, userProfileModal: { hide: () => assert.fail('Name save must keep the profile form open') },
        console: { error() {} }
    });
    vm.runInContext(code, context); await vm.runInContext('saveUserProfile()', context);
    assert.equal(writes.length, 2);
    assert.equal(context.currentUser.displayName, 'New display name');
    assert.match(fields.profileSaveStatus.textContent, /Đã lưu/);
    assert.equal(fields.saveProfileBtn.disabled, false);
    fail = true; fields.profileDisplayName.value = 'Unsaved name';
    await vm.runInContext('saveUserProfile()', context);
    assert.equal(context.currentUser.displayName, 'New display name');
    assert.equal(classes.has('text-danger'), true);
    assert.equal(fields.saveProfileBtn.innerHTML, 'Save');
});

// ===== admin-data checks =====
await (async function () {
function fixture() {
    const denied = new Set();
    let failWrites = false;
    const state = new Map([
        ['users/root', { uid: 'root', email: ADMIN_EMAIL }],
        ['users/worker', { uid: 'worker', email: 'worker@example.com' }],
        ['users/other', { uid: 'other', email: 'other@example.com' }],
        ['jobs/worker-job', { ownerId: 'worker', title: 'Work' }],
        ['jobs/other-job', { ownerId: 'other', title: 'Keep' }],
        ['dayOffs/day', { userId: 'worker' }],
        ['quickJobs/assigned', { createdBy: 'other', assigneeUid: 'worker', status: 'claimed' }],
        ['quickJobs/authored', { createdBy: 'worker', assigneeUid: 'other' }]
    ]);
    const auth = { currentUser: { uid: 'root', email: ADMIN_EMAIL } };
    let next = 0;
    const clone = value => value === undefined ? undefined : structuredClone(value);
    const snap = ref => ({ ref, id: ref.path.split('/').at(-1), exists: () => state.has(ref.path), data: () => clone(state.get(ref.path)) });
    function writer() {
        const writes = [];
        return { set: (ref, data) => writes.push(() => state.set(ref.path, clone(data))),
            update: (ref, data) => writes.push(() => state.set(ref.path, { ...state.get(ref.path), ...clone(data) })),
            delete: ref => writes.push(() => state.delete(ref.path)), commit: async () => { if (failWrites) throw new Error('Write denied'); writes.forEach(write => write()); } };
    }
    const sdk = {
        collection: (_, name) => ({ path: name }),
        doc: (...args) => args.length === 1 ? { path: `${args[0].path}/auto-${++next}` } : { path: `${args[1]}/${args[2]}` },
        query: (ref, filter) => ({ ...ref, filter }), where: (field, op, value) => ({ field, value }),
        getDocs: async ref => {
            if (denied.has(ref.path)) throw new Error('Read denied: ' + ref.path);
            const docs = [...state.entries()].filter(([path, data]) => path.startsWith(ref.path + '/') && (!ref.filter || data[ref.filter.field] === ref.filter.value)).map(([path]) => snap({ path }));
            return { docs, empty: !docs.length };
        }, getDoc: async ref => snap(ref), writeBatch: writer,
        runTransaction: async (_, callback) => {
            const tx = writer(); tx.get = async ref => snap(ref);
            const result = await callback(tx); await tx.commit(); return result;
        }
    };
    return { state, auth, denied, failWrites: value => { failWrites = value; }, api: createAdminStore({ db: {}, auth, sdk }) };
}
test('only explicitly checked rights enable actions', () => {
    assert.equal(hasPermission({}, 'jobs'), false);
    assert.equal(hasPermission({ features: { jobs: { edit: true } } }, 'jobs', 'edit'), false);
    assert.equal(hasPermission({ features: { jobs: { view: true, edit: true } } }, 'jobs', 'edit'), true);
    assert.equal(hasPermission({ disabled: true, features: { jobs: { view: true } } }, 'jobs'), false);
    const value = normalizePolicy({ features: { jobs: { view: false, edit: true } } });
    assert.ok(ACTIONS.every(action => !value.features.jobs[action]));
});
test('application admin gate rejects other users and protects root', async () => {
    const f = fixture();
    await assert.rejects(f.api('setPermissions', { uid: 'root', policy: {} }));
    await assert.rejects(f.api('deleteUser', { uid: 'root', confirmUid: 'root' }));
    f.auth.currentUser = { uid: 'worker', email: 'worker@example.com' };
    await assert.rejects(f.api('listUsers'));
});
test('rights persist to every profile of the selected user', async () => {
    const f = fixture(); f.state.set('users/duplicate', { uid: 'worker', email: 'worker@example.com' });
    await f.api('setPermissions', { uid: 'worker', policy: { features: { jobs: { view: true, edit: true } } } });
    assert.equal(f.state.get('users/worker').uiPermissions.features.jobs.edit, true);
    assert.equal(f.state.get('users/duplicate').uiPermissions.features.jobs.delete, false);
    assert.equal(f.state.get('users/other').uiPermissions, undefined);
});
test('job edits preserve ownership and select the intended user', async () => {
    const f = fixture();
    await f.api('saveDocument', { uid: 'worker', collection: 'jobs', id: 'worker-job', value: { ownerId: 'worker', title: 'Edited' } });
    assert.equal(f.state.get('jobs/worker-job').title, 'Edited');
    await assert.rejects(f.api('saveDocument', { uid: 'worker', collection: 'jobs', id: 'other-job', value: { ownerId: 'worker' } }));
    await assert.rejects(f.api('saveDocument', { uid: 'worker', collection: 'jobs', id: 'worker-job', value: { ownerId: 'other' } }));
});
test('application deletion retains a login marker and jobs by other authors', async () => {
    const f = fixture();
    await assert.rejects(f.api('deleteUser', { uid: 'worker', confirmUid: 'other' }));
    await f.api('deleteUser', { uid: 'worker', confirmUid: 'worker' });
    assert.equal(f.state.has('jobs/worker-job'), false);
    assert.equal(f.state.has('dayOffs/day'), false);
    assert.equal(f.state.has('quickJobs/authored'), false);
    assert.equal(f.state.has('jobs/other-job'), true);
    assert.equal(f.state.get('quickJobs/assigned').assigneeUid, null);
    assert.equal(f.state.get('quickJobs/assigned').status, 'open');
    assert.equal(f.state.get('users/worker').appDeleted, true);
    assert.equal((await f.api('listUsers')).users.some(u => u.uid === 'worker'), false);
    await f.api('deleteUser', { uid: 'worker', confirmUid: 'worker' });
});
test('admin creates jobs/off days for the selected user and rejects duplicates', async () => {
    const f = fixture();
    await f.api('createJob', { uid: 'worker', value: { title: 'New job', date: '2026-11-12', time: '10:00', duration: 30 } });
    assert.equal([...f.state.values()].find(d => d.title === 'New job').ownerId, 'worker');
    const data = { uid: 'worker', collection: 'dayOffs', value: { userId: 'other', date: '2026-11-13' } };
    await f.api('createDocument', data);
    assert.equal(f.state.get('dayOffs/worker_2026-11-13').userId, 'worker');
    await assert.rejects(f.api('createDocument', data));
});
test('latest permissions win, deletion markers always deny application access', () => {
    const docs = values => values.map(value => ({ data: () => value }));
    assert.deepEqual(profilePolicy([]), {});
    assert.equal(profilePolicy(docs([{ uiPermissionsUpdatedAt: '2026-11-11', uiPermissions: {} }, { uiPermissionsUpdatedAt: '2026-11-12', uiPermissions: { disabled: true } }])).disabled, true);
    assert.equal(profilePolicy(docs([{}, { appDeleted: true }])).appDeleted, true);
});

test('interrupted application deletions remain visible to admin for retry', async () => {
    const f = fixture();
    f.state.set('users/worker', { uid: 'worker', email: 'worker@example.com', appDeleted: true, appDeletionPending: true });
    assert.equal((await f.api('listUsers')).users.some(u => u.uid === 'worker'), true);
    await assert.rejects(f.api('setPermissions', { uid: 'worker', policy: {} }));
    await f.api('deleteUser', { uid: 'worker', confirmUid: 'worker' });
    assert.equal(f.state.get('users/worker').appDeletionPending, false);
    assert.equal((await f.api('listUsers')).users.some(u => u.uid === 'worker'), false);
});

test('admin profile form updates all duplicate profiles while preserving account identity and permissions', async () => {
    const f = fixture();
    const rights = normalizePolicy({ features: { jobs: { view: true } } });
    f.state.set('users/worker', { uid: 'worker', email: 'worker@example.com', uiPermissions: rights, personalCalendarEvents: [{ id: 'event' }] });
    f.state.set('users/duplicate', { uid: 'worker', email: 'worker@example.com' });
    await f.api('saveProfile', { uid: 'worker', today: '2026-11-12', value: {
        displayName: 'Updated worker', department: 'station', workShift: 'night', avatar: null,
        notifyLeadMinutes: 15, jobCompletionEnabled: true
    } });
    for (const path of ['users/worker', 'users/duplicate']) {
        assert.equal(f.state.get(path).displayName, 'Updated worker');
        assert.equal(f.state.get(path).workShift, 'night');
        assert.equal(f.state.get(path).jobCompletionSince, '2026-11-12');
        assert.equal(f.state.get(path).email, 'worker@example.com');
    }
    assert.deepEqual(f.state.get('users/worker').uiPermissions, rights);
    assert.deepEqual(f.state.get('users/worker').personalCalendarEvents, [{ id: 'event' }]);
    assert.equal(f.state.get('users/other').displayName, undefined);
});

test('admin can edit, reassign and delete quick jobs created by somebody else', async () => {
    const f = fixture();
    await f.api('saveDocument', { uid: 'worker', collection: 'quickJobs', id: 'assigned', value: {
        createdBy: 'other', assigneeUid: 'root', status: 'claimed', content: 'Admin edited'
    } });
    assert.equal(f.state.get('quickJobs/assigned').createdBy, 'other');
    assert.equal(f.state.get('quickJobs/assigned').assigneeUid, 'root');
    await f.api('deleteDocument', { uid: 'other', collection: 'quickJobs', id: 'assigned' });
    assert.equal(f.state.has('quickJobs/assigned'), false);
});

test('all job groups remain editable and deletable with their own document IDs', async () => {
    const f = fixture();
    assert.equal(adminJobGroup({ type: 'weekly' }), 'fixed');
    assert.equal(adminJobGroup({ type: 'once' }), 'once');
    assert.equal(adminJobGroup({ type: 'daily', isOutOfSchedule: true }), 'outside');
    assert.equal(adminJobGroup({ type: 'custom' }), 'outside');
    for (const [id, type, isOutOfSchedule] of [['fixed', 'weekly', false], ['once', 'once', false], ['outside', 'custom', true]]) {
        f.state.set(`jobs/${id}`, { ownerId: 'other', title: id, type, isOutOfSchedule });
        await f.api('saveDocument', { uid: 'other', collection: 'jobs', id, value: { ...f.state.get(`jobs/${id}`), title: 'Changed' } });
        assert.equal(f.state.get(`jobs/${id}`).title, 'Changed');
        await f.api('deleteDocument', { uid: 'other', collection: 'jobs', id });
        assert.equal(f.state.has(`jobs/${id}`), false);
    }
});

test('one unreadable collection does not hide the profile or other editable job groups', async () => {
    const f = fixture(); f.denied.add('notifications');
    const result = await f.api('getUserData', { uid: 'worker' });
    assert.equal(result.collections.users.length, 1);
    assert.equal(result.collections.jobs[0].id, 'worker-job');
    assert.deepEqual(result.collections.notifications, []);
    assert.match(result.errors.notifications, /Read denied/);
});

test('blessing messages name the exact granted and revoked rights', () => {
    const initial = normalizePolicy({ features: { jobs: { view: true, edit: true } } });
    const granted = blessingNotice(blessingChanges({}, initial));
    assert.equal(granted.type, 'blessing_granted');
    assert.deepEqual(granted.granted, [{ feature: 'jobs', actions: ['view', 'edit'] }]);
    assert.match(granted.message, /Đấng tối cao/);
    assert.match(granted.message, /Job và lịch làm việc: Xem, Sửa/);
    const reduced = normalizePolicy({ features: { jobs: { view: true } } });
    const revoked = blessingNotice(blessingChanges(initial, reduced));
    assert.equal(revoked.type, 'blessing_revoked');
    assert.deepEqual(revoked.revoked, [{ feature: 'jobs', actions: ['edit'] }]);
    assert.match(revoked.message, /thu hồi/);
});

test('permission updates store one notification and the same blessing on every duplicate profile', async () => {
    const f = fixture(); f.state.set('users/duplicate', { uid: 'worker', email: 'worker@example.com' });
    const policy = { features: { jobs: { view: true, edit: true } } };
    const result = await f.api('setPermissions', { uid: 'worker', policy });
    assert.equal(result.changed, true);
    let notices = [...f.state.entries()].filter(([path]) => path.startsWith('notifications/'));
    assert.equal(notices.length, 1);
    assert.equal(notices[0][1].userId, 'worker');
    assert.equal(notices[0][1].read, false);
    assert.equal(f.state.get('users/worker').lastBlessing.id, f.state.get('users/duplicate').lastBlessing.id);
    assert.equal(f.state.get('users/worker').lastBlessing.id, result.notice.id);
    assert.equal((await f.api('setPermissions', { uid: 'worker', policy })).changed, false);
    assert.equal([...f.state.keys()].filter(path => path.startsWith('notifications/')).length, 1);
    await f.api('setPermissions', { uid: 'worker', policy: {} });
    notices = [...f.state.entries()].filter(([path]) => path.startsWith('notifications/'));
    assert.equal(notices.length, 2);
    assert.equal(f.state.get('users/worker').lastBlessing.type, 'blessing_revoked');
    assert.equal(hasPermission(f.state.get('users/worker').uiPermissions, 'jobs'), false);
});

test('failed notification/permission transactions leave both rights and messages unchanged', async () => {
    const f = fixture(); f.failWrites(true);
    await assert.rejects(f.api('setPermissions', { uid: 'worker', policy: { features: { jobs: { view: true } } } }), /Write denied/);
    assert.equal(f.state.get('users/worker').uiPermissions, undefined);
    assert.equal([...f.state.keys()].some(path => path.startsWith('notifications/')), false);
});

test('rights prepared for a locked account are persisted and clearly marked as pending unlock', async () => {
    const f = fixture();
    await f.api('setPermissions', { uid: 'worker', policy: { disabled: true } });
    await f.api('setPermissions', { uid: 'worker', policy: { disabled: true, features: { jobs: { view: true } } } });
    assert.equal(f.state.get('users/worker').uiPermissions.features.jobs.view, true);
    assert.match(f.state.get('users/worker').lastBlessing.message, /mở khóa/);
    assert.equal(hasPermission(f.state.get('users/worker').uiPermissions, 'jobs'), false);
});

})();

// ===== ai-parser checks =====
await (async function () {
const source = fs.readFileSync(new URL('./app.js', import.meta.url), 'utf8');
const parser = source.slice(source.indexOf('const GEMINI_CONNECTION_STORAGE'), source.indexOf('function validateAIJobs'));
const storage = new Map([['key', 'test-key']]);
let calls = [];
let fail = new Set();
let responseText = '[]';
function session() {
    const ctx = vm.createContext({
        GEMINI_API_KEY_STORAGE: 'key', console: { log() {}, warn() {}, table() {} },
        localStorage: { getItem: k => storage.get(k), setItem: (k,v) => storage.set(k,v), removeItem: k => storage.delete(k) },
        AbortController, AbortSignal, setTimeout, clearTimeout,
        localDateKey: () => '2026-11-04', todayKey: () => '2026-11-04', validateAIJobs: jobs => jobs,
        fetch: async (url, options) => {
            calls.push(url);
            if (!options.method) return { ok: true, json: async () => ({ models: [
                { name: 'models/gemini-test-flash-lite', supportedGenerationMethods: ['generateContent'] }
            ] }) };
            const model = url.split('/models/')[1].split(':')[0];
            if (fail.has(model)) return { ok: false, status: 404, json: async () => ({ error: { message: 'unavailable' } }) };
            return { ok: true, json: async () => ({ candidates: [{ content: { parts: [{ text: responseText }] } }] }) };
        }
    });
    vm.runInContext(parser, ctx);
    return expression => vm.runInContext(expression, ctx);
}
let run = session();
assert.equal(await run('checkGeminiConnection()'), 'gemini-test-flash-lite');
assert.equal(calls.length, 2, 'discovery followed by actual connection probe');
calls = [];
run = session();
await run("analyzeTextWithGemini('họp ngày mai')");
assert.equal(calls.length, 1, 'reload reuses successful model without checking other versions');
assert.match(calls[0], /gemini-test-flash-lite/);
calls = [];
await run('checkGeminiConnection()');
assert.equal(calls.length, 1, 'check reuses saved model without listing versions');
run("saveGeminiConnection({ models: ['gemini-test-flash-lite', 'gemini-backup-flash'] })");
fail.add('gemini-test-flash-lite');
calls = [];
await run("analyzeTextWithGemini('họp')");
assert.equal(calls.length, 2);
assert.equal(run('getGeminiConnection().model'), 'gemini-backup-flash');
calls = [];
await run("analyzeTextWithGemini('họp')");
assert.equal(calls.length, 1, 'failed version is skipped on subsequent requests');
responseText = '{}';
await assert.rejects(run("analyzeTextWithGemini('họp')"));
run("saveGeminiApiKey('different-key')");
assert.equal(run('getGeminiConnection().model'), undefined, 'changing credentials resets connection');
console.log('AI model discovery, persistence, fallback, response validation and key reset passed.');

})();

// ===== api-client checks =====
await (async function () {
const github = new URL('https://chaukil.github.io/workpic/');
assert.equal(resolveApiUrl(github), 'http://localhost:8080/api/work-hours');
assert.equal(resolveApiUrl(new URL('http://127.0.0.1:5500')), 'http://localhost:8080/api/work-hours');
assert.equal(resolveApiUrl(new URL('http://localhost:5500')), 'http://localhost:8080/api/work-hours');
assert.equal(resolveApiUrl(new URL('http://localhost:8080')), '/api/work-hours');
assert.equal(resolveApiUrl(new URL('https://localhost:5500')), 'http://localhost:8080/api/work-hours');
console.log('API routing passed: GitHub Pages and local previews use this machine only.');

})();

// ===== calendar-data checks =====
await (async function () {
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
    accessControl: { requireAccess: () => true, can: () => true },
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
    accessControl: { requireAccess: () => true, can: () => true,
        saveCalendarEvent: async (entry, removeOnly) => {
            if (failSave) throw new Error('Offline');
            stored = stored.filter(e => e.id !== entry.id);
            if (!removeOnly) stored.push(entry);
            return entry;
        }
    },
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
const sharedContext = vm.createContext({
    accessControl: { requireAccess: () => true, can: () => true }, currentUser: { uid: 'me', department: 'layout', personalCalendarEvents: [{id:'own',date:'2026-11-12'}] },
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

})();

// ===== folder-links checks =====
await (async function () {
const source = fs.readFileSync('app.js', 'utf8');
const buttons = [];
const ranges = [];
const ctx = vm.createContext({
    escapeHtml: s => s,
    document: {
        createElement: () => ({ dataset: {} }),
        createRange: () => {
            const range = {
                setStart(node, offset) { this.first = node; this.start = offset; },
                setEnd(node, offset) { this.last = node; this.end = offset; },
                deleteContents() {},
                insertNode(button) { buttons.push(button); ranges.push(this); }
            };
            return range;
        }
    }
});
vm.runInContext(source.slice(source.indexOf('const QUOTE_CHARS'), source.indexOf('// Bấm link folder')), ctx);
const text = value => ({ nodeType: 3, nodeValue: value });
const element = (tagName, ...childNodes) => ({ nodeType: 1, tagName, childNodes });
test('quoted paths span rich text formatting; unquoted paths stop at spaces', () => {
    const path = String.raw`V:\Prod & Inv Control\Public\P&IC UPH WN5\03.FRAME MIL\SETUP RELEASE FRAME WN5`;
    const first = text('File setup: "V:\\Prod');
    const last = text(path.slice('V:\\Prod'.length) + '"');
    ctx.root = element('DIV', first, element('SPAN', last), element('BR'), text(String.raw`C:\Reports next`));
    vm.runInContext('enhanceFolderLinks(root)', ctx);
    assert.deepEqual(buttons.map(b => b.dataset.path), [String.raw`C:\Reports`, path]);
    assert.equal(ranges[1].first, first);
    assert.equal(ranges[1].last, last);
    assert.equal(ranges[1].start, 'File setup: "'.length);
    assert.equal(ranges[1].end, last.nodeValue.length - 1);
});
test('does not combine paths across lines or process existing buttons', () => {
    buttons.length = 0;
    ctx.root = element('DIV', element('BUTTON', text(String.raw`C:\Ignored`)), element('P', text('"C:\\One')), element('P', text(' Two"')));
    vm.runInContext('enhanceFolderLinks(root)', ctx);
    assert.deepEqual(buttons.map(b => b.dataset.path), [String.raw`C:\One`]);
});

})();

// ===== notifications checks =====
await (async function () {
const source = fs.readFileSync('app.js', 'utf8');
const code = source.slice(source.indexOf('const notificationClaims ='), source.indexOf('// Show Desktop Notification'));
let instant = new Date(2026, 10, 4, 9, 50);
class Clock extends Date { constructor(...args) { super(...(args.length ? args : [instant])); } }
const storage = new Map();
const sent = [];
const timers = [];
const ctx = vm.createContext({
    accessControl: { requireAccess: () => true, can: () => true },
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
const ctx2 = vm.createContext({
    accessControl: { requireAccess: () => true, can: () => true }, ...ctx, jobs: [{ id: 'second', title: 'Test', time: '10:00' }], notifyLeadMinutes: 0 });
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

})();

// ===== productivity-data checks =====
await (async function () {
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

})();

// ===== quick-jobs checks =====
await (async function () {
const source = fs.readFileSync('app.js','utf8');
const helper = source.slice(source.indexOf('function quickJobCompletionDetails('), source.indexOf('async function quickChatComplete('));
const complete = source.slice(source.indexOf('async function quickChatComplete('), source.indexOf('async function quickChatReject('));
let latest = { status: 'claimed', assigneeUid: 'worker', createdBy: 'creator', invitedBy: 'assigner', content: 'Test', claimedAt: '2026-11-04T09:00:00', dateKey: '2026-11-04', deadline: '10:00' };
const notifications = [];
const ctx = vm.createContext({
    accessControl: { requireAccess: () => true, can: () => true },
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

// Admin can delete a job created by someone else directly from the chat tools.
const deleteCode = source.slice(source.indexOf('async function quickChatDeleteJob('), source.indexOf('function openQuickChatPanel('));
const deleted = [];
const deleteContext = vm.createContext({
    accessControl: { requireAccess: () => true, isAdmin: () => true },
    currentUser: { uid: 'admin' }, quickJobsList: [{ id: 'foreign', createdBy: 'worker', content: 'Foreign job' }],
    confirm: () => true, doc: (...args) => args, db: {}, deleteDoc: async ref => deleted.push(ref), showNotification() {}, console
});
vm.runInContext(deleteCode, deleteContext);
await vm.runInContext("quickChatDeleteJob('foreign')", deleteContext);
assert.equal(deleted.length, 1);
deleteContext.accessControl.isAdmin = () => false;
await vm.runInContext("quickChatDeleteJob('foreign')", deleteContext);
assert.equal(deleted.length, 1, 'ordinary users cannot delete another creator job through the app');

})();

// ===== theme-fx checks =====
await (async function () {
const source=fs.readFileSync('app.js','utf8');
let code=source.slice(source.indexOf('const ThreeFx ='),source.indexOf('// CƯỜNG ĐỘ HIỆU ỨNG'));
code=code.replace("if (!threePromise) threePromise = import(THREE_URL).catch(err => { threePromise = null; throw err; });", 'if (!threePromise) threePromise = Promise.resolve(mockThree);');
code=code.replace(/const BUILDERS = \{ space:[^\n]+/, `const BUILDERS = { noel: ctx => {
    ctx.own(disposable, disposable);
    counts.push(ctx.cnt(100));
    const mat={uniforms:{uPixel:{value:0},uTime:{value:0},uAspect:{value:0}}};
    ctx.timeMats.push(mat);ctx.aspectMats.push(mat);mats.push(mat);
}, rain: ctx => ctx.own(disposable) };`);
const listeners=new Map();
const rafs=new Map();let nextRaf=0, constructors=0, disposals=0;
const counts=[], mats=[];
const classes=new Set();
const layer={ isConnected:true, dataset:{fx:'noel'}, prepend() {} };
const add=(event,fn)=>{ if(!listeners.has(event)) listeners.set(event,new Set()); listeners.get(event).add(fn); };
const remove=(event,fn)=>listeners.get(event)?.delete(fn);
const renderers=[];
class Renderer {
    constructor({canvas}) { constructors++;this.domElement=canvas;this.renderLists={dispose(){}};renderers.push(this); }
    setPixelRatio(pixel){this.pixel=pixel;} setSize(w,h){this.width=w;this.height=h;} setClearColor(){} render(){} dispose(){}
}
const ctx=vm.createContext({
    mockThree:{WebGLRenderer:Renderer,Scene:class {clear(){} traverse(){}},PerspectiveCamera:class {position={set(){}};updateProjectionMatrix(){}}},
    counts,mats,disposable:{dispose:()=>disposals++},console,navigator:{hardwareConcurrency:8},
    document:{hidden:false,body:{classList:{contains: cls=>classes.has(cls)}},createElement:()=>({remove(){}}), addEventListener:add,removeEventListener:remove},
    window:{innerWidth:3840,innerHeight:2160,devicePixelRatio:2,addEventListener:add,removeEventListener:remove},
    requestAnimationFrame:fn=>{rafs.set(++nextRaf,fn);return nextRaf;},cancelAnimationFrame:id=>rafs.delete(id),setTimeout
});
vm.runInContext(code,ctx);ctx.layer=layer;
assert.equal(await vm.runInContext("ThreeFx.start(layer,'noel',1)",ctx),true);
assert.ok(renderers[0].width*renderers[0].height*renderers[0].pixel**2<=1500001,'pixel budget on 4K display');
assert.equal(rafs.size,1);
ctx.window.innerWidth=1920;ctx.window.innerHeight=1080;
for(const fn of listeners.get('resize'))fn();
assert.equal(mats[0].uniforms.uPixel.value,renderers[0].pixel,'particle pixel scale follows resize');
assert.equal(mats[0].uniforms.uAspect.value,1920/1080);
ctx.document.hidden=true;
for(const fn of listeners.get('visibilitychange'))fn();
assert.equal(rafs.size,0,'hidden tab stops GPU loop');
ctx.document.hidden=false;
for(const fn of listeners.get('visibilitychange'))fn();
for(const fn of listeners.get('visibilitychange'))fn();
assert.equal(rafs.size,1,'repeated resume events never duplicate loops');
classes.add('modal-open');
for(const fn of listeners.get('shown.bs.modal'))fn();
assert.equal(rafs.size,0,'no animation loop during modal');
classes.delete('modal-open');
for(const fn of listeners.get('hidden.bs.modal'))fn();
assert.equal(rafs.size,1);
assert.equal(await vm.runInContext("ThreeFx.start(layer,'noel',2)",ctx),true);
assert.equal(constructors,1,'reuse WebGL context on intensity change');
assert.equal(disposals,1,'dispose shared scene resources only once');
assert.equal(rafs.size,1,'only one animation loop');
vm.runInContext('ThreeFx.stop()',ctx);
assert.equal(rafs.size,0);
assert.ok([...listeners.values()].every(set=>set.size===0),'no leaked event listeners');
assert.deepEqual(counts,[75,75]);
const first=vm.runInContext("ThreeFx.start(layer,'noel',2)",ctx);
layer.dataset.fx='rain';
const second=vm.runInContext("ThreeFx.start(layer,'rain',2)",ctx);
assert.equal(await first,null,'superseded asynchronous start cannot build a stale scene');
assert.equal(await second,true);
assert.equal(rafs.size,1);
assert.equal(constructors,1,'rapid theme switches reuse renderer');
classes.add('modal-open');
layer.dataset.fx='noel';
const pending=vm.runInContext("ThreeFx.start(layer,'noel',2)",ctx);
vm.runInContext('ThreeFx.stop()',ctx);
classes.delete('modal-open');
assert.equal(await pending,null,'disabling effect cancels a start waiting for a modal');
assert.equal(rafs.size,0);
assert.ok([...listeners.values()].every(set=>set.size===0));
console.log('Theme FX passed: renderer reuse, pixel budget, modal pause/resume, single animation loop and resource cleanup.');

})();

// ===== today-timeline checks =====
await (async function () {
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
    accessControl: { requireAccess: () => true, can: () => true },
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
    accessControl: { requireAccess: () => true, can: () => true },
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
    const context = vm.createContext({
    accessControl: { requireAccess: () => true, can: () => true }, Date, job: { time, duration }, entry: { overrideTime },
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

})();

// ===== work-hours-data checks =====
await (async function () {
const code = readFileSync(new URL('./app-data.js', import.meta.url), 'utf8');
const { convertWorkHoursRows: convert } = await import('data:text/javascript;base64,' + Buffer.from(code).toString('base64'));
const row = { ETD: '2026-11-28', MSS: 'MSS1125', KIND: 'MOTION', LINE: 'M151', THU: 11.5, FRI: 11.5, SAT: 9.75, SUN: 8, MON: 11.5, TUE: 0, WED: 9.75 };
const station = { ...row, KIND: 'STATION', LINE: 'O100' };
const rows = convert([row, station, { ...station, LINE: 'O200' }]);
assert.equal(rows.length, 7);
assert.equal(rows[0].date, '2026-11-19');
assert.equal(rows[6].date, '2026-11-25');
assert.equal(rows[5].motion, 0);
assert.equal(rows[0].station, 11.5);
const next = convert([{ ...row, ETD: '2027-01-02', MSS: 'MSS1230' }]);
assert.equal(next[0].date, '2026-12-24');
assert.equal(next[6].date, '2026-12-30');
const jan = convert([{ ...row, ETD: '2027-01-09', MSS: 'MSS0106' }]);
assert.equal(jan[0].date, '2026-12-31');
const serial = (Date.UTC(2026, 10, 28) - Date.UTC(1899, 11, 30)) / 86400000;
assert.deepEqual(convert([{ ...row, ETD: serial }]), convert([row]));
assert.deepEqual(convert([station, { ...station, LINE: 'O200', THU: 8 }]), convert([station]));
assert.deepEqual(convert([{ ...station, LINE: 'O200', THU: 8 }, station]), convert([station]));
assert.deepEqual(convert([{ ...station, LINE: 'O200' }]), []);
assert.throws(() => convert([station, { ...station, THU: 8 }]), error =>
    error.message.includes('O100 · MSS1125 · THU = 11.5h') &&
    error.message.includes('O100 · MSS1125 · THU = 8h'));
assert.throws(() => convert([{ ...row, MSS: 'MSS1124' }]), /không khớp/);
assert.throws(() => convert([{ ...row, THU: null }]), /không hợp lệ/);
assert.deepEqual(convert([{ ...row, LINE: 'M251' }]), []);
console.log('Passed: MSS dates, year rollover, OLE date, zero hours, conflicting lines, invalid input.');

})();
