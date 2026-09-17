module.exports = {
  name: 'setdesc',
  category: 'Group Tools',
  aliases: ['setgcdesc'],
  adminOnly: true,
  groupOnly: true,
  description: 'Change the group description. Usage: setdesc <text>',
  async run({ sock, msg, jid, args }) {
    const desc = args.join(' ').trim();
    if (!desc) return sock.sendMessage(jid, { text: 'Usage: .setdesc <new description>' }, { quoted: msg });
    try {
      await sock.groupUpdateDescription(jid, desc);
      await sock.sendMessage(jid, { text: '✅ Group description updated.' }, { quoted: msg });
    } catch (err) {
      await sock.sendMessage(jid, { text: `❌ Couldn't update the description: ${err.message}` }, { quoted: msg });
    }
  },
};
