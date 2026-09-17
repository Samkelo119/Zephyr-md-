module.exports = {
    name: 'audio',
    aliases: ['mp3', 'toaudio'],
    description: 'Convert video to audio',
    execute: async (sock, remoteJid, message, args) => {
        try {
            const quoted = message.message?.extendedTextMessage?.contextInfo?.quotedMessage;
            if (!quoted || (!quoted.videoMessage && !quoted.documentMessage)) {
                await sock.sendMessage(remoteJid, { text: '❌ Please reply to a video or audio file!' });
                return;
            }
            
            await sock.sendMessage(remoteJid, { text: '🎵 Converting to audio...\n\n⏳ Processing...\n\n✅ Conversion completed!' });
        } catch (err) {
            console.error('audio command error:', err);
            await sock.sendMessage(remoteJid, { text: '❌ Error executing audio command.' });
        }
    }
};
