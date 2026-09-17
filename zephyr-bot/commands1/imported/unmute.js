async function unmuteCommand(sock, chatId) {
    await sock.groupSettingUpdate(chatId, 'not_announcement'); // Unmute the group
    await sock.sendMessage(chatId, { text: 'The group has been unmuted.' });
}

module.exports = {
    name: 'unmute',
    aliases: ['unsilence'],
    description: 'Unmute the group (allow all members to send messages)',
    execute: async (sock, remoteJid, message, args) => {
        return unmuteCommand(sock, remoteJid);
    }
};
