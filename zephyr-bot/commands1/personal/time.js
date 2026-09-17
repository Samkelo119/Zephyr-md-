'use strict';

const FOOTER = '\n\n> ᴘᴏᴡᴇʀᴇᴅ ʙʏ ZᴇPʜʏʀ~Mᴅ';
const TZ     = 'Africa/Johannesburg';   // SAST — UTC+2, no DST

module.exports = {
    name       : 'time',
    aliases    : ['t', 'date', 'clock'],
    description: 'Show current South African date and time (SAST)',
    execute    : async (sock, remoteJid, message) => {
        try {
            const now = new Date();

            const fmt = (opts) =>
                now.toLocaleString('en-ZA', { timeZone: TZ, ...opts });

            const dayName  = fmt({ weekday : 'long'  });
            const dateStr  = fmt({ day: '2-digit', month: 'long', year: 'numeric' });
            const timeStr  = fmt({ hour: '2-digit', minute: '2-digit', second: '2-digit', hour12: false });
            const monthNum = now.toLocaleString('en-ZA', { timeZone: TZ, month: '2-digit' });

            // Season in Southern Hemisphere
            const month = parseInt(monthNum, 10);
            const season =
                month >= 12 || month <= 2 ? '☀️ ꜱᴜᴍᴍᴇʀ' :
                month >= 3  && month <= 5 ? '🍂 ᴀᴜᴛᴜᴍɴ' :
                month >= 6  && month <= 8 ? '❄️ ᴡɪɴᴛᴇʀ' :
                                            '🌸 ꜱᴘʀɪɴɢ';

            const text = [
                `╔══〔 🕐 ꜱᴀ ᴛɪᴍᴇ 〕══╗`,
                `║  ZᴇPʜʏʀ~Mᴅ  Cʟᴏᴄᴋ  ║`,
                `╚══════════════════════╝`,
                ``,
                `📅  *ᴅᴀᴛᴇ*      ➜  ${dateStr}`,
                `📆  *ᴅᴀʏ*       ➜  ${dayName}`,
                `🕐  *ᴛɪᴍᴇ*      ➜  ${timeStr}`,
                `🌍  *ᴢᴏɴᴇ*      ➜  SAST (UTC+2)`,
                `🌡️  *ꜱᴇᴀꜱᴏɴ*   ➜  ${season}`,
                ``,
                `〘 SᴏᴜᴛʜAғʀɪᴄᴀ 🇿🇦 〙`,
            ].join('\n') + FOOTER;

            await sock.sendMessage(remoteJid, { text }, { quoted: message });
        } catch (err) {
            console.error('Time command error:', err);
            await sock.sendMessage(remoteJid, { text: '❌ Error fetching time.' });
        }
    }
};
