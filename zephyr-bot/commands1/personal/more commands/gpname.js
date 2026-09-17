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

const GPNAME_COMMANDS = ['gpgetname', 'gpsetname'];

async function handleGpnameCommand(sock, jid, msg, command, params, sender, senderIsOwner) {
    if (!jid.endsWith('@g.us')) {
        await reply(sock, jid, msg, box('GPNAME', 'This command only works inside groups.'));
        return;
    }

    switch (command) {
        case 'gpgetname': {
            try {
                const metadata = await sock.groupMetadata(jid);
                await reply(sock, jid, msg, box('GROUP NAME', metadata.subject || 'This group has no name.'));
            } catch (e) {
                await reply(sock, jid, msg, box('GPNAME', 'Failed to get group name: ' + e.message));
            }
            break;
        }

        case 'gpsetname': {
            const senderIsAdmin = await isGroupAdmin(sock, jid, sender);
            if (!senderIsOwner && !senderIsAdmin) {
                await reply(sock, jid, msg, box('ACCESS DENIED', 'Only a group admin or bot owner can use this command.'));
                break;
            }

            if (!sock.user || !sock.user.id) break;
            const isBotAdmin = await isGroupAdmin(sock, jid, sock.user.id);
            if (!isBotAdmin) {
                await reply(sock, jid, msg, box('GPNAME', 'I need to be a group admin to change the group name.'));
                break;
            }

            const newName = (params || []).join(' ').trim();
            if (!newName) {
                await reply(sock, jid, msg, box('GPSETNAME', 'Type the new group name after the command.\n\nExample:\ngpsetname My New Group Name'));
                break;
            }

            try {
                await sock.groupUpdateSubject(jid, newName);
                await reply(sock, jid, msg, box('GPSETNAME', 'Group name updated to: ' + newName));
            } catch (e) {
                await reply(sock, jid, msg, box('GPSETNAME', 'Failed to update group name: ' + e.message));
            }
            break;
        }
    }
}

module.exports = {
    handleGpnameCommand,
    GPNAME_COMMANDS
};

require('fs').watchFile(require.resolve(__filename), { interval: 500 }, () => {
  require('fs').unwatchFile(require.resolve(__filename));
  delete require.cache[require.resolve(__filename)];
  require(__filename);
});
