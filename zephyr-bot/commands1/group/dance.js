const { createReactionCommand } = require('../lib/reactionCommand');

module.exports = createReactionCommand({
  name: 'dance',
  endpoint: 'dance',
  emoji: '💃',
  verb: 'dances with',
});
