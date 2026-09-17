const { downloadMediaMessage } = require('@whiskeysockets/baileys');

module.exports = {
  name: 'tostatus',
  category: 'Utility',
  aliases: [],
  adminOnly: false,
  groupOnly: false,
  description: 'Reply .tostatus to any message to repost it to your own WhatsApp status.',
  async run({ sock, msg, jid }) {
    if (!msg.key.fromMe) return; // only trigger on your own replies

    const quoted = msg.message?.extendedTextMessage?.contextInfo?.quotedMessage;

    if (!quoted) {
      await sock.sendMessage(jid, { text: '❌ Reply .tostatus to the message you want to post.' }, { quoted: msg });
      return;
    }

    const target = {
      message: quoted,
      key: { ...msg.key, id: msg.message.extendedTextMessage.contextInfo.stanzaId },
    };
    const type = Object.keys(quoted)[0];

    // Status posts need statusJidList — the set of contacts allowed to
    // decrypt/see it, or WhatsApp silently accepts the send and nobody
    // sees it. In a group, use the full roster; in a DM, just the two
    // of you.
    const isGroup = jid.endsWith('@g.us');
    let statusJidList;
    if (isGroup) {
      const meta = await sock.groupMetadata(jid);
      statusJidList = meta.participants.map((p) => p.id);
    } else {
      statusJidList = [jid, sock.user.id.split(':')[0] + '@s.whatsapp.net'];
    }

    try {
      if (type === 'imageMessage' || type === 'videoMessage') {
        const buffer = await downloadMediaMessage(target, 'buffer', {});
        const caption = quoted[type].caption || '';

        await sock.sendMessage(
          'status@broadcast',
          {
            [type === 'imageMessage' ? 'image' : 'video']: buffer,
            caption,
          },
          { backgroundColor: '#000000', statusJidList }
        );
      } else if (type === 'extendedTextMessage' || type === 'conversation') {
        const statusText = quoted.extendedTextMessage?.text || quoted.conversation || '';
        await sock.sendMessage(
          'status@broadcast',
          { text: statusText },
          { backgroundColor: '#000000', statusJidList }
        );
      } else {
        await sock.sendMessage(jid, { text: '❌ Unsupported status type (e.g. audio-only).' }, { quoted: msg });
        return;
      }

      await sock.sendMessage(jid, { text: '✅ Posted to your status.' }, { quoted: msg });
    } catch (err) {
      await sock.sendMessage(jid, { text: `❌ Failed to post: ${err.message}` }, { quoted: msg });
    }
  },
};
