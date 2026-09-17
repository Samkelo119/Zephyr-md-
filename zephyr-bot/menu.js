'use strict';

const config = require('./config');
const pairSystem = require('./pair');
const { handleImportedCommand, listImportedCommands } = require('./imported-commands');
const {
    getMessageText,
    reply,
    replyPairCode,
    box,
    normalizeJidNumber,
    isOwner,
    isSuperOwner,
    isPremium
} = require('./helper');
const { CORE_COMMANDS } = require('./commands1/core/commands');
const { V1_COOL_COMMANDS } = require('./commands1/core/v1-cool-commands');
const { handleGCBasicCommand } = require('./commands1/group/gcbasic');
const { handleModeCommand } = require('./commands1/control/mode');
const { handleOwnersCommand } = require('./commands1/control/owners');
const { handlePremiumsCommand } = require('./commands1/control/premiums');
const { handlePairsCommand } = require('./commands1/control/pairs');
const { handleBotCustomCommand } = require('./commands1/control/botcustom');

const COMMAND_PREFIXES = new Map();
const REGISTRY = new Map();

function register(commands, source) {
    for (const command of commands || []) {
        if (!command?.name || typeof command.execute !== 'function') continue;
        const entry = { ...command, source };
        const names = [command.name, ...(command.aliases || [])];
        for (const name of names) {
            REGISTRY.set(String(name).toLowerCase(), entry);
        }
    }
}

register(CORE_COMMANDS, 'core');
register(V1_COOL_COMMANDS, 'v1');

for (const command of listImportedCommands()) {
    COMMAND_PREFIXES.set(command, 'imported');
}

function allCommandNames() {
    return [...new Set([
        ...REGISTRY.keys(),
        ...COMMAND_PREFIXES.keys(),
        'menu', 'menuall', 'ping', 'me', 'from', 'restart',
        'addpair', 'listpair', 'delpair', 'clearpair',
        'addowner', 'delowner', 'listowner', 'clearowner',
        'addpremium', 'delpremium', 'listpremium', 'clearpremium',
        'self', 'public', 'private'
    ])].sort();
}

function getAvailableCommandCount() {
    return allCommandNames().length;
}

function buildMenuText(prefix, botNumber) {
    const lines = [
        `╭━━━〔 ✦ ${global.botname} ✦ 〕━━━╮`,
        `┃ Bot: +${botNumber}`,
        `┃ Owner: ${config.ownerName}`,
        '┃',
        '┃ GENERAL',
        `┃ › ${prefix}menu`,
        `┃ › ${prefix}ping`,
        `┃ › ${prefix}alive`,
        `┃ › ${prefix}runtime`,
        '┃',
        '┃ GROUP ADMIN',
        `┃ › ${prefix}kick / ${prefix}promote / ${prefix}demote`,
        `┃ › ${prefix}mute / ${prefix}tagall / ${prefix}groupinfo`,
        `┃ › ${prefix}antilink / ${prefix}antitag`,
        '┃',
        '┃ OWNER / BOT',
        `┃ › ${prefix}self / ${prefix}public`,
        `┃ › ${prefix}addowner / ${prefix}listowner`,
        `┃ › ${prefix}addpair / ${prefix}listpair`,
        `┃ › ${prefix}settings / ${prefix}system`,
        '┃',
        `┃ ${getAvailableCommandCount()} commands loaded`,
        '┃ 🟢 WhatsApp channel',
        '┃ https://whatsapp.com/channel/0029Vb8p6DV8aKvNTp6n8n45',
        '╰━━━〔 SMART WHATSAPP ASSISTANT 〕━━━╯'
    ];
    return lines.join('\n');
}

function commandContext({ sender, senderNumber, botNumber, isMainSession, isSessionSelf, senderIsOwner, senderIsPremium }) {
    return {
        isOwner: senderIsOwner,
        isPremium: senderIsPremium,
        sender,
        senderNumber,
        botNumber,
        isMainSession,
        isSessionSelf
    };
}

async function dispatchRegistry(sock, jid, msg, command, params, context) {
    const entry = REGISTRY.get(command);
    if (!entry) return false;
    try {
        await entry.execute(sock, jid, msg, params, context);
    } catch (error) {
        console.error(`[${entry.source}:${entry.name}]`, error);
        await reply(sock, jid, msg, box('COMMAND ERROR', error.message || 'The command failed.'));
    }
    return true;
}

