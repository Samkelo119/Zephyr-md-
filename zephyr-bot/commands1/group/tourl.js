const axios = require('axios');

module.exports = {
  name: 'tourl',
  category: 'Utility',
  aliases: ['tinyurl', 'shorturl'],
  adminOnly: false,
  groupOnly: false,
  description: 'Shorten a URL. Usage: tourl <link>',
  async run({ sock, msg, jid, args }) {
    const url = args[0];
    if (!url || !/^https?:\/\//i.test(url)) return sock.sendMessage(jid, { text: 'Usage: .tourl https://example.com/long-link' }, { quoted: msg });
    try {
      const { data } = await axios.get(`https://tinyurl.com/api-create.php?url=${encodeURIComponent(url)}`, { timeout: 8000 });
      await sock.sendMessage(jid, { text: `🔗 ${data}` }, { quoted: msg });
    } catch {
      await sock.sendMessage(jid, { text: "Couldn't shorten that link right now." }, { quoted: msg });
    }
  },
};
