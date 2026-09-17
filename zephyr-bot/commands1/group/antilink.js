const { setAntilink, getAntilink, removeAntilink } = require("../lib/index");
const isAdmin = require("../lib/isAdmin");
const fs = require('fs');
const path = require('path');

const warningsPath = path.join(process.cwd(), 'data', 'warnings.json');

async function handleAntilinkCommand(sock, chatId, message, args, context) {
    const senderId = message.key.participant || message.key.remoteJid;
    
    try {
        const { isSenderAdmin } = await isAdmin(sock, chatId, senderId);
        if (!isSenderAdmin) {
            await sock.sendMessage(chatId, { text: '```For Group Admins Only!```' }, { quoted: message });
            return;
        }

        const prefix = "."; 
        const action = args[0]?.toLowerCase();

        if (!action) {
            const usage = `\`\`\`ANTILINK SETUP\n\n${prefix}antilink on\n${prefix}antilink set delete | kick | warn\n${prefix}antilink off\n\`\`\``;
            await sock.sendMessage(chatId, { text: usage }, { quoted: message });
            return;
        }

        switch (action) {
            case "on":
                const existingConfigOn = await getAntilink(chatId);
                if (existingConfigOn?.enabled) {
                    await sock.sendMessage(chatId, { text: '*_Antilink is already on_*' }, { quoted: message });
                    return;
                }
                const resultOn = await setAntilink(chatId, 'on', 'delete'); 
                await sock.sendMessage(chatId, {
                    text: resultOn ? '*_Antilink has been turned ON_*' : '*_Failed to turn on Antilink_*'
                }, { quoted: message });
                break;

            case "off":
                await removeAntilink(chatId);
                await sock.sendMessage(chatId, { text: '*_Antilink has been turned OFF_*' }, { quoted: message });
                break;

            case "set":
                if (args.length < 2) {
                    await sock.sendMessage(chatId, {
                        text: `*_Please specify an action: ${prefix}antilink set delete | kick | warn_*`
                    }, { quoted: message });
                    return;
                }
                const setAction = args[1].toLowerCase();
                if (!['delete', 'kick', 'warn'].includes(setAction)) {
                    await sock.sendMessage(chatId, {
                        text: '*_Invalid action. Choose delete, kick, or warn._*'
                    }, { quoted: message });
                    return;
                }
                const setResult = await setAntilink(chatId, 'on', setAction);
                await sock.sendMessage(chatId, {
                    text: setResult ? `*_Antilink action set to ${setAction}_*` : '*_Failed to set Antilink action_*'
                }, { quoted: message });
                break;

            case "get":
                const status = await getAntilink(chatId);
                await sock.sendMessage(chatId, {
                    text: `*_Antilink Configuration:_*\nStatus: ${status?.enabled ? 'ON' : 'OFF'}\nAction: ${status?.action || 'Not set'}`
                }, { quoted: message });
                break;

            default:
                await sock.sendMessage(chatId, { text: `*_Use ${prefix}antilink for usage._*` }, { quoted: message });
        }
    } catch (error) {
        console.error('Error in antilink command:', error);
        await sock.sendMessage(chatId, { text: '*_Error processing antilink command_*' }, { quoted: message });
    }
}

async function handleLinkDetection(sock, chatId, message, userMessage, senderId) {
    if (!chatId.endsWith('@g.us')) return;

    const antilinkSetting = await getAntilink(chatId);
    if (!antilinkSetting?.enabled) return;

    // Check if sender is admin - admins are exempt
    const { isSenderAdmin, isBotAdmin } = await isAdmin(sock, chatId, senderId);
    if (isSenderAdmin) return;

    const linkPatterns = {
        allLinks: /https?:\/\/\S+|www\.\S+|(?:[a-z0-9-]+\.)+[a-z]{2,}(?:\/\S*)?/i,
    };

    if (linkPatterns.allLinks.test(userMessage)) {
        const quotedMessageId = message.key.id;
        const quotedParticipant = message.key.participant || senderId;

        // 1. Always delete the message if possible
        if (isBotAdmin) {
            try {
                await sock.sendMessage(chatId, {
                    delete: { remoteJid: chatId, fromMe: false, id: quotedMessageId, participant: quotedParticipant },
                });
            } catch (error) {
                console.error('Failed to delete link message:', error);
            }
        }

        // 2. Perform the configured action
        switch (antilinkSetting.action) {
            case 'kick':
                if (isBotAdmin) {
                    await sock.groupParticipantsUpdate(chatId, [senderId], 'remove');
                    await sock.sendMessage(chatId, { text: `User @${senderId.split('@')[0]} was kicked for posting links.`, mentions: [senderId] });
                } else {
                    await sock.sendMessage(chatId, { text: '⚠️ I need to be an admin to kick users for posting links.' });
                }
                break;
            case 'warn':
                let warnings = {};
                try {
                    if (fs.existsSync(warningsPath)) {
                        warnings = JSON.parse(fs.readFileSync(warningsPath, 'utf8'));
                    }
                } catch (e) {
                    warnings = {};
                }

                if (!warnings[chatId]) warnings[chatId] = {};
                if (!warnings[chatId][senderId]) warnings[chatId][senderId] = 0;
                
                warnings[chatId][senderId]++;
                fs.writeFileSync(warningsPath, JSON.stringify(warnings, null, 2));

                if (warnings[chatId][senderId] >= 3) {
                    if (isBotAdmin) {
                        await sock.groupParticipantsUpdate(chatId, [senderId], 'remove');
                        delete warnings[chatId][senderId];
                        fs.writeFileSync(warningsPath, JSON.stringify(warnings, null, 2));
                        await sock.sendMessage(chatId, { 
                            text: `User @${senderId.split('@')[0]} has been removed for receiving 3 warnings (reason: posting links).`, 
                            mentions: [senderId] 
                        });
                    } else {
                        await sock.sendMessage(chatId, { text: `User @${senderId.split('@')[0]} has reached 3 warnings for posting links, but I cannot remove them because I am not an admin.`, mentions: [senderId] });
                    }
                } else {
                    await sock.sendMessage(chatId, { 
                        text: `⚠️ @${senderId.split('@')[0]}, posting links is not allowed!\nWarning: ${warnings[chatId][senderId]}/3`, 
                        mentions: [senderId] 
                    });
                }
                break;
            case 'delete':
            default:
                // Message already deleted above if bot is admin
                if (!isBotAdmin) {
                    await sock.sendMessage(chatId, { text: '⚠️ Link detected! I would delete it if I were an admin.' });
                }
                break;
        }
    }
}

module.exports = {
    name: 'antilink',
    aliases: ['al'],
    description: 'Manages anti-link settings for groups.',
    execute: async (sock, remoteJid, message, args, context) => {
        return handleAntilinkCommand(sock, remoteJid, message, args, context);
    },
    handleLinkDetection,
};
