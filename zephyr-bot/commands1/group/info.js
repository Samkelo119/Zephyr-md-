const { getSession } = require('../lib/sessionManager');

module.exports = {
  name: 'info',
  category: 'General',
  aliases: ['botinfo'],
  adminOnly: false,
  groupOnly: false,
  description: 'Show bot stats: command count and pairing duration.',
  async run({ sock, msg, jid }) {
    const { byTrigger } = require('./index');
    const uniqueCommands = new Set(byTrigger.values()).size;

    const number = sock.novaSessionNumber;
    const session = number ? getSession(number) : null;

    let pairedFor = 'Unknown';
    if (session?.pairedAt) {
      const ms = Date.now() - session.pairedAt;
      const days = Math.floor(ms / 86400000);
      const hours = Math.floor((ms % 86400000) / 3600000);
      const mins = Math.floor((ms % 3600000) / 60000);
      pairedFor = days > 0 ? `${days}d ${hours}h ${mins}m` : `${hours}h ${mins}m`;
    }

    const text =
      `*Bot Info*\n\n` +
      `Commands available: ${uniqueCommands}\n` +
      `Paired for: ${pairedFor}\n` +
      `Anti-ban: outgoing throttle + flood/backoff protection active`;

    await sock.sendMessage(jid, { text }, { quoted: msg });
  },
};
