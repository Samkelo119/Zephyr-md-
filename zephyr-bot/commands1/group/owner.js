module.exports = {
    name: 'owner',
    aliases: ['creator', 'dev'],
    description: 'Show developer info',
    execute: async (sock, remoteJid, message, args) => {
        try {
            const ownerText = `╔═════ஜ𝗦𝗨𝗦𝗨𝗞𝗜-𝗠𝗗ஜ════╗

➤OWNER: *ᴍʀᴅɪᴇʜᴀʀᴅ ᴛᴇᴄʜX*
➤BOT NAME: *sᴜsᴜᴋɪ-ᴍᴅ*
➤STATUS: *ᴏɴʟɪɴᴇ🟢*
➤SYSTEM: *ᴀᴄᴛɪᴠᴇ⚡*
 ➤SERVER: *ʟɪɴᴜx👨‍💻*

╚═════ஜ𝘽𝙤𝙩 𝙞𝙨 𝘼𝙡𝙞𝙫𝙚ஜ═════╝`;
            
            const fs = require('fs');
            const path = require('path');
            const imagePath = path.join(__dirname, '../assets/owner_image.png');

            if (fs.existsSync(imagePath)) {
                const imageBuffer = fs.readFileSync(imagePath);
                await sock.sendMessage(remoteJid, { 
                    image: imageBuffer, 
                    caption: ownerText 
                }, { quoted: message });
            } else {
                await sock.sendMessage(remoteJid, { text: ownerText }, { quoted: message });
            }
        } catch (err) {
            console.error('Owner command error:', err);
            await sock.sendMessage(remoteJid, { text: '❌ Error executing owner command.' }, { quoted: message });
        }
    }
};