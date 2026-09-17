module.exports = {
  name: 'jid',
  category: 'Group Tools',
  description: 'Show the WhatsApp JID of this chat (useful for admin/config setup).',
  async run({ sock, jid }) {
    await sock.sendMessage(jid, { text: `Chat JID: ${jid}` });
  },
};