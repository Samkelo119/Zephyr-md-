const pendingQuestions = require('../lib/pendingQuestions');

module.exports = {
  name: 'math',
  category: 'Games',
  aliases: [],
  adminOnly: false,
  groupOnly: false,
  description: 'Get a quick arithmetic question — first correct reply wins. 20 second time limit.',
  async run({ sock, msg, jid }) {
    const ops = ['+', '-', '*'];
    const op = ops[Math.floor(Math.random() * ops.length)];
    const a = Math.floor(Math.random() * (op === '*' ? 12 : 100));
    const b = Math.floor(Math.random() * (op === '*' ? 12 : 100));
    // eslint-disable-next-line no-eval
    const answer = op === '+' ? a + b : op === '-' ? a - b : a * b;

    pendingQuestions.ask(jid, answer, { ttlMs: 20000 });
    await sock.sendMessage(jid, { text: `🧮 What's ${a} ${op} ${b}? — 20s to answer.` }, { quoted: msg });
  },
};
