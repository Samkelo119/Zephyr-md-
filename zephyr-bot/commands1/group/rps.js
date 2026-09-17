const CHOICES = ['rock', 'paper', 'scissors'];
const BEATS = { rock: 'scissors', paper: 'rock', scissors: 'paper' };

module.exports = {
  name: 'rps',
  category: 'Fun',
  aliases: [],
  adminOnly: false,
  groupOnly: false,
  description: 'Play rock-paper-scissors against the bot. Usage: rps rock|paper|scissors',
  async run({ sock, msg, jid, args }) {
    const pick = (args[0] || '').toLowerCase();
    if (!CHOICES.includes(pick)) return sock.sendMessage(jid, { text: 'Usage: .rps rock|paper|scissors' }, { quoted: msg });
    const bot = CHOICES[Math.floor(Math.random() * 3)];
    let result;
    if (bot === pick) result = "It's a tie!";
    else if (BEATS[pick] === bot) result = 'You win! 🎉';
    else result = 'I win! 🤖';
    await sock.sendMessage(jid, { text: `You: ${pick}\nMe: ${bot}\n\n${result}` }, { quoted: msg });
  },
};
