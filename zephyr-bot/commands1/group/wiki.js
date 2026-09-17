const axios = require('axios');

module.exports = {
  name: 'wiki',
  category: 'Utility',
  aliases: ['wikipedia'],
  adminOnly: false,
  groupOnly: false,
  description: 'Get a Wikipedia summary. Usage: wiki <topic>',
  async run({ sock, msg, jid, args }) {
    const topic = args.join(' ').trim();
    if (!topic) return sock.sendMessage(jid, { text: 'Usage: .wiki <topic>' }, { quoted: msg });
    try {
      const { data } = await axios.get(
        `https://en.wikipedia.org/api/rest_v1/page/summary/${encodeURIComponent(topic)}`,
        { timeout: 8000 }
      );
      if (data.type === 'disambiguation') throw new Error('That topic is ambiguous — try being more specific.');
      const text = `*${data.title}*\n\n${data.extract}\n\n🔗 ${data.content_urls?.desktop?.page || ''}`;
      await sock.sendMessage(jid, { text }, { quoted: msg });
    } catch (err) {
      await sock.sendMessage(jid, { text: `❌ Couldn't find that: ${err.message}` }, { quoted: msg });
    }
  },
};
