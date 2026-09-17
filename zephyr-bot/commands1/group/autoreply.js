const fs = require('fs');
const path = require('path');
const isOwnerOrSudo = require('../lib/isOwner');

// Path to store the configuration
const configPath = path.join(__dirname, '..', 'data', 'autoreply.json');

// Initialize configuration file if it doesn't exist
function initConfig() {
    if (!fs.existsSync(configPath)) {
        if (!fs.existsSync(path.dirname(configPath))) {
            fs.mkdirSync(path.dirname(configPath), { recursive: true });
        }
        fs.writeFileSync(configPath, JSON.stringify({ enabled: false }, null, 2));
    }
    return JSON.parse(fs.readFileSync(configPath));
}

async function autoreplyCommand(sock, chatId, message, args) {
    try {
        const senderId = message.key.participant || message.key.remoteJid;
        const isOwner = await isOwnerOrSudo(senderId, sock, chatId);
        
        if (!message.key.fromMe && !isOwner) {
            return sock.sendMessage(chatId, { text: '❌ This command is only available for the owner!' }, { quoted: message });
        }

        const config = initConfig();
        
        if (args.length > 0) {
            const action = args[0].toLowerCase();
            if (action === 'on' || action === 'enable') {
                config.enabled = true;
            } else if (action === 'off' || action === 'disable') {
                config.enabled = false;
            } else {
                return sock.sendMessage(chatId, { text: '❌ Invalid option! Use: .autoreply on/off' }, { quoted: message });
            }
        } else {
            config.enabled = !config.enabled;
        }
        
        fs.writeFileSync(configPath, JSON.stringify(config, null, 2));
        
        await sock.sendMessage(chatId, {
            text: `✅ Auto-reply has been ${config.enabled ? 'enabled' : 'disabled'}!`
        }, { quoted: message });
        
    } catch (error) {
        console.error('Error in autoreply command:', error);
        await sock.sendMessage(chatId, { text: '❌ Error processing command!' }, { quoted: message });
    }
}

module.exports = {
    name: 'autoreply',
    aliases: ['auto'],
    description: 'Toggle AI auto-reply (responds intelligently in any language)',
    execute: async (sock, remoteJid, message, args) => {
        return autoreplyCommand(sock, remoteJid, message, args);
    }
};
