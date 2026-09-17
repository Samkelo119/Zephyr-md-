const fs = require('fs');
const path = require('path');
const { reply, box, normalizeJidNumber, isGroupAdmin } = require('../../../helper');

const dataDir = path.join(__dirname, '../../../data');
if (!fs.existsSync(dataDir)) fs.mkdirSync(dataDir, { recursive: true });
const settingsFile = path.join(dataDir, 'welcome.json');
const menuJpgPath = path.join(__dirname, '../../menu.jpg');

function loadSettings() {
    try {
        if (!fs.existsSync(settingsFile)) {
            const fresh = { welcome: {}, goodbye: {} };
            fs.writeFileSync(settingsFile, JSON.stringify(fresh, null, 2));
            return fresh;
        }
        const data = JSON.parse(fs.readFileSync(settingsFile, 'utf-8'));
        if (!data.welcome) data.welcome = {};
        if (!data.goodbye) data.goodbye = {};
        return data;
    } catch (e) {
        return { welcome: {}, goodbye: {} };
    }
}

function saveSettings() {
    fs.writeFileSync(settingsFile, JSON.stringify(settings, null, 2));
}

let settings = loadSettings();

function isWelcomeEnabled(jid) {
    return !!settings.welcome[jid];
}

function isGoodbyeEnabled(jid) {
    return !!settings.goodbye[jid];
}

function formatDateTime() {
    const now = new Date();
    return {
        date: now.toLocaleDateString('en-US'),
        time: now.toLocaleTimeString('en-US')
    };
}

function resolveRealJid(metadata, lidOrJid) {
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

async function getWelcomeImage(sock, groupJid, participantJid) {
    const userPic = await getProfilePicture(sock, participantJid);
    if (userPic) return { url: userPic };

    const groupPic = await getProfilePicture(sock, groupJid);
    if (groupPic) return { url: groupPic };

    try {
        if (fs.existsSync(menuJpgPath)) {
            return fs.readFileSync(menuJpgPath);
        }
    } catch (e) {}

    return null;
}

async function sendWelcomeMessage(sock, groupJid, participantJid) {
    try {
        const metadata = await sock.groupMetadata(groupJid);
        const groupName = metadata.subject || 'this group';
        const { date, time } = formatDateTime();
        const realJid = resolveRealJid(metadata, participantJid);
        const mentionTag = '@' + normalizeJidNumber(realJid);

        const caption = box('WELCOME MY LOVE❤',
            mentionTag + '\nGroup: ' + groupName + '\nDate: ' + date + '\nTime: ' + time);

        const imageSource = await getWelcomeImage(sock, groupJid, realJid);

        if (imageSource) {
            await sock.sendMessage(groupJid, {
                image: imageSource,
                caption: caption,
                mentions: [realJid]
            });
        } else {
            await sock.sendMessage(groupJid, {
                text: caption,
                mentions: [realJid]
            });
        }
    } catch (e) {}
}

async function sendGoodbyeMessage(sock, groupJid, participantJid) {
    try {
        const metadata = await sock.groupMetadata(groupJid);
        const groupName = metadata.subject || 'this group';
        const { date, time } = formatDateTime();
        const realJid = resolveRealJid(metadata, participantJid);
        const mentionTag = '@' + normalizeJidNumber(realJid);

        const caption = box('GOODBYE MY LOVE👋',
            mentionTag + '\nGroup: ' + groupName + '\nDate: ' + date + '\nTime: ' + time);

        const imageSource = await getWelcomeImage(sock, groupJid, realJid);

        if (imageSource) {
            await sock.sendMessage(groupJid, {
                image: imageSource,
                caption: caption,
                mentions: [realJid]
            });
        } else {
            await sock.sendMessage(groupJid, {
                text: caption,
                mentions: [realJid]
            });
        }
    } catch (e) {}
}

async function handleGroupParticipantsUpdate(sock, update) {
    try {
        const groupJid = update.id;
        const participants = update.participants || [];
        const action = update.action;
        if (!groupJid || !participants.length) return;

        for (const participant of participants) {
            const participantJid = typeof participant === 'string'
                ? participant
                : (participant.id || participant.phoneNumber || participant.jid);
            if (!participantJid) continue;

            if (action === 'add' && isWelcomeEnabled(groupJid)) {
                await sendWelcomeMessage(sock, groupJid, participantJid);
            } else if (action === 'remove' && isGoodbyeEnabled(groupJid)) {
                await sendGoodbyeMessage(sock, groupJid, participantJid);
            }
        }
    } catch (e) {}
}

const WELCOME_COMMANDS = ['welcome', 'goodbye'];

async function handleWelcomeCommand(sock, jid, msg, command, params, sender, senderIsOwner) {
    switch (command) {
        case 'welcome': {
            if (!jid.endsWith('@g.us')) {
                await reply(sock, jid, msg, box('WELCOME', 'This command only works inside groups.'));
                break;
            }
            const senderIsAdmin = await isGroupAdmin(sock, jid, sender);
            if (!senderIsOwner && !senderIsAdmin) {
                await reply(sock, jid, msg, box('ACCESS DENIED', 'Only the group admin or bot owner can use this command.'));
                break;
            }
            const mode = (params[0] || '').toLowerCase();
            if (mode === 'on') {
                settings.welcome[jid] = true;
                saveSettings();
                await reply(sock, jid, msg, box('WELCOME', 'Welcome messages are now ON for this group.'));
            } else if (mode === 'off') {
                settings.welcome[jid] = false;
                saveSettings();
                await reply(sock, jid, msg, box('WELCOME', 'Welcome messages are now OFF for this group.'));
            } else {
                await reply(sock, jid, msg, box('WELCOME', 'Usage: welcome on\nUsage: welcome off'));
            }
            break;
        }

        case 'goodbye': {
            if (!jid.endsWith('@g.us')) {
                await reply(sock, jid, msg, box('GOODBYE', 'This command only works inside groups.'));
                break;
            }
            const senderIsAdmin = await isGroupAdmin(sock, jid, sender);
            if (!senderIsOwner && !senderIsAdmin) {
                await reply(sock, jid, msg, box('ACCESS DENIED', 'Only the group admin or bot owner can use this command.'));
                break;
            }
            const mode = (params[0] || '').toLowerCase();
            if (mode === 'on') {
                settings.goodbye[jid] = true;
                saveSettings();
                await reply(sock, jid, msg, box('GOODBYE', 'Goodbye messages are now ON for this group.'));
            } else if (mode === 'off') {
                settings.goodbye[jid] = false;
                saveSettings();
                await reply(sock, jid, msg, box('GOODBYE', 'Goodbye messages are now OFF for this group.'));
            } else {
                await reply(sock, jid, msg, box('GOODBYE', 'Usage: goodbye on\nUsage: goodbye off'));
            }
            break;
        }
    }
}

module.exports = {
    handleWelcomeCommand,
    handleGroupParticipantsUpdate,
    WELCOME_COMMANDS
};

require('fs').watchFile(require.resolve(__filename), { interval: 500 }, () => {
  require('fs').unwatchFile(require.resolve(__filename));
  delete require.cache[require.resolve(__filename)];
  require(__filename);
});
