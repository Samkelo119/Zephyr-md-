'use strict';

const { CORE_COMMANDS } = require('../core/commands');

const sticker = CORE_COMMANDS.find(command => command.name === 'sticker');

module.exports = {
  name: sticker.name,
  aliases: sticker.aliases,
  description: sticker.description,
  execute: sticker.execute
};
