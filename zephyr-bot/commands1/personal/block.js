'use strict';

const FOOTER = '\n\n> ᴘᴏᴡᴇʀᴇᴅ ʙʏ ZᴇPʜʏʀ~Mᴅ';

module.exports = {
    name       : 'block',
    aliases    : ['bl'],
    description: 'Block a contact (owner only)',
    execute    : async (sock, remoteJid, message, args, context) => {
        if (!context.isOwner) {
            return sock.sendMessage(remoteJid, { text: '❌ Only the owner can use this command!' }, { quoted: message });
        }

        // Resolve target JID — mention or quoted reply
        let target =
            message.message?.extendedTextMessage?.contextInfo?.mentionedJid?.[0] ||
            message.message?.extendedTextMessage?.contextInfo?.participant ||
            null;

        if (!target && args[0]) {
            const num = args[0].replace(/[^0-9]/g, '');
            if (num.length >= 7) target = num + '@s.whatsapp.net';
        }

        if (!target) {
            return sock.sendMessage(remoteJid, {
                text: `❓ Usage: .block @mention\n\nOr reply to a message with .block` + FOOTER
            }, { quoted: message });
        }

        try {
            await sock.updateBlockStatus(target, 'block');
            await sock.sendMessage(remoteJid, {
                text: `🚫 Blocked @${target.split('@')[0]}`,
                mentions: [target]
            }, { quoted: message });
        } catch (err) {
            await sock.sendMessage(remoteJid, {
                text: `❌ Failed to block: ${err.message}` + FOOTER
            }, { quoted: message });
        }
    }
};
