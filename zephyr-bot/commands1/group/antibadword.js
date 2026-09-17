const { setAntiBadword, getAntiBadword, removeAntiBadword } = require("../lib/antibadword");
const isAdmin = require("../lib/isAdmin");

async function handleAntiBadwordCommand(sock, chatId, message, args, context) {
    const senderId = message.key.participant || message.key.remoteJid;
    const isSenderAdmin = await isAdmin(sock, chatId, senderId);

    try {
        if (!isSenderAdmin) {
            await sock.sendMessage(chatId, { text: '```For Group Admins Only!```' }, { quoted: message });
            return;
        }

        const prefix = "."; // Assuming prefix is "."
        const action = args[0]?.toLowerCase();

        if (!action) {
            const usage = '```ANTIBADWORD SETUP\n\n' + prefix + 'antibadword on\n' + prefix + 'antibadword off\n```';
            await sock.sendMessage(chatId, { text: usage }, { quoted: message });
            return;
        }

        switch (action) {
            case "on":
                const resultOn = await setAntiBadword(chatId, true);
                await sock.sendMessage(chatId, {
                    text: resultOn ? '*_AntiBadword has been turned ON_*' : '*_Failed to turn on AntiBadword_*'
                }, { quoted: message });
                break;

            case "off":
                await removeAntiBadword(chatId);
                await sock.sendMessage(chatId, { text: '*_AntiBadword has been turned OFF_*' }, { quoted: message });
                break;

            case "get":
                const status = await getAntiBadword(chatId);
                await sock.sendMessage(chatId, {
                    text: `*_AntiBadword Configuration:_*\nStatus: ${status?.enabled ? 'ON' : 'OFF'}`
                }, { quoted: message });
                break;

            default:
                await sock.sendMessage(chatId, { text: `*_Use ${prefix}antibadword for usage._*` }, { quoted: message });
        }
    } catch (error) {
        console.error('Error in antibadword command:', error);
        await sock.sendMessage(chatId, { text: '*_Error processing antibadword command_*' }, { quoted: message });
    }
}

module.exports = {
    name: 'antibadword',
    aliases: ['abw'],
    description: 'Manages anti-badword settings for groups.',
    execute: async (sock, remoteJid, message, args, context) => {
        return handleAntiBadwordCommand(sock, remoteJid, message, args, context);
    },
};
