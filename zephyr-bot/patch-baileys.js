const fs = require('fs');
const path = require('path');

function patchRichMenu() {
  const file = path.join(__dirname, 'node_modules', '@mrlegendbot', 'baileys', 'lib', 'Socket', 'messages-send.js');
  if (!fs.existsSync(file)) return false;
  let source = fs.readFileSync(file, 'utf8');
  let changed = false;

  if (!source.includes('const richMenuInstanceId = `${Date.now().toString(36)}_')) {
    const start = source.indexOf('    const richMenu = async (target, content = {}) => {');
    const marker = '      let header = content?.header;';
    const markerPos = start >= 0 ? source.indexOf(marker, start) : -1;
    if (markerPos >= 0) {
      source = source.slice(0, markerPos) +
        "      const richMenuInstanceId = `${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 10)}`;\n" +
        source.slice(markerPos);
      changed = true;
    }
  }

  source = source.replace('tool_call_id: `${cardIndex}${buttonIndex}`', 'tool_call_id: `${richMenuInstanceId}_${cardIndex}_${buttonIndex}`');
  source = source.replace('tool_call_id: `${buttonIndex}`', 'tool_call_id: `${richMenuInstanceId}_${buttonIndex}`');

  const footerStart = source.indexOf('      if (footer) {');
  const footerEndMarker = '      const waMsg = generateWAMessageFromContent(target, {';
  const footerEnd = footerStart >= 0 ? source.indexOf(footerEndMarker, footerStart) : -1;
  const newFooter = `      if (footer) {
        const footerButtons = Array.isArray(footer?.buttons) && footer.buttons.length
          ? footer.buttons
          : [{ text: footer?.text || 'Tg', url: footer?.url || 't.me/thesatanicmirror' }];
        footerButtons
          .filter(btn => btn && (btn.text || btn.url))
          .forEach(btn => sex.push({
            view_model: {
              primitives: [{
                cta_text: btn.text || 'Open',
                cta_type: 'OPEN_URL',
                cta_url: btn.url || 'https://example.com',
                __typename: 'GenAIFooterActionPrimitive'
              }],
              __typename: 'GenAIActionRowLayoutViewModel'
            }
          }));
      }
`;
  if (footerStart >= 0 && footerEnd >= 0) {
    source = source.slice(0, footerStart) + newFooter + source.slice(footerEnd);
    changed = true;
  } else if (!source.includes('Array.isArray(footer?.buttons)')) {
    console.log('⚠️ Multi-footer patch target not found; leaving existing footer implementation.');
  }

  if (changed) fs.writeFileSync(file, source);
  return true;
}
try {
  if (patchRichMenu()) console.log('✅ Rich Menu patch ready (repeat-click + multi-footer buttons).');
} catch (e) { console.log('⚠️ Rich Menu patch skipped:', e.message || e); }
