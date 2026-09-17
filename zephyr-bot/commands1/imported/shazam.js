module.exports = {
    name: 'shazam',
    aliases: ['recognize', 'music'],
    description: 'Recognize a song',
    execute: async (sock, remoteJid, message, args) => {
        try {
            const quoted = message.message?.extendedTextMessage?.contextInfo?.quotedMessage;
            if (!quoted || !quoted.audioMessage) {
                await sock.sendMessage(remoteJid, { text: '❌ Please reply to an audio file!' });
                return;
            }
            
            await sock.sendMessage(remoteJid, { text: '🎵 Recognizing song...\n\n⏳ Processing...\n\n✅ Song: [Song Name]\n🎤 Artist: [Artist Name]\n💿 Album: [Album Name]' });
        } catch (err) {
            console.error('shazam command error:', err);
            await sock.sendMessage(remoteJid, { text: '❌ Error executing shazam command.' });
        }
    }
};
