'use strict';

const fs = require('fs');
const path = require('path');
const { spawn } = require('child_process');
const ffmpegPath = require('ffmpeg-static');
const {
  box,
  reply,
  getMessageText,
  normalizeJidNumber,
  downloadQuotedMedia
} = require('../../helper');

const DATA_FILE = path.join(__dirname, '../../data/command-state.json');
const MAX_WARNINGS = 3;

function loadState() {
  try {
    const raw = fs.existsSync(DATA_FILE) ? JSON.parse(fs.readFileSync(DATA_FILE, 'utf8')) : {};
    return {
      bans: Array.isArray(raw.bans) ? raw.bans : [],
      warnings: raw.warnings && typeof raw.warnings === 'object' ? raw.warnings : {},
      guards: raw.guards && typeof raw.guards === 'object' ? raw.guards : {},
      chatbot: raw.chatbot && typeof raw.chatbot === 'object' ? raw.chatbot : {}
    };
  } catch (_) {
    return { bans: [], warnings: {}, guards: {}, chatbot: {} };
  }
}

let state = loadState();
function saveState() {
  fs.writeFileSync(DATA_FILE, JSON.stringify(state, null, 2));
}

function isBanned(jid) {
  return state.bans.includes(normalizeJidNumber(jid));
}

function isGroup(jid) {
  return String(jid || '').endsWith('@g.us');
}

function messageContext(msg) {
  return msg?.message?.extendedTextMessage?.contextInfo || {};
}

function targetJids(msg, params = []) {
  const targets = new Set(messageContext(msg).mentionedJid || []);
  if (messageContext(msg).participant) targets.add(messageContext(msg).participant);
  for (const value of params) {
    const number = String(value).replace(/[^0-9]/g, '');
    if (number.length >= 8) targets.add(`${number}@s.whatsapp.net`);
  }
  return [...targets];
}

function participantNumber(participant) {
  return normalizeJidNumber(participant?.id || participant?.jid || participant?.phoneNumber || '');
}

function participantIsAdmin(metadata, jid) {
  const number = normalizeJidNumber(jid);
  return (metadata?.participants || []).some(participant => {
    if (!['admin', 'superadmin'].includes(participant?.admin)) return false;
    return [participant.id, participant.jid, participant.lid, participant.phoneNumber, participant.pn]
      .filter(Boolean)
      .some(identifier => String(identifier) === String(jid) || normalizeJidNumber(identifier) === number);
  });
}

async function requireGroupAdmin(sock, jid, msg, context, title = 'GROUP COMMAND') {
  if (!isGroup(jid)) {
    await reply(sock, jid, msg, box(title, 'This command only works inside a group.'));
    return null;
  }
  let metadata;
  try {
    metadata = await sock.groupMetadata(jid);
  } catch (_) {
    await reply(sock, jid, msg, box(title, 'Could not read this group.'));
    return null;
  }
  const senderAdmin = participantIsAdmin(metadata, context.sender);
  if (!context.isOwner && !senderAdmin) {
    await reply(sock, jid, msg, box('ACCESS DENIED', 'Only a group admin or the bot owner can use this command.'));
    return null;
  }
  if (!participantIsAdmin(metadata, sock.user?.id)) {
    await reply(sock, jid, msg, box('ACCESS DENIED', 'The bot must be an admin in this group.'));
    return null;
  }
  return metadata;
}

function commandHelp(command, usage) {
  return box(command.toUpperCase(), `Usage: ${usage}`);
}

async function acceptCommand(sock, jid, msg, _params, context) {
  const metadata = await requireGroupAdmin(sock, jid, msg, context, 'ACCEPT');
  if (!metadata) return;
  try {
    const pending = await sock.groupRequestParticipantsList(jid);
    if (!pending?.length) return reply(sock, jid, msg, box('ACCEPT', 'There are no pending join requests.'));
    let accepted = 0;
    for (const participant of pending) {
      try {
        await sock.groupRequestParticipantsUpdate(jid, [participant.jid || participant.id], 'approve');
        accepted += 1;
      } catch (_) {}
    }
    await reply(sock, jid, msg, box('ACCEPT', `Approved ${accepted} of ${pending.length} pending request(s).`));
  } catch (error) {
    await reply(sock, jid, msg, box('ACCEPT', `Could not process requests: ${error.message}`));
  }
}

async function moderateParticipant(sock, jid, msg, params, context, action) {
  const metadata = await requireGroupAdmin(sock, jid, msg, context, action);
  if (!metadata) return;
  const targets = targetJids(msg, params);
  if (!targets.length) return reply(sock, jid, msg, commandHelp(action, `.${action.toLowerCase()} @user`));
  try {
    await sock.groupParticipantsUpdate(jid, targets, action);
    await reply(sock, jid, msg, box(action.toUpperCase(), `${action} completed for ${targets.length} member(s).`));
  } catch (error) {
    await reply(sock, jid, msg, box(action.toUpperCase(), `Action failed: ${error.message}`));
  }
}

