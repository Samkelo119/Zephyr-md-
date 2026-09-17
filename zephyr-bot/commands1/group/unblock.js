const { setUser } = require('../lib/store');

function getTargetJid(msg, args) {
  const mentioned = msg.message?.extendedTextMessage?.contextInfo?.mentionedJid;
  if (mentioned?.length) return mentioned[0];
  const quotedParticipant = msg.message?.extendedTextMessage?.contextInfo?.participant;
  if (quotedParticipant) return quotedParticipant;
  const raw = args[0]?.replace(/[^0-9]/g, '');
  if (raw) return `${raw}@s.whatsapp.net`;
  return null;
}

module.exports = {
  name: 'unblock',
  category: 'Owner',
  aliases: [],
  adminOnly: true,
  groupOnly: false,
  description: 'Unblock a user on WhatsApp and restore bot responses to them.',
  async run({ sock, msg, jid, args }) {
    const target = getTargetJid(msg, args);
    if (!target) return sock.sendMessage(jid, { text: 'Usage: .unblock <number> (or reply/@mention)' }, { quoted: msg });

    setUser(target, { blocked: false });

    try {
      await sock.updateBlockStatus(target, 'unblock');
    } catch (err) {
      console.error('[unblock] WhatsApp-level unblock failed:', err.message);
    }

    await sock.sendMessage(jid, { text: `✅ @${target.split('@')[0]} unblocked.`, mentions: [target] }, { quoted: msg });
  },
};
