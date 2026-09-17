const fs = require('fs');
const path = require('path');

const byTrigger = new Map();

fs.readdirSync(__dirname)
  .filter((file) => file.endsWith('.js') && file !== 'index.js')
  .forEach((file) => {
    const command = require(path.join(__dirname, file));

    // Support both schemas: { trigger/triggers } and { name/aliases }.
    const triggers = [
      ...(Array.isArray(command.triggers) ? command.triggers : [command.trigger]),
      command.name,
      ...(Array.isArray(command.aliases) ? command.aliases : []),
    ];

    const unique = [...new Set(triggers.filter(Boolean))];

    if (unique.length === 0) {
      console.warn(`[commands] "${file}" has no trigger/name — skipped.`);
      return;
    }

    unique.forEach((t) => byTrigger.set(t.toLowerCase(), command));
  });

module.exports = { byTrigger };
