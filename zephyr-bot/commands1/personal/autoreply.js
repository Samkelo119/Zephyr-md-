'use strict';

const fs   = require('fs');
const path = require('path');
const { isSudo } = require('../lib/sudoManager');

const FOOTER = '\n\n> ᴘᴏᴡᴇʀᴇᴅ ʙʏ ᴍʀᴅɪᴇʜᴀʀᴅ ᴛᴇᴄʜX';
const CONFIG = path.join(__dirname, '../data/autoreply.json');

function loadConfig() {
    try {
        if (!fs.existsSync(CONFIG)) {
            fs.mkdirSync(path.dirname(CONFIG), { recursive: true });
            fs.writeFileSync(CONFIG, JSON.stringify({ enabled: false }, null, 2));
        }
        return JSON.parse(fs.readFileSync(CONFIG));
    } catch (_) { return { enabled: false }; }
}

function saveConfig(cfg) {
    fs.mkdirSync(path.dirname(CONFIG), { recursive: true });
    fs.writeFileSync(CONFIG, JSON.stringify(cfg, null, 2));
}

// ── AI reply ──────────────────────────────────────────────────────────────────
async function getAiReply(userText) {
    const fetch  = (...a) => import('node-fetch').then(m => m.default(...a));
    const apiKey = process.env.OPENAI_A || process.env.OPENAI_API_KEY;

    if (apiKey) {
        try {
            const res = await fetch('https://api.openai.com/v1/chat/completions', {
                method : 'POST',
                headers: {
                    'Content-Type' : 'application/json',
                    'Authorization': `Bearer ${apiKey}`,
                },
                body: JSON.stringify({
                    model   : 'gpt-4o-mini',
                    messages: [
                        {
                            role   : 'system',
                            content: `You are SKYKIID-MD, a friendly and helpful WhatsApp assistant bot created by MRDIEHARD TECH.
Respond in the SAME language the user writes in — Zulu, Siswati, English, Afrikaans, or any other language.
Keep responses warm, conversational, and concise (under 200 words).
Never say you are made by OpenAI. You are SKYKIID-MD.`,
                        },
                        { role: 'user', content: userText },
                    ],
                    max_tokens : 400,
                    temperature: 0.8,
                }),
            });
            if (res.ok) {
                const data = await res.json();
                const reply = data?.choices?.[0]?.message?.content?.trim();
                if (reply) return reply;
            }
        } catch (_) {}
    }

    // ── Fallback: pollinations.ai (free, no key needed) ──────────────────────
    try {
        const res = await fetch('https://text.pollinations.ai/', {
            method : 'POST',
            headers: { 'Content-Type': 'application/json' },
            body   : JSON.stringify({
                messages: [
                    {
                        role   : 'system',
                        content: `You are ZᴇPʜʏʀ-Mᴅ, a friendly WhatsApp assistant by MʀDɪᴇHᴀʀᴅ TᴇᴄʜX. Reply in the same language as the user. Keep it short and helpful.`,
                    },
                    { role: 'user', content: userText },
                ],
                model  : 'openai',
                private: true,
            }),
        });
        if (res.ok) {
            const text = await res.text();
            if (text?.trim()) return text.trim();
        }
    } catch (_) {}

    return null;
}

// ── Exported helper called from index.js ──────────────────────────────────────
async function handleAutoReply(sock, remoteJid, message, text) {
    const cfg = loadConfig();
    if (!cfg.enabled) return false;

    let reply;
    try { reply = await getAiReply(text); } catch (_) { reply = null; }

    if (!reply) {
        reply = `🤖 _Zᴇᴘʜʏʀ~Mᴅ ɪꜱ ʜᴇʀᴇ!_\n\n_ɪ ʀᴇᴄᴇɪᴠᴇᴅ ʏᴏᴜʀ ᴍᴇꜱꜱᴀɢᴇ ʙᴜᴛ ᴀɪ ɪꜱ ᴛᴇᴍᴘᴏʀᴀʀɪʟʏ ʙᴜꜱʏ._\n_ᴛʏᴘᴇ_ *.menu* _ᴛᴏ ꜱᴇᴇ ᴀʟʟ ᴄᴏᴍᴍᴀɴᴅꜱ._`;
    }

    await sock.sendMessage(remoteJid, { text: reply + FOOTER }, { quoted: message });
    return true;
}

// ── Command handler (.autoreply on/off) ───────────────────────────────────────
module.exports = {
    name       : 'autoreply',
    aliases    : ['auto', 'ar'],
    description: 'Toggle AI auto-reply (on/off)',
    handleAutoReply,
    execute    : async (sock, remoteJid, message, args) => {
        try {
            const senderId = message.key.participant || message.key.remoteJid;
            if (!message.key.fromMe && !isSudo(senderId)) {
                return sock.sendMessage(remoteJid, {
                    text: `❌ *𝗦𝘂𝗱𝗼 𝗢𝗻𝗹𝘆 𝗖𝗼𝗺𝗺𝗮𝗻𝗱!*\n\n_ᴏɴʟʏ ᴏᴡɴᴇʀ / ꜱᴜᴅᴏ ᴄᴀɴ ᴛᴏɢɢʟᴇ ᴀᴜᴛᴏʀᴇᴘʟʏ._` + FOOTER,
                }, { quoted: message });
            }

            const cfg    = loadConfig();
            const action = (args[0] || '').toLowerCase();

            if (action === 'on')       cfg.enabled = true;
            else if (action === 'off') cfg.enabled = false;
            else                       cfg.enabled = !cfg.enabled;

            saveConfig(cfg);

            const state = cfg.enabled ? '🟢 *𝗢𝗡*' : '🔴 *𝗢𝗙𝗙*';
            const tip   = cfg.enabled
                ? `_✅ ᴀɪ ᴡɪʟʟ ɴᴏᴡ ʀᴇᴘʟʏ ᴛᴏ ᴇᴠᴇʀʏ ɪɴᴄᴏᴍɪɴɢ ᴍᴇꜱꜱᴀɢᴇ._`
                : `_❌ ᴀɪ ᴀᴜᴛᴏ-ʀᴇᴘʟʏ ᴅɪꜱᴀʙʟᴇᴅ._`;

            await sock.sendMessage(remoteJid, {
                text: [
                    `╔══〔 🤖 𝗔𝘂𝘁𝗼𝗿𝗲𝗽𝗹𝘆 〕══╗`,
                    ``,
                    `ꜱᴛᴀᴛᴜꜱ  ➤  ${state}`,
                    ``,
                    tip,
                    ``,
                    `_ᴜꜱᴀɢᴇ: .autoreply on / off_`,
                ].join('\n') + FOOTER,
            }, { quoted: message });

        } catch (err) {
            console.error('Autoreply error:', err);
            await sock.sendMessage(remoteJid, { text: '❌ Error processing autoreply command.' });
        }
    },
};
