const { createReactionCommand } = require('../lib/reactionCommand');

module.exports = createReactionCommand({
  name: 'cuddle',
  endpoint: 'cuddle',
  emoji: '🥰',
  verb: 'cuddles',
});
