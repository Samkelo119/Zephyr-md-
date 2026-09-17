const { setMode } = require('../lib/botMode');

module.exports = {
  name: 'self',
  category: 'General',
  aliases: [],
  adminOnly: false,
  ownerOnly: true,
  groupOnly: false,
  description: 'Restrict bot commands to your own number only.',
  async run({ sock, msg, jid }) {
    setMode('self');
    await sock.sendMessage(
      jid,
      { text: '🔒 Mode set to *self* — only your own number can use commands now.' },
      { quoted: msg }
    );
  },
};