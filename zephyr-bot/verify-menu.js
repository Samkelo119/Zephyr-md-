const fs = require('fs');
const path = require('path');
const menu = require('./menu');

const listed = Object.values(menu.MENU_CATEGORIES)
  .flatMap(category => category.lines(''))
  .map(line => line.replace(/^\./, '').split(/\s+/)[0])
  .filter(Boolean);
const unique = new Set(listed);
const personalFiles = [];
function walk(dir) {
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) walk(full);
    else if (entry.isFile() && entry.name.endsWith('.js')) personalFiles.push(entry.name.slice(0, -3).toLowerCase());
  }
}
walk(path.join(__dirname, 'commands', 'personal'));
const missingPersonal = [...new Set(personalFiles)].filter(name => !unique.has(name));
if (missingPersonal.length) throw new Error(`Commands missing from menu: ${missingPersonal.join(', ')}`);
for (const name of ['calc', 'dice', 'fact', 'joke', 'meme', 'quote', 'runtime', 'play', 'shazam', 'img', 'update']) {
  if (!unique.has(name)) throw new Error(`Imported command missing from menu: ${name}`);
}
for (const name of ['menu', 'menuall', 'menu2', 'ping', 'me', 'from', 'info', 'restart']) {
  if (!unique.has(name)) throw new Error(`Utility command missing from menu: ${name}`);
}
console.log(JSON.stringify({ totalMenuEntries: unique.size, personalFiles: new Set(personalFiles).size, categories: Object.keys(menu.MENU_CATEGORIES) }, null, 2));
