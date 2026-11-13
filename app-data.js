// Shared application data helpers, calendar calculations and admin persistence.

// ===== work-hours-data =====
// Pure conversion shared by the browser and regression checks.
export function convertWorkHoursRows(rows) {
    if (!Array.isArray(rows)) throw new Error('Dữ liệu query không hợp lệ.');
    const days = ['THU', 'FRI', 'SAT', 'SUN', 'MON', 'TUE', 'WED'];
    const result = new Map();
    const sources = new Map();
    const key = d => d.toISOString().slice(0, 10);
    for (const raw of rows) {
        const row = Object.fromEntries(Object.entries(raw).map(([k, v]) => [k.toUpperCase(), v]));
        const kind = String(row.KIND || '').trim().toUpperCase();
        const line = String(row.LINE || '').trim().toUpperCase();
        // The schedule uses O100 for Station; other lines do not contribute hours.
        if (!['M151', 'O100'].includes(line)) continue;
        if (!((kind === 'MOTION' && line === 'M151') || (kind === 'STATION' && line === 'O100'))) {
            throw new Error(`KIND/LINE không hợp lệ: ${kind}/${line}`);
        }
        let etd;
        const value = String(row.ETD || '').trim();
        if (/^\d+(\.0)?$/.test(value)) etd = new Date(Date.UTC(1899, 11, 30) + Number(value) * 86400000);
        else {
            const iso = value.match(/^(\d{4})-(\d{2})-(\d{2})(?:T.*)?$/);
            const us = value.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/);
            if (iso) etd = new Date(Date.UTC(+iso[1], +iso[2] - 1, +iso[3]));
            else if (us) etd = new Date(Date.UTC(+us[3], +us[1] - 1, +us[2]));
        }
        if (!etd || !Number.isFinite(etd.getTime()) || etd.getUTCDay() !== 6) throw new Error(`ETD phải là thứ Bảy: ${value}`);
        const mss = String(row.MSS || '').trim().match(/^MSS(\d{2})(\d{2})$/i);
        const wed = new Date(etd.getTime() - 3 * 86400000);
        if (!mss || wed.getUTCMonth() + 1 !== +mss[1] || wed.getUTCDate() !== +mss[2]) {
            throw new Error(`MSS ${row.MSS} không khớp ETD ${key(etd)}.`);
        }
        days.forEach((day, i) => {
            const date = key(new Date(wed.getTime() + (i - 6) * 86400000));
            const text = String(row[day] ?? '').trim().replace(',', '.');
            const hours = Number(text);
            if (!text || !Number.isFinite(hours) || hours < 0 || hours > 24) throw new Error(`Giờ không hợp lệ: ${row.MSS}/${line}/${day}`);
            const item = result.get(date) || { date, motion: null, station: null };
            const field = kind.toLowerCase();
            const sourceKey = `${date}/${field}`;
            const source = `SITE ${String(row.SITE ?? '').trim() || '?'} · ${line} · ${row.MSS} · ${day}`;
            if (item[field] !== null && item[field] !== hours) {
                throw new Error(`Giờ ${kind} ngày ${date} khác nhau giữa các dòng query.\nDòng trước: ${sources.get(sourceKey)} = ${item[field]}h\nDòng hiện tại: ${source} = ${hours}h\nLịch chỉ có một giá trị ${kind}/ngày. Cần chọn quy tắc lấy giờ trước khi cập nhật. Chưa ghi dữ liệu vào lịch.`);
            }
            item[field] = hours;
            sources.set(sourceKey, source);
            result.set(date, item);
        });
    }
    return [...result.values()].sort((a, b) => a.date.localeCompare(b.date));
}


// ===== api-client =====
// Both GitHub Pages and local previews read IBM data from this user's machine.
export function resolveApiUrl(page) {
    const sameServer = page.protocol === 'http:' && page.hostname === 'localhost' && page.port === '8080';
    return (sameServer ? '' : 'http://localhost:8080') + '/api/work-hours';
}