async function muteCommand(sock, jid, msg, params, context, unlock = false) {
  const metadata = await requireGroupAdmin(sock, jid, msg, context, unlock ? 'UNMUTE' : 'MUTE');
  if (!metadata) return;
  try {
    await sock.groupSettingUpdate(jid, unlock ? 'not_announcement' : 'announcement');
    await reply(sock, jid, msg, box(unlock ? 'UNMUTE' : 'MUTE', unlock ? 'Group members can now send messages.' : 'Only admins can now send messages.'));
  } catch (error) {
    await reply(sock, jid, msg, box(unlock ? 'UNMUTE' : 'MUTE', `Could not update the group: ${error.message}`));
  }
}

async function tagCommand(sock, jid, msg, params, context, hidden = false, onlyMembers = false) {
  const metadata = await requireGroupAdmin(sock, jid, msg, context, hidden ? 'HIDETAG' : 'TAGALL');
  if (!metadata) return;
  const people = (metadata.participants || []).filter(person => !onlyMembers || !['admin', 'superadmin'].includes(person.admin));
  const mentions = people.map(person => person.id);
  const note = params.join(' ').trim() || (hidden ? 'Attention everyone.' : '');
  const tags = hidden ? '' : `\n${people.map(person => `@${participantNumber(person)}`).join(' ')}`;
  await reply(sock, jid, msg, { text: `${note}${tags}`.trim(), mentions });
}

async function deleteCommand(sock, jid, msg, _params, context) {
  if (!isGroup(jid)) return reply(sock, jid, msg, box('DELETE', 'This command only works inside a group.'));
  const quoted = messageContext(msg);
  if (!quoted.stanzaId) return reply(sock, jid, msg, commandHelp('delete', '.delete (reply to a message)'));
  try {
    await sock.sendMessage(jid, {
      delete: {
        remoteJid: jid,
        id: quoted.stanzaId,
        fromMe: normalizeJidNumber(quoted.participant) === normalizeJidNumber(sock.user?.id),
        participant: quoted.participant
      }
    });
  } catch (error) {
    await reply(sock, jid, msg, box('DELETE', `Could not delete the message: ${error.message}`));
  }
}

async function groupInfoCommand(sock, jid, msg) {
  if (!isGroup(jid)) return reply(sock, jid, msg, box('GROUP INFO', 'This command only works inside a group.'));
  try {
    const metadata = await sock.groupMetadata(jid);
    const admins = metadata.participants.filter(person => ['admin', 'superadmin'].includes(person.admin)).length;
    await reply(sock, jid, msg, box('GROUP INFO', `Name: ${metadata.subject || 'Unknown'}\nMembers: ${metadata.participants.length}\nAdmins: ${admins}\nDescription: ${metadata.desc || '(none)'}`));
  } catch (error) {
    await reply(sock, jid, msg, box('GROUP INFO', `Could not read the group: ${error.message}`));
  }
}

async function banCommand(sock, jid, msg, params, context, remove = false) {
  if (!context.isOwner) return reply(sock, jid, msg, box('ACCESS DENIED', 'Only the bot owner can manage bans.'));
  const target = targetJids(msg, params)[0];
  if (!target) return reply(sock, jid, msg, commandHelp(remove ? 'unban' : 'ban', `.${remove ? 'unban' : 'ban'} @user`));
  const number = normalizeJidNumber(target);
  if (number === normalizeJidNumber(sock.user?.id)) return reply(sock, jid, msg, box('BAN', 'The bot cannot ban itself.'));
  if (remove) state.bans = state.bans.filter(entry => entry !== number);
  else if (!state.bans.includes(number)) state.bans.push(number);
  saveState();
  await reply(sock, jid, msg, box(remove ? 'UNBAN' : 'BAN', `${remove ? 'Unbanned' : 'Banned'} @${number}.`), { mentions: [target] });
}

async function listBansCommand(sock, jid, msg, _params, context) {
  if (!context.isOwner) return reply(sock, jid, msg, box('ACCESS DENIED', 'Only the bot owner can view bans.'));
  const rows = state.bans.length ? state.bans.map(number => `@${number}`).join('\n') : 'No users are banned.';
  await reply(sock, jid, msg, box('BANNED USERS', rows), { mentions: state.bans.map(number => `${number}@s.whatsapp.net`) });
}

function warningTarget(msg, params) {
  return targetJids(msg, params)[0] || null;
}

async function warnCommand(sock, jid, msg, params, context, checkOnly = false) {
  const metadata = await requireGroupAdmin(sock, jid, msg, context, checkOnly ? 'WARNINGS' : 'WARN');
  if (!metadata) return;
  const target = warningTarget(msg, params);
  if (!target) return reply(sock, jid, msg, commandHelp(checkOnly ? 'warnings' : 'warn', `.${checkOnly ? 'warnings' : 'warn'} @user`));
  state.warnings[jid] ||= {};
  const number = normalizeJidNumber(target);
  const count = Number(state.warnings[jid][number] || 0);
  if (checkOnly) {
    return reply(sock, jid, msg, box('WARNINGS', `@${number} has ${count}/${MAX_WARNINGS} warning(s).`), { mentions: [target] });
  }
  const next = count + 1;
  state.warnings[jid][number] = next;
  saveState();
  await reply(sock, jid, msg, box('WARNING', `@${number} has received warning ${next}/${MAX_WARNINGS}.`), { mentions: [target] });
  if (next >= MAX_WARNINGS) {
    try {
      await sock.groupParticipantsUpdate(jid, [target], 'remove');
      delete state.warnings[jid][number];
      saveState();
      await reply(sock, jid, msg, box('AUTO-REMOVE', `@${number} was removed after ${MAX_WARNINGS} warnings.`), { mentions: [target] });
    } catch (error) {
      await reply(sock, jid, msg, box('WARNING', `The warning was saved, but the member could not be removed: ${error.message}`));
    }
  }
}

