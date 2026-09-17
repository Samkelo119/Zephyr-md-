const sharp = require('sharp');

function escapeXml(str) {
  return str.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}

module.exports = {
  name: 'carbon',
  category: 'Image',
  aliases: ['codeimg'],
  adminOnly: false,
  groupOnly: false,
  description: 'Turn code into a clean image (rendered locally, no external service). Usage: carbon <code>',
  async run({ sock, msg, jid, args }) {
    const code = args.join(' ').trim();
    if (!code) return sock.sendMessage(jid, { text: 'Usage: .carbon const x = 1;' }, { quoted: msg });

    const lines = code.split('\\n').slice(0, 25);
    const lineHeight = 34;
    const padding = 40;
    const width = 900;
    const height = padding * 2 + lines.length * lineHeight + 40;

    const lineSvgs = lines
      .map((line, i) => `<text x="${padding}" y="${padding + 40 + i * lineHeight}" fill="#e6e6e6" font-family="monospace" font-size="20">${escapeXml(line)}</text>`)
      .join('\n');

    const svg = `
      <svg width="${width}" height="${height}" xmlns="http://www.w3.org/2000/svg">
        <defs>
          <linearGradient id="bg" x1="0%" y1="0%" x2="100%" y2="100%">
            <stop offset="0%" stop-color="#232526"/>
            <stop offset="100%" stop-color="#1c1c1c"/>
          </linearGradient>
        </defs>
        <rect width="100%" height="100%" rx="16" fill="url(#bg)"/>
        <circle cx="30" cy="28" r="7" fill="#ff5f56"/>
        <circle cx="55" cy="28" r="7" fill="#ffbd2e"/>
        <circle cx="80" cy="28" r="7" fill="#27c93f"/>
        ${lineSvgs}
      </svg>`;

    try {
      const png = await sharp(Buffer.from(svg)).png().toBuffer();
      await sock.sendMessage(jid, { image: png }, { quoted: msg });
    } catch (err) {
      await sock.sendMessage(jid, { text: `Couldn't render that: ${err.message}` }, { quoted: msg });
    }
  },
};
