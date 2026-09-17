function getTargetJid(msg) {
  const mentioned = msg.message?.extendedTextMessage?.contextInfo?.mentionedJid;
  if (mentioned?.length) return mentioned[0];

  const quotedParticipant = msg.message?.extendedTextMessage?.contextInfo?.participant;
  if (quotedParticipant) return quotedParticipant;

  return null;
}

// .getpp [@user] — sends the profile picture of the tagged/replied user,
// or the sender's own picture if no target is given.
module.exports = {
  name: 'getpp',
  category: 'Owner',
  aliases: [],
  adminOnly: false,
  groupOnly: false,
  ownerOnly: true,
  description: 'Get profile picture of a user (or yourself)',
  async run({ sock, msg, jid }) {
    const senderJid = msg.key.participant || msg.key.remoteJid;
    const target = getTargetJid(msg) || senderJid;

    try {
      const url = await sock.profilePictureUrl(target, 'image');
      await sock.sendMessage(
        jid,
        { image: { url }, caption: `📸 Profile picture: ${target.split('@')[0]}` },
        { quoted: msg }
      );
    } catch (err) {
      await sock.sendMessage(
        jid,
        { text: '❌ That user has no profile picture or it is private.' },
        { quoted: msg }
      );
    }
  },
};