module.exports = {
    name: 'inspect',
    aliases: ['fileinfo', 'metadata'],
    description: 'Inspects basic metadata of a replied media file',
    execute: async (sock, jid, msg, args) => {
        try {
            // Check if the user replied to a message
            const quotedMessage = msg.message?.extendedTextMessage?.contextInfo?.quotedMessage;
            
            if (!quotedMessage) {
                return await sock.sendMessage(jid, { 
                    text: '❌ Please reply to a media file (document, audio, image, or video) to inspect its properties.' 
                }, { quoted: msg });
            }

            // Determine the type of media message inside the quoted content
            const mediaType = Object.keys(quotedMessage)[0];
            const mediaData = quotedMessage[mediaType];

            // Verify if the quoted message contains standard file data
            if (!mediaData || typeof mediaData !== 'object') {
                return await sock.sendMessage(jid, { text: '❌ No valid media format detected in the replied message.' }, { quoted: msg });
            }

            // Extract available metadata properties safely
            const mimeType = mediaData.mimetype || 'Unknown';
            const fileName = mediaData.fileName || 'Unnamed File';
            const fileSize = mediaData.fileLength 
                ? `${(parseInt(mediaData.fileLength) / (1024 * 1024)).toFixed(2)} MB` 
                : 'Unknown';
            const sha256 = mediaData.fileSha256 
                ? Buffer.from(mediaData.fileSha256).toString('hex') 
                : 'N/A';

            // Format the inspection report
            const infoText = `📊 *File Metadata Report* 📊\n\n` +
                             `📁 *Type:* ${mediaType.replace('Message', '')}\n` +
                             `📝 *Name:* ${fileName}\n` +
                             `🌐 *MIME Type:* ${mimeType}\n` +
                             `⚖️ *Size:* ${fileSize}\n` +
                             `🔑 *SHA256 Hash:* \`${sha256}\``;

            await sock.sendMessage(jid, { text: infoText }, { quoted: msg });

        } catch (err) {
            console.error('Inspection command error:', err);
            await sock.sendMessage(jid, { text: '❌ Error reading file properties.' }, { quoted: msg });
        }
    }
};
