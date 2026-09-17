const { createReactionCommand } = require('../lib/reactionCommand');

module.exports = createReactionCommand({
  name: 'pat',
  endpoint: 'pat',
  emoji: '🖐️',
  verb: 'pats',
});
