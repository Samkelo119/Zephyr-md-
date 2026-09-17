const fs = require('fs');
const path = require('path');

module.exports = {
    name: 'alive',
    aliases: ['status'],
    description: 'Check bot status and runtime',
    execute: async (sock, remoteJid, message, args) => {
        try {
            const uptime = process.uptime();
            const hours = Math.floor(uptime / 3600);
            const minutes = Math.floor((uptime % 3600) / 60);
            const seconds = Math.floor(uptime % 60);
            const runtimeStr = `${hours}h ${minutes}m ${seconds}s`;

            const aliveText = `🤖𝙎𝙐𝙎𝙐𝙆𝙄-𝙈𝘿 𝙎𝙏𝘼𝙏𝙐𝙎\n\n` +
                              `➤STATUS:𝙾𝙽𝙻𝙸𝙽𝙴🟢\n` +
                              `➤RUNTIME: ${runtimeStr}\n` +
                              `➤DEVELOPER:𝙼𝚁𝙳𝙸𝙴𝙷𝙰𝚁𝙳 𝚃𝙴𝙲𝙷♚\n` +
                              `➤WHATSAPP:wa.me/27792334178✆\n\n` +
                              `𝙏𝙃𝙀 𝘽𝙊𝙏 𝙄𝙎 𝙍𝙐𝙉𝙉𝙄𝙉𝙂 𝙎𝙈𝙊𝙊𝙏𝙃`;

            const ownerImagePath = path.join(__dirname, '../assets/owner_image.png');
            if (fs.existsSync(ownerImagePath)) {
                const imageBuffer = fs.readFileSync(ownerImagePath);
                await sock.sendMessage(remoteJid, { 
                    image: imageBuffer, 
                    caption: aliveText + "\n\n> Powered by MRDIEHARD TechX" 
                }, { quoted: message });
            } else {
                await sock.sendMessage(remoteJid, { text: aliveText + "\n\n> Powered by MRDIEHARD TechX" }, { quoted: message });
            }
        } catch (err) {
            console.error('Alive command error:', err);
            await sock.sendMessage(remoteJid, { text: '❌ Error executing alive command.' });
        }
    }
};
