const { downloadMediaMessage } = require('@whiskeysockets/baileys');

module.exports = {
  name: 'togcstatus',
  category: 'Group',
  aliases: [],
  adminOnly: false,
  groupOnly: true,
  description: 'Reply .togcstatus to an image/video in a group to post it to your own WhatsApp status.',
  async run({ sock, msg, jid, groupMeta }) {
    const quoted = msg.message?.extendedTextMessage?.contextInfo?.quotedMessage;

    if (!quoted) {
      await sock.sendMessage(jid, { text: '❌ Reply .togcstatus to an image or video to post it to status.' }, { quoted: msg });
      return;
    }

    const type = Object.keys(quoted)[0];
    if (type !== 'imageMessage' && type !== 'videoMessage') {
      await sock.sendMessage(jid, { text: '❌ .togcstatus only works on images or videos.' }, { quoted: msg });
      return;
    }

    const target = {
      message: quoted,
      key: { ...msg.key, id: msg.message.extendedTextMessage.contextInfo.stanzaId },
    };

    try {
      const buffer = await downloadMediaMessage(target, 'buffer', {});
      const caption = quoted[type].caption || '';

      // Status posts need statusJidList — the set of contacts allowed to
      // decrypt/see it. Without this, WhatsApp accepts the send silently
      // but nobody (not even you, on some clients) actually sees it.
      // Use everyone in the group you posted from as a reasonable default.
      const meta = groupMeta || (await sock.groupMetadata(jid));
      const statusJidList = meta.participants.map((p) => p.id);

      await sock.sendMessage(
        'status@broadcast',
        {
          [type === 'imageMessage' ? 'image' : 'video']: buffer,
          caption,
        },
        {
          backgroundColor: '#000000',
          statusJidList,
        }
      );

      await sock.sendMessage(jid, { text: '✅ Posted to status.' }, { quoted: msg });
    } catch (err) {
      await sock.sendMessage(jid, { text: `❌ Failed to post: ${err.message}` }, { quoted: msg });
    }
  },
};
