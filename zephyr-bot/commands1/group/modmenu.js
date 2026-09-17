const { createCategoryMenu } = require('../lib/menuTheme');

module.exports = createCategoryMenu({
  label: 'Moderation',
  emoji: '🛡️',
  trigger: 'modmenu',
});
