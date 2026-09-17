const axios = require('axios');

async function aiCommand(sock, chatId, message, args) {
    try {
        const query = args.join(' ').trim();
        
        if (!query) {
            return await sock.sendMessage(chatId, { 
                text: "❌ Please provide a question!\n\nExample: .ai What is the capital of France?"
            }, { quoted: message });
        }

        // Show processing reaction
        await sock.sendMessage(chatId, { react: { text: '🤖', key: message.key } });

        try {
            // Using a reliable public AI API
            const response = await axios.get(`https://api.simsimi.net/v2/?text=${encodeURIComponent(query)}&lc=en`);
            
            let answer = "";
            if (response.data && response.data.success) {
                answer = response.data.success;
            } else {
                // Fallback API
                const fallback = await axios.get(`https://api.vyturex.com/ai?prompt=${encodeURIComponent(query)}`);
                answer = fallback.data;
            }

            if (!answer) throw new Error("No response from AI");

            await sock.sendMessage(chatId, { 
                text: `*🤖 AI RESPONSE:*\n\n${answer}\n\n> Powered by ZᴇPʜʏʀ~Mᴅ` 
            }, { quoted: message });

        } catch (error) {
            console.error('AI API Error:', error);
            await sock.sendMessage(chatId, { text: "❌ AI is currently unavailable. Please try again later." }, { quoted: message });
        }
    } catch (error) {
        console.error('AI Command Error:', error);
    }
}

module.exports = {
    name: 'ai',
    aliases: ['gpt', 'chat', 'ask'],
    description: 'Chat with AI',
    execute: async (sock, remoteJid, message, args) => {
        return aiCommand(sock, remoteJid, message, args);
    }
};
