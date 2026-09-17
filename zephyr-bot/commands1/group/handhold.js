const { createReactionCommand } = require('../lib/reactionCommand');

module.exports = createReactionCommand({
  name: 'handhold',
  endpoint: 'handhold',
  emoji: '🤝',
  verb: 'holds hands with',
});
