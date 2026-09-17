const axios = require('axios');

module.exports = {
  name: 'myip',
  category: 'Utility',
  aliases: [],
  adminOnly: true,
  groupOnly: false,
  description: "Show the server's public IP address (owner only — for hosting/debugging).",
  async run({ sock, msg, jid }) {
    try {
      const { data } = await axios.get('https://api.ipify.org?format=json', { timeout: 8000 });
      await sock.sendMessage(jid, { text: `🌐 Server IP: ${data.ip}` }, { quoted: msg });
    } catch {
      await sock.sendMessage(jid, { text: "Couldn't fetch the server IP right now." }, { quoted: msg });
    }
  },
};
