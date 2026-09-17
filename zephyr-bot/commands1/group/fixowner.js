module.exports = {
  name: 'fixowner',
  category: 'Owner',
  aliases: [],
  adminOnly: true,
  groupOnly: false,
  description: 'Show the numbers currently recognized as bot owners (from .env BOT_ADMINS + .addowner).',
  async run({ sock, msg, jid }) {
    const envAdmins = (process.env.BOT_ADMINS || '').split(',').map((s) => s.trim()).filter(Boolean);
    const list = envAdmins.length ? envAdmins.map((a) => `• ${a}`).join('\n') : 'None set in BOT_ADMINS.';
    await sock.sendMessage(jid, {
      text: `👑 *Configured Owners*\n\n${list}\n\nAdd more with .addowner, remove with .delowner.`,
    }, { quoted: msg });
  },
};
