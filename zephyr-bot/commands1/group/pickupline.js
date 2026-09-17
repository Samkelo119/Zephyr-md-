const LINES = [
  "Are you a parking ticket? Because you've got fine written all over you.",
  "Is your name Google? Because you have everything I've been searching for.",
  "Do you have a map? I keep getting lost in your eyes.",
  "Are you made of copper and tellurium? Because you're Cu-Te.",
  "If you were a vegetable you'd be a cute-cumber.",
];

module.exports = {
  name: 'pickupline',
  category: 'Fun',
  aliases: [],
  adminOnly: false,
  groupOnly: false,
  description: 'Get a random (cheesy) pickup line.',
  async run({ sock, msg, jid }) {
    const line = LINES[Math.floor(Math.random() * LINES.length)];
    await sock.sendMessage(jid, { text: `😏 ${line}` }, { quoted: msg });
  },
};