// ===== calendar-data =====
// Vietnamese lunar calendar: astronomical new moons and winter solstice at UTC+7.
// Meeus low-precision series; month numbering follows the Vietnamese calendar.
const RAD = Math.PI / 180;
const floor = Math.floor;
function julian(date) {
    const m = date.getMonth() + 1, y = date.getFullYear();
    const a = floor((14 - m) / 12), yy = y + 4800 - a, mm = m + 12 * a - 3;
    return date.getDate() + floor((153 * mm + 2) / 5) + 365 * yy + floor(yy / 4) - floor(yy / 100) + floor(yy / 400) - 32045;
}
function newMoon(k) {
    const t = k / 1236.85, t2 = t * t, t3 = t2 * t;
    const sin = x => Math.sin(x * RAD);
    let jd = 2415020.75933 + 29.53058868 * k + 0.0001178 * t2 - 0.000000155 * t3;
    jd += 0.00033 * sin(166.56 + 132.87 * t - 0.009173 * t2);
    const m = 359.2242 + 29.10535608 * k - 0.0000333 * t2 - 0.00000347 * t3;
    const mp = 306.0253 + 385.81691806 * k + 0.0107306 * t2 + 0.00001236 * t3;
    const f = 21.2964 + 390.67050646 * k - 0.0016528 * t2 - 0.00000239 * t3;
    const correction = (0.1734 - 0.000393 * t) * sin(m) + 0.0021 * sin(2 * m)
        - 0.4068 * sin(mp) + 0.0161 * sin(2 * mp) - 0.0004 * sin(3 * mp)
        + 0.0104 * sin(2 * f) - 0.0051 * sin(m + mp) - 0.0074 * sin(m - mp)
        + 0.0004 * sin(2 * f + m) - 0.0004 * sin(2 * f - m)
        - 0.0006 * sin(2 * f + mp) + 0.001 * sin(2 * f - mp) + 0.0005 * sin(2 * mp + m);
    const delta = t < -11
        ? 0.001 + 0.000839 * t + 0.0002261 * t2 - 0.00000845 * t3 - 0.000000081 * t * t3
        : -0.000278 + 0.000265 * t + 0.000262 * t2;
    return floor(jd + correction - delta + 0.5 + 7 / 24);
}
function sunSector(day) {
    const t = (day - 0.5 - 7 / 24 - 2451545) / 36525;
    const m = (357.5291 + 35999.0503 * t - 0.0001559 * t * t - 0.00000048 * t ** 3) * RAD;
    const longitude = (280.46645 + 36000.76983 * t + 0.0003032 * t * t
        + (1.9146 - 0.004817 * t - 0.000014 * t * t) * Math.sin(m)
        + (0.019993 - 0.000101 * t) * Math.sin(2 * m) + 0.00029 * Math.sin(3 * m)) * RAD;
    return floor(((longitude % (2 * Math.PI) + 2 * Math.PI) % (2 * Math.PI)) / Math.PI * 6);
}
function month11(year) {
    const k = floor((julian(new Date(year, 11, 31)) - 2415021) / 29.530588853);
    const moon = newMoon(k);
    return sunSector(moon) >= 9 ? newMoon(k - 1) : moon;
}
function leapOffset(a11) {
    const k = floor((a11 - 2415021.076998695) / 29.530588853 + 0.5);
    let last = -1, sector = sunSector(newMoon(k + 1)), i = 1;
    do { last = sector; sector = sunSector(newMoon(k + ++i)); } while (sector !== last && i < 14);
    return i - 1;
}
const lunarCache = new Map();
export function vietnameseLunar(date) {
    const day = julian(date);
    if (lunarCache.has(day)) return lunarCache.get(day);
    const k = floor((day - 2415021.076998695) / 29.530588853);
    let start = newMoon(k + 1);
    if (start > day) start = newMoon(k);
    let a11 = month11(date.getFullYear()), b11 = a11, year;
    if (a11 >= start) { year = date.getFullYear(); a11 = month11(year - 1); }
    else { year = date.getFullYear() + 1; b11 = month11(year); }
    const diff = floor((start - a11) / 29);
    let month = diff + 11, leap = false;
    if (b11 - a11 > 365) {
        const offset = leapOffset(a11);
        if (diff >= offset) { month = diff + 10; leap = diff === offset; }
    }
    if (month > 12) month -= 12;
    if (month >= 11 && diff < 4) year--;
    const result = { day: day - start + 1, month, year, leap };
    lunarCache.set(day, result);
    return result;
}
export function dateKey(date) {
    return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
}
export function monthPair(year, month) {
    return [new Date(year, month, 1), new Date(year, month + 1, 1)];
}
const holidayCache = new Map();
export function holidaysForYear(year, policy = {}) {
    const cacheKey = `${year}|${policy.tetStart || ''}|${policy.nationalDay || 1}`;
    if (holidayCache.has(cacheKey)) return holidayCache.get(cacheKey);
    const map = {};
    const add = (date, name) => { map[dateKey(date)] = name; };
    add(new Date(year, 0, 1), 'Tết Dương lịch');
    add(new Date(year, 3, 30), 'Ngày Chiến thắng');
    add(new Date(year, 4, 1), 'Quốc tế Lao động');
    add(new Date(year, 8, 2), 'Quốc khánh');
    add(new Date(year, 8, Number(policy.nationalDay) === 3 ? 3 : 1), 'Nghỉ liền kề Quốc khánh');
    if (year >= 2026) add(new Date(year, 10, 24), 'Ngày Văn hóa Việt Nam');
    let tet;
    for (let d = new Date(year, 0, 1); d < new Date(year, 5, 1); d.setDate(d.getDate() + 1)) {
        const lunar = vietnameseLunar(d);
        if (!lunar.leap && lunar.month === 3 && lunar.day === 10) add(d, 'Giỗ Tổ Hùng Vương');
        if (!lunar.leap && lunar.month === 1 && lunar.day === 1) tet = new Date(d);
    }
    // Five statutory Tet days. The employer can choose a different starting date.
    const configured = /^\d{4}-\d{2}-\d{2}$/.test(policy.tetStart || '') ? new Date(`${policy.tetStart}T12:00:00`) : null;
    const start = configured && configured.getFullYear() === year && !isNaN(configured) ? configured : tet;
    if (start) for (let i = 0; i < 5; i++) {
        const d = new Date(start); d.setDate(d.getDate() + i); add(d, 'Tết Nguyên Đán');
    }
    holidayCache.set(cacheKey, map);
    return map;
}


