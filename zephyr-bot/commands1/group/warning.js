module.exports = {
  name: 'warnings',
  category: 'Group',
  aliases: ['warncheck'],
  adminOnly: false,
  groupOnly: true,
  description: "Check a user's warn count. Reply/@mention them, or leave blank to check yourself.",
  async run({ sock, msg, jid }) {
    const { getWarnCount } = require('../lib/store');

    const mentioned = msg.message?.extendedTextMessage?.contextInfo?.mentionedJid?.[0];
    const repliedTo = msg.message?.extendedTextMessage?.contextInfo?.participant;
    const target = mentioned || repliedTo || msg.key.participant || msg.key.remoteJid;

    const count = getWarnCount(jid, target);
    await sock.sendMessage(jid, {
      text: `@${target.split('@')[0]} has ${count}/3 warns.`,
      mentions: [target],
    }, { quoted: msg });
  },
};
