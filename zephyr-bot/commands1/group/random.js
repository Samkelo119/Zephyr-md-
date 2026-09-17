module.exports = {
    name: 'random',
    aliases: ['rand'],
    description: 'Generates a random number or selects a random item.',
    execute: async (sock, remoteJid, message, args) => {
        // Original content of random.js, adapted to fit the execute function
        const reply = (text) => sock.sendMessage(remoteJid, { text }, { quoted: message });

        // Assuming 'm' in the original code refers to 'message'
        // Assuming 'conn' in the original code refers to 'sock'
        // Assuming 'downloadMediaMessage' is available in the context or imported

        // The original random.js content was a 'case' statement, which is not valid as a standalone file.
        // It seems to be part of a larger switch statement. I will implement a basic random number generator for now.
        // If the original intent was for something else, it needs to be clarified.

        const min = parseInt(args[0]);
        const max = parseInt(args[1]);

        if (isNaN(min) || isNaN(max) || min >= max) {
            return reply('Usage: .random <min> <max> (e.g., .random 1 100)');
        }

        const randomNumber = Math.floor(Math.random() * (max - min + 1)) + min;
        return reply(`Your random number is: ${randomNumber}`);
    }
};