// ===== productivity-data =====

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


// ===== admin-data =====
export const ADMIN_EMAIL = 'chauchikil01@gmail.com';
export const FEATURES = {
    jobs: 'Job và lịch làm việc', quickJobs: 'Job trong ngày', transfers: 'Chuyển / copy job',
    dayOffs: 'Lịch off', events: 'Sự kiện', holidays: 'Điều chỉnh lịch lễ', workHours: 'Giờ làm việc',
    departments: 'Bộ phận', profile: 'Hồ sơ cá nhân', settings: 'Cài đặt', notifications: 'Thông báo',
    history: 'Lịch sử thay đổi', ai: 'Tạo job bằng AI', checkDue: 'Check Due',
    eta: 'Check ETA & Direct', spin: 'Quay số thuyết trình', statistics: 'Thống kê job', salary: 'Tính lương'
};
export const ACTIONS = ['view', 'create', 'edit', 'delete'];
export const PERMISSION_ACTION_LABELS = { view: 'Xem', create: 'Thêm', edit: 'Sửa', delete: 'Xóa' };
export function blessingChanges(before, after) {
    const granted = [], revoked = [];
    for (const feature of Object.keys(FEATURES)) {
        const added = [], removed = [];
        for (const action of ACTIONS) {
            const wasAllowed = hasPermission(before, feature, action);
            const isAllowed = hasPermission(after, feature, action);
            if (!wasAllowed && isAllowed) added.push(action);
            if (wasAllowed && !isAllowed) removed.push(action);
        }
        if (added.length) granted.push({ feature, actions: added });
        if (removed.length) revoked.push({ feature, actions: removed });
    }
    return { granted, revoked, accountChanged: !!before?.disabled !== !!after?.disabled };
}
export function blessingNotice(changes) {
    const { granted, revoked, accountChanged } = changes;
    if (!granted.length && !revoked.length && !accountChanged) return null;
    const type = granted.length && revoked.length ? 'blessing_changed' : revoked.length ? 'blessing_revoked' : granted.length ? 'blessing_granted' : 'blessing_changed';
    const title = type === 'blessing_granted' ? 'Đấng tối cao đã ban phước lành đến bạn'
        : type === 'blessing_revoked' ? 'Đấng tối cao đã thu hồi phước lành' : 'Đấng tối cao đã điều chỉnh phước lành';
    const lines = entries => entries.map(({ feature, actions }) => `• ${FEATURES[feature]}: ${actions.map(action => PERMISSION_ACTION_LABELS[action]).join(', ')}`).join('\n');
    const message = [title + '.', granted.length ? `Phước lành được ban:\n${lines(granted)}` : '',
        revoked.length ? `Phước lành được thu hồi:\n${lines(revoked)}` : '',
        accountChanged ? changes.disabled ? 'Quyền vào ứng dụng đã bị tạm khóa.' : 'Quyền vào ứng dụng đã được khôi phục.' : ''].filter(Boolean).join('\n\n');
    return { type, title, message, granted, revoked };
}
export function adminJobWeekdays(job) {
    const all = [1, 2, 3, 4, 5, 6, 0];
    const allowed = all.filter(day => day !== 0 || job.workOnSunday !== false);
    if (!job.isOutOfSchedule && job.type === 'daily') return allowed.filter(day => !(job.excludedWeekdays || []).includes(day));
    // Monthly jobs can fall on different weekdays in different months.
    if (!job.isOutOfSchedule && job.type === 'monthly') return allowed;
    const raw = job.dateKey || job.date || '';
    if (!/^\d{4}-\d{2}-\d{2}$/.test(raw)) return [];
    const [year, month, day] = raw.split('-').map(Number);
    const date = new Date(year, month - 1, day);
    if (date.getFullYear() !== year || date.getMonth() !== month - 1 || date.getDate() !== day) return [];
    const weekday = date.getDay();
    return job.type && !allowed.includes(weekday) ? [] : [weekday];
}
export function adminJobGroup(job) {
    return job.isOutOfSchedule || job.type === 'custom' ? 'outside' : job.type === 'once' ? 'once' : 'fixed';
}
export const USER_COLLECTIONS = {
    users: ['uid'], jobs: ['ownerId'], jobDayOverrides: ['userId'], dayOffs: ['userId'],
    quickJobs: ['createdBy', 'assigneeUid', 'invitedUid', 'invitedBy'],
    transferRequests: ['fromUid', 'toUid'], quickJobTransferRequests: ['fromUid', 'toUid'], notifications: ['userId']
};
export function hasPermission(policy, feature, action = 'view') {
    if (!Object.hasOwn(FEATURES, feature) || !ACTIONS.includes(action) || policy?.disabled) return false;
    const rights = policy?.features?.[feature];
    return rights?.view === true && rights?.[action] === true;
}
export function normalizePolicy(input) {
    const features = {};
    for (const key of Object.keys(FEATURES)) {
        features[key] = {};
        for (const action of ACTIONS) features[key][action] = input?.features?.[key]?.view === true && input?.features?.[key]?.[action] === true;
    }
    return { disabled: input?.disabled === true, features };
}
export function profilePolicy(documents) {
    const profiles = documents.map(d => d.data()).sort((a, b) => String(b.uiPermissionsUpdatedAt || '').localeCompare(String(a.uiPermissionsUpdatedAt || '')));
    if (profiles.some(p => p.appDeleted)) return { disabled: true, appDeleted: true, deletionPending: profiles.some(p => p.appDeletionPending) };
    return profiles[0]?.uiPermissions || {};
}

