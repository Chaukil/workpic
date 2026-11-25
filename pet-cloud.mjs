import { readFileSync } from 'node:fs';
import { createHash, randomInt, randomUUID } from 'node:crypto';
import { initializeApp } from 'firebase-admin/app';
import { FieldPath, FieldValue, getFirestore } from 'firebase-admin/firestore';
import { getFunctions } from 'firebase-admin/functions';
import { defineString } from 'firebase-functions/params';
import { onDocumentWritten } from 'firebase-functions/v2/firestore';
import { HttpsError, onCall } from 'firebase-functions/v2/https';
import { onTaskDispatched } from 'firebase-functions/v2/tasks';

const source = readFileSync(new URL('./app.js', import.meta.url), 'utf8');
const shared = source.split('// BEGIN SHARED HELPERS\n')[1].split('// END SHARED HELPERS')[0];
const helpers = await import('data:text/javascript;base64,' + Buffer.from(shared + `
    export { ATTENDANCE_PET_BRANCHES, attendancePetActivityTime, attendancePetRecords,
        attendancePetView, buildPetComparison, transitionPetHousehold, petBattleFighter,
        petBattleChangeWeight, petBattlePower, petBattleBudget, petBattleSimulation, petBattleTime,
        petBattleSettleXp, petBattleCompletePet, makePetBattleBot, PET_BATTLE_STEP_MS };
`).toString('base64'));
const { ATTENDANCE_PET_BRANCHES, attendancePetActivityTime, attendancePetRecords,
    attendancePetView, buildPetComparison, transitionPetHousehold, petBattleFighter,
    petBattleChangeWeight, petBattlePower, petBattleBudget, petBattleSimulation, petBattleTime,
    petBattleSettleXp, petBattleCompletePet, makePetBattleBot, PET_BATTLE_STEP_MS } = helpers;

initializeApp();
const db = getFirestore();
const region = 'us-central1';
const adminUid = defineString('PET_ADMIN_UID');
const profiles = db.collection('petProfiles');
const battles = db.collection('petCloudBattles');
const legacy = db.collection('users');
const directory = db.collection('userDirectory');
const week = 7 * 86400000;
const pageSize = 20;
const botDailyLimit = 5;
let rankingCache;

function requireId(value) {
    if (typeof value !== 'string' || !value || value.length > 128 || value.includes('/') || value === '.' || value === '..') {
        throw new HttpsError('invalid-argument', 'Mã hồ sơ hoặc mã trận không hợp lệ.');
    }
    return value;
}

function activityPatch(pet, now) {
    return { attendancePet: pet, activityAt: attendancePetActivityTime(pet, now) };
}

function safeName(value) {
    return typeof value === 'string' && value.trim() ? value.trim().slice(0, 100) : 'Thành viên';
}

function userDirectoryEntry(profile) {
    return {
        uid: profile.uid,
        displayName: safeName(profile.displayName || profile.email?.split('@')[0]),
        avatar: typeof profile.avatar === 'string' ? profile.avatar : null,
        status: typeof profile.status === 'string' ? profile.status : profile.disabled === true ? 'inactive' : 'active'
    };
}

