const { renderTextImage } = require('../lib/textImage');

module.exports = {
  name: 'luxurygold',
  category: 'Logo',
  aliases: [],
  adminOnly: false,
  groupOnly: false,
  description: 'Generate styled text art locally (no external API). Usage: luxurygold <text>',
  async run({ sock, msg, jid, args }) {
    const text = args.join(' ').trim();
    if (!text) return sock.sendMessage(jid, { text: 'Usage: .luxurygold <your text>' }, { quoted: msg });
    if (text.length > 30) return sock.sendMessage(jid, { text: 'Keep it under 30 characters for best results.' }, { quoted: msg });
    try {
      const png = await renderTextImage(text, 'gold');
      await sock.sendMessage(jid, { image: png, caption: text }, { quoted: msg });
    } catch (err) {
      await sock.sendMessage(jid, { text: `Couldn't generate that: ${err.message}` }, { quoted: msg });
    }
  },
};