// Application-level controls only. Firebase continues to enforce its existing rules.
export function createAdminStore({ db, auth, sdk }) {
    const { collection, doc, getDocs, getDoc, query, where, writeBatch } = sdk;
    // Keep conflict retries, but avoid the SDK's default five attempts during quota failures.
    const runTransaction = (database, callback) => sdk.runTransaction(database, callback, { maxAttempts: 2 });
    const quotaError = error => String(error?.code || '').split('/').at(-1) === 'resource-exhausted';
    let quotaBlockedUntil = 0;
    const quotaMessage = seconds => `Firebase đang giới hạn yêu cầu hoặc đã hết hạn mức (429). Chưa xác nhận lưu thành công. Vui lòng chờ ${seconds} giây rồi thử lại; nếu vẫn lỗi, kiểm tra Firestore → Usage trong Firebase Console.`;
    const isAdmin = () => auth.currentUser?.email?.trim().toLowerCase() === ADMIN_EMAIL;
    return async function adminAction(action, data = {}) {
        if (!isAdmin()) throw new Error('Chỉ Đấng tối cao được dùng khu vực này.');
        if (Date.now() < quotaBlockedUntil) throw Object.assign(new Error(quotaMessage(Math.ceil((quotaBlockedUntil - Date.now()) / 1000))), { code: 'resource-exhausted' });
        try { return await execute(action, data); }
        catch (error) {
            if (!quotaError(error)) throw error;
            quotaBlockedUntil = Date.now() + 60000;
            throw Object.assign(new Error(quotaMessage(60), { cause: error }), { code: 'resource-exhausted' });
        }
    };
    async function find(uid, name) {
        const result = new Map();
        for (const field of USER_COLLECTIONS[name]) {
            const snapshot = await getDocs(query(collection(db, name), where(field, '==', uid)));
            snapshot.docs.forEach(d => result.set(d.id, d));
        }
        return [...result.values()];
    }
    async function commit(writes) {
        for (let i = 0; i < writes.length; i += 400) {
            const batch = writeBatch(db);
            writes.slice(i, i + 400).forEach(write => write(batch));
            await batch.commit();
        }
    }
    async function execute(action, data = {}) {
        if (!isAdmin()) throw new Error('Chỉ Đấng tối cao được dùng khu vực này.');
        if (action === 'listUsers') {
            const snapshot = await getDocs(collection(db, 'users'));
            const grouped = new Map();
            for (const document of snapshot.docs) {
                const value = document.data();
                if (!value.uid) continue;
                const entry = grouped.get(value.uid) || [];
                entry.push(document); grouped.set(value.uid, entry);
            }
            return { users: [...grouped.entries()].flatMap(([uid, docs]) => {
                const policy = profilePolicy(docs);
                if (policy.appDeleted && !policy.deletionPending) return [];
                const profile = docs[0].data();
                return [{ uid, email: profile.email || '', displayName: profile.displayName || '', department: profile.department || '',
                    disabled: policy.disabled === true, policy: normalizePolicy(policy) }];
            }).sort((a, b) => a.email.localeCompare(b.email)) };
        }
        if (action === 'cleanupHistory') {
            const counts = { profiles: 0, jobs: 0, notifications: 0, requests: 0 };
            const cutoff = Date.now() - 30 * 86400000;
            // Explicit maintenance only: never run this scan on login or on each save.
            for (const name of ['users', 'jobs', 'quickJobs', 'notifications', 'transferRequests', 'quickJobTransferRequests']) {
                let cursor = null;
                while (true) {
                    const constraints = [sdk.limit(200)];
                    if (cursor) constraints.push(sdk.startAfter(cursor));
                    const page = await getDocs(query(collection(db, name), ...constraints));
                    if (!page.docs.length) break;
                    const writes = [];
                    for (const document of page.docs) {
                        const value = document.data();
                        if (['users', 'jobs', 'quickJobs'].includes(name)) {
                            const fields = name === 'users' ? ['changeHistory'] : ['transferHistory', 'copyHistory'];
                            const patch = Object.fromEntries(fields.filter(key => Object.hasOwn(value, key)).map(key => [key, sdk.deleteField()]));
                            if (Object.keys(patch).length) {
                                writes.push(batch => batch.update(document.ref, patch));
                                counts[name === 'users' ? 'profiles' : 'jobs']++;
                            }
                        } else {
                            const at = Date.parse(value.respondedAt || value.timestamp || value.createdAt || '');
                            const disposable = name === 'notifications' || ['accepted', 'rejected', 'cancelled'].includes(value.status);
                            if (disposable && Number.isFinite(at) && at < cutoff) {
                                writes.push(batch => batch.delete(document.ref));
                                counts[name === 'notifications' ? 'notifications' : 'requests']++;
                            }
                        }
                    }
                    await commit(writes);
                    cursor = page.docs.at(-1);
                    if (page.docs.length < 200) break;
                }
            }
            return { ok: true, counts };
        }
        const uid = data.uid;
        if (typeof uid !== 'string' || !uid || uid.includes('/')) throw new Error('User không hợp lệ.');
        const profiles = await find(uid, 'users');
        if (!profiles.length) throw new Error('Không tìm thấy user.');
        const root = uid === auth.currentUser.uid || profiles.some(d => d.data().email?.trim().toLowerCase() === ADMIN_EMAIL);
        if (action === 'setPermissions') {
            if (root) throw new Error('Đấng tối cao luôn có toàn quyền.');
            if (profilePolicy(profiles).appDeleted) throw new Error('User đã được xóa khỏi ứng dụng.');
            const policy = normalizePolicy(data.policy);
            const notificationRef = doc(collection(db, 'notifications'));
            const result = await runTransaction(db, async transaction => {
                const documents = await Promise.all(profiles.map(d => transaction.get(d.ref)));
                const before = profilePolicy(documents);
                if (before.appDeleted) throw new Error('User đã được xóa khỏi ứng dụng.');
                const changes = blessingChanges(before, policy);
                let notice = blessingNotice({ ...changes, disabled: policy.disabled });
                if (!notice && JSON.stringify(normalizePolicy(before)) !== JSON.stringify(policy)) {
                    notice = blessingNotice(blessingChanges({ ...before, disabled: false }, { ...policy, disabled: false }));
                    if (notice) notice.message += '\n\nPhước lành sẽ có hiệu lực khi tài khoản được mở khóa.';
                }
                if (!notice) return { ok: true, changed: false };
                const timestamp = new Date().toISOString();
                const blessing = { ...notice, id: notificationRef.id || notificationRef.path.split('/').at(-1), timestamp };
                documents.forEach(d => transaction.update(d.ref, { uiPermissions: policy, uiPermissionsUpdatedAt: timestamp,
                    uiPermissionsUpdatedBy: auth.currentUser.uid, lastBlessing: blessing }));
                transaction.set(notificationRef, { userId: uid, fromUid: auth.currentUser.uid, ...notice, timestamp, read: false });
                return { ok: true, changed: true, notice: blessing };
            });
            return result;
        }
        if (action === 'getUserData') {
            const collections = {};
            const errors = {};
            for (const name of Object.keys(USER_COLLECTIONS)) {
                if (name === 'users') { collections.users = profiles.map(d => ({ id: d.id, data: d.data() })); continue; }
                try { collections[name] = (await find(uid, name)).map(d => ({ id: d.id, data: d.data() })); }
                catch (error) { if (quotaError(error)) throw error; collections[name] = []; errors[name] = error.message; }
            }
            let departments = [];
            try { departments = (await getDocs(collection(db, 'departments'))).docs.map(d => ({ id: d.id, name: d.data().name || d.id })); }
            catch (error) { if (quotaError(error)) throw error; /* Existing department IDs remain available in the user list. */ }
            return { collections, departments, errors };
        }
        if (action === 'saveProfile') {
            const value = data.value || {};
            const displayName = String(value.displayName || '').trim();
            const lead = Number(value.notifyLeadMinutes ?? 0);
            if (!displayName || displayName.length > 120 || !['day', 'night'].includes(value.workShift)
                || !Number.isInteger(lead) || lead < 0 || lead > 120) throw new Error('Kiểm tra tên, ca làm việc và thời gian nhắc.');
            const patch = { displayName, department: String(value.department || '').trim(), workShift: value.workShift,
                avatar: value.avatar || null, notifyLeadMinutes: lead, jobCompletionEnabled: value.jobCompletionEnabled === true,
                updatedAt: new Date().toISOString(), adminProfileUpdatedAt: new Date().toISOString() };
            if (typeof patch.avatar !== 'string' && patch.avatar !== null) throw new Error('Ảnh đại diện không hợp lệ.');
            if (patch.avatar && patch.avatar.length > 500000) throw new Error('Ảnh đại diện quá lớn.');
            await runTransaction(db, async transaction => {
                const current = await Promise.all(profiles.map(d => transaction.get(d.ref)));
                current.forEach(d => {
                    const old = d.data();
                    const since = patch.jobCompletionEnabled ? (old.jobCompletionEnabled && old.jobCompletionSince || data.today || '') : '';
                    transaction.update(d.ref, { ...patch, jobCompletionSince: since });
                });
            });
            return { ok: true };
        }
        if (action === 'deleteUser') {
            if (root) throw new Error('Không thể xóa Đấng tối cao.');
            if (data.confirmUid !== uid) throw new Error('Xác nhận user không khớp.');
            // Keep a small tombstone so an existing Auth account is refused by this app.
            const tombstone = { uid, email: profiles[0].data().email || '', displayName: profiles[0].data().displayName || '',
                appDeleted: true, appDeletionPending: true, uiPermissions: normalizePolicy({ disabled: true }), deletedBy: auth.currentUser.uid, deletedAt: new Date().toISOString() };
            await commit(profiles.map(d => batch => batch.set(d.ref, tombstone)));
            for (const name of Object.keys(USER_COLLECTIONS).filter(n => n !== 'users')) {
                const documents = await find(uid, name);
                await commit(documents.map(d => batch => {
                    const value = d.data();
                    if (name === 'quickJobs' && value.createdBy !== uid) {
                        const patch = {};
                        for (const key of ['assigneeUid', 'invitedUid', 'invitedBy']) if (value[key] === uid) patch[key] = null;
                        if (value.assigneeUid === uid && value.status !== 'completed') patch.status = 'open';
                        batch.update(d.ref, patch);
                    } else batch.delete(d.ref);
                }));
            }
            await commit(profiles.map(d => batch => batch.update(d.ref, { appDeletionPending: false })));
            return { ok: true };
        }
        if (action === 'createJob') {
            const value = data.value || {};
            if (!value.title?.trim() || !value.date || !value.time || !Number.isInteger(value.duration) || value.duration < 1 || value.duration > 1440) throw new Error('Kiểm tra thông tin job.');
            const ref = doc(collection(db, 'jobs'));
            const now = new Date().toISOString();
            await commit([batch => batch.set(ref, { ...value, ownerId: uid, createdAt: now, updatedAt: now,
                checklist: value.checklist || [], excludedWeekdays: value.excludedWeekdays || [],
                enableNotification: value.enableNotification !== false, workOnSunday: value.workOnSunday === true })]);
            return { ok: true };
        }
        const name = data.collection;
        if (!Object.hasOwn(USER_COLLECTIONS, name)) throw new Error('Loại dữ liệu không hợp lệ.');
        if (action === 'createDocument') {
            if (name === 'users' || name === 'jobs') throw new Error('Dùng biểu mẫu tương ứng.');
            if (!data.value || typeof data.value !== 'object' || Array.isArray(data.value)) throw new Error('Dữ liệu không hợp lệ.');
            const value = { ...data.value, [USER_COLLECTIONS[name][0]]: uid };
            let id;
            if (name === 'dayOffs') {
                if (!/^\d{4}-\d{2}-\d{2}$/.test(value.date || '')) throw new Error('Ngày off không hợp lệ.');
                id = `${uid}_${value.date}`;
            }
            if (name === 'jobDayOverrides') {
                if (!value.jobId || value.jobId.includes('/') || !/^\d{4}-\d{2}-\d{2}$/.test(value.occurrenceDate || '')) throw new Error('Kiểm tra job và ngày.');
                const job = await getDoc(doc(db, 'jobs', value.jobId));
                if (!job.exists() || job.data().ownerId !== uid) throw new Error('Job không thuộc user.');
                id = `${uid}_${value.jobId}_${value.occurrenceDate}`;
            }
            const ref = id ? doc(db, name, id) : doc(collection(db, name));
            await runTransaction(db, async transaction => {
                if ((await transaction.get(ref)).exists()) throw new Error('Dữ liệu đã tồn tại; hãy dùng Sửa.');
                transaction.set(ref, value);
            });
            return { ok: true };
        }
        if (!['saveDocument', 'deleteDocument'].includes(action) || typeof data.id !== 'string' || !data.id || data.id.includes('/')) throw new Error('Thao tác không hợp lệ.');
        const ref = doc(db, name, data.id);
        await runTransaction(db, async transaction => {
            const current = await transaction.get(ref);
            if (!current.exists() || !USER_COLLECTIONS[name].some(field => current.data()[field] === uid)) throw new Error('Dữ liệu không thuộc user đã chọn.');
            if (action === 'deleteDocument') {
                if (name === 'users') throw new Error('Dùng Xóa user khỏi ứng dụng.');
                transaction.delete(ref); return;
            }
            const value = data.value;
            if (!value || typeof value !== 'object' || Array.isArray(value)) throw new Error('Dữ liệu không hợp lệ.');
            // Admin can reassign a quick job or change a transfer recipient; its
            // creator/owner remains stable so editing another user's data is explicit.
            const field = USER_COLLECTIONS[name][0];
            if ((value[field] ?? null) !== (current.data()[field] ?? null)) throw new Error(`Không đổi ${field}.`);
            if (name === 'users') {
                if (value.email !== current.data().email) throw new Error('Không đổi email đăng nhập tại đây.');
                // Permissions/deletion state are managed only by their dedicated app controls.
                for (const field of ['uiPermissions', 'appDeleted', 'appDeletionPending', 'uiPermissionsUpdatedAt', 'uiPermissionsUpdatedBy']) {
                    if (Object.hasOwn(current.data(), field)) value[field] = current.data()[field];
                    else delete value[field];
                }
            }
            transaction.set(ref, { ...value, updatedAt: new Date().toISOString() });
        });
        return { ok: true };
    };
}

