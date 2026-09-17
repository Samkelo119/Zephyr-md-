module.exports = {
  name: 'google',
  category: 'Utility',
  aliases: [],
  adminOnly: false,
  groupOnly: false,
  description: 'Get a Google search link for a query. Usage: google <query>',
  async run({ sock, msg, jid, args }) {
    const q = args.join(' ').trim();
    if (!q) return sock.sendMessage(jid, { text: 'Usage: .google <search query>' }, { quoted: msg });
    await sock.sendMessage(jid, { text: `🔍 https://www.google.com/search?q=${encodeURIComponent(q)}` }, { quoted: msg });
  },
};
