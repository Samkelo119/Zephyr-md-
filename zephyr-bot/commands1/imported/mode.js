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
    name: 'mode',
    aliases: ['m'], // Removed 'settings' alias to avoid clash with settings.js
    description: 'Set bot mode (private/public)',
    execute: async (sock, remoteJid, message, args, context) => {
        try {
            const isOwner = context?.isOwner;
            const ownerNumber = context?.ownerNumber || '27621834910';
            
            if (!isOwner) {
                await context.sendResponse(sock, remoteJid, '❌ Only the owner can change the bot mode!', message);
                return;
            }

            const modeType = args[0]?.toLowerCase();

            if (modeType === 'private' || modeType === 'priv') {
                if (!global.botMode) global.botMode = {};
                global.botMode.isPrivate = true;
                saveMode(true);
                
                await context.sendResponse(sock, remoteJid, `🔒 *BOT MODE: PRIVATE*\n\n✅ Bot will now only respond to the owner.\n\nOnly ${ownerNumber} can use commands.`, message);
                
            } else if (modeType === 'public' || modeType === 'pub') {
                if (!global.botMode) global.botMode = {};
                global.botMode.isPrivate = false;
                saveMode(false);
                
                await context.sendResponse(sock, remoteJid, `🌐 *BOT MODE: PUBLIC*\n\n✅ Bot will now respond to everyone.\n\nAll users can use commands.`, message);
                
            } else {
                const currentMode = global.botMode?.isPrivate ? '🔒 PRIVATE' : '🌐 PUBLIC';
                await context.sendResponse(sock, remoteJid, `*BOT MODE SETTINGS*\n\n📝 Usage:\n.mode private - Bot works only for owner\n.mode public - Bot works for everyone\n\n📊 Current Mode: ${currentMode}`, message);
            }
        } catch (err) {
            console.error('Mode command error:', err);
            await context.sendResponse(sock, remoteJid, '❌ Error executing mode command.', message);
        }
    }
};
