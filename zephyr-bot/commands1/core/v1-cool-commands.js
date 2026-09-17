'use strict';

const fs = require('fs');
const path = require('path');
const { spawn } = require('child_process');
const ffmpegPath = require('ffmpeg-static');
const {
  box,
  reply,
  normalizeJidNumber,
  getMessageText,
  downloadQuotedMedia,
  getBaileys
} = require('../../helper');

const DATA_FILE = path.join(__dirname, '../../data/v1-cool-state.json');
const MAX_FETCH_BYTES = 5 * 1024 * 1024;

const V1_COOL_NAMES = [
  'afk', 'ai', 'antibadword', 'anticall', 'antigroupmention', 'antigroupstatus',
  'antilink', 'autoreact', 'autostatus', 'autosticker', 'block', 'bomb', 'calc',
  'chatbot', 'clean', 'complimentry', 'converter', 'delete', 'demote', 'downloader',
  'facebook', 'getpp', 'goodbye', 'gptimage', 'group', 'groupinfo', 'grouplink',
  'groupstats', 'groupstatus', 'hidetag', 'igs', 'instagram', 'insult', 'kick',
  'lyrics', 'magicstudio', 'mode', 'mute', 'neko', 'notes', 'pending', 'play',
  'promote', 'random', 'resetwarn', 'search', 'setgoodbye', 'setwelcome', 'song',
  'sports', 'take', 'tiktok', 'tools', 'tts', 'twitter', 'unblock', 'unmute',
  'video', 'waifu', 'warn', 'weather', 'welcome'
];

function loadState() {
  try {
    const raw = fs.existsSync(DATA_FILE) ? JSON.parse(fs.readFileSync(DATA_FILE, 'utf8')) : {};
    return {
      afk: raw.afk || { enabled: false, message: 'I am currently away. Please leave a message.' },
      autoSticker: raw.autoSticker || {},
      groups: raw.groups || {},
      notes: raw.notes || {},
      games: raw.games || {},
      moderation: raw.moderation || {}
    };
  } catch (_) {
    return { afk: { enabled: false, message: 'I am currently away. Please leave a message.' }, autoSticker: {}, groups: {}, notes: {}, games: {}, moderation: {} };
  }
}

const state = loadState();
const afkReplies = new Set();
function saveState() { fs.writeFileSync(DATA_FILE, JSON.stringify(state, null, 2)); }
function groupSettings(jid) {
  state.groups[jid] ||= {
    welcome: { enabled: false, text: 'Welcome @user to @group!' },
    goodbye: { enabled: false, text: 'Goodbye @user.' }
  };
  return state.groups[jid];
}
function contextInfo(msg) { return msg?.message?.extendedTextMessage?.contextInfo || {}; }
function isGroup(jid) { return String(jid || '').endsWith('@g.us'); }
function userTarget(msg, args = []) {
  const context = contextInfo(msg);
  const candidates = [...(context.mentionedJid || [])];
  if (context.participant) candidates.push(context.participant);
  for (const value of args) {
    const number = String(value).replace(/[^0-9]/g, '');
    if (number.length >= 8) candidates.push(`${number}@s.whatsapp.net`);
  }
  return candidates[0] || null;
}
function isOwner(context) { return !!context?.isOwner; }
function publicUrl(value) {
  try {
    const url = new URL(value);
    const host = url.hostname.toLowerCase();
    if (!['http:', 'https:'].includes(url.protocol)) return null;
    if (host === 'localhost' || host.endsWith('.local') || /^127\.|^10\.|^0\.|^169\.254\.|^192\.168\.|^172\.(1[6-9]|2\d|3[0-1])\./.test(host) || host === '::1') return null;
    return url;
  } catch (_) { return null; }
}

async function requireGroupAdmin(sock, jid, msg, context, title) {
  if (!isGroup(jid)) {
    await reply(sock, jid, msg, box(title, 'This command only works inside a group.'));
    return null;
  }
  try {
    const metadata = await sock.groupMetadata(jid);
    const number = normalizeJidNumber(context.sender);
    const botNumber = normalizeJidNumber(sock.user?.id);
    const members = metadata.participants || [];
    const isAdmin = value => members.some(member => normalizeJidNumber(member.id || member.jid) === value && ['admin', 'superadmin'].includes(member.admin));
    if (!isOwner(context) && !isAdmin(number)) {
      await reply(sock, jid, msg, box('ACCESS DENIED', 'Only group admins or the bot owner can use this command.'));
      return null;
    }
    if (!isAdmin(botNumber)) {
      await reply(sock, jid, msg, box('ACCESS DENIED', 'The bot must be a group admin.'));
      return null;
    }
    return metadata;
  } catch (error) {
    await reply(sock, jid, msg, box(title, `Could not access group information: ${error.message}`));
    return null;
  }
}

