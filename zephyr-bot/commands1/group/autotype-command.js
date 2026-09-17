module.exports = {
  name: 'autotype',
  category: 'Group',
  aliases: [],
  adminOnly: true,
  groupOnly: false,
  description: 'Toggle showing "typing..." before the bot sends messages. Usage: .autotype on | .autotype off',
  async run({ sock, msg, jid, args }) {
    const { setGroup } = require('../lib/store');

    const choice = (args?.[0] || '').toLowerCase();
    if (choice !== 'on' && choice !== 'off') {
      await sock.sendMessage(jid, { text: 'Usage: .autotype on | .autotype off' }, { quoted: msg });
      return;
    }

    setGroup(jid, { autotype: choice === 'on' });
    await sock.sendMessage(jid, { text: `✅ Autotype turned ${choice}.` }, { quoted: msg });
  },
};
