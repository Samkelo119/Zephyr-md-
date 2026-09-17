const { resetWarn } = require('../lib/store');

function getTargetJid(msg) {
  const mentioned = msg.message?.extendedTextMessage?.contextInfo?.mentionedJid;
  if (mentioned?.length) return mentioned[0];
  const quotedParticipant = msg.message?.extendedTextMessage?.contextInfo?.participant;
  if (quotedParticipant) return quotedParticipant;
  return null;
}

module.exports = {
  name: 'resetwarn',
  category: 'Group Tools',
  aliases: ['unwarn', 'clearwarn'],
  adminOnly: true,
  groupOnly: true,
  description: "Clear a member's warnings. Reply to their message or @mention them.",
  async run({ sock, msg, jid }) {
    const target = getTargetJid(msg);
    if (!target) {
      await sock.sendMessage(jid, { text: "⚠️ Reply to the person's message or @mention them with .resetwarn" }, { quoted: msg });
      return;
    }
    resetWarn(jid, target);
    await sock.sendMessage(jid, { text: `✅ Warnings cleared for @${target.split('@')[0]}.`, mentions: [target] }, { quoted: msg });
  },
};
