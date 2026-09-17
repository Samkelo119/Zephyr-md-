const fs = require('fs');
const path = require('path');
const pino = require('pino');
const { reply, box, normalizeJidNumber } = require('../../../helper');

let _baileysLib = null;
const getBaileys = async () => {
    if (!_baileysLib) {
        _baileysLib = await import('@mrlegendbot/baileys');
    }
    return _baileysLib;
};

const dataDir = path.join(__dirname, '../../../data');
if (!fs.existsSync(dataDir)) fs.mkdirSync(dataDir, { recursive: true });
const settingsFile = path.join(dataDir, 'antidelete.json');

function loadSettings() {
    try {
        if (!fs.existsSync(settingsFile)) {
            const fresh = { modes: {} };
            fs.writeFileSync(settingsFile, JSON.stringify(fresh, null, 2));
            return fresh;
        }
        const data = JSON.parse(fs.readFileSync(settingsFile, 'utf-8'));
        if (!data.modes) data.modes = {};
        return data;
    } catch (e) {
        return { modes: {} };
    }
}

function saveSettings() {
    fs.writeFileSync(settingsFile, JSON.stringify(settings, null, 2));
}

let settings = loadSettings();

function getMode(botNumber) {
    return settings.modes[botNumber] || 'off';
}

function setMode(botNumber, mode) {
    settings.modes[botNumber] = mode;
    saveSettings();
}

const messageCache = new Map();
const CACHE_TTL_MS = 30 * 60 * 1000;

setInterval(() => {
    const now = Date.now();
    for (const [key, value] of messageCache) {
        if (now - value.ts > CACHE_TTL_MS) messageCache.delete(key);
    }
}, 5 * 60 * 1000).unref();

function resolveRealJid(metadata, lidOrJid) {
    if (!lidOrJid) return lidOrJid;
    if (!metadata || !metadata.participants) return lidOrJid;
    const p = metadata.participants.find(x =>
        x.id === lidOrJid || x.lid === lidOrJid || x.jid === lidOrJid || x.phoneNumber === lidOrJid
    );
    if (!p) return lidOrJid;
    return p.phoneNumber || p.jid || p.pn || lidOrJid;
}

function detectType(message) {
    if (!message) return null;
    if (message.imageMessage) return 'image';
    if (message.videoMessage) return 'video';
    if (message.audioMessage) return 'audio';
    if (message.stickerMessage) return 'sticker';
    if (message.documentMessage) return 'document';
    if (message.conversation || message.extendedTextMessage) return 'text';
    return null;
}

function getContentText(message, type) {
    if (type === 'image') return message.imageMessage.caption || '';
    if (type === 'video') return message.videoMessage.caption || '';
    if (type === 'document') return message.documentMessage.caption || '';
    if (type === 'text') return message.conversation || (message.extendedTextMessage && message.extendedTextMessage.text) || '';
    return '';
}

async function processDeletedMessage(sock, jid, originalMsg, mode) {
    try {
        const isGroup = jid.endsWith('@g.us');
        const type = detectType(originalMsg.message);
        if (!type) return;

        let metadata = null;
        let senderRealJid = originalMsg.key.participant || originalMsg.key.remoteJid;
        let botRealJid = normalizeJidNumber(sock.user.id) + '@s.whatsapp.net';

        if (isGroup) {
            metadata = await sock.groupMetadata(jid);
            senderRealJid = resolveRealJid(metadata, senderRealJid);
            botRealJid = resolveRealJid(metadata, botRealJid);
        }

        const contentText = getContentText(originalMsg.message, type);

        const lines = [];
        if (mode === 'pro') {
            lines.push(isGroup ? '🏷️ Group: ' + (metadata.subject || 'Unknown') : '💬 Chat: Personal Chat');
        } else if (isGroup) {
            lines.push('🏷️ Group: ' + (metadata.subject || 'Unknown'));
        }
        lines.push('📤 Sender by: @' + normalizeJidNumber(senderRealJid));
        lines.push('🤖 Open by: @' + normalizeJidNumber(botRealJid));

        const title = mode === 'pro' ? 'ANTIDELETE PRO - MESSAGE DELETED' : 'ANTIDELETE - MESSAGE DELETED';
        const caption = box(title, lines.join('\n') + (contentText ? '\n\n' + contentText : ''));
        const mentions = [...new Set([senderRealJid, botRealJid].filter(Boolean))];

        const destJid = mode === 'pro' ? (normalizeJidNumber(sock.user.id) + '@s.whatsapp.net') : jid;

        let buffer = null;
        if (type !== 'text') {
            const { downloadMediaMessage } = await getBaileys();
            buffer = await downloadMediaMessage(
                originalMsg,
                'buffer',
                {},
                { logger: pino({ level: 'silent' }) }
            );
        }

        if (type === 'text') {
            await sock.sendMessage(destJid, { text: caption, mentions });
        } else if (type === 'image') {
            await sock.sendMessage(destJid, { image: buffer, caption, mentions });
        } else if (type === 'video') {
            await sock.sendMessage(destJid, { video: buffer, caption, mentions, gifPlayback: !!originalMsg.message.videoMessage.gifPlayback });
        } else if (type === 'audio') {
            await sock.sendMessage(destJid, { audio: buffer, mimetype: originalMsg.message.audioMessage.mimetype || 'audio/ogg; codecs=opus', ptt: !!originalMsg.message.audioMessage.ptt });
            await sock.sendMessage(destJid, { text: caption, mentions });
        } else if (type === 'document') {
            await sock.sendMessage(destJid, { document: buffer, mimetype: originalMsg.message.documentMessage.mimetype, fileName: originalMsg.message.documentMessage.fileName || 'file', caption, mentions });
        } else if (type === 'sticker') {
            await sock.sendMessage(destJid, { sticker: buffer });
            await sock.sendMessage(destJid, { text: caption, mentions });
        }
    } catch (e) {
        console.log('ANTIDELETE process error:', e.message);
    }
}

