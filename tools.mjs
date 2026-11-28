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
        [template.match(/<script type="module" src="app\.js(?:\?[^"\s]*)?"><\/script>/)?.[0] || '<script type="module" src="app.js"></script>', `<script type="module">\n${inlineJs}\n</script>`]
    ];
    let html = template;
    for (const [marker, value] of replacements) {
        if (html.split(marker).length !== 2) throw new Error(`Expected one asset marker: ${marker}`);
        html = html.replace(marker, () => value);
    }
    await mkdir('dist', { recursive: true });
    await writeFile('dist/index.html', html);
    await copyFile('sw.js', 'dist/sw.js');
    await copyFile('pet-portraits.webp', 'dist/pet-portraits.webp');
} finally { await bundle.close(); }
console.log(`Deploy dist/: index.html (${((await stat('dist/index.html')).size / 1024).toFixed(1)} KB) + sw.js`);
    },

    "test": async () => {
const helperSource = fs.readFileSync('app.js', 'utf8').replace(/\r\n/g,'\n').split('// BEGIN SHARED HELPERS\n')[1].split('// END SHARED HELPERS')[0];
const helperModule = helperSource + '\nexport { convertWorkHoursRows, resolveApiUrl, vietnameseLunar, dateKey, monthPair, holidaysForYear, personalEventOccurs, checklistFromText, compareScheduleEntries, reconcileChildren, reconcileMarkup, createScheduleCache, jobColorStyle, advanceStormWater, scoopStormWater, loadStormWater, saveStormWater, attendancePetDay, newAttendancePet, attendancePetView, transitionAttendancePet, adjustAdminPet, attendancePetMotion, attendancePetTravelBounds, attendancePetCatalog, attendancePetScale, ATTENDANCE_PET_BRANCHES, normalizePetNickname, attendancePetRecords, attendancePetSelected, attendancePetHouseholdDay, transitionPetHousehold, attendancePetWeight, attendancePetActivityTime, buildPetComparison, unchangedPetAdminAction, petBattleBudget, petBattleStats, petBattleMaxHp, petBattlePower, petBattleRps, petBattleSimulation, petBattlePlayback, petBattleChangeWeight, petBattleFighter, petBattleClaimAmount, petBattleSettleXp, petBattleCompletePet, petBattleMatchup, petBattleReceivesBonus, petBattleEffectiveStats, makePetBattleBot, petBattleSpirit, petBattleSkill, petBattleCommitment };';
const { convertWorkHoursRows, resolveApiUrl, vietnameseLunar, dateKey, monthPair, holidaysForYear, personalEventOccurs, checklistFromText, compareScheduleEntries, reconcileChildren, reconcileMarkup, createScheduleCache, jobColorStyle, advanceStormWater, scoopStormWater, loadStormWater, saveStormWater, attendancePetDay, newAttendancePet, attendancePetView, transitionAttendancePet, adjustAdminPet, attendancePetMotion, attendancePetTravelBounds, attendancePetCatalog, attendancePetScale, ATTENDANCE_PET_BRANCHES, normalizePetNickname, attendancePetRecords, attendancePetSelected, attendancePetHouseholdDay, transitionPetHousehold, attendancePetWeight, attendancePetActivityTime, buildPetComparison, unchangedPetAdminAction, petBattleBudget, petBattleStats, petBattleMaxHp, petBattlePower, petBattleRps, petBattleSimulation, petBattlePlayback, petBattleChangeWeight, petBattleFighter, petBattleClaimAmount, petBattleSettleXp, petBattleCompletePet, petBattleMatchup, petBattleReceivesBonus, petBattleEffectiveStats, makePetBattleBot, petBattleSpirit, petBattleSkill, petBattleCommitment } = await import('data:text/javascript;base64,' + Buffer.from(helperModule).toString('base64'));





test('schedule override index follows live snapshots and local checklist additions', () => {
    const source = fs.readFileSync('app.js', 'utf8').replace(/\r\n/g, '\n');
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

test('Firebase listeners are scoped, bounded, and opened on demand', () => {
    const source = fs.readFileSync('app.js', 'utf8');
    const init = source.slice(source.indexOf('function initializeAuthenticatedApp()'), source.indexOf('// Trong DOMContentLoaded event listener'));
    for (const listener of ['listenUserNotifications()', 'listenQuickJobs()', 'listenSharedNotes()', 'listenDayOffs()', 'listenWorkHours()']) {
        assert.equal(init.includes(listener), false, `${listener} must not start at login`);
    }
    const directory = source.slice(source.indexOf('async function listenUsersAvatars()'), source.indexOf('function getUserAvatarUrl('));
    assert.match(directory, /getDocs\(collection\(db,'users'\)\)/);
    assert.doesNotMatch(directory, /onSnapshot/);
    assert.match(source, /const PET_CLOUD_ENABLED = false/);
    const ranking = source.slice(source.indexOf('function stopPetRankingListeners()'), source.indexOf('const petComparisonImageCache'));
    assert.match(ranking, /getDocs\(collection\(db,'users'\)\)/);
    assert.match(ranking, /slice\(offset,offset\+20\)/);
    assert.match(ranking, /onSnapshot\(profile\.ref/);
    assert.match(ranking, /const visible=page\.rows\.slice\(0,20\)/);
    const notifications = source.slice(source.indexOf('function listenUserNotifications()'), source.indexOf('// QUICK CHAT'));
    assert.match(notifications, /orderBy\('timestamp', 'desc'\)/);
    assert.match(notifications, /limit\(50\)/);
    assert.match(notifications, /error\?\.code === 'failed-precondition'/);
    assert.match(notifications, /fallbackQuery[\s\S]*where\('userId', '==', uid\)[\s\S]*limit\(50\)/);
    const quickJobsStart = source.indexOf('function listenQuickJobs()');
    const quickJobs = source.slice(quickJobsStart, source.indexOf('// Job trong ng', quickJobsStart));
    assert.doesNotMatch(quickJobs, /\bor\(/);
    assert.match(quickJobs, /where\('status','in',\['open','invited'\]\)[\s\S]*limit\(100\)/);
    assert.match(quickJobs, /where\('createdAt','>=',recentSince\)[\s\S]*orderBy\('createdAt','desc'\)[\s\S]*limit\(100\)/);
    const notes = source.slice(source.indexOf('function listenSharedNotes()'), source.indexOf('function stopSharedNotes()'));
    assert.match(notes, /limit\(50\)/);
    const workHours = source.slice(source.indexOf('function listenWorkHours()'), source.indexOf('function resolveWorkHoursDept('));
    assert.match(workHours, /where\('date', '>=', localDateKey\(lower\)\)/);
    assert.match(workHours, /where\('date', '<', localDateKey\(upper\)\)/);
    const dayOffs = source.slice(source.indexOf('function listenDayOffs()'), source.indexOf('function getMyOffMap('));
    assert.match(dayOffs, /DAYOFF_MONTHS_SHOWN/);
    assert.match(dayOffs, /where\('date', '>=', localDateKey\(lower\)\)/);
    assert.match(dayOffs, /where\('date', '<', localDateKey\(upper\)\)/);
});

test('Firestore-only Bot settlement uses one idempotent client transaction', () => {
    const client = fs.readFileSync('app.js', 'utf8');
    const backend = fs.readFileSync('pet-cloud.mjs', 'utf8');
    const mutateBot = client.slice(client.indexOf('async function mutateBot('), client.indexOf('async function process()', client.indexOf('async function mutateBot(')));
    assert.match(mutateBot, /runTransaction\(db/);
    assert.match(mutateBot, /profile\.petBotClaims/);
    assert.match(mutateBot, /transaction\.update\(ref,patch\)/);
    assert.match(mutateBot, /usage\[difficulty\]>=botBattleLimit\(usage,difficulty\)/);
    assert.match(mutateBot, /transaction\.update\(ref,\{petBotDailyBattles:usage,petBattleStatsByPet\}\)/);
    assert.match(client, /const BOT_DAILY_LIMIT=5/);
    const botBattle = backend.slice(backend.indexOf('async function botBattle('), backend.indexOf('async function ranking('));
    assert.match(botBattle, /petBattleSimulation\(players, firstUid, id\)/);
    assert.match(botBattle, /db\.runTransaction/);
    assert.match(botBattle, /tx\.update\(ref,\{petBotDailyBattles:usage,petBattleStatsByPet:/);
    assert.match(botBattle, /tx\.update\(matchRef/);
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
const extract = (start, end) => {const a=source.indexOf(start),b=source.indexOf(end);assert.ok(a>=0&&b>a,'Missing UI source boundary: '+start+' / '+end);return source.slice(a,b);};
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
assert.equal(sent.length, 2, 'due-time reminder still fires after an early reminder');
vm.runInContext('notifyLeadMinutes = 0', ctx);
check();
assert.equal(sent.length, 2, 'setting changes cannot repeat an already sent due reminder');
storage.clear();
const ctx2 = vm.createContext({
    accessControl: { requireAccess: () => true, can: () => true }, ...ctx, jobs: [{ id: 'second', title: 'Test', time: '10:00' }], notifyLeadMinutes: 0 });
vm.runInContext(code, ctx2);
vm.runInContext('checkNotifications(); checkNotifications()', ctx2);
assert.equal(sent.length, 3);
assert.equal(sent[2].kind, 'due');
instant = new Date(2026, 10, 4, 10, 5);
ctx2.jobs=[{id:'background',title:'Background job',time:'10:00'}];
vm.runInContext('checkNotifications()',ctx2);
assert.equal(sent.at(-1).kind,'due');
assert.equal(sent.length,4,'background timer delayed five minutes still receives reminder');
ctx2.jobs=[{id:'missed-lead',title:'Missed lead',time:'10:00'}];ctx2.notifyLeadMinutes=120;
vm.runInContext('checkNotifications()',ctx2);
assert.equal(sent.length,5,'missed early reminder falls back to due-time reminder');
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
await vm.runInContext("showTimedDesktopNotification(reg, 'Persistent job', {tag:'job',requireInteraction:true})",ctx);
assert.equal(options.requireInteraction,true,'job reminders request interaction instead of expiring');
assert.equal(timers.length,1,'persistent job notification has no auto-close timer');
console.log('Notifications passed: lead/due reminders, background catch-up and persistent job reminders.');

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

test('hide outside jobs setting applies immediately and persists per account', async () => {
    const source=fs.readFileSync('app.js','utf8');
    const fn=name=>{const start=source.indexOf('function '+name+'(');return source.slice(start,source.indexOf('\n}',start)+2);};
    const offCard={hidden:false},list={innerHTML:''},stored=new Map(),writes=[];
    const ctx=vm.createContext({currentUser:{uid:'user',hideOutOfSchedule:false},jobs:[],db:{},document:{getElementById:id=>id==='outOfScheduleCard'?offCard:list,createElement:()=>({innerHTML:''})},localStorage:{setItem:(key,value)=>stored.set(key,value)},collection:()=>({}),query:()=>({}),where:()=>({}),getDocs:async()=>({forEach:callback=>callback({ref:'user-doc'})}),writeBatch:()=>({update:(ref,data)=>writes.push({ref,data}),commit:async()=>{}}),reconcileChildren(){},showNotification(){}});
    vm.runInContext(fn('renderOutOfScheduleJobs')+';async '+fn('saveOutOfScheduleVisibility'),ctx);
    await ctx.saveOutOfScheduleVisibility(true);
    assert.equal(offCard.hidden,true);assert.equal(stored.get('hideOutOfSchedule_user'),'true');
    assert.equal(writes[0].data.hideOutOfSchedule,true);
    await ctx.saveOutOfScheduleVisibility(false);assert.equal(offCard.hidden,false);
});

test('custom job colors preserve defaults and choose readable text', () => {
    assert.equal(jobColorStyle({}), '');
    assert.equal(jobColorStyle({displayColor:null}), '');
    assert.equal(jobColorStyle({displayColor:'red;display:none'}), '');
    assert.match(jobColorStyle({displayColor:'#ffffff'}), /--job-custom-text:#111827/);
    assert.match(jobColorStyle({displayColor:'#000000'}), /--job-custom-text:#ffffff/);
});

test('desktop permission setup requests permission without sending diagnostic notifications', async () => {
    const source=fs.readFileSync('app.js','utf8');
    const start=source.indexOf('async function enableDesktopNotifications(');
    let requests=0, delivered=0;
    const status={textContent:''}, button={disabled:false};
    function FakeNotification(){delivered++;this.close=()=>{};}
    FakeNotification.permission='default';
    FakeNotification.requestPermission=()=>{requests++;FakeNotification.permission='granted';return Promise.resolve('granted');};
    const ctx=vm.createContext({window:{Notification:FakeNotification},Notification:FakeNotification,console,document:{getElementById:id=>id==='desktopNotificationStatus'?status:button},showDesktopNotification:async()=>{delivered++;return true;},desktopNotificationPermissionText:()=> 'Permission status',todayKey:()=> '2026-11-18',getSwRegistration:async()=>null,checkNotifications(){},setTimeout(){}});
    vm.runInContext(source.slice(start,source.indexOf('function toggleDailyExcludeWrap(',start)),ctx);
    const prompt=ctx.enableDesktopNotifications();
    assert.equal(requests,1,'permission prompt occurs synchronously in the button gesture');await prompt;
    assert.equal(delivered,0,'enabling permission does not send a test notification');
    FakeNotification.permission='denied';await ctx.enableDesktopNotifications();
    assert.equal(delivered,0);assert.equal(requests,1,'blocked permission is not repeatedly prompted');
    assert.ok(status.textContent.length>0,'blocked state provides recovery instructions');
});

test('real due-job pipeline reaches desktop service worker while page is hidden even if web toast fails', async () => {
 const source=fs.readFileSync('app.js','utf8');let instant=new Date(2026,10,18,10,0),delivered=[];
 class Clock extends Date { constructor(...args){super(...(args.length?args:[instant]));}static now(){return +instant;} }
 const storage=new Map(),timers=[];const status={textContent:''};
 function NativeNotification(){}NativeNotification.permission='granted';
 const ctx=vm.createContext({Date:Clock,Math,console:{warn(){}},window:{Notification:NativeNotification},Notification:NativeNotification,navigator:{},document:{hidden:true,getElementById:id=>id==='desktopNotificationStatus'?status:null},currentUser:{uid:'me'},notifyLeadMinutes:0,jobCompletionEnabled:false,jobDayOverridesList:[],jobs:[{id:'scheduled',title:'Actual scheduled job',type:'weekly',time:'10:00'}],localDateKey:dateKey,todayKey:()=>dateKey(instant),getScheduleEntryOnDate:(_,day)=>dateKey(day)==='2026-11-18'?{originDate:'2026-11-18'}:null,jobNotificationTag:(id,date)=>'job-'+id+'-'+date,SNOOZE_MINUTES:10,getSwRegistration:async()=>({showNotification:async(title,options)=>delivered.push({title,options})}),localStorage:{getItem:key=>storage.get(key),setItem:(key,value)=>storage.set(key,value),removeItem:key=>storage.delete(key)},showNotification(){throw Error('toast deliberately fails');},setTimeout:(fn,delay)=>{timers.push({fn,delay});return timers.length;},clearTimeout(){},escapeHtml:String});
 vm.runInContext(source.slice(source.indexOf('const notificationClaims ='),source.indexOf('// Show Desktop Notification'))+source.slice(source.indexOf('async function showDesktopNotification('),source.indexOf('function onUiVisibilityChange(')),ctx);
 ctx.checkNotifications();for(let i=0;i<10;i++)await Promise.resolve();
 assert.equal(delivered.length,1,'scheduled job calls actual desktop delivery, not just the web toast');
 assert.match(delivered[0].options.body,/Actual scheduled job/);
 assert.match(delivered[0].options.tag,/-due-1000$/);
 assert.equal(delivered[0].options.requireInteraction,true);
 ctx.checkNotifications();for(let i=0;i<5;i++)await Promise.resolve();assert.equal(delivered.length,1,'same due event is not repeated');

});

test('job desktop reminders persist, report actual API failures and retry instead of silently consuming them', async () => {
    const source=fs.readFileSync('app.js','utf8');
    let options, timerCount=0, notifications=[];
    const storage=new Map([['retry-key','true']]);
    const warning={hidden:true,querySelector:()=>({textContent:''})};
    function FakeNotification(title,value){options=value;this.close=()=>{};notifications.push(this);}
    FakeNotification.permission='granted';
    const ctx=vm.createContext({window:{Notification:FakeNotification},Notification:FakeNotification,console:{warn(){}},document:{getElementById:()=>warning},currentUser:{uid:'me'},jobCompletionEnabled:false,SNOOZE_MINUTES:5,todayKey:()=> '2026-11-18',jobNotificationTag:()=> 'job-tag',getSwRegistration:async()=>null,recordDesktopReminderEvent(){},notificationClaims:new Set(['retry-key']),localStorage:{removeItem:key=>storage.delete(key)},jobs:[],setTimeout:()=>{timerCount++;}});
    const start=source.indexOf('async function showDesktopNotification(');
    vm.runInContext(source.slice(start,source.indexOf('function onUiVisibilityChange(',start)),ctx);
    assert.equal(await ctx.showDesktopNotification({id:'job',title:'Test',time:'10:00',type:'daily'},{notificationKey:'retry-key'}),true);
    assert.equal(options.requireInteraction,true);assert.equal(timerCount,0,'normal desktop fallback never auto-closes scheduled job');
    notifications[0].onerror();
    assert.equal(storage.has('retry-key'),false);assert.equal(ctx.notificationClaims.has('retry-key'),false,'late notification error allows another delivery attempt');
    assert.equal(warning.hidden,false,'failed desktop delivery is visibly reported');
    FakeNotification.permission='denied';
    assert.equal(await ctx.showDesktopNotification({id:'job'}),false);
    assert.equal(notifications.length,1,'blocked desktop permission does not fake a successful send');
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

test('pet startup reuses login profile, creates only missing pets and never writes on timer ticks', async () => {
 const source=fs.readFileSync('app.js','utf8');
 const code=source.slice(source.indexOf('async function startAttendancePet()'),source.indexOf('function stopAttendancePet()'));
 const now=Date.now(),elements=new Map();let state={uid:'me',attendancePet:newAttendancePet(now)},transactions=0,writes=0,tick,extraListeners=0;
 const context={PET_CLOUD_ENABLED:false,currentUser:{uid:'me'},attendancePetStarting:false,attendancePetGeneration:0,attendancePetReady:false,
  authenticatedProfileSnapshot:{id:'me',ref:{id:'me'},data:()=>state},usersDirectorySnapshot:null,db:{},Date,transitionAttendancePet,transitionPetHousehold,
  document:{getElementById:id=>{if(!elements.has(id))elements.set(id,{});return elements.get(id);}},
  stopAttendancePet:()=>{context.attendancePetGeneration++;},assertPetQuotaAvailable:()=>{},loadAttendancePetVisibility:()=>true,PetBattleGame:{start(){},profile(){}},
  getDocs:()=>assert.fail('Existing login profile must not be queried again'),
  doc:(_,collection,id)=>({collection,id}),getDoc:async()=>({exists:()=>false}),
  runTransaction:async (_,callback,options)=>{transactions++;assert.equal(options.maxAttempts,2);return callback({get:async()=>({exists:()=>true,data:()=>state}),update:(_,patch)=>{state={...state,...patch};writes++;}});},
  watchAttendancePetProfile:()=>{extraListeners++;},AttendancePet3D:{start:()=>{}},checkPetHungerNotifications:()=>{},renderAttendancePet:()=>{},setInterval:fn=>{tick=fn;return 1;},petQuotaErrorText:()=>''
 };
 vm.createContext(context);vm.runInContext(code,context);await context.startAttendancePet();
 assert.equal(transactions,0);assert.equal(writes,0);
 for(let i=0;i<10;i++)tick();assert.equal(writes,0);
 state={uid:'me'};await context.startAttendancePet();assert.equal(transactions,1);assert.equal(writes,1);
 context.usersDirectorySnapshot={docs:[context.authenticatedProfileSnapshot]};
 const before=extraListeners;
 await context.startAttendancePet();assert.equal(transactions,1);assert.equal(writes,1);assert.equal(extraListeners,before+1);
});

test('cloud startup reuses the profile listener and migrates only after a server-confirmed miss', async()=>{
 const source=fs.readFileSync('app.js','utf8');
 let deliver,calls=0,unsubscribes=0;
 const profile={uid:'me',attendancePet:newAttendancePet(Date.now())};
 const context={attendancePetGeneration:1,attendancePetRef:null,attendancePetUnsubscribe:null,db:{},
  doc:(_,name,uid)=>({name,uid}),onSnapshot:(ref,options,callback)=>{
   assert.equal(ref.name,'petProfiles');assert.equal(ref.uid,'me');assert.equal(options.includeMetadataChanges,true);
   deliver=callback;return ()=>unsubscribes++;
  },petCloudRequest:async kind=>{assert.equal(kind,'open');calls++;return profile;}};
 vm.createContext(context);
 vm.runInContext(source.slice(source.indexOf('function openCloudAttendancePet('),source.indexOf('async function startAttendancePet()')),context);
 const snapshot=(exists,fromCache=false)=>({exists:()=>exists,data:()=>profile,metadata:{fromCache}});
 let pending=context.openCloudAttendancePet('me',1);
 deliver(snapshot(true));assert.equal(await pending,profile);assert.equal(calls,0);
 context.attendancePetUnsubscribe();
 pending=context.openCloudAttendancePet('me',1);
 deliver(snapshot(false,true));assert.equal(calls,0);
 deliver(snapshot(false));deliver(snapshot(false));assert.equal(await pending,profile);assert.equal(calls,1);
 context.attendancePetUnsubscribe();
 assert.equal(unsubscribes,2);
});

test('hungry pets send desktop reminders once per feeding cycle, survive refresh and retry failures', async()=>{
 const source=fs.readFileSync('app.js','utf8'),now=Date.now(),storage=new Map(),sent=[];
 const context={Date,Set,console,currentUser:{uid:'me'},attendancePetReady:true,attendancePetData:{...newAttendancePet(now-7200000),lastCheckinAt:now},attendancePetRecords,attendancePetView,
 window:{Notification:{}},Notification:{permission:'granted'},navigator:{locks:{request:async(_,fn)=>fn()}},localStorage:{getItem:key=>storage.get(key),setItem:(key,value)=>storage.set(key,value)},
 getSwRegistration:async()=>({}),showTimedDesktopNotification:async(...args)=>{sent.push(args);}};
 vm.createContext(context);const code=source.slice(source.indexOf('const petHungerNotificationPending='),source.indexOf('function renderPetHungerBubble('));vm.runInContext(code,context);
 await Promise.all([context.checkPetHungerNotifications(),context.checkPetHungerNotifications()]);assert.equal(sent.length,1);assert.equal(sent[0][2].data.kind,'pet-hunger');
 await context.checkPetHungerNotifications();assert.equal(sent.length,1);
 vm.runInContext(code.replace('const petHungerNotificationPending=','petHungerNotificationPending.clear(); const refreshedPending=').replaceAll('petHungerNotificationPending.has','refreshedPending.has').replaceAll('petHungerNotificationPending.add','refreshedPending.add').replaceAll('petHungerNotificationPending.delete','refreshedPending.delete'),context);
 await context.checkPetHungerNotifications();assert.equal(sent.length,1);
 context.attendancePetData.lastFedAt=now-7200001;await context.checkPetHungerNotifications();assert.equal(sent.length,2);
 context.attendancePetData.lastFedAt=now;await context.checkPetHungerNotifications();assert.equal(sent.length,2);
 context.attendancePetData.lastCheckinAt=now-73*3600000;await context.checkPetHungerNotifications();assert.equal(sent.length,2);
 context.attendancePetData=newAttendancePet(now);await context.checkPetHungerNotifications();assert.equal(sent.length,2);
 context.attendancePetData={...newAttendancePet(now-7200000),lastCheckinAt:now};context.Notification.permission='denied';storage.clear();await context.checkPetHungerNotifications();assert.equal(sent.length,2);assert.equal(storage.size,0);
 context.Notification.permission='granted';context.getSwRegistration=async()=>{throw Error('offline');};context.console={warn(){}};await context.checkPetHungerNotifications();assert.equal(storage.size,0);
 context.getSwRegistration=async()=>({});await context.checkPetHungerNotifications();assert.equal(sent.length,3);
});

test('pet nickname is bounded, normalized, idempotent and retained through evolution and revival', () => {
 const now=Date.UTC(2026,10,19),pet={...newAttendancePet(now-7200000),checkins:90,branch:'bird',lastCheckinAt:now};
 const renamed=transitionAttendancePet(pet,'rename:  Sky   Bird  ',now);
 assert.equal(renamed.pet.nickname,'Sky Bird');assert.equal(attendancePetView(renamed.pet,now).displayName,'Sky Bird');
 assert.equal(transitionAttendancePet(renamed.pet,'rename:Sky Bird',now).changed,false);
 assert.equal(normalizePetNickname('a'.repeat(100)).length,30);
 assert.equal(normalizePetNickname('\u202ebad\u0000name'),'badname');
 assert.equal(adjustAdminPet(renamed.pet,'evolve',0,now).nickname,'Sky Bird');
 const dead={...renamed.pet,bornAt:now-100*3600000,lastCheckinAt:now-73*3600000};
 assert.equal(transitionAttendancePet(dead,'revive',now).pet.nickname,'Sky Bird');
 assert.equal(adjustAdminPet(dead,'egg',0,now).nickname,'Sky Bird');
 const cleared=transitionAttendancePet(renamed.pet,'rename:',now);
 assert.equal(attendancePetView(cleared.pet,now).displayName,attendancePetView(cleared.pet,now).name);
});

test('four evolution branches unlock at ray level, finish at 30 and keep gaining one point per level', () => {
 const now=Date.UTC(2026,10,19),pet={...newAttendancePet(now-7200000),checkins:80,lastCheckinAt:now};
 assert.equal(attendancePetView(pet,now).level,9);
 assert.equal(attendancePetView(pet,now).needsBranch,true);
 assert.equal(transitionAttendancePet({...pet,checkins:79},'branch:fish',now).result,'branch-locked');
 for(const branch of Object.keys(ATTENDANCE_PET_BRANCHES)){
  assert.equal(ATTENDANCE_PET_BRANCHES[branch].forms.length,21);
  assert.equal(new Set(ATTENDANCE_PET_BRANCHES[branch].forms.map(f=>f.name)).size,21);
  assert.equal(attendancePetCatalog(branch).length,30);
  const stages=ATTENDANCE_PET_BRANCHES[branch].forms;
  for(let i=1;i<stages.length;i++)assert.ok(stages[i].scale>stages[i-1].scale,'each evolution grows larger');
  for(let i=0;i+1<stages.length;i+=2){assert.equal(stages[i].juvenile,true);assert.equal(stages[i+1].juvenile,false);}

  const change=transitionAttendancePet(pet,'branch:'+branch,now);
  assert.equal(change.pet.checkins,80);assert.equal(change.pet.branch,branch);
  assert.equal(attendancePetView(JSON.parse(JSON.stringify(change.pet)),now).branch,branch);
  const first=attendancePetView({...change.pet,checkins:90},now),last=attendancePetView({...change.pet,checkins:290},now);
  assert.equal(first.branchLevel,1);assert.equal(last.branchLevel,21);assert.equal(last.maxed,true);
  const previousCap=attendancePetView({...change.pet,checkins:180},now);
  assert.equal(previousCap.level,19);assert.equal(previousCap.maxed,false,'old capped pets can continue growing without rewriting progress');
  assert.equal(attendancePetView(adjustAdminPet(change.pet,'level',29,now),now).branchLevel,20);
  assert.equal(attendancePetView(adjustAdminPet(change.pet,'level',30,now),now).level,30);
  const beyondFinal=attendancePetView(adjustAdminPet(change.pet,'level',31,now),now);
  assert.equal(beyondFinal.level,31);assert.equal(beyondFinal.form.name,stages.at(-1).name);
  assert.equal(beyondFinal.branchLevel,21);assert.equal(beyondFinal.maxed,true);
  assert.equal(beyondFinal.nextEvolutionIn,10,'leveling continues after the final form');

  assert.equal(attendancePetView({...change.pet,checkins:999},now).level,100);
  const switched=transitionAttendancePet({...change.pet,checkins:120},'branch:'+(branch==='bird'?'beast':'bird'),now);
  assert.equal(switched.pet.checkins,120);assert.equal(switched.pet.branch,branch);assert.equal(switched.changed,false);
 }
 const moves=new Set();
 const common=attendancePetCatalog(null).map((form,index)=>({form,level:index+1}));
 const branchMoves=Object.entries(ATTENDANCE_PET_BRANCHES).flatMap(([branch,data])=>data.forms.map((form,index)=>({form,level:10+index,branch})));
 for(const appearance of [...common,...branchMoves]){
  const label=petBattleSkill(appearance).label;
  assert.ok(!moves.has(label),'each evolution has its own attack name');
  moves.add(label);
 }
 const old={...pet,checkins:220};assert.equal(attendancePetView(old,now).level,9);assert.equal(old.checkins,220);
 assert.equal(attendancePetView(transitionAttendancePet(old,'branch:dino',now).pet,now).level,23);
 assert.equal(transitionAttendancePet(pet,'branch:__proto__',now).changed,false);
 const dead={...pet,branch:'fish',lastCheckinAt:now-73*3600000,bornAt:now-100*3600000};
 assert.equal(transitionAttendancePet(dead,'branch:bird',now).result,'dead');
 assert.equal(transitionAttendancePet(dead,'revive',now).pet.branch,null);
 assert.equal(adjustAdminPet(pet,'branch:beast',0,now).branch,'beast');
 assert.throws(()=>adjustAdminPet(pet,'level',10,now));
 assert.equal(petBattleBudget(30),150);
 assert.equal(petBattleBudget(31),151);
 assert.equal(petBattleBudget(32),152);
 assert.equal(petBattleBudget(31,true),130,'legacy allocations also gain one point per level after 30');
 const small=attendancePetView({...pet,branch:'bird',checkins:90},now),big=attendancePetView({...pet,branch:'fish',checkins:170},now);
 assert.ok(attendancePetScale(big)>attendancePetScale(small));
 const bounds=attendancePetTravelBounds(big,1366,768);assert.ok(bounds.maxY+104*attendancePetScale(big)<=768);
});

test('pet motion respects species, floor, sky and small viewport bounds', () => {
 const view=(kind,shape)=>({egg:false,dead:false,form:{kind,shape}});
 assert.equal(attendancePetMotion(view('fish','gold')),'swim');
 assert.equal(attendancePetMotion(view('dino','sea')),'swim');
 for(const shape of ['trex','dragon','baby']){
  const b=attendancePetTravelBounds(view('dino',shape),1366,768);
  assert.equal(b.mode,'walk');assert.equal(b.minY,b.maxY);
  assert.equal(b.maxY,768-104*attendancePetScale(view('dino',shape))-4);
 }
 const bird=attendancePetTravelBounds(view('bird','eagle'),1366,768);
 assert.equal(bird.mode,'fly');assert.ok(bird.maxY<768*.6);
 assert.equal(attendancePetMotion({...view('bird','eagle'),dead:true}),'rest');
 assert.equal(attendancePetMotion({...view('fish','gold'),egg:true}),'rest');
 for(const kind of ['fish','bird','dino']){const b=attendancePetTravelBounds(view(kind,'trex'),180,160);assert.ok(b.minY<=b.maxY);assert.ok(b.maxX>=b.minX);}
});

test('battle stats, RPS and automatic turn timeline are deterministic for both viewers', async () => {
 assert.equal(petBattleBudget(1),100);assert.equal(petBattleBudget(9),108);assert.equal(petBattleBudget(10),110);assert.equal(petBattleBudget(29),148);assert.equal(petBattleBudget(30),150);assert.equal(petBattleBudget(31),151);
 assert.throws(()=>petBattleStats({attack:100,defense:0,health:0},1));assert.throws(()=>petBattleStats({attack:34,defense:33,health:34},1));
 const players=[{uid:'a',stats:{attack:60,defense:20,health:20},appearance:{level:1}},{uid:'b',stats:{attack:20,defense:70,health:10},appearance:{level:1}}];
 assert.equal(petBattleRps('rock','scissors'),0);assert.equal(petBattleRps('paper','scissors'),1);assert.equal(petBattleRps('rock','rock'),null);
 const simulation=petBattleSimulation(players,'a');assert.equal(simulation.winnerUid,'a');assert.ok(simulation.turns.length>1&&simulation.turns.length<=240);
 simulation.turns.forEach((turn,index)=>{assert.equal(turn.attacker,index%2?'b':'a');assert.ok(turn.damage>=1);assert.ok(turn.hp.every(hp=>hp>=0));});
 const m={...simulation,startedAt:100000};assert.equal(petBattlePlayback(m,101999).count,0);assert.equal(petBattlePlayback(m,102000).count,1);
 assert.deepEqual(petBattlePlayback(m,105000),petBattlePlayback(JSON.parse(JSON.stringify(m)),105000));
 assert.equal(petBattlePlayback(m,102000+simulation.turns.length*1800).finished,true);
 assert.notEqual(await petBattleCommitment('id','a',0,'rock','nonce'),await petBattleCommitment('id','a',1,'rock','nonce'));
});

test('ten guardians keep unique mechanics and grant one percent only to advantaged affinities',()=>{
 const relationships=[
  ['water','metal','generates'],
  ['wood','fire','generates'],
  ['metal','wood','overcomes'],
  ['wood','water','overcomes'],
  ['water','fire','overcomes'],
  ['fire','metal','overcomes'],
 ];
 for(const [player,opponent,expected] of relationships)assert.equal(petBattleMatchup(player,opponent),expected,`${player} vs ${opponent}`);
 assert.equal(petBattleMatchup('metal','fire'),'','only one side gets a bonus for each elemental matchup');
 assert.equal(petBattleMatchup('kitsune','fire'),'','guardians with the same affinity do not get a matchup bonus');
 assert.equal(petBattleMatchup('centaur','wood'),'','Nhân Mã has no elemental matchup');
 assert.equal(petBattleSpirit('earth'),null);
 assert.equal(petBattleSpirit('sphinx'),null);
 assert.equal(petBattleMatchup('qilin','fire'),'','Kỳ Lân is neutral');
 const stats={attack:30,magic:20,defense:10,health:40};
 const boosted=petBattleEffectiveStats({element:'wood',stats},{element:'fire'});
 assert.deepEqual(boosted,{attack:30.3,magic:20.2,defense:10.1,health:40.4});
 assert.equal(petBattleReceivesBonus({element:'metal'},{element:'wood'}),true);
 assert.deepEqual(petBattleEffectiveStats({element:'metal',stats},{element:'wood'}),Object.fromEntries(Object.entries(stats).map(([key,value])=>[key,value*1.01])));
 assert.equal(petBattleReceivesBonus({element:'wood'},{element:'metal'}),false);
 assert.equal(petBattleEffectiveStats({element:'centaur',stats},{element:'metal'}),stats);
});

test('all ten selectable guardians have unique, accurately described abilities',()=>{
 const stats={attack:10,magic:10,defense:20,physicalReduction:10,magicReduction:10,dodge:10,luck:10,health:20};
 const fighter=(uid,element)=>({uid,petId:uid,element,stats,appearance:{level:1}});
 const guardians=['wood','fire','water','metal','kitsune','pixiu','griffin','cerberus','centaur','qilin'];
 assert.deepEqual(guardians.map(key=>petBattleSpirit(key).name),['Thanh Long','Chu Tước','Huyền Vũ','Bạch Hổ','Cửu Vĩ Hồ','Tỳ Hưu','Griffin','Cerberus','Nhân Mã','Kỳ Lân']);
 assert.equal(new Set(guardians.map(key=>petBattleSpirit(key).ability)).size,guardians.length);
 for(const guardian of guardians){
  const spirit=petBattleSpirit(guardian);
  assert.ok(spirit.passive.length>0&&spirit.ultimate.length>0&&spirit.icon.startsWith('bi-'));
  const battle=petBattleSimulation([fighter('a',guardian),fighter('b','wood')],'a');
  const ultimate=battle.turns.find(turn=>turn.special===guardian);
  assert.ok(ultimate,`${spirit.name} reaches its fourth-hit ultimate`);
  assert.equal(ultimate.specialIcon,spirit.icon);
 }
});

test('guardian balance stays within the target win-rate band across varied builds',()=>{
 const guardians=['wood','fire','water','metal','kitsune','pixiu','griffin','cerberus','centaur','qilin'];
 const profiles=[
  {attack:10,magic:10,defense:20,physicalReduction:10,magicReduction:10,dodge:10,luck:10,health:20},
  {attack:33,magic:5,defense:14,physicalReduction:5,magicReduction:14,dodge:5,luck:5,health:19},
  {attack:5,magic:33,defense:14,physicalReduction:14,magicReduction:5,dodge:5,luck:5,health:19},
  {attack:20,magic:20,defense:15,physicalReduction:8,magicReduction:8,dodge:8,luck:8,health:13}
 ];
 const scores=Object.fromEntries(guardians.map(key=>[key,{wins:0,matches:0}]));
 for(const [index,element] of guardians.entries())for(const [opponentIndex,opponentElement] of guardians.entries()){
  if(index===opponentIndex)continue;
  for(let profile=0;profile<profiles.length;profile++)for(let seed=0;seed<20;seed++){
   const players=[
    {uid:'a',petId:`${element}-${profile}-${seed}`,element,stats:profiles[profile],appearance:{level:1}},
    {uid:'b',petId:`${opponentElement}-${profile}-${seed}`,element:opponentElement,stats:profiles[(profile+1)%profiles.length],appearance:{level:1}}
   ];
   const winner=petBattleSimulation(players,seed%2?'a':'b',`balance-${profile}-${seed}`).winnerUid;
   if(!winner)continue;
   const winningGuardian=winner==='a'?element:opponentElement;
   scores[winningGuardian].wins++;
   scores[element].matches++;
   scores[opponentElement].matches++;
  }
 }
 for(const [guardian,{wins,matches}] of Object.entries(scores)){
  const winRate=wins/matches;
  assert.ok(winRate>=.35&&winRate<=.68,`${guardian} win rate ${(winRate*100).toFixed(1)}% is outside the 35–68% balance band`);
 }
});

test('all guardians stay deterministic and keep valid HP across varied builds',()=>{
 const profiles=[
  {attack:10,magic:10,defense:20,physicalReduction:10,magicReduction:10,dodge:10,luck:10,health:20},
  {attack:33,magic:5,defense:14,physicalReduction:5,magicReduction:14,dodge:5,luck:5,health:19},
  {attack:5,magic:33,defense:14,physicalReduction:14,magicReduction:5,dodge:5,luck:5,health:19}
 ];
 const guardians=['metal','wood','water','fire','kitsune','pixiu','griffin','cerberus','centaur','qilin'];
 for(let i=0;i<guardians.length;i++){
  const players=[
   {uid:'a',petId:`varied-a-${i}`,element:guardians[i],stats:profiles[i%profiles.length],appearance:{level:1}},
   {uid:'b',petId:`varied-b-${i}`,element:guardians[(i+1)%guardians.length],stats:profiles[(i+1)%profiles.length],appearance:{level:1}}
  ];
  const result=petBattleSimulation(players,i%2?'a':'b',`varied-${i}`);
  assert.deepEqual(result,petBattleSimulation(players,i%2?'a':'b',`varied-${i}`));
  assert.ok(result.turns.every(turn=>turn.hp.every((hp,index)=>Number.isFinite(hp)&&hp>=0&&hp<=result.maxHp[index])));
 }
});

test('guardian combat effects, durations and visible statuses follow the selected rules',()=>{
 const stats={attack:10,magic:10,defense:20,physicalReduction:10,magicReduction:10,dodge:10,luck:10,health:20};
 const fighter=(uid,element)=>({uid,petId:uid,element,stats,appearance:{level:1}});
 const battle=(a,b)=>petBattleSimulation([fighter('a',a),fighter('b',b)],'a');

 const dragon=battle('wood','metal'),dragonTurns=dragon.turns.filter(turn=>turn.attacker==='a');
 assert.equal(dragonTurns[0].special,undefined);
 assert.equal(dragonTurns[3].special,'wood','the fourth personal attack is the first ultimate');
 assert.ok(dragonTurns[3].healed>0&&dragonTurns[3].healed<=dragon.maxHp[0]*.04+.01,'Dragon heals four percent immediately');
 assert.ok(dragonTurns[4].healed>0&&dragonTurns[4].healed<=dragon.maxHp[0]*.02+.01,'Dragon heals two percent on the next turn');

 const phoenix=battle('fire','metal'),fireTurn=phoenix.turns.find(turn=>turn.special==='fire');
 assert.equal(fireTurn.burnTurns,3);
 assert.ok(fireTurn.burnApplied>=phoenix.maxHp[1]*.04,'Chu Tước starts with four-percent max-HP burn');
 assert.equal(fireTurn.statuses[1].burning,true,'burn is displayed on the affected pet');
 assert.equal(phoenix.turns.find(turn=>turn.index>fireTurn.index&&turn.attacker==='b'&&turn.burnDamage>0).burnDamage,Number((phoenix.maxHp[1]*.047).toFixed(2)),'first ultimate tick combines four-percent ultimate burn with two passive stacks');

 const turtle=battle('water','metal'),turtleTurn=turtle.turns.find(turn=>turn.special==='water');
 assert.ok(turtleTurn.shielded);
 const shieldHit=turtle.turns.find(turn=>turn.blocked);
 assert.equal(shieldHit.defender,'a');
 assert.ok(shieldHit.blockedDamage<=turtle.maxHp[0]*.12+.01);

 const tiger=battle('metal','wood'),tigerTurn=tiger.turns.find(turn=>turn.special==='metal');
 assert.equal(tigerTurn.specialName,petBattleSpirit('metal').move);
 const tigerNext=tiger.turns.find(turn=>turn.attacker==='a'&&turn.index>tigerTurn.index&&turn.damage>0);
 assert.equal(tigerNext.critical,true,'Bạch Hổ guarantees a critical on the next landed attack');
 const fox=battle('kitsune','wood'),foxUltimate=fox.turns.find(turn=>turn.special==='kitsune');
 assert.equal(foxUltimate.statuses[0].evasion,true,'Cửu Vĩ Hồ shows its active evasion');
 const pixiu=battle('pixiu','wood'),pixiuUlt=pixiu.turns.find(turn=>turn.special==='pixiu');
 assert.equal(pixiuUlt.hits,undefined);
 assert.equal(pixiu.turns[2].statuses[0].charged,true,'Tỳ Hưu visibly accumulates damage before releasing it');
 const griffin=battle('griffin','wood'),griffinUlt=griffin.turns.find(turn=>turn.special==='griffin');
 assert.equal(griffinUlt.statuses[1].armorBroken,true,'Griffin exposes the opponent armor');
 const cerberus=battle('cerberus','wood'),cerberusUlt=cerberus.turns.find(turn=>turn.special==='cerberus');
 assert.equal(cerberusUlt.hits.length,3,'Cerberus ultimate resolves as three individual bites');
 assert.equal(cerberusUlt.statuses[1].healingBlocked,true,'Cerberus reduces the target healing');
 const centaur=battle('centaur','wood'),centaurUlt=centaur.turns.find(turn=>turn.special==='centaur');
 assert.equal(centaurUlt.statuses[0].guarded,true,'Nhân Mã displays its shield');
 const qilin=battle('qilin','wood'),qilinUlt=qilin.turns.find(turn=>turn.special==='qilin');
 assert.equal(qilinUlt.statuses[0].reflecting,true,'Kỳ Lân displays its passive reflection');
 assert.ok(qilin.turns.some(turn=>turn.reflectedDamage>0),'Kỳ Lân reflects a portion of damage actually taken');
 assert.equal(qilin.turns.find(turn=>turn.reflectedDamage>0).reflectedDamage,Number((qilin.turns.find(turn=>turn.reflectedDamage>0).damage*.14).toFixed(2)),'passive reflection is fourteen percent and cannot be critical');
 assert.ok(qilin.turns.find(turn=>turn.index>qilinUlt.index&&turn.reflectedDamage>0).reflectedDamage>qilin.turns.find(turn=>turn.reflectedDamage>0).reflectedDamage,'ultimate increases reflection for two opponent attacks');
 assert.equal(petBattleSkill({form:{kind:'dino'},level:30,branch:'dino'},'metal',true).label,'Hổ Gầm Trời');
});

test('four-element relationships resolve across every unique matchup',()=>{
 const profiles=[
  {attack:10,magic:10,defense:20,physicalReduction:10,magicReduction:10,dodge:10,luck:10,health:20},
  {attack:33,magic:5,defense:14,physicalReduction:5,magicReduction:14,dodge:5,luck:5,health:19},
  {attack:5,magic:33,defense:14,physicalReduction:14,magicReduction:5,dodge:5,luck:5,health:19}
 ];
 const elements=['wood','fire','water','metal'];
 for(let x=0;x<elements.length;x++)for(let y=x+1;y<elements.length;y++){
  for(let i=0;i<profiles.length;i++){
   const players=[
    {uid:'a',petId:`four-a-${x}-${y}-${i}`,element:elements[x],stats:profiles[i],appearance:{level:1}},
    {uid:'b',petId:`four-b-${x}-${y}-${i}`,element:elements[y],stats:profiles[(i+1)%profiles.length],appearance:{level:1}}
   ];
   const result=petBattleSimulation(players,'a',`four-${x}-${y}-${i}`);
   assert.ok(result.turns.length>0&&result.turns.at(-1).hp.every(hp=>Number.isFinite(hp)&&hp>=0));
  }
 }
});

test('eight battle stats split damage and produce reproducible dodge and critical turns',()=>{
 const stats={attack:20,magic:20,defense:10,physicalReduction:10,magicReduction:10,dodge:10,luck:10,health:10};
 assert.equal(Object.keys(petBattleStats(stats,1)).length,8);
 assert.equal(petBattleStats({...stats,magic:19},1).magic,19);
 assert.equal(petBattleMaxHp(stats),590,'duel HP starts at 500 and adds nine per health point');
 assert.equal(petBattlePower(stats,{level:30,branch:'fish'}),petBattlePower(stats));
 assert.equal(petBattleMaxHp(stats,{level:8,branch:'fish'}),590);
 assert.equal(petBattleMaxHp(stats,{level:9,branch:'fish'}),1090);
 assert.equal(petBattleMaxHp(stats,{level:30,branch:'fish'}),2590);
 assert.throws(()=>petBattleStats({...stats,magic:21},1));assert.throws(()=>petBattleStats({...stats,dodge:0,health:20},1));
 const players=[{uid:'a',stats,appearance:{level:1}},{uid:'b',stats:{...stats},appearance:{level:1}}];
 const battle=petBattleSimulation(players,'a');assert.deepEqual(battle,petBattleSimulation(JSON.parse(JSON.stringify(players)),'a'));
 const seeded=petBattleSimulation(players,'a','room-1');
 assert.deepEqual(seeded,petBattleSimulation(players,'a','room-1'));
 assert.notDeepEqual(seeded.turns,petBattleSimulation(players,'a','room-2').turns);
 let sawDodge=false,sawCritical=false;
 for(let i=0;i<60;i++){
  const result=petBattleSimulation([{...players[0],petId:String(i)},players[1]],'a');
  let hp=[...result.maxHp];for(const turn of result.turns){const defender=turn.defender==='a'?0:1;
   if(turn.dodged){sawDodge=true;assert.equal(turn.damage,0);assert.equal(turn.hp[defender],hp[defender]);}
   else {assert.ok(turn.physical>0&&turn.magic>0);assert.ok(Math.abs(turn.damage-Math.max(1,Math.round(turn.physical+turn.magic)))<=1);}
   if(turn.critical&&!turn.dodged)sawCritical=true;
   assert.ok(turn.hp.every(value=>value>=0));hp=turn.hp;
  }
 }
 assert.ok(sawDodge&&sawCritical);
 const changed=petBattleSimulation([{...players[0],stats:{...stats,attack:1,magic:39}},players[1]],'a');
 const hit=changed.turns.find(t=>t.attacker==='a'&&!t.dodged);assert.ok(hit.magic>hit.physical,'magic build deals predominantly magic damage');
 const resistant=petBattleSimulation([players[0],{...players[1],stats:{...stats,physicalReduction:19,magicReduction:1}}],'a').turns.find(t=>t.attacker==='a'&&!t.dodged);
 const baseHit=battle.turns.find(t=>t.attacker==='a'&&!t.dodged);
 assert.ok(resistant.physical/(resistant.critical?1.5:1)<baseHit.physical/(baseHit.critical?1.5:1),'physical resistance specifically reduces physical damage');
 assert.ok(resistant.magic/(resistant.critical?1.5:1)>baseHit.magic/(baseHit.critical?1.5:1),'lower magic resistance allows more magic damage');
});


test('battle power does not reward a health-only allocation over a stronger damage build',()=>{
 const damageBuild={attack:72,magic:10,defense:5,magicReduction:3,physicalReduction:3,dodge:3,luck:3,health:1};
 const healthBuild={attack:1,magic:1,defense:1,magicReduction:1,physicalReduction:1,dodge:1,luck:1,health:93};
 assert.ok(petBattlePower(damageBuild)>petBattlePower(healthBuild),'power ranking should favor the build that can actually deal damage');
 let wins=0;const matches=300;
 for(let i=0;i<matches;i++){
  const result=petBattleSimulation([
   {uid:'damage',petId:`damage-${i}`,stats:damageBuild,appearance:{level:1}},
   {uid:'health',petId:`health-${i}`,stats:healthBuild,appearance:{level:1}}
  ],i%2?'damage':'health');
  if(result.winnerUid==='damage')wins++;
 }
 assert.ok(wins/matches>=.9,`damage-focused higher-power build won ${wins}/${matches}`);
});

test('Bot difficulty keeps its stake and EXP reward consistent across modes',()=>{
 const easy=makePetBattleBot(18,'easy'),medium=makePetBattleBot(18,'medium'),hard=makePetBattleBot(18,'hard');
 const total=bot=>Object.values(bot.stats).reduce((sum,value)=>sum+value,0);
 assert.equal(total(easy),100);assert.equal(total(medium),108);assert.equal(total(hard),120);
 const extreme=makePetBattleBot(18,'extreme');
 assert.equal(total(extreme),150);
 assert.equal(extreme.appearance.level,30);
 assert.doesNotThrow(()=>petBattleSimulation([{...easy,uid:'player-a'},extreme],'player-a'));
 assert.deepEqual([easy.appearance.level,medium.appearance.level,hard.appearance.level],[1,9,15]);
 assert.equal(easy.petName,attendancePetCatalog(null)[0].name);assert.equal(medium.petName,attendancePetCatalog(null)[8].name);
 assert.ok(easy.stats.attack>1&&easy.stats.magic>1&&easy.stats.health>1,'Bot uses a purposeful combat allocation rather than random points');
 assert.deepEqual([easy.stakeGrams,medium.stakeGrams,hard.stakeGrams],[200,300,400]);
 assert.deepEqual([easy.stakeXp,medium.stakeXp,hard.stakeXp],[1,1,1]);
 assert.deepEqual([easy.rewardMultiplier,medium.rewardMultiplier,hard.rewardMultiplier],[1,1,1]);
 assert.doesNotThrow(()=>petBattleSimulation([{...easy,uid:'player-a'},hard],'player-a'));
 for(const [difficulty,budget,stake] of [['easy',100,200],['medium',108,300],['hard',120,400],['extreme',150,600]]){
  const first=makePetBattleBot(18,difficulty,1),second=makePetBattleBot(18,difficulty,2);
  assert.notEqual(first.name,second.name,`${difficulty} reroll changes the Bot identity`);
  assert.notEqual(first.element,second.element,`${difficulty} reroll changes the guardian`);
  assert.notDeepEqual(first.stats,second.stats,`${difficulty} reroll changes the stat allocation`);
  for(const bot of [first,second]){
   assert.equal(total(bot),budget);
   assert.equal(bot.stakeGrams,stake);
   assert.equal(bot.stakeXp,1);
  }
 }
});

test('two-client battle escrow, hidden RPS, automatic fight, payout and refunds commit atomically once', async () => {
 let clock=Date.UTC(2026,10,20),writes=0,reads=0;const profiles=new Map(),battles=new Map(),nodes=new Map();
 for(const uid of ['a','b'])profiles.set(uid,{uid,displayName:uid,attendancePet:{...newAttendancePet(clock-7200000),weightGrams:1000,feedingXp:uid==='b'?1:0,lastCheckinAt:clock,lastCheckinDay:attendancePetDay(clock)}});
 class Clock extends Date{constructor(...args){super(...(args.length?args:[clock]));}static now(){return clock;}}
 const context={PET_CLOUD_ENABLED:false,Date:Clock,Math,Map,Set,Number,Object,Array,JSON,Promise,Infinity,crypto:globalThis.crypto,TextEncoder,PET_BATTLE_STEP_MS:1800,
  db:{},currentUser:{uid:'a'},attendancePetRef:{collection:'users',id:'a'},authenticatedProfileSnapshot:null,attendancePetData:profiles.get('a').attendancePet,
  document:{getElementById:id=>{if(!nodes.has(id))nodes.set(id,{open:false,hidden:true,textContent:'',dataset:{},close(){this.open=false;}});return nodes.get(id);}},
  usersDirectorySnapshot:{docs:['a','b'].map(id=>({id,data:()=>structuredClone(profiles.get(id))}))},
  doc:(_,collection,id)=>({collection,id}),onSnapshot:()=>()=>{},serverTimestamp:()=>clock,todayKey:()=>new Date(clock).toISOString().slice(0,10),assertPetQuotaAvailable(){},petQuotaErrorText:()=>'',renderAttendancePet(){},setInterval:()=>1,clearInterval(){},
  attendancePetRecords,attendancePetSelected,attendancePetView,petWeightLabel:g=>g/1000+' kg',petPowerLabel:value=>String(value),petBattleBudget,petBattleStats,petBattlePower,petBattleRps,petBattleSimulation,petBattlePlayback,petBattleTime:v=>Number(v)||0,petBattleChangeWeight,petBattleFighter,petBattleClaimAmount,petBattleSettleXp,petBattleCompletePet,makePetBattleBot,petBattleCommitment,
  runTransaction:async(_,callback)=>{const pending=[];const tx={get:async ref=>{reads++;const data=(ref.collection==='users'?profiles:battles).get(ref.id);return {exists:()=>!!data,data:()=>structuredClone(data)};},set:(ref,data)=>pending.push({ref,data,merge:false}),update:(ref,data)=>pending.push({ref,data,merge:true})};const result=await callback(tx);for(const p of pending){const store=p.ref.collection==='users'?profiles:battles;store.set(p.ref.id,p.merge?{...store.get(p.ref.id),...structuredClone(p.data)}:structuredClone(p.data));writes++;}return result;}
 };
 const source=fs.readFileSync('app.js','utf8');let code=source.slice(source.indexOf('const PetBattleGame='),source.indexOf('let sharedNotesUnsubscribe ='));
 code=code.replace('return {init,start,stop,sync,profile,open};','return {init,start,stop,sync,profile,open,mutate,mutateBot,inspect:()=>state};');
 vm.createContext(context);vm.runInContext(code+';globalThis.game=PetBattleGame;',context);const game=context.game;
 const use=(uid,id='')=>{context.currentUser={uid};context.attendancePetRef={collection:'users',id:uid};context.attendancePetData=profiles.get(uid).attendancePet;const st=game.inspect();st.uid=uid;st.own=structuredClone(profiles.get(uid));st.active=id;st.cooldown=0;};
 const statsA={attack:60,defense:20,health:20},statsB={attack:20,defense:70,health:10};
 const payload=(uid,stats)=>({opponentUid:uid==='a'?'b':'a',petId:attendancePetRecords(profiles.get(uid).attendancePet,clock)[0].id,stats,stakeGrams:200});
 use('a');await game.mutate('create',payload('a',statsA));const firstId=game.inspect().active;
 assert.equal(profiles.get('a').petBattleStatsByPet[attendancePetRecords(profiles.get('a').attendancePet,clock)[0].id].attack,60,'the Firestore battle saves selected stats for ranking');
 use('a',firstId);await game.mutate('cancel',{},firstId);
 use('a');await game.mutate('create',payload('a',statsA));const id=game.inspect().active;
 assert.notEqual(id,firstId,'a new invite can be sent immediately after cancelling the previous one');
 assert.equal(battles.size,2);assert.equal(attendancePetView(profiles.get('a').attendancePet,clock).weightGrams,800);assert.equal(writes,6);
 const beforeRepeat=writes;await game.mutate('create',payload('a',statsA));assert.equal(writes,beforeRepeat,'same pet cannot reserve a second bet');
 use('b',id);await game.mutate('accept',payload('b',statsB));assert.equal(attendancePetView(profiles.get('b').attendancePet,clock).weightGrams,800);
 const hashA=await petBattleCommitment(id,'a',0,'rock','secret-a'),hashB=await petBattleCommitment(id,'b',0,'scissors','secret-b');
 use('a',id);await game.mutate('commit',{hash:hashA,round:0});assert.equal(battles.get(id).reveals.a,undefined,'commits do not publish the move');
 use('b',id);await game.mutate('commit',{hash:hashB,round:0});
 use('a',id);const beforeForged=writes;await game.mutate('reveal',{choice:'paper',nonce:'secret-a',hash:hashA,round:0});assert.equal(writes,beforeForged,'reveal recomputes the commitment instead of trusting a supplied hash');
 await game.mutate('reveal',{choice:'rock',nonce:'secret-a',hash:hashA,round:0});
 use('b',id);await game.mutate('reveal',{choice:'scissors',nonce:'secret-b',hash:hashB,round:0});
 let m=battles.get(id);assert.equal(m.status,'fighting');assert.equal(m.firstUid,'a');assert.equal(m.winnerUid,'a');
 assert.equal(m.introMs,5000);assert.equal(petBattlePlayback(m,clock+4999).count,0,'RPS result is displayed before automatic attacks');
 const writesDuringFight=writes;clock+=5000+m.turns.length*1800+1;assert.equal(writes,writesDuringFight,'no writes occur per automatic turn');
 use('a',id);await game.mutate('claim');assert.equal(attendancePetView(profiles.get('a').attendancePet,clock).weightGrams,1200);
 const auraUntil=profiles.get('a').attendancePet.victoryAuraUntil;
 assert.equal(auraUntil,m.startedAt+5000+m.turns.length*1800+10800000,'aura expires three hours from combat end, not claim or refresh');
 const claimed=writes;await game.mutate('claim');assert.equal(writes,claimed,'refresh/double claim cannot pay twice');
 assert.equal(profiles.get('a').attendancePet.victoryAuraUntil,auraUntil,'repeat claim never extends aura');
 use('b',id);await game.mutate('claim');assert.equal(attendancePetView(profiles.get('b').attendancePet,clock).weightGrams,800);
 assert.deepEqual(battles.get(id).xpChanges,{a:1,b:-1});
 for(const [uid,result,opponentName,xpDelta,weightDelta] of [['a','win','b',1,200],['b','loss','a',-1,-200]]){
  const history=profiles.get(uid).attendancePet.battleHistory;
  assert.equal(history.length,1);
  assert.deepEqual(history.map(({id:matchId,result,opponentName,xpDelta,weightDelta})=>[matchId,result,opponentName,xpDelta,weightDelta]),[[id,result,opponentName,xpDelta,weightDelta]]);
 }
 assert.equal(attendancePetView(profiles.get('a').attendancePet,clock).xp,1);
 const loserView=attendancePetView(profiles.get('b').attendancePet,clock);
 assert.equal(loserView.xp,0);assert.equal(loserView.feedingXp,1);
 assert.equal(petBattleSettleXp(profiles.get('b').attendancePet,loserView.pet.id,-1,clock).change,0);
 const nearLevelUp={...profiles.get('a').attendancePet,feedingXp:8};
 const petId=attendancePetRecords(nearLevelUp,clock)[0].id;
 const promoted=petBattleSettleXp(nearLevelUp,petId,1,clock).pet;
 assert.equal(attendancePetView(promoted,clock).xp,10);
 assert.equal(attendancePetView(promoted,clock).level,2);
 const demoted=petBattleSettleXp(promoted,petId,-1,clock).pet;
 assert.equal(attendancePetView(demoted,clock).xp,9);
 assert.equal(attendancePetView(demoted,clock).level,1);
 assert.equal(profiles.get('b').attendancePet.victoryAuraUntil,undefined,'loser does not receive victory aura');
 assert.equal(profiles.get('b').attendancePet.defeatAuraUntil,auraUntil,'defeat aura expires three hours after combat ends');
 assert.equal(profiles.get('b').attendancePet.defeatOpponentName,'a');
 assert.equal(attendancePetView(profiles.get('a').attendancePet,clock).weightGrams+attendancePetView(profiles.get('b').attendancePet,clock).weightGrams,2000,'kg is conserved');
 for(const uid of ['a','b'])assert.equal(Object.keys(profiles.get(uid).petBattleLocks).length,0);
 use('a');await game.mutate('create',payload('a',statsA));const cancelled=game.inspect().active;await game.mutate('cancel');assert.equal(battles.get(cancelled).status,'cancelled');assert.equal(attendancePetView(profiles.get('a').attendancePet,clock).weightGrams,1200);
 use('a');await game.mutate('create',payload('a',statsA));const expired=game.inspect().active;use('b',expired);await game.mutate('accept',payload('b',statsB));
 const tieA=await petBattleCommitment(expired,'a',0,'paper','tie-a'),tieB=await petBattleCommitment(expired,'b',0,'paper','tie-b');
 use('a',expired);await game.mutate('commit',{hash:tieA,round:0});use('b',expired);await game.mutate('commit',{hash:tieB,round:0});
 use('a',expired);await game.mutate('reveal',{choice:'paper',nonce:'tie-a',round:0});use('b',expired);await game.mutate('reveal',{choice:'paper',nonce:'tie-b',round:0});
 assert.equal(battles.get(expired).rpsRound,1);assert.deepEqual(battles.get(expired).commits,{});assert.equal(battles.get(expired).status,'rps','tied RPS opens a fresh committed round');clock+=120001;
 use('a',expired);await game.mutate('claim');use('b',expired);await game.mutate('claim');assert.equal(battles.get(expired).status,'expired');
 assert.equal(battles.get(expired).xpChanges,undefined,'expired matches do not award or deduct EXP');
 assert.equal(profiles.get('a').attendancePet.battleHistory.length,1,'expired matches do not add history');
 assert.equal(attendancePetView(profiles.get('a').attendancePet,clock).weightGrams,1200);assert.equal(attendancePetView(profiles.get('b').attendancePet,clock).weightGrams,800);
 const beforeBad=writes;use('a');await game.mutate('create',{...payload('a',statsA),stakeGrams:999999});assert.equal(writes,beforeBad,'failed reservation writes neither profile nor match');
 const roomReads=reads,roomWrites=writes;
 use('a');await game.mutate('create',{...payload('a',statsA),roomFlow:true});const room=game.inspect().active;
 use('b',room);await game.mutate('accept',payload('b',statsB));
 assert.equal(battles.get(room).status,'ready');
 assert.equal(battles.get(room).players.length,2);
 use('a',room);await game.mutate('ready');
 assert.deepEqual(battles.get(room).ready,{a:true});
 assert.equal(battles.get(room).startedAt,null,'one ready player cannot start the match');
 const readyWrites=writes;await game.mutate('ready');assert.equal(writes,readyWrites);
 use('b',room);await game.mutate('ready');
 m=battles.get(room);
 assert.equal(m.status,'rps');assert.deepEqual(m.ready,{a:true,b:true});
 assert.equal(m.startedAt,null,'both ready players enter rock paper scissors before combat');
 const roomHashA=await petBattleCommitment(room,'a',0,'rock','room-a'),roomHashB=await petBattleCommitment(room,'b',0,'scissors','room-b');
 use('a',room);await game.mutate('commit',{hash:roomHashA,round:0});use('b',room);await game.mutate('commit',{hash:roomHashB,round:0});
 use('a',room);await game.mutate('reveal',{choice:'rock',nonce:'room-a',round:0});use('b',room);await game.mutate('reveal',{choice:'scissors',nonce:'room-b',round:0});
 m=battles.get(room);assert.equal(m.status,'fighting');assert.equal(m.firstUid,'a');assert.equal(m.startedAt,clock);
 assert.deepEqual(m.turns,petBattleSimulation(m.players,m.firstUid,room).turns);
 const startedWrites=writes;await game.mutate('ready');assert.equal(writes,startedWrites);
 clock+=5000+m.turns.length*1800+1;
 use('a',room);await game.mutate('claim');
 use('b',room);await game.mutate('claim');
 assert.deepEqual(battles.get(room).claims,{a:true,b:true});
 assert.equal(reads-roomReads,14,'a complete room includes four bounded rock-paper-scissors transaction reads');
 assert.equal(writes-roomWrites,14,'one room includes four rock-paper-scissors writes and both payouts');
 const priorWeights=['a','b'].map(uid=>attendancePetView(profiles.get(uid).attendancePet,clock).weightGrams);
 use('a');await game.mutate('create',{...payload('a',statsA),roomFlow:true});const waiting=game.inspect().active;
 use('b',waiting);await game.mutate('accept',payload('b',statsB));await game.mutate('ready');
 clock=battles.get(waiting).readyDeadline;
 use('a',waiting);await game.mutate('ready');assert.equal(battles.get(waiting).startedAt,null);
 await game.mutate('claim');use('b',waiting);await game.mutate('claim');
 assert.equal(battles.get(waiting).status,'expired');
 assert.deepEqual(['a','b'].map(uid=>attendancePetView(profiles.get(uid).attendancePet,clock).weightGrams),priorWeights);
 use('a');const weightBeforeBot=profiles.get('a').attendancePet.weightGrams,beforeLegacyBot=writes;
 const botState=game.inspect(),botPet=attendancePetRecords(profiles.get('a').attendancePet,clock)[0];
 botState.bot=makePetBattleBot(attendancePetView(botPet,clock).level,'easy');botState.botDifficulty='easy';
 await game.mutateBot('start',{...payload('a',statsA),element:'fire'});
 const botId=game.inspect().active,botMatch=game.inspect().matches.get(botId);
 assert.equal(writes,beforeLegacyBot+1,'Bot start writes only the daily difficulty counter');
 assert.equal(profiles.get('a').attendancePet.weightGrams,weightBeforeBot);
 clock+=2000+botMatch.turns.length*1800+1;
 use('a',botId);await game.mutateBot('claim',{},botId);
 const settledWeight=attendancePetView(profiles.get('a').attendancePet,clock).weightGrams;
 const expectedDelta=botMatch.winnerUid==='a'?botMatch.stakeGrams*botMatch.rewardMultiplier:botMatch.winnerUid?-botMatch.stakeGrams:0;
 assert.equal(settledWeight,weightBeforeBot+expectedDelta,'one Firestore transaction settles the local simulation');
 assert.equal(writes,beforeLegacyBot+2);
 const afterBotClaim=writes;await game.mutateBot('claim',{},botId);
 assert.equal(writes,afterBotClaim,'the profile marker prevents an ordinary duplicate claim');
});

test('cloud pets migrate once and the server settles both profiles once without connected players', async () => {
 const source=fs.readFileSync('pet-cloud.mjs','utf8');
 const documents=new Map(),removed=Symbol('delete'),commits=[];
 let clock=Date.UTC(2026,10,22),queue=Promise.resolve();
 class Clock extends Date { static now(){return clock;} }
 class HttpsError extends Error { constructor(code,message){super(message);this.code=code;} }
 const ref=path=>({id:path.split('/').at(-1),path,get:async()=>snapshot(ref(path)),create:async value=>{
  assert.equal(documents.has(path),false);documents.set(path,structuredClone(value));
 },collection:name=>collection(path+'/'+name)});
 const snapshot=reference=>({id:reference.id,ref:reference,exists:documents.has(reference.path),data:()=>structuredClone(documents.get(reference.path))});
 const collection=prefix=>({doc:id=>ref(prefix+'/'+id),where:(key,op,value)=>{
  const target={select:()=>target,get:async()=>({docs:[...documents.keys()].filter(path=>path.startsWith(prefix+'/')&&path.split('/').length===2)
   .map(path=>snapshot(ref(path))).filter(doc=>op==='=='?doc.data()[key]===value:doc.data()[key]>value)})};
  return target;
 }});
 const db={runTransaction:callback=>{
  const transaction=queue.then(async()=>{
   const pending=[];
   const result=await callback({
    get:async target=>{assert.equal(pending.length,0,'Firestore transactions read before writing');return target.path?snapshot(target):target.get();},
    create:(target,patch)=>pending.push({target,patch,create:true}),
    update:(target,patch)=>pending.push({target,patch,update:true}),
    set:(target,patch)=>pending.push({target,patch})
   });
   for(const {target,patch,create,update} of pending){
    if(create)assert.equal(documents.has(target.path),false);
    if(update)assert.equal(documents.has(target.path),true);
    const next=update?{...documents.get(target.path)}:{};
    for(const [key,value] of Object.entries(patch)){if(value===removed)delete next[key];else next[key]=structuredClone(value);}
    documents.set(target.path,next);
   }
   if(pending.length)commits.push(pending.map(item=>item.target.path));
   return result;
  });
  queue=transaction.catch(()=>{});
  return transaction;
 }};
 const context={db,profiles:collection('petProfiles'),battles:collection('petCloudBattles'),legacy:collection('users'),
  Date:Clock,HttpsError,FieldValue:{delete:()=>removed},randomUUID:()=>String(commits.length),randomInt:()=>0,
  ATTENDANCE_PET_BRANCHES,attendancePetActivityTime,attendancePetRecords,attendancePetView,buildPetComparison,petBattleBudget,petBattlePower,
  transitionPetHousehold,petBattleFighter,petBattleChangeWeight,petBattleSimulation,petBattleSettleXp,
  petBattleCompletePet,makePetBattleBot,petBattleTime:value=>Number(value)||0,PET_BATTLE_STEP_MS:1800,
  week:7*86400000,pageSize:20,botDailyLimit:5,rankingCache:undefined};
 vm.createContext(context);
 vm.runInContext(source.slice(source.indexOf('function requireId'),source.indexOf('export const workpicPets'))+
  '\nglobalThis.cloud={openProfile,care,battle,settle,deadline,ranking,botBattle};',context);
 const {openProfile,battle,settle,deadline,ranking,botBattle}=context.cloud;
 for(const uid of ['a','b'])documents.set('users/legacy-'+uid,{uid,displayName:uid.toUpperCase(),avatar:'keep',attendancePet:{
  ...newAttendancePet(clock-7200000),lastCheckinAt:clock,weightGrams:1000,feedingXp:uid==='b'?1:0}});
 const [a,b]=await Promise.all([openProfile('a'),openProfile('b')]);
 assert.equal(documents.get('users/legacy-a').attendancePet,undefined);
 assert.equal(documents.get('users/legacy-a').avatar,'keep');
 const beforeReopen=commits.length;await openProfile('a');assert.equal(commits.length,beforeReopen);
 const player=(profile,stats)=>({petId:attendancePetRecords(profile.attendancePet,clock)[0].id,element:'water',stats});
 const created=await battle('a',{action:'create',opponentUid:'b',stakeGrams:200,...player(a,{attack:60,defense:20,health:20})});
 const id=created.match.id;
 const accepted=await battle('b',{action:'accept',id,...player(b,{attack:20,defense:70,health:10})});
 assert.equal(documents.get('petProfiles/a').petBattleStatsByPet[created.match.players[0].petId].attack,60,'cloud battle stores selected stats for power ranking');
 assert.equal(documents.get('petProfiles/b').petBattleStatsByPet[accepted.match.players[1].petId].health,10);
 await battle('a',{action:'ready',id});
 const {match}=await battle('b',{action:'ready',id});
 assert.equal(match.status,'fighting');
 assert.equal(match.winnerUid,'a');
 const end=deadline(match);
 await assert.rejects(settle(id,end),/before the match deadline/);
 clock=end;
 const beforeSettle=commits.length;
 await Promise.all([settle(id,end),settle(id,end)]);
 assert.equal(commits.length,beforeSettle+1);
 assert.deepEqual(commits.at(-1),['petProfiles/a','petProfiles/b','petCloudBattles/'+id]);
 const winner=documents.get('petProfiles/a'),loser=documents.get('petProfiles/b');
 assert.equal(winner.attendancePet.weightGrams,1200);
 assert.equal(loser.attendancePet.weightGrams,800);
 assert.equal(winner.attendancePet.battleHistory[0].xpDelta,1);
 assert.equal(loser.attendancePet.battleHistory[0].xpDelta,-1);
 assert.equal(loser.attendancePet.battleHistory[0].weightDelta,-200);
 assert.deepEqual(winner.petBattleLocks,{});
 assert.deepEqual(loser.petBattleLocks,{});
 const page=await ranking({});
 assert.equal(page.rows[0].uid,'a');
 assert.ok(!Object.hasOwn(page.rows[0],'battleHistory'));
 const botPet=attendancePetRecords(winner.attendancePet,clock)[0];
 const startWeight=attendancePetView(winner.attendancePet,clock).weightGrams;
 const started=await botBattle('a',{action:'start',petId:botPet.id,stats:{attack:30,magic:20,defense:10,magicReduction:10,physicalReduction:10,dodge:5,luck:5,health:10},element:'fire',stakeGrams:200,difficulty:'hard'});
 const botId=started.match.id,botRecord=documents.get(`petCloudBattles/${botId}`);
 assert.deepEqual([botRecord.stakeGrams,botRecord.stakeXp,botRecord.rewardMultiplier],[400,1,1],'hard Bot uses 0.4 kg and one EXP without a bonus multiplier');
 assert.equal(documents.get('petProfiles/a').petBotDailyBattles.hard,1,'Bot match increments the daily difficulty counter atomically');
 assert.equal(started.match.turns,undefined,'the local client receives setup, not the authoritative timeline');
 assert.equal(started.match.winnerUid,undefined);
 assert.equal(attendancePetView(documents.get('petProfiles/a').attendancePet,clock).weightGrams,startWeight,'starting a Bot match does not mutate pet rewards');
 const botEnd=deadline(botRecord);clock=botEnd;
 const beforeBotClaim=commits.length;
 await botBattle('a',{action:'claim',id:botId});
 assert.equal(commits.length,beforeBotClaim+1,'Bot reward and match claim settle in one transaction');
 assert.deepEqual(commits.at(-1),['petProfiles/a',`petCloudBattles/${botId}`]);
 const expectedDelta=botRecord.winnerUid==='a'?botRecord.stakeGrams*botRecord.rewardMultiplier:botRecord.winnerUid?-botRecord.stakeGrams:0;
 assert.equal(attendancePetView(documents.get('petProfiles/a').attendancePet,clock).weightGrams,startWeight+expectedDelta);
 for(let attempt=0;attempt<4;attempt++)await botBattle('a',{action:'start',petId:botPet.id,stats:{attack:30,magic:20,defense:10,magicReduction:10,physicalReduction:10,dodge:5,luck:5,health:10},element:'fire',difficulty:'hard'});
 await assert.rejects(botBattle('a',{action:'start',petId:botPet.id,stats:{attack:30,magic:20,defense:10,magicReduction:10,physicalReduction:10,dodge:5,luck:5,health:10},element:'fire',difficulty:'hard'}),/5 trận Bot hôm nay/,'the fifth daily match is allowed and the sixth is blocked');
 const afterBotClaim=commits.length;
 await botBattle('a',{action:'claim',id:botId});
 assert.equal(commits.length,afterBotClaim,'a duplicate Bot claim cannot settle twice');
});

test('admin actions affect only their own fields and unchanged choices do not produce a write', () => {
 const now=Date.UTC(2026,10,20),pet={...newAttendancePet(now-100*3600000),branch:'fish',checkins:100,lastCheckinAt:now-73*3600000,lastCheckinDay:'2026-11-16',feeds:5,weightGrams:1000};
 const leveled=adjustAdminPet(pet,'level',14,now);
 assert.equal(attendancePetView(leveled,now).level,14);assert.equal(attendancePetView(leveled,now).dead,true,'level selection cannot revive');
 for(const field of ['branch','lastCheckinAt','lastCheckinDay','feeds','lastFedAt'])assert.equal(leveled[field],pet[field],field+' stays unchanged');
 const branched=adjustAdminPet(pet,'branch:bird',0,now);
 assert.equal(branched.branch,'bird');assert.equal(branched.checkins,pet.checkins);assert.equal(branched.lastCheckinAt,pet.lastCheckinAt);assert.equal(branched.hatchAt,pet.hatchAt);
 const egg=newAttendancePet(now),eggBranch=adjustAdminPet(egg,'branch:dino',0,now);
 assert.equal(eggBranch.hatchAt,egg.hatchAt);assert.equal(eggBranch.checkins,0);assert.equal(eggBranch.lastCheckinAt,null);
 assert.equal(adjustAdminPet(pet,'level',11,now),pet,'same level is a no-op');
 assert.equal(adjustAdminPet(pet,'branch:fish',0,now),pet,'same branch is a no-op');
 assert.equal(adjustAdminPet(egg,'egg',0,now),egg,'egg reset does not restart an existing incubation');
 const alive={...pet,lastCheckinAt:now};assert.equal(adjustAdminPet(alive,'revive',0,now),alive);
 const root={...alive,companions:[],attendanceDay:attendancePetDay(now),attendanceAt:now};
 assert.equal(transitionPetHousehold(root,'level',now,null,11).changed,false,'unchanged transaction does not request a write');
});

test('admin pet adjustments preserve revival progress and apply requested evolution', () => {
 const now=Date.UTC(2026,10,19), original={...newAttendancePet(now-100*3600000),checkins:35};
 assert.equal(attendancePetView(original,now).dead,true);
 const revived=adjustAdminPet(original,'revive',0,now);
 assert.equal(revived.checkins,35);assert.equal(attendancePetView(revived,now).dead,false);
 assert.equal(attendancePetView(adjustAdminPet(original,'level',8,now),now).level,8);
 assert.equal(attendancePetView(adjustAdminPet(original,'evolve',0,now),now).level,5);
 const checked=adjustAdminPet(original,'checkin',0,now);
 assert.equal(adjustAdminPet(checked,'checkin',0,now).checkins,36);
 const egg=adjustAdminPet(original,'egg',0,now);
 assert.equal(egg.checkins,0);assert.equal(egg.hatchAt,now+3600000);
 assert.equal(attendancePetView(adjustAdminPet(egg,'hatch',0,now),now).egg,false);
 assert.equal(adjustAdminPet(original,'feed',0,now).fedOn,null,'feeding cannot revive an absent pet');
 assert.throws(()=>adjustAdminPet(original,'level',-1,now));
});

test('admin can increase and decrease pet weight without changing progression',()=>{
 const now=Date.UTC(2026,10,22),pet={...newAttendancePet(now-7200000),weightGrams:1000,checkins:12,feedingXp:3};
 const increased=adjustAdminPet(pet,'weight:200',1,now),decreased=adjustAdminPet(increased,'weight:-500',1,now+1),floored=adjustAdminPet(decreased,'weight:-5000',1,now+2);
 assert.equal(increased.weightGrams,1200);assert.equal(decreased.weightGrams,700);assert.equal(floored.weightGrams,0);
 assert.equal(increased.checkins,pet.checkins);assert.equal(increased.feedingXp,pet.feedingXp);
});

test('absence leaves weight intact through the 72-hour death deadline', () => {
 const born=Date.UTC(2026,10,20),day=86400000;
 const base={...newAttendancePet(born),weightGrams:5000,lastCheckinAt:born,lastCheckinDay:attendancePetDay(born)};
 assert.equal(attendancePetView(base,born+day-1).weightGrams,5000);
 assert.equal(attendancePetView(base,born+day).weightGrams,5000);
 assert.equal(attendancePetView(base,born+2*day).weightGrams,5000);
 const original=JSON.stringify(base);for(let i=0;i<10;i++)attendancePetView(base,born+2*day);assert.equal(JSON.stringify(base),original,'reading weight never mutates or writes');
 let pet=transitionAttendancePet(base,'feed',born+day).pet;
 assert.equal(pet.weightGrams,5200);assert.equal(pet.lastCheckinAt,born);
 assert.equal(transitionAttendancePet(pet,'feed',born+day+1).changed,false);
 pet=transitionAttendancePet(pet,'rename:Heavy fish',born+day+1).pet;
 assert.equal(attendancePetView(pet,born+day+2).weightGrams,5200);
 assert.equal(attendancePetView(pet,born+2*day).weightGrams,5200);
 pet=transitionAttendancePet(pet,'feed',born+2*day).pet;assert.equal(pet.weightGrams,5400);
 const checked=transitionAttendancePet(pet,'checkin',born+2*day+1).pet;
 assert.equal(checked.weightGrams,5400,'attendance never adds or restores weight');
 assert.equal(attendancePetView(checked,born+2*day+2).weightGrams,5400);
 assert.equal(attendancePetView(pet,born+3*day-1).dead,false);
 assert.equal(attendancePetView(pet,born+3*day).dead,true,'food does not prevent death');
 assert.equal(attendancePetView(pet,born+3*day).weightGrams,5400);
 const saved={...base,id:'saved',weightGrams:4500,weightPenaltyGrams:500};
 assert.equal(attendancePetView(saved,born+2*day).weightGrams,4500,'previously stored loss is not refunded or charged again');
 assert.equal(petBattleChangeWeight(saved,'saved',-200,born+2*day).weightGrams,4300);
 const legacy={...base,feeds:7};delete legacy.weightGrams;
 assert.equal(attendancePetView(legacy,born+day).weightGrams,1400,'legacy food is worth 200 grams per feed');
 assert.equal(transitionAttendancePet(legacy,'checkin',born+day).pet.weightGrams,1400);
 assert.equal(attendancePetView({...base,weightGrams:Infinity,feeds:Infinity},born+day).weightGrams,0);
 const root={...base,companions:[{...base,id:'other',weightGrams:7000}]};
 const household=transitionPetHousehold(root,'checkin',born+day).pet;
 assert.deepEqual(attendancePetRecords(household).map(p=>p.weightGrams),[5000,7000]);
});

test('pet comparison supports level and weighted battle-power ranking within seven days', () => {
 const now=Date.UTC(2026,10,20),day=86400000;
 const pet=(weight,activity,extra={})=>({...newAttendancePet(now-10*day),weightGrams:weight,lastCheckinAt:activity,lastCheckinDay:attendancePetDay(activity),...extra});
 const profiles=[
  {id:'a',uid:'a',displayName:'A',attendancePet:pet(7000,now-3600000)},
  {id:'b',uid:'b',displayName:'B',attendancePet:pet(5000,now-day,{branch:'bird',checkins:90,battleXp:7})},
  {id:'z',uid:'a',displayName:'Duplicate',attendancePet:pet(99000,now-1)},
  {id:'c',uid:'c',displayName:'Expired',attendancePet:pet(9000,now-7*day)},
  {id:'d',uid:'d',displayName:'Dead but recently attended',attendancePet:pet(90000,now-6*day)},
  {id:'e',uid:'e',displayName:'Fed recently',attendancePet:pet(2000,now-8*day,{bornAt:now-day,lastCheckinAt:null,lastCheckinDay:null,lastFedAt:now-3600000})},
  {id:'f',uid:'f',displayName:'Rename is not activity',attendancePet:pet(2000,now-8*day,{updatedAt:now})}
 ];
 const rows=buildPetComparison(profiles,now);
 assert.equal(rows.length,4);assert.deepEqual(rows.map(row=>row.uid),['b','a','e','d']);
 assert.equal(rows[0].weightGrams,5000);assert.equal(rows[0].rank,1);assert.equal(rows.at(-1).rank,null);
 assert.equal(rows[0].xpToNextLevel,3,'comparison includes battle EXP in the next-level progress');
 assert.equal(buildPetComparison(profiles,now,'bird').length,1);
 assert.equal(buildPetComparison(profiles,now,'dino').length,0);
 const attackStats={attack:70,magic:4,defense:4,magicReduction:4,physicalReduction:4,dodge:4,luck:4,health:6};
 const healthStats={attack:1,magic:1,defense:1,magicReduction:1,physicalReduction:1,dodge:1,luck:1,health:93};
 const byPower=buildPetComparison([
  {...profiles[0],uid:'attack-build',petBattleStatsByPet:{[attendancePetRecords(profiles[0].attendancePet,now)[0].id]:attackStats}},
  {...profiles[0],id:'health-build',uid:'health-build',displayName:'Health build',petBattleStatsByPet:{[attendancePetRecords(profiles[0].attendancePet,now)[0].id]:healthStats}}
 ],now,'all','power');
 assert.equal(byPower[0].uid,'attack-build','power ranking favors offensive stats with a larger impact on battle damage');
 assert.equal(byPower[0].battlePower,petBattlePower(attackStats));
 assert.ok(byPower[1].battlePower<byPower[0].battlePower);
 const adminOnly=transitionPetHousehold(pet(1000,now-8*day),'level',now,null,8).pet;
 assert.equal(buildPetComparison([{id:'admin-only',uid:'admin-only',attendancePet:adminOnly}],now).length,0,'admin level edits do not count as real attendance');

 assert.equal(attendancePetActivityTime(profiles[5].attendancePet,now),now-3600000);
 assert.equal(buildPetComparison([{...profiles[0],attendancePet:pet(1000,now-7*day+1)}],now).length,1,'strict seven-day boundary');
});

test('feeding grants XP every two hours but never postpones the attendance death deadline', () => {
 const born=Date.UTC(2026,10,20),now=born+3600000;
 let pet={...newAttendancePet(born),checkins:8,lastCheckinAt:born,lastCheckinDay:attendancePetDay(born)};
 const diesAt=attendancePetView(pet,now).diesAt;
 let change=transitionAttendancePet(pet,'feed',now);pet=change.pet;
 assert.equal(pet.feedingXp,1);assert.equal(pet.checkins,8);assert.equal(pet.lastCheckinAt,born);
 assert.equal(transitionAttendancePet(pet,'feed',now+7199999).changed,false);
 change=transitionAttendancePet(pet,'feed',now+7200000);pet=change.pet;
 assert.equal(pet.feedingXp,2);assert.equal(attendancePetView(pet,now+7200000).level,2);
 assert.equal(attendancePetView(pet,now+7200000).diesAt,diesAt);
 pet=transitionAttendancePet(pet,'feed',diesAt-1).pet;
 assert.equal(attendancePetView(pet,diesAt).dead,true,'even eating a millisecond before the deadline cannot prevent death');
 assert.equal(transitionAttendancePet(pet,'feed',diesAt).result,'dead');
 const midnight=Date.parse('2026-11-21T00:15:00+07:00');
 const lateFed={...newAttendancePet(midnight-5*3600000),lastFedAt:midnight-1800000,fedOn:'2026-11-20'};
 assert.equal(transitionAttendancePet(lateFed,'feed',midnight).changed,false,'crossing midnight does not reset feeding cooldown');
});

test('household maximum level grants exactly one new egg and attendance cares for all living pets once a day', () => {
 const now=Date.UTC(2026,10,20,6),lastDay=now-86400000;
 let root={...newAttendancePet(now-7200000),checkins:288,feedingXp:1,branch:'fish',nickname:'Ocean',lastCheckinAt:lastDay,lastCheckinDay:attendancePetDay(lastDay)};
 let change=transitionPetHousehold(root,'feed',now);root=change.pet;
 assert.equal(change.spawned,1);assert.equal(attendancePetRecords(root,now).length,2);assert.equal(attendancePetView(root,now).egg,true);
 let veteran=attendancePetRecords(root,now)[1];assert.equal(attendancePetView(veteran,now).maxed,true);assert.equal(veteran.nickname,'Ocean');
 assert.equal(veteran.eggGrantedAt,now);assert.equal(veteran.lastCheckinAt,lastDay);
 const originalVeteran=veteran.id,newborn=attendancePetRecords(root,now)[0].id;
 change=transitionPetHousehold(root,'init',now+1000);assert.equal(change.changed,false);assert.equal(change.spawned,0);
 change=transitionPetHousehold(root,'feed',now+7200000,originalVeteran);root=change.pet;
 assert.equal(change.spawned,0);assert.equal(attendancePetRecords(root).length,2);
 change=transitionPetHousehold(root,'checkin',now+7200000,newborn);root=change.pet;
 assert.equal(change.result,'checked');for(const p of attendancePetRecords(root))assert.equal(p.lastCheckinAt,now+7200000);
 assert.equal(attendancePetSelected(root,newborn).checkins,1);assert.equal(attendancePetSelected(root,originalVeteran).checkins,289);
 assert.equal(transitionPetHousehold(root,'checkin',now+7200001,originalVeteran).changed,false);
 const before=attendancePetSelected(root,originalVeteran).feedingXp;
 root=transitionPetHousehold(root,'feed',now+14400000,newborn).pet;
 assert.equal(attendancePetSelected(root,originalVeteran).feedingXp,before,'food affects only the selected pet');
 assert.equal(transitionPetHousehold(root,'feed',now+14400001,'missing-id').result,'missing-pet');
 const capped={...newAttendancePet(now-7200000),branch:'bird',checkins:290,lastCheckinAt:now};
 const migrated=transitionPetHousehold(capped,'init',now);
 assert.equal(migrated.spawned,1);assert.equal(transitionPetHousehold(migrated.pet,'init',now).spawned,0,'legacy max pets receive one egg across reloads');
 const admin=transitionPetHousehold({...capped,checkins:80},'level',now,null,30);
 assert.equal(admin.spawned,1,'admin level-up follows the same one-egg rule');
 const adminVeteran=attendancePetRecords(admin.pet,now).find(p=>p.branch==='bird');
 const veteranLevel=transitionPetHousehold(admin.pet,'level',now,adminVeteran.id,31);
 assert.equal(veteranLevel.spawned,0);assert.equal(attendancePetView(adminVeteran,now).level,30);
 assert.equal(attendancePetView(attendancePetRecords(veteranLevel.pet,now).find(p=>p.branch==='bird'),now).level,31);
 const expired={...root,companions:root.companions.map(p=>({...p,lastCheckinAt:now-73*3600000,bornAt:now-100*3600000}))};
 const survivorId=attendancePetRecords(expired)[0].id;
 const day2=now+86400000,updated=transitionPetHousehold(expired,'checkin',day2,survivorId).pet;
 assert.equal(attendancePetView(attendancePetRecords(updated)[1],day2).dead,true,'daily attendance cannot revive already dead companions');
});

test('attendance pet checks in daily and feeds on a two-hour cooldown while aging offline', () => {
 const born=Date.parse('2026-11-01T09:00:00+07:00');
 let pet=newAttendancePet(born);
 assert.equal(attendancePetView(pet,born).egg,true);
 assert.equal(attendancePetView(pet,born+3600000).egg,false,'egg hatches after one real hour without page activity');
 assert.equal(transitionAttendancePet(pet,'feed',born).result,'egg');
 let change=transitionAttendancePet(pet,'checkin',born);pet=change.pet;
 assert.equal(pet.checkins,1);assert.equal(transitionAttendancePet(pet,'checkin',born+1000).changed,false);
 change=transitionAttendancePet(pet,'feed',born+3600000);pet=change.pet;
 assert.equal(change.result,'fed');assert.equal(transitionAttendancePet(pet,'feed',born+7200000).changed,false);
 for(let day=1;day<10;day++)pet=transitionAttendancePet(pet,'checkin',born+day*86400000).pet;
 assert.equal(attendancePetView(pet,born+9*86400000).level,2,'ten daily check-ins unlock the next creature');
 const death=pet.lastCheckinAt+72*3600000;
 assert.equal(attendancePetView(pet,death-1).dead,false);assert.equal(attendancePetView(pet,death).dead,true);
 assert.equal(transitionAttendancePet(pet,'checkin',death).result,'dead','check-in cannot revive a dead pet');
 const revived=transitionAttendancePet(pet,'revive',death);pet=revived.pet;
 assert.equal(pet.checkins,0);assert.equal(attendancePetView(pet,death).level,0);assert.equal(pet.hatchAt,death+3600000);
 assert.equal(transitionAttendancePet(pet,'revive',death+1).changed,false,'another tab cannot restart the hatch timer');
 assert.equal(attendancePetView(pet,death+3600000).level,1,'resurrected egg hatches to first fish while offline');
 const fedBeforeDeath={...newAttendancePet(born-100*3600000),lastCheckinAt:born-73*3600000,fedOn:attendancePetDay(born),lastFedAt:born};
 const revivedSameDay=transitionAttendancePet(fedBeforeDeath,'revive',born).pet;
 assert.equal(transitionAttendancePet(revivedSameDay,'feed',born+3600000).result,'already-fed','resurrection retains the two-hour feeding cooldown');
 assert.equal(attendancePetDay(Date.parse('2026-11-01T16:59:59Z')),'2026-11-01');
 assert.equal(attendancePetDay(Date.parse('2026-11-01T17:00:00Z')),'2026-11-02','daily actions reset at Bangkok midnight');
});

test('storm water survives refresh without adding time spent outside the app', () => {
    const values=new Map(),storage={getItem:key=>values.get(key),setItem:(key,value)=>values.set(key,value)};
    let water=loadStormWater(0,storage);advanceStormWater(water,900000);scoopStormWater(water,900000);
    assert.equal(saveStormWater(water,storage),true);
    water=loadStormWater(99999999,storage);
    assert.equal(water.level,.23,'refresh retains scooped water level, without offline growth');
    assert.equal(water.lastAt,99999999);
    advanceStormWater(water,99999999+900000);assert.equal(water.level,.48,'water continues rising from restored level');
    values.set('workpic-storm-water-v1','invalid');assert.equal(loadStormWater(0,storage).level,0);
    values.set('workpic-storm-water-v1',JSON.stringify({level:99}));assert.equal(loadStormWater(0,storage).level,.5);
    assert.equal(saveStormWater(water,{setItem(){throw Error('blocked');}}),false,'blocked storage cannot break the effect');
});

test('storm water reaches half-screen in 30 minutes and bucket scoops reduce the water', () => {
    const water={level:0,lastAt:0};
    assert.equal(advanceStormWater(water,900000),.25);
    assert.equal(advanceStormWater(water,1800000),.5);
    assert.equal(advanceStormWater(water,3600000),.5,'water never exceeds half the screen');
    assert.equal(scoopStormWater(water,3600000),.48,'bucket removes two percent of screen height');
    for(let i=0;i<120;i++)scoopStormWater(water,3600000);
    assert.equal(water.level,0,'scooping cannot produce negative water');
    assert.equal(advanceStormWater(water,4500000),.25,'water rises again after being scooped');
});

test('shared rain renderer keeps one canvas/loop and releases listeners across header and fullscreen modes', () => {
    const source = fs.readFileSync('app.js', 'utf8');
    const code = source.slice(source.indexOf('const RainFx ='), source.indexOf('// Thiên hà xoắn ốc'));
    const listeners = new Map(), frames = new Map(), canvases = [], elements = [];
    let serial = 0, reduced = false, clock = 0, surfaceY = 0;
    const classes = new Set();
    const add = (name, fn) => { if (!listeners.has(name)) listeners.set(name, new Set()); listeners.get(name).add(fn); };
    const remove = (name, fn) => listeners.get(name)?.delete(fn);
    let waterDraws = 0, largestStroke = 0;
    const g = { setTransform() {}, clearRect() {}, fillRect() {}, beginPath() {}, moveTo() {}, lineTo() {},
        stroke() { largestStroke = Math.max(largestStroke, this.lineWidth || 0); },
        save() {}, restore() {}, closePath() {}, fill() { waterDraws++; }, ellipse() {}, createLinearGradient: (_,y) => {surfaceY=y;return {addColorStop(){}};} };
    const ctx = vm.createContext({
        navigator: { hardwareConcurrency: 8 }, advanceStormWater, scoopStormWater, loadStormWater, saveStormWater, Date:{now:()=>clock},
        document: { hidden: false, body: { appendChild() {}, classList: { contains: name => classes.has(name), remove:name=>classes.delete(name),toggle:(name,on)=>on?classes.add(name):classes.delete(name) } }, addEventListener: add, removeEventListener: remove,
            createElement: tag => { const itemClasses=new Set(); const canvas = { style:{setProperty(name,value){this[name]=value;}}, classList:{contains:name=>itemClasses.has(name),add:name=>itemClasses.add(name),remove:name=>itemClasses.delete(name),toggle:(name,on)=>on?itemClasses.add(name):itemClasses.delete(name)}, addEventListener(){}, getContext: () => g, setAttribute() {}, remove() { this.removed = true; } }; elements.push(canvas); if(tag==='canvas')canvases.push(canvas); return canvas; } },
        window: { innerWidth:1440, innerHeight:1000, devicePixelRatio: 2, matchMedia: () => ({ matches: reduced }), addEventListener: add, removeEventListener: remove },
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
    for (let step = 1; step <= 100; step++) {
        const [id, frame] = frames.entries().next().value; frames.delete(id); frame(step * 40);
    }
    assert.ok(waterDraws > 0,'storm draws rising water in the fullscreen canvas');
    assert.ok(largestStroke >= 10,'storm draws a large lightning glow');
    clock=1800000;
    const stepFrame=time=>{const [id,frame]=frames.entries().next().value;frames.delete(id);frame(time);};
    stepFrame(4040);assert.equal(surfaceY,500,'real storm renderer reaches half-screen');
    const bucketEvent={button:0,clientX:600,clientY:750,target:{closest:()=>null}};
    for(const fn of listeners.get('pointermove'))fn(bucketEvent);
    assert.ok(classes.has('storm-bucket-active'),'bucket cursor appears over water');
    for(const fn of listeners.get('pointerdown'))fn(bucketEvent);
    stepFrame(4080);assert.equal(surfaceY,520,'clicking water reduces the rendered flood level');
    const thrownWater=elements.filter(element=>element.className==='storm-scoop-water');
    assert.equal(thrownWater.length,1,'scooping creates one large water burst');
    assert.ok(thrownWater[0].innerHTML.includes('animateMotion')&&thrownWater[0].innerHTML.includes('storm-water-impact'),'water has falling particles and a landing splash');
    const controlEvent={...bucketEvent,target:{closest:()=>({})}};
    for(const fn of listeners.get('pointermove'))fn(controlEvent);
    assert.ok(!classes.has('storm-bucket-active'),'bucket does not replace cursor over job controls');
    for(const fn of listeners.get('pointerdown'))fn(controlEvent);
    stepFrame(4120);assert.equal(surfaceY,520,'normal button clicks do not scoop');
    classes.add('modal-open'); for (const fn of listeners.get('shown.bs.modal')) fn();
    assert.equal(frames.size, 0);
    assert.ok(thrownWater[0].removed,'opening a modal removes the transient water burst');
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
    getHolidayName: () => '', getPersonalEvents: () => [], compactCalendarLabel: s => s, jobColorStyle,
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
const source = fs.readFileSync('app.js', 'utf8').replace(/\r\n/g,'\n');
const extract = (start, end) => source.slice(source.indexOf(start), source.indexOf(end));
const markup = fs.readFileSync('index.html', 'utf8').replace(/<script\b[^>]*>[\s\S]*?<\/script>/gi, '').replace(/<link\b(?:[^>"']|"[^"]*"|'[^']*')*>/gi, '');
const temp = fs.mkdtempSync(path.join(os.tmpdir(), 'workpic-ui-'));
const script = `
${source.split('// BEGIN SHARED HELPERS\n')[1].split('// END SHARED HELPERS')[0]}

const check = (value, message) => { document.body.dataset.uiStep=message; if (!value) throw new Error(message); };
let currentUser = { uid: 'me', personalCalendarEvents: [{id:'event',date:'2026-11-05',title:'Weekly appointment',repeat:'weekly',until:'2026-12-01'}], changeHistory: [{kind:'event',action:'Added',title:'Meeting',actor:'Me',detail:'Weekly',at:'2026-11-05T10:00:00Z'}] };
const accessControl = { can: () => true, requireAccess: () => true };
const db = {}; let dayOffViewYear=2026, dayOffViewMonth=10, currentViewingJobId='job';
let jobDayOverridesList = [], stored = {overrideDate:'2026-11-04',note:'Keep this',checklistDone:{}};
let historyCalls = 0, denyWrite = false;
const doc = (_, collection, id) => ({ collection, id });
// Reproduce owner-based rules rejecting the read of a missing override.
let petRecord={uid:'me',attendancePet:{...newAttendancePet(Date.now()-7200000)}},petWrites=0,petReject=false,petFeedAnimations=0,petTransactions=0,petTransactionGate=null,petTransactionOptions=[];
const runTransaction = async (_, callback, options) => {petTransactions++;petTransactionOptions.push(options);if(petTransactionGate)await petTransactionGate;return callback({
    get: async ref => { if(ref.collection!=='users'||petReject)throw Object.assign(new Error('Missing or insufficient permissions.'),{code:'permission-denied'});return {exists:()=>true,data:()=>petRecord}; },
    update: (ref,patch) => {check(ref.collection==='users'&&Object.keys(patch).join(',')==='attendancePet','pet updates only own profile pet state');petRecord={...petRecord,...patch};petWrites++;}
});};
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
let usersDirectorySnapshot=null,authenticatedProfileSnapshot=null;
const collection=(_,name)=>name,getDocs=async()=>usersDirectorySnapshot;
const auth={currentUser:{uid:'me',email:'chauchikil01@gmail.com'}};
${extract('const canControlPets =', 'let attendancePetData =')}
const modelViews=new Map();
const createAttendancePet3D=(id,_art,_preview,mode)=>({start(){},stop(){modelViews.delete(id);},update(view){modelViews.set(id,{view,mode});},feed(){},duelPose(){},thumbnail:async view=>'data:image/svg+xml;charset=utf-8,'+encodeURIComponent('<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 144 104"><ellipse cx="72" cy="52" rx="40" ry="25" fill="'+view.form.color+'"/></svg>')});
let petSkillPreviews=0;const AttendancePet3D={start(){},stop(){},update(){},preview(open){document.getElementById("attendancePetPreview").innerHTML=open?'<svg viewBox="0 0 140 100"><ellipse cx="70" cy="50" rx="30" ry="40"/></svg>':'';},castSkill(){petSkillPreviews++;},feed(){petFeedAnimations++;}};
let PET_CLOUD_ENABLED=false;
let petCloudRequest=()=>{throw new Error('Unexpected cloud request in the legacy fixture');};
${extract('let attendancePetData =', 'let sharedNotesUnsubscribe =').replace('return {init,start,stop,sync,profile,open};','return {init,start,stop,sync,profile,open,inspect:()=>state};')}
let noteSnapshot, noteWrites = [], noteUpdates = [], noteDeletes = [], noteUnsubscribed = 0, rejectNoteWrite = false;
const query = (...args) => args, orderBy = (...args) => args, limit = value => value;
const serverTimestamp = () => 'server-timestamp';
const onSnapshot = (_, callback) => { noteSnapshot = callback; return () => noteUnsubscribed++; };
const addDoc = async (name, data) => { if (rejectNoteWrite) throw Object.assign(new Error('denied'), {code:'permission-denied'}); noteWrites.push({name,data}); };
const updateDoc = async (ref,data) => { if (rejectNoteWrite) throw new Error('denied'); noteUpdates.push({ref,data}); };
const deleteDoc = async ref => { if (rejectNoteWrite) throw new Error('denied'); noteDeletes.push(ref); };
let quickChatPanelOpen = false, quickChatUnreadCount = 0;
const updateQuickChatBadge = () => {};
${extract('function openQuickChatPanel(', 'function createAttendancePet3D(')}
try {
    const kept = ['dayOffModal','viewJobModal','changeHistoryModal','sharedNotesPanel','sharedNotesToggle','quickChatToggleBtn','quickChatPanel','sharedNoteImageDialog','attendancePetDialog','attendancePetBranchDialog','petGuideDialog','petCompareDialog','petBattleHistoryDialog','petRankingPreviewDialog','petAdminDialog','petAdminOpen','petBattleDialog','petBattleLobby','petBattleInvitePicker','petBattleExitDialog','petBattleInvite','attendancePetToggle','attendancePetSwimmer'].map(id=>document.getElementById(id));
    check(document.getElementById('scheduleActions').closest('#mainContent'),'job actions are inside schedule area');
    check(!document.getElementById('sidebar').contains(document.getElementById('addJobBtn')),'job actions leave sidebar');
    check(document.getElementById('jobColor')&&document.getElementById('settingsHideOutOfSchedule'),'color and hide-outside controls exist');
    for(const itemClass of ['schedule-item weekly','timeline-job weekly']) {
        const sample=document.createElement('div');sample.className=itemClass;sample.style.cssText=jobColorStyle({displayColor:'#ffffff'});document.body.appendChild(sample);
        check(getComputedStyle(sample).backgroundColor==='rgb(255, 255, 255)'&&getComputedStyle(sample).color==='rgb(17, 24, 39)','custom job color is readable in '+itemClass);sample.remove();
    }
    const historyButton = document.getElementById('changeHistoryBtn');
    document.body.replaceChildren(...kept,historyButton);
    initAttendancePetUi();initAttendancePetUi();attendancePetData=petRecord.attendancePet;attendancePetRef={collection:'users',id:'me'};attendancePetReady=true;
    document.getElementById('attendancePetToggle').hidden=false;renderAttendancePet();
    document.getElementById('attendancePetToggle').click();
    check(document.getElementById('attendancePetDialog').open,'pet care dialog opens');
    const petDialogRect=document.getElementById('attendancePetDialog').getBoundingClientRect();
    check(Math.abs(petDialogRect.left+petDialogRect.width/2-document.documentElement.clientWidth/2)<2&&Math.abs(petDialogRect.top+petDialogRect.height/2-innerHeight/2)<2,'pet care form is centered horizontally and vertically '+JSON.stringify({rect:petDialogRect.toJSON(),width:innerWidth,height:innerHeight,css:Array.from(['width','height','max-height','margin','position','transform','zoom']).map(k=>[k,getComputedStyle(document.getElementById('attendancePetDialog')).getPropertyValue(k)]),body:getComputedStyle(document.body).transform,sheets:Array.from(document.styleSheets).map(s=>s.cssRules.length),rules:(()=>{const out=[];function visit(rules,path){for(const r of rules){if(r.selectorText?.includes('attendance-pet-dialog'))out.push(path+' / '+r.selectorText);if(r.cssRules)visit(r.cssRules,path+' / '+(r.selectorText||r.conditionText||''));}}for(const s of document.styleSheets)visit(s.cssRules,'');return out;})()}));
    check(document.querySelector('#attendancePetPreview svg'),'pet care form displays current pet artwork');
    document.getElementById('attendancePetPreview').click();check(petSkillPreviews===1&&document.querySelector('#attendancePetPreview .pet-preview-skill strong'),'clicking the 3D pet previews its current unique skill');
    check(document.getElementById('attendancePetDialog').scrollWidth<=document.getElementById('attendancePetDialog').clientWidth+1,'game form has no horizontal clipping');

    check(!document.getElementById('attendancePetBranchDialog').open&&document.getElementById('attendancePetBranchOpen').hidden,'branch form and button stay hidden below level nine');
    openAttendancePetBranch();check(!document.getElementById('attendancePetBranchDialog').open,'direct branch opening is blocked below level nine');
    const visibleSwitch=document.getElementById('attendancePetVisible'),writesBeforeVisibility=petWrites;
    visibleSwitch.checked=false;visibleSwitch.dispatchEvent(new Event('change',{bubbles:true}));
    check(document.getElementById('attendancePetSwimmer').hidden&&document.querySelector('#attendancePetPreview svg'),'hide floating pet while keeping preview and care form');
    check(localStorage.getItem('workpic-pet-visible-me')==='false'&&!loadAttendancePetVisibility()&&petWrites===writesBeforeVisibility,'visibility persists locally without Firebase writes');
    visibleSwitch.checked=true;visibleSwitch.dispatchEvent(new Event('change',{bubbles:true}));
    check(!document.getElementById('attendancePetSwimmer').hidden&&loadAttendancePetVisibility(),'show floating pet again');

    document.getElementById('attendancePetCheckin').click();await new Promise(resolve=>setTimeout(resolve,0));
    check(petRecord.attendancePet.checkins===1&&document.getElementById('attendancePetCheckin').disabled,'check-in is saved and same-day button disabled');
    check(!document.querySelector('#attendancePetSwimmer .pet-hunger-bubble').hidden,'hungry pet displays a feeding speech bubble');
    document.getElementById('attendancePetFeed').click();await new Promise(resolve=>setTimeout(resolve,0));
    check(document.querySelector('#attendancePetSwimmer .pet-hunger-bubble').hidden,'feeding hides hunger speech bubble');
    check(petWrites===2&&petFeedAnimations===1&&document.getElementById('attendancePetFeed').disabled,'feeding saves once and animates');
    attendancePetData={...attendancePetData,fedOn:null};await actOnAttendancePet('feed');
    check(petWrites===2&&petFeedAnimations===1,'stale tab rereads server state and cannot feed twice');
    petRecord.attendancePet={...petRecord.attendancePet,bornAt:Date.now()-100*3600000,lastCheckinAt:Date.now()-73*3600000};attendancePetData=petRecord.attendancePet;renderAttendancePet();
    check(document.getElementById('attendancePetCheckin').disabled&&document.getElementById('attendancePetFeed').textContent.includes('Hồi sinh'),'dead pet exposes resurrection instead of feeding');
    document.getElementById('attendancePetFeed').click();await new Promise(resolve=>setTimeout(resolve,0));
    check(petRecord.attendancePet.checkins===0&&attendancePetView(petRecord.attendancePet).egg,'resurrection resets progress and starts new egg timer');
    check(document.querySelector('#attendancePetSwimmer .pet-hunger-bubble').hidden,'eggs never ask for food');
    check(!document.getElementById('attendancePetEggTimer').hidden&&document.getElementById('attendancePetEggTimer').textContent.includes('Nở sau'),'egg shows countdown directly beneath swimmer');
    check(document.getElementById('attendancePetCountdown').textContent.includes('Dự kiến nở lúc'),'care dialog shows exact hatch date and time');
    petReject=true;await actOnAttendancePet('checkin');petReject=false;
    check(petRecord.attendancePet.checkins===0&&document.getElementById('attendancePetStatus').textContent.includes('Chưa lưu'),'failed write does not fake a check-in');
    check(document.getElementById('attendancePetBranchPanel').hidden,'branch picker stays hidden before level nine');
    petRecord.attendancePet={...newAttendancePet(Date.now()-7200000),checkins:80,lastCheckinAt:Date.now()};attendancePetData=petRecord.attendancePet;renderAttendancePet();
    check(!document.getElementById('attendancePetBranchPanel').hidden&&document.getElementById('attendancePetBranchDialog').open,'ray unlocks and opens dedicated branch form');
    document.getElementById('attendancePetBranchClose').click();renderAttendancePet();
    check(!document.getElementById('attendancePetBranchDialog').open,'dismissed branch form does not reopen on every timer tick');
    document.getElementById('attendancePetBranchOpen').click();check(document.getElementById('attendancePetBranchDialog').open,'eligible user can reopen branch form');

    document.querySelector('[data-pet-branch="beast"]').click();await new Promise(resolve=>setTimeout(resolve,0));
    check(petRecord.attendancePet.branch==='beast'&&petRecord.attendancePet.checkins===80,'branch choice saves without resetting days');
    check(!document.getElementById('attendancePetBranchDialog').open&&document.getElementById('attendancePetDialog').open,'successful choice closes only branch form');

    petRecord.attendancePet={...petRecord.attendancePet,checkins:90};attendancePetData=petRecord.attendancePet;renderAttendancePet();
    check(document.querySelectorAll('.pet-road-shared li').length===10&&document.querySelectorAll('.pet-road-branch').length===4,'journey shows the shared path and all four branches');
    check([...document.querySelectorAll('.pet-road-branch')].every(branch=>branch.querySelectorAll('li').length===11&&branch.textContent.includes('Cấp 30')),'every branch shows ten species and a final evolution');
    const guide=document.getElementById('petGuideDialog');
    document.querySelector('[data-pet-guide="care"]').click();
    check(guide.open&&!document.getElementById('petGuideCare').hidden&&document.getElementById('attendancePetRoad').closest('dialog')===guide,'care guide opens separately with the evolution journey');
    document.getElementById('petGuideClose').click();
    document.querySelector('[data-pet-branch="bird"]').click();await new Promise(resolve=>setTimeout(resolve,0));
    check(petRecord.attendancePet.branch==='bird'&&attendancePetView(petRecord.attendancePet).level===10,'switching branch keeps earned level');
    const nickname=document.getElementById('attendancePetNickname'),nameForm=document.getElementById('attendancePetNicknameForm'),beforeNameWrites=petWrites;
    check(nameForm.hidden&&document.getElementById('attendancePetCountdown').hidden&&document.getElementById('attendancePetVisible').closest('.pet-stable'),'roster contains visibility and living care hides the redundant deadline');
    document.getElementById('attendancePetNicknameEdit').click();
    check(!nameForm.hidden&&document.activeElement===nickname,'Edit opens the nickname field below the preview');
    nickname.value='<b>My pet</b>';nickname.dispatchEvent(new Event('input'));renderAttendancePet();
    check(petWrites===beforeNameWrites&&nickname.value==='<b>My pet</b>','typing a nickname does not write or get overwritten by timer');
    nameForm.dispatchEvent(new Event('submit',{bubbles:true,cancelable:true}));await new Promise(resolve=>setTimeout(resolve,0));
    check(petRecord.attendancePet.nickname==='<b>My pet</b>'&&document.getElementById('attendancePetName').textContent==='<b>My pet</b>'&&!document.querySelector('#attendancePetName b'),'nickname saves and renders as plain text');
    check(nameForm.hidden,'saving closes the nickname editor');
    nameForm.dispatchEvent(new Event('submit',{bubbles:true,cancelable:true}));await new Promise(resolve=>setTimeout(resolve,0));
    check(petWrites===beforeNameWrites+1,'saving same nickname does not write again');
    petRecord.attendancePet={...newAttendancePet(Date.now()-7200000),branch:'bird',checkins:289,lastCheckinAt:Date.now(),lastCheckinDay:attendancePetDay(Date.now())};attendancePetData=petRecord.attendancePet;selectedAttendancePetId=null;renderAttendancePet();
    await actOnAttendancePet('feed');
    check(attendancePetRecords(petRecord.attendancePet).length===2&&document.querySelectorAll('#attendancePetRoster [data-pet-id]').length===2,'reaching max creates one egg and keeps veteran in roster');
    check(selectedAttendancePetView().egg&&document.getElementById('attendancePetCheckin').disabled,'new egg inherits account attendance status');
    check(document.querySelectorAll('.attendance-pet-swimmer').length===2,'veteran and egg have independent floating renderers');
    const veteran=attendancePetRecords(petRecord.attendancePet)[1];
    document.querySelector('#attendancePetRoster [data-pet-id="'+veteran.id+'"]').click();
    check(selectedAttendancePetView().maxed&&document.getElementById('petGameXp').textContent==='290 XP','roster selects veteran independently');
    petRecord.attendancePet.companions[0].lastFedAt=Date.now()-7200000;attendancePetData=petRecord.attendancePet;renderAttendancePet();
    await actOnAttendancePet('feed');
    check(attendancePetRecords(petRecord.attendancePet).length===2,'feeding a max veteran does not create another reward egg');
    document.getElementById('attendancePetVisible').checked=false;document.getElementById('attendancePetVisible').dispatchEvent(new Event('change'));
    check(attendancePetFleet.size===0&&document.getElementById('attendancePetSwimmer').hidden,'hide preference disposes companion renderers');
    document.getElementById('attendancePetVisible').checked=true;document.getElementById('attendancePetVisible').dispatchEvent(new Event('change'));
    const currentWeight=selectedAttendancePetView().weightGrams;
    check(document.getElementById('petGameWeight').textContent===petWeightLabel(currentWeight),'care form displays selected pet weight');
    const comparisonNow=Date.now();
    usersDirectorySnapshot={docs:[
      {id:'active',data:()=>({uid:'active',displayName:'Active trainer',attendancePet:{...newAttendancePet(comparisonNow-7200000),weightGrams:9000,lastCheckinAt:comparisonNow-1000,branch:'fish',checkins:90,battleHistory:[{id:'example',result:'win',opponentName:'Rival',xpDelta:1,weightDelta:200,endedAt:comparisonNow-1000}]}})},
      {id:'inactive',data:()=>({uid:'inactive',displayName:'Inactive trainer',attendancePet:{...newAttendancePet(comparisonNow-10*86400000),weightGrams:90000,lastCheckinAt:comparisonNow-8*86400000}})}
    ]};
    const writesBeforeCompare=petWrites;
    document.getElementById('petCompareOpen').click();
    check(document.getElementById('petCompareDialog').open,'comparison opens a separate form');
    await new Promise(resolve=>setTimeout(resolve,60));
    check([...document.querySelectorAll('#petCompareRows img')].every(img=>!img.hidden&&img.src.startsWith('data:image/')&&img.alt.length>0),'each comparison row shows a cached image with pet identity');

    check(document.getElementById('petCompareRows').textContent.includes('Active trainer')&&!document.getElementById('petCompareRows').textContent.includes('Inactive trainer'),'only recently active users are compared');
    check(document.querySelector('#petCompareRows tr').classList.contains('is-me'),'ranking puts the higher level first even with less weight');
    const rankingMode=document.getElementById('petCompareMode');
    rankingMode.value='power';rankingMode.dispatchEvent(new Event('change'));await new Promise(resolve=>setTimeout(resolve,0));
    check(document.querySelector('#petCompareRows .pet-compare-power')?.textContent.length>0&&document.getElementById('petCompareDescription').textContent.includes('lực chiến'),'ranking can switch to weighted battle power');
    rankingMode.value='level';rankingMode.dispatchEvent(new Event('change'));await new Promise(resolve=>setTimeout(resolve,0));
    const rivalRanking=[...document.querySelectorAll('#petCompareRows tr')].find(row=>row.textContent.includes('Active trainer'));
    check(rivalRanking.querySelector('.pet-compare-weight').textContent==='9,0 kg','ranking still displays pet weight');
    document.querySelector('#petCompareRows .pet-compare-picture').click();
    check(document.getElementById('petRankingPreviewDialog').open&&modelViews.get('petRankingPreviewModel')?.mode==='showcase','the ranked pet opens a rotating model');
    document.getElementById('petRankingPreviewClose').click();
    check(!modelViews.has('petRankingPreviewModel'),'closing the ranking preview releases the renderer');
    rivalRanking.querySelector('.pet-compare-history-button').click();
    const historyText=document.getElementById('petBattleHistoryList').textContent;
    check(document.getElementById('petBattleHistoryDialog').open&&historyText.includes('Thắng · Rival')&&historyText.includes('+1 EXP · +0,2 kg'),'ranking opens the selected pet history with signed totals');
    document.getElementById('petBattleHistoryClose').click();
    const cloudRows=buildPetComparison(usersDirectorySnapshot.docs.map(doc=>({id:doc.id,...doc.data()})),comparisonNow);
    const cloudHistory=cloudRows[0].battleHistory,cloudCalls=[];
    petCloudRequest=async(kind,data)=>{
        cloudCalls.push([kind,data]);
        if(kind==='history')return {entries:cloudHistory};
        const {battleHistory,...row}=cloudRows[0];
        return data.offset?{rows:[{...row,petId:'second-pet',rank:2}],nextOffset:null}:{rows:[row],nextOffset:20};
    };
    document.getElementById('petCompareClose').click();
    PET_CLOUD_ENABLED=true;
    renderAttendancePet();
    check(cloudCalls.length===0,'background pet render does not load ranking or history');
    document.getElementById('petCompareOpen').click();await Promise.resolve();
    check(cloudCalls.length===1&&cloudCalls[0][0]==='ranking'&&document.querySelectorAll('#petCompareRows tr').length===1,'cloud ranking opens with the first page only');
    document.getElementById('petCompareMore').click();await Promise.resolve();
    check(cloudCalls[1][1].offset===20&&document.querySelectorAll('#petCompareRows tr').length===2,'ranking fetches the next page on demand');
    document.querySelector('#petCompareRows .pet-compare-history-button').click();await Promise.resolve();
    check(cloudCalls[2][0]==='history'&&document.getElementById('petBattleHistoryList').textContent.includes('Rival'),'cloud history fetches only after the row action');
    document.getElementById('petBattleHistoryClose').click();
    document.querySelector('#petCompareRows .pet-compare-history-button').click();await Promise.resolve();
    check(cloudCalls.length===3,'reopening recent history uses the cache');
    document.getElementById('petBattleHistoryClose').click();
    PET_CLOUD_ENABLED=false;renderPetComparison(true);
    check(rivalRanking.querySelector('.pet-compare-xp').textContent==='0/10 EXP · Còn 10 EXP','comparison shows EXP within the current level and remaining EXP');
    check(document.querySelector('#petCompareRows .is-me'),'own pets are highlighted');
    document.getElementById('petCompareBranch').value='fish';document.getElementById('petCompareBranch').dispatchEvent(new Event('change'));
    check(document.querySelectorAll('#petCompareRows tr').length===1,'comparison filters pet branch');
    check(petWrites===writesBeforeCompare,'comparison does not write Firebase');
    document.getElementById('petCompareClose').click();document.getElementById('petCompareDialog').dispatchEvent(new Event('close'));check(!document.getElementById('petComparisonRenderWorker'),'closing comparison releases thumbnail renderer');document.getElementById('petCompareBranch').value='all';
    petRecord.attendancePet={...newAttendancePet(Date.now()-7200000),branch:'bird',checkins:90,lastCheckinAt:Date.now()-3600000,lastCheckinDay:attendancePetDay(Date.now()),feeds:2};
    attendancePetData=petRecord.attendancePet;selectedAttendancePetId=null;
    usersDirectorySnapshot={docs:[{id:'me',ref:{collection:'users',id:'me'},data:()=>petRecord}]};
    initPetAdminPanel();initPetAdminPanel();document.getElementById('petAdminOpen').click();await new Promise(resolve=>setTimeout(resolve,0));
    const adminPanel=document.getElementById('petAdminPanel'),levelButton=adminPanel.querySelector('[data-pet-admin="level"]'),branchButton=document.getElementById('petAdminApplyBranch');
    document.getElementById('petAdminLevel').value='12';document.getElementById('petAdminBranch').value='dino';
    const adminBefore=JSON.parse(JSON.stringify(petRecord.attendancePet)),adminTx=petTransactions,adminWrites=petWrites;
    let releaseAdmin;petTransactionGate=new Promise(resolve=>releaseAdmin=resolve);
    levelButton.click();
    check(petAdminBusy&&levelButton.disabled&&levelButton.classList.contains('pet-admin-pending'),'only clicked admin button shows processing');
    check([...adminPanel.querySelectorAll('button')].filter(button=>button!==levelButton).every(button=>!button.disabled&&!button.classList.contains('pet-admin-pending')),'other admin buttons never toggle disabled styling');
    branchButton.click();adminPanel.querySelector('[data-pet-admin="feed"]').click();levelButton.click();
    check(petTransactions===adminTx+1,'rapid clicks and repeated initialization start exactly one transaction');
    releaseAdmin();petTransactionGate=null;await new Promise(resolve=>setTimeout(resolve,0));
    check(petWrites===adminWrites+1&&petTransactions===adminTx+1,'level click commits exactly one update');
    check(attendancePetView(petRecord.attendancePet).level===12&&petRecord.attendancePet.branch==='bird'&&petRecord.attendancePet.feeds===adminBefore.feeds&&petRecord.attendancePet.lastCheckinAt===adminBefore.lastCheckinAt,'applying level does not apply branch, food, resurrection or attendance');
    check(document.getElementById('petAdminBranch').value==='dino','unrelated pending branch selection is preserved');
    check(petTransactionOptions.at(-1).maxAttempts===1,'admin transaction does not automatically retry');
    check(!petAdminBusy&&!levelButton.disabled&&!levelButton.classList.contains('pet-admin-pending'),'clicked button is restored after completion');
    levelButton.click();await new Promise(resolve=>setTimeout(resolve,0));check(petTransactions===adminTx+1&&petWrites===adminWrites+1,'same level does not read or write Firebase again');
    const levelXp=petRecord.attendancePet.checkins;branchButton.click();await new Promise(resolve=>setTimeout(resolve,0));
    check(petTransactions===adminTx+2&&petWrites===adminWrites+2&&petRecord.attendancePet.branch==='dino'&&petRecord.attendancePet.checkins===levelXp&&petRecord.attendancePet.lastCheckinAt===adminBefore.lastCheckinAt,'branch click performs one branch-only update');
    branchButton.click();await new Promise(resolve=>setTimeout(resolve,0));check(petTransactions===adminTx+2,'same branch does not trigger another transaction');
    petReject=true;document.getElementById('petAdminLevel').value='13';levelButton.click();await new Promise(resolve=>setTimeout(resolve,0));petReject=false;
    check(petWrites===adminWrites+2&&!petAdminBusy&&!levelButton.disabled,'failed admin action writes nothing and releases the lock');
    document.getElementById('petAdminClose').click();
    usersDirectorySnapshot.docs.push({id:'trainer',data:()=>({uid:'trainer',displayName:'Rival trainer'})});
    document.getElementById('petBattleOpen').click();
    check(document.getElementById('petBattleLobby').open&&!document.getElementById('petBattleDialog').open,'lobby opens from care screen');
    const botPicker=document.getElementById('petBattleMatches');
    botPicker.value='bot:new';botPicker.dispatchEvent(new Event('change'));
    check(!document.getElementById('petBattleBotSlot').hidden&&!document.getElementById('petBattleStatComparison').hidden,'bot stats and model are visible in the draft');
    const guardianButtons=[...document.querySelectorAll('[data-battle-element]')];
    check(guardianButtons.length===10&&!document.querySelector('[data-battle-element="earth"]')&&!document.querySelector('[data-battle-element="sphinx"]')&&document.getElementById('petBattleGuardianAdvice').textContent.includes('Đối thủ:'),'only the ten listed guardians remain selectable');
    check(guardianButtons.every(button=>button.classList.contains('pet-guardian-button')&&button.querySelector('.pet-guardian-icon')&&button.querySelector('.pet-guardian-affinity')),'guardian choices use uniform icon, name and affinity cards');
    document.querySelector('[data-bot-difficulty="medium"]').click();
    check(document.querySelector('[data-bot-difficulty="medium"]').getAttribute('aria-pressed')==='true'&&document.getElementById('petBattleBotName').textContent.includes('108 điểm'),'medium Bot button changes the live opponent to 108 points');
    document.querySelector('[data-bot-difficulty="hard"]').click();
    check(document.querySelector('[data-bot-difficulty="hard"]').getAttribute('aria-pressed')==='true'&&document.getElementById('petBattleBotName').textContent.includes('120 điểm'),'hard Bot button changes the live opponent to 120 points');
    const botSnapshot=()=>({
     name:document.getElementById('petBattleBotName').textContent,
     form:modelViews.get('petBattleBotModel')?.view.form.name,
     guardian:document.getElementById('petBattleBotModel').style.getPropertyValue('--pet-battle-element-color'),
     stats:[...document.querySelectorAll('#petBattleDraftStats1 progress')].map(progress=>progress.value)
    });
    const firstHardBot=botSnapshot();
    document.querySelector('[data-bot-difficulty="hard"]').click();
    const rerolledHardBot=botSnapshot();
    check(firstHardBot.name!==rerolledHardBot.name&&firstHardBot.guardian!==rerolledHardBot.guardian&&JSON.stringify(firstHardBot.stats)!==JSON.stringify(rerolledHardBot.stats),'pressing the selected Bot difficulty again changes the Bot, guardian and stat allocation');
    check(document.getElementById('petBattleBotName').textContent.includes('120 điểm'),'reroll keeps the selected Bot stat budget');
    check(document.querySelectorAll('#petBattleDraftStats0 > div').length===8&&document.querySelectorAll('#petBattleDraftStats1 > div').length===8,'both 3D pet cards contain eight comparison stat bars');
    check(document.getElementById('petBattleBotStart').hidden,'bot cannot start without an element');
    document.querySelector('[data-battle-element="metal"]').click();
    check(document.getElementById('petBattleSpiritName').textContent==='Bạch Hổ'&&document.getElementById('petBattleSpiritPassive').textContent.includes('16 điểm phần trăm')&&document.getElementById('petBattleSpiritUltimate').textContent.includes('×1,8')&&document.getElementById('petBattleSpiritIcon').querySelector('i').classList.contains('bi-crosshair'),'choosing a guardian displays its passive, ultimate and skill icon');
    check([0,1].every(side=>document.getElementById('petBattleStatusFx'+side).parentElement.id==='petBattleModel'+side&&document.getElementById('petBattleStatusFx'+side).querySelector('.burn-flame')&&document.getElementById('petBattleStatusFx'+side).querySelector('.heal-sign')&&document.getElementById('petBattleStatusFx'+side).querySelector('.reflect-mark')),'burn, healing, reflection and guardian indicators are anchored to each pet model');
    check(!document.getElementById('petBattleBotStart').hidden,'bot is ready to fight once the setup is complete');
    document.getElementById('petBattleClose').click();
    document.getElementById('petBattleNew').click();
    check(document.getElementById('petBattleDialog').open&&!document.getElementById('petBattleDraftSlots').hidden,'create opens a dedicated room with an opponent slot');
    const hostModel=document.getElementById('petBattleDraftModel'),elementPicker=document.getElementById('petBattleElement');
    check(!hostModel.hidden&&modelViews.get(hostModel.id)?.mode==='draft','host slot shows the selected pet model');
    document.querySelector('[data-battle-element="water"]').click();
    check(elementPicker.value==='water'&&document.querySelectorAll('[data-battle-element][aria-pressed="true"]').length===1,'element buttons select exactly one element');
    check(hostModel.classList.contains('has-element-aura')&&hostModel.style.getPropertyValue('--pet-battle-element-color')==='#38bdf8','draft model shows the selected element aura immediately');
    elementPicker.value='';elementPicker.dispatchEvent(new Event('change'));
    check(!hostModel.classList.contains('has-element-aura'),'clearing the draft element removes its aura');
    document.querySelector('#petBattleDialog [data-pet-guide="battle"]').click();
    const battleGuide=document.getElementById('petGuideBattle'),balance=document.getElementById('petBattleBalance');
    check(guide.open&&!battleGuide.hidden&&!balance.hidden&&balance.textContent.includes('để cược')&&battleGuide.textContent.includes('Tương khắc bốn hệ')&&battleGuide.textContent.includes('Kỳ Lân'),'battle guide shows the current pet balance and updated guardian rules');
    document.getElementById('petGuideClose').click();
    document.getElementById('petBattleAddOpponent').click();
    check(document.getElementById('petBattleInvitePicker').open,'plus opens the opponent picker');
    check(document.querySelector('#petBattleOpponentList [data-invite-uid="trainer"]').textContent==='+'&&document.getElementById('petBattleOpponentList').textContent.includes('Rival trainer'),'each invite card shows its own plus action');
    document.getElementById('petBattleInvitePickerClose').click();
    const battlePet=attendancePetSelected(attendancePetData,document.getElementById('petBattlePet').value),battleView=attendancePetView(battlePet);
    const statsSum=()=>['petBattleAttack','petBattleMagic','petBattleDefense','petBattleMagicReduction','petBattlePhysicalReduction','petBattleDodge','petBattleLuck','petBattleHealth'].reduce((sum,id)=>sum+Number(document.getElementById(id).value),0);
    check(statsSum()===petBattleBudget(battleView.level),'battle allocation uses one bonus point per level');
    check(document.getElementById('petBattleDraftPower').classList.contains('pet-power-badge')&&Number(document.getElementById('petBattleDraftPower').textContent)>0,'battle power updates in a dedicated badge from the selected stat allocation');
    document.getElementById('petBattleAttack').value=Number(document.getElementById('petBattleAttack').value)+1;document.getElementById('petBattleAttack').dispatchEvent(new Event('input'));
    check(document.getElementById('petBattleRemaining').textContent==='Dư 1 điểm','over-allocation shows the exact excess');
    const savedAttack=document.getElementById('petBattleAttack').value;
    document.getElementById('petBattleClose').click();document.getElementById('petBattleNew').click();
    check(document.getElementById('petBattleAttack').value===savedAttack&&document.getElementById('petBattleRemaining').classList.contains('invalid'),'Chrome draft restores all edited points when room reopens without silently rebalancing');
    document.getElementById('petBattleBalanceStats').click();check(statsSum()===petBattleBudget(battleView.level),'balanced allocation restores exact point total');
    const fightMe=petBattleFighter({uid:'me',displayName:'Trainer',attendancePet:attendancePetData},'me',battlePet.id,Object.fromEntries(Object.entries({attack:'petBattleAttack',magic:'petBattleMagic',defense:'petBattleDefense',magicReduction:'petBattleMagicReduction',physicalReduction:'petBattlePhysicalReduction',dodge:'petBattleDodge',luck:'petBattleLuck',health:'petBattleHealth'}).map(([key,id])=>[key,Number(document.getElementById(id).value)])));
    const opponentRaw={...newAttendancePet(Date.now()-7200000),branch:'dino',weightGrams:1000,lastCheckinAt:Date.now()},opponentId=attendancePetRecords(opponentRaw)[0].id;
    const fightOther=petBattleFighter({uid:'opponent',displayName:'Rival',attendancePet:opponentRaw},'opponent',opponentId,{attack:34,defense:33,health:33});
    const timeline=petBattleSimulation([fightMe,fightOther],'me'),battleState=PetBattleGame.inspect();
    const auraButton=document.getElementById('attendancePetSwimmer'),auraPet={...battlePet,victoryAuraUntil:Date.now()+3600000};
    renderPetHungerBubble(auraButton,attendancePetView(auraPet));
    check(auraButton.classList.contains('pet-victory-aura')&&!auraButton.querySelector('.pet-victory-halo'),'winner glows without a ring');
    const defeatedPet={...auraPet,defeatAuraUntil:auraPet.victoryAuraUntil+1000,defeatOpponentName:'Rival'};
    renderPetHungerBubble(auraButton,attendancePetView(defeatedPet));
    check(auraButton.classList.contains('pet-defeat-aura')&&!auraButton.classList.contains('pet-victory-aura'),'newer loss displays the gray aura');
    const defeatBubble=auraButton.querySelector('.pet-hunger-bubble');
    check(!defeatBubble.hidden&&defeatBubble.textContent==='Tôi đã thua trận khi thách đấu Rival','defeat bubble names the opponent');
    renderPetHungerBubble(auraButton,attendancePetView({...defeatedPet,victoryAuraUntil:Date.now()-1001,defeatAuraUntil:Date.now()-1}));
    check(!auraButton.classList.contains('pet-victory-aura')&&!auraButton.classList.contains('pet-defeat-aura')&&!defeatBubble.textContent.includes('Rival'),'result aura and message disappear after expiry');
    const battleFixture={id:'ui-battle',status:'fighting',challengerUid:'me',opponentUid:'opponent',participantUids:['me','opponent'],players:[fightMe,fightOther],stakeGrams:200,createdMs:Date.now(),startedAt:Date.now()-3000,claims:{},commits:{},reveals:{},...timeline};
    const outgoing={...battleFixture,id:'ui-outgoing',status:'invited',players:[fightMe],turns:[],maxHp:[],startedAt:null,winnerUid:null,expiresAt:Date.now()+600000};
    battleState.matches.set(outgoing.id,outgoing);PetBattleGame.open(outgoing.id);
    check(document.getElementById('petBattleDamage1').textContent===''&&!document.getElementById('petBattleSide1').classList.contains('is-hit'),'outgoing invite with missing opponent has no phantom damage or render error');
    document.getElementById('petBattleClose').click();
    const incoming={...outgoing,id:'ui-incoming',challengerUid:'opponent',opponentUid:'me',participantUids:['opponent','me'],players:[fightOther]};
    const savedDirectory=usersDirectorySnapshot;
    usersDirectorySnapshot={docs:[{id:'opponent',data:()=>({uid:'opponent',displayName:'Rival',petBattleLocks:{'ui-incoming':{role:'challenger',peerUid:'me',createdAt:Date.now(),expiresAt:incoming.expiresAt}}})}]};
    PetBattleGame.sync();const inviteSnapshot=noteSnapshot;
    inviteSnapshot({id:incoming.id,exists:()=>true,data:()=>incoming});
    check(document.getElementById('petBattleDialog').open&&battleState.active===incoming.id&&!document.getElementById('petBattleAccept').hidden,'directory invitation opens recipient room with accept button');
    check(!document.getElementById('petBattleInvite').hidden&&document.getElementById('petBattleBadge').textContent==='1','incoming invite has a persistent banner and count');
    document.getElementById('petBattleClose').click();inviteSnapshot({id:incoming.id,exists:()=>true,data:()=>incoming});
    check(!document.getElementById('petBattleDialog').open,'repeat snapshots do not repeatedly reopen dismissed invitations');
    document.getElementById('petBattleViewInvite').click();check(document.getElementById('petBattleDialog').open,'banner reopens invitation after dismissal');
    inviteSnapshot({id:incoming.id,exists:()=>true,data:()=>({...incoming,status:'rps',players:[fightOther,fightMe]})});
    check(document.getElementById('petBattleInvite').hidden&&!document.getElementById('petBattleRps').hidden,'acceptance clears invite and shows RPS without a combat turn');
    check(modelViews.get('petBattleModel0')?.view.displayName===fightOther.petName&&modelViews.get('petBattleModel0')?.view.form.kind===fightOther.appearance.form.kind&&modelViews.get('petBattleModel1')?.view.displayName===fightMe.petName&&modelViews.get('petBattleModel1')?.view.form.kind===fightMe.appearance.form.kind,'accepted invitation renders the challenger pet and recipient pet on their correct sides');
    document.getElementById('petBattleClose').click();
    const battleSelect=document.getElementById('petBattleMatches');battleSelect.value=incoming.id;battleSelect.dispatchEvent(new Event('change'));
    check(document.getElementById('petBattleDialog').open&&!document.getElementById('petBattleRps').hidden&&document.getElementById('petBattleDamage0').textContent===''&&document.getElementById('petBattleDamage1').textContent==='','reopening accepted room from match selector is safe before either RPS move');
    for(const commits of [{opponent:'pending-hash'},{opponent:'pending-hash',me:'pending-hash'}]){
        inviteSnapshot({id:incoming.id,exists:()=>true,data:()=>({...incoming,status:'rps',players:[fightOther,fightMe],commits})});
        check(document.getElementById('petBattleDamage0').textContent===''&&document.getElementById('petBattleDamage1').textContent==='','RPS commits never render nonexistent damage');
    }
    usersDirectorySnapshot=savedDirectory;
    battleState.matches.set('ui-countdown',{...battleFixture,id:'ui-countdown',startedAt:Date.now()});PetBattleGame.open('ui-countdown');
    check(document.getElementById('petBattleDamage0').textContent===''&&document.getElementById('petBattleDamage1').textContent==='','fight countdown has no damage before the first turn');
    battleState.matches.set('ui-battle',battleFixture);PetBattleGame.open('ui-battle');
    check(!document.getElementById('petBattleRoom').hidden&&battleState.models.length===2,'accepted battle displays both pet renderers');
    const fightPlay=petBattlePlayback(battleFixture);check(Number(document.getElementById('petBattleHp0').value)===fightPlay.hp[0]&&Number(document.getElementById('petBattleHp1').value)===fightPlay.hp[1],'room HP follows shared automatic turn timeline');
    check(document.getElementById('petBattleDialog').scrollWidth<=document.getElementById('petBattleDialog').clientWidth+1,'battle room has no horizontal clipping');
    check(document.querySelector('.pet-battle-skill')?.classList.contains('skill-fire'),'dinosaur attack has its own elemental visual');
    const revealFixture={...battleFixture,id:'ui-rps-result',firstUid:'me',introMs:5000,startedAt:Date.now(),reveals:{me:{choice:'rock'},opponent:{choice:'scissors'}}};
    battleState.matches.set(revealFixture.id,revealFixture);PetBattleGame.open(revealFixture.id);
    check(!document.getElementById('petBattleRpsReveal').hidden&&document.getElementById('petBattleRpsWinner').textContent.includes('Trainer')&&document.getElementById('petBattleRpsHands').textContent.includes('✌'),'RPS reveal shows both hands and first attacker');
    check(petBattlePlayback(revealFixture).count===0&&document.getElementById('petBattleRpsCountdown').textContent.includes('5'),'five second reveal precedes combat');
    const readyFixture={...battleFixture,id:'ui-ready',roomFlow:true,status:'ready',startedAt:null,turns:[],maxHp:[],winnerUid:null,ready:{me:true},readyDeadline:Date.now()+120000};
    battleState.matches.set(readyFixture.id,readyFixture);PetBattleGame.open(readyFixture.id);
    check(!document.getElementById('petBattleReadyPanel').hidden&&document.getElementById('petBattleReady').hidden&&document.getElementById('petBattleReady0').textContent==='Đã sẵn sàng','the ready badge appears next to the pet while waiting');
    const done={...battleFixture,id:'ui-done',status:'finished',startedAt:Date.now()-999999};battleState.matches.set(done.id,done);PetBattleGame.open(done.id);
    const exitDialog=document.getElementById('petBattleExitDialog');
    check(exitDialog.open&&document.getElementById('petBattleExitWinner').textContent.length>0,'finished room automatically opens a result form');
    document.getElementById('petBattleStay').click();
    check(!exitDialog.open&&document.getElementById('petBattleDialog').open,'stay closes only the result form');
    done.claims={me:true};PetBattleGame.open(done.id);document.getElementById('petBattleFinish').click();
    document.getElementById('petBattleExitConfirm').click();
    check(!document.getElementById('petBattleDialog').open&&!battleState.matches.has(done.id),'finish clears room after own payout');
    check(document.getElementById('petBattleLobby').open&&![...document.getElementById('petBattleMatches').options].some(option=>option.value===done.id),'finished room returns to lobby and no longer appears in list');
    PetBattleGame.open('ui-battle');
    document.getElementById('petBattleClose').click();check(battleState.models.length===0,'closing battle releases both renderers without cancelling match');PetBattleGame.stop();
    const quotaText=petQuotaErrorText({code:'resource-exhausted'});
    check(quotaText.includes('429'),'quota error is identified instead of reported as permission failure');
    let quotaBlocked=false;try{assertPetQuotaAvailable();}catch(error){quotaBlocked=error.code==='resource-exhausted';}
    check(quotaBlocked,'quota cooldown prevents repeated pet requests');
    petQuotaRetryAt=0;sessionStorage.removeItem('workpicPetQuotaRetryAt');
    stopAttendancePet();check(!document.getElementById('attendancePetDialog').open&&document.getElementById('attendancePetSwimmer').hidden,'sign-out clears the companion UI');
    if(!${process.argv.includes('--pet-layout')}){
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
    noteSnapshot({docs:[{id:'image',data:()=>({senderId:'other',senderName:'Image sender',content:noteWrites[0].data.content,clientCreatedAt:'2026-11-18T09:00:00Z'})}]});
    const thumbnail=document.querySelector('#sharedNotesList .shared-note-content img');thumbnail.click();
    const imageDialog=document.getElementById('sharedNoteImageDialog'),fullImage=document.getElementById('sharedNoteImageFull');
    check(imageDialog.open&&fullImage.src===thumbnail.src,'clicking note image opens centered image viewer');
    await fullImage.decode();
    document.querySelector('[data-note-image-zoom="in"]').click();
    check(imageDialog.classList.contains('zoomed')&&parseInt(fullImage.style.width)>fullImage.naturalWidth,'image can be zoomed to inspect details');
    document.querySelector('[data-note-image-zoom="fit"]').click();
    check(!imageDialog.classList.contains('zoomed'),'fit resets image to viewport');
    document.getElementById('sharedNoteImageClose').click();imageDialog.dispatchEvent(new Event('close')); // Flush native dialog cleanup in the virtual-time harness.
    check(!imageDialog.open&&sharedNotesOpen&&!fullImage.hasAttribute('src'),'closing viewer keeps notes panel and releases image '+JSON.stringify({open:imageDialog.open,notes:sharedNotesOpen,src:fullImage.hasAttribute('src')}));
    thumbnail.dispatchEvent(new KeyboardEvent('keydown',{key:'Enter',bubbles:true,cancelable:true}));
    check(imageDialog.open,'image viewer supports keyboard activation');imageDialog.click();
    check(!imageDialog.open&&sharedNotesOpen,'clicking backdrop closes only image viewer');
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
    const editedArticle=document.querySelector('[data-note-edit="mine"]').closest('article');
    check(editedArticle.querySelector('.shared-note-times').textContent.includes('Đã chỉnh sửa')&&editedArticle.querySelectorAll('header time').length===2,'edit timestamp appears beside original send time');
    check(editedArticle.querySelector('.shared-note-sender [data-note-edit]')&&editedArticle.querySelector('.shared-note-sender [data-note-delete]'),'edit and delete buttons sit beside the sender name');
    check(getComputedStyle(editedArticle.querySelector('.shared-note-edited')).color==='rgb(220, 38, 38)'||getComputedStyle(editedArticle.querySelector('.shared-note-edited')).color==='rgb(248, 113, 113)','edited label is red in either theme');
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
    noteSnapshot({docs:[{id:'new',data:()=>({senderId:'other',senderName:'Newest',content:'New',clientCreatedAt:'2026-11-18T11:00:00Z'})},{id:'old',data:()=>({senderId:'other',senderName:'Oldest',content:'Old',clientCreatedAt:'2026-11-18T10:00:00Z'})}]});
    check(document.querySelector('#sharedNotesList article:first-child strong').textContent==='Oldest'&&document.querySelector('#sharedNotesList article:last-child strong').textContent==='Newest','newest notes appear at the bottom');
    noteEditor.textContent='Keyboard note';
    const shiftEnter=new KeyboardEvent('keydown',{key:'Enter',shiftKey:true,bubbles:true,cancelable:true});noteEditor.dispatchEvent(shiftEnter);
    check(!shiftEnter.defaultPrevented&&noteWrites.length===1,'Shift+Enter keeps native newline behavior');
    const composingEnter=new KeyboardEvent('keydown',{key:'Enter',isComposing:true,bubbles:true,cancelable:true});noteEditor.dispatchEvent(composingEnter);
    check(!composingEnter.defaultPrevented&&noteWrites.length===1,'IME confirmation does not send prematurely');
    const enter=new KeyboardEvent('keydown',{key:'Enter',bubbles:true,cancelable:true});noteEditor.dispatchEvent(enter);await new Promise(resolve=>setTimeout(resolve,0));
    check(enter.defaultPrevented&&noteWrites.length===2&&!noteEditor.innerHTML,'Enter sends exactly one note');
    rejectNoteWrite=true; noteEditor.innerHTML='<p>Keep draft</p>'; await submitNote();
    check(noteEditor.textContent==='Keep draft','failed note preserves draft');
    check(!document.getElementById('sharedNotesSend').disabled,'failed note re-enables send');
    const listenersRemovedBeforeSignOut=noteUnsubscribed;
    stopSharedNotes();
    check(noteUnsubscribed===listenersRemovedBeforeSignOut+1&&document.getElementById('sharedNotesToggle').hidden,'sign-out removes shared listener and button');
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
    }
    if(${process.argv.includes('--pet-layout')}){
        document.querySelectorAll('dialog[open]').forEach(dialog=>dialog.close());
        document.body.className='theme-dark';document.documentElement.dataset.theme='dark';
        currentUser={uid:'me',displayName:'Trainer'};attendancePetReady=true;attendancePetBusy=false;attendancePetVisible=true;
        attendancePetData=transitionPetHousehold({...newAttendancePet(Date.now()-7200000),checkins:290,branch:'dino',nickname:'Adventure companion',lastCheckinAt:Date.now()},'init').pet;
        selectedAttendancePetId=attendancePetRecords(attendancePetData)[1].id;renderAttendancePet();
        const care=document.getElementById('attendancePetDialog');care.showModal();AttendancePet3D.preview(true);
        if(${process.argv.includes('--compare-layout')}){document.getElementById('petCompareOpen').click();const comparison=document.getElementById('petCompareDialog');check(comparison.scrollWidth<=comparison.clientWidth+1,'comparison fits viewport without horizontal clipping');}
        if(${process.argv.includes('--battle-layout')}){const gameState=PetBattleGame.inspect();gameState.uid='me';gameState.own={uid:'me',attendancePet:attendancePetData};gameState.matches.set(battleFixture.id,{...battleFixture,startedAt:Date.now()-4500});PetBattleGame.open(battleFixture.id);check(document.getElementById('petBattleDialog').scrollWidth<=document.getElementById('petBattleDialog').clientWidth+1,'arena fits viewport');}
        check(care.scrollWidth<=care.clientWidth+1,'care preview has no horizontal overflow');
        document.body.insertAdjacentHTML('beforeend','<pre id="smoke-result">PASS: pet game layout</pre>');
    }else{
    document.body.innerHTML='<pre id="smoke-result">PASS: attendance pet (check-in, feeding, stale tabs, resurrection, write errors), shared notes, event editor, recurrence, history and checklist</pre>';
    }

} catch(error) {document.body.innerHTML='<pre id="smoke-result">FAIL: '+escapeHtml(error.stack)+'</pre>';}
`;
try {
    const html = markup.replace('</head>', `<style>${fs.readFileSync('styles.css','utf8')}\n.d-none{display:none!important}</style></head>`).replace('</body>', `<script type="module">${script}</script></body>`);
    const target = path.join(temp, 'smoke.html'); fs.writeFileSync(target, html);
    const layoutArgs=process.argv.includes('--pet-layout')?['--window-size='+(process.argv.includes('--laptop')?'1366,768':'800,600'),'--screenshot='+path.resolve('.artifacts/'+(process.argv.includes('--battle-layout')?'pet-battle-':process.argv.includes('--compare-layout')?'pet-comparison-':'pet-care-')+(process.argv.includes('--laptop')?'laptop':'compact')+'.png')]:[];
    if(layoutArgs.length)fs.mkdirSync('.artifacts',{recursive:true});
    const result = spawnSync(chrome, ['--window-size=1366,768',...layoutArgs,'--run-all-compositor-stages-before-draw','--disable-background-timer-throttling','--headless', '--disable-gpu', '--no-first-run', '--disable-extensions', '--allow-file-access-from-files', `--user-data-dir=${path.join(temp, 'profile')}`, '--dump-dom', '--virtual-time-budget=12000', pathToFileURL(target).href], {encoding:'utf8', timeout:60000, windowsHide:true, maxBuffer:8*1024*1024});
    const output = result.stdout?.replace(/<script\b[^>]*>[\s\S]*?<\/script>/gi,'').match(/<pre id="smoke-result">([\s\S]*?)<\/pre>/)?.[1];
    assert.ok(output?.startsWith('PASS:'), output || result.error?.message || 'Last UI step: '+result.stdout?.match(/data-ui-step="([^"]*)"/)?.[1]+' '+result.stderr?.slice(-500));
    console.log(output);
} finally {
    const resolved = path.resolve(temp);
    if (resolved.startsWith(path.resolve(os.tmpdir()) + path.sep) && path.basename(resolved).startsWith('workpic-ui-')) fs.rmSync(resolved, {recursive:true,force:true,maxRetries:5,retryDelay:200});
}

})();

// ===== attendance-pet GPU checks =====
if(process.argv.includes('--pet')||process.argv.includes('--pet-portraits')) await (async()=>{
 const portraits=process.argv.includes('--pet-portraits');
 const chrome=['C:/Program Files/Google/Chrome/Application/chrome.exe','C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe'].find(fs.existsSync);assert.ok(chrome,'browser required');
 const temp=fs.mkdtempSync(path.join(os.tmpdir(),'workpic-pet-'));
 try{
  const response=await fetch('https://cdn.jsdelivr.net/npm/three@0.160.0/build/three.module.js',{signal:AbortSignal.timeout(15000)});assert.ok(response.ok);fs.writeFileSync(path.join(temp,'three.module.js'),await response.text());
  const source=fs.readFileSync('app.js','utf8').replace(/\r\n/g,'\n');
  const shared=source.split('// BEGIN SHARED HELPERS\n')[1].split('// END SHARED HELPERS')[0];
  let code=source.slice(source.indexOf('function attendancePetSvg('),source.indexOf('let attendancePetData ='));
  code=code.replace("import('https://cdn.jsdelivr.net/npm/three@0.160.0/build/three.module.js')",'Promise.resolve(THREE)').replace('return {start,stop,update,preview,thumbnail,','return {inspect:()=>state,start,stop,update,preview,thumbnail,');
  const script=`import * as THREE from './three.module.js';
${shared}
const renderAttendancePet=()=>{};
${code}
try {
 const check=(ok,message)=>{if(!ok)throw Error(message)};
 const MOBILE_BATTLE_MODE=${process.argv.includes('--pet-mobile')};
 if(PORTRAITS_MODE){
  const renderer=AttendancePet3D;
  renderer.start();
  const state=renderer.inspect();await state.ready;
  check(state.renderer,'3D renderer is unavailable');
  cancelAnimationFrame(state.raf);
  const common=attendancePetCatalog(null);
  const views=[{form:common[0],egg:true,level:0},...common.map((form,i)=>({form,level:i+1})),
   ...Object.entries(ATTENDANCE_PET_BRANCHES).flatMap(([branch,data])=>data.forms.map((form,i)=>({form,branch,level:10+i})))];
  const atlas=document.createElement('canvas'),width=112,height=80;
  atlas.width=width*10;atlas.height=height*Math.ceil(views.length/10);
  const ctx=atlas.getContext('2d');
  for(const [i,view] of views.entries()){
   renderer.update(view);
   state.model.rotation.y=.28;
   state.model.scale.setScalar(attendancePetPortraitScale(view));
   state.camera.position.z=7;
   state.camera.updateProjectionMatrix();
   state.renderer.render(state.scene,state.camera);
   ctx.drawImage(state.renderer.domElement,(i%10)*width,Math.floor(i/10)*height,width,height);
  }
  renderer.stop();
  document.body.innerHTML='<pre id="pet-result">PASS:'+atlas.toDataURL('image/webp',.84).split(',')[1]+'</pre>';
 } else {
 AttendancePet3D.start();
 let now=Date.now(),pet={...newAttendancePet(now-7200000),lastCheckinAt:now};
 AttendancePet3D.update(attendancePetView(pet,now));
 check(!document.querySelector('#attendancePetArt svg'),'loading WebGL does not flash a 2D model');
 for(let i=0;i<50&&!AttendancePet3D.inspect()?.renderer;i++)await new Promise(resolve=>setTimeout(resolve,100));
 const s=AttendancePet3D.inspect();check(s?.renderer,'real WebGL pet renderer starts');
 const cards=[];
 const capture=(view,label)=>{
  AttendancePet3D.update(view);s.model.rotation.y=.25;s.model.rotation.z=0;s.renderer.render(s.scene,s.camera);
  const gl=s.renderer.getContext(),pixels=new Uint8Array(s.renderer.domElement.width*s.renderer.domElement.height*4);gl.readPixels(0,0,s.renderer.domElement.width,s.renderer.domElement.height,gl.RGBA,gl.UNSIGNED_BYTE,pixels);
  check(pixels.some((value,index)=>index%4===3&&value>0),'visible 3D creature: '+label);
  cards.push('<article><img src="'+s.renderer.domElement.toDataURL()+'"><strong>'+label+'</strong></article>');
 };
 capture(attendancePetView(newAttendancePet(now),now),'Trứng');
 if(!${process.argv.includes('--pet-fleet-only')}){
 for(let index=0;index<ATTENDANCE_PET_FORMS.length;index++){pet={...pet,checkins:index*10};capture(attendancePetView(pet,now),'Cấp '+(index+1)+' · '+ATTENDANCE_PET_FORMS[index].name);}
 for(const [key,branch] of Object.entries(ATTENDANCE_PET_BRANCHES))for(let index=0;index<branch.forms.length;index++){
  pet={...pet,branch:key,checkins:(index+9)*10};capture(attendancePetView(pet,now),branch.name+' '+(index+1)+' - '+branch.forms[index].name);
 }
 }else{
  for(const branch of Object.keys(ATTENDANCE_PET_BRANCHES))capture(attendancePetView({...pet,branch,checkins:290},now),ATTENDANCE_PET_BRANCHES[branch].forms.at(-1).name);
  capture(attendancePetView({...pet,branch:'fish',checkins:200},now),'Nàng tiên cá');
 }
 const petDialog=document.createElement('dialog');petDialog.id='attendancePetDialog';petDialog.innerHTML='<div id="attendancePetPreview"></div>';document.body.appendChild(petDialog);petDialog.showModal();
 AttendancePet3D.preview(true);
 check(s.renderer.domElement.parentElement.id==='attendancePetPreview','real 3D canvas moves into care form');
 const previewBox=document.getElementById('attendancePetPreview');
 check(Math.abs(s.camera.aspect-Math.min(360,previewBox.clientWidth||320)/(previewBox.clientHeight||220))<.001,'preview camera resizes without distortion');
 s.renderer.render(s.scene,s.camera);
 petDialog.close();AttendancePet3D.preview(false);
 check(s.renderer.domElement.parentElement.id==='attendancePetArt','closing care form restores swimming model');
 const peerButton=document.createElement('button');peerButton.id='fleet-test-pet';peerButton.className='attendance-pet-swimmer';peerButton.innerHTML='<span id="fleet-test-art"></span>';document.body.appendChild(peerButton);
 const peerRenderer=createAttendancePet3D('fleet-test-pet','fleet-test-art',null);peerRenderer.start();
 peerRenderer.update(attendancePetView({...newAttendancePet(now-7200000),branch:'dino',checkins:170,lastCheckinAt:now},now));
 await new Promise(resolve=>setTimeout(resolve,150));
 const peer=peerRenderer.inspect();check(peer.renderer&&peer.renderer!==s.renderer,'companions have independent WebGL renderers');
 peer.renderer.render(peer.scene,peer.camera);
 const peerGL=peer.renderer.getContext(),peerPixels=new Uint8Array(peer.renderer.domElement.width*peer.renderer.domElement.height*4);peerGL.readPixels(0,0,peer.renderer.domElement.width,peer.renderer.domElement.height,peerGL.RGBA,peerGL.UNSIGNED_BYTE,peerPixels);
 check(peerPixels.some((value,index)=>index%4===3&&value>0),'companion paints visible pixels');
 peerButton.hidden=true;
 const creatureImage=await peerRenderer.thumbnail(attendancePetView({...newAttendancePet(now-7200000),branch:'bird',checkins:90,lastCheckinAt:now},now));
 const eggImage=await peerRenderer.thumbnail(attendancePetView(newAttendancePet(now),now));
 check(creatureImage.startsWith('data:image/png')&&eggImage.startsWith('data:image/png')&&creatureImage!==eggImage,'hidden renderer captures distinct real creature and egg images');
 const decoded=new Image();decoded.src=creatureImage;await decoded.decode();check(decoded.naturalWidth>0&&decoded.naturalHeight>0,'thumbnail is a decodable image');
 const arenaButton=document.createElement('div');arenaButton.id='arena-test';arenaButton.innerHTML='<span id="arena-test-art"></span>';document.body.appendChild(arenaButton);
 const arenaRenderer=createAttendancePet3D('arena-test','arena-test-art',null,'arena');arenaRenderer.start();arenaRenderer.update(attendancePetView(pet,now));arenaRenderer.duelPose({facing:Math.PI,attackAt:Date.now(),skill:{motion:'claw',variant:4},skillColor:'#f97316'});
 await new Promise(resolve=>setTimeout(resolve,150));
 const arena=arenaRenderer.inspect();check(arena?.renderer&&arena.renderer!==peer.renderer,'arena has an independent real WebGL model');
 if(MOBILE_BATTLE_MODE)check(Math.abs(arena.renderer.getPixelRatio()-.75)<.001&&!arena.renderer.getContext().getContextAttributes().antialias,'mobile arena caps pixel density and disables antialiasing');
 const sphereGeometries=new Set();arena.model.traverse(object=>{if(object.geometry?.type==='SphereGeometry')sphereGeometries.add(object.geometry);});
 check(sphereGeometries.size<=1,'battle model reuses its sphere geometry');
 arena.renderer.render(arena.scene,arena.camera);const arenaGL=arena.renderer.getContext(),arenaPixels=new Uint8Array(arena.renderer.domElement.width*arena.renderer.domElement.height*4);arenaGL.readPixels(0,0,arena.renderer.domElement.width,arena.renderer.domElement.height,arenaGL.RGBA,arenaGL.UNSIGNED_BYTE,arenaPixels);check(arenaPixels.some((value,index)=>index%4===3&&value>0),'arena fighter paints visible pixels');
 arenaRenderer.duelPose({criticalAt:Date.now()});check(arena.criticalGroup&&arena.criticalGhost&&!arena.model.visible,'critical hit animates a floating pet spirit above its grave');
 arenaRenderer.duelPose({result:'defeat'});const gravePlaque=arena.resultGroup?.children.find(child=>child.material?.map);
 check(arena.resultGroup&&arena.resultGhost&&!arena.model.visible&&gravePlaque?.material.map.image.width===512,'defeated pet shows a grave with a high-resolution name plaque and clear ghost');
 check(arena.resultSpirit.children.some(child=>child.material?.color?.getHexString()==='163448'),'ghost has a visible face');
 arenaRenderer.duelPose({result:null});check(arena.model.visible&&!arena.resultGroup,'leaving the result pose restores the original pet model');
 arenaRenderer.stop();arenaButton.remove();
 const draft=document.createElement('div');draft.id='draft-test';draft.className='pet-battle-model pet-battle-draft-model';draft.innerHTML='<span id="draft-test-art"></span>';document.body.appendChild(draft);
 const draftRenderer=createAttendancePet3D(draft.id,'draft-test-art',null,'draft');
 const clownIndex=ATTENDANCE_PET_FORMS.findIndex(form=>form.shape==='clown');
 draftRenderer.start();draftRenderer.update(attendancePetView({...newAttendancePet(now-7200000),checkins:clownIndex*10},now));
 await new Promise(resolve=>setTimeout(resolve,150));
 const draftState=draftRenderer.inspect();
 check(draftState.renderer?.domElement.style.height===draftState.button.clientHeight+'px','draft WebGL matches its rendered slot height');
 const paintedBody=draftState.model.children.find(mesh=>mesh.material?.map);
 const colors=paintedBody.material.map.image.getContext('2d').getImageData(64,0,1,256).data;
 check([255,33,249].every(red=>colors.some((value,index)=>index%4===0&&value===red)),'clownfish skin includes warm white, dark borders and its orange base');
 draftRenderer.stop();draft.remove();
 peerRenderer.stop();peerButton.remove();check(s.renderer.domElement.parentElement.id==='attendancePetArt','disposing companion preserves selected pet');
 AttendancePet3D.feed();AttendancePet3D.stop();check(!document.querySelector('#attendancePetArt canvas'),'renderer disposes on stop');
 document.body.innerHTML='<main class="pet-gallery">'+cards.join('')+'</main><pre id="pet-result">PASS: all real 3D pet forms render visible pixels; renderer cleanup works</pre>';
 }
}catch(error){document.body.innerHTML='<pre id="pet-result">FAIL: '+error.stack+'</pre>';}
`;
  fs.writeFileSync(path.join(temp,'pet.html'),'<!doctype html><meta charset="utf-8"><style>'+fs.readFileSync('styles.css','utf8')+'body{background:#0c1524!important;color:white;padding:20px;height:auto;overflow:auto}.pet-gallery{display:grid;grid-template-columns:repeat(5,1fr);gap:14px}.pet-gallery article{display:grid;justify-items:center;gap:8px;padding:15px;background:#172337;border:1px solid #29405c;border-radius:14px}.pet-gallery img{width:190px;height:137px;object-fit:contain}.pet-gallery strong{font:13px sans-serif}#pet-result{color:#7dd3fc}</style><body><button id="attendancePetSwimmer" class="attendance-pet-swimmer"><span id="attendancePetArt"></span></button><script type="module">'+script.replace('PORTRAITS_MODE',String(portraits))+'</script>');
  const mobileBattle=process.argv.includes('--pet-mobile');
  if(!portraits&&!mobileBattle)fs.mkdirSync('.artifacts',{recursive:true});
  const result=spawnSync(chrome,['--headless','--no-first-run','--disable-extensions','--use-gl=angle','--use-angle=swiftshader','--enable-unsafe-swiftshader','--allow-file-access-from-files','--user-data-dir='+path.join(temp,'profile'),...(portraits?['--window-size=800,600']:mobileBattle?['--window-size=390,844','--force-device-scale-factor=3']:['--window-size=1500,3900','--screenshot='+path.resolve(process.argv.includes('--pet-fleet-only')?'.artifacts/attendance-pet-fleet.png':'.artifacts/attendance-pet-stages.png')]),'--dump-dom','--virtual-time-budget=30000',pathToFileURL(path.join(temp,'pet.html')).href],{encoding:'utf8',timeout:180000,windowsHide:true,maxBuffer:12*1024*1024});
  const output=result.stdout?.replace(/<script\b[^>]*>[\s\S]*?<\/script>/gi,'').match(/<pre id="pet-result">([\s\S]*?)<\/pre>/)?.[1];assert.ok(output?.startsWith('PASS:'),output||result.error?.message||result.stderr?.slice(-1500)||'No pet result');
  if(portraits)await writeFile('pet-portraits.webp',Buffer.from(output.slice(5),'base64'));
  else console.log(output);
 }finally{const resolved=path.resolve(temp);if(resolved.startsWith(path.resolve(os.tmpdir())+path.sep)&&path.basename(resolved).startsWith('workpic-pet-'))fs.rmSync(resolved,{recursive:true,force:true,maxRetries:5,retryDelay:200});}
})();

// ===== theme-fx-ui checks =====
if (process.argv.includes('--themes') && !process.env.ADMIN_UI_PREVIEW) await (async function () {
const chrome = ['C:/Program Files/Google/Chrome/Application/chrome.exe', 'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe'].find(p => fs.existsSync(p));
if (!chrome) { console.log('Theme GPU smoke skipped: Chrome/Edge unavailable.'); process.exit(0); }
const source = fs.readFileSync('app.js', 'utf8');
let code = source.slice(source.indexOf('const ThreeFx ='), source.indexOf('// CƯỜNG ĐỘ HIỆU ỨNG'));
const rainCode = source.slice(source.indexOf('function advanceStormWater('), source.indexOf('function jobColorStyle(')) + source.slice(source.indexOf('const RainFx ='), source.indexOf('// Thiên hà xoắn ốc'))
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
    const output=result.stdout?.replace(/<script\b[^>]*>[\s\S]*?<\/script>/gi,'').match(/<pre id="fx-result">([\s\S]*?)<\/pre>/)?.[1];
    assert.ok(output?.startsWith('PASS:'),output||result.error?.message||result.stderr?.slice(-1500)||'GPU smoke did not finish');
    console.log(output);
} finally {
    const resolved=path.resolve(temp);
    if(resolved.startsWith(path.resolve(os.tmpdir())+path.sep)&&path.basename(resolved).startsWith('workpic-fx-'))fs.rmSync(resolved,{recursive:true,force:true,maxRetries:5,retryDelay:200});
}

})();
    },

    "test:performance": async () => {
const source = fs.readFileSync('app.js', 'utf8').replace(/\r\n/g, '\n');
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
        check(style.whiteSpace==='normal'&&style.overflow==='visible'&&parseFloat(style.fontSize)>=parseFloat(getComputedStyle(document.documentElement).fontSize)*.9,'event follows responsive type scale and is not truncated');
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
