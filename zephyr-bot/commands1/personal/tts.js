const gTTS = require('gtts');
const fs = require('fs');
const path = require('path');

async function ttsCommand(sock, chatId, text, message, language = 'en') {
    if (!text) {
        await sock.sendMessage(chatId, { text: 'Please provide the text for TTS conversion.' });
        return;
    }

    const fileName = `tts-${Date.now()}.mp3`;
    const filePath = path.join(__dirname, '..', 'assets', fileName);

    const gtts = new gTTS(text, language);
    gtts.save(filePath, async function (err) {
        if (err) {
            await sock.sendMessage(chatId, { text: 'Error generating TTS audio.' });
            return;
        }

        await sock.sendMessage(chatId, {
            audio: { url: filePath },
            mimetype: 'audio/mpeg'
        }, { quoted: message });

        fs.unlinkSync(filePath);
    });
}

module.exports = {
    name: 'tts',
    aliases: ['texttospeech', 'speak'],
    description: 'Convert text to speech audio',
    execute: async (sock, remoteJid, message, args) => {
        const text = args.join(' ');
        const lang = args[0]?.length === 2 ? args.shift() : 'en';
        return ttsCommand(sock, remoteJid, text, message, lang);
    }
};
