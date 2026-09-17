module.exports = {
  name: 'tag',
  category: 'Group Tools',
  aliases: [],
  adminOnly: true,
  groupOnly: true,
  description: "Reply to a message with .tag to repost it mentioning everyone (silently, no full list shown).",
  async run({ sock, msg, jid, groupMeta }) {
    const quoted = msg.message?.extendedTextMessage?.contextInfo?.quotedMessage;
    if (!quoted) return sock.sendMessage(jid, { text: 'Reply to a message with .tag' }, { quoted: msg });
    const text = quoted.conversation || quoted.extendedTextMessage?.text || '[media message]';
    const participants = groupMeta.participants.map((p) => p.id);
    await sock.sendMessage(jid, { text, mentions: participants });
  },
};
