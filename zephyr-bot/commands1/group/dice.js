module.exports = {
    name: 'dice',
    aliases: ['roll', 'd'],
    description: 'Roll a dice (1-6)',
    execute: async (sock, remoteJid, message, args) => {
        try {
            const diceResult = Math.floor(Math.random() * 6) + 1;
            const diceEmojis = ['🎲', '🎰'];
            const emoji = diceEmojis[Math.floor(Math.random() * diceEmojis.length)];
            
            await sock.sendMessage(remoteJid, { 
                text: `${emoji} *Dice Roll Result:*\n\n🎲 You rolled: *${diceResult}*` 
            });
        } catch (err) {
            console.error('Dice command error:', err);
            await sock.sendMessage(remoteJid, { text: '❌ Error executing dice command.' });
        }
    }
};
