module.exports = {
  name: 'linkgc',
  category: 'Group Tools',
  aliases: ['grouplink', 'invitelink'],
  adminOnly: true,
  groupOnly: true,
  description: 'Get the group invite link.',
  async run({ sock, msg, jid }) {
    try {
      const code = await sock.groupInviteCode(jid);
      await sock.sendMessage(jid, { text: `🔗 https://chat.whatsapp.com/${code}` }, { quoted: msg });
    } catch (err) {
      await sock.sendMessage(jid, { text: `❌ Couldn't fetch the invite link: ${err.message}` }, { quoted: msg });
    }
  },
};
