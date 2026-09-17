module.exports = {
  name: 'reminder',
  category: 'Misc',
  aliases: ['remind'],
  adminOnly: false,
  groupOnly: false,
  description: 'Set a reminder. Usage: reminder 10m Take the food out',
  async run({ sock, msg, jid, args }) {
    const match = args[0]?.match(/^(\d+)(s|m|h)$/i);
    if (!match) {
      await sock.sendMessage(jid, { text: 'Usage: .reminder 10m Take the food out  (s=seconds, m=minutes, h=hours)' }, { quoted: msg });
      return;
    }
    const [, amountStr, unit] = match;
    const amount = parseInt(amountStr, 10);
    const multiplier = { s: 1000, m: 60_000, h: 3_600_000 }[unit.toLowerCase()];
    const ms = amount * multiplier;

    if (ms > 24 * 3_600_000) {
      await sock.sendMessage(jid, { text: 'Reminders are capped at 24h.' }, { quoted: msg });
      return;
    }

    const note = args.slice(1).join(' ') || 'Reminder!';
    await sock.sendMessage(jid, { text: `⏰ Okay, I'll remind you in ${amountStr}${unit}.` }, { quoted: msg });

    setTimeout(async () => {
      try {
        await sock.sendMessage(jid, { text: `⏰ Reminder: ${note}`, mentions: msg.key.participant ? [msg.key.participant] : [] }, { quoted: msg });
      } catch (err) {
        console.error('[reminder] failed to send:', err.message);
      }
    }, ms);
  },
};
