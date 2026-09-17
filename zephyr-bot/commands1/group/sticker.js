const { downloadContentFromMessage } = require("@whiskeysockets/baileys");
const ffmpeg = require("fluent-ffmpeg");
ffmpeg.setFfmpegPath("/usr/bin/ffmpeg");
const fs = require("fs");
const path = require("path");

async function stickerCommand(sock, remoteJid, message, args, context) {
    try {
        const messageType = Object.keys(message.message)[0];
        const quotedMessage = message.message?.extendedTextMessage?.contextInfo?.quotedMessage;

        if (messageType !== 'imageMessage' && messageType !== 'videoMessage' && !quotedMessage) {
            await sock.sendMessage(remoteJid, { text: '❌ Please reply to an image or video with .sticker' }, { quoted: message });
            return;
        }

        const target = quotedMessage ? (quotedMessage.imageMessage || quotedMessage.videoMessage) : (message.message.imageMessage || message.message.videoMessage);
        
        if (!target) {
            await sock.sendMessage(remoteJid, { text: '❌ No image or video found.' }, { quoted: message });
            return;
        }

        const stream = await downloadContentFromMessage(target, messageType === 'imageMessage' || quotedMessage?.imageMessage ? 'image' : 'video');
        let buffer = Buffer.from([]);
        for await (const chunk of stream) {
            buffer = Buffer.concat([buffer, chunk]);
        }

        const inputPath = path.join(__dirname, `../temp_${Date.now()}.webp`);
        fs.writeFileSync(inputPath, buffer);

        // Convert to webp sticker using ffmpeg
        const outputPath = path.join(__dirname, `../temp_sticker_${Date.now()}.webp`);
        await new Promise((resolve, reject) => {
            ffmpeg(inputPath)
                .on('error', (err) => {
                    console.error('FFmpeg error:', err);
                    reject(err);
                })
                .on('end', () => resolve(true))
                .addOutputOptions([
                    '-vcodec', 'libwebp',
                    '-vf', "scale='min(320,iw)':min'(320,ih)':force_original_aspect_ratio=decrease,fps=15, pad=320:320:-1:-1:color=white@0.0,split[a][b];[a]palettegen[p];[b][p]paletteuse"
                ])
                .toFormat('webp')
                .save(outputPath);
        });

        await sock.sendMessage(remoteJid, { sticker: fs.readFileSync(outputPath) }, { quoted: message });
        fs.unlinkSync(inputPath);
        fs.unlinkSync(outputPath);

    } catch (err) {
        console.error('Error in sticker command:', err);
        await sock.sendMessage(remoteJid, { text: '❌ Failed to create sticker.' }, { quoted: message });
    }
}

module.exports = {
    name: 'sticker',
    aliases: ['s', 'stiker'],
    description: 'Converts an image or video to a sticker.',
    execute: async (sock, remoteJid, message, args, context) => {
        return stickerCommand(sock, remoteJid, message, args, context);
    },
};
