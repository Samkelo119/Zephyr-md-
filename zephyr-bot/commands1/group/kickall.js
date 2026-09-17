const { isSessionOwner, isBotOwner, isProtectedTarget, sameIdentity } = require('../lib/ownership');

module.exports = {
  name: 'kickall',
  category: 'Group Tools',
  aliases: [],
  adminOnly: false, // we do our own stricter check below — NOT group-admin gated
  groupOnly: true,
  description: 'Owner-only. Remove ALL non-admin members from the group. Requires .kickall confirm.',
  async run({ sock, msg, jid, groupMeta, args }) {
    const sender = msg.key.participant || msg.key.remoteJid;

    // Owner-only — a WhatsApp group admin who is NOT the bot owner must
    // never be able to trigger this, even though they can trigger normal
    // .kick. This is deliberately stricter than adminOnly.
    if (!(await isSessionOwner(sock, sender)) && !(await isBotOwner(sock, sender))) {
      await sock.sendMessage(jid, { text: '❌ Owner-only command.' }, { quoted: msg });
      return;
    }

    const meta = groupMeta || (await sock.groupMetadata(jid));
    const botJid = sock.user.id;
    let botIsAdmin = false;
    for (const p of meta.participants) {
      if (p.admin && (await sameIdentity(sock, p.id, botJid))) {
        botIsAdmin = true;
        break;
      }
    }
    if (!botIsAdmin) {
      await sock.sendMessage(jid, { text: '⚠️ Bot needs admin rights first.' }, { quoted: msg });
      return;
    }

    // Explicit confirm step so a stray/mistyped ".kickall" can't nuke a group.
    if ((args?.[0] || '').toLowerCase() !== 'confirm') {
      await sock.sendMessage(
        jid,
        {
          text:
            '⚠️ This will remove ALL non-admin members from this group.\n' +
            'This cannot be undone. Type *.kickall confirm* to proceed.',
        },
        { quoted: msg }
      );
      return;
    }

    const targets = [];
    for (const p of meta.participants) {
      if (p.admin) continue;
      if (await sameIdentity(sock, p.id, botJid)) continue;
      if (await isProtectedTarget(sock, p.id)) continue;
      targets.push(p.id);
    }

    if (!targets.length) {
      await sock.sendMessage(jid, { text: 'No members to kick.' }, { quoted: msg });
      return;
    }

    await sock.sendMessage(jid, { text: `Starting removal of ${targets.length} member(s)...` });

    let kicked = 0;
    for (const t of targets) {
      try {
        await sock.groupParticipantsUpdate(jid, [t], 'remove');
        kicked++;
        await new Promise((r) => setTimeout(r, 1500)); // throttle, avoid ban-flagging the bot
      } catch (err) {
        console.error('[kickall] failed for', t, err.message);
      }
    }

    await sock.sendMessage(jid, { text: `✅ Kicked ${kicked}/${targets.length} member(s).` }, { quoted: msg });
  },
};
