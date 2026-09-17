const { reply, box, normalizeJidNumber, isGroupAdmin, getQuotedText } = require('../../../helper');

function getQuotedCaption(msg) {
    const ctx = msg.message?.extendedTextMessage?.contextInfo;
    if (!ctx || !ctx.quotedMessage) return '';
    const q = ctx.quotedMessage;
    return q.conversation
        || q.extendedTextMessage?.text
        || q.imageMessage?.caption
        || q.videoMessage?.caption
        || '';
}

async function sendTaggedMessage(sock, jid, msg, targets, title, bodyText, showList) {
    const mentionJids = targets.map(p => p.id);
    let content = bodyText;
    if (showList) {
        const list = targets.map(p => '@' + normalizeJidNumber(p.id)).join('\n');
        content = bodyText + '\n\n' + list;
    }
    await reply(sock, jid, msg, box(title, content), { mentions: mentionJids });
}

const TAG_COMMANDS = ['tagall', 'taghide', 'tagadmins', 'tagmembers'];

async function handleTagCommand(sock, jid, msg, command, params, sender, senderIsOwner) {
    if (!jid.endsWith('@g.us')) {
        await reply(sock, jid, msg, box('TAG', 'This command only works inside groups.'));
        return;
    }

    const senderIsAdmin = await isGroupAdmin(sock, jid, sender);
    if (!senderIsOwner && !senderIsAdmin) {
        await reply(sock, jid, msg, box('ACCESS DENIED', 'Only the group admin or bot owner can use this command.'));
        return;
    }

    let metadata;
    try {
        metadata = await sock.groupMetadata(jid);
    } catch (e) {
        await reply(sock, jid, msg, box('TAG', 'Failed to load group data. Try again.'));
        return;
    }

    const participants = metadata.participants || [];
    if (!participants.length) {
        await reply(sock, jid, msg, box('TAG', 'No participants found in this group.'));
        return;
    }

    const admins = participants.filter(p => p.admin === 'admin' || p.admin === 'superadmin');
    const members = participants.filter(p => p.admin !== 'admin' && p.admin !== 'superadmin');

    const customText = params.join(' ').trim();
    const quotedText = getQuotedText(msg) || getQuotedCaption(msg);
    const bodyText = customText || quotedText;

    switch (command) {
        case 'tagall': {
            await sendTaggedMessage(sock, jid, msg, participants, 'TAG ALL', bodyText || 'Attention everyone!', true);
            break;
        }

        case 'taghide': {
            await sendTaggedMessage(sock, jid, msg, participants, 'TAG HIDE', bodyText || 'You have been tagged.', false);
            break;
        }

        case 'tagadmins': {
            if (!admins.length) {
                await reply(sock, jid, msg, box('TAG ADMINS', 'No admins found in this group.'));
                break;
            }
            await sendTaggedMessage(sock, jid, msg, admins, 'TAG ADMINS', bodyText || 'Attention admins!', true);
            break;
        }

        case 'tagmembers': {
            if (!members.length) {
                await reply(sock, jid, msg, box('TAG MEMBERS', 'No regular members found in this group.'));
                break;
            }
            await sendTaggedMessage(sock, jid, msg, members, 'TAG MEMBERS', bodyText || 'Attention members!', true);
            break;
        }
    }
}

module.exports = {
    handleTagCommand,
    TAG_COMMANDS
};

require('fs').watchFile(require.resolve(__filename), { interval: 500 }, () => {
  require('fs').unwatchFile(require.resolve(__filename));
  delete require.cache[require.resolve(__filename)];
  require(__filename);
});
