// Obviously-fake "hacking" gag for laughs — no real data is touched.
function getTarget(msg, args) {
  const mentioned = msg.message?.extendedTextMessage?.contextInfo?.mentionedJid;
  if (mentioned?.length) return `@${mentioned[0].split('@')[0]}`;
  return args.join(' ') || 'the WiFi router';
}

module.exports = {
  name: 'hack',
  category: 'Fun',
  aliases: [],
  adminOnly: false,
  groupOnly: false,
  description: "Fake 'hacking' bit for laughs — purely a joke, no real access to anything.",
  async run({ sock, msg, jid, args }) {
    const target = getTarget(msg, args);
    const mentions = msg.message?.extendedTextMessage?.contextInfo?.mentionedJid || [];
    const sent = await sock.sendMessage(jid, { text: `💻 Hacking ${target}...\n[▱▱▱▱▱▱▱▱▱▱] 0%`, mentions }, { quoted: msg });
    await new Promise((r) => setTimeout(r, 1200));
    await sock.sendMessage(jid, {
      text: `💻 Hacking ${target}...\n[▰▰▰▰▰▰▰▰▰▰] 100%\n\n😂 Just kidding — nothing here is real, it's a joke command.`,
      edit: sent.key,
    });
  },
};