async function openProfile(uid) {
    const ref = profiles.doc(uid);
    const existing = await ref.get();
    if (existing.exists) return existing.data();
    return db.runTransaction(async tx => {
        const current = await tx.get(ref);
        if (current.exists) return current.data();
        const snapshot = await tx.get(legacy.where('uid', '==', uid));
        const docs = [...snapshot.docs].sort((a, b) => a.id.localeCompare(b.id));
        if (!docs.length) throw new HttpsError('failed-precondition', 'Chưa tìm thấy hồ sơ thành viên.');
        if (docs.some(doc => Object.keys(doc.data().petBattleLocks || {}).length)) {
            throw new HttpsError('failed-precondition', 'Cần chốt hoặc hủy trận cũ trước khi chuyển hồ sơ.');
        }
        const now = Date.now(), profile = docs[0].data();
        const { pet } = transitionPetHousehold(profile.attendancePet, 'init', now);
        const data = { uid, name: safeName(profile.displayName || profile.email?.split('@')[0]),
            petBattleLocks: {}, ...activityPatch(pet, now) };
        tx.create(ref, data);
        for (const doc of docs) {
            const old = doc.data();
            if (Object.hasOwn(old, 'attendancePet') || Object.hasOwn(old, 'petBattleLocks')) {
                if (doc.id !== docs[0].id) {
                    const backup = {};
                    if (Object.hasOwn(old, 'attendancePet')) backup.attendancePet = old.attendancePet;
                    if (Object.hasOwn(old, 'petBattleLocks')) backup.petBattleLocks = old.petBattleLocks;
                    tx.set(ref.collection('legacyCopies').doc(doc.id), backup);
                }
                tx.update(doc.ref, { attendancePet: FieldValue.delete(), petBattleLocks: FieldValue.delete() });
            }
        }
        return data;
    });
}

async function care(uid, data, admin) {
    const action = typeof data.action === 'string' ? data.action : '';
    const branch = action.startsWith('branch:') && Object.hasOwn(ATTENDANCE_PET_BRANCHES, action.slice(7));
    const allowed = admin ? ['feed', 'checkin', 'revive', 'hatch', 'evolve', 'egg', 'level'].includes(action)
        : ['feed', 'checkin', 'revive'].includes(action) || action.startsWith('rename:');
    if (!allowed && !branch) throw new HttpsError('invalid-argument', 'Thao tác thú cưng không hợp lệ.');
    const targetId = requireId(data.petId);
    const ref = profiles.doc(uid);
    return db.runTransaction(async tx => {
        const doc = await tx.get(ref);
        if (!doc.exists) throw new HttpsError('failed-precondition', 'Chưa mở hồ sơ thú cưng.');
        const profile = doc.data(), now = Date.now();
        const held = Object.values(profile.petBattleLocks || {}).some(lock => lock.petId === targetId);
        if (held && (action === 'revive' || action === 'egg')) {
            throw new HttpsError('failed-precondition', 'Hãy chốt trận đang giữ cược trước khi hồi sinh hoặc trở về trứng.');
        }
        const change = transitionPetHousehold(profile.attendancePet, action, now, targetId, admin ? Number(data.level) : null);
        if (change.changed) tx.update(ref, activityPatch(change.pet, now));
        return change;
    });
}

function deadline(match) {
    if (match.status === 'invited') return match.expiresAt;
    if (match.status === 'ready') return match.readyDeadline;
    if (match.status === 'fighting') return petBattleTime(match.startedAt) + 2000 + match.turns.length * PET_BATTLE_STEP_MS;
    return null;
}

function reservedProfile(profile, player, match, id) {
    const lock = profile?.petBattleLocks?.[id];
    if (!lock || lock.petId !== player.petId || lock.stakeGrams !== match.stakeGrams) {
        throw new HttpsError('failed-precondition', 'Không tìm thấy khoản cược của thú cưng.');
    }
    return lock;
}

