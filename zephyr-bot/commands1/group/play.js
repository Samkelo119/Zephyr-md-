const axios = require('axios');
const yts = require('yt-search');

const AXIOS_DEFAULTS = {
    timeout: 60000,
    headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
        'Accept': 'application/json, text/plain, */*'
    }
};

async function tryRequest(getter, attempts = 3) {
    let lastError;
    for (let attempt = 1; attempt <= attempts; attempt++) {
        try {
            return await getter();
        } catch (err) {
            lastError = err;
            if (attempt < attempts) {
                await new Promise(r => setTimeout(r, 1000 * attempt));
            }
        }
    }
    throw lastError;
}

// EliteProTech API - Primary
async function getEliteProTechDownloadByUrl(youtubeUrl) {
    const apiUrl = `https://eliteprotech-apis.zone.id/ytdown?url=${encodeURIComponent(youtubeUrl)}&format=mp3`;
    const res = await tryRequest(() => axios.get(apiUrl, AXIOS_DEFAULTS));
    if (res?.data?.success && res?.data?.downloadURL) {
        return {
            download: res.data.downloadURL,
            title: res.data.title
        };
    }
    throw new Error('EliteProTech ytdown returned no download');
}

// Yupra API - Fallback 1
async function getYupraDownloadByUrl(youtubeUrl) {
    const apiUrl = `https://api.yupra.my.id/api/downloader/ytmp3?url=${encodeURIComponent(youtubeUrl)}`;
    const res = await tryRequest(() => axios.get(apiUrl, AXIOS_DEFAULTS));
    if (res?.data?.success && res?.data?.data?.download_url) {
        return {
            download: res.data.data.download_url,
            title: res.data.data.title,
            thumbnail: res.data.data.thumbnail
        };
    }
    throw new Error('Yupra returned no download');
}

module.exports = {
    name: 'play',
    aliases: ['p'],
    description: 'Search and download songs from YouTube',
    execute: async (sock, remoteJid, message, args) => {
        try {
            const query = args.join(' ');
            
            if (!query) {
                await sock.sendMessage(remoteJid, { 
                    text: '🎵 *Play Music*\n\nUsage: `.play <song name or YouTube link>`'
                }, { quoted: message });
                return;
            }

            let video;
            if (query.includes('youtube.com') || query.includes('youtu.be')) {
                video = { url: query, title: 'Song' };
            } else {
                await sock.sendMessage(remoteJid, { text: '🔍 Searching for: ' + query }, { quoted: message });
                const search = await yts(query);
                if (!search || !search.videos.length) {
                    await sock.sendMessage(remoteJid, { text: '❌ No results found.' }, { quoted: message });
                    return;
                }
                video = search.videos[0];
            }

            await sock.sendMessage(remoteJid, {
                text: `🎵 *Downloading*\n\n*Title:* ${video.title}\n*Channel:* ${video.author?.name || 'Unknown'}\n\n⏳ Please wait...`
            }, { quoted: message });

            let audioBuffer;
            let downloadSuccess = false;
            const apiMethods = [
                { name: 'EliteProTech', method: () => getEliteProTechDownloadByUrl(video.url) },
                { name: 'Yupra', method: () => getYupraDownloadByUrl(video.url) }
            ];

            for (const apiMethod of apiMethods) {
                try {
                    const audioData = await apiMethod.method();
                    const audioUrl = audioData.download;

                    if (audioUrl) {
                        const audioResponse = await axios.get(audioUrl, {
                            responseType: 'arraybuffer',
                            timeout: 90000
                        });
                        audioBuffer = Buffer.from(audioResponse.data);
                        if (audioBuffer.length > 0) {
                            downloadSuccess = true;
                            break;
                        }
                    }
                } catch (e) {
                    continue;
                }
            }

            if (!downloadSuccess) {
                throw new Error('Failed to download audio.');
            }

            await sock.sendMessage(remoteJid, {
                audio: audioBuffer,
                mimetype: 'audio/mpeg',
                fileName: `${video.title}.mp3`
            }, { quoted: message });

        } catch (err) {
            console.error('Play command error:', err);
            await sock.sendMessage(remoteJid, { text: '❌ Error: ' + err.message }, { quoted: message });
        }
    }
};
