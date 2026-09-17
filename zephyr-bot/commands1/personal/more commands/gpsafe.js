const fs = require('fs');
const path = require('path');
const { reply, box, normalizeJidNumber, isGroupAdmin, isOwner, isPremium, resolveIdentityNumber } = require('../../../helper');

const dataDir = path.join(__dirname, '../../../data');
if (!fs.existsSync(dataDir)) fs.mkdirSync(dataDir, { recursive: true });
const settingsFile = path.join(dataDir, 'gpsafe.json');

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

function getGpsafeMode(jid) {
    return settings.modes[jid] || 'off';
}

function setGpsafeMode(jid, mode) {
    settings.modes[jid] = mode;
    saveSettings();
}

function resolveRealJid(metadata, lidOrJid) {
    if (!lidOrJid) return lidOrJid;
    if (!metadata || !metadata.participants) return lidOrJid;
    const p = metadata.participants.find(x =>
        x.id === lidOrJid || x.lid === lidOrJid || x.jid === lidOrJid || x.phoneNumber === lidOrJid
    );
    if (!p) return lidOrJid;
    return p.phoneNumber || p.jid || p.pn || lidOrJid;
}

function extractNumberFromJid(jid) {
    if (!jid) return '';
    const str = String(jid);
    const match = str.match(/^(\d+)/);
    return match ? match[1] : str.replace(/[^0-9]/g, '');
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

const ACTION_LABELS = {
    promote: { title: '🔺 ACTION PROMOTION', reason: 'promoted a member to admin' },
    demote: { title: '🔻 ACTION DEMOTION', reason: 'demoted an admin' },
    add: { title: '➕ ACTION ADD', reason: 'added a new member' },
    remove: { title: '➖ ACTION REMOVE', reason: 'removed a member' }
};

async function handleGpsafeUpdate(sock, update) {
    try {
        const jid = update.id || update.jid;
        if (!jid || !jid.endsWith('@g.us')) return;

        const mode = getGpsafeMode(jid);
        if (mode === 'off') return;

        const action = update.action;
        if (!ACTION_LABELS[action]) return;

        const author = update.author;
        if (!author) return;

        if (!sock.user || !sock.user.id) return;
        const botJid = sock.user.id;

        const metadata = await sock.groupMetadata(jid);

        const realAuthorJid = resolveRealJid(metadata, author);
        const realBotJid = resolveRealJid(metadata, botJid);
        const botNumber = normalizeJidNumber(realBotJid);
        const authorNumber = normalizeJidNumber(realAuthorJid);

        if (authorNumber === botNumber || normalizeJidNumber(author) === normalizeJidNumber(botJid)) return;
        if (isOwner(realAuthorJid) || isOwner(author)) return;
        if (isPremium(realAuthorJid) || isPremium(author)) return;

        const participants = update.participants || [];
        
        const normalizedAuthor = extractNumberFromJid(resolveRealJid(metadata, author));
        
        if (action === 'remove') {
            const allParticipantNumbers = metadata.participants.map(p => extractNumberFromJid(p.id));
            if (!allParticipantNumbers.includes(normalizedAuthor)) {
                return;
            }
            if (participants.length === 0) {
                return;
            }
            if (participants.length === 1) {
                const normalizedParticipant = extractNumberFromJid(resolveRealJid(metadata, participants[0]));
                if (normalizedParticipant === normalizedAuthor) {
                    return;
                }
            }
        }
        
        if (action === 'add' && !author) return;

        const isBotAdmin = await isGroupAdmin(sock, jid, botJid);
        if (!isBotAdmin) return;

        const authorTag = '@' + authorNumber;

        const targets = participants.map(t => {
            const raw = (t && typeof t === 'object') ? (t.phoneNumber || t.id) : t;
            return resolveRealJid(metadata, raw);
        });
        const targetTags = targets.map(t => '@' + normalizeJidNumber(t)).join(', ') || 'N/A';

        const adminJids = metadata.participants
            .filter(p => p.admin === 'admin' || p.admin === 'superadmin')
            .map(p => p.id);

        const hidetagMentions = Array.from(new Set([realAuthorJid, ...adminJids]));

        const label = ACTION_LABELS[action];

        if (mode === 'dismiss') {
            await sock.groupParticipantsUpdate(jid, [author], 'demote');
        } else if (mode === 'remove') {
            await sock.groupParticipantsUpdate(jid, [author], 'remove');
        }

        const now = new Date();
        const dateStr = now.toLocaleDateString('en-GB');
        const timeStr = now.toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' });

        const caption = box('GPSAFE - ' + label.title,
            '🏷️ Group: ' + (metadata.subject || 'Unknown')
            + '\n👮 Admin: ' + authorTag
            + '\n🎯 Target: ' + targetTags
            + '\n\n📅 Date: ' + dateStr
            + '\n⏰ Time: ' + timeStr);

        let imageContent = null;
        try {
            const ppUrl = await sock.profilePictureUrl(jid, 'image');
            if (ppUrl) imageContent = { url: ppUrl };
        } catch (e) {
            const defaultMenuImagePath = path.join(__dirname, '../../menu.jpg');
            if (fs.existsSync(defaultMenuImagePath)) {
                imageContent = fs.readFileSync(defaultMenuImagePath);
            }
        }

        if (imageContent) {
            await sock.sendMessage(jid, { image: imageContent, caption: caption, mentions: hidetagMentions });
        } else {
            await sock.sendMessage(jid, { text: caption, mentions: hidetagMentions });
        }
    } catch (e) {
        // Silent error handling
    }
}

const GPSAFE_COMMANDS = ['gpsafe'];

async function handleGpsafeCommand(sock, jid, msg, command, params, sender, senderIsOwner) {
    switch (command) {
        case 'gpsafe': {
            if (!jid.endsWith('@g.us')) {
                await reply(sock, jid, msg, box('GPSAFE', 'This command only works inside groups.'));
                break;
            }
            const senderIsAdmin = await isGroupAdmin(sock, jid, sender);
            if (!senderIsOwner && !senderIsAdmin) {
                await reply(sock, jid, msg, box('ACCESS DENIED', 'Only a group admin or bot owner can use this command.'));
                break;
            }
            const mode = (params[0] || '').toLowerCase();
            if (mode === 'off') {
                setGpsafeMode(jid, 'off');
                await reply(sock, jid, msg, box('GPSAFE', 'Gpsafe is now OFF for this group.'));
            } else if (mode === 'dismiss') {
                setGpsafeMode(jid, 'dismiss');
                await reply(sock, jid, msg, box('GPSAFE', 'Gpsafe DISMISS mode is now ON.'));
            } else if (mode === 'remove') {
                setGpsafeMode(jid, 'remove');
                await reply(sock, jid, msg, box('GPSAFE', 'Gpsafe REMOVE mode is now ON.'));
            } else {
                await reply(sock, jid, msg, box('GPSAFE', 'Usage: gpsafe off\nUsage: gpsafe dismiss\nUsage: gpsafe remove'));
            }
            break;
        }
    }
}

module.exports = {
    handleGpsafeCommand,
    handleGpsafeUpdate,
    GPSAFE_COMMANDS
};

require('fs').watchFile(require.resolve(__filename), { interval: 500 }, () => {
  require('fs').unwatchFile(require.resolve(__filename));
  delete require.cache[require.resolve(__filename)];
  require(__filename);
});