function settleProfile(profile, player, match, id, endedAt, now, finished) {
    const lock = reservedProfile(profile, player, match, id);
    const won = match.winnerUid === player.uid;
    const amount = finished && match.winnerUid ? (won ? lock.stakeGrams * 2 : 0) : lock.stakeGrams;
    let pet = amount ? petBattleChangeWeight(profile.attendancePet, player.petId, amount, now) : profile.attendancePet;
    let xpChange = 0;
    if (finished) {
        if (match.winnerUid && match.stakeXp) {
            const xp = petBattleSettleXp(pet, player.petId, won ? match.stakeXp : -match.stakeXp, now);
            pet = xp.pet; xpChange = xp.change;
        }
        const opponent = match.players.find(other => other.uid !== player.uid);
        const entry = { id, endedAt, result: match.winnerUid ? (won ? 'win' : 'loss') : 'draw',
            opponentName: opponent.name, opponentPetName: opponent.petName,
            xpDelta: xpChange, weightDelta: amount - lock.stakeGrams };
        const records = attendancePetRecords(pet, now).map(record => {
            if (record.id !== player.petId) return record;
            const history = (Array.isArray(record.battleHistory) ? record.battleHistory : []).filter(item => item?.id && item.id !== id);
            const battleHistory = [entry, ...history].sort((a, b) => b.endedAt - a.endedAt).slice(0, 30);
            const until = endedAt + 3600000, expiry = won ? 'victoryAuraUntil' : 'defeatAuraUntil';
            const aura = match.winnerUid && until > (Number(record[expiry]) || 0)
                ? won ? { victoryAuraUntil: until } : { defeatAuraUntil: until, defeatOpponentName: opponent.name }
                : {};
            return { ...record, battleHistory, ...aura };
        });
        pet = { ...pet, ...records[0], companions: records.slice(1) };
    }
    const locks = { ...profile.petBattleLocks };
    delete locks[id];
    return { patch: { ...activityPatch(pet, now), petBattleLocks: locks }, xpChange };
}

async function settle(id, expectedAt = null, uid = null) {
    const ref = battles.doc(requireId(id));
    return db.runTransaction(async tx => {
        const snapshot = await tx.get(ref), match = snapshot.data();
        if (!match || (uid && !match.participantUids.includes(uid))) throw new HttpsError('not-found', 'Không tìm thấy trận đấu.');
        const at = deadline(match), now = Date.now();
        if (!at || (expectedAt !== null && expectedAt !== at)) return match;
        if (now < at) {
            if (expectedAt !== null) throw new Error('Task dispatched before the match deadline.');
            return match;
        }
        const finished = match.status === 'fighting';
        const owners = await Promise.all(match.players.map(player => tx.get(profiles.doc(player.uid))));
        const claims = {}, xpChanges = {};
        for (const [index, player] of match.players.entries()) {
            const owner = owners[index];
            const result = settleProfile(owner.data(), player, match, id, at, now, finished);
            tx.update(owner.ref, result.patch);
            claims[player.uid] = true;
            if (finished) xpChanges[player.uid] = result.xpChange;
        }
        const result = { status: finished ? 'finished' : 'expired', settledAt: now, claims, xpChanges };
        tx.update(ref, result);
        return { ...match, ...result };
    }, { maxAttempts: 3 });
}

function validateElement(value) {
    if (!['metal', 'wood', 'water', 'fire', 'earth'].includes(value)) throw new HttpsError('invalid-argument', 'Chọn bổ trợ ngũ hành.');
}

