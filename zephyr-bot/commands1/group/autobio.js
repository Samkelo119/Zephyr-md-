let intervalHandle = null;

module.exports = {
  name: 'autobio',
  category: 'Owner',
  aliases: [],
  adminOnly: true,
  groupOnly: false,
  description: "Rotate the bot's WhatsApp 'About' text on a timer. Usage: autobio on|off",
  async run({ sock, msg, jid, args }) {
    const setting = (args[0] || '').toLowerCase();

    if (setting === 'off') {
      if (intervalHandle) clearInterval(intervalHandle);
      intervalHandle = null;
      await sock.sendMessage(jid, { text: '✅ Autobio turned OFF.' }, { quoted: msg });
      return;
    }

    if (setting === 'on') {
      if (intervalHandle) clearInterval(intervalHandle);
      const update = async () => {
        try {
          const uptime = Math.floor(process.uptime() / 60);
          await sock.updateProfileStatus(`🤖 Online — ${uptime}m uptime`);
        } catch (err) {
          console.error('[autobio] update failed:', err.message);
        }
      };
      await update();
      // Every 30 minutes, not more often — frequent profile-field churn is
      // itself an automation signal, so this stays deliberately infrequent.
      intervalHandle = setInterval(update, 30 * 60 * 1000);
      await sock.sendMessage(jid, { text: '✅ Autobio turned ON (updates every 30 min).' }, { quoted: msg });
      return;
    }

    await sock.sendMessage(jid, { text: `Autobio is currently *${intervalHandle ? 'ON' : 'OFF'}*.\nUsage: autobio on|off` }, { quoted: msg });
  },
};
