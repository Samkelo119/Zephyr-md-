module.exports = {
  name: 'restart',
  category: 'Owner',
  aliases: [],
  adminOnly: false,
  ownerOnly: true,
  groupOnly: false,
  description: 'Restart the bot process (requires the host to auto-restart it, e.g. Railway/PM2).',
  async run({ sock, msg, jid }) {
    await sock.sendMessage(jid, { text: '♻️ Restarting...' }, { quoted: msg });
    setTimeout(() => process.exit(0), 800);
  },
};
