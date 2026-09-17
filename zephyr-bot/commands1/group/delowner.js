const { setUser } = require('../lib/store');

module.exports = {
  name: 'delowner',
  category: 'Owner',
  aliases: [],
  adminOnly: false,
  ownerOnly: true,
  groupOnly: false,
  description: 'Revoke owner-command access previously granted with .addowner. Usage: delowner <number>',
  async run({ sock, msg, jid, args }) {
    const number = (args[0] || '').replace(/[^0-9]/g, '');
    if (!number) return sock.sendMessage(jid, { text: 'Usage: .delowner <number>' }, { quoted: msg });
    const target = `${number}@s.whatsapp.net`;
    setUser(target, { extraOwner: false });
    await sock.sendMessage(jid, { text: `✅ @${number} can no longer run owner-only commands.`, mentions: [target] }, { quoted: msg });
  },
};
