const { downloadMediaMessage } = require('@whiskeysockets/baileys');

module.exports = {
  name: 'setppbot',
  category: 'Owner',
  aliases: [],
  adminOnly: true,
  groupOnly: false,
  description: "Set the bot's own profile picture. Reply to an image with .setppbot",
  async run({ sock, msg, jid }) {
    const quoted = msg.message?.extendedTextMessage?.contextInfo?.quotedMessage;
    const target = quoted
      ? { message: quoted, key: { ...msg.key, id: msg.message.extendedTextMessage.contextInfo.stanzaId } }
      : msg;

    if (!target.message?.imageMessage) {
      await sock.sendMessage(jid, { text: 'Reply to an image with .setppbot' }, { quoted: msg });
      return;
    }

    try {
      const buffer = await downloadMediaMessage(target, 'buffer', {});
      await sock.updateProfilePicture(sock.user.id, buffer);
      await sock.sendMessage(jid, { text: "✅ Bot's profile picture updated." }, { quoted: msg });
    } catch (err) {
      await sock.sendMessage(jid, { text: `❌ Couldn't update: ${err.message}` }, { quoted: msg });
    }
  },
};
