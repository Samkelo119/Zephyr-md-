const { downloadMediaMessage } = require('@whiskeysockets/baileys');
const sharp = require('sharp');
const jsQR = require('jsqr');

module.exports = {
  name: 'readqr',
  category: 'Utility',
  aliases: ['decodeqr'],
  adminOnly: false,
  groupOnly: false,
  description: 'Decode a QR code from an image. Reply to an image with .readqr',
  async run({ sock, msg, jid }) {
    const quoted = msg.message?.extendedTextMessage?.contextInfo?.quotedMessage;
    const target = quoted
      ? { message: quoted, key: { ...msg.key, id: msg.message.extendedTextMessage.contextInfo.stanzaId } }
      : msg;

    if (!target.message?.imageMessage) {
      await sock.sendMessage(jid, { text: 'Reply to an image containing a QR code with .readqr' }, { quoted: msg });
      return;
    }

    try {
      const buffer = await downloadMediaMessage(target, 'buffer', {});
      const { data, info } = await sharp(buffer).ensureAlpha().raw().toBuffer({ resolveWithObject: true });
      const code = jsQR(new Uint8ClampedArray(data), info.width, info.height);
      if (!code) throw new Error('No QR code found in that image.');
      await sock.sendMessage(jid, { text: `📱 *Decoded:*\n${code.data}` }, { quoted: msg });
    } catch (err) {
      await sock.sendMessage(jid, { text: `❌ ${err.message}` }, { quoted: msg });
    }
  },
};
