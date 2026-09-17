const { setGroup, getGroup } = require('../lib/store');

module.exports = {
  name: 'antidelete',
  category: 'Group Tools',
  aliases: ['antideletedm'],
  adminOnly: true,
  groupOnly: false,
  description: 'Recover messages that get deleted for everyone in this chat. Usage: antidelete on|off',
  async run({ sock, msg, jid, args }) {
    const setting = (args[0] || '').toLowerCase();
    if (!['on', 'off'].includes(setting)) {
      const current = getGroup(jid).antidelete;
      await sock.sendMessage(jid, { text: `Antidelete is currently *${current ? 'ON' : 'OFF'}* in this chat.\nUsage: antidelete on|off` }, { quoted: msg });
      return;
    }
    setGroup(jid, { antidelete: setting === 'on' });
    await sock.sendMessage(jid, { text: `✅ Antidelete turned *${setting.toUpperCase()}* for this chat.` }, { quoted: msg });
  },
};
