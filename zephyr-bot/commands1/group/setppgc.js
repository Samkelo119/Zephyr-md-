const { downloadMediaMessage } = require('@whiskeysockets/baileys');

module.exports = {
  name: 'setppgc',
  category: 'Group Tools',
  aliases: [],
  adminOnly: true,
  groupOnly: true,
  description: 'Set the group photo. Reply to an image with .setppgc',
  async run({ sock, msg, jid }) {
    const quoted = msg.message?.extendedTextMessage?.contextInfo?.quotedMessage;
    const target = quoted
      ? { message: quoted, key: { ...msg.key, id: msg.message.extendedTextMessage.contextInfo.stanzaId } }
      : msg;

    if (!target.message?.imageMessage) {
      await sock.sendMessage(jid, { text: 'Reply to an image with .setppgc' }, { quoted: msg });
      return;
    }

    try {
      const buffer = await downloadMediaMessage(target, 'buffer', {});
      await sock.updateProfilePicture(jid, buffer);
      await sock.sendMessage(jid, { text: '✅ Group photo updated.' }, { quoted: msg });
    } catch (err) {
      await sock.sendMessage(jid, { text: `❌ Couldn't update the group photo: ${err.message}` }, { quoted: msg });
    }
  },
};
