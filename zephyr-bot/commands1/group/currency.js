const axios = require('axios');

module.exports = {
  name: 'currency',
  category: 'Utility',
  aliases: ['convert'],
  adminOnly: false,
  groupOnly: false,
  description: 'Convert currency. Usage: currency 100 USD to NGN',
  async run({ sock, msg, jid, args }) {
    const match = args.join(' ').match(/^([\d.]+)\s*([a-zA-Z]{3})\s*(?:to)?\s*([a-zA-Z]{3})$/i);
    if (!match) return sock.sendMessage(jid, { text: 'Usage: .currency 100 USD to NGN' }, { quoted: msg });
    const [, amountStr, from, to] = match;
    const amount = parseFloat(amountStr);
    try {
      const { data } = await axios.get(`https://open.er-api.com/v6/latest/${from.toUpperCase()}`, { timeout: 8000 });
      const rate = data.rates?.[to.toUpperCase()];
      if (!rate) throw new Error('Unknown currency code');
      const result = (amount * rate).toFixed(2);
      await sock.sendMessage(jid, { text: `💱 ${amount} ${from.toUpperCase()} = *${result} ${to.toUpperCase()}*` }, { quoted: msg });
    } catch (err) {
      await sock.sendMessage(jid, { text: `❌ Conversion failed: ${err.message}` }, { quoted: msg });
    }
  },
};
