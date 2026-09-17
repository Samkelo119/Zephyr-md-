module.exports = {
    name: 'fact',
    aliases: ['f'],
    description: 'Get a random interesting fact',
    execute: async (sock, remoteJid, message, args) => {
        try {
            const facts = [
                '💡 The first computer bug was an actual bug (a moth) found in a computer in 1947!',
                '💡 Python was named after Monty Python, not the snake!',
                '💡 The \'@\' symbol is called \'at sign\' or \'amphora\' in English!',
                '💡 JavaScript was created in just 10 days by Brendan Eich in 1995!',
                '💡 The first webcam was created to monitor a coffee pot at Cambridge University!',
                '💡 The term "debugging" comes from Grace Hopper removing a moth from a computer!',
                '💡 HTML stands for HyperText Markup Language!',
                '💡 The first email was sent in 1971 by Ray Tomlinson!'
            ];
            
            const randomFact = facts[Math.floor(Math.random() * facts.length)];
            await sock.sendMessage(remoteJid, { text: randomFact });
        } catch (err) {
            console.error('Fact command error:', err);
            await sock.sendMessage(remoteJid, { text: '❌ Error executing fact command.' });
        }
    }
};
