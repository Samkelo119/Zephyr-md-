module.exports = {
  name: 'antibanstatus',
  category: 'Owner',
  aliases: ['abstatus'],
  adminOnly: true,
  groupOnly: false,
  description: 'Show current anti-ban engine stats (send caps, queue depth, breaker state).',
  async run({ sock, msg, jid }) {
    const stats = sock.antiBanStats?.();
    if (!stats) return sock.sendMessage(jid, { text: 'Anti-ban stats unavailable.' }, { quoted: msg });
    const text =
      `🛡️ *Anti-Ban Status*\n\n` +
      `Queued: ${stats.queued}\n` +
      `Sent last minute: ${stats.sentLastMinute}/20\n` +
      `Sent last hour: ${stats.sentLastHour}/300\n` +
      `Sent last day: ${stats.sentLastDay}/1500\n` +
      `Night mode: ${stats.nightMode ? '🌙 active (slower)' : 'off'}\n` +
      `Circuit breaker: ${stats.breakerOpen ? `🔴 OPEN — resumes in ${Math.ceil(stats.breakerCooldownRemainingMs / 1000)}s` : '🟢 closed'}\n` +
      `Consecutive failures: ${stats.consecutiveFailures}`;
    await sock.sendMessage(jid, { text }, { quoted: msg });
  },
};
