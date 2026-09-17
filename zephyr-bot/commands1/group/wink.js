const { createReactionCommand } = require('../lib/reactionCommand');

module.exports = createReactionCommand({
  name: 'wink',
  endpoint: 'wink',
  emoji: '😉',
  verb: 'winks at',
});