async function battle(uid, data) {
    const action = data.action;
    if (action === 'claim') return { match: { id: data.id, ...await settle(data.id, null, uid) } };
    const create = action === 'create';
    const ref = battles.doc(create ? `battle-${randomUUID()}` : requireId(data.id));
    return db.runTransaction(async tx => {
        const now = Date.now(), id = ref.id;
        let match, profilePatch = null;
        if (create) {
            const opponentUid = requireId(data.opponentUid), stake = data.stakeGrams;
            if (opponentUid === uid || !Number.isSafeInteger(stake) || stake < 100 || stake % 100) {
                throw new HttpsError('invalid-argument', 'Chọn đối thủ khác và nhập kg cược theo bước 0,1 kg.');
            }
            validateElement(data.element);
            const owner = (await tx.get(profiles.doc(uid))).data();
            if (!owner || Object.keys(owner.petBattleLocks || {}).length >= 6) throw new HttpsError('failed-precondition', 'Hãy hoàn tất các trận đang giữ cược.');
            const player = petBattleFighter({ ...owner, displayName: owner.name }, uid, requireId(data.petId), data.stats, now, data.element);
            const pet = petBattleChangeWeight(owner.attendancePet, player.petId, -stake, now);
            profilePatch = { ...activityPatch(pet, now), petBattleStatsByPet:{...(owner.petBattleStatsByPet||{}),[player.petId]:player.stats}, petBattleLocks: { ...owner.petBattleLocks,
                [id]: { petId: player.petId, stakeGrams: stake } } };
            match = { version: 1, roomFlow: true, challengerUid: uid, opponentUid, participantUids: [uid, opponentUid],
                players: [player], stakeGrams: stake, stakeXp: Math.floor(stake / 200), status: 'invited', createdMs: now,
                expiresAt: now + 600000, ready: {}, claims: {}, turns: [], maxHp: [], winnerUid: null, startedAt: null };
            tx.create(ref, match);
        } else {
            match = (await tx.get(ref)).data();
            if (!match?.participantUids.includes(uid)) throw new HttpsError('not-found', 'Không tìm thấy phòng đấu.');
            const waiting = match.status === 'invited' && now < match.expiresAt;
            if (action === 'accept') {
                if (!waiting || uid !== match.opponentUid) throw new HttpsError('failed-precondition', 'Lời mời không còn hiệu lực.');
                validateElement(data.element);
                const [host, guest] = await Promise.all([tx.get(profiles.doc(match.challengerUid)), tx.get(profiles.doc(uid))]);
                const owner = guest.data(), challenger = host.data(), hostPetId = match.players[0].petId;
                reservedProfile(challenger, match.players[0], match, id);
                const hostPet = attendancePetRecords(challenger.attendancePet, now).find(pet => pet.id === hostPetId);
                if (!owner || !hostPet || attendancePetView(hostPet, now).dead ||
                    Object.keys(owner.petBattleLocks || {}).length >= 6) throw new HttpsError('failed-precondition', 'Thú cưng chưa sẵn sàng.');
                const player = petBattleFighter({ ...owner, displayName: owner.name }, uid, requireId(data.petId), data.stats, now, data.element);
                const pet = petBattleChangeWeight(owner.attendancePet, player.petId, -match.stakeGrams, now);
                profilePatch = { ...activityPatch(pet, now), petBattleStatsByPet:{...(owner.petBattleStatsByPet||{}),[player.petId]:player.stats}, petBattleLocks: { ...owner.petBattleLocks,
                    [id]: { petId: player.petId, stakeGrams: match.stakeGrams } } };
                match = { ...match, players: [...match.players, player], status: 'ready', readyDeadline: now + 120000 };
            } else if (action === 'ready') {
                if (match.ready[uid]) return { match: { id, ...match } };
                if (match.status !== 'ready' || now >= match.readyDeadline) throw new HttpsError('failed-precondition', 'Phòng đã hết thời gian sẵn sàng.');
                match.ready = { ...match.ready, [uid]: true };
                if (match.participantUids.every(member => match.ready[member])) {
                    const firstUid = match.participantUids[randomInt(2)];
                    match = { ...match, ...petBattleSimulation(match.players, firstUid), status: 'fighting', firstUid, startedAt: now };
                }
            } else if (action === 'cancel' || action === 'reject') {
                if (!waiting || uid !== (action === 'cancel' ? match.challengerUid : match.opponentUid)) {
                    throw new HttpsError('failed-precondition', 'Lời mời không còn hiệu lực.');
                }
                const owner = await tx.get(profiles.doc(match.challengerUid));
                const result = settleProfile(owner.data(), match.players[0], match, id, now, now, false);
                tx.update(owner.ref, result.patch);
                if (action === 'cancel') profilePatch = result.patch;
                match = { ...match, status: action === 'cancel' ? 'cancelled' : 'rejected',
                    claims: { [match.challengerUid]: true }, settledAt: now };
            } else throw new HttpsError('invalid-argument', 'Thao tác phòng đấu không hợp lệ.');
            tx.update(ref, match);
        }
        if (profilePatch && action !== 'cancel') tx.update(profiles.doc(uid), profilePatch);
        return { match: { id, ...match }, patch: profilePatch || {} };
    }, { maxAttempts: 3 });
}

