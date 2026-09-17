let makeWASocket, useMultiFileAuthState, DisconnectReason, fetchLatestWaWebVersion, Browsers;

async function loadBaileys() {
    if (makeWASocket) return;
    const baileys = await import('@mrlegendbot/baileys');
    makeWASocket = baileys.default;
    useMultiFileAuthState = baileys.useMultiFileAuthState;
    DisconnectReason = baileys.DisconnectReason;
    fetchLatestWaWebVersion = baileys.fetchLatestWaWebVersion;
    Browsers = baileys.Browsers;
}

const pino = require('pino');
const fs = require('fs');
const path = require('path');
const config = require('./config');
const { box, reply, cleanPhoneNumber, waitForSocketOpen, detectCountry, attachSessionHandlers } = require('./helper');

const storageRoot = process.env.ZEPHYR_STORAGE_DIR || __dirname;
const SESSIONS_ROOT = path.join(storageRoot, 'sessions');
if (!fs.existsSync(SESSIONS_ROOT)) fs.mkdirSync(SESSIONS_ROOT, { recursive: true });

const dataDir = path.join(storageRoot, 'data');
if (!fs.existsSync(dataDir)) fs.mkdirSync(dataDir, { recursive: true });
const pairsFile = path.join(dataDir, 'pairs.json');

function loadPairsList() {
    try {
        if (!fs.existsSync(pairsFile)) {
            fs.writeFileSync(pairsFile, JSON.stringify([], null, 2));
            return [];
        }
        const raw = JSON.parse(fs.readFileSync(pairsFile, 'utf-8'));
        let changed = false;
        const migrated = raw.map(entry => {
            if (typeof entry === 'string') {
                changed = true;
                return { number: entry, addedBy: null };
            }
            return entry;
        });
        if (changed) savePairsList(migrated);
        return migrated;
    } catch (e) {
        return [];
    }
}

function savePairsList(list) {
    fs.writeFileSync(pairsFile, JSON.stringify(list, null, 2));
}

function addToPairsList(number, addedBy) {
    const list = loadPairsList();
    if (!list.some(e => e.number === number)) {
        list.push({ number, addedBy: addedBy || null });
        savePairsList(list);
    }
}

function removeFromPairsList(number) {
    const list = loadPairsList().filter(e => e.number !== number);
    savePairsList(list);
}

function findPairEntry(number) {
    return loadPairsList().find(e => e.number === number);
}

function countPairsAddedBy(addedBy) {
    return loadPairsList().filter(e => e.addedBy === addedBy).length;
}

const activeSessions = new Map();
const pendingNumberRequests = new Map();
const reconnectTimers = new Map();

function syncPairedOwnerNumbers() {
    if (!(global.pairedBotNumbers instanceof Set)) global.pairedBotNumbers = new Set();
    global.pairedBotNumbers.clear();
    for (const entry of loadPairsList()) {
        if (entry?.number) global.pairedBotNumbers.add(entry.number);
    }
    for (const [number, session] of activeSessions.entries()) {
        if (session?.sock?.authState?.creds?.registered) {
            global.pairedBotNumbers.add(number);
        }
    }
}

async function disposeSession(number, removeFiles = true) {
    clearReconnectTimer(number);
    const session = activeSessions.get(number);
    if (session?.sock) {
        try { session.sock.ws?.close?.(); } catch (e) {}
        try { session.sock.end?.(undefined); } catch (e) {}
    }
    activeSessions.delete(number);
    if (removeFiles && global.pairedBotNumbers instanceof Set) {
        global.pairedBotNumbers.delete(number);
    }
    if (removeFiles) deleteSessionFiles(number);
}

function clearReconnectTimer(number) {
    const t = reconnectTimers.get(number);
    if (t) {
        clearTimeout(t);
        reconnectTimers.delete(number);
    }
}

function scheduleReconnect(number, delayMs, fn) {
    clearReconnectTimer(number);
    const timer = setTimeout(() => {
        reconnectTimers.delete(number);
        fn();
    }, delayMs);
    reconnectTimers.set(number, timer);
}

function getBackoffDelay(attempts) {
    const base = 3000;
    const delay = base * Math.pow(1.5, Math.min(attempts, 10));
    return Math.min(delay, 30000);
}

function setPendingNumberRequest(jid) {
    pendingNumberRequests.set(jid, true);
}

function isPendingNumberRequest(jid) {
    return pendingNumberRequests.has(jid);
}

function clearPendingNumberRequest(jid) {
    pendingNumberRequests.delete(jid);
}

function sessionDirFor(number) {
    return path.join(SESSIONS_ROOT, number);
}

function deleteSessionFiles(number) {
    try {
        const dir = sessionDirFor(number);
        if (fs.existsSync(dir)) {
            fs.rmSync(dir, { recursive: true, force: true });
        }
    } catch (e) {}
}

