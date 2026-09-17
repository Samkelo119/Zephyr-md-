module.exports = {
    name: 'tagall',
    aliases: ['tag', 'mentionall'],
    description: 'Tag all members in group',
    execute: async (sock, remoteJid, message, args) => {
        try {
            const isGroup = remoteJid.endsWith('@g.us');
            if (!isGroup) {
                await sock.sendMessage(remoteJid, { text: '❌ This command only works in groups!' });
                return;
            }
            
            const groupMetadata = await sock.groupMetadata(remoteJid);
            const members = groupMetadata.participants;
            let mentions = [];
            let text = '📢  *ZᴇPʜʏʀ~Mᴅ ʜᴀs ᴛᴀɢɢᴇᴅ ᴇᴠᴇʀʏᴏɴᴇ* :\n\n';
            
            members.forEach(member => {
                mentions.push(member.id);
                text += `@${member.id.split('@')[0]}\n`;
            });
            
            await sock.sendMessage(remoteJid, { text: text, mentions: mentions });
        } catch (err) {
            console.error('tagall command error:', err);
            await sock.sendMessage(remoteJid, { text: '❌ Error executing tagall command.' });
        }
    }
};
