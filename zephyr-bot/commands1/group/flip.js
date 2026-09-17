module.exports = {
  name: 'flip',
  category: 'Fun',
  aliases: ['coinflip', 'coin'],
  adminOnly: false,
  groupOnly: false,
  description: 'Flip a coin.',
  async run({ sock, msg, jid }) {
    const result = Math.random() < 0.5 ? 'Heads' : 'Tails';
    await sock.sendMessage(jid, { text: `🪙 ${result}!` }, { quoted: msg });
  },
};
