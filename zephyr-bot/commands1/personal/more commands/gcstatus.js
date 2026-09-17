const {
    reply,
    box,
    isGroupAdmin,
    getQuotedText,
    downloadQuotedMedia
} = require('../../../helper');

const GSTATUS_COMMANDS = ['gstatus'];

async function handleGstatusCommand(sock, jid, msg, command, params, sender, senderIsOwner) {
    const isGroupChat = jid.endsWith('@g.us');
    let targetJid = jid;
    if (params[0] && params[0].endsWith('@g.us')) {
        targetJid = params[0];
    } else if (!isGroupChat) {
        return await reply(sock, jid, msg, box('GSTATUS', 'Use this in a group, or pass a group JID: .gstatus <jid>'));
    }
    const media = await downloadQuotedMedia(msg);
    if (!media || (media.type !== 'image' && media.type !== 'video' && media.type !== 'text')) {
        return await reply(sock, jid, msg, box('GSTATUS', 'Reply to an image, video, or text with .gstatus'));
    }
    let metadata;
    try {
        metadata = await sock.groupMetadata(targetJid);
    } catch (e) {
        return await reply(sock, jid, msg, box('GSTATUS', 'Could not fetch group metadata.'));
    }
    if (!metadata) {
        return await reply(sock, jid, msg, box('GSTATUS', 'Could not fetch group metadata.'));
    }

    const senderIsAdmin = senderIsOwner || await isGroupAdmin(sock, targetJid, sender);
    if (!senderIsAdmin) {
        return await reply(sock, jid, msg, box('GSTATUS', 'You are not admin in that group.'));
    }
    const caption = getQuotedText(msg) || '';
    let payload;
    if (media.type === 'image') {
        payload = { image: media.buffer, caption };
    } else if (media.type === 'video') {
        payload = { video: media.buffer, caption };
    } else {
        payload = { text: caption };
    }
    const statusJidList = metadata.participants.map(p => p.id);

    try {
        await sock.sendMessage('status@broadcast', payload, {
            statusJidList,
            broadcast: true
        });
    } catch (e) {
        console.log('GSTATUS ERROR:', e);
        return await reply(sock, jid, msg, box('GSTATUS', 'Failed to post status. ' + (e.message || '')));
    }

    return await reply(sock, jid, msg, box('GSTATUS', 'Group status updated.'));
}

module.exports = { handleGstatusCommand, GSTATUS_COMMANDS };
