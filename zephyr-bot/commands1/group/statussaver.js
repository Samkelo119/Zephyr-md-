const { downloadMediaMessage } = require('@whiskeysockets/baileys');

module.exports = {
  name: 'save',
  category: 'Utility',
  aliases: [],
  adminOnly: false,
  groupOnly: false,
  description: 'Reply .save to a status (from your status viewer) to forward it to your own DM.',
  async run({ sock, msg, jid }) {
    if (!msg.key.fromMe) return; // only trigger on your own replies

    const quoted = msg.message?.extendedTextMessage?.contextInfo?.quotedMessage;
    const quotedParticipant = msg.message?.extendedTextMessage?.contextInfo?.participant;

    if (!quoted) {
      await sock.sendMessage(jid, { text: '❌ Reply .save directly to a status to save it.' }, { quoted: msg });
      return;
    }

    const target = {
      message: quoted,
      key: { ...msg.key, id: msg.message.extendedTextMessage.contextInfo.stanzaId },
    };

    const selfJid = sock.user.id.split(':')[0] + '@s.whatsapp.net';
    const type = Object.keys(quoted)[0];
    const fromTag = quotedParticipant ? `from @${quotedParticipant.split('@')[0]}` : '';

    try {
      if (type === 'imageMessage' || type === 'videoMessage') {
        const buffer = await downloadMediaMessage(target, 'buffer', {});
        const caption = quoted[type].caption || '';

        await sock.sendMessage(selfJid, {
          [type === 'imageMessage' ? 'image' : 'video']: buffer,
          caption: `💾 Saved status ${fromTag}${caption ? `\n${caption}` : ''}`,
          mentions: quotedParticipant ? [quotedParticipant] : [],
        });
      } else if (type === 'extendedTextMessage' || type === 'conversation') {
        const statusText = quoted.extendedTextMessage?.text || quoted.conversation || '';
        await sock.sendMessage(selfJid, {
          text: `💾 Saved status ${fromTag}\n${statusText}`,
          mentions: quotedParticipant ? [quotedParticipant] : [],
        });
      } else {
        await sock.sendMessage(jid, { text: '❌ Unsupported status type (e.g. audio-only).' }, { quoted: msg });
        return;
      }

      await sock.sendMessage(jid, { text: '✅ Saved to your DM.' }, { quoted: msg });
    } catch (err) {
      await sock.sendMessage(jid, { text: `❌ Failed to save: ${err.message}` }, { quoted: msg });
    }
  },
};
