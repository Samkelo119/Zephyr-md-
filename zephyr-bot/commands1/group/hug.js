const { createReactionCommand } = require('../lib/reactionCommand');

module.exports = createReactionCommand({
  name: 'hug',
  endpoint: 'hug',
  emoji: '🤗',
  verb: 'hugs',
});
