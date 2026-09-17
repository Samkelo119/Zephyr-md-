module.exports = {
    name: 'runtime',
    aliases: ['uptime', 'up'],
    description: 'Get bot runtime',
    execute: async (sock, remoteJid, message, args) => {
        try {
            const uptime = process.uptime();
            const hours = Math.floor(uptime / 3600);
            const minutes = Math.floor((uptime % 3600) / 60);
            const seconds = Math.floor(uptime % 60);
            
            await sock.sendMessage(remoteJid, { 
                text: `⏳ sᴋʏʙʟᴜᴇ-ᴍᴅ ʀᴜɴᴛɪᴍᴇ:*\n\n` +
                      `🕐 *Uptime:* ${hours}h ${minutes}m ${seconds}s` 
            });
        } catch (err) {
            console.error('Runtime command error:', err);
            await sock.sendMessage(remoteJid, { text: '❌ Error executing runtime command.' });
        }
    }
};
