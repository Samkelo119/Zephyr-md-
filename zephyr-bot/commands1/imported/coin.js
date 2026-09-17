module.exports = {
    name: 'coin',
    aliases: ['flip', 'c'],
    description: 'Flip a coin (Heads/Tails)',
    execute: async (sock, remoteJid, message, args) => {
        try {
            const coinResult = Math.random() > 0.5 ? 'Heads' : 'Tails';
            const resultEmoji = coinResult === 'Heads' ? '🪙' : '🪙';
            
            await sock.sendMessage(remoteJid, { 
                text: `${resultEmoji} *Coin Flip Result:*\n\n🪙 Result: *${coinResult}*` 
            });
        } catch (err) {
            console.error('Coin command error:', err);
            await sock.sendMessage(remoteJid, { text: '❌ Error executing coin command.' });
        }
    }
};
