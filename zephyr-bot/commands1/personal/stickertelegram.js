'use strict';

/**
 * Telegram sticker pack downloader — sends each sticker as a WhatsApp sticker.
 * Uses only node-fetch and node-webpmux (no sharp dependency).
 */

const fetch = (...a) => import('node-fetch').then(m => m.default(...a));
const webp  = require('node-webpmux');
const fs    = require('fs');
const path  = require('path');

const FOOTER   = '\n\n> ᴘᴏᴡᴇʀᴇᴅ ʙʏ ZᴇPʜʏʀ~Mᴅ';
// Token read from env; fall back to the default value so the command still
// works out-of-the-box.  Set TELEGRAM_BOT_TOKEN in Replit Secrets to override.
const BOT_TOKEN = process.env.TELEGRAM_BOT_TOKEN || '7801479976:AAGuPL0a7kXXBYz6XUSR_ll2SR5V_W6oHl4';
const delay     = ms => new Promise(r => setTimeout(r, ms));
const TMP_DIR   = path.join(__dirname, '../tmp');

if (!fs.existsSync(TMP_DIR)) fs.mkdirSync(TMP_DIR, { recursive: true });

async function addStickerExif(buffer, packName = 'ZᴇPʜʏʀ~Mᴅ') {
    try {
        const img      = new webp.Image();
        await img.load(buffer);
        const meta     = { 'sticker-pack-name': packName, 'sticker-pack-publisher': 'MʀDɪᴇHᴀʀᴅ TᴇᴄʜX' };
        const jsonBuf  = Buffer.from(JSON.stringify(meta), 'utf8');
        const exifAttr = Buffer.from([
            0x49,0x49,0x2A,0x00,0x08,0x00,0x00,0x00,0x01,0x00,
            0x41,0x57,0x07,0x00,0x00,0x00,0x00,0x00,0x16,0x00,0x00,0x00,
        ]);
        const exif = Buffer.concat([exifAttr, jsonBuf]);
        exif.writeUIntLE(jsonBuf.length, 14, 4);
        img.exif = exif;
        return await img.save(null);
    } catch (_) { return buffer; }
}

module.exports = {
    name       : 'stickertelegram',
    aliases    : ['tgsticker', 'tgs', 'tg'],
    description: 'Download a Telegram sticker pack and send as WhatsApp stickers',
    execute    : async (sock, remoteJid, message, args) => {
        const url = args[0] || '';
        if (!url.includes('t.me/addstickers/')) {
            return sock.sendMessage(remoteJid, {
                text: [
                    `╔══〔 🎭 𝗧𝗲𝗹𝗲𝗴𝗿𝗮𝗺 𝗦𝘁𝗶𝗰𝗸𝗲𝗿𝘀 〕══╗`,
                    ``,
                    `❓  *ᴜꜱᴀɢᴇ:*  .tg <ᴘᴀᴄᴋ ᴜʀʟ>`,
                    `📌  *ᴇxᴀᴍᴘʟᴇ:* .tg https://t.me/addstickers/Animals`,
                ].join('\n') + FOOTER,
            }, { quoted: message });
        }

        const packName = url.replace(/.*\/addstickers\//i, '').trim();
        await sock.sendMessage(remoteJid, { react: { text: '⏳', key: message.key } });

        try {
            const setRes  = await fetch(`https://api.telegram.org/bot${BOT_TOKEN}/getStickerSet?name=${encodeURIComponent(packName)}`);
            const setData = await setRes.json();
            if (!setData.ok) throw new Error('Pack not found or is private');

            const stickers = setData.result.stickers.slice(0, 20);  // max 20
            await sock.sendMessage(remoteJid, {
                text: `📦 *${setData.result.title}*\n⏳ ꜱᴇɴᴅɪɴɢ *${stickers.length}* ꜱᴛɪᴄᴋᴇʀꜱ…` + FOOTER,
            }, { quoted: message });

            let ok = 0;
            for (const sticker of stickers) {
                try {
                    const fi   = await (await fetch(`https://api.telegram.org/bot${BOT_TOKEN}/getFile?file_id=${sticker.file_id}`)).json();
                    if (!fi.ok) continue;
                    const buf  = Buffer.from(await (await fetch(`https://api.telegram.org/file/bot${BOT_TOKEN}/${fi.result.file_path}`)).arrayBuffer());
                    const wbuf = await addStickerExif(buf, setData.result.title);
                    await sock.sendMessage(remoteJid, { sticker: wbuf });
                    ok++;
                    await delay(800);
                } catch (_) { /* skip failed sticker */ }
            }

            await sock.sendMessage(remoteJid, {
                text: `✅ ꜱᴇɴᴛ *${ok}/${stickers.length}* ꜱᴛɪᴄᴋᴇʀꜱ ꜰʀᴏᴍ *${setData.result.title}*!` + FOOTER,
            }, { quoted: message });
            await sock.sendMessage(remoteJid, { react: { text: '✅', key: message.key } });

        } catch (err) {
            await sock.sendMessage(remoteJid, { react: { text: '❌', key: message.key } });
            await sock.sendMessage(remoteJid, {
                text: `❌ *ᴄᴏᴜʟᴅɴ'ᴛ ꜰᴇᴛᴄʜ ᴘᴀᴄᴋ*\n\n_${err.message}_` + FOOTER,
            }, { quoted: message });
        }
    },
};