async function botBattle(uid, data) {
    if (data.action === 'start') {
        const difficulty = ['easy', 'medium', 'hard'].includes(data.difficulty) ? data.difficulty : 'easy';
        validateElement(data.element);
        const id = `bot-${randomUUID()}`, ref = profiles.doc(uid), matchRef = battles.doc(id);
        let match;
        await db.runTransaction(async tx => {
            const snapshot = await tx.get(ref), profile = snapshot.data(), now = Date.now();
            if (!profile) throw new HttpsError('failed-precondition', 'Chưa mở hồ sơ thú cưng.');
            const day = new Date(now + 7 * 3600000).toISOString().slice(0, 10);
            const stored = profile.petBotDailyBattles?.day === day ? profile.petBotDailyBattles : {};
            const usage = {day,easy:Math.max(0,Number(stored.easy)||0),medium:Math.max(0,Number(stored.medium)||0),hard:Math.max(0,Number(stored.hard)||0)};
            if (usage[difficulty] >= botDailyLimit) throw new HttpsError('failed-precondition', `Đã dùng đủ ${botDailyLimit} trận Bot hôm nay.`);
            const player = petBattleFighter({ ...profile, displayName: profile.name }, uid,
                requireId(data.petId), data.stats, now, data.element);
            const bot = makePetBattleBot(player.appearance.level, difficulty),stake=bot.stakeGrams;
            petBattleChangeWeight(profile.attendancePet, player.petId, -stake, now);
            usage[difficulty]++;
            const players = [player, { ...bot, uid: 'workpic-bot' }];
            const firstUid = uid;
            match = { id, bot: true, botDifficulty: difficulty, rewardMultiplier: 1,
                participantUids: [uid], players, stakeGrams: stake, stakeXp: 1,
                status: 'fighting', createdMs: now, startedAt: now, firstUid, claims: {},
                ...petBattleSimulation(players, firstUid) };
            tx.create(matchRef, match);
            tx.update(ref,{petBotDailyBattles:usage,petBattleStatsByPet:{...(profile.petBattleStatsByPet||{}),[player.petId]:player.stats}});
        }, { maxAttempts: 2 });
        const { turns, maxHp, winnerUid, ...publicMatch } = match;
        return { match: publicMatch, patch: {} };
    }

    if (data.action !== 'claim') throw new HttpsError('invalid-argument', 'Thao tác trận Bot không hợp lệ.');
    const id = requireId(data.id), matchRef = battles.doc(id), profileRef = profiles.doc(uid);
    return db.runTransaction(async tx => {
        const [matchSnapshot, profileSnapshot] = await Promise.all([tx.get(matchRef), tx.get(profileRef)]);
        const match = matchSnapshot.data(), profile = profileSnapshot.data(), now = Date.now();
        if (!match?.bot || !match.participantUids?.includes(uid) || !profile) {
            throw new HttpsError('not-found', 'Không tìm thấy trận Bot.');
        }
        if (match.claims?.[uid]) return { match, patch: {} };
        const at = deadline(match);
        if (match.status !== 'fighting' || !at || now < at) {
            throw new HttpsError('failed-precondition', 'Trận Bot chưa kết thúc.');
        }
        const player = match.players.find(item => item.uid === uid);
        if (!player) throw new HttpsError('failed-precondition', 'Không tìm thấy thú cưng trong trận.');
        const currentPlayer = petBattleFighter({ ...profile, displayName: profile.name }, uid,
            player.petId, player.stats, now, player.element);
        if (currentPlayer.appearance.level !== player.appearance.level) {
            throw new HttpsError('failed-precondition', 'Cấp thú cưng đã thay đổi trong trận.');
        }
        const won = match.winnerUid === uid;
        const multiplier = Math.max(1, Math.min(2, Number(match.rewardMultiplier) || 1));
        const weightDelta = match.winnerUid ? won ? match.stakeGrams * multiplier : -match.stakeGrams : 0;
        let pet = weightDelta ? petBattleChangeWeight(profile.attendancePet, player.petId, weightDelta, now) : profile.attendancePet;
        const xpDelta = match.winnerUid ? won ? match.stakeXp * multiplier : -match.stakeXp : 0;
        const xp = petBattleSettleXp(pet, player.petId, xpDelta, now);
        pet = xp.pet;
        const locks = { ...profile.petBattleLocks };
        delete locks[id];
        const result = { ...match, status: 'finished', settledAt: now,
            claims: { ...match.claims, [uid]: true }, xpChanges: { [uid]: xp.change } };
        const patch = { ...activityPatch(pet, now), petBattleLocks: locks };
        tx.update(profileRef, patch);
        tx.update(matchRef, { status: result.status, settledAt: now, claims: result.claims, xpChanges: result.xpChanges });
        return { match: result, patch };
    }, { maxAttempts: 3 });
}

