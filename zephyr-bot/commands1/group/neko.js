const { fetchNekosBest } = require('../lib/nekosBest');

module.exports = {
  name: 'neko',
  category: 'Anime',
  aliases: ['neko2'],
  adminOnly: false,
  groupOnly: false,
  description: 'Get a random (sfw) neko image.',
  async run({ sock, msg, jid }) {
    try {
      const item = await fetchNekosBest('neko');
      await sock.sendMessage(jid, { image: { url: item.url } }, { quoted: msg });
    } catch {
      await sock.sendMessage(jid, { text: "Couldn't fetch an image right now, try again." }, { quoted: msg });
    }
  },
};
