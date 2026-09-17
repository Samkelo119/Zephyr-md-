module.exports = {
  name: 'opengroup',
  category: 'Group Tools',
  aliases: ['open'],
  adminOnly: true,
  groupOnly: true,
  description: 'Allow all members to send messages.',
  async run({ sock, msg, jid }) {
    await sock.groupSettingUpdate(jid, 'not_announcement');
    await sock.sendMessage(jid, { text: '🔓 Group opened — everyone can send messages.' }, { quoted: msg });
  },
};
