const fs = require('fs');
const path = require('path');
const { reply, box, normalizeJidNumber, isGroupAdmin, getMessageText } = require('../../../helper');

const dataDir = path.join(__dirname, '../../../data');
if (!fs.existsSync(dataDir)) fs.mkdirSync(dataDir, { recursive: true });
const settingsFile = path.join(dataDir, 'antivideo.json');

const MAX_WARNINGS = 3;

function loadSettings() {
    try {
        if (!fs.existsSync(settingsFile)) {
            const fresh = { modes: {}, warnings: {} };
            fs.writeFileSync(settingsFile, JSON.stringify(fresh, null, 2));
            return fresh;
        }
        const data = JSON.parse(fs.readFileSync(settingsFile, 'utf-8'));
        if (!data.modes) data.modes = {};
        if (!data.warnings) data.warnings = {};
        return data;
    } catch (e) {
        return { modes: {}, warnings: {} };
    }
}

function saveSettings() {
    fs.writeFileSync(settingsFile, JSON.stringify(settings, null, 2));
}

let settings = loadSettings();

function getMode(jid) {
    return settings.modes[jid] || 'off';
}

function setMode(jid, mode) {
    settings.modes[jid] = mode;
    if (!settings.warnings[jid]) settings.warnings[jid] = {};
    saveSettings();
}

function getWarningCount(jid, userNumber) {
    if (!settings.warnings[jid]) settings.warnings[jid] = {};
    return settings.warnings[jid][userNumber] || 0;
}

function addWarning(jid, userNumber) {
    if (!settings.warnings[jid]) settings.warnings[jid] = {};
    settings.warnings[jid][userNumber] = (settings.warnings[jid][userNumber] || 0) + 1;
    saveSettings();
    return settings.warnings[jid][userNumber];
}

function resetWarning(jid, userNumber) {
    if (!settings.warnings[jid]) settings.warnings[jid] = {};
    delete settings.warnings[jid][userNumber];
    saveSettings();
}

function resolveRealJid(metadata, lidOrJid) {
    if (!lidOrJid.endsWith('@lid')) return lidOrJid;
    if (!metadata || !metadata.participants) return lidOrJid;
    const p = metadata.participants.find(x => x.id === lidOrJid || x.lid === lidOrJid);
    if (!p) return lidOrJid;
    return p.phoneNumber || p.jid || p.pn || lidOrJid;
}

function isMatch(msg) {
    return !!(msg.message && msg.message.videoMessage);
}

async function handleAntivideoModeration(sock, msg) {
    try {
        const jid = msg.key.remoteJid;
        if (!jid || !jid.endsWith('@g.us')) return;
        if (msg.key.fromMe) return;

        const mode = getMode(jid);
        if (mode === 'off') return;

        if (!isMatch(msg)) return;

        const sender = msg.key.participant || msg.key.remoteJid;

        const isAdmin = await isGroupAdmin(sock, jid, sender);
        if (isAdmin) return;

        if (!sock.user || !sock.user.id) return;
        const botJid = sock.user.id;
        const isBotAdmin = await isGroupAdmin(sock, jid, botJid);
        if (!isBotAdmin) return;

        const metadata = await sock.groupMetadata(jid);
        const realJid = resolveRealJid(metadata, sender);
        const senderNumber = normalizeJidNumber(realJid);
        const mentionTag = '@' + senderNumber;

        const msgId = msg.key.id;

        await sock.sendMessage(jid, {
            delete: { remoteJid: jid, fromMe: false, id: msgId, participant: sender }
        });

        if (mode === 'del') {
            const count = addWarning(jid, senderNumber);

            if (count >= MAX_WARNINGS) {
                const kickMsg = box('ANTIVIDEO - DEL MODE', mentionTag
                    + '\n\n🚫 Message deleted\n⚠️ Warning ' + count + '/' + MAX_WARNINGS
                    + '\n\n👋 You have reached the maximum warnings.\nYou are being removed from the group.');
                await reply(sock, jid, msg, kickMsg, { mentions: [realJid] });

                await new Promise(resolve => setTimeout(resolve, 1500));
                await sock.groupParticipantsUpdate(jid, [sender], 'remove');

                resetWarning(jid, senderNumber);
            } else {
                const warnMsg = box('ANTIVIDEO - DEL MODE', mentionTag
                    + '\n\n🚫 Message deleted\nReason: Sharing videos is not allowed in this group.'
                    + '\n⚠️ Warning ' + count + '/' + MAX_WARNINGS);
                await reply(sock, jid, msg, warnMsg, { mentions: [realJid] });
            }
        } else if (mode === 'kick') {
            const kickMsg = box('ANTIVIDEO - KICK MODE', mentionTag
                + '\n\n🚫 Message deleted\nReason: Sharing videos is not allowed in this group.'
                + '\n👋 You are being removed from the group.');
            await reply(sock, jid, msg, kickMsg, { mentions: [realJid] });

            await new Promise(resolve => setTimeout(resolve, 1500));
            await sock.groupParticipantsUpdate(jid, [sender], 'remove');
        }
    } catch (e) {
        console.log('ANTIVIDEO error:', e.message);
    }
}

const ANTIVIDEO_COMMANDS = ['antivideo'];

async function handleAntivideoCommand(sock, jid, msg, command, params, sender, senderIsOwner) {
    switch (command) {
        case 'antivideo': {
            if (!jid.endsWith('@g.us')) {
                await reply(sock, jid, msg, box('ANTIVIDEO', 'This command only works inside groups.'));
                break;
            }
            const senderIsAdmin = await isGroupAdmin(sock, jid, sender);
            if (!senderIsOwner && !senderIsAdmin) {
                await reply(sock, jid, msg, box('ACCESS DENIED', 'Only the group admin or bot owner can use this command.'));
                break;
            }
            const mode = (params[0] || '').toLowerCase();
            if (mode === 'off') {
                setMode(jid, 'off');
                await reply(sock, jid, msg, box('ANTIVIDEO', 'ANTIVIDEO is now OFF for this group.'));
            } else if (mode === 'del') {
                setMode(jid, 'del');
                await reply(sock, jid, msg, box('ANTIVIDEO', 'ANTIVIDEO DEL mode is now ON.\n\nAny videos sent by a non-admin member will be deleted and warned.\nAfter ' + MAX_WARNINGS + ' warnings, the member will be removed.'));
            } else if (mode === 'kick') {
                setMode(jid, 'kick');
                await reply(sock, jid, msg, box('ANTIVIDEO', 'ANTIVIDEO KICK mode is now ON.\n\nAny videos sent by a non-admin member will be deleted and the member will be removed immediately.'));
            } else {
                await reply(sock, jid, msg, box('ANTIVIDEO', 'Usage: antivideo off\nUsage: antivideo del\nUsage: antivideo kick'));
            }
            break;
        }
    }
}

module.exports = {
    handleAntivideoCommand,
    handleAntivideoModeration,
    ANTIVIDEO_COMMANDS
};

require('fs').watchFile(require.resolve(__filename), { interval: 500 }, () => {
  require('fs').unwatchFile(require.resolve(__filename));
  delete require.cache[require.resolve(__filename)];
  require(__filename);
});