async function stickerFromBuffer(sock, jid, msg, buffer, inputType = 'image') {
  const tempDir = path.join(__dirname, '../../tmp');
  fs.mkdirSync(tempDir, { recursive: true });
  const stamp = `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
  const input = path.join(tempDir, `${stamp}.${inputType === 'video' ? 'mp4' : 'jpg'}`);
  const output = path.join(tempDir, `${stamp}.webp`);
  fs.writeFileSync(input, buffer);
  const filter = inputType === 'video'
    ? 'fps=12,scale=512:512:force_original_aspect_ratio=decrease,pad=512:512:(ow-iw)/2:(oh-ih)/2:color=0x00000000'
    : 'scale=512:512:force_original_aspect_ratio=decrease,pad=512:512:(ow-iw)/2:(oh-ih)/2:color=0x00000000';
  const args = ['-y', '-i', input, ...(inputType === 'video' ? ['-t', '8'] : []), '-vf', filter, '-c:v', 'libwebp', '-q:v', '60', '-loop', '0', output];
  try {
    await new Promise((resolve, reject) => {
      const child = spawn(ffmpegPath, args, { stdio: 'ignore' });
      child.once('error', reject);
      child.once('close', code => code === 0 ? resolve() : reject(new Error(`FFmpeg exited with code ${code}`)));
    });
    await sock.sendMessage(jid, { sticker: fs.readFileSync(output) }, { quoted: msg });
  } finally {
    for (const file of [input, output]) { try { fs.unlinkSync(file); } catch (_) {} }
  }
}

async function convertStickerCommand(sock, jid, msg) {
  const media = await downloadQuotedMedia(msg);
  if (!media?.buffer || !['image', 'video'].includes(media.type)) return reply(sock, jid, msg, box('CONVERTER', 'Reply to an image or short video with .converter, .st, .take, or .igs.'));
  try { await stickerFromBuffer(sock, jid, msg, media.buffer, media.type); }
  catch (error) { await reply(sock, jid, msg, box('CONVERTER', `Conversion failed: ${error.message}`)); }
}

async function convertQuotedMedia(sock, jid, msg, outputExt, ffmpegArgs, payload) {
  const media = await downloadQuotedMedia(msg);
  if (!media?.buffer || !['image', 'video', 'audio', 'sticker'].includes(media.type)) {
    return reply(sock, jid, msg, box('CONVERTER', 'Reply to an image, video, audio file, or sticker first.'));
  }
  const tempDir = path.join(__dirname, '../../tmp');
  fs.mkdirSync(tempDir, { recursive: true });
  const stamp = `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
  const extension = { image: 'jpg', video: 'mp4', audio: 'ogg', sticker: 'webp' }[media.type] || 'bin';
  const input = path.join(tempDir, `${stamp}.${extension}`);
  const output = path.join(tempDir, `${stamp}.${outputExt}`);
  fs.writeFileSync(input, media.buffer);
  try {
    await new Promise((resolve, reject) => {
      const child = spawn(ffmpegPath, ['-y', '-i', input, ...ffmpegArgs, output], { stdio: 'ignore' });
      child.once('error', reject);
      child.once('close', code => code === 0 ? resolve() : reject(new Error(`FFmpeg exited with code ${code}`)));
    });
    await sock.sendMessage(jid, { [payload]: fs.readFileSync(output), mimetype: payload === 'audio' ? 'audio/mpeg' : payload === 'video' ? 'video/mp4' : 'image/jpeg' }, { quoted: msg });
  } catch (error) {
    await reply(sock, jid, msg, box('CONVERTER', `Conversion failed: ${error.message}`));
  } finally {
    for (const file of [input, output]) { try { fs.unlinkSync(file); } catch (_) {} }
  }
}

async function stickerToImageCommand(sock, jid, msg) {
  await convertQuotedMedia(sock, jid, msg, 'jpg', ['-frames:v', '1', '-q:v', '2'], 'image');
}

