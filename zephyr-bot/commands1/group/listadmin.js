module.exports = {
  name: 'listadmin',
  category: 'Group Tools',
  aliases: ['admins'],
  adminOnly: false,
  groupOnly: true,
  description: 'List all admins in this group.',
  async run({ sock, msg, jid, groupMeta }) {
    const admins = groupMeta.participants.filter((p) => p.admin === 'admin' || p.admin === 'superadmin');
    if (!admins.length) return sock.sendMessage(jid, { text: 'No admins found.' }, { quoted: msg });
    const text = `*Group Admins (${admins.length})*\n\n` + admins.map((a) => `• @${a.id.split('@')[0]}`).join('\n');
    await sock.sendMessage(jid, { text, mentions: admins.map((a) => a.id) }, { quoted: msg });
  },
};
