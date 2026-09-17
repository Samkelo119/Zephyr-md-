require('dotenv').config();
const { default: makeWASocket, useMultiFileAuthState } = require('@whiskeysockets/baileys');
const pino = require('pino');
const axios = require('axios');
const ytdl = require('@distube/ytdl-core');

const YT_API_KEY = process.env.YOUTUBE_API_KEY;

async function startBot() {
    const { state, saveCreds } = await useMultiFileAuthState('auth_info');
    
    const sock = makeWASocket({
        auth: state,
        logger: pino({ level: 'silent' }),
        printQRInTerminal: true
    });

    sock.ev.on('creds.update', saveCreds);

    sock.ev.on('messages.upsert', async ({ messages }) => {
        const msg = messages[0];
        if (!msg.message || msg.key.fromMe) return;

        const text = msg.message.conversation || msg.message.extendedTextMessage?.text || '';
        const sender = msg.key.remoteJid;

        if (text.startsWith('.song ')) {
            const query = text.replace('.song ', '').trim();
            if (!query) return sock.sendMessage(sender, { text: 'Usage: .song [song name]' });

            try {
                await sock.sendMessage(sender, { text: `🔎 Searching YouTube for "${query}"...` });

                // 1. Fetch metadata using YouTube Data API v3
                const searchUrl = `https://www.googleapis.com/youtube/v3/search?part=snippet&maxResults=1&q=${encodeURIComponent(query)}&type=video&key=${YT_API_KEY}`;
                const searchRes = await axios.get(searchUrl);
                
                const items = searchRes.data.items;
                if (!items || items.length === 0) {
                    return sock.sendMessage(sender, { text: '❌ No songs found.' });
                }

                const video = items[0];
                const videoId = video.id.videoId;
                const videoUrl = `https://www.youtube.com/watch?v=${videoId}`;
                const title = video.snippet.title;
                const channel = video.snippet.channelTitle;
                const thumbnailUrl = video.snippet.thumbnails.high.url;

                // 2. Send image thumbnail with song details
                const detailsCaption = `🎵 *${title}*\n👤 *Artist/Channel:* ${channel}\n🔗 *Link:* ${videoUrl}\n\n⏳ Downloading full audio...`;
                
                await sock.sendMessage(sender, {
                    image: { url: thumbnailUrl },
                    caption: detailsCaption
                });

                // 3. Download and stream the full audio length
                const audioStream = ytdl(videoUrl, {
                    filter: 'audioonly',
                    quality: 'highestaudio',
                    highWaterMark: 1 << 25 // Buffer expansion to prevent premature cutoff
                });

                const chunks = [];
                for await (const chunk of audioStream) {
                    chunks.push(chunk);
                }
                const audioBuffer = Buffer.concat(chunks);

                // 4. Send complete audio file
                await sock.sendMessage(sender, {
                    audio: audioBuffer,
                    mimetype: 'audio/mp4',
                    fileName: `${title}.mp3`
                }, { quoted: msg });

            } catch (error) {
                console.error('Download Error:', error);
                await sock.sendMessage(sender, { 
                    text: '⚠️ Download failed. Ensure your `YOUTUBE_API_KEY` is active and `@distube/ytdl-core` is up to date.' 
                });
            }
        }
    });
}

startBot();
