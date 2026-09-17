async function blockCommand(msg) {
    try {
        let userToBlock;

        // Check for mentioned users
        const mentions = await msg.getMentions();
        if (mentions.length > 0) {
            userToBlock = mentions[0];
        } 
        // Check for replied message
        else if (msg.hasQuotedMsg) {
            const quotedMsg = await msg.getQuotedMessage();
            userToBlock = await quotedMsg.getContact();
        }

        if (!userToBlock) {
            await msg.reply('❌ Please mention a user or reply to their message to block them.');
            return;
        }

        // Prevent blocking yourself
        const me = await msg.client.getContactById(msg.client.info.wid._serialized);
        if (userToBlock.id._serialized === me.id._serialized) {
            await msg.reply('❌ You cannot block yourself.');
            return;
        }

        await userToBlock.block();
        await msg.reply(`✅ Successfully blocked @${userToBlock.id.user}`, {
            mentions: [userToBlock]
        });

    } catch (error) {
        console.error('Error in block command:', error);
        await msg.reply('❌ Failed to block user.');
    }
}

module.exports = blockCommand;
