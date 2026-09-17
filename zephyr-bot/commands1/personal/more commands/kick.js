const { reply, box, normalizeJidNumber, isGroupAdmin, resolveIdentityNumber } = require('../../../helper');

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

function resolveParticipant(metadata, identifier) {
    if (!identifier) return null;
    const num = normalizeJidNumber(identifier);
    return metadata.participants.find(p => {
        return normalizeJidNumber(p.id) === num
            || normalizeJidNumber(p.lid || '') === num
            || normalizeJidNumber(p.phoneNumber || p.jid || p.pn || '') === num;
    }) || null;
}

const KICK_COMMANDS = ['kick', 'kickall'];

async function handleKickCommand(sock, jid, msg, command, params, sender, senderIsOwner) {
    if (!jid.endsWith('@g.us')) {
        await reply(sock, jid, msg, box('KICK', 'This command only works inside groups.'));
        return;
    }

    const senderIsAdmin = await isGroupAdmin(sock, jid, sender);
    if (!senderIsOwner && !senderIsAdmin) {
        await reply(sock, jid, msg, box('ACCESS DENIED', 'Only a group admin or bot owner can use this command.'));
        return;
    }

    if (!sock.user || !sock.user.id) return;
    const botJid = sock.user.id;

    const isBotAdmin = await isGroupAdmin(sock, jid, botJid);
    if (!isBotAdmin) {
        await reply(sock, jid, msg, box('KICK', 'I need to be a group admin to remove anyone.'));
        return;
    }

    const metadata = await sock.groupMetadata(jid);
    const botParticipant = resolveParticipant(metadata, botJid);
    const botNumber = normalizeJidNumber((botParticipant && (botParticipant.phoneNumber || botParticipant.jid || botParticipant.pn)) || botJid);

    switch (command) {
        case 'kick': {
            const targetNumber = extractTargetNumber(msg, params);
            if (!targetNumber) {
                await reply(sock, jid, msg, box('KICK', 'Reply to, mention, or type the number of the member you want to remove.\n\nExamples:\nkick @user\nkick 923xxxxxxxxx\nkick +923xxxxxxxxx'));
                break;
            }

            if (targetNumber === botNumber) {
                await reply(sock, jid, msg, box('KICK', "I can't remove myself."));
                break;
            }
            if (global.ownerNumbers && global.ownerNumbers.includes(targetNumber)) {
                await reply(sock, jid, msg, box('KICK', 'This number is a protected owner and cannot be removed.'));
                break;
            }

            const target = resolveParticipant(metadata, targetNumber);
            if (!target) {
                await reply(sock, jid, msg, box('KICK', 'That number is not a member of this group.'));
                break;
            }
            if (target.admin === 'superadmin') {
                await reply(sock, jid, msg, box('KICK', "This member is the group's creator and can't be removed."));
                break;
            }

            try {
                await sock.groupParticipantsUpdate(jid, [target.id], 'remove');
                await reply(sock, jid, msg, box('KICK', '@' + targetNumber + ' has been removed from the group.'), { mentions: [target.id] });
            } catch (e) {
                await reply(sock, jid, msg, box('KICK', 'Failed to remove: ' + e.message));
            }
            break;
        }

        case 'kickall': {
            const targets = metadata.participants.filter(p => {
                if (p.admin === 'superadmin') return false;
                const num = normalizeJidNumber(p.phoneNumber || p.jid || p.pn || p.id);
                if (num === botNumber) return false;
                if (global.ownerNumbers && global.ownerNumbers.includes(num)) return false;
                return true;
            });

            if (!targets.length) {
                await reply(sock, jid, msg, box('KICKALL', 'No members left to remove (everyone else is protected).'));
                break;
            }

            try {
                await sock.groupParticipantsUpdate(jid, targets.map(p => p.id), 'remove');
                await reply(sock, jid, msg, box('KICKALL', 'Removed ' + targets.length + ' member(s) from the group.'));
            } catch (e) {
                await reply(sock, jid, msg, box('KICKALL', 'Failed to remove all members: ' + e.message));
            }
            break;
        }
    }
}

module.exports = {
    handleKickCommand,
    KICK_COMMANDS
};

require('fs').watchFile(require.resolve(__filename), { interval: 500 }, () => {
  require('fs').unwatchFile(require.resolve(__filename));
  delete require.cache[require.resolve(__filename)];
  require(__filename);
});
