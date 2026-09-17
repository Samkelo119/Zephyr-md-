const { reply, box, isGroupAdmin } = require('../../../helper');

const GPOPEN_COMMANDS = ['gpopen'];

async function handleGpopenCommand(sock, jid, msg, command, params, sender, senderIsOwner) {
    switch (command) {
        case 'gpopen': {
            if (!jid.endsWith('@g.us')) {
                await reply(sock, jid, msg, box('GPOPEN', 'This command only works inside groups.'));
                break;
            }
            const senderIsAdmin = await isGroupAdmin(sock, jid, sender);
            if (!senderIsOwner && !senderIsAdmin) {
                await reply(sock, jid, msg, box('ACCESS DENIED', 'Only the group admin or bot owner can use this command.'));
                break;
            }
            const mode = (params[0] || '').toLowerCase();
            if (mode === 'on') {
                try {
                    await sock.groupSettingUpdate(jid, 'not_announcement');
                    await reply(sock, jid, msg, box('GPOPEN', 'Gpopen is now ON for this group.\n\nAll members can send messages.'));
                } catch (e) {
                    await reply(sock, jid, msg, box('GPOPEN', 'Failed to open the group.\nMake sure the bot is an admin.'));
                }
            } else if (mode === 'off') {
                try {
                    await sock.groupSettingUpdate(jid, 'announcement');
                    await reply(sock, jid, msg, box('GPOPEN', 'Gpopen is now OFF for this group.\n\nOnly admins can send messages.'));
                } catch (e) {
                    await reply(sock, jid, msg, box('GPOPEN', 'Failed to close the group.\nMake sure the bot is an admin.'));
                }
            } else {
                await reply(sock, jid, msg, box('GPOPEN', 'Usage: gpopen on\nUsage: gpopen off'));
            }
            break;
        }
    }
}

module.exports = {
    handleGpopenCommand,
    GPOPEN_COMMANDS
};

require('fs').watchFile(require.resolve(__filename), { interval: 500 }, () => {
  require('fs').unwatchFile(require.resolve(__filename));
  delete require.cache[require.resolve(__filename)];
  require(__filename);
});
