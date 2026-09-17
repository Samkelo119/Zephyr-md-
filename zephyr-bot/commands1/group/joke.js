module.exports = {
    name: 'joke',
    aliases: ['j'],
    description: 'Get a programming joke',
    execute: async (sock, remoteJid, message, args) => {
        try {
            const jokes = [
                '😂 Why do Java developers wear glasses?\nBecause they don\'t C#!',
                '😂 How many programmers does it take to change a light bulb?\nNone, that\'s a hardware problem!',
                '😂 Why do programmers prefer dark mode?\nBecause light attracts bugs!',
                '😂 Why did the developer go broke?\nBecause he used up all his cache!',
                '😂 What\'s a programmer\'s favorite hangout place?\nStack Overflow!',
                '😂 Why do programmers always mix up Halloween and Christmas?\nBecause Oct 31 equals Dec 25!',
                '😂 How many SQL developers does it take to change a light bulb?\nNone, that\'s not their table!',
                '😂 Why did the programmer quit his job?\nBecause he didn\'t get arrays!'
            ];
            
            const randomJoke = jokes[Math.floor(Math.random() * jokes.length)];
            await sock.sendMessage(remoteJid, { text: randomJoke });
        } catch (err) {
            console.error('Joke command error:', err);
            await sock.sendMessage(remoteJid, { text: '❌ Error executing joke command.' });
        }
    }
};
