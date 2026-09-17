module.exports = {
  name: 'join',
  category: 'Group Tools',
  aliases: [],
  adminOnly: true,
  groupOnly: false,
  description: 'Join a group via invite link. Usage: join <invite link>',
  async run({ sock, msg, jid, args }) {
    const link = args[0];
    const code = link?.match(/chat\.whatsapp\.com\/([A-Za-z0-9]+)/)?.[1];
    if (!code) return sock.sendMessage(jid, { text: 'Usage: .join https://chat.whatsapp.com/xxxxx' }, { quoted: msg });
    try {
      await sock.groupAcceptInvite(code);
      await sock.sendMessage(jid, { text: '✅ Joined the group.' }, { quoted: msg });
    } catch (err) {
      await sock.sendMessage(jid, { text: `❌ Couldn't join: ${err.message}` }, { quoted: msg });
    }
  },
};
