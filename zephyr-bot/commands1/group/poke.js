const { createReactionCommand } = require('../lib/reactionCommand');

module.exports = createReactionCommand({
  name: 'poke',
  endpoint: 'poke',
  emoji: '👉',
  verb: 'pokes',
});
