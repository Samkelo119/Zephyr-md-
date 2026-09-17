const path = require('path');
const { reply, box, normalizeJidNumber, downloadQuotedMedia } = require(path.join('../..', 'helper'));

async function getGroupMetadata(sock, jid) {
    try {
        return await sock.groupMetadata(jid);
    } catch (e) {
        return null;
    }
}

function participantNumber(p) {
    return normalizeJidNumber(p.id || p.jid || '');
}

function isAdminInGroup(metadata, jidOrNumber) {
    const number = normalizeJidNumber(jidOrNumber);
    if (!metadata || !metadata.participants) return false;
    return metadata.participants.some(participant => {
        if (!['admin', 'superadmin'].includes(participant?.admin)) return false;
        return [participant.id, participant.jid, participant.lid, participant.phoneNumber, participant.pn]
            .filter(Boolean)
            .some(identifier => String(identifier) === String(jidOrNumber) || normalizeJidNumber(identifier) === number);
    });
}

async function isBotGroupAdmin(sock, jid, metadata) {
    const botNumber = normalizeJidNumber(sock.user.id);
    return isAdminInGroup(metadata, botNumber);
}

function extractTargetJids(msg) {
    const ctx = msg.message?.extendedTextMessage?.contextInfo;
    const targets = [];
    if (ctx?.mentionedJid && ctx.mentionedJid.length) {
        targets.push(...ctx.mentionedJid);
    }
    if (ctx?.participant && !targets.includes(ctx.participant)) {
        targets.push(ctx.participant);
    }
    return targets;
}

function numberToJid(number) {
    const clean = String(number).replace(/[^0-9]/g, '');
    return clean + '@s.whatsapp.net';
}

function resolveTargets(msg, params) {
    const targets = new Set(extractTargetJids(msg));
    for (const p of params) {
        const digits = p.replace(/[^0-9]/g, '');
        if (digits.length >= 8) {
            targets.add(numberToJid(digits));
        }
    }
    return Array.from(targets);
}

function isGroupJid(jid) {
    return typeof jid === 'string' && jid.endsWith('@g.us');
}

async function requireGroupAdmin(sock, jid, msg, sender, senderIsOwner) {
    const metadata = await getGroupMetadata(sock, jid);
    if (!metadata) {
        await reply(sock, jid, msg, box('GROUP COMMAND', 'This command only works inside a group.'));
        return null;
    }
    const senderIsGroupAdmin = isAdminInGroup(metadata, sender);
    if (!senderIsGroupAdmin && !senderIsOwner) {
        await reply(sock, jid, msg, box('PERMISSION DENIED', 'Only group admins or the bot owner can use this command.'));
        return null;
    }
    const botIsAdmin = await isBotGroupAdmin(sock, jid, metadata);
    if (!botIsAdmin) {
        await reply(sock, jid, msg, box('PERMISSION DENIED', 'The bot must be an admin in this group to use this command.'));
        return null;
    }
    return metadata;
}

async function handleDelete(sock, jid, msg) {
    const ctx = msg.message?.extendedTextMessage?.contextInfo;
    if (!ctx || !ctx.stanzaId) {
        await reply(sock, jid, msg, box('DELETE', 'Reply to the message you want to delete with .del'));
        return;
    }
    const botNumber = normalizeJidNumber(sock.user.id);
    const authorNumber = normalizeJidNumber(ctx.participant || '');
    const isOwnMessage = authorNumber === botNumber;
    try {
        await sock.sendMessage(jid, {
            delete: {
                remoteJid: jid,
                fromMe: isOwnMessage,
                id: ctx.stanzaId,
                participant: isGroupJid(jid) ? ctx.participant : undefined
            }
        });
    } catch (e) {
        await reply(sock, jid, msg, box('DELETE', 'Could not delete this message. Make sure the bot is an admin, or that this is a message the bot sent itself.'));
    }
}

async function handleTagAll(sock, jid, msg, params, hidden) {
    const metadata = await getGroupMetadata(sock, jid);
    if (!metadata) {
        await reply(sock, jid, msg, box('TAGALL', 'This command only works inside a group.'));
        return;
    }
    const note = params.join(' ');
    const mentions = metadata.participants.map(p => p.id);
    let text = `╭━━━━━━━━━━━━━━━━━━━━\n┃ TAG ALL (${metadata.participants.length})\n┃━━━━━━━━━━━━━━━━━━━━\n`;
    if (note) text += `┃ ${note}\n┃━━━━━━━━━━━━━━━━━━━━\n`;
    if (!hidden) {
        for (const p of metadata.participants) {
            text += `┃ › @${participantNumber(p)}\n`;
        }
        text += '╰━━━━━━━━━━━━━━━━━━━━';
    } else {
        text += `┃ Everyone has been tagged silently.\n╰━━━━━━━━━━━━━━━━━━━━`;
    }
    await reply(sock, jid, msg, { text, mentions });
}