async function toMp3Command(sock, jid, msg, voice = false) {
  const media = await downloadQuotedMedia(msg);
  if (!media?.buffer || !['video', 'audio'].includes(media.type)) return reply(sock, jid, msg, box('CONVERTER', 'Reply to a video or audio file first.'));
  const tempDir = path.join(__dirname, '../../tmp');
  fs.mkdirSync(tempDir, { recursive: true });
  const stamp = `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
  const input = path.join(tempDir, `${stamp}.${media.type === 'video' ? 'mp4' : 'ogg'}`);
  const output = path.join(tempDir, `${stamp}.${voice ? 'ogg' : 'mp3'}`);
  fs.writeFileSync(input, media.buffer);
  const codecArgs = voice ? ['-vn', '-c:a', 'libopus', '-b:a', '64k'] : ['-vn', '-c:a', 'libmp3lame', '-b:a', '192k'];
  try {
    await new Promise((resolve, reject) => {
      const child = spawn(ffmpegPath, ['-y', '-i', input, ...codecArgs, output], { stdio: 'ignore' });
      child.once('error', reject);
      child.once('close', code => code === 0 ? resolve() : reject(new Error(`FFmpeg exited with code ${code}`)));
    });
    await sock.sendMessage(jid, { audio: fs.readFileSync(output), mimetype: voice ? 'audio/ogg; codecs=opus' : 'audio/mpeg', ptt: voice }, { quoted: msg });
  } catch (error) {
    await reply(sock, jid, msg, box('CONVERTER', `Audio conversion failed: ${error.message}`));
  } finally {
    for (const file of [input, output]) { try { fs.unlinkSync(file); } catch (_) {} }
  }
}

async function stickerToVideoCommand(sock, jid, msg) {
  await convertQuotedMedia(sock, jid, msg, 'mp4', ['-t', '8', '-vf', 'scale=512:512:force_original_aspect_ratio=decrease,pad=512:512:(ow-iw)/2:(oh-ih)/2:color=black', '-pix_fmt', 'yuv420p'], 'video');
}

async function afkCommand(sock, jid, msg, args, context) {
  if (!isOwner(context)) return reply(sock, jid, msg, box('ACCESS DENIED', 'Only the bot owner can change AFK mode.'));
  const action = String(args[0] || '').toLowerCase();
  if (action === 'on') {
    state.afk = { enabled: true, message: args.slice(1).join(' ').trim() || 'I am currently away. Please leave a message.' };
  } else if (action === 'off') {
    state.afk.enabled = false;
    afkReplies.clear();
  } else {
    return reply(sock, jid, msg, box('AFK MODE', `Status: ${state.afk.enabled ? 'ON' : 'OFF'}\n\nUsage: .afk on [message]\n.afk off`));
  }
  saveState();
  await reply(sock, jid, msg, box('AFK MODE', `AFK mode is now ${state.afk.enabled ? 'ON' : 'OFF'}.`));
}

async function autoStickerCommand(sock, jid, msg, args, context) {
  if (!isOwner(context)) return reply(sock, jid, msg, box('ACCESS DENIED', 'Only the bot owner can change auto-sticker mode.'));
  const botNumber = normalizeJidNumber(sock.user?.id);
  const action = String(args[0] || '').toLowerCase();
  if (action === 'on') state.autoSticker[botNumber] = true;
  else if (action === 'off') state.autoSticker[botNumber] = false;
  else return reply(sock, jid, msg, box('AUTOSTICKER', `Status: ${state.autoSticker[botNumber] ? 'ON' : 'OFF'}\n\nUsage: .autosticker on|off`));
  saveState();
  await reply(sock, jid, msg, box('AUTOSTICKER', `Auto-sticker is now ${state.autoSticker[botNumber] ? 'ON' : 'OFF'}.`));
}

async function bombCommand(sock, jid, msg, args, context) {
  const sender = normalizeJidNumber(context.sender);
  const current = state.games[sender];
  if (current && String(args[0]).toLowerCase() === 'surrender') {
    delete state.games[sender]; saveState();
    return reply(sock, jid, msg, box('BOMB GAME', `Game ended. The bomb was in box ${current.bomb}.`));
  }
  const selected = Number(args[0]);
  if (!current || !Number.isInteger(selected) || selected < 1 || selected > 9) {
    state.games[sender] = { bomb: Math.floor(Math.random() * 9) + 1, opened: [] };
    saveState();
    return reply(sock, jid, msg, box('BOMB GAME', 'Choose a box using .bomb 1 through .bomb 9. Avoid the bomb.\n\nType .bomb surrender to end the game.'));
  }
  if (current.opened.includes(selected)) return reply(sock, jid, msg, box('BOMB GAME', `Box ${selected} is already open. Choose another box.`));
  current.opened.push(selected);
  if (selected === current.bomb) {
    delete state.games[sender]; saveState();
    return reply(sock, jid, msg, box('BOMB GAME', `Boom. Box ${selected} had the bomb. Game over.`));
  }
  if (current.opened.length === 8) {
    delete state.games[sender]; saveState();
    return reply(sock, jid, msg, box('BOMB GAME', 'You opened all safe boxes. You win.'));
  }
  saveState();
  await reply(sock, jid, msg, box('BOMB GAME', `Box ${selected} is safe. Open boxes: ${current.opened.join(', ')}\nChoose another box with .bomb <1-9>.`));
}

async function cleanCommand(sock, jid, msg, args, context) {
  if (!isOwner(context)) return reply(sock, jid, msg, box('ACCESS DENIED', 'Only the bot owner can clear local command data.'));
  const action = String(args[0] || '').toLowerCase();
  if (action === 'notes') state.notes = {};
  else if (action === 'afk') { state.afk.enabled = false; afkReplies.clear(); }
  else return reply(sock, jid, msg, box('CLEAN', 'Usage: .clean notes\n.clean afk\n\nThis clears only local bot command data; it never deletes WhatsApp chat history.'));
  saveState();
  await reply(sock, jid, msg, box('CLEAN', `Cleared ${action} data.`));
}

async function complimentCommand(sock, jid, msg) {
  const target = userTarget(msg);
  if (!target) return reply(sock, jid, msg, box('COMPLIMENT', 'Mention or reply to someone with .complimentry.'));
  const compliments = ['You are doing great.', 'Your effort is appreciated.', 'You make the chat better.', 'You have a positive impact.'];
  await reply(sock, jid, msg, { text: `@${normalizeJidNumber(target)} ${compliments[Math.floor(Math.random() * compliments.length)]}`, mentions: [target] });
}

async function getProfilePicture(sock, jid, msg, args, context) {
  const target = userTarget(msg, args) || context.sender;
  try {
    const url = await sock.profilePictureUrl(target, 'image');
    await sock.sendMessage(jid, { image: { url }, caption: `Profile picture of @${normalizeJidNumber(target)}`, mentions: [target] }, { quoted: msg });
  } catch (_) {
    await reply(sock, jid, msg, box('GET PROFILE PICTURE', 'No profile picture is available for that contact.'));
  }
}

async function imageCommand(sock, jid, msg, args, label = 'IMAGE') {
  const prompt = args.join(' ').trim();
  if (!prompt) return reply(sock, jid, msg, box(label, `Usage: .${label.toLowerCase()} <description>`));
  const url = `https://image.pollinations.ai/prompt/${encodeURIComponent(prompt)}?width=768&height=768&nologo=true`;
  try { await sock.sendMessage(jid, { image: { url }, caption: `Generated for: ${prompt.slice(0, 180)}` }, { quoted: msg }); }
  catch (error) { await reply(sock, jid, msg, box(label, `Image generation failed: ${error.message}`)); }
}

