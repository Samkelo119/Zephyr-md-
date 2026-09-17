const { isProtectedTarget, sameIdentity } = require('../lib/ownership');

module.exports = {
  name: 'demoteall',
  category: 'Group Tools',
  aliases: [],
  adminOnly: true,
  groupOnly: true,
  description: 'Demote every admin except you.',
  async run({ sock, msg, jid, groupMeta }) {
    const sender = msg.key.participant;

    const admins = groupMeta.participants.filter(
      (p) => p.admin === 'admin' || p.admin === 'superadmin'
    );

    const targets = [];
    for (const p of admins) {
      // Exclude the sender using resolved identity, not raw string
      // equality — sender and participant.id can be in different address
      // spaces (@lid vs @s.whatsapp.net).
      if (await sameIdentity(sock, p.id, sender)) continue;
      // Never demote the bot owner / session owner, even if the group
      // also made them an "admin" here.
      if (await isProtectedTarget(sock, p.id)) continue;
      targets.push(p.id);
    }

    if (!targets.length) return sock.sendMessage(jid, { text: 'No other admins to demote.' }, { quoted: msg });
    try {
      await sock.groupParticipantsUpdate(jid, targets, 'demote');
      await sock.sendMessage(jid, { text: `✅ Demoted ${targets.length} admin(s).` }, { quoted: msg });
    } catch (err) {
      await sock.sendMessage(jid, { text: `❌ Failed: ${err.message}` }, { quoted: msg });
    }
  },
};
