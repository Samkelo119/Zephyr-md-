const ANSWERS = [
  'Yes, definitely.', 'It is certain.', 'Without a doubt.', 'Yes.',
  'Most likely.', 'Outlook good.', 'Signs point to yes.',
  'Reply hazy, try again.', 'Ask again later.', 'Cannot predict now.',
  "Don't count on it.", 'My reply is no.', 'Outlook not so good.', 'Very doubtful.',
];

module.exports = {
  name: '8ball',
  category: 'Fun',
  aliases: ['eightball'],
  adminOnly: false,
  groupOnly: false,
  description: 'Ask the magic 8-ball a yes/no question.',
  async run({ sock, msg, jid, args }) {
    const question = args.join(' ').trim();
    if (!question) return sock.sendMessage(jid, { text: 'Usage: .8ball <your question>' }, { quoted: msg });
    const answer = ANSWERS[Math.floor(Math.random() * ANSWERS.length)];
    await sock.sendMessage(jid, { text: `🎱 ${answer}` }, { quoted: msg });
  },
};
