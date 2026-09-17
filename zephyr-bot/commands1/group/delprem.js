const { setUser } = require('../lib/store');

module.exports = {
  name: 'delprem',
  category: 'Owner',
  aliases: [],
  adminOnly: false,
  ownerOnly: true,
  groupOnly: false,
  description: 'Remove the premium flag from a user. Usage: delprem <number>',
  async run({ sock, msg, jid, args }) {
    const number = (args[0] || '').replace(/[^0-9]/g, '');
    if (!number) return sock.sendMessage(jid, { text: 'Usage: .delprem <number>' }, { quoted: msg });
    const target = `${number}@s.whatsapp.net`;
    setUser(target, { premium: false });
    await sock.sendMessage(jid, { text: `✅ Premium removed from @${number}.`, mentions: [target] }, { quoted: msg });
  },
};
