module.exports = {
  name: 'poll',
  category: 'Group Tools',
  aliases: ['vote'],
  adminOnly: false,
  groupOnly: true,
  description: 'Create a poll. Usage: poll "Question" "Option 1" "Option 2" ...',
  async run({ sock, msg, jid, args }) {
    const raw = args.join(' ');
    const parts = raw.match(/"([^"]+)"/g)?.map((s) => s.slice(1, -1)) || [];
    if (parts.length < 3) {
      await sock.sendMessage(jid, { text: 'Usage: .poll "Question" "Option 1" "Option 2" ["Option 3" ...]' }, { quoted: msg });
      return;
    }
    const [name, ...values] = parts;
    await sock.sendMessage(jid, {
      poll: { name, values, selectableCount: 1 },
    }, { quoted: msg });
  },
};
