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

// Okatsu API - Fallback 2
async function getOkatsuDownloadByUrl(youtubeUrl) {
    const apiUrl = `https://okatsu-rolezapiiz.vercel.app/downloader/ytmp3?url=${encodeURIComponent(youtubeUrl)}`;
    const res = await tryRequest(() => axios.get(apiUrl, AXIOS_DEFAULTS));
    if (res?.data?.dl) {
        return {
            download: res.data.dl,
            title: res.data.title,
            thumbnail: res.data.thumb
        };
    }
    throw new Error('Okatsu ytmp3 returned no download');
}

module.exports = {
    name: 'song',
    aliases: ['music', 'download'],
    description: 'Download songs from YouTube',
    execute: async (sock, remoteJid, message, args) => {
        try {
            const text = message.message?.conversation || message.message?.extendedTextMessage?.text || '';
            
            if (!text || text.trim() === '') {
                await sock.sendMessage(remoteJid, { 
                    text: '🎵 *Song Downloader*\n\nUsage: `.song <song name or YouTube link>`\n\nExample:\n`.song Bohemian Rhapsody`\n`.song https://youtube.com/watch?v=...'
                }, { quoted: message });
                return;
            }

            const query = text.trim();
            let video;

            // Check if it's a YouTube URL
            if (query.includes('youtube.com') || query.includes('youtu.be')) {
                video = { url: query, title: 'Song', thumbnail: '' };
            } else {
                // Search for the song on YouTube
                await sock.sendMessage(remoteJid, { 
                    text: '🔍 Searching for song...' 
                }, { quoted: message });

                const search = await yts(query);
                if (!search || !search.videos.length) {
                    await sock.sendMessage(remoteJid, { 
                        text: '❌ No songs found for: ' + query 
                    }, { quoted: message });
                    return;
                }
                video = search.videos[0];
            }

            // Show download info
            await sock.sendMessage(remoteJid, {
                text: `🎵 *Downloading Song*\n\n*Title:* ${video.title}\n*Duration:* ${video.timestamp || 'Unknown'}\n\n⏳ Please wait...`
            }, { quoted: message });

            // Try multiple APIs with fallback chain
            let audioData;
            let audioBuffer;
            let downloadSuccess = false;

            const apiMethods = [
                { name: 'EliteProTech', method: () => getEliteProTechDownloadByUrl(video.url) },
                { name: 'Yupra', method: () => getYupraDownloadByUrl(video.url) },
                { name: 'Okatsu', method: () => getOkatsuDownloadByUrl(video.url) }
            ];

            // Try each API until successful
            for (const apiMethod of apiMethods) {
                try {
                    console.log(`Trying ${apiMethod.name} API...`);
                    audioData = await apiMethod.method();
                    const audioUrl = audioData.download || audioData.dl || audioData.url;

                    if (!audioUrl) {
                        console.log(`${apiMethod.name} returned no download URL`);
                        continue;
                    }

                    // Download the audio file
                    try {
                        const audioResponse = await axios.get(audioUrl, {
                            responseType: 'arraybuffer',
                            timeout: 90000,
                            maxContentLength: Infinity,
                            maxBodyLength: Infinity,
                            decompress: true,
                            validateStatus: s => s >= 200 && s < 400,
                            headers: {
                                'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
                                'Accept': '*/*',
                                'Accept-Encoding': 'identity'
                            }
                        });

                        audioBuffer = Buffer.from(audioResponse.data);

                        if (audioBuffer && audioBuffer.length > 0) {
                            downloadSuccess = true;
                            console.log(`✅ Successfully downloaded from ${apiMethod.name}`);
                            break;
                        }
                    } catch (downloadErr) {
                        const statusCode = downloadErr.response?.status || downloadErr.status;
                        if (statusCode === 451) {
                            console.log(`Download blocked (451) from ${apiMethod.name}`);
                        } else {
                            console.log(`Download failed from ${apiMethod.name}: ${downloadErr.message}`);
                        }
                        continue;
                    }
                } catch (apiErr) {
                    console.log(`${apiMethod.name} API failed: ${apiErr.message}`);
                    continue;
                }
            }

            if (!downloadSuccess || !audioBuffer) {
                throw new Error('All download sources failed. The song may be unavailable or blocked in your region.');
            }

            // Validate buffer
            if (!audioBuffer || audioBuffer.length === 0) {
                throw new Error('Downloaded audio buffer is empty');
            }

            // Send the audio file
            const fileName = (audioData.title || video.title || 'song').replace(/[^\w\s-]/g, '').substring(0, 50);
            
            await sock.sendMessage(remoteJid, {
                audio: audioBuffer,
                mimetype: 'audio/mpeg',
                fileName: `${fileName}.mp3`,
                ptt: false
            }, { quoted: message });

        } catch (err) {
            console.error('Song command error:', err);

            let errorMessage = '❌ Failed to download song.';
            
            if (err.message && err.message.includes('blocked')) {
                errorMessage = '❌ Download blocked. The content may be unavailable in your region.';
            } else if (err.message && err.message.includes('All download sources failed')) {
                errorMessage = '❌ All download sources failed. The song may be unavailable or blocked.';
            } else if (err.message && err.message.includes('No songs found')) {
                errorMessage = '❌ No songs found. Try a different search term.';
            }

            await sock.sendMessage(remoteJid, { 
                text: errorMessage 
            }, { quoted: message });
        }
    }
};
