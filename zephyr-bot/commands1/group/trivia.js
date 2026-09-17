const axios = require('axios');
const pendingQuestions = require('../lib/pendingQuestions');

function decodeHtml(str) {
  return str
    .replace(/&quot;/g, '"')
    .replace(/&#0?39;/g, "'")
    .replace(/&amp;/g, '&')
    .replace(/&eacute;/g, 'é')
    .replace(/&ouml;/g, 'ö');
}

module.exports = {
  name: 'trivia',
  category: 'Games',
  aliases: [],
  adminOnly: false,
  groupOnly: false,
  description: 'Get a trivia question — first correct reply wins. 30 second time limit.',
  async run({ sock, msg, jid }) {
    try {
      const { data } = await axios.get('https://opentdb.com/api.php?amount=1&type=multiple', { timeout: 8000 });
      const q = data.results?.[0];
      if (!q) throw new Error('no question returned');

      const options = [...q.incorrect_answers, q.correct_answer].map(decodeHtml);
      for (let i = options.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [options[i], options[j]] = [options[j], options[i]];
      }

      const lettered = options.map((o, i) => `${String.fromCharCode(65 + i)}) ${o}`).join('\n');
      const correctLetter = String.fromCharCode(65 + options.indexOf(decodeHtml(q.correct_answer)));

      pendingQuestions.ask(jid, correctLetter, { ttlMs: 30000 });
      // Also accept the full answer text, not just the letter.
      await sock.sendMessage(jid, {
        text: `🧠 *Trivia* (${decodeHtml(q.category)})\n\n${decodeHtml(q.question)}\n\n${lettered}\n\nReply with the letter — 30s.`,
      }, { quoted: msg });
    } catch {
      await sock.sendMessage(jid, { text: "Couldn't fetch a trivia question right now." }, { quoted: msg });
    }
  },
};
