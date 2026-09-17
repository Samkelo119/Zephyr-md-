const { beautifyResponse } = require('./helper');

const simple = beautifyResponse('Command completed successfully.');
if (!simple.includes('𝙕') || !simple.includes('𝙎𝙈𝘼𝙍𝙏')) {
  throw new Error('Simple responses are not branded and styled');
}
const multiline = beautifyResponse('First line\nSecond line');
if (!multiline.includes('┃ 𝙁') || !multiline.includes('┃ 𝙎')) {
  throw new Error('Multiline responses were not formatted correctly');
}
const boxed = beautifyResponse('╭━━ BOX ━━╮\n┃ Already formatted\n╰━━━━━━━━╯');
if ((boxed.match(/╭━━/g) || []).length !== 1) {
  throw new Error('Existing formatted responses were wrapped twice');
}
console.log(JSON.stringify({ simpleStyled: true, multilineStyled: true, existingLayoutPreserved: true }, null, 2));
process.exit(0);
