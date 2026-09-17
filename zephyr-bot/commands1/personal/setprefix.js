'use strict';

const { setPrefix, getPrefix } = require('../lib/prefixManager');
const FOOTER = '\n\n> ᴘᴏᴡᴇʀᴇᴅ ʙʏ ZᴇPʜʏʀ~Mᴅ';

module.exports = {
    name       : 'setprefix',
    aliases    : ['changeprefix', 'prefix'],
    description: 'Change the bot command prefix (owner only)',
    execute    : async (sock, remoteJid, message, args, context) => {
        if (!context.isOwner) {
            return sock.sendMessage(remoteJid, { text: '❌ Only the owner can change the prefix!' }, { quoted: message });
        }

        const newPrefix = args[0];
        if (!newPrefix || newPrefix.length > 5) {
            return sock.sendMessage(remoteJid, {
                text: `❓ Usage: ${getPrefix()}setprefix <symbol>\n\nExample: ${getPrefix()}setprefix !\n\nCurrent prefix: *${getPrefix()}*` + FOOTER
            }, { quoted: message });
        }

        const old = getPrefix();
        setPrefix(newPrefix);

        await sock.sendMessage(remoteJid, {
            text: [
                `╔══〔 🔤 ᴘʀᴇꜰɪx ᴄʜᴀɴɢᴇᴅ 〕══╗`,
                ``,
                `Old prefix : *${old}*`,
                `New prefix : *${newPrefix}*`,
                ``,
                `Commands now start with *${newPrefix}*`,
                `Example: *${newPrefix}alive*`,
            ].join('\n') + FOOTER
        }, { quoted: message });
    }
};
