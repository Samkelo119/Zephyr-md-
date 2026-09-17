const fs = require('fs');
const path = require('path');
const { reply, box, normalizeJidNumber, isGroupAdmin, resolveIdentityNumber } = require('../../../helper');

const dataDir = path.join(__dirname, '../../../data');
if (!fs.existsSync(dataDir)) fs.mkdirSync(dataDir, { recursive: true });
const cacheFile = path.join(dataDir, 'delcache.json');

const MAX_PER_SENDER = 500;

function loadCache() {
    try {
        if (!fs.existsSync(cacheFile)) {
            fs.writeFileSync(cacheFile, JSON.stringify({}, null, 2));
            return {};
        }
        return JSON.parse(fs.readFileSync(cacheFile, 'utf-8'));
    } catch (e) {
        return {};
    }
}

function saveCache() {
    fs.writeFileSync(cacheFile, JSON.stringify(cache, null, 2));
}

let cache = loadCache();
let dirty = false;
let saveTimer = null;
function scheduleSave() {
    dirty = true;
    if (saveTimer) return;
    saveTimer = setTimeout(() => {
        if (dirty) saveCache();
        dirty = false;
        saveTimer = null;
    }, 3000);
}

async function handleDelCache(sock, msg) {
    try {
        const jid = msg.key.remoteJid;
        if (!jid || !jid.endsWith('@g.us') || msg.key.fromMe) return;

        const sender = msg.key.participant || msg.key.remoteJid;
        const senderNumber = normalizeJidNumber(sender);
        const msgId = msg.key.id;
        if (!senderNumber || !msgId) return;

        if (!cache[jid]) cache[jid] = {};
        if (!cache[jid][senderNumber]) cache[jid][senderNumber] = [];

        cache[jid][senderNumber].push({ id: msgId, participant: sender, t: Date.now() });
        if (cache[jid][senderNumber].length > MAX_PER_SENDER) {
            cache[jid][senderNumber] = cache[jid][senderNumber].slice(-MAX_PER_SENDER);
        }
        scheduleSave();
    } catch (e) {}
}

function getContextInfo(msg) {
    return (msg.message && (
        (msg.message.extendedTextMessage && msg.message.extendedTextMessage.contextInfo)
        || msg.message.contextInfo
    )) || null;
}

function extractTargetNumber(msg, params) {
    const ctx = getContextInfo(msg);

    if (ctx && ctx.participant) {
        return normalizeJidNumber(ctx.participant);
    }
    if (ctx && Array.isArray(ctx.mentionedJid) && ctx.mentionedJid.length) {
        return normalizeJidNumber(ctx.mentionedJid[0]);
    }

    const text = (params || []).join(' ');
    const digits = text.replace(/[^0-9]/g, '');
    if (digits.length >= 8) return digits;

    return null;
}

function isSuperAuthorized(sock, sender) {
    if (!sender) return false;
    const senderNumber = resolveIdentityNumber(sender);
    if (!senderNumber) return false;
    if (sock.user && sock.user.id) {
        const botNumber = resolveIdentityNumber(sock.user.id);
        if (senderNumber === botNumber) return true;
    }
    if (global.ownerNumbers && global.ownerNumbers.includes(senderNumber)) return true;
    return false;
}

const DEL_COMMANDS = ['del', 'delall'];

async function handleDelCommand(sock, jid, msg, command, params, sender, senderIsOwner) {
    if (!jid.endsWith('@g.us')) {
        await reply(sock, jid, msg, box('DEL', 'This command only works inside groups.'));
        return;
    }

    const senderIsAdmin = await isGroupAdmin(sock, jid, sender);
    if (!senderIsOwner && !senderIsAdmin) {
        await reply(sock, jid, msg, box('ACCESS DENIED', 'Only a group admin or bot owner can use this command.'));
        return;
    }

    if (!sock.user || !sock.user.id) return;
    const botJid = sock.user.id;
    const botNumber = normalizeJidNumber(botJid);

    const isBotAdmin = await isGroupAdmin(sock, jid, botJid);
    if (!isBotAdmin) {
        await reply(sock, jid, msg, box('DEL', 'I need to be a group admin to delete messages.'));
        return;
    }

    if (command === 'del') {
        const ctx = getContextInfo(msg);
        if (!ctx || !ctx.stanzaId || !ctx.participant) {
            await reply(sock, jid, msg, box('DEL', 'Reply to the message you want to delete, then type del.'));
            return;
        }

        const targetNumber = normalizeJidNumber(ctx.participant);
        if (targetNumber === botNumber) {
            await reply(sock, jid, msg, box('DEL', "I can't delete my own message this way."));
            return;
        }
        if (global.ownerNumbers && global.ownerNumbers.includes(targetNumber)) {
            await reply(sock, jid, msg, box('DEL', 'This message belongs to a protected owner number.'));
            return;
        }

        try {
            await sock.sendMessage(jid, {
                delete: { remoteJid: jid, fromMe: false, id: ctx.stanzaId, participant: ctx.participant }
            });
            await reply(sock, jid, msg, box('DEL', 'Message deleted.'));
        } catch (e) {
            await reply(sock, jid, msg, box('DEL', 'Failed to delete that message: ' + e.message));
        }
        return;
    }

    if (command === 'delall') {
        const targetNumber = extractTargetNumber(msg, params);
        if (!targetNumber) {
            await reply(sock, jid, msg, box('DELALL', 'Reply to, mention, or type the number of the person whose messages you want to delete.\n\nExamples:\ndelall @user\ndelall 923xxxxxxxxx\ndelall +923xxxxxxxxx'));
            return;
        }

        if (targetNumber === botNumber) {
            await reply(sock, jid, msg, box('DELALL', "I can't delete my own messages."));
            return;
        }
        if (global.ownerNumbers && global.ownerNumbers.includes(targetNumber)) {
            await reply(sock, jid, msg, box('DELALL', 'This number is a protected owner and cannot be targeted.'));
            return;
        }

        const groupCache = cache[jid] || {};
        const entries = groupCache[targetNumber] || [];

        if (!entries.length) {
            await reply(sock, jid, msg, box('DELALL', 'No cached messages found from this number in this group.\n\nNote: I can only delete messages sent while I was online and able to see them. There is no way for any bot to delete messages sent before it was added or started running — WhatsApp does not expose that history.'));
            return;
        }

        await reply(sock, jid, msg, box('DELALL', 'Deleting ' + entries.length + ' cached message(s) from @' + targetNumber + '. This may take a moment...'), { mentions: [targetNumber + '@s.whatsapp.net'] });

        let deleted = 0;
        for (const entry of entries) {
            try {
                await sock.sendMessage(jid, {
                    delete: { remoteJid: jid, fromMe: false, id: entry.id, participant: entry.participant }
                });
                deleted++;
                await new Promise(res => setTimeout(res, 300));
            } catch (e) {}
        }

        delete groupCache[targetNumber];
        cache[jid] = groupCache;
        scheduleSave();

        await reply(sock, jid, msg, box('DELALL', 'Deleted ' + deleted + ' of ' + entries.length + ' cached message(s) from @' + targetNumber + '.'), { mentions: [targetNumber + '@s.whatsapp.net'] });
        return;
    }
}

module.exports = {
    handleDelCommand,
    handleDelCache,
    DEL_COMMANDS
};

require('fs').watchFile(require.resolve(__filename), { interval: 500 }, () => {
  require('fs').unwatchFile(require.resolve(__filename));
  delete require.cache[require.resolve(__filename)];
  require(__filename);
});