async function groupHelp(sock, jid, msg) {
  await reply(sock, jid, msg, box('GROUP TOOLS', '.open / .unmute — allow members to chat\n.close / .mute — admins only\n.grouplink — show invite link\n.pending — list join requests\n.groupstats — show group counts\n.welcome on|off — welcome messages\n.goodbye on|off — goodbye messages'));
}

async function groupLink(sock, jid, msg, args, context) {
  const metadata = await requireGroupAdmin(sock, jid, msg, context, 'GROUP LINK');
  if (!metadata) return;
  try {
    const code = await sock.groupInviteCode(jid);
    await reply(sock, jid, msg, box('GROUP LINK', `https://chat.whatsapp.com/${code}`));
  } catch (error) { await reply(sock, jid, msg, box('GROUP LINK', `Could not get the invite link: ${error.message}`)); }
}

async function pendingCommand(sock, jid, msg, args, context) {
  const metadata = await requireGroupAdmin(sock, jid, msg, context, 'PENDING REQUESTS');
  if (!metadata) return;
  try {
    const pending = await sock.groupRequestParticipantsList(jid);
    const users = (pending || []).map(item => item.jid || item.id).filter(Boolean);
    await reply(sock, jid, msg, { text: users.length ? `Pending requests (${users.length}):\n${users.map(user => `@${normalizeJidNumber(user)}`).join('\n')}` : 'No pending join requests.', mentions: users });
  } catch (error) { await reply(sock, jid, msg, box('PENDING REQUESTS', `Could not get requests: ${error.message}`)); }
}

async function groupStats(sock, jid, msg) {
  if (!isGroup(jid)) return reply(sock, jid, msg, box('GROUP STATS', 'This command only works inside a group.'));
  try {
    const metadata = await sock.groupMetadata(jid);
    const admins = metadata.participants.filter(item => ['admin', 'superadmin'].includes(item.admin)).length;
    await reply(sock, jid, msg, box('GROUP STATS', `Group: ${metadata.subject}\nMembers: ${metadata.participants.length}\nAdmins: ${admins}\nDescription: ${metadata.desc || '(none)'}`));
  } catch (error) { await reply(sock, jid, msg, box('GROUP STATS', `Could not read group stats: ${error.message}`)); }
}

async function groupStatus(sock, jid, msg) {
  const settings = groupSettings(jid);
  await reply(sock, jid, msg, box('GROUP STATUS', `Welcome: ${settings.welcome.enabled ? 'ON' : 'OFF'}\nGoodbye: ${settings.goodbye.enabled ? 'ON' : 'OFF'}\nUse .groupstats for group member statistics.`));
}

async function greetingCommand(sock, jid, msg, args, context, type, setText = false) {
  const metadata = await requireGroupAdmin(sock, jid, msg, context, type.toUpperCase());
  if (!metadata) return;
  const settings = groupSettings(jid)[type];
  if (setText) {
    const value = args.join(' ').trim();
    if (!value) return reply(sock, jid, msg, box(type.toUpperCase(), `Usage: .set${type} <message>\nUse @user for the member and @group for the group name.`));
    settings.text = value; saveState();
    return reply(sock, jid, msg, box(type.toUpperCase(), `${type} message updated.`));
  }
  const action = String(args[0] || '').toLowerCase();
  if (action === 'on') settings.enabled = true;
  else if (action === 'off') settings.enabled = false;
  else return reply(sock, jid, msg, box(type.toUpperCase(), `Status: ${settings.enabled ? 'ON' : 'OFF'}\nMessage: ${settings.text}\n\nUsage: .${type} on|off\n.set${type} <message>`));
  saveState();
  await reply(sock, jid, msg, box(type.toUpperCase(), `${type} messages are now ${settings.enabled ? 'ON' : 'OFF'}.`));
}

async function lyricsCommand(sock, jid, msg, args) {
  const query = args.join(' ').trim();
  if (!query) return reply(sock, jid, msg, box('LYRICS', 'Usage: .lyrics <artist> - <song title>'));
  const [artist, title] = query.split(/\s+-\s+/).map(value => value?.trim());
  if (!artist || !title) return reply(sock, jid, msg, box('LYRICS', 'Use the format: .lyrics <artist> - <song title>'));
  try {
    const response = await fetch(`https://api.lyrics.ovh/v1/${encodeURIComponent(artist)}/${encodeURIComponent(title)}`);
    const data = await response.json();
    if (!data?.lyrics) throw new Error('Lyrics not found.');
    await reply(sock, jid, msg, box('LYRICS', `${artist} — ${title}\n\n${data.lyrics.slice(0, 3500)}`));
  } catch (error) { await reply(sock, jid, msg, box('LYRICS', `Could not fetch lyrics: ${error.message}`)); }
}

