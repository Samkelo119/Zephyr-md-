const { askGroq } = require('../lib/groqClient');

module.exports = {
  name: 'gpt',
  category: 'AI',
  aliases: ['ai', 'ask', 'gemini', 'groq'],
  adminOnly: false,
  groupOnly: false,
  description: 'Ask the AI anything. Usage: gpt <your question>',
  async run({ sock, msg, jid, args }) {
    const prompt = args.join(' ').trim();
    if (!prompt) {
      await sock.sendMessage(jid, { text: '⚠️ Usage: .gpt what is the capital of France?' }, { quoted: msg });
      return;
    }

    await sock.sendMessage(jid, { text: '🧠 Thinking...' }, { quoted: msg });

    try {
      const reply = await askGroq(prompt);
      await sock.sendMessage(jid, { text: reply }, { quoted: msg });
    } catch (err) {
      console.error('[gpt] error:', err.message);
      await sock.sendMessage(
        jid,
        { text: `❌ AI request failed: ${err.message}` },
        { quoted: msg }
      );
    }
  },
};