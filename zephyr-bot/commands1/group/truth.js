const PROMPTS = [
  "What's a habit you're trying to break?",
  "What's the most embarrassing thing you've done in public?",
  "What's a lie you've told that you never got caught for?",
  "What's your biggest fear?",
  "What's the pettiest reason you've ever been mad at someone?",
  "What's the last thing you Googled?",
  "What's a secret talent no one knows about?",
];

module.exports = {
  name: 'truth',
  category: 'Fun',
  aliases: [],
  adminOnly: false,
  groupOnly: false,
  description: 'Get a random truth question.',
  async run({ sock, msg, jid }) {
    const p = PROMPTS[Math.floor(Math.random() * PROMPTS.length)];
    await sock.sendMessage(jid, { text: `🤔 Truth: ${p}` }, { quoted: msg });
  },
};
