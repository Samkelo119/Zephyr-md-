module.exports = {
  name: 'readmore',
  category: 'Utility',
  aliases: [],
  adminOnly: false,
  groupOnly: false,
  description: 'Send a message with a hidden "read more" section. Usage: readmore visible text | hidden text',
  async run({ sock, msg, jid, args }) {
    const [visible = '', hidden = ''] = args.join(' ').split('|').map((s) => s.trim());
    if (!visible) return sock.sendMessage(jid, { text: 'Usage: .readmore visible part | text revealed after tapping "Read more"' }, { quoted: msg });
    // WhatsApp collapses long captions behind "Read more" — padding with
    // invisible characters pushes the hidden part past the visible fold.
    const filler = '\u200e'.repeat(650);
    await sock.sendMessage(jid, { text: `${visible}${filler}\n\n${hidden}` }, { quoted: msg });
  },
};
