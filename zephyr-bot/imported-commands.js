const fs = require('fs');
const path = require('path');

const IMPORTED_DIR = path.join(__dirname, 'commands1', 'imported');
const ENABLED_COMMANDS = new Set([
    'calc', 'dice', 'fact', 'joke', 'meme', 'quote', 'runtime',
    'shazam', 'img', 'update'
]);

let registry = null;

function loadRegistry() {
    if (registry) return registry;
    registry = new Map();
    if (!fs.existsSync(IMPORTED_DIR)) return registry;

    for (const file of fs.readdirSync(IMPORTED_DIR).filter(name => {
        return name.endsWith('.js') && ENABLED_COMMANDS.has(path.basename(name, '.js').toLowerCase());
    })) {
        try {
            const command = require(path.join(IMPORTED_DIR, file));
            if (!command || typeof command.execute !== 'function' || !command.name) continue;
            const name = String(command.name).toLowerCase();
            if (!ENABLED_COMMANDS.has(name)) continue;
            registry.set(name, command);
            for (const alias of command.aliases || []) registry.set(String(alias).toLowerCase(), command);
        } catch (error) {
            console.warn(`[imported-command] skipped ${file}: ${error.message}`);
        }
    }

    registry.set('update', {
        name: 'update',
        aliases: ['version'],
        description: 'Show the current bot version',
        execute: async (sock, jid, msg) => {
            await sock.sendMessage(jid, {
                text: `✅ ${global.botname} v${global.version}\nThe bot is running the Render-ready command dispatcher.`
            }, { quoted: msg });
        }
    });
    return registry;
}

async function handleImportedCommand(sock, jid, msg, command, params, context = {}) {
    const entry = loadRegistry().get(String(command || '').toLowerCase());
    if (!entry) return false;
    try {
        await entry.execute(sock, jid, msg, params, context);
    } catch (error) {
        console.error(`[imported-command:${entry.name}]`, error);
        await sock.sendMessage(jid, { text: `❌ ${entry.name} command failed. Please try again.` }, { quoted: msg });
    }
    return true;
}

function listImportedCommands() {
    return [...new Set([...loadRegistry().values()].map(command => command.name))].sort();
}

module.exports = { handleImportedCommand, listImportedCommands };
