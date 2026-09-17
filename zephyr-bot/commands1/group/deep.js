const { downloadMediaMessage } = require('@whiskeysockets/baileys');
const { applyAudioFilter, FILTERS } = require('../lib/audioEffects');

module.exports = {
  name: 'deep',
  category: 'Voice',
  aliases: [],
  adminOnly: false,
  groupOnly: false,
  description: 'Apply the deep effect to a voice note. Reply to an audio message with .deep',
  async run({ sock, msg, jid }) {
    const quoted = msg.message?.extendedTextMessage?.contextInfo?.quotedMessage;
    const target = quoted
      ? { message: quoted, key: { ...msg.key, id: msg.message.extendedTextMessage.contextInfo.stanzaId } }
      : msg;

    if (!target.message?.audioMessage) {
      await sock.sendMessage(jid, { text: 'Reply to a voice note or audio file with .deep' }, { quoted: msg });
      return;
    }

    try {
      const buffer = await downloadMediaMessage(target, 'buffer', {});
      const output = await applyAudioFilter(buffer, FILTERS.deep);
      await sock.sendMessage(jid, { audio: output, mimetype: 'audio/ogg; codecs=opus', ptt: true }, { quoted: msg });
    } catch (err) {
      await sock.sendMessage(jid, { text: `Couldn't process that audio: ${err.message}` }, { quoted: msg });
    }
  },
};
