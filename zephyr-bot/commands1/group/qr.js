const QRCode = require('qrcode');

module.exports = {
  name: 'qr',
  category: 'Utility',
  aliases: ['qrcode'],
  adminOnly: false,
  groupOnly: false,
  description: 'Generate a QR code from text. Usage: qr <text or link>',
  async run({ sock, msg, jid, args }) {
    const text = args.join(' ').trim();
    if (!text) return sock.sendMessage(jid, { text: 'Usage: .qr <text or link>' }, { quoted: msg });
    try {
      const buffer = await QRCode.toBuffer(text, { width: 512, margin: 1 });
      await sock.sendMessage(jid, { image: buffer, caption: '📱 QR code' }, { quoted: msg });
    } catch (err) {
      await sock.sendMessage(jid, { text: `❌ Couldn't generate QR code: ${err.message}` }, { quoted: msg });
    }
  },
};
