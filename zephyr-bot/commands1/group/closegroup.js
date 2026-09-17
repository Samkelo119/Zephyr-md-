module.exports = {
  name: 'closegroup',
  category: 'Group Tools',
  aliases: ['close'],
  adminOnly: true,
  groupOnly: true,
  description: 'Restrict messaging to admins only.',
  async run({ sock, msg, jid }) {
    await sock.groupSettingUpdate(jid, 'announcement');
    await sock.sendMessage(jid, { text: '🔒 Group closed — only admins can send messages.' }, { quoted: msg });
  },
};
