const { getContact } = require("../lib/index");
const isAdmin = require("../lib/isAdmin");

module.exports = {
    name: "block",
    aliases: ["b", "blockuser"],
    description: "Blocks a user.",
    execute: async (sock, chatId, message, args, context) => {
        const senderId = message.key.participant || message.key.remoteJid;
        const isGroup = chatId.endsWith("@g.us");

        // Only group admins or sudo users can use this command
        if (isGroup) {
            const { isSenderAdmin } = await isAdmin(sock, chatId, senderId);
            if (!isSenderAdmin) {
                await sock.sendMessage(chatId, { text: "Only group admins can use this command." }, { quoted: message });
                return;
            }
        } else {
            // For private chat, only sudo can use it
            // Assuming isSudo is available in context or imported
            // const isSudoUser = await isSudo(senderId);
            // if (!isSudoUser) {
            //     await sock.sendMessage(chatId, { text: "Only sudo users can use this command in private chat." }, { quoted: message });
            //     return;
            // }
        }

        let userToBlockJid;

        // Check for mentioned users
        if (message.message?.extendedTextMessage?.contextInfo?.mentionedJid?.length > 0) {
            userToBlockJid = message.message.extendedTextMessage.contextInfo.mentionedJid[0];
        }
        // Check for replied message
        else if (message.message?.extendedTextMessage?.contextInfo?.participant) {
            userToBlockJid = message.message.extendedTextMessage.contextInfo.participant;
        }

        if (!userToBlockJid) {
            await sock.sendMessage(chatId, { text: "Please mention the user or reply to their message to block!" }, { quoted: message });
            return;
        }

        // Prevent blocking the bot itself
        const botJid = sock.user.id.split(":")[0] + "@s.whatsapp.net";
        if (userToBlockJid === botJid) {
            await sock.sendMessage(chatId, { text: "You cannot block the bot account." }, { quoted: message });
            return;
        }

        try {
            await sock.updateBlockStatus(userToBlockJid, "block");
            await sock.sendMessage(chatId, { text: `Successfully blocked @${userToBlockJid.split("@")[0]}!`, mentions: [userToBlockJid] }, { quoted: message });
        } catch (error) {
            console.error("Error in block command:", error);
            await sock.sendMessage(chatId, { text: "Failed to block user." }, { quoted: message });
        }
    },
};
