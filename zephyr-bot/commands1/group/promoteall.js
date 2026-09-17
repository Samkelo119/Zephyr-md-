module.exports = {
  name: 'promoteall',
  category: 'Group Tools',
  aliases: [],
  adminOnly: false,
  ownerOnly: true,
  groupOnly: true,
  description: 'Promote every regular member to admin. Use with care.',
  async run({ sock, msg, jid, groupMeta }) {
    const targets = groupMeta.participants.filter((p) => !p.admin).map((p) => p.id);
    if (!targets.length) return sock.sendMessage(jid, { text: 'Everyone is already an admin.' }, { quoted: msg });
    try {
      await sock.groupParticipantsUpdate(jid, targets, 'promote');
      await sock.sendMessage(jid, { text: `✅ Promoted ${targets.length} member(s) to admin.` }, { quoted: msg });
    } catch (err) {
      await sock.sendMessage(jid, { text: `❌ Failed: ${err.message}` }, { quoted: msg });
    }
  },
};
