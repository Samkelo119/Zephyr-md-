const axios = require('axios');

module.exports = {
  name: 'animesearch',
  category: 'Anime',
  aliases: [],
  adminOnly: false,
  groupOnly: false,
  description: 'Search for anime info. Usage: animesearch <title>',
  async run({ sock, msg, jid, args }) {
    const query = args.join(' ').trim();
    if (!query) return sock.sendMessage(jid, { text: 'Usage: .animesearch Naruto' }, { quoted: msg });
    try {
      const { data } = await axios.get(`https://api.jikan.moe/v4/anime?q=${encodeURIComponent(query)}&limit=1`, { timeout: 10000 });
      const anime = data.data?.[0];
      if (!anime) throw new Error('not found');
      const text =
        `*${anime.title}*\n\n` +
        `${anime.synopsis ? anime.synopsis.slice(0, 500) + '...' : 'No synopsis available.'}\n\n` +
        `⭐ Score: ${anime.score ?? 'N/A'}\n` +
        `📺 Episodes: ${anime.episodes ?? 'N/A'}\n` +
        `📅 Status: ${anime.status}\n` +
        `🔗 ${anime.url}`;
      await sock.sendMessage(jid, { image: { url: anime.images?.jpg?.image_url }, caption: text }, { quoted: msg });
    } catch {
      await sock.sendMessage(jid, { text: `Couldn't find an anime called "${query}".` }, { quoted: msg });
    }
  },
};
