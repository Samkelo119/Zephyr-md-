const os = require('os');

async function systemCommand(sock, remoteJid, m) {
    const ram = (os.totalmem() / 1024 / 1024 / 1024).toFixed(2);
    const freeRam = (os.freemem() / 1024 / 1024 / 1024).toFixed(2);
    const platform = os.platform();
    const cpu = os.cpus()[0].model;

    const sysInfo = `
💻 *SYSTEM STATUS*
╟➢ *Platform:* ${platform}
╟➢ *CPU:* ${cpu}
╟➢ *RAM:* ${freeRam}GB / ${ram}GB
╟➢ *Node Version:* ${process.version}
╟➢ *Bot Engine:* Baileys (No-Browser)`.trim();

    await sock.sendMessage(remoteJid, { text: sysInfo }, { quoted: m });
}
module.exports = systemCommand;
