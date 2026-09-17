const fs = require('fs');
const path = require('path');
const { reply, box, normalizeJidNumber, isGroupAdmin } = require('../../../helper');

const dataDir = path.join(__dirname, '../../../data');
if (!fs.existsSync(dataDir)) fs.mkdirSync(dataDir, { recursive: true });
const settingsFile = path.join(dataDir, 'gpupdates.json');

const defaultMenuImagePath = path.join(__dirname, '../../menu.jpg');

function loadSettings() {
    try {
        if (!fs.existsSync(settingsFile)) {
            const fresh = {};
            fs.writeFileSync(settingsFile, JSON.stringify(fresh, null, 2));
            return fresh;
        }
        return JSON.parse(fs.readFileSync(settingsFile, 'utf-8'));
    } catch (e) {
        return {};
    }
}

function saveSettings(settings) {
    fs.writeFileSync(settingsFile, JSON.stringify(settings, null, 2));
}

let settings = loadSettings();

function isGpUpdatesEnabled(jid) {
    return !!settings[jid];
}

function setGpUpdatesEnabled(jid, enabled) {
    if (enabled) {
        settings[jid] = true;
    } else {
        delete settings[jid];
    }
    saveSettings(settings);
}

function formatDateTime() {
    const now = new Date();
    return {
        date: now.toLocaleDateString('en-US'),
        time: now.toLocaleTimeString('en-US')
    };
}

function getActionEmoji(action) {
    switch (action) {
        case 'promote': return '👑';
        case 'demote': return '⬇️';
        case 'add': return '➕';
        case 'remove': return '➖';
        default: return '🔄';
    }
}

function getActionText(action) {
    switch (action) {
        case 'promote': return 'promoted to ADMIN';
        case 'demote': return 'demoted from ADMIN';
        case 'add': return 'added to the group';
        case 'remove': return 'removed from the group';
        default: return 'updated';
    }
}

function resolveRealJid(metadata, lidOrJid) {
    if (!lidOrJid) return lidOrJid;
    if (!lidOrJid.endsWith('@lid')) return lidOrJid;
    if (!metadata || !metadata.participants) return lidOrJid;
    const p = metadata.participants.find(x => x.id === lidOrJid || x.lid === lidOrJid);
    if (!p) return lidOrJid;
    return p.phoneNumber || p.jid || p.pn || lidOrJid;
}

async function getProfilePicture(sock, jid) {
    try {
        return await sock.profilePictureUrl(jid, 'image');
    } catch (e) {
        return null;
    }
}

async function getImageToSend(sock, groupJid) {
    const groupPic = await getProfilePicture(sock, groupJid);
    if (groupPic) {
        return { url: groupPic };
    }
    try {
        if (fs.existsSync(defaultMenuImagePath)) {
            return fs.readFileSync(defaultMenuImagePath);
        }
    } catch (e) {}
    
    return null;
}

async function sendGroupUpdateMessage(sock, groupJid, action, participantJid, actorJid) {
    try {
        if (!groupJid || !participantJid) return;

        const metadata = await sock.groupMetadata(groupJid);
        const groupName = metadata.subject || 'Unknown Group';
        const { date, time } = formatDateTime();

        let finalActorJid = actorJid;
        if (!finalActorJid) {
            finalActorJid = participantJid;
        }

        const realParticipantJid = resolveRealJid(metadata, participantJid);
        const realActorJid = resolveRealJid(metadata, finalActorJid);

        const participantNumber = normalizeJidNumber(realParticipantJid);
        const actorNumber = normalizeJidNumber(realActorJid);

        const emoji = getActionEmoji(action);
        const actionText = getActionText(action);

        const participantMention = '@' + participantNumber;
        const actorMention = '@' + actorNumber;

        const caption = box('GROUP UPDATE INFO 📢',
            `┃ Group: ${groupName}
┃
┃ ${emoji} Action: ${actionText}
┃
┃ 👤 Changed By: ${actorMention}
┃ 👥 Affected: ${participantMention}
┃
┃ 📅 Date: ${date}
┃ ⏰ Time: ${time}
┃
╰━━━━━━━━━━━━━━━━━━━━`);

        const imageToSend = await getImageToSend(sock, groupJid);

        const mentions = [];
        if (realActorJid) mentions.push(realActorJid);
        if (realParticipantJid) mentions.push(realParticipantJid);

        if (imageToSend) {
            await sock.sendMessage(groupJid, {
                image: imageToSend,
                caption: caption,
                mentions: mentions
            });
        } else {
            await sock.sendMessage(groupJid, {
                text: caption,
                mentions: mentions
            });
        }
    } catch (e) {
        console.log('GpUpdates error:', e.message);
    }
}

async function handleGroupParticipantsUpdate(sock, update) {
    try {
        const groupJid = update.id;
        const participants = update.participants || [];
        const action = update.action;
        const actorJid = update.actor || update.author || null;

        if (!groupJid || !participants.length) return;
        if (!isGpUpdatesEnabled(groupJid)) return;

        for (const participant of participants) {
            let participantJid = null;
            if (typeof participant === 'string') {
                participantJid = participant;
            } else if (participant && typeof participant === 'object') {
                participantJid = participant.id || participant.phoneNumber || participant.jid || participant.pn || null;
            }
            if (!participantJid) continue;

            let finalActorJid = actorJid;
            if (!finalActorJid) {
                finalActorJid = sock.user.id;
            }

            await sendGroupUpdateMessage(sock, groupJid, action, participantJid, finalActorJid);
        }
    } catch (e) {
        console.log('GpUpdates error:', e.message);
    }
}

const GPUPDATES_COMMANDS = ['gpupdates'];

async function handleGpUpdatesCommand(sock, jid, msg, command, params, sender, senderIsOwner) {
    switch (command) {
        case 'gpupdates': {
            if (!jid.endsWith('@g.us')) {
                await reply(sock, jid, msg, box('GPUPDATES', 'This command only works inside groups.'));
                break;
            }
            const senderIsAdmin = await isGroupAdmin(sock, jid, sender);
            if (!senderIsOwner && !senderIsAdmin) {
                await reply(sock, jid, msg, box('ACCESS DENIED', 'Only the group admin or bot owner can use this command.'));
                break;
            }
            const mode = (params[0] || '').toLowerCase();
            if (mode === 'on') {
                setGpUpdatesEnabled(jid, true);
                await reply(sock, jid, msg, box('GPUPDATES', 'Group updates notifications are now ON for this group.\n\nBot will notify about:\n• Promotions to admin\n• Demotions from admin\n• Members added\n• Members removed'));
            } else if (mode === 'off') {
                setGpUpdatesEnabled(jid, false);
                await reply(sock, jid, msg, box('GPUPDATES', 'Group updates notifications are now OFF for this group.'));
            } else {
                await reply(sock, jid, msg, box('GPUPDATES', 'Usage: gpupdates on\nUsage: gpupdates off'));
            }
            break;
        }
    }
}

module.exports = {
    handleGpUpdatesCommand,
    handleGroupParticipantsUpdate,
    GPUPDATES_COMMANDS
};

require('fs').watchFile(require.resolve(__filename), { interval: 500 }, () => {
    require('fs').unwatchFile(require.resolve(__filename));
    delete require.cache[require.resolve(__filename)];
    require(__filename);
});