const { createReactionCommand } = require('../lib/reactionCommand');

module.exports = createReactionCommand({
  name: 'wave',
  endpoint: 'wave',
  emoji: '👋',
  verb: 'waves at',
});
