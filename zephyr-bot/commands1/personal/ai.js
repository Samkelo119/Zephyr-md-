'use strict';

const FOOTER = '\n\n> ᴘᴏᴡᴇʀᴇᴅ ʙʏ ZᴇPʜʏʀ~Mᴅ';

async function askAI(prompt) {
    const fetch = (...a) => import('node-fetch').then(m => m.default(...a));
    const apiKey = process.env.OPENAI_A || process.env.OPENAI_API_KEY;

    if (apiKey) {
        // ── OpenAI ───────────────────────────────────────────────────────────
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
                        content: `You are ZᴇPʜʏʀ~Mᴅ, a helpful WhatsApp assistant by MʀDɪᴇHᴀʀᴅ TᴇᴄʜX. Reply concisely and helpfully. Detect the user's language and reply in the same language. Never say you are made by ᴍᴅʜ AIᴄᴏᴍᴘᴀɴʏ.`,
                    },
                    { role: 'user', content: prompt },
                ],
                max_tokens : 600,
                temperature: 0.7,
            }),
        });
        if (res.ok) {
            const data = await res.json();
            return data?.choices?.[0]?.message?.content?.trim() || null;
        }
    }

    // ── Fallback: pollinations.ai (free, no key) ─────────────────────────────
    const res = await fetch('https://text.pollinations.ai/', {
        method : 'POST',
        headers: { 'Content-Type': 'application/json' },
        body   : JSON.stringify({
            messages: [
                {
                    role   : 'system',
                    content: `You are ZᴇPʜʏʀ~Mᴅ, a helpful WhatsApp assistant. Reply concisely. Detect the language and reply in the same language.`,
                },
                { role: 'user', content: prompt },
            ],
            model  : 'openai',
            private: true,
        }),
    });
    if (res.ok) {
        const text = await res.text();
        return text?.trim() || null;
    }
    return null;
}

module.exports = {
    name       : 'ai',
    aliases    : ['gpt', 'ask', 'chat'],
    description: 'Chat with AI — powered by ZᴇPʜʏʀ~Mᴅ',
    execute    : async (sock, remoteJid, message, args) => {
        const query = args.join(' ').trim();
        if (!query) {
            return sock.sendMessage(remoteJid, {
                text: [
                    `╔══〔 🤖 𝗔𝗜 𝗖𝗵𝗮𝘁 〕══╗`,
                    ``,
                    `❓  ᴘʟᴇᴀꜱᴇ ᴘʀᴏᴠɪᴅᴇ ᴀ ǫᴜᴇꜱᴛɪᴏɴ!`,
                    ``,
                    `📌  *ᴜꜱᴀɢᴇ:*  .ai <ʏᴏᴜʀ ᴍᴇꜱꜱᴀɢᴇ>`,
                    `📌  *ᴇxᴀᴍᴘʟᴇ:* .ai ᴡʜᴀᴛ ɪꜱ ᴛʜᴇ ᴄᴀᴘɪᴛᴀʟ ᴏꜰ ꜱᴀ?`,
                ].join('\n') + FOOTER,
            }, { quoted: message });
        }

        await sock.sendMessage(remoteJid, { react: { text: '🤖', key: message.key } });

        try {
            const answer = await askAI(query);
            if (!answer) throw new Error('No response');

            await sock.sendMessage(remoteJid, {
                text: [
                    `╔══〔 🤖 𝗔𝗜 𝗥𝗲𝘀𝗽𝗼𝗻𝘀𝗲 〕══╗`,
                    ``,
                    answer,
                ].join('\n') + FOOTER,
            }, { quoted: message });

        } catch (err) {
            console.error('[AI CMD]', err.message);
            await sock.sendMessage(remoteJid, {
                text: `❌ *AI ᴜɴᴀᴠᴀɪʟᴀʙʟᴇ ʀɪɢʜᴛ ɴᴏᴡ.*\n_ᴛʀʏ ᴀɢᴀɪɴ ɪɴ ᴀ ꜰᴇᴡ ꜱᴇᴄᴏɴᴅꜱ._` + FOOTER,
            }, { quoted: message });
        }
    },
};
