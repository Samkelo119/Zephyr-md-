// Playful, non-mean roast lines — jokes about being extra/dramatic, not
// insults about anyone's looks, intelligence, or identity.
const LINES = [
  'brings way too much energy to a Tuesday.',
  'takes 20 minutes to reply and then just sends "lol".',
  'has 47 unread chats and still opens this one first.',
  'says "one sec" and disappears for three hours.',
  'has strong opinions about pineapple on pizza and nothing else.',
  'left everyone on read to watch one more episode.',
];

function getTarget(msg) {
  const mentioned = msg.message?.extendedTextMessage?.contextInfo?.mentionedJid;
  if (mentioned?.length) return mentioned[0];
  return null;
}

module.exports = {
  name: 'roast',
  category: 'Fun',
  aliases: [],
  adminOnly: false,
  groupOnly: false,
  description: 'Lighthearted, good-natured ribbing. @mention someone or leave blank for yourself.',
  async run({ sock, msg, jid }) {
    const target = getTarget(msg) || msg.key.participant || msg.key.remoteJid;
    const line = LINES[Math.floor(Math.random() * LINES.length)];
    await sock.sendMessage(jid, { text: `🔥 @${target.split('@')[0]} ${line}`, mentions: [target] }, { quoted: msg });
  },
};
