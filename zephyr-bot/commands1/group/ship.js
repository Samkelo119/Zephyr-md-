function getTargets(msg, args) {
  const mentioned = msg.message?.extendedTextMessage?.contextInfo?.mentionedJid || [];
  if (mentioned.length >= 2) return [mentioned[0].split('@')[0], mentioned[1].split('@')[0]];
  return args.join(' ').split(/\s*(?:&|and|x|\+)\s*/i).filter(Boolean);
}

module.exports = {
  name: 'ship',
  category: 'Fun',
  aliases: [],
  adminOnly: false,
  groupOnly: false,
  description: 'Ship two names/@mentions and get a compatibility score. Usage: ship Alex & Sam',
  async run({ sock, msg, jid, args }) {
    const [a, b] = getTargets(msg, args);
    if (!a || !b) return sock.sendMessage(jid, { text: 'Usage: .ship Name1 & Name2' }, { quoted: msg });
    const score = Math.floor(Math.random() * 101);
    const bar = '█'.repeat(Math.round(score / 10)) + '░'.repeat(10 - Math.round(score / 10));
    await sock.sendMessage(jid, { text: `💘 ${a} × ${b}\n${bar} ${score}%` }, { quoted: msg });
  },
};
