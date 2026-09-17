const { safeBroadcast } = require('../lib/antiban');

module.exports = {
  name: 'broadcast',
  category: 'Owner',
  aliases: ['bc'],
  adminOnly: false,
  ownerOnly: true,
  groupOnly: false,
  description: 'Send a message to every group the bot is in, with safe, randomized delays. Usage: broadcast <message>',
  async run({ sock, msg, jid, args }) {
    const text = args.join(' ').trim();
    if (!text) return sock.sendMessage(jid, { text: 'Usage: .broadcast <message>' }, { quoted: msg });

    const groups = await sock.groupFetchAllParticipating();
    const targets = Object.keys(groups);
    if (!targets.length) {
      await sock.sendMessage(jid, { text: "This number isn't in any groups yet." }, { quoted: msg });
      return;
    }

    await sock.sendMessage(jid, { text: `📣 Broadcasting to ${targets.length} group(s) — this is deliberately slow to keep the account safe.` }, { quoted: msg });

    const result = await safeBroadcast(sock, targets, { text: `📢 *Broadcast*\n\n${text}` });
    await sock.sendMessage(jid, { text: `✅ Broadcast done — sent to ${result.sent}, failed ${result.failed}.` }, { quoted: msg });
  },
};
