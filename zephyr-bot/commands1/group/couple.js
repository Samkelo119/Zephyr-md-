const LINES = [
  'always finishes the last slice for the other one.',
  'has matching phone wallpapers and won\'t admit it.',
  'argues about the thermostat more than anything else.',
  'has an entire language of inside jokes by now.',
];

function getTargets(msg, args) {
  const mentioned = msg.message?.extendedTextMessage?.contextInfo?.mentionedJid || [];
  if (mentioned.length >= 2) return [`@${mentioned[0].split('@')[0]}`, `@${mentioned[1].split('@')[0]}`];
  const names = args.join(' ').split(/\s*(?:&|and|x|\+)\s*/i).filter(Boolean);
  return names;
}

module.exports = {
  name: 'couple',
  category: 'Fun',
  aliases: [],
  adminOnly: false,
  groupOnly: false,
  description: 'Random silly "couple fact" about two people. Usage: couple Alex & Sam',
  async run({ sock, msg, jid, args }) {
    const [a, b] = getTargets(msg, args);
    if (!a || !b) return sock.sendMessage(jid, { text: 'Usage: .couple Name1 & Name2' }, { quoted: msg });
    const line = LINES[Math.floor(Math.random() * LINES.length)];
    const mentioned = msg.message?.extendedTextMessage?.contextInfo?.mentionedJid || [];
    await sock.sendMessage(jid, { text: `💑 ${a} & ${b} ${line}`, mentions: mentioned }, { quoted: msg });
  },
};