async function ranking(data) {
    const branch = data.branch || 'all', offset = Number(data.offset || 0);
    const mode=data.mode||'level';
    if (!Number.isSafeInteger(offset) || offset < 0 ||
        (branch !== 'all' && branch !== 'base' && !Object.hasOwn(ATTENDANCE_PET_BRANCHES, branch)) ||
        !['level','power'].includes(mode)) {
        throw new HttpsError('invalid-argument', 'Trang xếp hạng không hợp lệ.');
    }
    const now = Date.now();
    if (!rankingCache || now >= rankingCache.until) {
        const pending = profiles.where('activityAt', '>', now - week).select('uid', 'name', 'attendancePet','petBattleStatsByPet').get()
            .then(snapshot => snapshot.docs.map(doc => {
                const { uid, name, attendancePet,petBattleStatsByPet } = doc.data();
                return { id: doc.id, uid, displayName: name, attendancePet,petBattleStatsByPet };
            }));
        const cache = { until: now + 60000, pending };
        rankingCache = cache;
        pending.catch(() => { if (rankingCache === cache) rankingCache = undefined; });
    }
    const rows = buildPetComparison(await rankingCache.pending, now, branch,mode);
    return { rows: rows.slice(offset, offset + pageSize).map(({ battleHistory, ...row }) => row),
        nextOffset: offset + pageSize < rows.length ? offset + pageSize : null };
}

export const workpicPets = onCall({ region, maxInstances: 3 }, async request => {
    const uid = request.auth?.uid;
    if (!uid) throw new HttpsError('unauthenticated', 'Hãy đăng nhập.');
    const data = request.data || {};
    try {
        if (data.kind === 'open') return await openProfile(uid);
        if (data.kind === 'ranking') return await ranking(data);
        if (data.kind === 'history') {
            const petId = requireId(data.petId);
            const owner = await profiles.doc(requireId(data.uid)).get();
            const pet = owner.exists && attendancePetRecords(owner.data().attendancePet).find(item => item.id === petId);
            return { entries: Array.isArray(pet?.battleHistory) ? pet.battleHistory.slice(0, 30) : [] };
        }
        if (data.kind === 'bot') return await botBattle(uid, data);
        if (data.kind === 'battle') return await battle(uid, data);
        if (data.kind === 'care') return await care(uid, data, false);
        if (data.kind === 'admin-open' || data.kind === 'admin-care') {
            if (uid !== adminUid.value()) throw new HttpsError('permission-denied', 'Chỉ quản trị viên thú cưng có quyền thao tác.');
            const target = requireId(data.uid);
            return data.kind === 'admin-open' ? await openProfile(target) : await care(target, data, true);
        }
        throw new HttpsError('invalid-argument', 'Yêu cầu không hợp lệ.');
    } catch (error) {
        if (error instanceof HttpsError) throw error;
        if (error.code === 8 || error.code === 'resource-exhausted') throw new HttpsError('resource-exhausted', 'Firestore đang giới hạn yêu cầu.');
        if (error.code) throw error;
        throw new HttpsError('failed-precondition', error.message);
    }
});