async function handleTagAdmins(sock, jid, msg, params) {
    const metadata = await getGroupMetadata(sock, jid);
    if (!metadata) {
        await reply(sock, jid, msg, box('TAGADMINS', 'This command only works inside a group.'));
        return;
    }
    const admins = metadata.participants.filter(p => p.admin === 'admin' || p.admin === 'superadmin');
    if (!admins.length) {
        await reply(sock, jid, msg, box('TAGADMINS', 'No admins found in this group.'));
        return;
    }
    const note = params.join(' ');
    let text = `╭━━━━━━━━━━━━━━━━━━━━\n┃ GROUP ADMINS (${admins.length})\n┃━━━━━━━━━━━━━━━━━━━━\n`;
    if (note) text += `┃ ${note}\n┃━━━━━━━━━━━━━━━━━━━━\n`;
    for (const p of admins) text += `┃ › @${participantNumber(p)}\n`;
    text += '╰━━━━━━━━━━━━━━━━━━━━';
    await reply(sock, jid, msg, { text, mentions: admins.map(p => p.id) });
}

async function handleTagMembers(sock, jid, msg, params) {
    const metadata = await getGroupMetadata(sock, jid);
    if (!metadata) {
        await reply(sock, jid, msg, box('TAGMEMBERS', 'This command only works inside a group.'));
        return;
    }
    const members = metadata.participants.filter(p => p.admin !== 'admin' && p.admin !== 'superadmin');
    if (!members.length) {
        await reply(sock, jid, msg, box('TAGMEMBERS', 'No regular members found in this group.'));
        return;
    }
    const note = params.join(' ');
    let text = `╭━━━━━━━━━━━━━━━━━━━━\n┃ GROUP MEMBERS (${members.length})\n┃━━━━━━━━━━━━━━━━━━━━\n`;
    if (note) text += `┃ ${note}\n┃━━━━━━━━━━━━━━━━━━━━\n`;
    for (const p of members) text += `┃ › @${participantNumber(p)}\n`;
    text += '╰━━━━━━━━━━━━━━━━━━━━';
    await reply(sock, jid, msg, { text, mentions: members.map(p => p.id) });
}

async function updateParticipants(sock, jid, msg, targetJids, action, label) {
    if (!targetJids.length) {
        await reply(sock, jid, msg, box(label.toUpperCase(), 'Reply to a user, mention them, or give their number.\nExample: .' + label + ' 923001234567'));
        return;
    }
    try {
        await sock.groupParticipantsUpdate(jid, targetJids, action);
        await reply(sock, jid, msg, box(label.toUpperCase(), 'Done for ' + targetJids.length + ' user(s).'));
    } catch (e) {
        await reply(sock, jid, msg, box(label.toUpperCase(), 'Action failed. Make sure the bot is an admin in this group.'));
    }
}

async function handleKick(sock, jid, msg, params) {
    const targets = resolveTargets(msg, params);
    await updateParticipants(sock, jid, msg, targets, 'remove', 'kick');
}

async function handlePromote(sock, jid, msg, params) {
    const targets = resolveTargets(msg, params);
    await updateParticipants(sock, jid, msg, targets, 'promote', 'promote');
}

async function handleDemote(sock, jid, msg, params) {
    const targets = resolveTargets(msg, params);
    await updateParticipants(sock, jid, msg, targets, 'demote', 'demote');
}

async function handleKickAll(sock, jid, msg, metadata) {
    const botNumber = normalizeJidNumber(sock.user.id);
    const targets = metadata.participants
        .filter(p => p.admin !== 'admin' && p.admin !== 'superadmin')
        .filter(p => participantNumber(p) !== botNumber)
        .map(p => p.id);
    if (!targets.length) {
        await reply(sock, jid, msg, box('KICKALL', 'No non-admin members to remove.'));
        return;
    }
    try {
        await sock.groupParticipantsUpdate(jid, targets, 'remove');
        await reply(sock, jid, msg, box('KICKALL', 'Removed ' + targets.length + ' member(s) from the group.'));
    } catch (e) {
        await reply(sock, jid, msg, box('KICKALL', 'Action failed. Make sure the bot is an admin in this group.'));
    }
}

