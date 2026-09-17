const fs = require('fs');
const path = require('path');
const { reply, box, normalizeJidNumber, isGroupAdmin, isOwner, isPremium, resolveIdentityNumber } = require('../../../helper');

const dataDir = path.join(__dirname, '../../../data');
if (!fs.existsSync(dataDir)) fs.mkdirSync(dataDir, { recursive: true });
const settingsFile = path.join(dataDir, 'gpsafesettings.json');

function loadSettings() {
    try {
        if (!fs.existsSync(settingsFile)) {
            const fresh = { modes: {}, snapshots: {} };
            fs.writeFileSync(settingsFile, JSON.stringify(fresh, null, 2));
            return fresh;
        }
        const data = JSON.parse(fs.readFileSync(settingsFile, 'utf-8'));
        if (!data.modes) data.modes = {};
        if (!data.snapshots) data.snapshots = {};
        return data;
    } catch (e) {
        return { modes: {}, snapshots: {} };
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
    saveSettings();
}

function getSnapshot(jid) {
    return settings.snapshots[jid] || null;
}

function saveSnapshot(jid, metadata) {
    settings.snapshots[jid] = {
        subject: metadata.subject,
        desc: metadata.desc || '',
        announce: !!metadata.announce,
        restrict: !!metadata.restrict,
        memberAddMode: metadata.memberAddMode,
        joinApprovalMode: metadata.joinApprovalMode,
        inviteCode: metadata.inviteCode || null
    };
    saveSettings();
}

// Best-effort: some notification payloads include who triggered the change.
// Field names vary across Baileys forks/versions, so we check several.
function extractAuthor(update) {
    return update.author || update.participant || update.actor
        || (Array.isArray(update.participants) ? update.participants[0] : null)
        || null;
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

const FIELD_LABELS = {
    subject: { title: '✏️ GROUP NAME CHANGED', desc: 'Group name was changed' },
    desc: { title: '📝 GROUP DESCRIPTION CHANGED', desc: 'Group description was changed' },
    announce: { title: '💬 "SEND MESSAGES" SETTING CHANGED', desc: 'Who-can-send-messages setting was changed' },
    restrict: { title: '⚙️ "EDIT GROUP SETTINGS" CHANGED', desc: 'Who-can-edit-group-info setting was changed' },
    memberAddMode: { title: '👤 "ADD MEMBERS" SETTING CHANGED', desc: 'Who-can-add-members setting was changed' },
    joinApprovalMode: { title: '✅ "APPROVE NEW MEMBERS" CHANGED', desc: 'Member approval setting was changed' },
    inviteCode: { title: '🔗 GROUP LINK RESET', desc: 'The group invite link was reset/changed' }
};

async function revertField(sock, jid, field, oldValue) {
    try {
        if (field === 'subject' && oldValue) {
            await sock.groupUpdateSubject(jid, oldValue);
        } else if (field === 'desc') {
            await sock.groupUpdateDescription(jid, oldValue || '');
        } else if (field === 'announce') {
            await sock.groupSettingUpdate(jid, oldValue ? 'announcement' : 'not_announcement');
        } else if (field === 'restrict') {
            await sock.groupSettingUpdate(jid, oldValue ? 'locked' : 'unlocked');
        } else if (field === 'memberAddMode' && sock.groupMemberAddMode) {
            await sock.groupMemberAddMode(jid, oldValue ? 'admin_add' : 'all_member_add');
        } else if (field === 'joinApprovalMode' && sock.groupJoinApprovalMode) {
            await sock.groupJoinApprovalMode(jid, oldValue ? 'on' : 'off');
        }
        return true;
    } catch (e) {
        console.log('GPSAFESETTINGS revert error (' + field + '):', e.message);
        return false;
    }
}

async function handleGpsafeSettingsUpdate(sock, update) {
    try {
        const jid = update.id || update.jid;
        if (!jid || !jid.endsWith('@g.us')) return;

        const mode = getMode(jid);
        if (mode === 'off') return;

        const fresh = await sock.groupMetadata(jid);
        const prev = getSnapshot(jid);

        if (!prev) {
            saveSnapshot(jid, fresh);
            return;
        }

        const changes = [];
        for (const field of Object.keys(FIELD_LABELS)) {
            const oldVal = prev[field];
            const newVal = field === 'subject' ? fresh.subject
                : field === 'desc' ? (fresh.desc || '')
                : field === 'announce' ? !!fresh.announce
                : field === 'restrict' ? !!fresh.restrict
                : field === 'memberAddMode' ? fresh.memberAddMode
                : field === 'joinApprovalMode' ? fresh.joinApprovalMode
                : (fresh.inviteCode || null);

            if (newVal !== oldVal) {
                changes.push({ field, oldVal, newVal });
            }
        }

        if (!changes.length) return;

        if (!sock.user || !sock.user.id) return;
        const botJid = sock.user.id;
        const isBotAdmin = await isGroupAdmin(sock, jid, botJid);

        const rawAuthor = extractAuthor(update);
        let authorTag = 'Unknown (WhatsApp did not report who made this change)';
        let realAuthorJid = null;

        if (rawAuthor) {
            const p = fresh.participants.find(x =>
                x.id === rawAuthor || x.lid === rawAuthor || x.jid === rawAuthor || x.phoneNumber === rawAuthor
            );
            realAuthorJid = (p && (p.phoneNumber || p.jid || p.pn)) || rawAuthor;
            authorTag = '@' + normalizeJidNumber(realAuthorJid);
        }

        const botParticipant = fresh.participants.find(x =>
            x.id === botJid || x.lid === botJid || x.jid === botJid || x.phoneNumber === botJid
        );
        const realBotJid = (botParticipant && (botParticipant.phoneNumber || botParticipant.jid || botParticipant.pn)) || botJid;

        const allParticipantJids = fresh.participants.map(p => p.id);
        const hidetagMentions = Array.from(new Set([realAuthorJid, ...allParticipantJids].filter(Boolean)));

        const changeLines = [];
        for (const change of changes) {
            const label = FIELD_LABELS[change.field];
            changeLines.push('• ' + label.title + ' — ' + label.desc);
            if (isBotAdmin) {
                await revertField(sock, jid, change.field, change.oldVal);
            }
        }

        let punishmentLine = 'No action taken.';
        if (realAuthorJid && mode !== 'off') {
            const authorNumber = normalizeJidNumber(realAuthorJid);
            const botNumber = normalizeJidNumber(realBotJid);
            const skipPunishment = authorNumber === botNumber || isOwner(realAuthorJid) || isPremium(realAuthorJid);

            if (!skipPunishment && isBotAdmin) {
                if (mode === 'dismiss') {
                    await sock.groupParticipantsUpdate(jid, [realAuthorJid], 'demote');
                    punishmentLine = authorTag + ' has been demoted from admin.';
                } else if (mode === 'remove') {
                    await sock.groupParticipantsUpdate(jid, [realAuthorJid], 'remove');
                    punishmentLine = authorTag + ' has been removed from the group.';
                }
            } else if (skipPunishment) {
                punishmentLine = 'No action taken (authorized).';
            }
        }

        const now = new Date();
        const dateStr = now.toLocaleDateString('en-GB');
        const timeStr = now.toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' });

        const caption = box('GPSAFESETTINGS - GROUP SETTINGS CHANGED',
            '🏷️ Group: ' + (fresh.subject || 'Unknown')
            + '\n👮 Changed by: ' + authorTag
            + '\n\n' + changeLines.join('\n')
            + (isBotAdmin ? '\n\n♻️ Changes reverted where possible.' : '')
            + '\n🔒 Action: ' + punishmentLine
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

        const updatedMetadata = await sock.groupMetadata(jid);
        saveSnapshot(jid, updatedMetadata);
    } catch (e) {
        console.log('GPSAFESETTINGS error:', e.message);
    }
}

const GPSAFESETTINGS_COMMANDS = ['gpsafesettings'];

async function handleGpsafeSettingsCommand(sock, jid, msg, command, params, sender, senderIsOwner) {
    switch (command) {
        case 'gpsafesettings': {
            if (!jid.endsWith('@g.us')) {
                await reply(sock, jid, msg, box('GPSAFESETTINGS', 'This command only works inside groups.'));
                break;
            }
            const senderIsAdmin = await isGroupAdmin(sock, jid, sender);
            if (!senderIsOwner && !senderIsAdmin) {
                await reply(sock, jid, msg, box('ACCESS DENIED', 'Only a group admin or bot owner can use this command.'));
                break;
            }
            const mode = (params[0] || '').toLowerCase();
            if (mode === 'off') {
                setMode(jid, 'off');
                await reply(sock, jid, msg, box('GPSAFESETTINGS', 'Gpsafesettings is now OFF for this group.'));
            } else if (mode === 'dismiss') {
                setMode(jid, 'dismiss');
                try {
                    const metadata = await sock.groupMetadata(jid);
                    saveSnapshot(jid, metadata);
                } catch (e) {}
                await reply(sock, jid, msg, box('GPSAFESETTINGS', 'Gpsafesettings DISMISS mode is now ON.\n\nAny unauthorized group name, description, or permission-setting change will be alerted, reverted (when possible), and the responsible admin will be demoted.'));
            } else if (mode === 'remove') {
                setMode(jid, 'remove');
                try {
                    const metadata = await sock.groupMetadata(jid);
                    saveSnapshot(jid, metadata);
                } catch (e) {}
                await reply(sock, jid, msg, box('GPSAFESETTINGS', 'Gpsafesettings REMOVE mode is now ON.\n\nAny unauthorized group name, description, or permission-setting change will be alerted, reverted (when possible), and the responsible admin will be removed from the group.'));
            } else {
                await reply(sock, jid, msg, box('GPSAFESETTINGS', 'Usage: gpsafesettings off\nUsage: gpsafesettings dismiss\nUsage: gpsafesettings remove'));
            }
            break;
        }
    }
}

module.exports = {
    handleGpsafeSettingsCommand,
    handleGpsafeSettingsUpdate,
    GPSAFESETTINGS_COMMANDS
};

require('fs').watchFile(require.resolve(__filename), { interval: 500 }, () => {
  require('fs').unwatchFile(require.resolve(__filename));
  delete require.cache[require.resolve(__filename)];
  require(__filename);
});
