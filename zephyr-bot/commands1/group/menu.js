const fs = require('fs');
const path = require('path');

module.exports = {
    name: 'menu',
    aliases: ['help', 'h'],
    description: 'Display all available commands',
    execute: async (sock, remoteJid, message, args, context) => {
        try {
            // Calculate runtime
            const uptime = process.uptime();
            const hours = Math.floor(uptime / 3600);
            const minutes = Math.floor((uptime % 3600) / 60);
            const seconds = Math.floor(uptime % 60);
            const runtimeStr = `${hours}h ${minutes}m ${seconds}s`;

            // Load mode
            const modeFilePath = path.join(__dirname, '../data/mode.json');
            let modeStr = 'Public';
            if (fs.existsSync(modeFilePath)) {
                try {
                    const modeData = JSON.parse(fs.readFileSync(modeFilePath, 'utf8'));
                    modeStr = modeData.isPrivate ? 'Private' : 'Public';
                } catch (e) {}
            }

            // Get all commands dynamically
            const commandLoader = context?.commandLoader;
            let allCommands = [];
            if (commandLoader && typeof commandLoader.getAllCommands === 'function') {
                allCommands = commandLoader.getAllCommands();
            }

            // Categorize commands
            const categories = {
                '🤖 ɢᴇɴᴇʀᴀʟ': ['alive', 'hi', 'menu', 'owner', 'ping', 'runtime', 'time', 'stream', 'freenet'],
                '🎲 ꜰᴜɴ & ʀᴀɴᴅᴏᴍ': ['calc', 'coin', 'compliment', 'dice', 'fact', 'insult', 'joke', 'meme', 'quote', 'sudo'],
                '🤖 ᴀɪ & ꜱᴇᴀʀᴄʜ': ['ai', 'gpt', 'gemini', 'chatbot', 'img', 'translate', 'tts'],
                '🎵 ᴍᴇᴅɪᴀ & ᴅᴏᴡɴʟᴏᴀᴅ': ['audio', 'facebook', 'instagram', 'play', 'shazam', 'song', 'sticker', 'tiktok', 'url', 'vbook', 'video', 'viewonce', 'vv', 'sniff'],
                '👥 ɢʀᴏᴜᴘ ᴍᴀɴᴀɢᴇᴍᴇɴᴛ': ['ban', 'demote', 'groupinfo', 'groupmanage', 'kick', 'mention', 'mute', 'promote', 'resetlink', 'tagall', 'unmute', 'warn', 'warnings'],
                '⚙️ ʙᴏᴛ ꜱᴇᴛᴛɪɴɢꜱ': ['antidelete', 'antilink', 'autoread', 'autostatus', 'mode', 'private', 'public', 'settings', 'autoreply', 'delete', 'update'],
                '🔍 ᴜᴛɪʟɪᴛɪᴇꜱ': ['inspect', 'sniff']
            };

            const cmdToCategory = {};
            for (const [cat, cmds] of Object.entries(categories)) {
                for (const cmd of cmds) {
                    cmdToCategory[cmd] = cat;
                }
            }

            const groupedCommands = {
                '🤖 ɢᴇɴᴇʀᴀʟ': [],
                '🎲 ꜰᴜɴ & ʀᴀɴᴅᴏᴍ': [],
                '🤖 ᴀɪ & ꜱᴇᴀʀᴄʜ': [],
                '🎵 ᴍᴇᴅɪᴀ & ᴅᴏᴡɴʟᴏᴀᴅ': [],
                '👥 ɢʀᴏᴜᴘ ᴍᴀɴᴀɢᴇᴍᴇɴᴛ': [],
                '⚙️ ʙᴏᴛ ꜱᴇᴛᴛɪɴɢꜱ': [],
                '🔍 ᴜᴛɪʟɪᴛɪᴇꜱ': [],
                '📦 ᴏᴛʜᴇʀꜱ': []
            };

            for (const cmd of allCommands) {
                const cat = cmdToCategory[cmd.name] || '📦 ᴏᴛʜᴇʀꜱ';
                if (!groupedCommands[cat].includes(cmd.name)) {
                    groupedCommands[cat].push(cmd.name);
                }
            }

            // Owner Menu Design
            let menuText = `*╭┈───〔 𝗦𝗨𝗦𝗨𝗞𝗜-MD 〕┈───⊷*\n`;
            menuText += `*├✦ Owner:* ᴍʀᴅɪᴇʜᴀʀᴅ ᴛᴇᴄʜ\n`;
            menuText += `*├✦ Commands:* ${allCommands.length}\n`;
            menuText += `*├✦ Runtime:* ${runtimeStr}\n`;
            menuText += `*├✦ Prefix:* *\n`;
            menuText += `*├✦ Mode:* ${modeStr}\n`;
            menuText += `*├✦ Version:* 1.0.4 Bᴇᴛᴀ\n`;
            menuText += `*╰───────────────────⊷*\n\n`;

            for (const [cat, cmds] of Object.entries(groupedCommands)) {
                if (cmds.length > 0) {
                    cmds.sort();
                    menuText += `╔══〔 *${cat}* 〕\n`;
                    menuText += `║ ╟➢ *${cmds.join('\n║ ╟➢ *')}\n`;
                    menuText += `╚══════════════════╝\n\n`;
                }
            }

            const imagePath = path.join(__dirname, '../assets/menu_image.png');
            if (fs.existsSync(imagePath)) {
                const imageBuffer = fs.readFileSync(imagePath);
                await sock.sendMessage(remoteJid, { 
                    image: imageBuffer, 
                    caption: menuText + "> ᴘᴏᴡᴇʀᴇᴅ ʙʏ ᴍʀᴅɪᴇʜᴀʀᴅ ᴛᴇᴄʜX" 
                }, { quoted: message });
            } else {
                await sock.sendMessage(remoteJid, { text: menuText + "> ᴘᴏᴡᴇʀᴇᴅ ʙʏ ᴍʀᴅɪᴇʜᴀʀᴅ ᴛᴇᴄʜX" }, { quoted: message });
            }
        } catch (err) {
            console.error('Menu command error:', err);
        }
    }
};
