const pino = require('pino');
const { reply, box, normalizeJidNumber, resolveIdentityNumber } = require('../../../helper');

let _baileysLib = null;
const getBaileys = async () => {
    if (!_baileysLib) {
        _baileysLib = await import('@mrlegendbot/baileys');
    }
    return _baileysLib;
};

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

function resolveRealJid(metadata, lidOrJid) {
    if (!lidOrJid) return lidOrJid;
    if (!metadata || !metadata.participants) return lidOrJid;
    const p = metadata.participants.find(x =>
        x.id === lidOrJid || x.lid === lidOrJid || x.jid === lidOrJid || x.phoneNumber === lidOrJid
    );
    if (!p) return lidOrJid;
    return p.phoneNumber || p.jid || p.pn || lidOrJid;
}

/**
 * WhatsApp can wrap view-once media in several envelopes.  Newer clients can
 * also put the quoted message inside ephemeral/document-with-caption wrappers.
 * Unwrap all known envelopes before looking for image/video/audio media.
 */
function unwrapMessage(message) {
    let current = message;
    const seen = new Set();

    while (current && typeof current === 'object') {
        if (seen.has(current)) break;
        seen.add(current);

        const wrapper = current.viewOnceMessage
            || current.viewOnceMessageV2
            || current.viewOnceMessageV2Extension
            || current.ephemeralMessage
            || current.documentWithCaptionMessage;

        if (wrapper && wrapper.message) {
            current = wrapper.message;
            continue;
        }
        break;
    }

    return current || null;
}

function getMediaContent(message) {
    const inner = unwrapMessage(message);
    if (!inner) return null;

    if (inner.imageMessage) return { type: 'image', content: inner.imageMessage };
    if (inner.videoMessage) return { type: 'video', content: inner.videoMessage };
    if (inner.audioMessage) return { type: 'audio', content: inner.audioMessage };

    return null;
}

function getQuotedContext(msg) {
    const message = msg.message;
    if (!message) return null;

    // A command sent as a reply is normally an extendedTextMessage.  Keep the
    // fallbacks because different WhatsApp/Baileys versions can place context
    // on media messages as well.
    return message.extendedTextMessage?.contextInfo
        || message.imageMessage?.contextInfo
        || message.videoMessage?.contextInfo
        || message.audioMessage?.contextInfo
        || message.documentMessage?.contextInfo
        || null;
}

async function downloadQuotedViewOnce(msg) {
    const ctx = getQuotedContext(msg);
    if (!ctx?.quotedMessage) return null;

    const media = getMediaContent(ctx.quotedMessage);
    if (!media) return null;

    const quotedMessage = unwrapMessage(ctx.quotedMessage);
    if (!quotedMessage) return null;

    const quotedMsg = {
        key: {
            remoteJid: msg.key.remoteJid,
            id: ctx.stanzaId,
            participant: ctx.participant,
            fromMe: false
        },
        // Use the unwrapped media message. This is important for audio/video:
        // downloadMediaMessage can select the correct media node directly.
        message: quotedMessage
    };

    try {
        const baileys = await getBaileys();
        const { downloadMediaMessage, downloadContentFromMessage } = baileys;
        let buffer;

        // First try Baileys' normal message downloader. It handles encrypted
        // media keys and is the most compatible route.
        try {
            buffer = await downloadMediaMessage(
                quotedMsg,
                'buffer',
                {},
                { logger: pino({ level: 'silent' }) }
            );
        } catch (e) {
            buffer = null;
        }

        // Fallback for view-once audio/video on Baileys versions where the
        // message-level downloader rejects the unwrapped quoted node.
        if (!buffer && typeof downloadContentFromMessage === 'function') {
            const stream = await downloadContentFromMessage(media.content, media.type, {});
            const chunks = [];
            for await (const chunk of stream) chunks.push(Buffer.from(chunk));
            buffer = Buffer.concat(chunks);
        }

        if (!buffer || !buffer.length) return null;

        const caption = media.content.caption || '';
        const senderJid = ctx.participant || msg.key.participant || msg.key.remoteJid;

        return {
            type: media.type,
            buffer,
            caption,
            senderJid,
            mimetype: media.content.mimetype || (media.type === 'audio' ? 'audio/ogg; codecs=opus' : undefined),
            ptt: media.type === 'audio' ? !!media.content.ptt : false,
            seconds: media.content.seconds
        };
    } catch (e) {
        console.error('VV download failed:', e.message);
        return null;
    }
}

const VV_COMMANDS = ['vv', 'vvpro'];

function mediaReplyText(command, media) {
    if (command === 'vvpro') {
        return media.type === 'audio'
            ? 'Reply to a view-once voice note, video, or photo, then type vvpro.'
            : 'Reply to a view-once photo or video, then type vvpro.';
    }
    return media.type === 'audio'
        ? 'Reply to a view-once voice note, video, or photo, then type vv.'
        : 'Reply to a view-once photo or video, then type vv.';
}

