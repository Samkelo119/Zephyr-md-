module.exports = {
    name: 'time',
    aliases: ['t'],
    description: 'Get current date and time',
    execute: async (sock, remoteJid, message, args) => {
        try {
            const now = new Date();
            const timeText = `🕐 *Current Time:*\n\n` +
                            `📅 *Date:* ${now.toLocaleDateString()}\n` +
                            `🕰️ *Time:* ${now.toLocaleTimeString()}\n` +
                            `🌍 *Timezone:* ${Intl.DateTimeFormat().resolvedOptions().timeZone}`;
            
            await sock.sendMessage(remoteJid, { text: timeText });
        } catch (err) {
            console.error('Time command error:', err);
            await sock.sendMessage(remoteJid, { text: '❌ Error executing time command.' });
        }
    }
};
