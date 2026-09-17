module.exports = {
    name: 'freenet',
    aliases: ['fn'],
    description: 'Get MRDIEHARD FREENET link',
    execute: async (sock, remoteJid, message, args, context) => {
        try {
            const responseText = "*FOLLOW MRDIEHARD FREENET CHANNEL*\n\n🔗 Link: https://whatsapp.com/channel/0029Vb7CzeG17EmuIkFvo01q";
            
            if (context && typeof context.sendResponse === 'function') {
                await context.sendResponse(sock, remoteJid, responseText, message);
            } else {
                // Fallback
                await sock.sendMessage(remoteJid, { text: responseText + "\n\n> Powered by MRDIEHARD TechX" }, { quoted: message });
            }
        } catch (err) {
            console.error('Freenet command error:', err);
        }
    }
};
