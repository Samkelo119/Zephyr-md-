module.exports = {
  name: 'setname',
  category: 'Group Tools',
  aliases: ['setgcname'],
  adminOnly: true,
  groupOnly: true,
  description: 'Change the group name. Usage: setname <new name>',
  async run({ sock, msg, jid, args }) {
    const name = args.join(' ').trim();
    if (!name) return sock.sendMessage(jid, { text: 'Usage: .setname <new group name>' }, { quoted: msg });
    try {
      await sock.groupUpdateSubject(jid, name);
      await sock.sendMessage(jid, { text: `✅ Group name updated to "${name}".` }, { quoted: msg });
    } catch (err) {
      await sock.sendMessage(jid, { text: `❌ Couldn't update the name: ${err.message}` }, { quoted: msg });
    }
  },
};
