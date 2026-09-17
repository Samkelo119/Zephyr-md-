const PROMPTS = [
  'Send the last photo in your camera roll.',
  'Text a random contact "I know what you did".',
  'Speak in an accent for the next 3 messages.',
  'Post your current mood as your status.',
  'Let the group pick your profile picture for a day.',
  'Send a voice note singing your favorite song.',
];

module.exports = {
  name: 'dare',
  category: 'Fun',
  aliases: [],
  adminOnly: false,
  groupOnly: false,
  description: 'Get a random dare.',
  async run({ sock, msg, jid }) {
    const p = PROMPTS[Math.floor(Math.random() * PROMPTS.length)];
    await sock.sendMessage(jid, { text: `😈 Dare: ${p}` }, { quoted: msg });
  },
};