function guardFor(jid) {
  state.guards[jid] ||= { antilink: 'off', antitag: false, badword: { enabled: false, words: [] } };
  state.guards[jid].badword ||= { enabled: false, words: [] };
  return state.guards[jid];
}

async function guardCommand(sock, jid, msg, params, context, kind) {
  const metadata = await requireGroupAdmin(sock, jid, msg, context, kind);
  if (!metadata) return;
  const guard = guardFor(jid);
  const action = String(params[0] || '').toLowerCase();
  if (kind === 'antibadword') {
    if (action === 'add' && params.slice(1).join(' ').trim()) {
      const word = params.slice(1).join(' ').trim().toLowerCase();
      if (!guard.badword.words.includes(word)) guard.badword.words.push(word);
      guard.badword.enabled = true;
    } else if (action === 'del' || action === 'remove') {
      const word = params.slice(1).join(' ').trim().toLowerCase();
      guard.badword.words = guard.badword.words.filter(item => item !== word);
    } else if (action === 'on') guard.badword.enabled = true;
    else if (action === 'off') guard.badword.enabled = false;
    else return reply(sock, jid, msg, box('ANTIBADWORD', `Status: ${guard.badword.enabled ? 'ON' : 'OFF'}\nWords: ${guard.badword.words.join(', ') || '(none)'}\n\nUsage: .antibadword on|off\n.antibadword add <word>\n.antibadword del <word>`));
  } else if (kind === 'antilink') {
    if (['on', 'delete', 'warn', 'kick'].includes(action)) guard.antilink = action;
    else if (action === 'off') guard.antilink = 'off';
    else return reply(sock, jid, msg, box('ANTILINK', `Status: ${guard.antilink}\n\nUsage: .antilink on|delete|warn|kick|off`));
  } else {
    if (action === 'on') guard.antitag = true;
    else if (action === 'off') guard.antitag = false;
    else return reply(sock, jid, msg, box('ANTITAG', `Status: ${guard.antitag ? 'ON' : 'OFF'}\n\nUsage: .antitag on|off`));
  }
  saveState();
  await reply(sock, jid, msg, box(kind.toUpperCase(), `${kind} is now ${kind === 'antibadword' ? (guard.badword.enabled ? 'ON' : 'OFF') : kind === 'antilink' ? guard.antilink.toUpperCase() : (guard.antitag ? 'ON' : 'OFF')}.`));
}

async function setPrefixCommand(sock, jid, msg, params, context) {
  if (!context.isOwner) return reply(sock, jid, msg, box('ACCESS DENIED', 'Only the bot owner can change the prefix.'));
  const value = String(params[0] || '').trim();
  if (!value || value.length > 3 || /\s/.test(value)) return reply(sock, jid, msg, commandHelp('setprefix', '.setprefix <1–3 characters>'));
  const botNumber = normalizeJidNumber(sock.user?.id);
  global.setBotPrefixValue(botNumber, value);
  global.setBotPrefixEnabled(botNumber, true);
  await reply(sock, jid, msg, box('PREFIX UPDATED', `New prefix: ${value}`));
}

async function settingsCommand(sock, jid, msg, _params, context) {
  const botNumber = normalizeJidNumber(sock.user?.id);
  const status = [
    `Mode: ${global.isBotSelfMode(botNumber) ? 'Self' : 'Public'}`,
    `Prefix: ${global.getBotPrefix(botNumber) || '(disabled)'}`,
    `Auto-react: ${fs.existsSync(path.join(__dirname, '../../data/autoreact.json')) ? 'configured' : 'off'}`,
    `Banned users: ${state.bans.length}`
  ].join('\n');
  await reply(sock, jid, msg, box('BOT SETTINGS', status));
}

async function systemCommand(sock, jid, msg) {
  const os = require('os');
  const uptime = Math.floor(process.uptime());
  const days = Math.floor(uptime / 86400);
  const hours = Math.floor((uptime % 86400) / 3600);
  const minutes = Math.floor((uptime % 3600) / 60);
  await reply(sock, jid, msg, box('SYSTEM STATUS', `Platform: ${os.platform()}\nNode: ${process.version}\nCPU: ${os.cpus()[0]?.model || 'Unknown'}\nMemory: ${(process.memoryUsage().rss / 1024 / 1024).toFixed(1)} MB\nUptime: ${days}d ${hours}h ${minutes}m`));
}

async function goodnightCommand(sock, jid, msg) {
  const messages = [
    'Good night. Rest well and wake up refreshed.',
    'Sweet dreams. Tomorrow is a new chance to do great things.',
    'Good night. Take care of yourself and sleep peacefully.'
  ];
  await reply(sock, jid, msg, { text: messages[Math.floor(Math.random() * messages.length)] });
}

