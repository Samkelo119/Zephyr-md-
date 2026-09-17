'use strict';

const fs = require('fs');
const path = require('path');

const MORE_COMMANDS_DIR = path.join(__dirname, 'commands1', 'personal', 'more commands');
let handlers;

function loadHandlers() {
    if (handlers) return handlers;
    handlers = [];
    if (!fs.existsSync(MORE_COMMANDS_DIR)) return handlers;

    for (const file of fs.readdirSync(MORE_COMMANDS_DIR).filter(name => name.endsWith('.js'))) {
        try {
            const exported = require(path.join(MORE_COMMANDS_DIR, file));
            const source = fs.readFileSync(path.join(MORE_COMMANDS_DIR, file), 'utf8');
            const commandNames = new Set();
            for (const match of source.matchAll(/\bcase\s+['"]([a-z0-9]+)['"]/gi)) commandNames.add(match[1].toLowerCase());
            for (const match of source.matchAll(/\bcommand\s*===?\s*['"]([a-z0-9]+)['"]/gi)) commandNames.add(match[1].toLowerCase());
            for (const value of Object.values(exported || {})) {
                if (Array.isArray(value)) value.forEach(item => commandNames.add(String(item).toLowerCase()));
            }
            for (const [name, handler] of Object.entries(exported || {})) {
                if (/^handle.+Command$/i.test(name) && typeof handler === 'function') {
                    handlers.push({ file, name, handler, commandNames });
                }
            }
        } catch (error) {
            console.warn(`[more-command] skipped ${file}: ${error.message}`);
        }
    }
    return handlers;
}

async function handleMoreCommands(sock, jid, msg, command, params, sender, senderIsOwner) {
    let handled = false;
    for (const entry of loadHandlers()) {
        try {
            // These handlers use command switches and safely ignore commands they do not own.
            await entry.handler(sock, jid, msg, command, params, sender, senderIsOwner);
            if (entry.commandNames.has(String(command || '').toLowerCase())) handled = true;
        } catch (error) {
            console.error(`[more-command:${entry.file}]`, error);
            if (entry.commandNames.has(String(command || '').toLowerCase())) {
                throw error;
            }
        }
    }
    return handled;
}

function listMoreCommands() {
    return loadHandlers().map(entry => entry.name);
}

module.exports = { handleMoreCommands, listMoreCommands };
