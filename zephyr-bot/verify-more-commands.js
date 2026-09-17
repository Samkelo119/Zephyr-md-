const menu = require('./menu');
const { listMoreCommands } = require('./more-commands');

const listed = new Set(Object.values(menu.MENU_CATEGORIES)
  .flatMap(category => category.lines(''))
  .map(line => line.split(/\s+/)[0]));
const handlerNames = listMoreCommands();
const source = require('fs').readFileSync(require('path').join(__dirname, 'commands', 'personal', 'more commands', 'tags.js'), 'utf8');
const commandNames = new Set([...source.matchAll(/\bcase\s+['"]([a-z0-9]+)['"]/gi)].map(match => match[1]));
const missingFromMenu = [...commandNames].filter(command => !listed.has(command));
if (missingFromMenu.length) throw new Error(`More commands missing from menu: ${missingFromMenu.join(', ')}`);
if (!handlerNames.length) throw new Error('No more-command handlers were loaded');
console.log(JSON.stringify({ loadedHandlers: handlerNames.length, checkedCommands: [...commandNames] }, null, 2));
process.exit(0);