async function petCommand(sock, jid, msg, type) {
  const endpoint = type === 'waifu' ? 'https://api.waifu.pics/sfw/waifu' : 'https://nekos.best/api/v2/neko';
  try {
    const data = await (await fetch(endpoint)).json();
    const url = data.url || data.results?.[0]?.url;
    if (!url) throw new Error('No image returned.');
    await sock.sendMessage(jid, { image: { url }, caption: `${type} image` }, { quoted: msg });
  } catch (error) { await reply(sock, jid, msg, box(type.toUpperCase(), `Could not get an image: ${error.message}`)); }
}

function notesFor(sender) { state.notes[sender] ||= []; return state.notes[sender]; }
async function notesCommand(sock, jid, msg, args, context, command) {
  const sender = normalizeJidNumber(context.sender);
  const notes = notesFor(sender);
  const payload = args.join(' ').trim();
  if (command === 'addnote') {
    if (!payload) return reply(sock, jid, msg, box('NOTES', 'Usage: .addnote <text>'));
    notes.push({ id: notes.length ? Math.max(...notes.map(note => note.id)) + 1 : 1, text: payload }); saveState();
    return reply(sock, jid, msg, box('NOTES', `Saved note #${notes.at(-1).id}.`));
  }
  if (command === 'getnote') {
    const note = notes.find(item => item.id === Number(args[0]));
    return reply(sock, jid, msg, box('NOTES', note ? `#${note.id}: ${note.text}` : 'Note not found.'));
  }
  if (command === 'updatenote') {
    const note = notes.find(item => item.id === Number(args[0]));
    if (!note || !args.slice(1).join(' ').trim()) return reply(sock, jid, msg, box('NOTES', 'Usage: .updatenote <number> <text>'));
    note.text = args.slice(1).join(' ').trim(); saveState(); return reply(sock, jid, msg, box('NOTES', `Updated note #${note.id}.`));
  }
  if (command === 'delnote') {
    const index = notes.findIndex(item => item.id === Number(args[0]));
    if (index < 0) return reply(sock, jid, msg, box('NOTES', 'Note not found.'));
    notes.splice(index, 1); saveState(); return reply(sock, jid, msg, box('NOTES', 'Note deleted.'));
  }
  if (command === 'delallnotes') { state.notes[sender] = []; saveState(); return reply(sock, jid, msg, box('NOTES', 'All notes deleted.')); }
  const rows = notes.length ? notes.map(note => `#${note.id}: ${note.text}`).join('\n') : 'No notes saved.';
  await reply(sock, jid, msg, box('NOTES', `${rows}\n\n.addnote <text>\n.getnote <number>\n.updatenote <number> <text>\n.delnote <number>\n.delallnotes`));
}

async function resetWarningCommand(sock, jid, msg, args, context) {
  const metadata = await requireGroupAdmin(sock, jid, msg, context, 'RESET WARN');
  if (!metadata) return;
  const target = userTarget(msg, args);
  if (!target) return reply(sock, jid, msg, box('RESET WARN', 'Mention or reply to the member whose warnings should be cleared.'));
  const file = path.join(__dirname, '../../data/command-state.json');
  try {
    const data = fs.existsSync(file) ? JSON.parse(fs.readFileSync(file, 'utf8')) : {};
    if (data.warnings?.[jid]) delete data.warnings[jid][normalizeJidNumber(target)];
    fs.writeFileSync(file, JSON.stringify(data, null, 2));
    await reply(sock, jid, msg, box('RESET WARN', `Warnings reset for @${normalizeJidNumber(target)}.`), { mentions: [target] });
  } catch (error) { await reply(sock, jid, msg, box('RESET WARN', `Could not reset warnings: ${error.message}`)); }
}

async function searchCommand(sock, jid, msg, args, label = 'SEARCH') {
  const query = args.join(' ').trim();
  if (!query) return reply(sock, jid, msg, box(label, `Usage: .${label.toLowerCase()} <query>`));
  try {
    const endpoint = `https://api.duckduckgo.com/?q=${encodeURIComponent(query)}&format=json&no_html=1&skip_disambig=1`;
    const data = await (await fetch(endpoint)).json();
    const text = data.AbstractText || data.RelatedTopics?.find(item => item?.Text)?.Text || 'No instant-answer summary was available.';
    const source = data.AbstractURL || `https://www.google.com/search?q=${encodeURIComponent(query)}`;
    await reply(sock, jid, msg, box(label, `${text}\n\nSource: ${source}`));
  } catch (error) { await reply(sock, jid, msg, box(label, `Search failed: ${error.message}`)); }
}

