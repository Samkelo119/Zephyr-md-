const { downloadMediaMessage } = require('@whiskeysockets/baileys');
const sharp = require('sharp');

module.exports = {
  name: 'toimg',
  category: 'Stickers',
  aliases: [],
  adminOnly: false,
  groupOnly: false,
  description: 'Reply to a sticker with this to convert it back into an image.',
  async run({ sock, msg, jid }) {
    const quoted = msg.message?.extendedTextMessage?.contextInfo?.quotedMessage;
    const target = quoted
      ? { message: quoted, key: { ...msg.key, id: msg.message.extendedTextMessage.contextInfo.stanzaId } }
      : msg;

    if (!target.message?.stickerMessage) {
      await sock.sendMessage(jid, { text: 'Reply to a sticker with .toimg to convert it to an image.' }, { quoted: msg });
      return;
    }

    const buffer = await downloadMediaMessage(target, 'buffer', {});
    const png = await sharp(buffer).png().toBuffer();
    await sock.sendMessage(jid, { image: png }, { quoted: msg });
  },
};
