module.exports = {
  name: 'mute',
  category: 'Group Tools',
  aliases: ['unmute'],
  description: '.mute or .unmute — restrict the group to admins-only messaging (admin only).',
  adminOnly: true,
  groupOnly: true,
  async run({ sock, jid, commandName }) {
    const announcement = commandName === 'mute';
    await sock.groupSettingUpdate(jid, announcement ? 'announcement' : 'not_announcement');
    await sock.sendMessage(jid, {
      text: announcement
        ? 'Group muted: only admins can send messages now.'
        : 'Group unmuted: all members can send messages again.',
    });
  },
};