async function notifyJid(mainSock, jid, title, body) {
    if (!mainSock || !jid) return;
    try {
        await reply(mainSock, jid, null, box(title, body));
    } catch (e) {}
}

async function requestCodeWithRetry(sock, number, maxAttempts, delayMs) {
    let lastError;
    for (let attempt = 1; attempt <= maxAttempts; attempt++) {
        try {
            return await sock.requestPairingCode(number);
        } catch (e) {
            lastError = e;
            await new Promise(resolve => setTimeout(resolve, delayMs));
        }
    }
    throw lastError;
}

async function startPairSession(number, requesterJid, mainSock, wantsCode) {
    await loadBaileys();

    const dir = sessionDirFor(number);
    const { state, saveCreds } = await useMultiFileAuthState(dir);

    const version = await global.getWaVersion(fetchLatestWaWebVersion);

    const sock = makeWASocket({
        version,
        logger: pino({ level: 'silent' }),
        printQRInTerminal: false,
        auth: state,
        connectTimeoutMs: 180000,
        defaultQueryTimeoutMs: 120000,
        keepAliveIntervalMs: 15000,
        browser: Browsers.ubuntu('Chrome'),
        generateHighQualityLinkPreview: false,
        syncFullHistory: false,
        markOnlineOnConnect: false
    });

    const sessionInfo = {
        sock,
        number,
        status: sock.authState.creds.registered ? 'connecting' : 'waiting_for_number',
        reconnectAttempts: 0,
        requesterJid,
        addedBy: findPairEntry(number)?.addedBy || null,
        createdAt: Date.now(),
        pairingInProgress: Boolean(wantsCode && !sock.authState.creds.registered)
    };
    activeSessions.set(number, sessionInfo);
    syncPairedOwnerNumbers();

    sock.ev.on('creds.update', saveCreds);

    sock.ev.on('connection.update', async (update) => {
        const { connection, lastDisconnect } = update;

        if (connection === 'close') {
            const statusCode = lastDisconnect?.error?.output?.statusCode;
            const isLoggedOut = statusCode === DisconnectReason.loggedOut;
            const isBadSession = statusCode === DisconnectReason.badSession;
            const isRestartRequired = statusCode === DisconnectReason.restartRequired;

            const current = activeSessions.get(number);
            if (current && current.sock !== sock) return;

            // Never reconnect an unauthenticated pairing attempt forever. A
            // failed attempt must release its lock so the user can retry.
            if (!sock.authState.creds.registered && !findPairEntry(number)) {
                await disposeSession(number, true);
                return;
            }

            if (isLoggedOut || isBadSession) {
                sessionInfo.status = 'logged_out';
                activeSessions.delete(number);
                if (global.pairedBotNumbers instanceof Set) global.pairedBotNumbers.delete(number);
                clearReconnectTimer(number);
                deleteSessionFiles(number);
                removeFromPairsList(number);
                await notifyJid(mainSock, requesterJid, 'SESSION REMOVED', 'Number +' + number + ' was logged out from WhatsApp, so its session has been deleted.');
                return;
            }

            sessionInfo.reconnectAttempts++;
            sessionInfo.status = 'reconnecting';

            const delayMs = isRestartRequired ? 500 : getBackoffDelay(sessionInfo.reconnectAttempts);
            scheduleReconnect(number, delayMs, () => startPairSession(number, requesterJid, mainSock, false));
        } else if (connection === 'open') {
            sessionInfo.status = 'connected';
            sessionInfo.pairingInProgress = false;
            addToPairsList(number, sessionInfo.addedBy || 'web');
            if (!(global.pairedBotNumbers instanceof Set)) global.pairedBotNumbers = new Set();
            global.pairedBotNumbers.add(number);
            sessionInfo.reconnectAttempts = 0;
            clearReconnectTimer(number);
            console.log('✅ Pair session +' + number + ' connected successfully!');
            await notifyJid(mainSock, requesterJid, 'PAIR CONNECTED', 'Number +' + number + ' has been successfully connected to the bot.');
        }
    });

    attachSessionHandlers(sock, false);

    if (wantsCode && !sock.authState.creds.registered) {
        const opened = await waitForSocketOpen(sock, 15000);
        if (!opened) {
            throw new Error('Connection did not open in time, please try again.');
        }
        await new Promise(resolve => setTimeout(resolve, 3000));
        const code = await requestCodeWithRetry(sock, number, 5, 1000);
        return { code, sessionInfo };
    }

    return { code: null, sessionInfo };
}

async function addPair(number, requesterJid, mainSock, callerNumber, callerIsOwner) {
    const cleanNumber = cleanPhoneNumber(number);
    if (!cleanNumber || cleanNumber.length < 8) {
        return { error: 'Please provide a valid number with country code, for example 27673542262.' };
    }
    const existing = activeSessions.get(cleanNumber);
    if (existing) {
        if (existing.sock?.authState?.creds?.registered) {
            return { error: 'This number is already paired or currently connected.' };
        }
        await disposeSession(cleanNumber, true);
    }
    try {
        const result = await startPairSession(cleanNumber, requesterJid, mainSock, true);
        const active = activeSessions.get(cleanNumber);
        if (active) active.addedBy = callerNumber || null;
        return { code: result.code, number: cleanNumber };
    } catch (e) {
        await disposeSession(cleanNumber, true);
        return { error: e.message || 'Failed to generate pairing code, please try again.' };
    }
}

