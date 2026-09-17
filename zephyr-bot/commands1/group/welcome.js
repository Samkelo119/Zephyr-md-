const { setGroup, getGroup } = require('../lib/store');

module.exports = {
  name: 'welcome',
  category: 'Group Tools',
  aliases: [],
  adminOnly: true,
  groupOnly: true,
  description: 'Toggle auto-greeting new members. Usage: welcome on|off',
  async run({ sock, msg, jid, args }) {
    const setting = (args[0] || '').toLowerCase();
    if (!['on', 'off'].includes(setting)) {
      const current = getGroup(jid).welcome;
      await sock.sendMessage(
        jid,
        { text: `Welcome messages are currently *${current ? 'ON' : 'OFF'}*.\nUsage: welcome on|off` },
        { quoted: msg }
      );
      return;
    }

    setGroup(jid, { welcome: setting === 'on' });
    await sock.sendMessage(jid, { text: `✅ Welcome messages turned *${setting.toUpperCase()}*.` }, { quoted: msg });
  },
};