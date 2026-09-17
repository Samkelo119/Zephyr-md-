const os = require("os");

module.exports = {
    name: "system",
    aliases: ["sys", "info", "status"],
    description: "Displays system information.",
    execute: async (sock, remoteJid, m, args, context) => {
        try {
            const totalMem = os.totalmem();
            const freeMem = os.freemem();
            const usedMem = totalMem - freeMem;
            
            const ram = (totalMem / 1024 / 1024 / 1024).toFixed(2);
            const freeRam = (freeMem / 1024 / 1024 / 1024).toFixed(2);
            const usedRam = (usedMem / 1024 / 1024 / 1024).toFixed(2);
            
            const platform = os.platform();
            const uptime = process.uptime();
            const hours = Math.floor(uptime / 3600);
            const minutes = Math.floor((uptime % 3600) / 60);
            const seconds = Math.floor(uptime % 60);
            
            const cpuInfo = os.cpus();
            const cpuModel = cpuInfo.length > 0 ? cpuInfo[0].model : "Unknown";

            const sysInfo = `
💻 *SYSTEM STATUS*

╟➢ *Platform:* ${platform}
╟➢ *CPU:* ${cpuModel}
╟➢ *RAM:* ${usedRam}GB / ${ram}GB (${freeRam}GB Free)
╟➢ *Node Version:* ${process.version}
╟➢ *Uptime:* ${hours}h ${minutes}m ${seconds}s
╟➢ *Bot Engine:* Baileys (No-Browser)
`.trim();

            if (context && typeof context.sendResponse === 'function') {
                await context.sendResponse(sock, remoteJid, sysInfo, m);
            } else {
                await sock.sendMessage(remoteJid, { text: sysInfo + "\n\n> Powered by MRDIEHARD TechX" }, { quoted: m });
            }
        } catch (err) {
            console.error('System command error:', err);
            await sock.sendMessage(remoteJid, { text: "❌ Error retrieving system information." }, { quoted: m });
        }
    },
};
