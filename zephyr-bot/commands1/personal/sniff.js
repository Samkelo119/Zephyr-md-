const { downloadContentFromMessage } = require('@whiskeysockets/baileys');
const crypto = require('crypto');

/**
 * Advanced Sniffer for ZᴇPʜʏʀ~Mᴅ
 * Supports: .hc (HTTP Custom), .npv2, .ehi, .ovpn, .txt
 */

// XOR list for HTTP Custom deobfuscation
const XOR_LIST = ['。', '〃', '〄', '々', '〆', '〇', '〈', '〉', '《', '》', '「', '」', '『', '』', '【', '】', '〒', '〓', '〔', '〕'];

// Known keys for HTTP Custom
const HC_KEYS = [
    'hc_reborn___7', 'hc_reborn_tester', 'keY_secReaT_hc', 'hc_reborn_7', 
    'hc_reborn_6', 'hc_reborn_5', 'hc_reborn_4', 'hc_reborn_3'
];

async function sniffCommand(sock, chatId, message) {
    try {
        const quoted = message.message?.extendedTextMessage?.contextInfo?.quotedMessage;
        if (!quoted) {
            return sock.sendMessage(chatId, { text: '❌ Please reply to a VPN config file with .sniff' }, { quoted: message });
        }

        const doc = quoted.documentMessage;
        if (!doc) {
            return sock.sendMessage(chatId, { text: '❌ The replied message must be a document/file.' }, { quoted: message });
        }

        await sock.sendMessage(chatId, { text: '🔍 *ZᴇPʜʏʀ~Mᴅ Advanced Sniffer* is analyzing... please wait.' }, { quoted: message });

        // 1. Download the file
        const stream = await downloadContentFromMessage(doc, 'document');
        let buffer = Buffer.from([]);
        for await (const chunk of stream) {
            buffer = Buffer.concat([buffer, chunk]);
        }

        const fileName = doc.fileName || 'unknown_config';
        const extension = fileName.split('.').pop().toLowerCase();
        let content = buffer.toString('utf-8');
        let decryptedData = null;
        let method = "Plain Text / Regex";

        // 2. Decryption Logic per Format
        if (extension === 'hc') {
            method = "HTTP Custom Decryptor";
            decryptedData = decryptHC(buffer);
        } else if (extension === 'npv2') {
            method = "NapsternetV Decoder";
            decryptedData = decodeNPV2(content);
        } else {
            // Try generic Base64 check
            try {
                const decoded = Buffer.from(content, 'base64').toString('utf-8');
                if (decoded.includes('remote') || decoded.includes('{')) {
                    content = decoded;
                    method = "Base64 Decoded";
                }
            } catch (e) {}
        }

        // 3. Extraction
        let report = `📡 *ADVANCED SNIFF RESULT* 📡\n\n`;
        report += `📄 *File:* ${fileName}\n`;
        report += `🛠️ *Method:* ${method}\n\n`;

        if (decryptedData && typeof decryptedData === 'object') {
            // Format decrypted object (for .hc or .npv2 JSON)
            for (const [key, value] of Object.entries(decryptedData)) {
                if (value && typeof value !== 'object') {
                    report += `🔹 *${key.toUpperCase()}:* ${value}\n`;
                }
            }
        } else {
            // Regex extraction for plain text or generic formats
            const sni = content.match(/(?:sni|server_name|host|domain|sslSni)\s*[:=]?\s*([a-zA-Z0-9.-]+\.[a-z]{2,})/i)?.[1];
            const payload = content.match(/(?:payload|http-header|request)\s*[:=]?\s*([^\n\r]+)/i)?.[1];
            const proxy = content.match(/(?:proxy|remote_proxy)\s*[:=]?\s*([0-9.]+:[0-9]+)/i)?.[1];
            const ssh = content.match(/(?:ssh|sshAddress|remote)\s*[:=]?\s*([0-9.]+):?([0-9]+)?/i);

            report += `🌐 *SNI/Host:* ${sni || 'Not found'}\n`;
            report += `⚡ *Payload:* ${payload || 'Not found'}\n`;
            report += `🔗 *Proxy:* ${proxy || 'Not found'}\n`;
            if (ssh) report += `🖥️ *SSH/Server:* ${ssh[1]}${ssh[2] ? ':' + ssh[2] : ''}\n`;
            
            report += `\n*Raw Preview:*\n\`\`\`${content.slice(0, 300)}...\`\`\``;
        }

        await sock.sendMessage(chatId, { text: report + "\n\n> Powered by ZᴇPʜʏʀ~Mᴅ" }, { quoted: message });

    } catch (error) {
        console.error('Error in sniff command:', error);
        await sock.sendMessage(chatId, { text: '❌ Failed to process this file. It may be heavily encrypted.' }, { quoted: message });
    }
}

/**
 * Decrypt HTTP Custom (.hc) files
 */
function decryptHC(buffer) {
    try {
        const encryptedStr = buffer.toString('utf-8');
        let deobfuscated = Buffer.from([]);
        
        // Deobfuscate using XOR
        for (let i = 0; i < encryptedStr.length; i++) {
            const charCode = encryptedStr.charCodeAt(i) ^ XOR_LIST[i % XOR_LIST.length].charCodeAt(0);
            deobfuscated = Buffer.concat([deobfuscated, Buffer.from([charCode])]);
        }

        // The result is Base64, decode it
        const encryptedData = Buffer.from(deobfuscated.toString(), 'base64');

        // Try known keys
        for (const key of HC_KEYS) {
            try {
                const secret = crypto.createHash('sha1').update(key).digest().slice(0, 16);
                const decipher = crypto.createDecipheriv('aes-128-ecb', secret, null);
                decipher.setAutoPadding(true);
                let decrypted = Buffer.concat([decipher.update(encryptedData), decipher.final()]);
                
                // .hc files usually contain a JSON-like structure separated by |
                const parts = decrypted.toString('utf-8').split('|');
                const map = [
                    'payload', 'proxy', 'rootCheck', 'lock', 'expiry', 'hasNotes', 'note2', 
                    'ssh', 'mobileOnly', 'unlockProxy', 'unknown', 'vpn', 'sni', 'useSSH', 
                    'udpgw', 'lockPayload', 'hasHWID', 'hwid', 'note1', 'unlockUser', 'sslMode'
                ];
                
                let result = {};
                parts.forEach((val, i) => { if (map[i]) result[map[i]] = val; });
                return result;
            } catch (e) { continue; }
        }
    } catch (e) { return null; }
    return null;
}

/**
 * Decode NapsternetV (.npv2) files
 */
function decodeNPV2(content) {
    try {
        const decoded = Buffer.from(content, 'base64').toString('utf-8');
        return JSON.parse(decoded);
    } catch (e) {
        return null;
    }
}

module.exports = {
    name: 'sniff',
    aliases: ['sniff', 'decrypt'],
    description: 'Advanced VPN configuration sniffer and decryptor',
    execute: async (sock, remoteJid, message, args) => {
        return sniffCommand(sock, remoteJid, message);
    }
};