async function sniffCommand(sock, jid, msg) {
  const media = await downloadQuotedMedia(msg);
  if (!media?.buffer) return reply(sock, jid, msg, commandHelp('sniff', '.sniff (reply to a document)'));
  const domains = [...new Set(media.buffer.toString('utf8').match(/\b(?:[a-z0-9-]+\.)+[a-z]{2,}\b/gi) || [])].slice(0, 100);
  await reply(sock, jid, msg, box('DOCUMENT HOSTS', domains.length ? domains.map((domain, index) => `${index + 1}. ${domain}`).join('\n') : 'No domain names were found in the replied document.'));
}

async function makeSticker(sock, jid, msg) {
  const media = await downloadQuotedMedia(msg);
  if (!media?.buffer || !['image', 'video'].includes(media.type)) {
    return reply(sock, jid, msg, commandHelp('sticker', '.sticker (reply to an image or short video)'));
  }
  const tempDir = path.join(__dirname, '../../tmp');
  fs.mkdirSync(tempDir, { recursive: true });
  const stamp = `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
  const input = path.join(tempDir, `${stamp}.${media.type === 'video' ? 'mp4' : 'jpg'}`);
  const output = path.join(tempDir, `${stamp}.webp`);
  fs.writeFileSync(input, media.buffer);
  const video = media.type === 'video';
  const args = [
    '-y', '-i', input,
    ...(video ? ['-t', '8', '-vf', 'fps=12,scale=512:512:force_original_aspect_ratio=decrease,pad=512:512:(ow-iw)/2:(oh-ih)/2:color=0x00000000'] : ['-vf', 'scale=512:512:force_original_aspect_ratio=decrease,pad=512:512:(ow-iw)/2:(oh-ih)/2:color=0x00000000']),
    '-c:v', 'libwebp', '-lossless', '0', '-q:v', '60', '-loop', video ? '0' : '0', output
  ];
  try {
    await new Promise((resolve, reject) => {
      const process = spawn(ffmpegPath, args, { stdio: 'ignore' });
      process.once('error', reject);
      process.once('close', code => code === 0 ? resolve() : reject(new Error(`FFmpeg exited with code ${code}`)));
    });
    await sock.sendMessage(jid, { sticker: fs.readFileSync(output) }, { quoted: msg });
  } catch (error) {
    await reply(sock, jid, msg, box('STICKER', `Could not create a sticker: ${error.message}`));
  } finally {
    for (const file of [input, output]) {
      try { fs.unlinkSync(file); } catch (_) {}
    }
  }
}

async function ttsCommand(sock, jid, msg, params) {
  const text = params.join(' ').trim();
  if (!text) return reply(sock, jid, msg, commandHelp('tts', '.tts <text>'));
  const url = `https://translate.google.com/translate_tts?ie=UTF-8&client=tw-ob&tl=en&q=${encodeURIComponent(text.slice(0, 190))}`;
  try {
    await sock.sendMessage(jid, { audio: { url }, mimetype: 'audio/mpeg', ptt: true }, { quoted: msg });
  } catch (error) {
    await reply(sock, jid, msg, box('TTS', `Could not create speech: ${error.message}`));
  }
}

async function uploadCommand(sock, jid, msg) {
  const media = await downloadQuotedMedia(msg);
  if (!media?.buffer) return reply(sock, jid, msg, commandHelp('url', '.url (reply to media)'));
  try {
    const form = new FormData();
    const extension = { image: 'jpg', video: 'mp4', audio: 'mp3', sticker: 'webp', document: 'bin' }[media.type] || 'bin';
    form.append('file', new Blob([media.buffer]), `upload.${extension}`);
    const response = await fetch('https://telegra.ph/upload', { method: 'POST', body: form });
    const result = await response.json();
    const source = Array.isArray(result) && result[0]?.src ? `https://telegra.ph${result[0].src}` : '';
    if (!source) throw new Error('Upload service did not return a URL.');
    await reply(sock, jid, msg, { text: source });
  } catch (error) {
    await reply(sock, jid, msg, box('URL', `Upload failed: ${error.message}`));
  }
}

async function viewOnceCommand(sock, jid, msg) {
  const media = await downloadQuotedMedia(msg);
  if (!media?.buffer || !['image', 'video', 'audio'].includes(media.type)) return reply(sock, jid, msg, commandHelp('viewonce', '.viewonce (reply to view-once media)'));
  const key = media.type === 'image' ? 'image' : media.type === 'video' ? 'video' : 'audio';
  await sock.sendMessage(jid, { [key]: media.buffer, caption: key === 'audio' ? undefined : 'Recovered media.' }, { quoted: msg });
}

async function imageCommand(sock, jid, msg, params) {
  const prompt = params.join(' ').trim();
  if (!prompt) return reply(sock, jid, msg, commandHelp('img', '.img <description>'));
  const url = `https://image.pollinations.ai/prompt/${encodeURIComponent(prompt)}?width=768&height=768&nologo=true`;
  try {
    await sock.sendMessage(jid, { image: { url }, caption: `Generated image for: ${prompt.slice(0, 200)}` }, { quoted: msg });
  } catch (error) {
    await reply(sock, jid, msg, box('IMG', `Image generation failed: ${error.message}`));
  }
}

