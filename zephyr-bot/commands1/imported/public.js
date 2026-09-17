const fs = require('fs');
const path = require('path');

const modeFilePath = path.join(__dirname, '..', 'data', 'mode.json');

function saveMode(isPrivate) {
    try {
        if (!fs.existsSync(path.dirname(modeFilePath))) {
            fs.mkdirSync(path.dirname(modeFilePath), { recursive: true });
        }
        fs.writeFileSync(modeFilePath, JSON.stringify({ isPrivate }));
    } catch (e) {
        console.error('Error saving mode:', e);
    }
}

module.exports = {
    name: 'public',
    aliases: ['pub'],
    description: 'Set bot to public mode',
    execute: async (sock, remoteJid, message, args, context) => {
        try {
            if (!context || !context.isOwner) {
                await context.sendResponse(sock, remoteJid, '❌ Only the owner can use this command!', message);
                return;
            }

            if (!global.botMode) global.botMode = {};
            global.botMode.isPrivate = false;
            saveMode(false);
            
            await context.sendResponse(sock, remoteJid, `🌐 *BOT MODE: PUBLIC*\n\n✅ Bot will now respond to everyone.\n\nAll users can use commands.`, message);
        } catch (err) {
            console.error('public command error:', err);
            await context.sendResponse(sock, remoteJid, '❌ Error executing public command.', message);
        }
    }
};
