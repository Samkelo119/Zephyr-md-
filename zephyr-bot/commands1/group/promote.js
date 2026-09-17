function getTargetJid(msg) {
  const mentioned = msg.message?.extendedTextMessage?.contextInfo?.mentionedJid;
  if (mentioned?.length) return mentioned[0];

  const quotedParticipant = msg.message?.extendedTextMessage?.contextInfo?.participant;
  if (quotedParticipant) return quotedParticipant;

  return null;
}

module.exports = {
  name: 'promote',
  category: 'Group Tools',
  aliases: ['admin'],
  adminOnly: true,
  groupOnly: true,
  description: 'Make a member a group admin. Reply to their message or @mention them.',
  async run({ sock, msg, jid }) {
    const target = getTargetJid(msg);
    if (!target) {
      await sock.sendMessage(
        jid,
        { text: '⚠️ Reply to the person\'s message or @mention them with .promote' },
        { quoted: msg }
      );
      return;
    }

    try {
      await sock.groupParticipantsUpdate(jid, [target], 'promote');
      await sock.sendMessage(jid, { text: `⬆️ @${target.split('@')[0]} is now an admin.`, mentions: [target] });
    } catch (err) {
      console.error('[promote] error:', err.message);
      await sock.sendMessage(jid, { text: `❌ Couldn't promote that member: ${err.message}` }, { quoted: msg });
    }
  },
};