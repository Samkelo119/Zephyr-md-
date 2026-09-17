const axios = require('axios');

module.exports = {
  name: 'github',
  category: 'Utility',
  aliases: ['gh'],
  adminOnly: false,
  groupOnly: false,
  description: "Look up a public GitHub profile's stats. Usage: github <username>",
  async run({ sock, msg, jid, args }) {
    const username = args[0];
    if (!username) return sock.sendMessage(jid, { text: 'Usage: .github <username>' }, { quoted: msg });
    try {
      const { data } = await axios.get(`https://api.github.com/users/${encodeURIComponent(username)}`, { timeout: 8000 });
      const text =
        `*${data.name || data.login}* (@${data.login})\n` +
        `${data.bio || ''}\n\n` +
        `📦 Repos: ${data.public_repos}\n` +
        `👥 Followers: ${data.followers} | Following: ${data.following}\n` +
        `🔗 ${data.html_url}`;
      await sock.sendMessage(jid, { text }, { quoted: msg });
    } catch {
      await sock.sendMessage(jid, { text: `Couldn't find a GitHub user called "${username}".` }, { quoted: msg });
    }
  },
};
