const { exec } = require('child_process');
const path = require('path');
const fs = require('fs');

module.exports = {
    name: "update",
    aliases: ["upd"],
    description: "Update the bot and restart the session.",
    execute: async (sock, chatId, message, args, { isOwner }) => {
        try {
            if (!isOwner) {
                return sock.sendMessage(chatId, { text: "❌ This command is only for the owner." }, { quoted: message });
            }

            await sock.sendMessage(chatId, { text: "🔄 Checking for updates..." }, { quoted: message });

            // Check if it's a git repo
            const isGit = fs.existsSync(path.join(__dirname, '..', '.git'));

            if (!isGit) {
                await sock.sendMessage(chatId, { text: "⚠️ This bot was not installed via Git. I will restart the session for you, but I cannot pull new code automatically.\n\n🔄 Restarting..." }, { quoted: message });
                
                setTimeout(() => {
                    process.exit(0);
                }, 2000);
                return;
            }

            // Fetch and pull changes
            exec('git pull', async (err, stdout, stderr) => {
                if (err) {
                    console.error('Git pull error:', err);
                    return sock.sendMessage(chatId, { text: `❌ Update failed: ${err.message}\n\nMake sure you have git installed and the repository is properly configured.` }, { quoted: message });
                }

                if (stdout.includes('Already up to date')) {
                    await sock.sendMessage(chatId, { text: "✅ The bot is already up to date. Restarting session to ensure everything is fresh..." }, { quoted: message });
                } else {
                    await sock.sendMessage(chatId, { text: `✅ Update successful!\n\n*Changes:*\n${stdout}\n\n🔄 Restarting session...` }, { quoted: message });
                }

                // Restart the process
                setTimeout(() => {
                    process.exit(0);
                }, 2000);
            });
        } catch (error) {
            console.error('Update command error:', error);
            await sock.sendMessage(chatId, { text: "❌ An unexpected error occurred during the update process." }, { quoted: message });
        }
    }
};
