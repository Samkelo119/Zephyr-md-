module.exports = {
    name: 'hi',
    aliases: ['hello', 'hey'],
    description: 'Get a friendly greeting',
    execute: async (sock, remoteJid, message, args) => {
        try {
            const senderName = message.pushName || 'User';
            
            await sock.sendMessage(remoteJid, { 
                text: `👋 *ʜᴇʟʟᴏ ${senderName}!*\n\n` +
                      `I am 𝗦𝗨𝗦𝗨𝗞𝗜-𝗠𝗗, ᴄʀᴇᴀᴛᴇᴅ ʙʏ ᴍʀᴅɪᴇʜᴀʀᴅ ᴛᴇᴄʜX.\n` +
                      `ʜᴏᴡ ᴄᴀɴ ɪ ʜᴇʟᴘ ʏᴏᴜ ᴛᴏᴅᴀʏ‽\n\n` +
                      `ᴛʏᴘᴇ .menu ᴛᴏ sᴇᴇ ᴀʟʟ ᴏᴜʀ ᴄᴏᴍᴍᴀɴᴅs!` 
            });
        } catch (err) {
            console.error('Hi command error:', err);
            await sock.sendMessage(remoteJid, { text: '❌ Error executing hi command.' });
        }
    }
};
