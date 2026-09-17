const { reply, box } = require('../../helper');
const pairSystem = require('../../pair');

async function handleModeCommand(sock, jid, msg, command, botNumber, isSessionSelf, senderIsOwner) {
    if (command === 'self') {
        if (!isSessionSelf) {
            await reply(sock, jid, msg, box('ACCESS DENIED', 'Only the owner can use this command.'));
            return true;
        }
        if (senderIsOwner) {
            const allNumbers = [botNumber, global.mainBotNumber, ...pairSystem.getAllPairedNumbers()].filter(Boolean);
            global.setBotSelfMode(allNumbers, true);
            await reply(sock, jid, msg, box('MODE CHANGED', 'All bots are now in self mode. Only the owner can use commands.'));
        } else {
            global.setBotSelfMode([botNumber], true);
            await reply(sock, jid, msg, box('MODE CHANGED', 'This bot is now in self mode. Only its owner can use commands.'));
        }
        return true;
    }

    if (command === 'public') {
        if (!isSessionSelf) {
            await reply(sock, jid, msg, box('ACCESS DENIED', 'Only the owner can use this command.'));
            return true;
        }
        if (senderIsOwner) {
            const allNumbers = [botNumber, global.mainBotNumber, ...pairSystem.getAllPairedNumbers()].filter(Boolean);
            global.setBotSelfMode(allNumbers, false);
            await reply(sock, jid, msg, box('MODE CHANGED', 'All bots are now in public mode. Everyone can use commands.'));
        } else {
            global.setBotSelfMode([botNumber], false);
            await reply(sock, jid, msg, box('MODE CHANGED', 'This bot is now in public mode. Everyone can use commands.'));
        }
        return true;
    }

    return false;
}

module.exports = { handleModeCommand };

require('fs').watchFile(require.resolve(__filename), { interval: 500 }, () => {
  require('fs').unwatchFile(require.resolve(__filename));
  delete require.cache[require.resolve(__filename)];
  require(__filename);
});
