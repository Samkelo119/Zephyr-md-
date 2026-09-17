const axios = require('axios');

module.exports = {
  name: 'advice',
  category: 'Fun',
  aliases: [],
  adminOnly: false,
  groupOnly: false,
  description: 'Get a random piece of advice.',
  async run({ sock, msg, jid }) {
    try {
      const { data } = await axios.get('https://api.adviceslip.com/advice', { timeout: 8000 });
      await sock.sendMessage(jid, { text: `💡 ${data.slip.advice}` }, { quoted: msg });
    } catch {
      await sock.sendMessage(jid, { text: "Couldn't fetch advice right now, try again in a bit." }, { quoted: msg });
    }
  },
};
