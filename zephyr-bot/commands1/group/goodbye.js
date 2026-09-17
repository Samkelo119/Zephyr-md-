const { setGroup, getGroup } = require('../lib/store');

module.exports = {
  name: 'goodbye',
  category: 'Group Tools',
  aliases: [],
  adminOnly: true,
  groupOnly: true,
  description: 'Toggle a farewell message when someone leaves. Usage: goodbye on|off',
  async run({ sock, msg, jid, args }) {
    const setting = (args[0] || '').toLowerCase();
    if (!['on', 'off'].includes(setting)) {
      const current = getGroup(jid).goodbye;
      await sock.sendMessage(jid, { text: `Goodbye messages are currently *${current ? 'ON' : 'OFF'}*.\nUsage: goodbye on|off` }, { quoted: msg });
      return;
    }
    setGroup(jid, { goodbye: setting === 'on' });
    await sock.sendMessage(jid, { text: `✅ Goodbye messages turned *${setting.toUpperCase()}*.` }, { quoted: msg });
  },
};
