const fs = require('fs');
const os = require('os');
const path = require('path');

module.exports = {
  name: 'cleartmp',
  category: 'Owner',
  aliases: [],
  adminOnly: true,
  groupOnly: false,
  description: "Clear this bot's temporary files from the system tmp directory.",
  async run({ sock, msg, jid }) {
    const tmpDir = os.tmpdir();
    let removed = 0;
    try {
      for (const file of fs.readdirSync(tmpDir)) {
        if (file.startsWith('wa-audio-') || file.startsWith('wa-tmp-')) {
          fs.rmSync(path.join(tmpDir, file), { force: true });
          removed += 1;
        }
      }
      await sock.sendMessage(jid, { text: `🧹 Cleared ${removed} temp file(s).` }, { quoted: msg });
    } catch (err) {
      await sock.sendMessage(jid, { text: `❌ Cleanup failed: ${err.message}` }, { quoted: msg });
    }
  },
};
