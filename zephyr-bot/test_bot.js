const fs = require('fs');
const vm = require('vm');
const { handleImportedCommand, listImportedCommands } = require('./imported-commands');

function loadStylizeText() {
    const source = fs.readFileSync('./helper.js', 'utf8');
    const mapMatch = source.match(/const STYLE_FONT_MAP = Object\.freeze\((\{[\s\S]*?\})\);/);
    const fnMatch = source.match(/function stylizeText\(value\) \{[\s\S]*?\n\}/);
    if (!mapMatch || !fnMatch) throw new Error('stylizeText implementation not found');
    const context = {
        console, String, Object, Set,
        STYLE_FONT_MAP: vm.runInNewContext('(' + mapMatch[1] + ')')
    };
    vm.createContext(context);
    vm.runInContext(fnMatch[0] + '\nthis.stylizeText = stylizeText;', context);
    return context.stylizeText;
}

async function main() {
    const sent = [];
    const sock = {
        sendMessage: async (jid, payload) => {
            sent.push({ jid, payload });
            return { key: { id: String(sent.length) } };
        }
    };

    const samples = 100;
    const start = process.hrtime.bigint();
    for (let i = 0; i < samples; i++) {
        await handleImportedCommand(sock, 'test@s.whatsapp.net', { key: {}, message: {} }, 'calc', ['2', '+', '2']);
    }
    const elapsedMs = Number(process.hrtime.bigint() - start) / 1e6;
    const avgMs = elapsedMs / samples;
    const lastText = sent.at(-1)?.payload?.text || '';
    if (!lastText.includes('4')) throw new Error('calc command did not produce the expected result');

    const expectedImportedCommands = ['calc', 'dice', 'fact', 'joke', 'meme', 'quote', 'runtime', 'shazam', 'img', 'update'];
    const registered = listImportedCommands();
    const missingRegistry = expectedImportedCommands.filter(command => !registered.includes(command));
    if (missingRegistry.length) throw new Error('Missing registry commands: ' + missingRegistry.join(', '));

    const stylizeText = loadStylizeText();
    const styled = stylizeText('SKYBLUE-MD ready');
    if (styled === 'SKYBLUE-MD ready' || !styled.includes('𝙎')) throw new Error('Stylish font transformation failed');
    if (stylizeText('https://example.com') !== 'https://example.com') throw new Error('URL preservation failed');

    const menuPreview = stylizeText([
        '╭━━━━━━━━━━━━━━━━━━━━',
        '┃ ZEPHYR-𝙈𝘿 — 𝙉𝙀𝙒 𝘾𝙊𝙈𝙈𝘼𝙉𝘿𝙎',
        '┃ › .calc <expression>',
        '┃ › .dice',
        '┃ › .fact',
        '┃ › .joke',
        '┃ › .meme',
        '┃ › .quote',
        '┃ › .runtime',
        '┃ › .play <song>',
        '┃ › .shazam',
        '┃ › .img <prompt>',
        '┃ › .update',
        '╰━━━━━━━━━━━━━━━━━━━━'
    ].join('\\n'));

    console.log(JSON.stringify({
        samples,
        totalMs: Number(elapsedMs.toFixed(3)),
        averageMs: Number(avgMs.toFixed(3)),
        messagesSent: sent.length,
        registeredCommands: registered,
        importedCommandsVerified: expectedImportedCommands,
        styleVerified: true,
        urlPreservationVerified: true,
        stylishMenuPreview: menuPreview
    }, null, 2));
}

main().catch(error => {
    console.error(error.stack || error);
    process.exit(1);
});
