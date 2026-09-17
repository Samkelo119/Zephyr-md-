module.exports = {
  name: 'creategc',
  category: 'Group Tools',
  aliases: [],
  adminOnly: true,
  groupOnly: false,
  description: 'Create a new group. Usage: creategc <name> | <number1,number2,...>',
  async run({ sock, msg, jid, args }) {
    const [namePart, numbersPart] = args.join(' ').split('|').map((s) => s?.trim());
    if (!namePart) return sock.sendMessage(jid, { text: 'Usage: .creategc GroupName | 1555xxx,1555yyy' }, { quoted: msg });
    const numbers = (numbersPart || '').split(',').map((n) => n.trim().replace(/[^0-9]/g, '')).filter(Boolean);
    const participants = numbers.map((n) => `${n}@s.whatsapp.net`);
    try {
      const group = await sock.groupCreate(namePart, participants);
      await sock.sendMessage(jid, { text: `✅ Created "${namePart}" with ${participants.length} member(s).` }, { quoted: msg });
    } catch (err) {
      await sock.sendMessage(jid, { text: `❌ Couldn't create the group: ${err.message}` }, { quoted: msg });
    }
  },
};
