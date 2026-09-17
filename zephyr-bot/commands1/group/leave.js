module.exports = {
  name: 'leave',
  category: 'Group Tools',
  aliases: [],
  adminOnly: false,
  ownerOnly: true,
  groupOnly: true,
  description: 'Make the bot leave the current group.',
  async run({ sock, msg, jid }) {
    await sock.sendMessage(jid, { text: '👋 Leaving this group.' }, { quoted: msg });
    await sock.groupLeave(jid);
  },
};
