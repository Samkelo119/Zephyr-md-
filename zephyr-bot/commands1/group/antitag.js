const { setAntitag, getAntitag, removeAntitag } = require("../lib/index");
const isAdmin = require("../lib/isAdmin");

async function handleAntitagCommand(sock, chatId, message, args, context) {
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
            const usage = '```ANTITAG SETUP\n\n' + prefix + 'antitag on\n' + prefix + 'antitag off\n```';
            await sock.sendMessage(chatId, { text: usage }, { quoted: message });
            return;
        }

        switch (action) {
            case "on":
                const resultOn = await setAntitag(chatId, true);
                await sock.sendMessage(chatId, {
                    text: resultOn ? '*_Antitag has been turned ON_*' : '*_Failed to turn on Antitag_*'
                }, { quoted: message });
                break;

            case "off":
                await removeAntitag(chatId);
                await sock.sendMessage(chatId, { text: '*_Antitag has been turned OFF_*' }, { quoted: message });
                break;

            case "get":
                const status = await getAntitag(chatId);
                await sock.sendMessage(chatId, {
                    text: `*_Antitag Configuration:_*\nStatus: ${status?.enabled ? 'ON' : 'OFF'}`
                }, { quoted: message });
                break;

            default:
                await sock.sendMessage(chatId, { text: `*_Use ${prefix}antitag for usage._*` }, { quoted: message });
        }
    } catch (error) {
        console.error('Error in antitag command:', error);
        await sock.sendMessage(chatId, { text: '*_Error processing antitag command_*' }, { quoted: message });
    }
}

async function handleTagDetection(sock, chatId, message, userMessage, senderId) {
    const antitagSetting = await getAntitag(chatId);
    if (!antitagSetting?.enabled) return;

    console.log(`Antitag Setting for ${chatId}: ${antitagSetting.enabled}`);
    console.log(`Checking message for tags: ${userMessage}`);

    // Implement tag detection logic here
    // This is a placeholder, actual logic would involve checking for mentions or specific patterns
    const mentionedJidList = message.message?.extendedTextMessage?.contextInfo?.mentionedJid || [];
    const isTagAll = mentionedJidList.length > 10; // Example: consider tagging more than 10 people as tag-all

    if (isTagAll) {
        // If tag-all is detected, take action (e.g., delete message, warn sender)
        const quotedMessageId = message.key.id;
        const quotedParticipant = message.key.participant || senderId;

        try {
            await sock.sendMessage(chatId, {
                delete: { remoteJid: chatId, fromMe: false, id: quotedMessageId, participant: quotedParticipant },
            });
            await sock.sendMessage(chatId, { text: `Warning! @${senderId.split('@')[0]}, tagging all members is not allowed.` }, { mentions: [senderId] });
        } catch (error) {
            console.error('Failed to delete message or warn sender:', error);
        }
    }
}

module.exports = {
    name: 'antitag',
    aliases: ['at'],
    description: 'Manages anti-tag settings for groups.',
    execute: async (sock, remoteJid, message, args, context) => {
        return handleAntitagCommand(sock, remoteJid, message, args, context);
    },
    handleTagDetection,
};
