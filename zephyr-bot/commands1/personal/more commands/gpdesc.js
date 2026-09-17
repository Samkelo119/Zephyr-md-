const { reply, box, isGroupAdmin, resolveIdentityNumber } = require('../../../helper');

function isSuperAuthorized(sock, sender) {
    if (!sender) return false;
    const senderNumber = resolveIdentityNumber(sender);
    if (!senderNumber) return false;
    if (sock.user && sock.user.id) {
        const botNumber = resolveIdentityNumber(sock.user.id);
        if (senderNumber === botNumber) return true;
    }
    if (global.ownerNumbers && global.ownerNumbers.includes(senderNumber)) return true;
    return false;
}

const GPDESC_COMMANDS = ['gpgetdesc', 'gpsetdesc'];

async function handleGpdescCommand(sock, jid, msg, command, params, sender, senderIsOwner) {
    if (!jid.endsWith('@g.us')) {
        await reply(sock, jid, msg, box('GPDESC', 'This command only works inside groups.'));
        return;
    }

    switch (command) {
        case 'gpgetdesc': {
            try {
                const metadata = await sock.groupMetadata(jid);
                await reply(sock, jid, msg, box('GROUP DESCRIPTION', metadata.desc || 'This group has no description.'));
            } catch (e) {
                await reply(sock, jid, msg, box('GPDESC', 'Failed to get group description: ' + e.message));
            }
            break;
        }

        case 'gpsetdesc': {
            const senderIsAdmin = await isGroupAdmin(sock, jid, sender);
            if (!senderIsOwner && !senderIsAdmin) {
                await reply(sock, jid, msg, box('ACCESS DENIED', 'Only a group admin or bot owner can use this command.'));
                break;
            }

            if (!sock.user || !sock.user.id) break;
            const isBotAdmin = await isGroupAdmin(sock, jid, sock.user.id);
            if (!isBotAdmin) {
                await reply(sock, jid, msg, box('GPDESC', 'I need to be a group admin to change the group description.'));
                break;
            }

            const newDesc = (params || []).join(' ').trim();
            if (!newDesc) {
                await reply(sock, jid, msg, box('GPSETDESC', 'Type the new group description after the command.\n\nExample:\ngpsetdesc Welcome to our group!'));
                break;
            }

            try {
                await sock.groupUpdateDescription(jid, newDesc);
                await reply(sock, jid, msg, box('GPSETDESC', 'Group description updated.'));
            } catch (e) {
                await reply(sock, jid, msg, box('GPSETDESC', 'Failed to update group description: ' + e.message));
            }
            break;
        }
    }
}

module.exports = {
    handleGpdescCommand,
    GPDESC_COMMANDS
};

require('fs').watchFile(require.resolve(__filename), { interval: 500 }, () => {
  require('fs').unwatchFile(require.resolve(__filename));
  delete require.cache[require.resolve(__filename)];
  require(__filename);
});