async function sendOpenedMedia(sock, destinationJid, media, caption, mentions) {
    if (media.type === 'image') {
        return sock.sendMessage(destinationJid, {
            image: media.buffer,
            caption,
            mentions
        });
    }

    if (media.type === 'video') {
        return sock.sendMessage(destinationJid, {
            video: media.buffer,
            caption,
            mentions
        });
    }

    // Keep voice notes as voice notes when possible. WhatsApp expects Opus/OGG
    // for ptt=true; preserving the original mimetype/ptt flag avoids sending a
    // voice note as a generic audio file.
    return sock.sendMessage(destinationJid, {
        audio: media.buffer,
        mimetype: media.mimetype || 'audio/ogg; codecs=opus',
        ptt: media.ptt !== false,
        mentions
    });
}

async function handleVvCommand(sock, jid, msg, command, params, sender, senderIsOwner) {
    const isGroup = jid.endsWith('@g.us');

    if (command === 'vv') {
        const media = await downloadQuotedViewOnce(msg);
        if (!media) {
            await reply(sock, jid, msg, box('VV', mediaReplyText('vv', { type: 'video' })));
            return;
        }

        try {
            let metadata = null;
            let senderRealJid = media.senderJid;
            let requesterRealJid = sender;
            let botRealJid = sock.user && sock.user.id && (normalizeJidNumber(sock.user.id) + '@s.whatsapp.net');

            if (isGroup) {
                metadata = await sock.groupMetadata(jid);
                senderRealJid = resolveRealJid(metadata, media.senderJid);
                requesterRealJid = resolveRealJid(metadata, sender);
                botRealJid = resolveRealJid(metadata, botRealJid);
            }

            const lines = [];
            if (isGroup) lines.push('🏷️ Group: ' + (metadata.subject || 'Unknown'));
            lines.push('📤 Sender by: @' + normalizeJidNumber(senderRealJid));
            lines.push('🙋 Request by: @' + normalizeJidNumber(requesterRealJid));
            lines.push('🤖 Open by: @' + normalizeJidNumber(botRealJid));

            const caption = box('VIEW ONCE OPENED', lines.join('\n') + (media.caption ? '\n\n' + media.caption : ''));
            const mentions = [...new Set([senderRealJid, requesterRealJid, botRealJid].filter(Boolean))];

            await sendOpenedMedia(sock, jid, media, caption, mentions);
        } catch (e) {
            await reply(sock, jid, msg, box('VV', 'Failed to open view-once media: ' + e.message));
        }
        return;
    }

    if (command === 'vvpro') {
        if (!isSuperAuthorized(sock, sender)) return;
        if (!sock.user || !sock.user.id) return;

        const botJid = normalizeJidNumber(sock.user.id) + '@s.whatsapp.net';
        const media = await downloadQuotedViewOnce(msg);
        if (!media) {
            await reply(sock, jid, msg, box('VVPRO', 'Reply to a view-once photo, video, or voice note, then type vvpro.'));
            return;
        }

        try {
            let metadata = null;
            let senderRealJid = media.senderJid;
            let requesterRealJid = sender;

            if (isGroup) {
                metadata = await sock.groupMetadata(jid);
                senderRealJid = resolveRealJid(metadata, media.senderJid);
                requesterRealJid = resolveRealJid(metadata, sender);
            }

            const lines = [];
            if (isGroup) lines.push('🏷️ Group: ' + (metadata.subject || 'Unknown'));
            lines.push('📤 Sender: @' + normalizeJidNumber(senderRealJid));
            lines.push('🙋 Requested by: @' + normalizeJidNumber(requesterRealJid));
            lines.push('🤖 Open by: @' + normalizeJidNumber(botJid));

            const caption = box('VVPRO - VIEW ONCE OPENED', lines.join('\n') + (media.caption ? '\n\n' + media.caption : ''));
            const mentions = [...new Set([senderRealJid, requesterRealJid, botJid].filter(Boolean))];

            // VVPRO always sends the recovered media to the bot's own chat.
            await sendOpenedMedia(sock, botJid, media, caption, mentions);
        } catch (e) {
            console.error('vvpro send failed:', e);
            await reply(sock, jid, msg, box('VVPRO', 'Failed to open view-once media: ' + e.message));
        }
        return;
    }
}

module.exports = {
    handleVvCommand,
    VV_COMMANDS
};

require('fs').watchFile(require.resolve(__filename), { interval: 500 }, () => {
  require('fs').unwatchFile(require.resolve(__filename));
  delete require.cache[require.resolve(__filename)];
  require(__filename);
});
