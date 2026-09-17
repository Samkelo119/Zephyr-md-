const { downloadMediaMessage } = require('@whiskeysockets/baileys');
const sharp = require('sharp');

function escapeXml(str) {
  return str.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}

module.exports = {
  name: 'smeme',
  category: 'Stickers',
  aliases: [],
  adminOnly: false,
  groupOnly: false,
  description: 'Add top/bottom meme text to an image or sticker. Usage: smeme top text | bottom text (reply to media)',
  async run({ sock, msg, jid, args }) {
    const quoted = msg.message?.extendedTextMessage?.contextInfo?.quotedMessage;
    const target = quoted
      ? { message: quoted, key: { ...msg.key, id: msg.message.extendedTextMessage.contextInfo.stanzaId } }
      : msg;

    const isImage = !!target.message?.imageMessage;
    const isSticker = !!target.message?.stickerMessage;
    if (!isImage && !isSticker) {
      await sock.sendMessage(jid, { text: 'Reply to an image or sticker with .smeme top text | bottom text' }, { quoted: msg });
      return;
    }

    const [top = '', bottom = ''] = args.join(' ').split('|').map((s) => s.trim());
    if (!top && !bottom) {
      await sock.sendMessage(jid, { text: 'Usage: .smeme top text | bottom text' }, { quoted: msg });
      return;
    }

    try {
      const buffer = await downloadMediaMessage(target, 'buffer', {});
      const base = sharp(buffer);
      const meta = await base.metadata();
      const w = meta.width || 512;
      const h = meta.height || 512;
      const fontSize = Math.round(w / 10);

      const svg = `
        <svg width="${w}" height="${h}">
          <style>
            .meme { fill: white; stroke: black; stroke-width: ${fontSize / 12}; font-size: ${fontSize}px; font-family: Impact, sans-serif; font-weight: bold; text-anchor: middle; }
          </style>
          ${top ? `<text x="${w / 2}" y="${fontSize * 1.1}" class="meme">${escapeXml(top.toUpperCase())}</text>` : ''}
          ${bottom ? `<text x="${w / 2}" y="${h - fontSize * 0.4}" class="meme">${escapeXml(bottom.toUpperCase())}</text>` : ''}
        </svg>`;

      const output = await sharp(buffer)
        .resize(w, h)
        .composite([{ input: Buffer.from(svg), top: 0, left: 0 }])
        .webp()
        .toBuffer();

      await sock.sendMessage(jid, { sticker: output }, { quoted: msg });
    } catch (err) {
      await sock.sendMessage(jid, { text: `❌ Couldn't create that: ${err.message}` }, { quoted: msg });
    }
  },
};
