const fs   = require('fs');
const path = require('path');

const FOOTER = '\n\n> ᴘᴏᴡᴇʀᴇᴅ ʙʏ ZᴇPʜʏʀ~Mᴅ';

module.exports = {
    name: 'alive',
    aliases: ['status', 'bot', 'running'],
    description: 'Check bot status and runtime',
    execute: async (sock, remoteJid, message) => {
        try {
            const uptime = process.uptime();
            const d = Math.floor(uptime / 86400);
            const h = Math.floor((uptime % 86400) / 3600);
            const m = Math.floor((uptime % 3600) / 60);
            const s = Math.floor(uptime % 60);
            const runtime = [d?`${d}ᴅ`:'', h?`${h}ʜ`:'', m?`${m}ᴍ`:'', `${s}ꜱ`].filter(Boolean).join(' ');
            const ramMB = (process.memoryUsage().heapUsed / 1024 / 1024).toFixed(1);

            const text = [
                `╔══〔 𝐙𝐄𝐏𝐇𝐘𝐑-𝑴𝑫 〕══╗`,
                `║   Bᴏᴛ Sᴛᴀᴛᴜs Cʜᴇᴄᴋ   ║`,
                `╚═══════════════════════╝`,
                ``,
                `🟢  *ꜱᴛᴀᴛᴜꜱ*      ➜  ᴏɴʟɪɴᴇ`,
                `⏱️  *ʀᴜɴᴛɪᴍᴇ*     ➜  ${runtime}`,
                `💾  *ʀᴀᴍ ᴜꜱᴇᴅ*    ➜  ${ramMB} ᴍʙ`,
                `👑  *ᴅᴇᴠᴇʟᴏᴘᴇʀ*   ➜  MʀDɪᴇHᴀʀᴅ TᴇᴄʜZ`,
                `📞  *ᴡʜᴀᴛꜱᴀᴘᴘ*    ➜  +27621834910`,
                ``,
                `〘 Tʜᴇ Bᴏᴛ ɪs Rᴜɴɴɪɴɢ Sᴍᴏᴏᴛʜʟʏ ✨ 〙`,
            ].join('\n') + FOOTER;

            const ownerImg = path.join(__dirname, '../assets/owner_image.png');
            const menuImg  = path.join(__dirname, '../assets/skykiid.png');
            const imgPath  = fs.existsSync(ownerImg) ? ownerImg : fs.existsSync(menuImg) ? menuImg : null;

            if (imgPath) {
                await sock.sendMessage(remoteJid, { image: fs.readFileSync(imgPath), caption: text }, { quoted: message });
            } else {
                await sock.sendMessage(remoteJid, { text }, { quoted: message });
            }
        } catch (err) {
            console.error('Alive error:', err);
            await sock.sendMessage(remoteJid, { text: '❌ Error executing alive command.' });
        }
    }
};