async function addWebPair(number, mainSock) {
    const cleanNumber = cleanPhoneNumber(number);
    if (!cleanNumber || cleanNumber.length < 8) {
        return { error: 'Please provide a valid number with country code, for example 27673542262.' };
    }
    const existing = activeSessions.get(cleanNumber);
    if (existing) {
        if (existing.sock?.authState?.creds?.registered) {
            return { error: 'This number is already paired or currently connected.' };
        }
        await disposeSession(cleanNumber, true);
    }
    try {
        const result = await startPairSession(cleanNumber, null, mainSock, true);
        const active = activeSessions.get(cleanNumber);
        if (active) active.addedBy = 'web';
        return { code: result.code, number: cleanNumber };
    } catch (e) {
        await disposeSession(cleanNumber, true);
        return { error: e.message || 'Failed to generate pairing code, please try again.' };
    }
}

async function delPair(number, callerNumber, callerIsOwner) {
    const cleanNumber = cleanPhoneNumber(number);
    const entry = findPairEntry(cleanNumber);
    if (!entry) {
        return { error: 'This number is not in the linked list.' };
    }
    if (!callerIsOwner && entry.addedBy !== callerNumber) {
        return { error: 'You can only remove numbers that you linked yourself.' };
    }
    clearReconnectTimer(cleanNumber);
    const session = activeSessions.get(cleanNumber);
    if (session && session.sock) {
        try { await session.sock.logout(); } catch (e) {}
        try { session.sock.end(undefined); } catch (e) {}
    }
    activeSessions.delete(cleanNumber);
    if (global.pairedBotNumbers instanceof Set) global.pairedBotNumbers.delete(cleanNumber);
    deleteSessionFiles(cleanNumber);
    removeFromPairsList(cleanNumber);
    return { number: cleanNumber };
}

function getSessionStatus(number) {
    syncPairedOwnerNumbers();
    const cleanNumber = cleanPhoneNumber(number);
    const session = activeSessions.get(cleanNumber);
    if (session) return session.status;
    const entry = findPairEntry(cleanNumber);
    return entry ? 'offline' : 'idle';
}

function listPairs(callerNumber, callerIsOwner) {
    syncPairedOwnerNumbers();
    const list = loadPairsList();
    const filtered = callerIsOwner ? list : list.filter(e => e.addedBy === callerNumber);
    return filtered.map(e => {
        const session = activeSessions.get(e.number);
        return { number: e.number, status: session ? session.status : 'offline' };
    });
}

async function clearPairs(callerNumber, callerIsOwner) {
    const list = loadPairsList();
    const targets = callerIsOwner ? list : list.filter(e => e.addedBy === callerNumber);
    for (const entry of targets) {
        await delPair(entry.number, callerNumber, true);
    }
    return targets.length;
}

function getCountryStats() {
    const list = loadPairsList();
    const counts = {};
    for (const entry of list) {
        const c = detectCountry(entry.number);
        const key = c.name;
        if (!counts[key]) counts[key] = { country: c.name, flag: c.flag, count: 0 };
        counts[key].count++;
    }
    const total = list.length;
    return Object.values(counts)
        .map(c => ({ country: c.country, flag: c.flag, count: c.count, percent: total ? Math.round((c.count / total) * 1000) / 10 : 0 }))
        .sort((a, b) => b.count - a.count);
}

function getStats() {
    const list = loadPairsList();
    let online = 0;
    for (const entry of list) {
        const session = activeSessions.get(entry.number);
        if (session && session.status === 'connected') online++;
    }
    return {
        total: list.length,
        online,
        offline: list.length - online
    };
}

async function restorePairs(mainSock) {
    const list = loadPairsList();
    syncPairedOwnerNumbers();
    for (const entry of list) {
        if (activeSessions.has(entry.number)) continue;
        try {
            await startPairSession(entry.number, null, mainSock, false);
        } catch (e) {}
        await new Promise(resolve => setTimeout(resolve, 2500));
    }
}

function getAllPairedNumbers() {
    syncPairedOwnerNumbers();
    return loadPairsList().map(e => e.number);
}

module.exports = {
    addPair,
    addWebPair,
    delPair,
    listPairs,
    clearPairs,
    restorePairs,
    getSessionStatus,
    getStats,
    getCountryStats,
    setPendingNumberRequest,
    isPendingNumberRequest,
    clearPendingNumberRequest,
    cleanPhoneNumber,
    getAllPairedNumbers
};
