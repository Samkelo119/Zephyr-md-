module.exports = {
  name: 'speed',
  category: 'Owner',
  aliases: [],
  adminOnly: false,
  groupOnly: false,
  description: "Measure the bot's round-trip response speed.",
  async run({ sock, msg, jid }) {
    const start = Date.now();
    const sent = await sock.sendMessage(jid, { text: '📶 Measuring...' }, { quoted: msg });
    const ms = Date.now() - start;
    await sock.sendMessage(jid, { text: `📶 Response speed: ${ms}ms`, edit: sent.key });
  },
};
