const { createReactionCommand } = require('../lib/reactionCommand');

module.exports = createReactionCommand({
  name: 'highfive',
  endpoint: 'highfive',
  emoji: '🙌',
  verb: 'high-fives',
});
