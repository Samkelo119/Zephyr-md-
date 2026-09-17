const { deleteMessage } = require("../lib/lightweight_store");
const isAdmin = require("../lib/isAdmin");

async function deleteCommand(sock, chatId, message, args, context) {
    const senderId = message.key.participant || message.key.remoteJid;
    const { isSenderAdmin, isBotAdmin } = await isAdmin(sock, chatId, senderId);
    const isOwner = context?.isOwner || false;

    try {
        // Only admins or owner can use this in groups
        if (chatId.endsWith('@g.us') && !isSenderAdmin && !isOwner) {
            await sock.sendMessage(chatId, { text: '```For Group Admins or Owner Only!```' }, { quoted: message });
            return;
        }

        const contextInfo = message.message?.extendedTextMessage?.contextInfo;
        const quotedMessageId = contextInfo?.stanzaId;
        const quotedParticipant = contextInfo?.participant;

        if (quotedMessageId) {
            // In groups, bot needs to be admin to delete other people's messages
            if (chatId.endsWith('@g.us') && quotedParticipant !== (sock.user.id.split(':')[0] + '@s.whatsapp.net') && !isBotAdmin) {
                await sock.sendMessage(chatId, { text: '❌ I need to be an admin to delete other people\'s messages.' }, { quoted: message });
                return;
            }

            try {
                await sock.sendMessage(chatId, {
                    delete: { 
                        remoteJid: chatId, 
                        fromMe: quotedParticipant === (sock.user.id.split(':')[0] + '@s.whatsapp.net'), 
                        id: quotedMessageId, 
                        participant: quotedParticipant 
                    },
                });
                
                // Optional: clean up store if it exists
                if (typeof deleteMessage === 'function') {
                    deleteMessage(chatId, quotedMessageId);
                }
            } catch (error) {
                console.error('Failed to delete message:', error);
                await sock.sendMessage(chatId, { text: '❌ Failed to delete the quoted message. It might be too old or I don\'t have permission.' }, { quoted: message });
            }
        } else {
            await sock.sendMessage(chatId, { text: '❌ Please reply to the message you want to delete.' }, { quoted: message });
        }

    } catch (error) {
        console.error('Error in delete command:', error);
        await sock.sendMessage(chatId, { text: '*_Error processing delete command_*' }, { quoted: message });
    }
}

module.exports = {
    name: 'delete',
    aliases: ['del'],
    description: 'Deletes a quoted message.',
    execute: async (sock, remoteJid, message, args, context) => {
        return deleteCommand(sock, remoteJid, message, args, context);
    },
};
