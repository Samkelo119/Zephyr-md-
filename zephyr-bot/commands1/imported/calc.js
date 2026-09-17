module.exports = {
    name: 'calc',
    aliases: ['calculate', 'math'],
    description: 'Calculate math expressions',
    execute: async (sock, remoteJid, message, args) => {
        try {
            if (args.length === 0) {
                await sock.sendMessage(remoteJid, { 
                    text: '❌ *Usage:* .calc <expression>\n\n' +
                          'Examples:\n' +
                          '• .calc 2+2\n' +
                          '• .calc 10*5\n' +
                          '• .calc 100/4' 
                });
                return;
            }
            
            const expression = args.join(' ');
            
            // Validate expression (only allow numbers and basic operators)
            if (!/^[0-9+\-*/(). ]+$/.test(expression)) {
                await sock.sendMessage(remoteJid, { 
                    text: '❌ Invalid expression. Only numbers and operators (+, -, *, /, ()) are allowed.' 
                });
                return;
            }
            
            try {
                const result = eval(expression);
                await sock.sendMessage(remoteJid, { 
                    text: `🧮 *Calculation Result:*\n\n` +
                          `📝 Expression: ${expression}\n` +
                          `✅ Result: *${result}*` 
                });
            } catch (calcErr) {
                await sock.sendMessage(remoteJid, { 
                    text: '❌ Invalid calculation. Please use valid mathematical expressions.' 
                });
            }
        } catch (err) {
            console.error('Calc command error:', err);
            await sock.sendMessage(remoteJid, { text: '❌ Error executing calc command.' });
        }
    }
};
