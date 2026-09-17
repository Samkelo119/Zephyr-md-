module.exports = {
  name: 'autoreact',
  category: 'Group',
  aliases: [],
  adminOnly: true,
  groupOnly: false,
  description: 'Toggle auto-reacting to every message with a random emoji. Usage: .autoreact on | .autoreact off',
  async run({ sock, msg, jid, args }) {
    const { setGroup } = require('../lib/store');

    const choice = (args?.[0] || '').toLowerCase();
    if (choice !== 'on' && choice !== 'off') {
      await sock.sendMessage(jid, { text: 'Usage: .autoreact on | .autoreact off' }, { quoted: msg });
      return;
    }

    setGroup(jid, { autoreact: choice === 'on' });
    await sock.sendMessage(jid, { text: `✅ Autoreact turned ${choice}.` }, { quoted: msg });
  },
};
