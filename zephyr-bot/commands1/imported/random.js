'use strict';

const { CORE_COMMANDS } = require('../core/commands');
const command = CORE_COMMANDS.find(entry => entry.name === 'random');

module.exports = {
  name: command.name,
  aliases: command.aliases,
  description: command.description,
  execute: command.execute
};
