const axios = require('axios');

module.exports = {
  name: 'dadjoke',
  category: 'Fun',
  aliases: [],
  adminOnly: false,
  groupOnly: false,
  description: 'Get a random dad joke.',
  async run({ sock, msg, jid }) {
    try {
      const { data } = await axios.get('https://icanhazdadjoke.com/', {
        headers: { Accept: 'application/json' },
        timeout: 8000,
      });
      await sock.sendMessage(jid, { text: `👨 ${data.joke}` }, { quoted: msg });
    } catch {
      await sock.sendMessage(jid, { text: "Couldn't fetch a joke right now, try again in a bit." }, { quoted: msg });
    }
  },
};
