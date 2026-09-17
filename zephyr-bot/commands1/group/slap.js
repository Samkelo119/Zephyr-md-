const { createReactionCommand } = require('../lib/reactionCommand');

module.exports = createReactionCommand({
  name: 'slap',
  endpoint: 'slap',
  emoji: '✋',
  verb: 'slaps',
});