async function directVideoCommand(sock, jid, msg, params) {
  const url = params[0];
  if (!/^https?:\/\//i.test(url || '')) return reply(sock, jid, msg, commandHelp('video', '.video <direct .mp4 URL>'));
  try {
    await sock.sendMessage(jid, { video: { url }, mimetype: 'video/mp4', caption: 'Requested video.' }, { quoted: msg });
  } catch (error) {
    await reply(sock, jid, msg, box('VIDEO', `Could not send this video: ${error.message}`));
  }
}

async function socialDownloadCommand(sock, jid, msg, params, service) {
  const url = params[0];
  if (!/^https?:\/\//i.test(url || '')) return reply(sock, jid, msg, commandHelp(service, `.${service} <public URL>`));
  const endpoint = `https://api.hanggts.xyz/download/${service}?url=${encodeURIComponent(url)}`;
  try {
    const response = await fetch(endpoint, { headers: { 'user-agent': 'Mozilla/5.0' } });
    const data = await response.json();
    const candidates = [
      data?.result?.media?.video_hd, data?.result?.media?.video_sd,
      data?.result?.url, data?.result?.download, data?.result?.video,
      data?.data?.url, data?.data?.download, data?.data?.video,
      data?.url, data?.download, data?.video
    ];
    const mediaUrl = candidates.find(value => typeof value === 'string' && /^https?:\/\//i.test(value));
    if (!mediaUrl) throw new Error('No downloadable media was returned for this public post.');
    await sock.sendMessage(jid, { video: { url: mediaUrl }, mimetype: 'video/mp4', caption: `${service} download` }, { quoted: msg });
  } catch (error) {
    await reply(sock, jid, msg, box(service.toUpperCase(), `Download failed: ${error.message}`));
  }
}

async function playCommand(sock, jid, msg, params) {
  const query = params.join(' ').trim();
  if (!query) return reply(sock, jid, msg, commandHelp('play', '.play <song or artist>'));
  const url = `https://www.youtube.com/results?search_query=${encodeURIComponent(query)}`;
  await reply(sock, jid, msg, box('MUSIC SEARCH', `Open this search to choose an official upload:\n${url}`));
}

async function shazamCommand(sock, jid, msg) {
  const media = await downloadQuotedMedia(msg);
  if (!media?.buffer || media.type !== 'audio') return reply(sock, jid, msg, commandHelp('shazam', '.shazam (reply to audio)'));
  const token = process.env.AUDD_API_TOKEN;
  if (!token) return reply(sock, jid, msg, box('SHAZAM', 'Audio recognition requires AUDD_API_TOKEN in the server environment. The replied audio was received correctly.'));
  try {
    const form = new FormData();
    form.append('api_token', token);
    form.append('return', 'apple_music,spotify');
    form.append('file', new Blob([media.buffer]), 'audio.ogg');
    const response = await fetch('https://api.audd.io/', { method: 'POST', body: form });
    const data = await response.json();
    if (!data?.result) throw new Error(data?.error?.error_message || 'No match found.');
    const result = data.result;
    await reply(sock, jid, msg, box('SONG RECOGNIZED', `Title: ${result.title}\nArtist: ${result.artist}\nAlbum: ${result.album || 'Unknown'}`));
  } catch (error) {
    await reply(sock, jid, msg, box('SHAZAM', `Recognition failed: ${error.message}`));
  }
}

async function vbookCommand(sock, jid, msg, params) {
  const title = params.join(' ').trim();
  if (!title) return reply(sock, jid, msg, commandHelp('vbook', '.vbook <title>'));
  const tempDir = path.join(__dirname, '../../tmp');
  fs.mkdirSync(tempDir, { recursive: true });
  const output = path.join(tempDir, `vbook-${Date.now()}.mp4`);
  const safeTitle = title.replace(/[\\:'\[\],;]/g, ' ').slice(0, 80);
  const font = '/usr/share/fonts/truetype/dejavu/DejaVuSans.ttf';
  const filter = `drawtext=fontfile=${font}:text='${safeTitle.replace(/'/g, "\\'")}' :fontcolor=white:fontsize=42:x=(w-text_w)/2:y=(h-text_h)/2`;
  try {
    await new Promise((resolve, reject) => {
      const process = spawn(ffmpegPath, ['-y', '-f', 'lavfi', '-i', 'color=c=0x111827:s=720x720:d=4', '-vf', filter, '-pix_fmt', 'yuv420p', output], { stdio: 'ignore' });
      process.once('error', reject);
      process.once('close', code => code === 0 ? resolve() : reject(new Error(`FFmpeg exited with code ${code}`)));
    });
    await sock.sendMessage(jid, { video: fs.readFileSync(output), mimetype: 'video/mp4', caption: `Video book: ${title}` }, { quoted: msg });
  } catch (error) {
    await reply(sock, jid, msg, box('VBOOK', `Could not make the video book: ${error.message}`));
  } finally {
    try { fs.unlinkSync(output); } catch (_) {}
  }
}

async function updateCommand(sock, jid, msg) {
  await reply(sock, jid, msg, box('BOT UPDATE', `Name: ${global.botname}\nVersion: ${global.version}\nCommand registry: active\nUse .menu to view the current command index.`));
}

async function handleGuardWatch(sock, msg) {
  try {
    const jid = msg?.key?.remoteJid;
    if (!isGroup(jid) || msg.key.fromMe) return;
    if (state.chatbot[jid]) {
      const context = messageContext(msg);
      const botNumber = normalizeJidNumber(sock.user?.id);
      const mentioned = (context.mentionedJid || []).some(item => normalizeJidNumber(item) === botNumber);
      const replied = normalizeJidNumber(context.participant) === botNumber;
      const text = getMessageText(msg).trim();
      const prefix = global.getBotPrefix ? global.getBotPrefix(botNumber) : '.';
      if ((mentioned || replied) && text && !text.startsWith(prefix)) {
        await reply(sock, jid, msg, box('CHATBOT', 'Hello. For detailed answers, use .ai followed by your question.'));
      }
    }
    const guard = state.guards[jid];
    if (!guard) return;
    const text = getMessageText(msg).toLowerCase();
    const hasLink = /https?:\/\/\S+|www\.\S+|(?:[a-z0-9-]+\.)+[a-z]{2,}(?:\/\S*)?/i.test(text);
    const hasTag = (messageContext(msg).mentionedJid || []).length > 0;
    const hasBadWord = guard.badword?.enabled && guard.badword.words.some(word => text.includes(word));
    if (!(hasBadWord || (guard.antitag && hasTag) || (guard.antilink && guard.antilink !== 'off' && hasLink))) return;
    const metadata = await sock.groupMetadata(jid);
    const sender = msg.key.participant || jid;
    if (participantIsAdmin(metadata, sender) || !participantIsAdmin(metadata, sock.user?.id)) return;
    await sock.sendMessage(jid, { delete: { remoteJid: jid, id: msg.key.id, fromMe: false, participant: sender } });
    if (guard.antilink === 'kick') {
      await sock.groupParticipantsUpdate(jid, [sender], 'remove');
    } else if (guard.antilink === 'warn') {
      const number = normalizeJidNumber(sender);
      state.warnings[jid] ||= {};
      state.warnings[jid][number] = Number(state.warnings[jid][number] || 0) + 1;
      saveState();
    }
  } catch (error) {
    console.log('[group-guard]', error.message);
  }
}

async function modeCommand(sock, jid, msg, params, context, explicitMode = '') {
  if (!context.isOwner) return reply(sock, jid, msg, box('ACCESS DENIED', 'Only the bot owner can change bot mode.'));
  const selected = explicitMode || String(params[0] || '').toLowerCase();
  const botNumber = normalizeJidNumber(sock.user?.id);
  if (['private', 'priv', 'self'].includes(selected)) {
    global.setBotSelfMode([botNumber], true);
    return reply(sock, jid, msg, box('MODE CHANGED', 'This bot is now in self mode.'));
  }
  if (['public', 'pub'].includes(selected)) {
    global.setBotSelfMode([botNumber], false);
    return reply(sock, jid, msg, box('MODE CHANGED', 'This bot is now in public mode.'));
  }
  return reply(sock, jid, msg, box('MODE', `Current mode: ${global.isBotSelfMode(botNumber) ? 'Self' : 'Public'}\n\nUsage: .mode self|public`));
}

async function mentionCommand(sock, jid, msg, params) {
  const targets = targetJids(msg, params);
  if (!targets.length) return reply(sock, jid, msg, commandHelp('mention', '.mention @user <message>'));
  const message = params.filter(value => !String(value).replace(/[^0-9]/g, '') || String(value).replace(/[^0-9]/g, '').length < 8).join(' ').trim();
  const labels = targets.map(target => `@${normalizeJidNumber(target)}`).join(' ');
  await reply(sock, jid, msg, { text: `${labels}${message ? ` ${message}` : ''}`, mentions: targets });
}

async function complimentCommand(sock, jid, msg) {
  const target = targetJids(msg)[0];
  if (!target) return reply(sock, jid, msg, commandHelp('compliment', '.compliment @user'));
  const options = [
    'You have a great sense of humor!',
    'Your kindness makes a real difference.',
    'You are more capable than you realize.',
    'Your positive energy is appreciated.'
  ];
  const text = options[Math.floor(Math.random() * options.length)];
  await reply(sock, jid, msg, { text: `@${normalizeJidNumber(target)} ${text}`, mentions: [target] });
}

async function randomCommand(sock, jid, msg, params) {
  const max = Math.max(2, Math.min(1000000, Number(params[0]) || 100));
  const value = Math.floor(Math.random() * max) + 1;
  await reply(sock, jid, msg, box('RANDOM', `Random number: ${value} (1–${max})`));
}

async function searchCommand(sock, jid, msg, params) {
  const query = params.join(' ').trim();
  if (!query) return reply(sock, jid, msg, commandHelp('ais', '.ais <search query>'));
  try {
    const endpoint = `https://api.duckduckgo.com/?q=${encodeURIComponent(query)}&format=json&no_html=1&skip_disambig=1`;
    const data = await (await fetch(endpoint)).json();
    const rows = [];
    if (data.AbstractText) rows.push(data.AbstractText);
    for (const item of (data.RelatedTopics || []).filter(item => item?.Text).slice(0, 4)) rows.push(item.Text);
    const url = data.AbstractURL || `https://www.google.com/search?q=${encodeURIComponent(query)}`;
    if (!rows.length) rows.push('No instant-answer summary was available. Open the search link below for current results.');
    await reply(sock, jid, msg, box('AI SEARCH', `${rows.join('\n\n')}\n\nSource: ${url}`));
  } catch (error) {
    await reply(sock, jid, msg, box('AI SEARCH', `Search failed: ${error.message}`));
  }
}

async function groupManageCommand(sock, jid, msg, params, context) {
  const metadata = await requireGroupAdmin(sock, jid, msg, context, 'GROUP MANAGE');
  if (!metadata) return;
  const action = String(params[0] || '').toLowerCase();
  const value = params.slice(1).join(' ').trim();
  try {
    if (action === 'name' && value) await sock.groupUpdateSubject(jid, value);
    else if ((action === 'desc' || action === 'description') && value) await sock.groupUpdateDescription(jid, value);
    else if (action === 'lock') await sock.groupSettingUpdate(jid, 'announcement');
    else if (action === 'open') await sock.groupSettingUpdate(jid, 'not_announcement');
    else return reply(sock, jid, msg, box('GROUP MANAGE', 'Usage:\n.groupmanage name <name>\n.groupmanage desc <description>\n.groupmanage lock\n.groupmanage open\n\nUse .gpsetpic to change the group picture.'));
    await reply(sock, jid, msg, box('GROUP MANAGE', 'Group setting updated successfully.'));
  } catch (error) {
    await reply(sock, jid, msg, box('GROUP MANAGE', `Could not update the group: ${error.message}`));
  }
}

async function chatbotCommand(sock, jid, msg, params, context) {
  const metadata = await requireGroupAdmin(sock, jid, msg, context, 'CHATBOT');
  if (!metadata) return;
  const action = String(params[0] || '').toLowerCase();
  if (action === 'on') state.chatbot[jid] = true;
  else if (action === 'off') state.chatbot[jid] = false;
  else return reply(sock, jid, msg, box('CHATBOT', `Status: ${state.chatbot[jid] ? 'ON' : 'OFF'}\n\nUsage: .chatbot on|off\nWhen enabled, mention or reply to the bot for a quick response.`));
  saveState();
  await reply(sock, jid, msg, box('CHATBOT', `Chatbot is now ${state.chatbot[jid] ? 'ON' : 'OFF'} for this group.`));
}

async function resetLinkCommand(sock, jid, msg, params, context) {
  const metadata = await requireGroupAdmin(sock, jid, msg, context, 'RESET LINK');
  if (!metadata) return;
  try {
    const code = await sock.groupRevokeInvite(jid);
    await reply(sock, jid, msg, box('RESET LINK', `New invite link:\nhttps://chat.whatsapp.com/${code}`));
  } catch (error) {
    await reply(sock, jid, msg, box('RESET LINK', `Could not reset the invite link: ${error.message}`));
  }
}

async function sudoCommand(sock, jid, msg, params, context) {
  if (!context.isOwner) return reply(sock, jid, msg, box('ACCESS DENIED', 'Only the bot owner can manage sudo users.'));
  const action = String(params[0] || '').toLowerCase();
  const target = targetJids(msg, params.slice(1))[0];
  if (action === 'list') {
    const owners = global.db.owners.map(entry => `@${entry.number}`).join('\n') || 'No additional sudo users.';
    return reply(sock, jid, msg, box('SUDO USERS', owners), { mentions: global.db.owners.map(entry => `${entry.number}@s.whatsapp.net`) });
  }
  if (!target || !['add', 'del', 'remove'].includes(action)) {
    return reply(sock, jid, msg, box('SUDO', 'Usage: .sudo add @user\n.sudo del @user\n.sudo list'));
  }
  const number = normalizeJidNumber(target);
  if (action === 'add') {
    if (!global.db.owners.some(entry => entry.number === number)) {
      global.db.owners.push({ number, addedBy: normalizeJidNumber(context.sender) });
      global.saveOwners();
    }
    return reply(sock, jid, msg, box('SUDO', `@${number} is now a sudo user.`), { mentions: [target] });
  }
  global.db.owners = global.db.owners.filter(entry => entry.number !== number);
  global.saveOwners();
  await reply(sock, jid, msg, box('SUDO', `Removed sudo access for @${number}.`), { mentions: [target] });
}

const CORE_COMMANDS = [
  { name: 'accept', description: 'Approve pending group join requests', execute: acceptCommand },
  { name: 'antibadword', description: 'Configure bad-word moderation', execute: (s, j, m, a, c) => guardCommand(s, j, m, a, c, 'antibadword') },
  { name: 'antilink', description: 'Configure link moderation', execute: (s, j, m, a, c) => guardCommand(s, j, m, a, c, 'antilink') },
  { name: 'antitag', description: 'Configure tag moderation', execute: (s, j, m, a, c) => guardCommand(s, j, m, a, c, 'antitag') },
  { name: 'mode', aliases: ['m'], description: 'Set self or public mode', execute: modeCommand },
  { name: 'private', aliases: ['priv'], description: 'Set self mode', execute: (s, j, m, a, c) => modeCommand(s, j, m, a, c, 'private') },
  { name: 'public', aliases: ['pub'], description: 'Set public mode', execute: (s, j, m, a, c) => modeCommand(s, j, m, a, c, 'public') },
  { name: 'ban', description: 'Ban a user from bot commands', execute: banCommand },
  { name: 'unban', description: 'Restore a banned user', execute: (s, j, m, a, c) => banCommand(s, j, m, a, c, true) },
  { name: 'banned', aliases: ['banlist'], description: 'List banned users', execute: listBansCommand },
  { name: 'warn', aliases: ['w'], description: 'Warn a group member', execute: warnCommand },
  { name: 'warnings', aliases: ['checkwarn', 'warnlist'], description: 'Check a member warning count', execute: (s, j, m, a, c) => warnCommand(s, j, m, a, c, true) },
  { name: 'delete', aliases: ['del'], description: 'Delete a replied group message', execute: deleteCommand },
  { name: 'kick', description: 'Remove a group member', execute: (s, j, m, a, c) => moderateParticipant(s, j, m, a, c, 'remove') },
  { name: 'promote', aliases: ['addadmin'], description: 'Promote a group member', execute: (s, j, m, a, c) => moderateParticipant(s, j, m, a, c, 'promote') },
  { name: 'demote', description: 'Demote a group admin', execute: (s, j, m, a, c) => moderateParticipant(s, j, m, a, c, 'demote') },
  { name: 'mute', aliases: ['silence'], description: 'Restrict group posting to admins', execute: muteCommand },
  { name: 'unmute', aliases: ['unsilence'], description: 'Allow all group members to post', execute: (s, j, m, a, c) => muteCommand(s, j, m, a, c, true) },
  { name: 'tagall', aliases: ['tag', 'mentionall'], description: 'Mention every member', execute: (s, j, m, a, c) => tagCommand(s, j, m, a, c) },
  { name: 'hidetag', aliases: ['taghide'], description: 'Silently mention every member', execute: (s, j, m, a, c) => tagCommand(s, j, m, a, c, true) },
  { name: 'tagnotadmin', aliases: ['tagmembers'], description: 'Mention non-admin members', execute: (s, j, m, a, c) => tagCommand(s, j, m, a, c, false, true) },
  { name: 'groupinfo', aliases: ['ginfo', 'gi'], description: 'Show group details', execute: groupInfoCommand },
  { name: 'groupmanage', aliases: ['gmanage'], description: 'Manage group name, description, and posting mode', execute: groupManageCommand },
  { name: 'chatbot', description: 'Enable or disable group chatbot replies', execute: chatbotCommand },
  { name: 'setprefix', aliases: ['changeprefix', 'prefix'], description: 'Change the command prefix', execute: setPrefixCommand },
  { name: 'settings', aliases: ['config', 'set'], description: 'Show bot settings', execute: settingsCommand },
  { name: 'system', description: 'Show server status', execute: systemCommand },
  { name: 'goodnight', description: 'Send a good-night message', execute: goodnightCommand },
  { name: 'ais', aliases: ['aisearch'], description: 'Search the web for a concise answer', execute: searchCommand },
  { name: 'compliment', description: 'Send a compliment to a mentioned user', execute: complimentCommand },
  { name: 'mention', description: 'Mention a user with a message', execute: mentionCommand },
  { name: 'random', description: 'Generate a random number', execute: randomCommand },
  { name: 'resetlink', aliases: ['newlink', 'revoke'], description: 'Reset a group invite link', execute: resetLinkCommand },
  { name: 'sudo', description: 'Manage owner-authorized sudo users', execute: sudoCommand },
  { name: 'sniff', aliases: ['decrypt'], description: 'Find domains in a replied document', execute: sniffCommand },
  { name: 'sticker', aliases: ['s', 'stick'], description: 'Make a sticker from replied media', execute: makeSticker },
  { name: 'take', description: 'Make a sticker from replied media', execute: makeSticker },
  { name: 'stickertelegram', aliases: ['tgsticker', 'tgs', 'tg'], description: 'Make a sticker from replied media', execute: makeSticker },
  { name: 'tts', aliases: ['texttospeech', 'speak'], description: 'Turn text into speech', execute: ttsCommand },
  { name: 'url', aliases: ['upload', 'geturl'], description: 'Upload replied media to a URL', execute: uploadCommand },
  { name: 'viewonce', aliases: ['vo', 'vv'], description: 'Copy replied view-once media', execute: viewOnceCommand },
  { name: 'img', aliases: ['image', 'generate'], description: 'Generate an image from text', execute: imageCommand },
  { name: 'video', aliases: ['vid', 'downloadvideo'], description: 'Send a direct MP4 URL', execute: directVideoCommand },
  { name: 'facebook', aliases: ['fb', 'fbdl'], description: 'Download public Facebook video', execute: (s, j, m, a) => socialDownloadCommand(s, j, m, a, 'facebook') },
  { name: 'instagram', aliases: ['ig', 'igdl'], description: 'Download public Instagram video', execute: (s, j, m, a) => socialDownloadCommand(s, j, m, a, 'instagram') },
  { name: 'play', description: 'Find an official music upload', execute: playCommand },
  { name: 'song', description: 'Find an official music upload', execute: playCommand },
  { name: 'shazam', aliases: ['recognize', 'music'], description: 'Recognize replied audio', execute: shazamCommand },
  { name: 'vbook', aliases: ['videobook'], description: 'Create a title video', execute: vbookCommand },
  { name: 'update', description: 'Show bot version and update status', execute: updateCommand }
];

module.exports = { CORE_COMMANDS, isBanned, handleGuardWatch };
