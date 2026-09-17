const axios = require('axios');

module.exports = {
  name: 'imagine',
  category: 'AI',
  aliases: ['flux', 'pollinations', 'aiimage'],
  adminOnly: false,
  groupOnly: false,
  description: 'Generate an AI image from a text prompt (free, no API key). Usage: imagine <prompt>',
  async run({ sock, msg, jid, args }) {
    const prompt = args.join(' ').trim();
    if (!prompt) return sock.sendMessage(jid, { text: 'Usage: .imagine a cat riding a skateboard' }, { quoted: msg });
    try {
      const seed = Math.floor(Math.random() * 1_000_000);
      const url = `https://image.pollinations.ai/prompt/${encodeURIComponent(prompt)}?width=768&height=768&seed=${seed}&nologo=true`;
      const { data } = await axios.get(url, { responseType: 'arraybuffer', timeout: 45000 });
      await sock.sendMessage(jid, { image: Buffer.from(data), caption: `🎨 ${prompt}` }, { quoted: msg });
    } catch (err) {
      await sock.sendMessage(jid, { text: `❌ Image generation failed: ${err.message}` }, { quoted: msg });
    }
  },
};
