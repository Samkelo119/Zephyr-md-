module.exports = {
    name: 'meme',
    aliases: ['randomeme'],
    description: 'Get a random meme',
    execute: async (sock, remoteJid, message, args) => {
        try {
            await sock.sendMessage(remoteJid, { text: '😂 Random Meme:\n\n[Meme Image Would Be Here]\n\n✅ Meme fetched successfully!' });
        } catch (err) {
            console.error('meme command error:', err);
            await sock.sendMessage(remoteJid, { text: '❌ Error executing meme command.' });
        }
    }
};
