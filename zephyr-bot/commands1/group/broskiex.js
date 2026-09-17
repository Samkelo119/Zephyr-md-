module.exports = {
    name: 'broskiex',
    aliases: ['tbroskie'],
    description: 'Get *ʙʀᴏsᴋɪᴇx ᴛᴏᴏʟs link',
    execute: async (sock, remoteJid, message, args, context) => {
        try {
            const responseText = "*ғᴏʟʟᴏᴡ ʙʀᴏsᴋɪᴇx ᴛᴏᴏʟs ᴄʜᴀɴɴᴇʟ*\n\n🔗 Link: https://whatsapp.com/channel/0029VbDhR7jEKyZAVeNQnb1j";
            
            if (context && typeof context.sendResponse === 'function') {
                await context.sendResponse(sock, remoteJid, responseText, message);
            } else {
                // Fallback
                await sock.sendMessage(remoteJid, { text: responseText + "\n\n> *ᴘᴏᴡᴇʀᴇᴅ ʙʏ ᴍʀᴅɪᴇʜᴀʀᴅ ᴛᴇᴄʜX" }, { quoted: message });
            }
        } catch (err) {
            console.error('broskiex command error:', err);
        }
    }
};