async function handlePromoteAll(sock, jid, msg, metadata) {
    const targets = metadata.participants
        .filter(p => p.admin !== 'admin' && p.admin !== 'superadmin')
        .map(p => p.id);
    if (!targets.length) {
        await reply(sock, jid, msg, box('PROMOTEALL', 'Everyone is already an admin.'));
        return;
    }
    try {
        await sock.groupParticipantsUpdate(jid, targets, 'promote');
        await reply(sock, jid, msg, box('PROMOTEALL', 'Promoted ' + targets.length + ' member(s) to admin.'));
    } catch (e) {
        await reply(sock, jid, msg, box('PROMOTEALL', 'Action failed. Make sure the bot is an admin in this group.'));
    }
}

async function handleDemoteAll(sock, jid, msg, metadata) {
    const botNumber = normalizeJidNumber(sock.user.id);
    const targets = metadata.participants
        .filter(p => p.admin === 'admin' || p.admin === 'superadmin')
        .filter(p => participantNumber(p) !== botNumber)
        .map(p => p.id);
    if (!targets.length) {
        await reply(sock, jid, msg, box('DEMOTEALL', 'No admins to demote.'));
        return;
    }
    try {
        await sock.groupParticipantsUpdate(jid, targets, 'demote');
        await reply(sock, jid, msg, box('DEMOTEALL', 'Demoted ' + targets.length + ' admin(s) to member.'));
    } catch (e) {
        await reply(sock, jid, msg, box('DEMOTEALL', 'Action failed. Make sure the bot is an admin in this group.'));
    }
}

async function handleGetName(sock, jid, msg) {
    const metadata = await getGroupMetadata(sock, jid);
    if (!metadata) {
        await reply(sock, jid, msg, box('GROUP NAME', 'This command only works inside a group.'));
        return;
    }
    await reply(sock, jid, msg, box('GROUP NAME', metadata.subject || '(no name set)'));
}

async function handleSetName(sock, jid, msg, params) {
    const newName = params.join(' ').trim();
    if (!newName) {
        await reply(sock, jid, msg, box('SET GROUP NAME', 'Provide a new name.\nExample: .gpsetname My Group'));
        return;
    }
    try {
        await sock.groupUpdateSubject(jid, newName);
        await reply(sock, jid, msg, box('SET GROUP NAME', 'Group name updated to: ' + newName));
    } catch (e) {
        await reply(sock, jid, msg, box('SET GROUP NAME', 'Failed to update. Make sure the bot is an admin in this group.'));
    }
}

async function handleGetDesc(sock, jid, msg) {
    const metadata = await getGroupMetadata(sock, jid);
    if (!metadata) {
        await reply(sock, jid, msg, box('GROUP DESCRIPTION', 'This command only works inside a group.'));
        return;
    }
    await reply(sock, jid, msg, box('GROUP DESCRIPTION', metadata.desc || '(no description set)'));
}

async function handleSetDesc(sock, jid, msg, params) {
    const newDesc = params.join(' ').trim();
    if (!newDesc) {
        await reply(sock, jid, msg, box('SET GROUP DESCRIPTION', 'Provide a new description.\nExample: .gpsetdesc Welcome to our group!'));
        return;
    }
    try {
        await sock.groupUpdateDescription(jid, newDesc);
        await reply(sock, jid, msg, box('SET GROUP DESCRIPTION', 'Group description updated.'));
    } catch (e) {
        await reply(sock, jid, msg, box('SET GROUP DESCRIPTION', 'Failed to update. Make sure the bot is an admin in this group.'));
    }
}

async function handleGetPic(sock, jid, msg) {
    try {
        const url = await sock.profilePictureUrl(jid, 'image');
        await reply(sock, jid, msg, { image: { url }, caption: box('GROUP PICTURE', 'Current group profile picture.') });
    } catch (e) {
        await reply(sock, jid, msg, box('GROUP PICTURE', 'This group has no profile picture set.'));
    }
}

async function handleSetPic(sock, jid, msg) {
    const media = await downloadQuotedMedia(msg);
    if (!media || media.type !== 'image' || !media.buffer) {
        await reply(sock, jid, msg, box('SET GROUP PICTURE', 'Reply to an image with .gpsetpic to set it as the group picture.'));
        return;
    }
    try {
        await sock.updateProfilePicture(jid, media.buffer);
        await reply(sock, jid, msg, box('SET GROUP PICTURE', 'Group picture updated successfully.'));
    } catch (e) {
        await reply(sock, jid, msg, box('SET GROUP PICTURE', 'Failed to update. Make sure the bot is an admin in this group.'));
    }
}

