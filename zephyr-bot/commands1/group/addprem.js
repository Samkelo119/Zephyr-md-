const { setUser } = require('../lib/store');

module.exports = {
  name: 'addprem',
  category: 'Owner',
  aliases: [],
  adminOnly: false,
  ownerOnly: true,
  groupOnly: false,
  description: 'Flag a user as premium. Usage: addprem <number> (no premium-only commands are gated yet — this just sets the flag)',
  async run({ sock, msg, jid, args }) {
    const number = (args[0] || '').replace(/[^0-9]/g, '');
    if (!number) return sock.sendMessage(jid, { text: 'Usage: .addprem <number>' }, { quoted: msg });
    const target = `${number}@s.whatsapp.net`;
    setUser(target, { premium: true });
    await sock.sendMessage(jid, { text: `✅ @${number} flagged as premium.`, mentions: [target] }, { quoted: msg });
  },
};
