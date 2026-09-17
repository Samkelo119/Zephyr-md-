const afkUsers = new Map(); // jid -> { reason, since }

function getStore() { return afkUsers; }

module.exports = {
  name: 'afk',
  category: 'Misc',
  aliases: [],
  adminOnly: false,
  groupOnly: false,
  description: 'Mark yourself AFK. Anyone who mentions you gets notified. Usage: afk [reason]',
  _store: afkUsers,
  async run({ sock, msg, jid }) {
    const sender = msg.key.participant || msg.key.remoteJid;
    const reason = 'away';
    afkUsers.set(sender, { reason, since: Date.now() });
    await sock.sendMessage(jid, { text: `💤 You're now AFK.` }, { quoted: msg });
  },
};

module.exports.getStore = getStore;