export const syncWorkpicUserDirectory = onDocumentWritten({ region, document: 'users/{profileId}' }, async event => {
    const uid = event.data?.after.data()?.uid || event.data?.before.data()?.uid;
    if (typeof uid !== 'string' || !uid) return;
    const snapshot = await legacy.where('uid', '==', uid).get();
    if (snapshot.empty) {
        await directory.doc(uid).delete();
        return;
    }
    const latest = [...snapshot.docs].sort((a, b) =>
        String(b.data().updatedAt || b.data().createdAt || '').localeCompare(String(a.data().updatedAt || a.data().createdAt || ''))
    )[0].data();
    await directory.doc(uid).set(userDirectoryEntry(latest));
});

export const queueWorkpicPetDeadline = onDocumentWritten({ region, document: 'petCloudBattles/{id}', retry: true }, async event => {
    const after = event.data?.after.data();
    if (!after || after.bot) return;
    const at = deadline(after), before = event.data.before.data();
    if (!at || (before && deadline(before) === at)) return;
    const id = event.params.id;
    const taskId = createHash('sha256').update(`${id}:${at}`).digest('hex');
    try {
        await getFunctions().taskQueue(`locations/${region}/functions/settleWorkpicPetDeadline`).enqueue(
            { id, at }, { id: taskId, scheduleTime: new Date(Math.max(Date.now(), at)) }
        );
    } catch (error) {
        if (error.code !== 'functions/task-already-exists') throw error;
    }
});

export const settleWorkpicPetDeadline = onTaskDispatched({ region,
    retryConfig: { maxAttempts: 8, minBackoffSeconds: 10 },
    rateLimits: { maxConcurrentDispatches: 5 }
}, async request => {
    await settle(request.data.id, request.data.at);
});

if (process.argv.includes('--sync-user-directory')) {
    if (!process.env.GOOGLE_CLOUD_PROJECT) throw new Error('Set GOOGLE_CLOUD_PROJECT before syncing the user directory.');
    const byUid = new Map();
    let cursor;
    for (;;) {
        let query = legacy.orderBy(FieldPath.documentId()).limit(400);
        if (cursor) query = query.startAfter(cursor);
        const page = await query.get();
        for (const doc of page.docs) {
            const profile = doc.data();
            if (!profile.uid) continue;
            const previous = byUid.get(profile.uid);
            const stamp = String(profile.updatedAt || profile.createdAt || '');
            if (!previous || stamp >= previous.stamp) byUid.set(profile.uid, { profile, stamp });
        }
        cursor = page.docs.at(-1);
        if (page.size < 400) break;
    }
    const rows = [...byUid.values()];
    for (let index = 0; index < rows.length; index += 400) {
        const batch = db.batch();
        rows.slice(index, index + 400).forEach(({ profile }) => {
            batch.set(directory.doc(profile.uid), userDirectoryEntry(profile));
        });
        await batch.commit();
    }
    console.log(`User directory synced: ${rows.length} members.`);
}

if (process.argv.includes('--migrate-existing-pets')) {
    if (!process.env.GOOGLE_CLOUD_PROJECT) throw new Error('Set GOOGLE_CLOUD_PROJECT before migrating.');
    let cursor, migrated = 0, skipped = 0;
    const seen = new Set();
    for (;;) {
        let query = legacy.orderBy(FieldPath.documentId()).limit(100);
        if (cursor) query = query.startAfter(cursor);
        const page = await query.get();
        if (page.empty) break;
        for (const doc of page.docs) {
            const profile = doc.data();
            if (!profile.uid || !profile.attendancePet || seen.has(profile.uid)) continue;
            seen.add(profile.uid);
            try {
                await openProfile(profile.uid);
                migrated++;
            } catch (error) {
                if (!(error instanceof HttpsError) || error.code !== 'failed-precondition') throw error;
                skipped++;
            }
        }
        cursor = page.docs.at(-1);
        if (page.size < 100) break;
    }
    console.log(`Pet profiles available: ${migrated}. Pending legacy settlements: ${skipped}.`);
}