async function sportsCommand(sock, jid, msg, args) {
  const league = String(args[0] || 'eng.1').toLowerCase();
  const supported = { epl: 'eng.1', premierleague: 'eng.1', laliga: 'esp.1', bundesliga: 'ger.1', seriea: 'ita.1', ligue1: 'fra.1' };
  const code = supported[league] || league;
  try {
    const data = await (await fetch(`https://site.api.espn.com/apis/site/v2/sports/soccer/${encodeURIComponent(code)}/scoreboard`)).json();
    const events = (data.events || []).slice(0, 10);
    if (!events.length) throw new Error('No fixtures available.');
    const rows = events.map(event => {
      const competition = event.competitions?.[0];
      const teams = (competition?.competitors || []).map(team => `${team.team.shortDisplayName} ${team.score || ''}`.trim()).join(' vs ');
      return `${teams} — ${event.status?.type?.shortDetail || event.date}`;
    }).join('\n');
    await reply(sock, jid, msg, box('SPORTS', rows));
  } catch (error) { await reply(sock, jid, msg, box('SPORTS', `Could not fetch scores: ${error.message}`)); }
}

async function publicFetchCommand(sock, jid, msg, args) {
  const url = publicUrl(args[0]);
  if (!url) return reply(sock, jid, msg, box('FETCH', 'Usage: .tools <public http(s) URL>\nPrivate, local, and internal addresses are blocked.'));
  try {
    const response = await fetch(url, { signal: AbortSignal.timeout(15000), redirect: 'follow' });
    const size = Number(response.headers.get('content-length') || 0);
    if (size > MAX_FETCH_BYTES) throw new Error('Response is larger than 5 MB.');
    const buffer = Buffer.from(await response.arrayBuffer());
    if (buffer.length > MAX_FETCH_BYTES) throw new Error('Response is larger than 5 MB.');
    const contentType = response.headers.get('content-type') || 'application/octet-stream';
    if (contentType.startsWith('image/')) return sock.sendMessage(jid, { image: buffer, caption: url.href }, { quoted: msg });
    if (contentType.startsWith('video/')) return sock.sendMessage(jid, { video: buffer, mimetype: contentType.split(';')[0], caption: url.href }, { quoted: msg });
    if (contentType.startsWith('audio/')) return sock.sendMessage(jid, { audio: buffer, mimetype: contentType.split(';')[0] }, { quoted: msg });
    const text = buffer.toString('utf8').slice(0, 3500);
    await reply(sock, jid, msg, box('FETCH', `${response.status} ${response.statusText}\n\n${text || '(binary response)'}`));
  } catch (error) { await reply(sock, jid, msg, box('FETCH', `Fetch failed: ${error.message}`)); }
}

async function gitCloneCommand(sock, jid, msg, args) {
  const url = publicUrl(args[0]);
  const match = url?.pathname.match(/^\/([^/]+)\/([^/]+)\/?$/);
  if (!url || url.hostname !== 'github.com' || !match) return reply(sock, jid, msg, box('GIT CLONE', 'Usage: .downloader https://github.com/owner/repository'));
  const owner = match[1]; const repo = match[2].replace(/\.git$/, '');
  const zip = `https://api.github.com/repos/${owner}/${repo}/zipball`;
  await sock.sendMessage(jid, { document: { url: zip }, fileName: `${owner}-${repo}.zip`, mimetype: 'application/zip', caption: `Public GitHub repository: ${owner}/${repo}` }, { quoted: msg });
}

async function unblockCommand(sock, jid, msg, args, context) {
  if (!isOwner(context)) return reply(sock, jid, msg, box('ACCESS DENIED', 'Only the bot owner can unblock contacts.'));
  const target = userTarget(msg, args);
  if (!target) return reply(sock, jid, msg, box('UNBLOCK', 'Mention, reply to, or provide a contact number.'));
  try { await sock.updateBlockStatus(target, 'unblock'); await reply(sock, jid, msg, box('UNBLOCK', `Unblocked @${normalizeJidNumber(target)}.`), { mentions: [target] }); }
  catch (error) { await reply(sock, jid, msg, box('UNBLOCK', `Could not unblock: ${error.message}`)); }
}

async function weatherCommand(sock, jid, msg, args) {
  const city = args.join(' ').trim();
  if (!city) return reply(sock, jid, msg, box('WEATHER', 'Usage: .weather <city>'));
  try {
    const data = await (await fetch(`https://wttr.in/${encodeURIComponent(city)}?format=j1`)).json();
    const current = data.current_condition?.[0];
    if (!current) throw new Error('No weather data returned.');
    await reply(sock, jid, msg, box('WEATHER', `${data.nearest_area?.[0]?.areaName?.[0]?.value || city}\n${current.weatherDesc?.[0]?.value || 'Unknown'}\nTemperature: ${current.temp_C}°C\nFeels like: ${current.FeelsLikeC}°C\nHumidity: ${current.humidity}%\nWind: ${current.windspeedKmph} km/h`));
  } catch (error) { await reply(sock, jid, msg, box('WEATHER', `Could not fetch weather: ${error.message}`)); }
}

