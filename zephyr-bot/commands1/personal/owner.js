const fs   = require('fs');
const path = require('path');

const FOOTER = '\n\n> ᴘᴏᴡᴇʀᴇᴅ ʙʏ ZᴇPʜʏʀ~Mᴅ';

module.exports = {
    name: 'owner',
    aliases: ['creator', 'developer', 'dev', 'admin'],
    description: 'Show owner / developer information',
    execute: async (sock, remoteJid, message) => {
        try {
            const ownerNumber = '27621834910';
            const ownerName   = 'MʀDɪᴇHᴀʀᴅ TᴇᴄʜX';

            const text = [
                `╔══〔 👑 ᴏᴡɴᴇʀ ɪɴꜰᴏ 〕══╗`,
                `║    𝑴𝑹𝑫𝑰𝑬𝑯𝑨𝑹𝑫 𝑻𝑬𝑪𝑯    ║`,
                `╚═══════════════════════╝`,
                ``,
                `✦  *ɴᴀᴍᴇ*        ➜  MʀDɪᴇHᴀʀᴅ TᴇᴄʜX`,
                `✦  *ɴᴜᴍʙᴇʀ*      ➜  +${ownerNumber}`,
                `✦  *ᴡʜᴀᴛꜱᴀᴘᴘ*   ➜  wa.me/${ownerNumber}`,
                `✦  *ɢɪᴛʜᴜʙ*      ➜  CᴏMɪɴɢ/Sᴏᴏɴ`,
                `✦  *ꜱᴛᴀᴛᴜꜱ*      ➜  🟢 ᴏɴʟɪɴᴇ & ᴀᴄᴛɪᴠᴇ`,
                `✦  *ʀᴏʟᴇ*        ➜  Dᴇᴠ & Oᴡɴᴇʀ`,
                ``,
                `〘 ᴄᴏɴᴛᴀᴄᴛ ᴍᴇ ꜰᴏʀ ꜱᴜᴘᴘᴏʀᴛ & ꜰᴇᴀᴛᴜʀᴇꜱ 〙`,
            ].join('\n') + FOOTER;

            const ownerImg = path.join(__dirname, '../../assets/owner_image.jpg');
            const ownerPng = path.join(__dirname, '../../assets/owner_image.png');
            const menuImg  = path.join(__dirname, '../../assets/menu_image.jpg');
            const imgPath  = fs.existsSync(ownerImg) ? ownerImg
                : fs.existsSync(ownerPng) ? ownerPng
                : fs.existsSync(menuImg) ? menuImg : null;

            const vcard =
                'BEGIN:VCARD\nVERSION:3.0\n' +
                `FN:${ownerName}\n` +
                'ORG:MʀDɪᴇHᴀʀᴅ TᴇᴄʜX;\n' +
                `TEL;type=CELL;type=VOICE;waid=${ownerNumber}:+${ownerNumber}\n` +
                'END:VCARD';

            if (imgPath) {
                let sent = false;
                for (let attempt = 0; attempt < 2 && !sent; attempt++) {
                    try {
                        await sock.sendMessage(remoteJid, {
                            image: fs.readFileSync(imgPath), caption: text
                        }, { quoted: message });
                        sent = true;
                    } catch (uploadError) {
                        if (attempt === 1) console.error('Owner image upload failed:', uploadError.message);
                        else await new Promise(resolve => setTimeout(resolve, 800));
                    }
                }
                if (!sent) await sock.sendMessage(remoteJid, { text }, { quoted: message });
            } else {
                await sock.sendMessage(remoteJid, { text }, { quoted: message });
            }

            await sock.sendMessage(remoteJid, {
                contacts: { displayName: ownerName, contacts: [{ vcard }] }
            });

        } catch (err) {
            console.error('Owner error:', err);
            await sock.sendMessage(remoteJid, { text: '❌ Error executing owner command.' });
        }
    }
};
