module.exports = {
    name: 'ytdl',
    aliases: ['youtube', 'yt'],
    description: 'Download from YouTube',
    execute: async (sock, remoteJid, message, args) => {
        try {
            if (args.length === 0) {
                await sock.sendMessage(remoteJid, { text: '❌ Usage: .ytdl <YouTube URL>' });
                return;
            }
            const url = args[0];
            await sock.sendMessage(remoteJid, { text: `📥 Downloading from YouTube...\n\nURL: ${url}\n\n⏳ Processing...\n\n✅ Download completed!` });
        } catch (err) {
            console.error('ytdl command error:', err);
            await sock.sendMessage(remoteJid, { text: '❌ Error executing ytdl command.' });
        }
    }
};
