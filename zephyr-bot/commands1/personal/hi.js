module.exports = {
    name: 'hi',
    aliases: ['hello', 'hey'],
    description: 'Get a friendly greeting',
    execute: async (sock, remoteJid, message, args) => {
        try {
            const senderName = message.pushName || 'User';
            
            await sock.sendMessage(remoteJid, { 
                text: `👋 *ʜᴇʟʟᴏ ${senderName}!*\n\n` +
                      `I am ZᴇPʜʏʀ~Mᴅ, ᴄʀᴇᴀᴛᴇᴅ ʙʏ MʀDɪᴇHᴀʀᴅ TᴇᴄʜX.\n` +
                      `ʜᴏᴡ ᴄᴀɴ ɪ ʜᴇʟᴘ ʏᴏᴜ ᴛᴏᴅᴀʏ‽\n\n` +
                      `ᴛʏᴘᴇ .menu ᴛᴏ sᴇᴇ ᴀʟʟ ᴏᴜʀ ᴄᴏᴍᴍᴀɴᴅs!` 
            });
        } catch (err) {
            console.error('Hi command error:', err);
            await sock.sendMessage(remoteJid, { text: '❌ Error executing hi command.' });
        }
    }
};
