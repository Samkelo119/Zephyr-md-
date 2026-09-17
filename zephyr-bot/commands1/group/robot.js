const { downloadMediaMessage } = require('@whiskeysockets/baileys');
const { applyAudioFilter, FILTERS } = require('../lib/audioEffects');

module.exports = {
  name: 'robot',
  category: 'Voice',
  aliases: [],
  adminOnly: false,
  groupOnly: false,
  description: 'Apply the robot effect to a voice note. Reply to an audio message with .robot',
  async run({ sock, msg, jid }) {
    const quoted = msg.message?.extendedTextMessage?.contextInfo?.quotedMessage;
    const target = quoted
      ? { message: quoted, key: { ...msg.key, id: msg.message.extendedTextMessage.contextInfo.stanzaId } }
      : msg;

    if (!target.message?.audioMessage) {
      await sock.sendMessage(jid, { text: 'Reply to a voice note or audio file with .robot' }, { quoted: msg });
      return;
    }

    try {
      const buffer = await downloadMediaMessage(target, 'buffer', {});
      const output = await applyAudioFilter(buffer, FILTERS.robot);
      await sock.sendMessage(jid, { audio: output, mimetype: 'audio/ogg; codecs=opus', ptt: true }, { quoted: msg });
    } catch (err) {
      await sock.sendMessage(jid, { text: `Couldn't process that audio: ${err.message}` }, { quoted: msg });
    }
  },
};
