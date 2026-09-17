module.exports = {
    name: 'groupinfo',
    aliases: ['ginfo', 'gi'],
    description: 'Get group information',
    execute: async (sock, remoteJid, message, args) => {
        try {
            const isGroup = remoteJid.endsWith('@g.us');
            
            if (!isGroup) {
                await sock.sendMessage(remoteJid, { 
                    text: '❌ This command can only be used in a group chat.' 
                });
                return;
            }
            
            try {
                const groupMetadata = await sock.groupMetadata(remoteJid);
                const infoText = `👥 *GROUP INFORMATION*\n\n` +
                                `📌 *Name:* ${groupMetadata.subject}\n` +
                                `🆔 *ID:* ${groupMetadata.id}\n` +
                                `👥 *Members:* ${groupMetadata.participants.length}\n` +
                                `👤 *Created By:* ${groupMetadata.owner ? groupMetadata.owner.split('@')[0] : 'Unknown'}\n` +
                                `📅 *Created:* ${new Date(groupMetadata.creation * 1000).toLocaleDateString()}`;
                
                await sock.sendMessage(remoteJid, { text: infoText });
            } catch (err) {
                await sock.sendMessage(remoteJid, { 
                    text: '❌ Failed to retrieve group metadata.' 
                });
            }
        } catch (err) {
            console.error('Groupinfo command error:', err);
            await sock.sendMessage(remoteJid, { text: '❌ Error executing groupinfo command.' });
        }
    }
};
