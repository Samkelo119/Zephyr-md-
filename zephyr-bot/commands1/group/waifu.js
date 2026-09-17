const { fetchNekosBest } = require('../lib/nekosBest');

module.exports = {
  name: 'waifu',
  category: 'Anime',
  aliases: [],
  adminOnly: false,
  groupOnly: false,
  description: 'Get a random (sfw) anime waifu image.',
  async run({ sock, msg, jid }) {
    try {
      const item = await fetchNekosBest('waifu');
      await sock.sendMessage(jid, { image: { url: item.url } }, { quoted: msg });
    } catch {
      await sock.sendMessage(jid, { text: "Couldn't fetch an image right now, try again." }, { quoted: msg });
    }
  },
};
