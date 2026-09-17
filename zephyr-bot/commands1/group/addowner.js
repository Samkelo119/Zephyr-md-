const { setUser } = require('../lib/store');

module.exports = {
  name: 'addowner',
  category: 'Owner',
  aliases: [],
  adminOnly: false,
  ownerOnly: true,
  groupOnly: false,
  description: 'Grant owner-command access to another number (in addition to BOT_ADMINS in .env). Usage: addowner <number>',
  async run({ sock, msg, jid, args }) {
    const number = (args[0] || '').replace(/[^0-9]/g, '');
    if (!number) return sock.sendMessage(jid, { text: 'Usage: .addowner <number>' }, { quoted: msg });
    const target = `${number}@s.whatsapp.net`;
    setUser(target, { extraOwner: true });
    await sock.sendMessage(jid, { text: `✅ @${number} can now run owner-only commands.`, mentions: [target] }, { quoted: msg });
  },
};