async function handleAntideleteWatch(sock, msg) {
    try {
        if (!sock.user || !sock.user.id) return;
        if (!msg || !msg.key || !msg.message) return;

        const botNumber = normalizeJidNumber(sock.user.id);
        const mode = getMode(botNumber);

        const proto = msg.message.protocolMessage;
        if (proto && (proto.type === 0 || proto.type === 'REVOKE') && proto.key && proto.key.id) {
            if (mode === 'off') return;
            if (msg.key.fromMe) return;

            const jid = msg.key.remoteJid;
            const cacheKey = botNumber + '::' + jid + '::' + proto.key.id;
            const cached = messageCache.get(cacheKey);
            messageCache.delete(cacheKey);
            if (!cached) return;

            await processDeletedMessage(sock, jid, cached.msg, mode);
            return;
        }

        if (mode === 'off') return;

        const cacheKey = botNumber + '::' + msg.key.remoteJid + '::' + msg.key.id;
        messageCache.set(cacheKey, { msg, ts: Date.now() });
    } catch (e) {
        console.log('ANTIDELETE watch error:', e.message);
    }
}

const ANTIDELETE_COMMANDS = ['antidelete'];

async function handleAntideleteCommand(sock, jid, msg, command, params, sender, senderIsOwner) {
    switch (command) {
        case 'antidelete': {
            if (!senderIsOwner) {
                await reply(sock, jid, msg, box('ACCESS DENIED', 'Only the bot owner can use this command.'));
                break;
            }
            if (!sock.user || !sock.user.id) break;

            const botNumber = normalizeJidNumber(sock.user.id);
            const mode = (params[0] || '').toLowerCase();

            if (mode === 'off') {
                setMode(botNumber, 'off');
                await reply(sock, jid, msg, box('ANTIDELETE', 'ANTIDELETE is now OFF.'));
            } else if (mode === 'on') {
                setMode(botNumber, 'on');
                await reply(sock, jid, msg, box('ANTIDELETE', 'ANTIDELETE is now ON.\n\nAny deleted message, in a group or a personal chat, will be auto downloaded and resent in the same chat it was deleted from.'));
            } else if (mode === 'pro') {
                setMode(botNumber, 'pro');
                await reply(sock, jid, msg, box('ANTIDELETE', 'ANTIDELETE PRO is now ON.\n\nAny deleted message, in a group or a personal chat, will be auto downloaded and sent privately to this bot number along with its source.'));
            } else {
                await reply(sock, jid, msg, box('ANTIDELETE', 'Usage: antidelete on\nUsage: antidelete off\nUsage: antidelete pro'));
            }
            break;
        }
    }
}

module.exports = {
    handleAntideleteCommand,
    handleAntideleteWatch,
    ANTIDELETE_COMMANDS
};

require('fs').watchFile(require.resolve(__filename), { interval: 500 }, () => {
  require('fs').unwatchFile(require.resolve(__filename));
  delete require.cache[require.resolve(__filename)];
  require(__filename);
});
