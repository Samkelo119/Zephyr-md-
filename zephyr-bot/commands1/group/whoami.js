const TRAITS = [
  'a chaotic-good main character', 'the group\'s unofficial DJ', 'always 10 minutes late but worth the wait',
  'the reason the group chat never sleeps', 'quietly the funniest one here', 'built different (in a good way)',
];

module.exports = {
  name: 'whoami',
  category: 'Fun',
  aliases: [],
  adminOnly: false,
  groupOnly: false,
  description: 'Get a random silly identity.',
  async run({ sock, msg, jid }) {
    const trait = TRAITS[Math.floor(Math.random() * TRAITS.length)];
    await sock.sendMessage(jid, { text: `🪪 You are: ${trait}` }, { quoted: msg });
  },
};
