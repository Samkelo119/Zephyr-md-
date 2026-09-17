module.exports = {
    name: 'stream',
    aliases: ['mstream'],
    description: 'Get MRDIEHARD STREAM link',
    execute: async (sock, remoteJid, message, args, context) => {
        try {
            const responseText = "*ғᴏʟʟᴏᴡ ᴍʀᴅɪᴇʜᴀʀᴅ sᴛʀᴇᴀᴍɪɴɢ ᴀᴘᴋ ᴜᴘᴅᴀᴛᴇs*\n\n🔗 Link: https://whatsapp.com/channel/0029Vb785Ak4CrfmYSGIvY1b";
            
            if (context && typeof context.sendResponse === 'function') {
                await context.sendResponse(sock, remoteJid, responseText, message);
            } else {
                // Fallback
                await sock.sendMessage(remoteJid, { text: responseText + "\n\n> Powered by MRDIEHARD TechX" }, { quoted: message });
            }
        } catch (err) {
            console.error('Stream command error:', err);
        }
    }
};
