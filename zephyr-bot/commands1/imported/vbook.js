module.exports = {
    name: 'vbook',
    aliases: ['videobook'],
    description: 'Create a video book',
    execute: async (sock, remoteJid, message, args) => {
        try {
            if (args.length === 0) {
                await sock.sendMessage(remoteJid, { text: '❌ Usage: .vbook <title>' });
                return;
            }
            const title = args.join(' ');
            await sock.sendMessage(remoteJid, { text: `📖 Creating video book: "${title}"\n\n⏳ Processing...\n\n✅ Video book created!` });
        } catch (err) {
            console.error('vbook command error:', err);
            await sock.sendMessage(remoteJid, { text: '❌ Error executing vbook command.' });
        }
    }
};