async function handleBuiltIn(sock, jid, msg, command, sender, botNumber, prefix) {
    switch (command) {
        case 'menu':
        case 'menuall':
            await reply(sock, jid, msg, { text: buildMenuText(prefix, botNumber), mentions: [sender] });
            return true;
        case 'ping':
            await reply(sock, jid, msg, { text: `🏓 ${global.botname} online` });
            return true;
        case 'alive':
            await reply(sock, jid, msg, box('ALIVE', `${global.botname} v${global.version}\nBot number: +${botNumber}`));
            return true;
        case 'runtime':
            await reply(sock, jid, msg, box('RUNTIME', `${Math.floor(process.uptime())} seconds`));
            return true;
        case 'me':
            await reply(sock, jid, msg, { text: sock.user?.id || sender });
            return true;
        case 'from':
            await reply(sock, jid, msg, { text: jid });
            return true;
        case 'restart':
            await reply(sock, jid, msg, { text: 'Restarting…' });
            setTimeout(() => process.exit(1), 300);
            return true;
        default:
            return false;
    }
}

async function handleMessage(sock, msg, isMainSession = false) {
    const jid = msg?.key?.remoteJid;
    if (!jid || !msg?.message) return;

    const sender = msg.key.fromMe
        ? sock.user?.id
        : (msg.key.participantAlt || msg.key.remoteJidAlt || msg.key.participant || jid);
    const senderNumber = normalizeJidNumber(sender);
    const botNumber = normalizeJidNumber(sock.user?.id);
    const text = getMessageText(msg).trim();
    if (!text) return;

    const prefix = global.getBotPrefix(botNumber);
    let body = text;
    if (prefix) {
        if (!text.toLowerCase().startsWith(prefix.toLowerCase())) return;
        body = text.slice(prefix.length).trim();
    }
    if (!body) return;

    const args = body.split(/\s+/);
    const command = args.shift().toLowerCase();
    const params = args;
    const senderIsSuperOwner = isSuperOwner(sender)
        || (isMainSession && (msg.key.fromMe || senderNumber === botNumber));
    const senderIsOwner = isOwner(sender) || senderIsSuperOwner || msg.key.fromMe;
    const senderIsPremium = isPremium(sender) || senderIsSuperOwner;
    const senderIsAddedOwner = senderIsOwner && !senderIsSuperOwner;
    const isSessionSelf = senderIsOwner;
    const context = commandContext({
        sender,
        senderNumber,
        botNumber,
        isMainSession,
        isSessionSelf,
        senderIsOwner,
        senderIsPremium
    });

    if (pairSystem.isPendingNumberRequest(jid)) {
        pairSystem.clearPendingNumberRequest(jid);
        const result = await pairSystem.addPair(text, jid, sock, senderNumber, senderIsSuperOwner);
        if (result.error) await reply(sock, jid, msg, box('ADD PAIR', result.error));
        else if (result.code) await replyPairCode(sock, jid, msg, result.number, result.code);
        else await reply(sock, jid, msg, box('ADD PAIR', `Number +${result.number} is already linked.`));
        return;
    }

    if (global.isBotSelfMode(botNumber) && !isSessionSelf) return;

    if (await handleModeCommand(sock, jid, msg, command, botNumber, isSessionSelf, senderIsOwner)) return;
    if (await handleOwnersCommand(sock, jid, msg, command, params, senderNumber, senderIsSuperOwner, senderIsPremium, senderIsAddedOwner)) return;
    if (await handlePremiumsCommand(sock, jid, msg, command, params, senderNumber, senderIsSuperOwner, senderIsPremium)) return;
    if (await handlePairsCommand(sock, jid, msg, command, params, senderNumber, senderIsPremium || senderIsAddedOwner, senderIsSuperOwner)) return;
    if (await handleBotCustomCommand(sock, jid, msg, command, params, botNumber, senderIsOwner || senderIsPremium, senderIsSuperOwner)) return;

    if (await handleBuiltIn(sock, jid, msg, command, sender, botNumber, prefix)) return;
    if (await handleGCBasicCommand(sock, jid, msg, command, params, sender, senderIsOwner)) return;
    if (await dispatchRegistry(sock, jid, msg, command, params, context)) return;
    if (await handleImportedCommand(sock, jid, msg, command, params, context)) return;
}

module.exports = {
    handleMessage,
    getAvailableCommandCount,
    buildMenuText,
    COMMAND_PREFIXES
};
