module.exports = {
  name: 'add',
  category: 'Group Tools',
  aliases: [],
  adminOnly: true,
  groupOnly: true,
  description: 'Add a number to the group. Usage: add 15551234567',
  async run({ sock, msg, jid, args }) {
    const number = (args[0] || '').replace(/[^0-9]/g, '');
    if (!number) return sock.sendMessage(jid, { text: 'Usage: .add <number with country code>' }, { quoted: msg });
    const target = `${number}@s.whatsapp.net`;
    try {
      const result = await sock.groupParticipantsUpdate(jid, [target], 'add');
      const status = result?.[0]?.status;
      if (status === '403') {
        await sock.sendMessage(jid, { text: `Couldn't add directly (privacy settings) — try .linkgc and send them the invite link instead.` }, { quoted: msg });
        return;
      }
      await sock.sendMessage(jid, { text: `✅ Added ${number} to the group.` }, { quoted: msg });
    } catch (err) {
      await sock.sendMessage(jid, { text: `❌ Couldn't add that number: ${err.message}` }, { quoted: msg });
    }
  },
};
