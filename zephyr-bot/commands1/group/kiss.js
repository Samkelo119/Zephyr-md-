const { createReactionCommand } = require('../lib/reactionCommand');

module.exports = createReactionCommand({
  name: 'kiss',
  endpoint: 'kiss',
  emoji: '😘',
  verb: 'kisses',
});
