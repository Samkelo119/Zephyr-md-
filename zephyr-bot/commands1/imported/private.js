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
    name: 'private',
    aliases: ['priv'],
    description: 'Set bot to private mode',
    execute: async (sock, remoteJid, message, args, context) => {
        try {
            if (!context || !context.isOwner) {
                await context.sendResponse(sock, remoteJid, '❌ Only the owner can use this command!', message);
                return;
            }

            if (!global.botMode) global.botMode = {};
            global.botMode.isPrivate = true;
            saveMode(true);
            
            await context.sendResponse(sock, remoteJid, `🔒 *BOT MODE: PRIVATE*\n\n✅ Bot will now only respond to the owner.\n\nOnly ${context.ownerNumber || 'owner'} can use commands.`, message);
        } catch (err) {
            console.error('private command error:', err);
            await context.sendResponse(sock, remoteJid, '❌ Error executing private command.', message);
        }
    }
};
