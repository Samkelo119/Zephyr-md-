const pendingQuestions = require('../lib/pendingQuestions');

module.exports = {
  name: 'guess',
  category: 'Games',
  aliases: ['guessnumber'],
  adminOnly: false,
  groupOnly: false,
  description: 'Guess a number between 1-50 — first correct reply wins. 30 second time limit.',
  async run({ sock, msg, jid }) {
    const answer = 1 + Math.floor(Math.random() * 50);
    pendingQuestions.ask(jid, answer, { ttlMs: 30000 });
    await sock.sendMessage(jid, { text: `🔢 I'm thinking of a number between 1 and 50. First correct guess wins — 30s.` }, { quoted: msg });
  },
};