async function socialCommand(sock, jid, msg, args, service) {
  const input = publicUrl(args[0]);
  if (!input) return reply(sock, jid, msg, box(service.toUpperCase(), `Usage: .${service} <public URL>`));
  try {
    const response = await fetch(`https://api.hanggts.xyz/download/${service}?url=${encodeURIComponent(input.href)}`);
    const data = await response.json();
    const url = [data?.result?.media?.video_hd, data?.result?.media?.video_sd, data?.result?.url, data?.result?.download, data?.data?.url, data?.url, data?.download].find(value => typeof value === 'string' && /^https?:\/\//i.test(value));
    if (!url) throw new Error('No downloadable media was returned.');
    await sock.sendMessage(jid, { video: { url }, mimetype: 'video/mp4', caption: `${service} download` }, { quoted: msg });
  } catch (error) { await reply(sock, jid, msg, box(service.toUpperCase(), `Download failed: ${error.message}`)); }
}

async function handleV1MessageWatch(sock, msg) {
  try {
    if (!msg?.key || msg.key.fromMe) return;
    const jid = msg.key.remoteJid;
    const sender = msg.key.participant || jid;
    const text = getMessageText(msg).trim();
    const botNumber = normalizeJidNumber(sock.user?.id);
    const prefix = global.getBotPrefix ? global.getBotPrefix(botNumber) : '.';
    const context = contextInfo(msg);
    const mentioned = (context.mentionedJid || []).some(item => normalizeJidNumber(item) === botNumber);
    const replied = normalizeJidNumber(context.participant) === botNumber;
    if (state.afk.enabled && !text.startsWith(prefix) && (!isGroup(jid) || mentioned || replied)) {
      const key = `${jid}:${normalizeJidNumber(sender)}`;
      if (!afkReplies.has(key)) {
        afkReplies.add(key);
        await reply(sock, jid, msg, box('AFK', state.afk.message));
      }
    }
    if (state.autoSticker[botNumber] && !text.startsWith(prefix)) {
      const media = msg.message?.imageMessage ? { type: 'image', media: msg.message.imageMessage } : msg.message?.videoMessage ? { type: 'video', media: msg.message.videoMessage } : null;
      if (media) {
        const { downloadMediaMessage } = await getBaileys();
        const buffer = await downloadMediaMessage(msg, 'buffer', {});
        if (buffer) await stickerFromBuffer(sock, jid, msg, buffer, media.type);
      }
    }
  } catch (error) { console.log('[v1-watch]', error.message); }
}

async function handleV1GroupWatch(sock, update) {
  try {
    const jid = update?.id || update?.jid;
    if (!isGroup(jid) || !['add', 'remove'].includes(update.action)) return;
    const settings = groupSettings(jid)[update.action === 'add' ? 'welcome' : 'goodbye'];
    if (!settings.enabled) return;
    const metadata = await sock.groupMetadata(jid);
    const users = update.participants || [];
    const text = settings.text.replace(/@group/g, metadata.subject || 'this group').replace(/@user/g, users.map(user => `@${normalizeJidNumber(user)}`).join(' '));
    await sock.sendMessage(jid, { text, mentions: users });
  } catch (error) { console.log('[v1-group-watch]', error.message); }
}

const V1_COOL_COMMANDS = [
  { name: 'afk', aliases: ['away'], description: 'Enable or disable AFK reply mode', execute: afkCommand },
  { name: 'antigroupmention', aliases: ['agm'], description: 'Configure group mention protection', execute: async (s, j, m, a, c) => { state.moderation[j] ||= {}; state.moderation[j].groupMention = String(a[0] || '').toLowerCase() === 'on'; saveState(); await reply(s, j, m, box('ANTI GROUP MENTION', `Status: ${state.moderation[j].groupMention ? 'ON' : 'OFF'}\nUsage: .antigroupmention on|off`)); } },
  { name: 'antigroupstatus', aliases: ['antigstatus', 'ags'], description: 'Configure group status protection', execute: async (s, j, m, a, c) => { state.moderation[j] ||= {}; state.moderation[j].groupStatus = String(a[0] || '').toLowerCase() === 'on'; saveState(); await reply(s, j, m, box('ANTI GROUP STATUS', `Status: ${state.moderation[j].groupStatus ? 'ON' : 'OFF'}\nUsage: .antigroupstatus on|off`)); } },
  { name: 'autosticker', aliases: ['autos', 'asticker'], description: 'Convert incoming images and videos to stickers', execute: autoStickerCommand },
  { name: 'bomb', aliases: ['bom'], description: 'Play a number bomb game', execute: bombCommand },
  { name: 'clean', aliases: ['purge', 'clear'], description: 'Clear local bot command data', execute: cleanCommand },
  { name: 'complimentry', aliases: ['praise', 'compliment'], description: 'Compliment a mentioned member', execute: complimentCommand },
  { name: 'converter', aliases: ['st'], description: 'Convert replied image or video to a sticker', execute: convertStickerCommand },
  { name: 'toimg', aliases: ['s2img'], description: 'Convert replied sticker to an image', execute: stickerToImageCommand },
  { name: 'tomp3', aliases: ['tomusic'], description: 'Convert replied video or audio to MP3', execute: (s, j, m) => toMp3Command(s, j, m, false) },
  { name: 'tovoice', aliases: ['tovn', 'tovoicenote'], description: 'Convert replied media to a voice note', execute: (s, j, m) => toMp3Command(s, j, m, true) },
  { name: 'tomp4', aliases: ['tovid', 'toblackscreen', 'blackscreen'], description: 'Convert replied sticker to MP4 video', execute: stickerToVideoCommand },
  { name: 'downloader', aliases: ['gitclone', 'gitdl', 'github', 'git', 'repodl', 'clone'], description: 'Download a public GitHub repository', execute: gitCloneCommand },
  { name: 'getpp', aliases: ['gp', 'getpic'], description: 'Get a contact profile picture', execute: getProfilePicture },
  { name: 'goodbye', aliases: ['goodbyeon', 'goodbyeoff'], description: 'Enable or disable goodbye messages', execute: (s, j, m, a, c) => greetingCommand(s, j, m, a, c, 'goodbye') },
  { name: 'gptimage', aliases: ['gptimg', 'editimage', 'aiimage', 'vision', 'gi'], description: 'Generate an image from a prompt', execute: (s, j, m, a) => imageCommand(s, j, m, a, 'GPTIMAGE') },
  { name: 'group', description: 'Show available group tools', execute: groupHelp },
  { name: 'grouplink', aliases: ['link', 'invite'], description: 'Show the current group invite link', execute: groupLink },
  { name: 'groupstats', aliases: ['stats', 'leaderboard', 'gstats'], description: 'Show group statistics', execute: groupStats },
  { name: 'groupstatus', aliases: ['togstatus', 'swgc', 'gs', 'gstatus'], description: 'Show welcome and goodbye status', execute: groupStatus },
  { name: 'igs', aliases: ['igsticker'], description: 'Create a sticker from replied media', execute: convertStickerCommand },
  { name: 'lyrics', aliases: ['lyric', 'lirik'], description: 'Find song lyrics', execute: lyricsCommand },
  { name: 'magicstudio', aliases: ['imagine', 'magic', 'magicai'], description: 'Generate an image from a prompt', execute: (s, j, m, a) => imageCommand(s, j, m, a, 'MAGICSTUDIO') },
  { name: 'neko', aliases: ['nekosfw'], description: 'Get a safe neko image', execute: (s, j, m) => petCommand(s, j, m, 'neko') },
  { name: 'notes', aliases: ['getnotes', 'getallnotes', 'listnotes'], description: 'List personal notes', execute: (s, j, m, a, c) => notesCommand(s, j, m, a, c, 'notes') },
  { name: 'addnote', aliases: ['newnote', 'makenote', 'createnote'], description: 'Save a personal note', execute: (s, j, m, a, c) => notesCommand(s, j, m, a, c, 'addnote') },
  { name: 'getnote', aliases: ['listnote', 'viewnote', 'shownote'], description: 'Read a personal note', execute: (s, j, m, a, c) => notesCommand(s, j, m, a, c, 'getnote') },
  { name: 'updatenote', aliases: ['editnote', 'modifynote'], description: 'Edit a personal note', execute: (s, j, m, a, c) => notesCommand(s, j, m, a, c, 'updatenote') },
  { name: 'delnote', aliases: ['deletenote', 'removenote', 'rmnote'], description: 'Delete a personal note', execute: (s, j, m, a, c) => notesCommand(s, j, m, a, c, 'delnote') },
  { name: 'delallnotes', aliases: ['deleteallnotes', 'removeallnotes', 'clearnotes'], description: 'Delete all personal notes', execute: (s, j, m, a, c) => notesCommand(s, j, m, a, c, 'delallnotes') },
  { name: 'pending', aliases: ['pendingrequests', 'joinrequests', 'listpending'], description: 'List pending group join requests', execute: pendingCommand },
  { name: 'resetwarn', aliases: ['resetwarning', 'clearwarn', 'unwarn', 'delwarn'], description: 'Reset a member warning count', execute: resetWarningCommand },
  { name: 'search', aliases: ['yts', 'yt-search', 'google', 'ggle', 'googlesearch'], description: 'Search the web', execute: (s, j, m, a) => searchCommand(s, j, m, a, 'SEARCH') },
  { name: 'setgoodbye', aliases: ['goodbyetext'], description: 'Set goodbye message text', execute: (s, j, m, a, c) => greetingCommand(s, j, m, a, c, 'goodbye', true) },
  { name: 'setwelcome', aliases: ['welcometext'], description: 'Set welcome message text', execute: (s, j, m, a, c) => greetingCommand(s, j, m, a, c, 'welcome', true) },
  { name: 'sports', aliases: ['live', 'score', 'livematch'], description: 'Show football fixtures and scores', execute: sportsCommand },
  { name: 'tools', aliases: ['fetch', 'get', 'testapi', 'curl'], description: 'Fetch a public URL safely', execute: publicFetchCommand },
  { name: 'twitter', aliases: ['x', 'xdl', 'twitterdl', 'twdl'], description: 'Download a public X/Twitter video', execute: (s, j, m, a) => socialCommand(s, j, m, a, 'twitter') },
  { name: 'unblock', description: 'Unblock a contact', execute: unblockCommand },
  { name: 'waifu', aliases: ['waifusfw'], description: 'Get a safe waifu image', execute: (s, j, m) => petCommand(s, j, m, 'waifu') },
  { name: 'weather', aliases: ['w', 'clima'], description: 'Show weather for a city', execute: weatherCommand }
];

module.exports = { V1_COOL_NAMES, V1_COOL_COMMANDS, handleV1MessageWatch, handleV1GroupWatch };
