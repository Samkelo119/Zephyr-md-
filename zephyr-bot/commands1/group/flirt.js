const LINES = [
  "You must be tired, because you've been running through my mind all day.",
  "Do you believe in love at first sight, or should I walk by again?",
  "I was going to say something really sweet, but you took my breath away.",
];

module.exports = {
  name: 'flirt',
  category: 'Fun',
  aliases: [],
  adminOnly: false,
  groupOnly: false,
  description: 'Get a random flirty line.',
  async run({ sock, msg, jid }) {
    const line = LINES[Math.floor(Math.random() * LINES.length)];
    await sock.sendMessage(jid, { text: `💌 ${line}` }, { quoted: msg });
  },
};
