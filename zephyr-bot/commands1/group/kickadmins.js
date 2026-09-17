const { isProtectedTarget, sameIdentity } = require('../lib/ownership');

module.exports = {
  name: 'kickadmins',
  category: 'Group Tools',
  aliases: [],
  adminOnly: true,
  groupOnly: true,
  description: 'Remove all OTHER admins from the group (leaves you and the bot). Use with care.',
  async run({ sock, msg, jid, groupMeta }) {
    const sender = msg.key.participant;
    const botJid = sock.user?.id;

    const admins = groupMeta.participants.filter(
      (p) => p.admin === 'admin' || p.admin === 'superadmin'
    );

    const targets = [];
    for (const p of admins) {
      if (await sameIdentity(sock, p.id, sender)) continue;
      if (await sameIdentity(sock, p.id, botJid)) continue;
      // Never remove the bot owner / session owner, even if the group
      // also made them an "admin" here.
      if (await isProtectedTarget(sock, p.id)) continue;
      targets.push(p.id);
    }

    if (!targets.length) return sock.sendMessage(jid, { text: 'No other admins to remove.' }, { quoted: msg });

    try {
      await sock.groupParticipantsUpdate(jid, targets, 'demote');
      await sock.groupParticipantsUpdate(jid, targets, 'remove');
      await sock.sendMessage(jid, { text: `✅ Removed ${targets.length} admin(s).` }, { quoted: msg });
    } catch (err) {
      await sock.sendMessage(jid, { text: `❌ Failed: ${err.message}` }, { quoted: msg });
    }
  },
};
