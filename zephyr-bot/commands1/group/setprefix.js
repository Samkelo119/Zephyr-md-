const { getPrefixes, setPrefixes, resetPrefixes, getDefaultPrefixes } = require('../lib/prefixState');

module.exports = {
  name: 'setprefix',
  category: 'Owner',
  aliases: [],
  adminOnly: false,
  ownerOnly: true,
  groupOnly: false,
  description: 'Change the command prefix(es) for THIS chat only. Usage: setprefix .,!,⚡ (or "setprefix reset")',
  async run({ sock, msg, jid, args }) {
    const input = args.join(' ').trim();

    if (!input) {
      await sock.sendMessage(jid, {
        text: `Current prefixes here: ${getPrefixes(jid).join(' ')}\nUsage: .setprefix .,!,⚡\n.setprefix reset — go back to the default (${getDefaultPrefixes().join(' ')})`,
      }, { quoted: msg });
      return;
    }

    if (input.toLowerCase() === 'reset') {
      resetPrefixes(jid);
      await sock.sendMessage(jid, {
        text: `✅ Prefix reset to the default here: ${getDefaultPrefixes().join(' ')}`,
      }, { quoted: msg });
      return;
    }

    const list = input.split(',').map((p) => p.trim()).filter(Boolean);
    if (!list.length) return sock.sendMessage(jid, { text: 'Give at least one prefix.' }, { quoted: msg });

    setPrefixes(list, jid);
    await sock.sendMessage(jid, {
      text: `✅ Prefixes updated to: ${list.join(' ')}\n\nThis only affects this chat — everyone else keeps their own prefix. It also resets on restart.`,
    }, { quoted: msg });
  },
};
