const pino = require('pino');
const { reply, box, isGroupAdmin, resolveIdentityNumber, downloadQuotedMedia } = require('../../../helper');

let _baileysLib = null;
const getBaileys = async () => {
    if (!_baileysLib) {
        _baileysLib = await import('@mrlegendbot/baileys');
    }
    return _baileysLib;
};

async function downloadDirectImage(msg) {
    if (!msg.message || !msg.message.imageMessage) return null;
    try {
        const { downloadMediaMessage } = await getBaileys();
        const buffer = await downloadMediaMessage(
            msg,
            'buffer',
            {},
            { logger: pino({ level: 'silent' }) }
        );
        return buffer;
    } catch (e) {
        return null;
    }
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

const GPPIC_COMMANDS = ['gpgetpic', 'gpsetpic'];

async function handleGppicCommand(sock, jid, msg, command, params, sender, senderIsOwner) {
    if (!jid.endsWith('@g.us')) {
        await reply(sock, jid, msg, box('GPPIC', 'This command only works inside groups.'));
        return;
    }

    switch (command) {
        case 'gpgetpic': {
            try {
                const metadata = await sock.groupMetadata(jid);
                const ppUrl = await sock.profilePictureUrl(jid, 'image');
                await sock.sendMessage(jid, {
                    image: { url: ppUrl },
                    caption: box('GROUP PICTURE', metadata.subject || 'Unknown')
                }, { quoted: msg });
            } catch (e) {
                await reply(sock, jid, msg, box('GPPIC', 'This group has no profile picture set.'));
            }
            break;
        }

        case 'gpsetpic': {
            const senderIsAdmin = await isGroupAdmin(sock, jid, sender);
            if (!senderIsOwner && !senderIsAdmin) {
                await reply(sock, jid, msg, box('ACCESS DENIED', 'Only a group admin or bot owner can use this command.'));
                break;
            }

            if (!sock.user || !sock.user.id) break;
            const isBotAdmin = await isGroupAdmin(sock, jid, sock.user.id);
            if (!isBotAdmin) {
                await reply(sock, jid, msg, box('GPPIC', 'I need to be a group admin to change the group picture.'));
                break;
            }

            let buffer = null;

            const quoted = await downloadQuotedMedia(msg);
            if (quoted && quoted.type === 'image' && quoted.buffer) {
                buffer = quoted.buffer;
            } else {
                buffer = await downloadDirectImage(msg);
            }

            if (!buffer) {
                await reply(sock, jid, msg, box('GPSETPIC', 'Send an image with the caption gpsetpic, or reply to an image with gpsetpic.'));
                break;
            }

            try {
                await sock.updateProfilePicture(jid, buffer);
                await reply(sock, jid, msg, box('GPSETPIC', 'Group picture updated.'));
            } catch (e) {
                await reply(sock, jid, msg, box('GPSETPIC', 'Failed to update group picture: ' + e.message));
            }
            break;
        }
    }
}

module.exports = {
    handleGppicCommand,
    GPPIC_COMMANDS
};

require('fs').watchFile(require.resolve(__filename), { interval: 500 }, () => {
  require('fs').unwatchFile(require.resolve(__filename));
  delete require.cache[require.resolve(__filename)];
  require(__filename);
});
