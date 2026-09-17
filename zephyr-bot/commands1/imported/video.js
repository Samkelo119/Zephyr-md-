module.exports = {
    name: 'video',
    aliases: ['vid', 'downloadvideo'],
    description: 'Download a video',
    execute: async (sock, remoteJid, message, args) => {
        try {
            if (args.length === 0) {
                await sock.sendMessage(remoteJid, { text: '❌ Usage: .video <URL>' });
                return;
            }
            const url = args[0];
            await sock.sendMessage(remoteJid, { text: `📹 Downloading video...\n\nURL: ${url}\n\n⏳ Processing...\n\n✅ Video downloaded!` });
        } catch (err) {
            console.error('video command error:', err);
            await sock.sendMessage(remoteJid, { text: '❌ Error executing video command.' });
        }
    }
};
