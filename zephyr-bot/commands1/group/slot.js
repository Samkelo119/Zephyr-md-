const SYMBOLS = ['🍒', '🍋', '🍇', '🍉', '⭐', '💎'];

module.exports = {
  name: 'slot',
  category: 'Games',
  aliases: ['slots'],
  adminOnly: false,
  groupOnly: false,
  description: 'Spin the slot machine.',
  async run({ sock, msg, jid }) {
    const roll = () => SYMBOLS[Math.floor(Math.random() * SYMBOLS.length)];
    const result = [roll(), roll(), roll()];
    const win = result[0] === result[1] && result[1] === result[2];
    await sock.sendMessage(jid, {
      text: `🎰 [ ${result.join(' | ')} ]\n\n${win ? '🎉 Jackpot!' : 'No match — try again.'}`,
    }, { quoted: msg });
  },
};
