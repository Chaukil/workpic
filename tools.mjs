// Project build and verification commands. Keep browser code in app.js and sw.js.
import assert from 'node:assert/strict';
import fs, { readFileSync } from 'node:fs';
import { copyFile, mkdir, readFile, stat, writeFile } from 'node:fs/promises';
import vm from 'node:vm';
import test from 'node:test';
import os from 'node:os';
import path from 'node:path';
import { pathToFileURL, fileURLToPath } from 'node:url';
import { spawnSync, spawn } from 'node:child_process';
import { rollup } from '@rollup/wasm-node';
import { minify } from 'terser';

process.chdir(fileURLToPath(new URL('.', import.meta.url)));
const command = process.argv[2] || 'test';
const commands = {

    "build": async () => {
// Resolve inputs relative to this script, including when invoked from another folder.
process.chdir(fileURLToPath(new URL('.', import.meta.url)));

const bundle = await rollup({ input: 'app.js', external: id => id.startsWith('https://') });
try {
    const { output } = await bundle.generate({ format: 'es', inlineDynamicImports: true });
    const result = await minify(output[0].code, { module: true, format: { comments: false } });
    if (!result.code) throw new Error('JavaScript bundle is empty');

    const [template, styles] = await Promise.all([
        readFile('index.html', 'utf8'),
        readFile('styles.css', 'utf8')
    ]);
    // Escape HTML raw-text closing tags without changing the JS/CSS values.
    const inlineJs = result.code.replace(/<\/script/gi, '<\\/script');
    const inlineCss = styles.replace(/<\/style/gi, '<\\/style');
    const replacements = [
        ['<link rel="stylesheet" href="styles.css">', `<style>\n${inlineCss}\n</style>`],
        ['<script type="module" src="app.js"></script>', `<script type="module">\n${inlineJs}\n</script>`]
    ];
    let html = template;
    for (const [marker, value] of replacements) {
        if (html.split(marker).length !== 2) throw new Error(`Expected one asset marker: ${marker}`);
        html = html.replace(marker, () => value);
    }
    await mkdir('dist', { recursive: true });
    await writeFile('dist/index.html', html);
    await copyFile('sw.js', 'dist/sw.js');
} finally { await bundle.close(); }
console.log(`Deploy dist/: index.html (${((await stat('dist/index.html')).size / 1024).toFixed(1)} KB) + sw.js`);
    },

    "test": async () => {
const helperSource = fs.readFileSync('app.js', 'utf8').split('// BEGIN SHARED HELPERS\n')[1].split('// END SHARED HELPERS')[0];
const helperModule = helperSource + '\nexport { convertWorkHoursRows, resolveApiUrl, vietnameseLunar, dateKey, monthPair, holidaysForYear, personalEventOccurs, checklistFromText, compareScheduleEntries, reconcileChildren, reconcileMarkup, createScheduleCache };';
const { convertWorkHoursRows, resolveApiUrl, vietnameseLunar, dateKey, monthPair, holidaysForYear, personalEventOccurs, checklistFromText, compareScheduleEntries, reconcileChildren, reconcileMarkup, createScheduleCache } = await import('data:text/javascript;base64,' + Buffer.from(helperModule).toString('base64'));





test('schedule override index follows live snapshots and local checklist additions', () => {
    const source = fs.readFileSync('app.js', 'utf8');
    const first = { jobId: 'one', occurrenceDate: '2026-11-16', completed: false };
    const context = vm.createContext({ jobDayOverridesList: [first] });
    const start = source.indexOf('function getOverrideFor(');
    vm.runInContext(source.slice(start, source.indexOf('\n}', start) + 2), context);
    assert.equal(context.getOverrideFor('one', '2026-11-16'), first);
    const index = context.getOverrideFor.index;
    first.completed = true;
    assert.equal(context.getOverrideFor('one', '2026-11-16').completed, true);
    assert.equal(context.getOverrideFor.index, index);
    const added = { jobId: 'two', occurrenceDate: '2026-11-16' };
    context.jobDayOverridesList.push(added);
    assert.equal(context.getOverrideFor('two', '2026-11-16'), added);
    context.jobDayOverridesList = [];
    assert.equal(context.getOverrideFor('one', '2026-11-16'), null);
});

test('optional libraries load once concurrently and can retry after a network failure', async () => {
    const source = fs.readFileSync('app.js', 'utf8');
    const scripts = [], window = {};
    const context = vm.createContext({ window, document: {
        createElement: () => ({ remove() {} }), head: { appendChild: script => scripts.push(script) }
    } });
    vm.runInContext(source.slice(source.indexOf('const optionalScripts ='), source.indexOf('function createSessionAccess(')), context);
    const first = context.loadOptionalScript('XLSX', 'excel.js');
    const second = context.loadOptionalScript('XLSX', 'excel.js');
    assert.equal(first, second);
    assert.equal(scripts.length, 1);
    scripts[0].onerror();
    await assert.rejects(first);
    const retry = context.loadOptionalScript('XLSX', 'excel.js');
    assert.equal(scripts.length, 2);
    window.XLSX = { ready: true };
    scripts[1].onload();
    assert.equal(await retry, window.XLSX);
    assert.equal(await context.loadOptionalScript('XLSX', 'excel.js'), window.XLSX);
    assert.equal(scripts.length, 2);
});

test('UI refresh timers stay bounded across sessions and pause rendering in background tabs', () => {
    const source = fs.readFileSync('app.js', 'utf8');
    const timers = new Map(), events = new Map();
    let nextTimer = 0, renders = 0;
    const target = name => ({
        addEventListener: (event, callback) => events.set(name + event, callback),
        removeEventListener: (event, callback) => { if (events.get(name + event) === callback) events.delete(name + event); }
    });
    const document = { ...target('document'), hidden: false, querySelectorAll: () => [], getElementById: () => null }; 
    const context = vm.createContext({
        window: target('window'), document, currentUser: { uid: 'member' },
        uiRefreshInterval: null, notificationCheckInterval: null, lastUiRefreshMinute: null,
        localDateKey: date => date.toISOString().slice(0, 10), getTodayShift: now => ({ date: now }),
        setInterval: callback => { timers.set(++nextTimer, callback); return nextTimer; },
        clearInterval: id => timers.delete(id), renderSchedule: () => renders++, checkNotifications() {}
    });
    vm.runInContext(source.slice(source.indexOf('function onUiVisibilityChange('), source.indexOf('// Helper Functions')), context);
    context.startUiRefreshLoop(); context.startUiRefreshLoop();
    context.startNotificationCheck(); context.startNotificationCheck();
    assert.equal(timers.size, 2);
    assert.equal(events.size, 2);
    document.hidden = true;
    const before = renders;
    context.refreshUiForCurrentTime();
    assert.equal(renders, before);
    context.stopUiRefreshLoop();
    assert.equal(events.size, 0);
    assert.equal(timers.size, 1);
});

test('signed-in accounts have equal access without reading legacy permissions', async () => {
    const source = fs.readFileSync('app.js', 'utf8');
    const code = source.slice(source.indexOf('function createSessionAccess('), source.indexOf('const firebaseConfig'));
    const auth = { currentUser: null };
    const context = vm.createContext({ auth });
    vm.runInContext(code + '\nvar session = createSessionAccess(auth);', context);
    assert.equal(await context.session.start(), false);
    auth.currentUser = { uid: 'member', email: 'member@example.com', uiPermissions: { disabled: true }, appDeleted: true };
    assert.equal(await context.session.start(), true);
    assert.equal(context.session.can('jobs', 'edit'), true);
    assert.equal(context.session.requireAccess('profile', 'edit'), true);
    assert.equal(context.session.isAdmin, undefined);
    assert.doesNotMatch(source, /createAdminStore|profilePolicy|ADMIN_EMAIL|auth\.signOut\(/);
});
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

vm.runInContext(extract('function resolveShiftedDate(', 'const cachedScheduleEntries ='), ctx);
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
instant = new Date(2026, 10, 4, 10, 5);
ctx2.jobs=[{id:'background',title:'Background job',time:'10:00'}];
vm.runInContext('checkNotifications()',ctx2);
assert.equal(sent.at(-1).kind,'due');
assert.equal(sent.length,3,'background timer delayed five minutes still receives reminder');
ctx2.jobs=[{id:'missed-lead',title:'Missed lead',time:'10:00'}];ctx2.notifyLeadMinutes=120;
vm.runInContext('checkNotifications()',ctx2);
assert.equal(sent.length,4,'missed early reminder falls back to due-time reminder');
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
vm.runInContext((extract('function resolveShiftedDate(', 'const cachedScheduleEntries =') + extract('function computeScheduleEntries(', 'function getScheduleEntryOnDate(').replace('function computeScheduleEntries(', 'function buildScheduleEntries('))
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
const storage = new Map([['workpic_history_me', JSON.stringify([
    { id: 'expired', at: '2000-01-01T00:00:00Z' },
    ...Array.from({ length: 50 }, (_, i) => ({ id: 'old-' + i, at: new Date().toISOString() }))
])]]);
let storageBlocked = false;
const history = vm.createContext({
    Date, currentUser: current, crypto: { randomUUID: () => 'new' },
    localStorage: { getItem: key => storage.get(key) || null, setItem: (key, value) => { if (storageBlocked) throw new Error('Storage blocked'); storage.set(key, value); } },
    getDocs: () => assert.fail('History must not read Firebase'), runTransaction: () => assert.fail('History must not write Firebase')
});
vm.runInContext(extract('function readLocalChangeHistory(', 'function renderChangeHistory('), history);
await vm.runInContext("recordChange('job', 'Edit', 'Example', '09:00 → 10:00')", history);
const storedHistory = JSON.parse(storage.get('workpic_history_me'));
assert.equal(storedHistory.length, 50);
assert.equal(storedHistory[0].id, 'old-1');
assert.equal(storedHistory.at(-1).actorId, 'me');
assert.equal(storedHistory.at(-1).detail, '09:00 → 10:00');
assert.equal(vm.runInContext("readLocalChangeHistory('other').length", history), 0, 'account histories are isolated');
storageBlocked = true;
await vm.runInContext("recordChange('job', 'Edit', 'Example')", history);
assert.equal(current.changeHistory.length, 50, 'blocked browser storage does not interrupt the main action');

const noticeStorage = new Map();
let rendered = 0;
const notificationReads = vm.createContext({
    currentUser: { uid: 'me' }, notificationsList: [{ id: 'one', read: false }, { id: 'two', read: true }],
    localStorage: { getItem: key => noticeStorage.get(key) || null, setItem: (key, value) => noticeStorage.set(key, value) },
    renderNotifDropdown: () => { rendered++; },
    writeBatch: () => assert.fail('Marking notifications read must not write Firebase')
});
vm.runInContext(extract('function localNotificationReads(', 'function listenUserNotifications('), notificationReads);
await vm.runInContext('markAllNotificationsRead()', notificationReads);
assert.equal(rendered, 1);
assert.equal(notificationReads.notificationsList.every(n => n.read), true);
assert.equal(vm.runInContext("localNotificationReads('me').has('one')", notificationReads), true);
assert.equal(vm.runInContext("localNotificationReads('other').size", notificationReads), 0);

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

})();

// ===== theme-fx checks =====
test('statistics hide unchecked users and list dates matching occurrence counts', () => {
    const source = fs.readFileSync('app.js', 'utf8');
    const code = source.slice(source.indexOf('function computeStatistics('), source.indexOf('// CHECK ETA & DIRECT — v3'));
    const fields = { statsSummary: {}, statsChart: {}, statsTable: {} };
    let saved = 0;
    const controls = ['a', 'b'].map(uid => ({
        addEventListener(_, handler) { this.handler = handler; },
        closest: () => ({ dataset: { uid }, classList: { add() {}, remove() {} } })
    }));
    fields.statsChart.querySelectorAll = () => controls;
    class StatsDate extends Date { constructor(...args) { super(...(args.length ? args : ['2026-11-13T12:00:00'])); } }
    const ctx = vm.createContext({
        Date: StatsDate, dayOffsList: [], getHolidayName: () => '', currentUser: { uid: 'a' }, statsMode: 'week', statsDeptFilter: '', WORK_HOURS_PER_DAY: 8,
        statsHiddenUsers: new Set(['b']), usersInfoCache: { a: { displayName: 'Alice' }, b: { displayName: 'Bob' } },
        statsAllJobs: [
            { ownerId: 'a', title: 'Alice job', type: 'daily', duration: 30, dates: ['2026-11-09', '2026-11-13'] },
            { ownerId: 'b', title: 'Bob job', type: 'weekly', duration: 45, dates: ['2026-11-12'] }
        ],
        document: { getElementById: id => fields[id] },
        getJobOccurrences: (job, from, to) => job.dates.map(day => new Date(day + 'T00:00:00')).filter(date => date >= from && date <= to),
        getJobDuration: job => job.duration, localDateKey: dateKey, deptMatches: () => true,
        escapeHtml: value => String(value), getTypeLabel: type => type, getUserAvatarUrl: () => '', getStatsUserColor: () => '#123', avatarInitial: () => 'A',
        saveStatsHiddenUsers: () => { saved++; }
    });
    fields.statsLineChart = { innerHTML: '', querySelectorAll: () => [] };
    vm.runInContext(code, ctx); vm.runInContext('renderStatistics()', ctx);
    assert.equal((fields.statsLineChart.innerHTML.match(/<circle /g)||[]).length,7,'one visible user has seven day points');
    assert.equal((fields.statsLineChart.innerHTML.match(/class="stats-point-today"/g)||[]).length,1,'only today pulses on each visible line');
    assert.match(fields.statsLineChart.innerHTML,/Alice.*2026-11-09: 0,5/);
    assert.match(fields.statsLineChart.innerHTML,/Alice.*2026-11-13: 0,5/);
    assert.match(fields.statsLineChart.innerHTML,/data-line-user="b" aria-pressed="false"/);
    assert.match(fields.statsTable.innerHTML, /<th>Số lần<\/th>\s*<th>Thứ thực hiện<\/th>/);
    assert.match(fields.statsTable.innerHTML, /Alice job/);
    assert.doesNotMatch(fields.statsTable.innerHTML, /Bob job/);
    assert.match(fields.statsTable.innerHTML, />Thứ Hai<\/time>/);
    assert.match(fields.statsTable.innerHTML, />Thứ Sáu<\/time>/);
    const shiftStart=source.indexOf('function resolveShiftedDate(');
    vm.runInContext(source.slice(shiftStart,source.indexOf('\n}',shiftStart)+2),ctx);
    ctx.shiftJobs=[{ownerId:'a',title:'Tuesday shift',duration:60,dates:['2026-11-10']},{ownerId:'b',title:'No shift',duration:60,dates:['2026-11-10']},{ownerId:'a',title:'Next week shift',duration:120,workOnSunday:false,dates:['2026-11-16']}];
    ctx.shiftOffs=[{userId:'a',date:'2026-11-10',reason:'Annual leave'},{userId:'a',date:'2026-11-16',reason:'Personal leave'}];
    const shifted=vm.runInContext('computeWeeklyLineSeries(shiftJobs,shiftOffs)',ctx);
    const alice=shifted.series.find(user=>user.uid==='a'),bob=shifted.series.find(user=>user.uid==='b');
    assert.equal(alice.values[0],1,'Tuesday off moves work to Monday');
    assert.equal(alice.values[1],0,'off day has no original workload');
    assert.match(alice.notes[0].join(' '),/2026-11-10.*Annual leave/);
    assert.match(alice.notes[1].join(' '),/Annual leave/);
    assert.equal(alice.values[5],2,'next Monday off shifts into this Saturday when Sunday is excluded');
    assert.equal(bob.values[1],1,'another user does not inherit Alice off');
    const stats = vm.runInContext("computeStatistics('week')", ctx);
    assert.equal(stats.users[0].jobs[0].occurrences, stats.users[0].jobs[0].occurrenceDates.length);
    controls[0].checked = false; controls[0].handler({ target: controls[0] });
    assert.match(fields.statsTable.innerHTML, /Tích chọn user/);
    controls[1].checked = true; controls[1].handler({ target: controls[1] });
    assert.match(fields.statsTable.innerHTML, /Bob job/);
    assert.doesNotMatch(fields.statsTable.innerHTML, /Alice job/);
    controls[0].checked = true; controls[0].handler({ target: controls[0] });
    assert.equal(saved, 3);
    ctx.statsMode = 'today'; vm.runInContext('renderStatistics()', ctx);
    assert.match(fields.statsTable.innerHTML, />Thứ Sáu<\/time>/);
    assert.doesNotMatch(fields.statsTable.innerHTML, /Thứ Hai|Bob job/);
});

test('desktop reminders retry failed sends and service-worker readiness cannot block fallback', async () => {
    const source=fs.readFileSync('app.js','utf8');
    const saved=new Map(), timers=new Map();let nextTimer=0;
    const ctx=vm.createContext({console,navigator:{serviceWorker:{register:async()=>({active:null}),ready:new Promise(()=>{})}},localStorage:{getItem:key=>saved.get(key),setItem:(key,value)=>saved.set(key,value)},setTimeout:(fn,delay)=>{const id=++nextTimer;timers.set(id,{fn,delay});return id;},clearTimeout:id=>timers.delete(id)});
    vm.runInContext(source.slice(source.indexOf('const notificationClaims ='),source.indexOf('async function showTimedDesktopNotification(')),ctx);
    await ctx.notifyOnce('retry',async()=>false);
    assert.equal(saved.has('retry'),false,'failure must not consume the reminder');
    let sends=0;
    await ctx.notifyOnce('retry',async()=>{sends++;return true;});
    await ctx.notifyOnce('retry',async()=>{sends++;return true;});
    assert.equal(sends,1,'successful delivery is persisted and deduplicated');
    let complete;const delivery=new Promise(resolve=>complete=resolve);
    const attempt=ctx.notifyOnce('pending',()=>delivery);
    ctx.notifyOnce('pending',()=>{throw Error('duplicate concurrent send');});
    assert.equal(saved.has('pending'),false,'do not persist before desktop API succeeds');
    complete(true);await attempt;
    assert.equal(saved.has('pending'),true);
    vm.runInContext(source.slice(source.indexOf('let swRegistrationPromise ='),source.indexOf('function initNotificationActionBridge(')),ctx);
    const waiting=ctx.getSwRegistration();
    await Promise.resolve();await Promise.resolve();
    const timeout=[...timers.values()].find(timer=>timer.delay===4000);
    assert.ok(timeout,'service worker has a bounded readiness wait');timeout.fn();
    assert.equal(await waiting,null,'stalled worker allows desktop fallback');
    const registration={active:{}};ctx.navigator.serviceWorker.register=async()=>registration;
    assert.equal(await ctx.getSwRegistration(),registration,'later worker registration can retry');
});

test('job catalog keeps paused jobs last and statistics sort types and weekdays', () => {
    const source = fs.readFileSync('app.js', 'utf8');
    const fn = name => { const start = source.indexOf('function ' + name + '('); return source.slice(start, source.indexOf('\n}', start) + 2); };
    const body = { innerHTML: '' };
    const modal = { querySelector: () => body };
    const job = (id, type, date, isPaused = false, ownerId = 'me') => ({ id, title: id, type, date, time: '09:00', ownerId, isPaused });
    const ctx = vm.createContext({currentUser:{uid:'me'},jobs:[job('paused','daily','2026-11-16',true),job('fri','weekly','2026-11-20'),job('mon','weekly','2026-11-16'),job('daily','daily','2026-11-16'),job('other','daily','2026-11-16',false,'other')],document:{getElementById:()=>modal},bootstrap:{Modal:{getOrCreateInstance:()=>({show(){}})}},getWeekdayIndex:date=>(new Date(date+'T00:00:00').getDay()+6)%7,escapeHtml:String,formatDate:String,getTypeLabel:String,getJobDuration:()=>30});
    ctx.getUserJobMetrics = () => ({weekdays:'Monday',count:1,period:'week',weekHours:0.5});
    vm.runInContext(fn('openUserJobs')+';openUserJobs()',ctx);
    assert.ok(body.innerHTML.indexOf('data-user-job="daily"') < body.innerHTML.indexOf('data-user-job="mon"'));
    assert.ok(body.innerHTML.indexOf('data-user-job="mon"') < body.innerHTML.indexOf('data-user-job="fri"'));
    assert.ok(body.innerHTML.indexOf('data-user-job="fri"') < body.innerHTML.indexOf('data-user-job="paused"'));
    assert.doesNotMatch(body.innerHTML,/data-user-job="other"/);
    ctx.parseJobDate = date => new Date(date+'T00:00:00');
    vm.runInContext(fn('getJobOccurrences')+';'+fn('getUserJobMetrics'),ctx);
    const metrics = job => { ctx.metricJob = job; return vm.runInContext("getUserJobMetrics(metricJob, new Date(2026,10,17))",ctx); };
    const dailyMetrics=metrics({...job('daily','daily','2026-11-01'),workOnSunday:false,excludedWeekdays:[6]});
    assert.equal(dailyMetrics.count,5);
    assert.equal(dailyMetrics.weekHours,2.5);
    assert.equal(metrics(job('weekly','weekly','2026-11-02')).count,1);
    assert.equal(metrics(job('monthly','monthly','2026-11-17')).count,1);
    assert.equal(metrics(job('monthly','monthly','2026-11-17')).weekHours,0.5);
    assert.equal(metrics(job('monthly','monthly','2026-11-24')).weekHours,0);
    assert.equal(metrics(job('paused','daily','2026-11-01',true)).weekHours,0);
    const table = {innerHTML:''};
    ctx.document={getElementById:()=>table};ctx.statsHiddenUsers=new Set();
    const entries=ctx.jobs.filter(j=>j.ownerId==='me'&&!j.isPaused).map(job=>({job,minutes:30,occurrences:1,occurrenceDates:[job.date]}));
    ctx.input={users:[{uid:'z',name:'Zed',jobs:entries},{uid:'a',name:'Alice',jobs:entries}]};
    vm.runInContext(fn('renderStatisticsDetails')+';renderStatisticsDetails(input)',ctx);
    assert.ok(table.innerHTML.indexOf('Alice') < table.innerHTML.indexOf('Zed'));
    const titles=[...table.innerHTML.matchAll(/<td>(daily|mon|fri)<\/td>/g)].map(m=>m[1]);
    assert.deepEqual(titles,['daily','mon','fri','daily','mon','fri']);
});

test('shared rain renderer keeps one canvas/loop and releases listeners across header and fullscreen modes', () => {
    const source = fs.readFileSync('app.js', 'utf8');
    const code = source.slice(source.indexOf('const RainFx ='), source.indexOf('// Thiên hà xoắn ốc'));
    const listeners = new Map(), frames = new Map(), canvases = [];
    let serial = 0, reduced = false;
    const classes = new Set();
    const add = (name, fn) => { if (!listeners.has(name)) listeners.set(name, new Set()); listeners.get(name).add(fn); };
    const remove = (name, fn) => listeners.get(name)?.delete(fn);
    const g = { setTransform() {}, clearRect() {}, fillRect() {}, beginPath() {}, moveTo() {}, lineTo() {}, stroke() {} };
    const ctx = vm.createContext({
        navigator: { hardwareConcurrency: 8 },
        document: { hidden: false, body: { classList: { contains: name => classes.has(name) } }, addEventListener: add, removeEventListener: remove,
            createElement: () => { const canvas = { getContext: () => g, setAttribute() {}, remove() { this.removed = true; } }; canvases.push(canvas); return canvas; } },
        window: { devicePixelRatio: 2, matchMedia: () => ({ matches: reduced }), addEventListener: add, removeEventListener: remove },
        requestAnimationFrame: fn => { frames.set(++serial, fn); return serial; }, cancelAnimationFrame: id => frames.delete(id)
    });
    ctx.header = { getBoundingClientRect: () => ({ width: 1440, height: 80 }), prepend() {} };
    ctx.full = { getBoundingClientRect: () => ({ width: 1440, height: 1000 }), prepend() {} };
    vm.runInContext(code, ctx);
    assert.equal(vm.runInContext('RainFx.start(header, 0)', ctx), true);
    assert.equal(frames.size, 1);
    assert.equal(vm.runInContext('RainFx.start(full, 2)', ctx), true);
    assert.equal(canvases[0].removed, true);
    assert.equal(frames.size, 1);
    assert.ok(canvases[1].width * canvases[1].height < 1504000, 'bounded canvas pixel budget');
    classes.add('modal-open'); for (const fn of listeners.get('shown.bs.modal')) fn();
    assert.equal(frames.size, 0);
    classes.delete('modal-open'); for (const fn of listeners.get('hidden.bs.modal')) { fn(); fn(); }
    assert.equal(frames.size, 1, 'resume events cannot duplicate frames');
    ctx.document.hidden = true; for (const fn of listeners.get('visibilitychange')) fn();
    assert.equal(frames.size, 0);
    vm.runInContext('RainFx.stop()', ctx);
    assert.ok([...listeners.values()].every(set => !set.size));
    reduced = true;
    assert.equal(vm.runInContext('RainFx.start(header, 1)', ctx), false);
    assert.equal(frames.size, 0);
});

test('rain mode routes to header or fullscreen without starting a second WebGL effect', () => {
    const source = fs.readFileSync('app.js', 'utf8');
    const code = source.slice(source.indexOf('function commitFullscreenFx('), source.indexOf('function setFxFullscreen('));
    const calls = []; let layer = null;
    const ctx = vm.createContext({
        currentTopbarTheme: 'rain', FX_CONFIG: { rain: { rain: true } }, fxFullscreen: false,
        fullscreenFxSignature: '', fullscreenFxGeneration: 0, getFxLevelIndex: () => 1,
        window: { matchMedia: () => ({ matches: false }) },
        document: { getElementById: () => layer, querySelector: () => 'header', querySelectorAll: () => [],
            createElement: () => ({ dataset: {}, isConnected: true, setAttribute() {}, remove() { layer = null; } }),
            body: { classList: { toggle() {} }, appendChild: element => { layer = element; } } },
        RainFx: { stop() {}, start: host => calls.push(host) }, ThreeFx: { stop() {}, start: () => assert.fail('Rain must not start WebGL') },
        SnowPile: { stop() {} }, renderBackdropScene() {}
    });
    vm.runInContext(code, ctx); vm.runInContext('commitFullscreenFx()', ctx);
    assert.deepEqual(calls, ['header']);
    ctx.fxFullscreen = true; vm.runInContext('commitFullscreenFx()', ctx);
    assert.equal(calls[1], layer);
    vm.runInContext('commitFullscreenFx()', ctx);
    assert.equal(calls.length, 2, 'unchanged settings do not rebuild rain');
});
await (async function () {
const source=fs.readFileSync('app.js','utf8');
let code=source.slice(source.indexOf('const ThreeFx ='),source.indexOf('// CƯỜNG ĐỘ HIỆU ỨNG'));
code=code.replace("if (!threePromise) threePromise = import(THREE_URL).catch(err => { threePromise = null; throw err; });", 'if (!threePromise) threePromise = Promise.resolve(mockThree);');
code=code.replace(/const BUILDERS = \{ space:[^\n]+/, `const BUILDERS = { noel: ctx => {
    ctx.own(disposable, disposable);
    counts.push(ctx.cnt(100));
    const mat={uniforms:{uPixel:{value:0},uTime:{value:0},uAspect:{value:0}}};
    ctx.timeMats.push(mat);ctx.aspectMats.push(mat);mats.push(mat);
}, tet: ctx => ctx.own(disposable) };`);
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
layer.dataset.fx='tet';
const second=vm.runInContext("ThreeFx.start(layer,'tet',2)",ctx);
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
const container = { dataset: {}, replaceChildren() {}, innerHTML: '', querySelector: () => ({ appendChild() {} }), querySelectorAll: () => [] };
let range;
const user = { workShift: 'night' };
const ctx = vm.createContext({
    accessControl: { requireAccess: () => true, can: () => true },
    Date: Clock, currentUser: user, showSunday: false, jobs: [],
    reconcileMarkup: (target, html) => { target.innerHTML = html; },
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
ctx.getHolidayName = () => 'Holiday';
ctx.buildScheduleEntries = () => ({});
render();
assert.match(container.innerHTML, /class="timeline-track" style="height:48px;/, 'holiday without jobs occupies exactly one lane');
assert.equal((container.innerHTML.match(/class="timeline-holiday"/g) || []).length, 1);
ctx.getHolidayName = () => '';
ctx.getPersonalEvents = () => [{time:'13:30', title:'Department event', notes:'Details'}];
render();
assert.match(container.innerHTML, /class="timeline-calendar-event" style="left:50%;width:50%;top:2px;height:40px;"/, '13:30 event runs to end of the 07:00-20:00 day track');
assert.doesNotMatch(container.innerHTML, /timeline-row-events/, 'events stay inside the time track');
ctx.buildScheduleEntries = () => ({'2026-11-08': [{job:{id:'during',title:'During event',time:'14:00',duration:30},originDate:'2026-11-08'}]});
render();
assert.match(container.innerHTML, /top:2px; height:40px;/, 'jobs retain their original top lane over event bands');
assert.match(container.innerHTML, /class="timeline-calendar-event" style="left:50%;width:50%;top:46px;height:40px;"/, 'event caption stays below the job');
ctx.getPersonalEvents = () => [];
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
const code = helperModule;
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

test('copy and transfer preserve recurrence type, excluded weekdays and duration', async () => {
    const source = fs.readFileSync('app.js', 'utf8');
    for (const mode of ['copy', 'transfer']) {
        for (const type of ['daily', 'weekly', 'biweekly', 'monthly', 'once']) {
            const original = { id: 'original', title: 'Recurring job', type, date: '2026-11-16', time: '09:00', description: '', excludedWeekdays: [2, 4, 0], duration: 75, enableNotification: true, workOnSunday: true, isPaused: false, isOutOfSchedule: false, ownerId: 'sender' };
            let request, copied;
            const context = vm.createContext({
                accessControl: { requireAccess: () => true }, currentViewingJobId: 'original', jobs: [original],
                document: { getElementById: () => ({ value: 'recipient' }) }, assertSameDeptTarget: () => true,
                currentTransferMode: mode, currentUser: { uid: 'sender', email: 'sender@example.com' }, DEFAULT_JOB_DURATION: 30,
                db: {}, collection: (_, name) => name, doc: (_, name, id) => ({ name, id }),
                addDoc: async (name, data) => { if (name === 'transferRequests') request = data; if (name === 'jobs') copied = data; },
                updateDoc: async (ref, patch) => { if (ref.name === 'jobs') Object.assign(original, patch); },
                showNotification() {}, pushNotification: async () => {}, viewJobModal: { hide() {} }, transferConfirmModal: { hide() {} }, console
            });
            for (const name of ['transferJob', 'acceptTransfer', 'getJobOccurrences']) {
                const start = source.indexOf(`${name === 'getJobOccurrences' ? '' : 'async '}function ${name}(`);
                vm.runInContext(source.slice(start, source.indexOf('\n}', start) + 2), context);
            }
            await context.transferJob();
            assert.ok(request, 'request created');
            context.pendingTransferRequestId = 'request'; context.pendingTransferRequestData = request;
            context.currentUser = { uid: 'recipient', email: 'recipient@example.com' };
            await context.acceptTransfer();
            const received = mode === 'copy' ? copied : original;
            assert.equal(received.ownerId, 'recipient');
            assert.equal(received.type, type);
            assert.equal(received.duration, 75);
            assert.deepEqual(Array.from(received.excludedWeekdays), [2, 4, 0]);
            if (type === 'daily') {
                context.parseJobDate = value => new Date(value + 'T00:00:00');
                const dates = context.getJobOccurrences(received, new Date('2026-11-16T00:00:00'), new Date('2026-11-22T23:59:59'));
                assert.deepEqual(Array.from(dates, date => date.getDay()), [1, 3, 5, 6]);
            }
        }
    }
});

test('shared schedule cache reuses work across ranges and invalidates only edited jobs', () => {
    const cache = createScheduleCache();
    const calls = [];
    const dateKey = date => date.toISOString().slice(0, 10);
    const date = value => new Date(value + 'T00:00:00Z');
    const compute = (start, end, [job]) => {
        calls.push(job.id);
        return { '2026-11-16': [{ job, originDate: '2026-11-16' }], '2026-11-17': [{ job, originDate: '2026-11-17' }] };
    };
    const jobs = Array.from({ length: 500 }, (_, i) => ({ id: String(i), type: 'daily', time: '09:00' }));
    const main = cache(date('2026-11-16'), date('2026-11-29'), jobs, 'user/off/overrides', compute, dateKey);
    assert.equal(calls.length, 500);
    const today = cache(date('2026-11-16'), date('2026-11-16'), jobs.map(job => ({ ...job })), 'user/off/overrides', compute, dateKey);
    assert.equal(calls.length, 500, 'today shares the main calendar calculation');
    assert.equal(today['2026-11-16'].length, 500);
    today['2026-11-16'].reverse(); today['2026-11-16'][0].completed = true;
    assert.equal(main['2026-11-16'][0].job.id, '0', 'callers may sort without mutating cached results');
    jobs[2].time = '10:00';
    cache(date('2026-11-16'), date('2026-11-29'), jobs, 'user/off/overrides', compute, dateKey);
    assert.equal(calls.length, 501);
    assert.equal(calls.at(-1), '2');
    cache(date('2026-11-16'), date('2026-11-29'), jobs, 'changed-off', compute, dateKey);
    assert.equal(calls.length, 1001, 'off/holiday/override/account changes invalidate the shared window');
});

test('weekly, biweekly and monthly recurrence stays anchored across cached range sizes', () => {
    const source = fs.readFileSync('app.js', 'utf8');
    const start = source.indexOf('function getJobOccurrences(');
    const context = vm.createContext({ parseJobDate: value => new Date(value + 'T00:00:00') });
    vm.runInContext(source.slice(start, source.indexOf('\n}', start) + 2), context);
    for (const type of ['daily', 'weekly', 'biweekly', 'monthly']) {
        const job = { type, date: '2026-01-16', excludedWeekdays: [0, 2] };
        const narrowStart = new Date('2026-11-16T00:00:00'), end = new Date('2026-11-29T23:59:59');
        const narrow = context.getJobOccurrences(job, narrowStart, end);
        const wide = context.getJobOccurrences(job, new Date('2026-11-02T00:00:00'), end).filter(date => date >= narrowStart);
        assert.deepEqual(Array.from(narrow, Number), Array.from(wide, Number), type);
    }
});
    },

    "test:ui": async () => {
// ===== productivity-ui checks =====
if (!process.env.ADMIN_UI_PREVIEW) await (async function () {
const chrome = ['C:/Program Files/Google/Chrome/Application/chrome.exe', 'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe'].find(p => fs.existsSync(p));
if (!chrome) { console.log('Browser UI smoke skipped: Chrome/Edge unavailable.'); process.exit(0); }
const source = fs.readFileSync('app.js', 'utf8');
const extract = (start, end) => source.slice(source.indexOf(start), source.indexOf(end));
const markup = fs.readFileSync('index.html', 'utf8').replace(/<script\b[^>]*>[\s\S]*?<\/script>/gi, '').replace(/<link\b[^>]*>/gi, '');
const temp = fs.mkdtempSync(path.join(os.tmpdir(), 'workpic-ui-'));
const script = `
${source.split('// BEGIN SHARED HELPERS\n')[1].split('// END SHARED HELPERS')[0]}

const check = (value, message) => { if (!value) throw new Error(message); };
const currentUser = { uid: 'me', personalCalendarEvents: [{id:'event',date:'2026-11-05',title:'Weekly appointment',repeat:'weekly',until:'2026-12-01'}], changeHistory: [{kind:'event',action:'Added',title:'Meeting',actor:'Me',detail:'Weekly',at:'2026-11-05T10:00:00Z'}] };
const accessControl = { can: () => true, requireAccess: () => true };
const db = {}; let dayOffViewYear=2026, dayOffViewMonth=10, currentViewingJobId='job';
let jobDayOverridesList = [], stored = {overrideDate:'2026-11-04',note:'Keep this',checklistDone:{}};
let historyCalls = 0, denyWrite = false;
const doc = (_, collection, id) => ({ collection, id });
// Reproduce owner-based rules rejecting the read of a missing override.
const runTransaction = async () => { throw Object.assign(new Error('Missing or insufficient permissions.'), {code:'permission-denied'}); };
const setDoc = async (ref, patch, options) => {
    if (denyWrite) throw Object.assign(new Error('Missing or insufficient permissions.'), {code:'permission-denied'});
    check(options.merge, 'checklist must merge');
    check(Object.keys(patch.checklistDone).length===1,'write only the toggled step');
    stored = {...stored,...patch,checklistDone:{...stored.checklistDone,...patch.checklistDone}};
};
const getOverrideFor = (id,key) => jobDayOverridesList.find(e=>e.jobId===id && e.occurrenceDate===key);
const recordChange = async () => {historyCalls++; await new Promise(() => {});};
const renderSchedule = ()=>{}, renderDayOffCalendars=()=>{}, getUserData=async()=>currentUser;
const renderDayOffModal=()=>{}, repeatLabel=s=>s;
const bootstrap = {Modal:{getOrCreateInstance:()=>({show(){}})}};
${extract('function escapeHtml(', '// ============================================================\n// Check Change Due')}
${extract('function getHolidayName(', 'function renderDayOffCalendars(')}
${extract('function renderChangeHistory(', 'function getDayOffJobPreview(')}
${extract('function renderJobChecklist(', "window.addEventListener('beforeunload'")}
${extract('let sharedNotesUnsubscribe =', 'function initQuickChatUi(')}
let noteSnapshot, noteWrites = [], noteUpdates = [], noteDeletes = [], noteUnsubscribed = 0, rejectNoteWrite = false;
const collection = (_, name) => name;
const query = (...args) => args, orderBy = (...args) => args, limit = value => value;
const serverTimestamp = () => 'server-timestamp';
const onSnapshot = (_, callback) => { noteSnapshot = callback; return () => noteUnsubscribed++; };
const addDoc = async (name, data) => { if (rejectNoteWrite) throw Object.assign(new Error('denied'), {code:'permission-denied'}); noteWrites.push({name,data}); };
const updateDoc = async (ref,data) => { if (rejectNoteWrite) throw new Error('denied'); noteUpdates.push({ref,data}); };
const deleteDoc = async ref => { if (rejectNoteWrite) throw new Error('denied'); noteDeletes.push(ref); };
let quickChatPanelOpen = false, quickChatUnreadCount = 0;
const updateQuickChatBadge = () => {};
${extract('function openQuickChatPanel(', 'let sharedNotesUnsubscribe =')}
try {
    const kept = ['dayOffModal','viewJobModal','changeHistoryModal','sharedNotesPanel','sharedNotesToggle','quickChatToggleBtn','quickChatPanel'].map(id=>document.getElementById(id));
    const historyButton = document.getElementById('changeHistoryBtn');
    document.body.replaceChildren(...kept,historyButton);
    const cleaned = sanitizeSharedNote('<scr'+'ipt>alert(1)</scr'+'ipt><table><tr><td onclick="alert(1)">Cell</td></tr></table><img src="https://example.com/x"><img src="data:image/png;base64,aGVsbG8=" onerror="alert(1)">');
    check(cleaned.includes('<td>Cell</td>'),'notes preserve pasted table cells');
    check(!/script|onclick|onerror|https:/.test(cleaned),'notes remove scripts, handlers and remote images');
    check(cleaned.includes('data:image/png;base64,'),'notes preserve embedded images');
    initSharedNotesUi(); initSharedNotesUi(); listenSharedNotes();
    check(!document.getElementById('sharedNotesToggle').hidden,'signed-in user sees notes button');
    noteSnapshot({docs:[{id:'note',data:()=>({senderId:'other',senderName:'Other user',content:'<b>Hello</b>',createdAt:{toDate:()=>new Date('2099-01-01T12:00:00Z')}})}]});
    check(document.getElementById('sharedNotesList').textContent.includes('Other user'),'notes show sender');
    check(document.getElementById('sharedNotesList').querySelector('time').dateTime==='2099-01-01T12:00:00.000Z','notes show server send time');
    check(document.getElementById('sharedNotesBadge').textContent==='1','new notes have unread badge');
    document.getElementById('sharedNotesToggle').click();
    check(document.getElementById('sharedNotesPanel').classList.contains('show'),'notes panel opens');
    check(document.getElementById('quickChatToggleBtn').classList.contains('d-none'),'opening notes hides chat button');
    const notesRect=document.getElementById('sharedNotesPanel').getBoundingClientRect();
    check(notesRect.width<=innerWidth&&notesRect.height<=innerHeight+1,'notes panel fits viewport');
    check(document.getElementById('sharedNotesBadge').classList.contains('d-none'),'opening notes clears unread');
    const noteEditor=document.getElementById('sharedNotesEditor');
    noteEditor.textContent='Draft';noteEditor.click();
    check(sharedNotesOpen,'clicking inside notes keeps panel open');
    historyButton.click();
    check(!sharedNotesOpen&&document.getElementById('sharedNotesPanel').inert,'outside click closes notes');
    check(!document.getElementById('quickChatToggleBtn').classList.contains('d-none'),'closing notes restores chat button');
    check(noteEditor.textContent==='Draft','outside dismissal preserves draft');
    check(!document.getElementById('sharedNotesToggle').classList.contains('d-none'),'outside dismissal restores notes button');
    openQuickChatPanel();setSharedNotesOpen(false);
    check(document.getElementById('sharedNotesToggle').classList.contains('d-none'),'job chat hides notes button even after toggle click handlers');
    closeQuickChatPanel();
    check(!document.getElementById('sharedNotesToggle').classList.contains('d-none'),'closing job chat restores notes button');
    document.getElementById('sharedNotesToggle').click();
    check(sharedNotesOpen,'notes reopen normally');
    document.getElementById('sharedNotesTable').click();
    check(noteEditor.querySelectorAll('td').length===6,'insert table once even after repeated initialization');
    const noteForm=document.getElementById('sharedNotesForm');
    const submitNote=async()=>{noteForm.dispatchEvent(new Event('submit',{bubbles:true,cancelable:true}));await new Promise(resolve=>setTimeout(resolve,0));};
    const imageCanvas=document.createElement('canvas');imageCanvas.width=20;imageCanvas.height=10;
    imageCanvas.getContext('2d').fillRect(0,0,20,10);
    const imageBlob=await new Promise(resolve=>imageCanvas.toBlob(resolve,'image/png'));
    await addSharedNoteImage(new File([imageBlob],'sample.png',{type:'image/png'}));
    check(noteEditor.querySelector('img')?.src.startsWith('data:image/jpeg;base64,'),'image uploads are compressed and embedded');
    await submitNote();
    check(noteWrites.length===1&&noteWrites[0].name==='sharedNotes','notes write to sharedNotes only');
    check(noteWrites[0].data.senderId==='me'&&noteWrites[0].data.createdAt==='server-timestamp','notes include sender and server time');
    check(!noteEditor.innerHTML,'successful note clears draft');
    await submitNote();check(noteWrites.length===1,'empty notes are not sent');
    noteSnapshot({docs:[{id:'mine',data:()=>({senderId:'me',senderName:'Me',content:'<p>Original note</p>',clientCreatedAt:'2026-11-18T09:00:00Z'})},{id:'other',data:()=>({senderId:'other',senderName:'Other',content:'Other note'})}]});
    check(document.querySelectorAll('[data-note-edit]').length===1,'edit actions appear only on own notes');
    noteEditor.innerHTML='<p>Unsent draft</p>';
    document.querySelector('[data-note-edit="mine"]').click();
    check(noteEditor.textContent==='Original note'&&sharedNoteEditingId==='mine','edit loads original content');
    document.getElementById('sharedNotesCancelEdit').click();
    check(noteEditor.textContent==='Unsent draft'&&!sharedNoteEditingId,'cancel edit restores unsent draft');
    editSharedNote('mine');noteEditor.innerHTML='<p>Edited note</p>';await submitNote();
    check(noteUpdates.length===1&&noteUpdates[0].ref.collection==='sharedNotes'&&noteUpdates[0].ref.id==='mine','edit updates existing note');
    check(Object.keys(noteUpdates[0].data).sort().join(',')==='content,updatedAt','edit preserves sender and original send time');
    check(noteEditor.textContent==='Unsent draft'&&noteWrites.length===1,'edit neither creates a new note nor loses the draft');
    editSharedNote('mine');noteEditor.innerHTML='<p>Retry edit</p>';rejectNoteWrite=true;await submitNote();
    check(sharedNoteEditingId==='mine'&&noteEditor.textContent==='Retry edit','failed edit preserves current editing content');
    rejectNoteWrite=false;cancelSharedNoteEdit();
    const originalConfirm=window.confirm;window.confirm=()=>false;
    await deleteSharedNote('mine');check(noteDeletes.length===0,'canceled delete does not write');
    window.confirm=()=>true;
    await deleteSharedNote('other');check(noteDeletes.length===0,'cannot delete another sender note');
    rejectNoteWrite=true;await deleteSharedNote('mine');
    check(sharedNotesItems.some(note=>note.id==='mine'),'failed deletion keeps note visible');
    rejectNoteWrite=false;await deleteSharedNote('mine');window.confirm=originalConfirm;
    check(noteDeletes.length===1&&!sharedNotesItems.some(note=>note.id==='mine'),'confirmed deletion removes own note');
    rejectNoteWrite=true; noteEditor.innerHTML='<p>Keep draft</p>'; await submitNote();
    check(noteEditor.textContent==='Keep draft','failed note preserves draft');
    check(!document.getElementById('sharedNotesSend').disabled,'failed note re-enables send');
    stopSharedNotes();
    check(noteUnsubscribed===1&&document.getElementById('sharedNotesToggle').hidden,'sign-out removes shared listener and button');
    check(!noteEditor.innerHTML&&document.getElementById('sharedNotesPanel').inert,'sign-out clears notes and draft');
    noteSnapshot({docs:[{id:'late',data:()=>({content:'Late note'})}]});
    check(sharedNotesItems.length===0,'late snapshot from old session is ignored');
    document.getElementById('dayOffCalendars').innerHTML='<div class="dayoff-day" data-date="2026-11-12">12</div>';
    setupPersonalCalendar(); setupProductivityFeatures();
    const cell=document.querySelector('[data-date]');
    const context = new MouseEvent('contextmenu',{bubbles:true,cancelable:true}); cell.dispatchEvent(context);
    const form=document.getElementById('personalEventForm');
    check(context.defaultPrevented,'right click should open event editor');
    check(!form.classList.contains('d-none'),'editor should be visible');
    check(form.parentElement.id==='dayOffModal','editor must not occupy a calendar row');
    check(document.getElementById('personalEventDate').value==='2026-11-12','editor should use clicked date');
    openPersonalEventEditor('2026-11-12','event',cell);
    check(document.getElementById('personalEventDate').value==='2026-11-05','editing recurrence uses original series start');
    check(document.getElementById('personalEventRepeat').value==='weekly','load repeat mode');
    check(!document.getElementById('personalEventUntil').disabled,'recurring end date enabled');
    document.getElementById('personalEventRepeat').value='none';
    document.getElementById('personalEventRepeat').dispatchEvent(new Event('change'));
    check(document.getElementById('personalEventUntil').disabled,'one-off disables until date');
    check(getPersonalEvents('2026-11-12').length===1,'show recurring occurrence');
    renderChangeHistory();
    check(document.getElementById('changeHistoryList').textContent.includes('Meeting'),'history renders saved record');
    document.getElementById('changeHistorySearch').value='missing'; renderChangeHistory();
    check(!document.getElementById('changeHistoryList').textContent.includes('Meeting'),'history filters results');
    const body=document.getElementById('viewModalBody');
    const job={id:'job',title:'Example',checklist:[{id:'a',text:'Prepare'},{id:'b',text:'Review'}]};
    renderJobChecklist(job,'2026-11-05',body);
    const originalPanel=body.querySelector('.job-checklist-panel');
    const originalCheckbox=body.querySelector('[data-checklist-id="a"]');
    let input=originalCheckbox; input.checked=true; input.dispatchEvent(new Event('change'));
    check(body.querySelector('progress').value===1,'progress updates immediately before save finishes');
    check(!body.querySelector('[data-checklist-id="b"]').disabled,'other steps remain interactive');
    await new Promise(resolve=>setTimeout(resolve,30));
    check(stored.checklistDone.a,'checked step should persist');
    check(stored.overrideDate==='2026-11-04' && stored.note==='Keep this','checklist must preserve existing date overrides');
    check(historyCalls===0,'checkbox changes must not write history');
    check(body.querySelector('progress').value===1,'progress updates after save');
    check(body.querySelector('.job-checklist-panel')===originalPanel && body.querySelector('[data-checklist-id="a"]')===originalCheckbox,'do not rebuild checklist controls');
    check(!originalCheckbox.disabled,'slow history must not block input');
    check(body.querySelector('.checklist-percent').textContent==='50% hoàn thành','show task completion percentage');
    check(!body.querySelector('.checklist-date'),'remove occurrence date selector');
    stored.checklistDone.remote=true;
    input=body.querySelector('[data-checklist-id="b"]'); input.checked=true; input.dispatchEvent(new Event('change'));
    await new Promise(resolve=>setTimeout(resolve,30));
    check(stored.checklistDone.a && stored.checklistDone.b && stored.checklistDone.remote,'preserve other and concurrent step states');
    input=body.querySelector('[data-checklist-id="a"]'); input.checked=false; input.dispatchEvent(new Event('change'));
    await new Promise(resolve=>setTimeout(resolve,30));
    check(!stored.checklistDone.a && stored.checklistDone.b,'uncheck only the selected step');
    denyWrite=true;
    input=body.querySelector('[data-checklist-id="a"]'); input.checked=true; input.dispatchEvent(new Event('change'));
    await new Promise(resolve=>setTimeout(resolve,30));
    check(!input.checked && !input.disabled,'failed save restores checkbox and allows retry');
    check(body.querySelector('.checklist-status').textContent.includes('Firestore'),'show permission failure');
    check(historyCalls===0,'checklist must not write history on success or failure');
    renderJobChecklist(job,'2026-11-06',body);
    check(!body.querySelector('[data-checklist-id="a"]').checked,'next occurrence has independent progress');
    const preview=document.createElement('div'); preview.className='off-preview-scroll';
    preview.innerHTML='<table class="table"><thead><tr><th>Job</th><th>Current</th><th>After</th></tr></thead><tbody><tr><td>Example</td><td>10/11</td><td>09/11</td></tr></tbody></table>';
    document.getElementById('dayOffYear').add(new Option('2026','2026'));
    document.getElementById('dayOffMonth').add(new Option('November','10'));
    document.getElementById('dayOffJobPreview').appendChild(preview);
    for (const theme of ['light','dark']) {
        document.body.classList.remove('theme-light','theme-dark'); document.body.classList.add('theme-'+theme);
        const surface=getComputedStyle(document.getElementById('changeHistoryModal')).getPropertyValue('--surface').trim();
        const tableStyle=getComputedStyle(preview.querySelector('table'));
        check(tableStyle.getPropertyValue('--bs-table-bg').trim()===surface,'preview table background follows '+theme+' theme');
        check(getComputedStyle(body.querySelector('[type="checkbox"]')).colorScheme===theme,'checkbox follows '+theme+' theme');
        check(getComputedStyle(document.getElementById('changeHistoryFilter')).colorScheme===theme,'history control follows '+theme+' theme');
        const historyBg=getComputedStyle(document.querySelector('#changeHistoryModal .modal-content')).backgroundColor;
        check(historyBg===(theme==='dark'?'rgb(17, 24, 39)':'rgb(255, 255, 255)'),'history surface follows '+theme+' theme');
        check(getComputedStyle(preview.querySelector('td:nth-child(2)')).color===(theme==='dark'?'rgb(248, 113, 113)':'rgb(239, 68, 68)'),'current schedule is red');
        check(getComputedStyle(preview.querySelector('td:nth-child(3)')).color===(theme==='dark'?'rgb(52, 211, 153)':'rgb(22, 163, 74)'),'new schedule is green');
        check(getComputedStyle(document.querySelector('#dayOffYear option')).color===(theme==='dark'?'rgb(122, 169, 255)':'rgb(59, 130, 246)'),'selected dropdown option follows theme');
    }
    check(document.querySelector('#dayOffReasonPresets [data-reason="SO"]'),'SO reason is available');
    check(document.getElementById('dayOffYear').closest('.dayoff-period-picker')===document.getElementById('dayOffMonth').closest('.dayoff-period-picker'),'year and month share a picker group');
    document.body.innerHTML='<pre id="smoke-result">PASS: shared notes (table, image, sanitization, send failures, unread and sign-out), event editor, recurrence, history and checklist</pre>';
} catch(error) {document.body.innerHTML='<pre id="smoke-result">FAIL: '+escapeHtml(error.stack)+'</pre>';}
`;
try {
    const html = markup.replace('</body>', `<style>${fs.readFileSync('styles.css','utf8')}\n.d-none{display:none!important}</style><script type="module">${script}</script></body>`);
    const target = path.join(temp, 'smoke.html'); fs.writeFileSync(target, html);
    const result = spawnSync(chrome, ['--headless', '--disable-gpu', '--no-first-run', '--disable-extensions', '--allow-file-access-from-files', `--user-data-dir=${path.join(temp, 'profile')}`, '--dump-dom', '--virtual-time-budget=2000', pathToFileURL(target).href], {encoding:'utf8', timeout:30000, windowsHide:true, maxBuffer:8*1024*1024});
    const output = result.stdout?.match(/<pre id="smoke-result">([\s\S]*?)<\/pre>/)?.[1];
    assert.ok(output?.startsWith('PASS:'), output || result.error?.message || result.stderr?.slice(-1500) || 'Browser smoke did not finish');
    console.log(output);
} finally {
    const resolved = path.resolve(temp);
    if (resolved.startsWith(path.resolve(os.tmpdir()) + path.sep) && path.basename(resolved).startsWith('workpic-ui-')) fs.rmSync(resolved, {recursive:true,force:true,maxRetries:5,retryDelay:200});
}

})();

// ===== theme-fx-ui checks =====
if (process.argv.includes('--themes') && !process.env.ADMIN_UI_PREVIEW) await (async function () {
const chrome = ['C:/Program Files/Google/Chrome/Application/chrome.exe', 'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe'].find(p => fs.existsSync(p));
if (!chrome) { console.log('Theme GPU smoke skipped: Chrome/Edge unavailable.'); process.exit(0); }
const source = fs.readFileSync('app.js', 'utf8');
let code = source.slice(source.indexOf('const ThreeFx ='), source.indexOf('// CƯỜNG ĐỘ HIỆU ỨNG'));
const rainCode = source.slice(source.indexOf('const RainFx ='), source.indexOf('// Thiên hà xoắn ốc'))
    .replace('        s.fit();', '        s.frame = frame; s.fit();')
    .replace('return { start, stop };', 'return { draw: () => { cancelAnimationFrame(state.raf); state.frame(performance.now() + 50); }, start, stop };');
code = code.replace("if (!threePromise) threePromise = import(THREE_URL).catch(err => { threePromise = null; throw err; });", 'if (!threePromise) threePromise = Promise.resolve(THREE);');
code = code.replace('return { start, stop: () =>', 'return { inspect: () => state, start, stop: () =>');
const temp = fs.mkdtempSync(path.join(os.tmpdir(), 'workpic-fx-'));
try {
    const response = await fetch('https://cdn.jsdelivr.net/npm/three@0.160.0/build/three.module.js', { signal: AbortSignal.timeout(15000) });
    assert.ok(response.ok, 'load the same pinned Three.js version as the app');
    fs.writeFileSync(path.join(temp, 'three.module.js'), await response.text());
    const script = `
import * as THREE from './three.module.js';
const errors=[];
const oldError=console.error; console.error=(...args)=>{errors.push(args.join(' '));oldError(...args);};
${code}
${rainCode}
const check=(condition,message)=>{if(!condition)throw new Error(message);};
try {
    const layer=document.getElementById('fxFullscreen');
    const metrics=[];
    let renderer;
    for(const mode of ['theme-dark','theme-light']) {
        document.body.className=mode;
        for(const theme of ['space','noel','tet','trungthu','halloween']) {
            layer.dataset.fx=theme;
            check(await ThreeFx.start(layer,theme,2),'scene build failed: '+theme);
            const state=ThreeFx.inspect();
            if(renderer)check(renderer===state.renderer,'renderer must be shared');
            renderer=state.renderer;
            state.renderer.render(state.scene,state.camera);
            check(layer.querySelectorAll('canvas').length===1,'single canvas: '+theme);
            const owned=new Set(state.owned);
            state.scene.traverse(object=>{
                if(object.material?.map)check(owned.has(object.material.map),'unmanaged texture: '+theme);
            });
            check(state.renderer.info.render.calls<=12,'too many draw calls: '+theme);
            if(theme==='halloween') {
                const flying=state.aspectMats.filter(mat=>mat.uniforms.uWind);
                check(flying[0].uniforms.uDir.value===0 && flying[1].uniforms.uDir.value===0,'both bat flocks must fly horizontally');
            }
            metrics.push(theme+':'+state.renderer.info.render.calls);
        }
    }
    ThreeFx.stop();
    check(!ThreeFx.isActive() && !layer.querySelector('canvas'),'stop removes scene');
    const header = document.createElement('div');header.style.cssText='width:1280px;height:80px;position:relative';document.body.appendChild(header);
    layer.style.cssText='width:1280px;height:720px;position:relative';
    for(const mode of ['theme-dark','theme-light']){
        document.body.className=mode;
        for(const host of [header,layer])for(const level of [0,1,2]){
            check(RainFx.start(host,level),'canvas rain starts in '+mode);
            await new Promise(resolve=>setTimeout(resolve,100));
            RainFx.draw();
            check(document.querySelectorAll('.rain-fx-canvas').length===1,'header/fullscreen rain cannot overlap');
            const canvas=host.querySelector('canvas');
            check(canvas.width>0&&canvas.height>0,'rain canvas has dimensions');
            const pixels=canvas.getContext('2d').getImageData(0,0,canvas.width,canvas.height).data;
            check(pixels.some((v,i)=>i%4===3&&v>0),'rain paints visible pixels');
        }
    }
    RainFx.stop();header.remove();
    check(!document.querySelector('.rain-fx-canvas'),'rain cleanup removes canvas');
    // Three.js retains one shared sprite quad with the reusable renderer.
    check(renderer.info.memory.textures===0 && renderer.info.memory.geometries<=1,'scene GPU resources released: '+JSON.stringify(renderer.info.memory));
    check(!errors.some(e=>/WebGLProgram|shader error|VALIDATE_STATUS/i.test(e)),'shader compile errors: '+errors.join(';'));
    document.body.innerHTML='<pre id="fx-result">PASS: shared rain at all levels in header/fullscreen and light/dark; five WebGL themes, one renderer, owned textures, draw calls '+metrics.join(', ')+'</pre>';
} catch(error) {document.body.innerHTML='<pre id="fx-result">FAIL: '+String(error.stack).replace(/</g,'&lt;')+'</pre>';}
`;
    const html = `<!doctype html><body><div id="fxFullscreen"></div><script type="module">${script}</script></body>`;
    const target=path.join(temp,'smoke.html');fs.writeFileSync(target,html);
    const result=spawnSync(chrome,['--headless','--use-angle=swiftshader','--enable-unsafe-swiftshader','--no-first-run','--disable-extensions','--allow-file-access-from-files',`--user-data-dir=${path.join(temp,'profile')}`,'--dump-dom','--virtual-time-budget=4000',pathToFileURL(target).href],{encoding:'utf8',timeout:40000,windowsHide:true,maxBuffer:8*1024*1024});
    const output=result.stdout?.match(/<pre id="fx-result">([\s\S]*?)<\/pre>/)?.[1];
    assert.ok(output?.startsWith('PASS:'),output||result.error?.message||result.stderr?.slice(-1500)||'GPU smoke did not finish');
    console.log(output);
} finally {
    const resolved=path.resolve(temp);
    if(resolved.startsWith(path.resolve(os.tmpdir())+path.sep)&&path.basename(resolved).startsWith('workpic-fx-'))fs.rmSync(resolved,{recursive:true,force:true,maxRetries:5,retryDelay:200});
}

})();
    },

    "test:performance": async () => {
const source = fs.readFileSync('app.js', 'utf8');
const fn = name => {
    const start = source.indexOf('function ' + name + '(');
    return source.slice(start, source.indexOf('\n}', start) + 2);
};
const chrome = ['C:/Program Files/Google/Chrome/Application/chrome.exe', 'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe'].find(fs.existsSync);
assert.ok(chrome, 'Browser required for rendering checks');
const temp = fs.mkdtempSync(path.join(os.tmpdir(), 'workpic-perf-'));
const script = `
${source.split('// BEGIN SHARED HELPERS\n')[1].split('// END SHARED HELPERS')[0]}

const check = (ok, message) => { if (!ok) throw new Error(message); };
let instant = new Date(2026, 10, 16, 8, 59);
const NativeDate = Date;
class Clock extends NativeDate { constructor(...args) { super(...(args.length ? args : [instant])); } static now() { return +instant; } }
window.Date = Clock;
let jobs = Array.from({length: 200}, (_, i) => ({ id: 'j'+i, title: 'Job '+i, date: '2026-11-16', time: '09:00', type: 'daily', duration: 30 }));
let filteredJobs = jobs, currentUser = { uid:'me', workShift:'day' }, scheduleView='calendar', showSunday=true;
let jobCompletionEnabled=true, jobCompletionSince='2026-01-01', jobDayOverridesList=[], scheduleWorkHoursMap={};
let occurrenceCalls=0, renders=0;
const localDateKey = d => d.getFullYear()+'-'+String(d.getMonth()+1).padStart(2,'0')+'-'+String(d.getDate()).padStart(2,'0');
const parseJobDate = d => new Date(d+'T00:00:00');
let eventData=[];
const getMyOffMap=()=>({}), getHolidayName=()=>'', getPersonalEvents=key=>key==='2026-11-18'?eventData:[], getDeptName=()=>'', compactCalendarLabel=s=>s;
const formatDate=s=>s, formatDateShort=localDateKey, formatDateShortDMY=s=>s, formatWorkHours=s=>s;
const getJobDuration=j=>j.duration||30, getOverrideFor=(id,day)=>jobDayOverridesList.find(o=>o.jobId===id&&o.occurrenceDate===day);
let opened;
let openViewJobModal=j=>{opened=j;}, openEditJobModal=j=>{opened=j;}, openJobFromToday=j=>{opened=j;};
const openDayOverridePopover=()=>{}, setJobOccurrenceCompleted=()=>{}, openPersonalEventEditor=()=>{};
${['escapeHtml','personalEventCardContent','repeatLabel','setupDayOffDetailsToggle','getTodayShift','getJobOccurrences','resolveShiftedDate','computeScheduleEntries','buildScheduleEntries','renderJobList','renderOutOfScheduleJobs','renderSchedule','renderTodayJobs','renderTimeline','clockScope','refreshRenderedClock'].map(fn).join('\n')}
const cachedScheduleEntries=createScheduleCache();
const originalOccurrences=getJobOccurrences;
getJobOccurrences=(...args)=>{occurrenceCalls++;return originalOccurrences(...args);};
try {
    renderSchedule(); renderJobList();
    const calls=occurrenceCalls;
    const first=document.querySelector('.schedule-item[data-render-key="job:j0:2026-11-16"]');
    const unaffected=document.querySelector('.schedule-item[data-render-key="job:j1:2026-11-16"]');
    const sidebar=document.querySelector('#jobList [data-render-key="job:j1"]');
    check(first&&unaffected&&sidebar,'initial calendar cards');
    document.getElementById('viewDataModal').classList.add('show');
    renderTodayJobs();
    check(occurrenceCalls===calls,'today must reuse main schedule calculations');
    const today=document.querySelector('#todayJobsList [data-render-key="job:j1:2026-11-16"]');
    const timeline=document.querySelector('#todayTimelineView [data-render-key="job:j1:2026-11-16"]');
    jobs=jobs.map(j=>j.id==='j0'?{...j,title:'Edited title',duration:45}:({...j})); filteredJobs=jobs;
    renderSchedule(); renderJobList();
    check(occurrenceCalls===calls+1,'one edited job recalculates only once across views');
    check(document.querySelector('.schedule-item[data-render-key="job:j1:2026-11-16"]')===unaffected,'keep unchanged calendar node');
    check(document.querySelector('#jobList [data-render-key="job:j1"]')===sidebar,'keep unchanged sidebar node');
    check(document.querySelector('#todayJobsList [data-render-key="job:j1:2026-11-16"]')===today,'keep unchanged today node');
    check(document.querySelector('#todayTimelineView [data-render-key="job:j1:2026-11-16"]')===timeline,'keep unchanged timeline node');
    const edited=document.querySelector('.schedule-item[data-render-key="job:j0:2026-11-16"]');
    check(edited!==first&&edited.textContent.includes('Edited title'),'replace changed card');
    edited.click(); check(opened.title==='Edited title','changed card listener uses current data');
    let mutations=0; const observer=new MutationObserver(records=>{mutations+=records.filter(r=>r.type==='childList').length;});
    observer.observe(document.getElementById('scheduleBody'),{childList:true,subtree:true});
    instant=new NativeDate(2026,10,16,9,31); refreshRenderedClock();
    check(unaffected.classList.contains('past'),'minute updates expiration');
    check(unaffected.classList.contains('pending-done'),'minute updates pending completion');
    check(!edited.classList.contains('past'),'duration respected');
    check(today.classList.contains('past')&&timeline.classList.contains('past'),'today and timeline states updated');
    check(occurrenceCalls===calls+1,'minute does not calculate schedules');
    check(document.querySelector('.schedule-item[data-render-key="job:j1:2026-11-16"]')===unaffected,'minute keeps card identity');
    check(observer.takeRecords().filter(r=>r.type==='childList').length===0,'minute does not rebuild table'); observer.disconnect();
    // Repeated updates must not add duplicate listeners.
    let clicks=0; opened=null;
    const savedOpen=openViewJobModal; openViewJobModal=j=>{clicks++;savedOpen(j);};
    renderTimeline(); renderTimeline(); renderTimeline();
    document.querySelector('#timelineView [data-job-id="j1"]').click();
    check(clicks===1,'timeline has exactly one click handler');
    instant=new NativeDate(2026,10,17,0,1); refreshRenderedClock();
    check(document.querySelector('td.today-cell [data-clock-day="2026-11-17"]'),'day rollover updates calendar');
    const beforeOverride=occurrenceCalls;
    jobDayOverridesList=[{jobId:'j1',occurrenceDate:'2026-11-17',overrideTime:'11:00',completed:true}];
    renderSchedule();
    check(occurrenceCalls===beforeOverride+1,'override recalculates only the affected job');
    const overridden=document.querySelector('.schedule-item[data-render-key="job:j1:2026-11-17"]');
    check(overridden.classList.contains('completed')&&overridden.textContent.includes('11:00'),'override invalidates cache and updates card');
    jobs=jobs.filter(j=>j.id!=='j1'); filteredJobs=jobs; renderSchedule(); renderJobList();
    check(!document.querySelector('#scheduleBody [data-job-id="j1"], #todayTimelineView [data-job-id="j1"], #todayJobsList [data-today-job-id="j1"]')&&!document.querySelector('[data-render-key="job:j1"]'),'deleted job removed from views');
    currentUser.workShift='night';
    jobs=[{id:'night',title:'Night',type:'daily',date:'2026-11-16',time:'23:30',duration:120},{id:'morning',title:'Morning',type:'daily',date:'2026-11-16',time:'02:00',duration:60}]; filteredJobs=jobs;
    instant=new NativeDate(2026,10,17,23,45); renderSchedule();
    let night=document.querySelector('#todayJobsList [data-today-job-id="night"]');
    check(night.classList.contains('active'),'night active before midnight');
    instant=new NativeDate(2026,10,18,0,15); refreshRenderedClock();
    night=document.querySelector('#todayJobsList [data-today-job-id="night"]');
    check(night&&night.classList.contains('active'),'night duration continues through midnight');
    instant=new NativeDate(2026,10,18,2,15); refreshRenderedClock();
    check(document.querySelector('#todayJobsList [data-today-job-id="morning"]').classList.contains('active'),'next morning belongs to previous night shift');
    instant=new NativeDate(2026,10,18,7,0); refreshRenderedClock();
    check(document.querySelector('#todayJobsList [data-today-origin-date="2026-11-18"]'),'shift rollover uses next shift');
    eventData=[{id:'event',time:'14:30',title:'Long event title <safe>',notes:'Full event notes. '.repeat(30)+'LAST LINE',repeat:'weekly',until:'2026-12-31'}];
    currentUser.workShift='day'; instant=new NativeDate(2026,10,18,10,0); renderSchedule();
    const event=document.querySelector('#scheduleBody .calendar-personal-event');
    check(event.textContent.includes('LAST LINE')&&event.textContent.includes('14:30')&&event.textContent.includes('2026-12-31'),'event shows full notes, time and recurrence end');
    check(!event.querySelector('safe'),'event content is escaped');
    const luminance=color=>{
        const rgb=color.match(/[0-9.]+/g).slice(0,3).map(Number).map(v=>{v/=255;return v<=.04045?v/12.92:((v+.055)/1.055)**2.4;});
        return .2126*rgb[0]+.7152*rgb[1]+.0722*rgb[2];
    };
    const contrast=(a,b)=>{const x=luminance(a),y=luminance(b);return(Math.max(x,y)+.05)/(Math.min(x,y)+.05);};
    for(const theme of ['light','dark']) {
        document.body.classList.remove('theme-light','theme-dark'); document.body.classList.add('theme-'+theme);
        await new Promise(resolve=>requestAnimationFrame(()=>requestAnimationFrame(resolve)));
        document.body.className='theme-'+theme;
        const style=getComputedStyle(event);
        check(style.whiteSpace==='normal'&&style.overflow==='visible'&&parseFloat(style.fontSize)>=14,'event is large and not truncated');
        for(const close of document.querySelectorAll('.modal .btn-close')) {
            const closeStyle=getComputedStyle(close), glyph=getComputedStyle(close,'::before');
            check(closeStyle.filter==='none'&&closeStyle.backgroundImage==='none','close icon avoids theme inversion');
            check(contrast(glyph.backgroundColor,closeStyle.backgroundColor)>=4.5,'close icon has readable contrast in '+theme);
        }
        for(const subtitle of document.querySelectorAll('.modal-header .modern-header-subtitle, .modal-header .check-due-header-subtitle')) {
            const labelStyle=getComputedStyle(subtitle),headerStyle=getComputedStyle(subtitle.closest('.modal-header'));
            check(contrast(labelStyle.color,headerStyle.backgroundColor)>=4.5,'header subtitle contrast in '+theme+' '+subtitle.closest('.modal').id+' '+labelStyle.color+' / '+headerStyle.backgroundColor);
        }
        const tabs=document.querySelectorAll('.schedule-view-tab');
        check(getComputedStyle(tabs[0]).color!==getComputedStyle(tabs[1]).color,'active view tab has distinct themed color');
        const sample=document.createElement('div'); sample.innerHTML='<div class="timeline-job once"></div><div class="timeline-job monthly"></div>'; document.body.appendChild(sample);
        check(getComputedStyle(sample.children[0]).backgroundImage!==getComputedStyle(sample.children[1]).backgroundImage,'once and monthly colors differ'); sample.remove();
    }
    const frame=document.createElement('iframe'); frame.style.width='550px'; frame.style.height='300px'; document.body.appendChild(frame);
    await new Promise(resolve=>{frame.onload=resolve;frame.srcdoc='<style>'+document.querySelector('style').textContent+'</style><body class="theme-dark"><button id="toggle" class="dayoff-details-toggle" aria-expanded="false" aria-controls="dayOffDetailList">Toggle</button><div id="dayOffDetailList">Upcoming leave</div></body>';});
    const toggle=frame.contentDocument.getElementById('toggle'),detail=frame.contentDocument.getElementById('dayOffDetailList'); setupDayOffDetailsToggle(toggle);
    check(frame.contentWindow.getComputedStyle(detail).display==='none','mobile leave list starts collapsed');
    toggle.click(); check(toggle.getAttribute('aria-expanded')==='true'&&frame.contentWindow.getComputedStyle(detail).display!=='none','mobile leave list expands');
    toggle.click(); check(frame.contentWindow.getComputedStyle(detail).display==='none','mobile leave list collapses again');
    frame.style.width='1300px'; await new Promise(resolve=>requestAnimationFrame(()=>requestAnimationFrame(resolve)));
    check(frame.contentWindow.getComputedStyle(detail).display!=='none','desktop always shows upcoming leave');
    frame.remove();
    document.body.innerHTML='<pre id="result">PASS: 200 jobs; shared cache, one-job invalidation, DOM identity, current listeners, clock states, overrides, deletion and day/night rollover, event content, theme contrast and mobile collapse</pre>';
} catch(error) { document.body.innerHTML='<pre id="result">FAIL: '+error.stack+'</pre>'; }
`;
try {
    let markup = fs.readFileSync('index.html','utf8').replace(/<script\b[^>]*>[\s\S]*?<\/script>/gi,'').replace(/<link\b[^>]*>/gi,'');
    markup=markup.replace('</head>', '<style>'+fs.readFileSync('styles.css','utf8')+'\n*,*::before,*::after{animation:none!important;transition:none!important}</style></head>');
    const target=path.join(temp,'check.html');
    fs.writeFileSync(target,markup.replace('</body>',`<script type="module">${script}</script></body>`));
    const result=spawnSync(chrome,['--headless','--disable-gpu','--no-first-run','--disable-extensions','--allow-file-access-from-files',`--user-data-dir=${path.join(temp,'profile')}`,'--dump-dom','--virtual-time-budget=5000',pathToFileURL(target).href],{encoding:'utf8',timeout:60000,windowsHide:true,maxBuffer:8*1024*1024});
    const output=result.stdout?.match(/<pre id="result">([\s\S]*?)<\/pre>/)?.[1];
    assert.ok(output?.startsWith('PASS:'), output||result.error?.message||result.stderr?.slice(-1500)||'No browser result');
    console.log(output);
} finally {
    if(path.resolve(temp).startsWith(path.resolve(os.tmpdir())+path.sep)&&path.basename(temp).startsWith('workpic-perf-')) fs.rmSync(temp,{recursive:true,force:true,maxRetries:5,retryDelay:200});
}
    },
};
if (!Object.hasOwn(commands, command)) {
    console.error('Usage: node tools.mjs [build|test|test:ui|test:performance]');
    process.exitCode = 1;
} else {
    await commands[command]();
}
