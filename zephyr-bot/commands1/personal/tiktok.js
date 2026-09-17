'use strict';

const FOOTER = '\n\n> ᴘᴏᴡᴇʀᴇᴅ ʙʏ ZᴇPʜʏʀ~Mᴅ';

function extractTikTokUrl(text) {
    const match = text.match(/https?:\/\/(?:www\.|vm\.|vt\.)?tiktok\.com\/[^\s]+/i);
    return match ? match[0] : null;
}

module.exports = {
    name       : 'tiktok',
    aliases    : ['tt', 'tik', 'ttdl'],
    description: 'Download a TikTok video without watermark',
    execute    : async (sock, remoteJid, message, args) => {
        const text  = args.join(' ').trim() ||
                      message.message?.extendedTextMessage?.contextInfo?.quotedMessage?.conversation || '';
        const ttUrl = extractTikTokUrl(text);

        if (!ttUrl) {
            return sock.sendMessage(remoteJid, {
                text: [
                    `╔══〔 🎵 𝗧𝗶𝗸𝗧𝗼𝗸 𝗗𝗟 〕══╗`,
                    ``,
                    `❓  *ᴜꜱᴀɢᴇ:* .tiktok <ᴜʀʟ>`,
                    `📌  *ᴇxᴀᴍᴘʟᴇ:* .tiktok https://vm.tiktok.com/xxx`,
                ].join('\n') + FOOTER,
            }, { quoted: message });
        }

        await sock.sendMessage(remoteJid, { react: { text: '⏳', key: message.key } });

        try {
            const fetch = (...a) => import('node-fetch').then(m => m.default(...a));

            // tikwm.com — free, no auth required
            const apiRes  = await fetch(`https://www.tikwm.com/api/?url=${encodeURIComponent(ttUrl)}&hd=1`);
            const apiData = await apiRes.json();

            if (!apiData?.data) throw new Error('Could not fetch video');

            const { title, play: videoUrl, wmplay: wmUrl, author } = apiData.data;
            const downloadUrl = videoUrl || wmUrl;
            if (!downloadUrl) throw new Error('No video link returned');

            // Download buffer
            const vidRes = await fetch(downloadUrl);
            const buffer = Buffer.from(await vidRes.arrayBuffer());

            const caption = [
                `╔══〔 🎵 𝗧𝗶𝗸𝗧𝗼𝗸 𝗩𝗶𝗱𝗲𝗼 〕══╗`,
                ``,
                `📝  *${title || 'TikTok Video'}*`,
                author?.nickname ? `👤  *@${author.nickname}*` : '',
                ``,
                `✅  𝗡𝗼 𝗪𝗮𝘁𝗲𝗿𝗺𝗮𝗿𝗸`,
            ].filter(Boolean).join('\n') + FOOTER;

            await sock.sendMessage(remoteJid, {
                video  : buffer,
                caption,
                mimetype: 'video/mp4',
            }, { quoted: message });

            await sock.sendMessage(remoteJid, { react: { text: '✅', key: message.key } });

        } catch (err) {
            console.error('[TIKTOK]', err.message);
            await sock.sendMessage(remoteJid, { react: { text: '❌', key: message.key } });
            await sock.sendMessage(remoteJid, {
                text: `❌ *ᴄᴏᴜʟᴅɴ'ᴛ ᴅᴏᴡɴʟᴏᴀᴅ ᴠɪᴅᴇᴏ*\n\n_${err.message}_\n\n_ᴍᴀᴋᴇ ꜱᴜʀᴇ ᴛʜᴇ ʟɪɴᴋ ɪꜱ ᴠᴀʟɪᴅ ᴀɴᴅ ᴘᴜʙʟɪᴄ._` + FOOTER,
            }, { quoted: message });
        }
    },
};
