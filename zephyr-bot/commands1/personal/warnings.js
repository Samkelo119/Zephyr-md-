const fs = require('fs');
const path = require('path');

const warningsFilePath = path.join(__dirname, '../data/warnings.json');

function loadWarnings() {
    if (!fs.existsSync(warningsFilePath)) {
        fs.writeFileSync(warningsFilePath, JSON.stringify({}), 'utf8');
    }
    const data = fs.readFileSync(warningsFilePath, 'utf8');
    return JSON.parse(data);
}

async function warningsCommand(sock, chatId, mentionedJidList) {
    const warnings = loadWarnings();

    if (mentionedJidList.length === 0) {
        await sock.sendMessage(chatId, { text: 'Please mention a user to check warnings.' });
        return;
    }

    const userToCheck = mentionedJidList[0];
    const warningCount = warnings[userToCheck] || 0;

    await sock.sendMessage(chatId, { text: `User has ${warningCount} warning(s).` });
}

module.exports = {
    name: 'warnings',
    aliases: ['checkwarn', 'warnlist'],
    description: 'Check warning count for a group member',
    execute: async (sock, remoteJid, message, args) => {
        const mentionedJids = message.message?.extendedTextMessage?.contextInfo?.mentionedJid || [];
        return warningsCommand(sock, remoteJid, mentionedJids);
    }
};
