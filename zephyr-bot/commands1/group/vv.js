const { downloadContentFromMessage } = require('@whiskeysockets/baileys');

module.exports = {
    name: 'vv',
    aliases: ['viewonce', 'vo'],
    description: 'View disappearing media',
    execute: async (sock, remoteJid, message, args) => {
        try {
            const quoted = message.message?.extendedTextMessage?.contextInfo?.quotedMessage;
            const quotedImage = quoted?.imageMessage;
            const quotedVideo = quoted?.videoMessage;

            if (quotedImage && quotedImage.viewOnce) {
                const stream = await downloadContentFromMessage(quotedImage, 'image');
                let buffer = Buffer.from([]);
                for await (const chunk of stream) buffer = Buffer.concat([buffer, chunk]);
                await sock.sendMessage(remoteJid, { image: buffer, fileName: 'media.jpg', caption: quotedImage.caption || '' }, { quoted: message });
            } else if (quotedVideo && quotedVideo.viewOnce) {
                const stream = await downloadContentFromMessage(quotedVideo, 'video');
                let buffer = Buffer.from([]);
                for await (const chunk of stream) buffer = Buffer.concat([buffer, chunk]);
                await sock.sendMessage(remoteJid, { video: buffer, fileName: 'media.mp4', caption: quotedVideo.caption || '' }, { quoted: message });
            } else {
                await sock.sendMessage(remoteJid, { text: '❌ Please reply to a view-once image or video.' }, { quoted: message });
            }
        } catch (err) {
            console.error('vv command error:', err);
            await sock.sendMessage(remoteJid, { text: '❌ Error executing vv command.' });
        }
    }
};
