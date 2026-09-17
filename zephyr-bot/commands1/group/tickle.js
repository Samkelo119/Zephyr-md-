const { createReactionCommand } = require('../lib/reactionCommand');

module.exports = createReactionCommand({
  name: 'tickle',
  endpoint: 'tickle',
  emoji: '🤣',
  verb: 'tickles',
});
