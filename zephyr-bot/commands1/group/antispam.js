const { setGroup, getGroup } = require('../lib/store');

module.exports = {
  name: 'antispam',
  category: 'Group Tools',
  aliases: [],
  adminOnly: true,
  groupOnly: true,
  description: 'Toggle flood protection: members sending messages too fast get warned, then removed. Usage: antispam on|off',
  async run({ sock, msg, jid, args }) {
    const setting = (args[0] || '').toLowerCase();
    if (!['on', 'off'].includes(setting)) {
      const current = getGroup(jid).antispam;
      await sock.sendMessage(jid, { text: `Antispam is currently *${current ? 'ON' : 'OFF'}*.\nUsage: antispam on|off` }, { quoted: msg });
      return;
    }
    setGroup(jid, { antispam: setting === 'on' });
    await sock.sendMessage(jid, { text: `✅ Antispam (flood protection) turned *${setting.toUpperCase()}*.` }, { quoted: msg });
  },
};
