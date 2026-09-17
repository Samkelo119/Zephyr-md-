module.exports = {
    name: 'quote',
    aliases: ['q'],
    description: 'Get an inspiring quote',
    execute: async (sock, remoteJid, message, args) => {
        try {
            const quotes = [
                '"The only way to do great work is to love what you do." – Steve Jobs',
                '"Talk is cheap. Show me the code." – Linus Torvalds',
                '"Programs must be written for people to read, and only incidentally for machines to execute." – Harold Abelson',
                '"Whether you think you can or you think you can\'t, you\'re right." – Henry Ford',
                '"The best way to predict the future is to invent it." – Alan Kay',
                '"Code is poetry." – Unknown',
                '"Make it work, make it right, make it fast." – Kent Beck'
            ];
            
            const randomQuote = quotes[Math.floor(Math.random() * quotes.length)];
            await sock.sendMessage(remoteJid, { 
                text: `💬 *Quote of the Moment:*\n\n${randomQuote}` 
            });
        } catch (err) {
            console.error('Quote command error:', err);
            await sock.sendMessage(remoteJid, { text: '❌ Error executing quote command.' });
        }
    }
};
