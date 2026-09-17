const { renderTextImage } = require('../lib/textImage');

module.exports = {
  name: 'royaltext',
  category: 'Logo',
  aliases: [],
  adminOnly: false,
  groupOnly: false,
  description: 'Generate styled text art locally (no external API). Usage: royaltext <text>',
  async run({ sock, msg, jid, args }) {
    const text = args.join(' ').trim();
    if (!text) return sock.sendMessage(jid, { text: 'Usage: .royaltext <your text>' }, { quoted: msg });
    if (text.length > 30) return sock.sendMessage(jid, { text: 'Keep it under 30 characters for best results.' }, { quoted: msg });
    try {
      const png = await renderTextImage(text, 'royal');
      await sock.sendMessage(jid, { image: png, caption: text }, { quoted: msg });
    } catch (err) {
      await sock.sendMessage(jid, { text: `Couldn't generate that: ${err.message}` }, { quoted: msg });
    }
  },
};