async function handleGCBasicCommand(sock, jid, msg, command, params, sender, senderIsOwner) {
    switch (command) {
        case 'del': {
            if (!isGroupJid(jid)) return true;
            await handleDelete(sock, jid, msg);
            return true;
        }
        case 'delall': {
            if (!isGroupJid(jid)) return true;
            const metadata = await requireGroupAdmin(sock, jid, msg, sender, senderIsOwner);
            if (!metadata) return true;
            await handleDelete(sock, jid, msg);
            return true;
        }
        case 'tagall': {
            if (!isGroupJid(jid)) return true;
            await handleTagAll(sock, jid, msg, params, false);
            return true;
        }
        case 'taghide': {
            if (!isGroupJid(jid)) return true;
            await handleTagAll(sock, jid, msg, params, true);
            return true;
        }
        case 'tagadmins': {
            if (!isGroupJid(jid)) return true;
            await handleTagAdmins(sock, jid, msg, params);
            return true;
        }
        case 'tagmembers': {
            if (!isGroupJid(jid)) return true;
            await handleTagMembers(sock, jid, msg, params);
            return true;
        }
        case 'kick': {
            if (!isGroupJid(jid)) return true;
            const metadata = await requireGroupAdmin(sock, jid, msg, sender, senderIsOwner);
            if (!metadata) return true;
            await handleKick(sock, jid, msg, params);
            return true;
        }
        case 'kickall': {
            if (!isGroupJid(jid)) return true;
            const metadata = await requireGroupAdmin(sock, jid, msg, sender, senderIsOwner);
            if (!metadata) return true;
            await handleKickAll(sock, jid, msg, metadata);
            return true;
        }
        case 'demote': {
            if (!isGroupJid(jid)) return true;
            const metadata = await requireGroupAdmin(sock, jid, msg, sender, senderIsOwner);
            if (!metadata) return true;
            await handleDemote(sock, jid, msg, params);
            return true;
        }
        case 'demoteall': {
            if (!isGroupJid(jid)) return true;
            const metadata = await requireGroupAdmin(sock, jid, msg, sender, senderIsOwner);
            if (!metadata) return true;
            await handleDemoteAll(sock, jid, msg, metadata);
            return true;
        }
        case 'promote': {
            if (!isGroupJid(jid)) return true;
            const metadata = await requireGroupAdmin(sock, jid, msg, sender, senderIsOwner);
            if (!metadata) return true;
            await handlePromote(sock, jid, msg, params);
            return true;
        }
        case 'promoteall': {
            if (!isGroupJid(jid)) return true;
            const metadata = await requireGroupAdmin(sock, jid, msg, sender, senderIsOwner);
            if (!metadata) return true;
            await handlePromoteAll(sock, jid, msg, metadata);
            return true;
        }
        case 'gpgetname': {
            if (!isGroupJid(jid)) return true;
            await handleGetName(sock, jid, msg);
            return true;
        }
        case 'gpsetname': {
            if (!isGroupJid(jid)) return true;
            const metadata = await requireGroupAdmin(sock, jid, msg, sender, senderIsOwner);
            if (!metadata) return true;
            await handleSetName(sock, jid, msg, params);
            return true;
        }
        case 'gpgetpic': {
            if (!isGroupJid(jid)) return true;
            await handleGetPic(sock, jid, msg);
            return true;
        }
        case 'gpsetpic': {
            if (!isGroupJid(jid)) return true;
            const metadata = await requireGroupAdmin(sock, jid, msg, sender, senderIsOwner);
            if (!metadata) return true;
            await handleSetPic(sock, jid, msg);
            return true;
        }
        case 'gpgetdesc': {
            if (!isGroupJid(jid)) return true;
            await handleGetDesc(sock, jid, msg);
            return true;
        }
        case 'gpsetdesc': {
            if (!isGroupJid(jid)) return true;
            const metadata = await requireGroupAdmin(sock, jid, msg, sender, senderIsOwner);
            if (!metadata) return true;
            await handleSetDesc(sock, jid, msg, params);
            return true;
        }
        default:
            return false;
    }
}

module.exports = { handleGCBasicCommand };

require('fs').watchFile(require.resolve(__filename), { interval: 500 }, () => {
    require('fs').unwatchFile(require.resolve(__filename));
    delete require.cache[require.resolve(__filename)];
    require(__filename);
});
