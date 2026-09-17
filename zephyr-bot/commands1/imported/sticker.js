const { downloadContentFromMessage } = require('@whiskeysockets/baileys');
const ffmpeg = require('fluent-ffmpeg');
const fs = require('fs');
const path = require('path');

async function stickerCommand(sock, remoteJid, m) {
    try {
        const messageType = Object.keys(m.message)[0];
        if (messageType !== 'imageMessage' && messageType !== 'videoMessage' && !m.message.extendedTextMessage?.contextInfo?.quotedMessage) {
            return sock.sendMessage(remoteJid, { text: '❌ Please reply to an image or video with .sticker' }, { quoted: m });
        }

        const quota = m.message.extendedTextMessage?.contextInfo?.quotedMessage;
        const target = quota ? quota.imageMessage || quota.videoMessage : m.message.imageMessage || m.message.videoMessage;
        
        if (!target) return sock.sendMessage(remoteJid, { text: '❌ No image or video found.' }, { quoted: m });

        const stream = await downloadContentFromMessage(target, messageType === 'imageMessage' || quota?.imageMessage ? 'image' : 'video');
        let buffer = Buffer.from([]);
        for await (const chunk of stream) {
            buffer = Buffer.concat([buffer, chunk]);
        }

        const inputPath = path.join(__dirname, `../temp_${Date.now()}.webp`);
        fs.writeFileSync(inputPath, buffer);

        await sock.sendMessage(remoteJid, { sticker: fs.readFileSync(inputPath) }, { quoted: m });
        fs.unlinkSync(inputPath);

    } catch (err) {
        console.error(err);
        await sock.sendMessage(remoteJid, { text: '❌ Failed to create sticker.' });
    }
}
module.exports = stickerCommand;
