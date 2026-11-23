// Banc navigateur de Seal Helper (ecriture) : node run.mjs. Deux editeurs : contenteditable simple, ProseMirror (TipTap).
import { createRequire } from 'module';
import { readFileSync } from 'fs';
import { fileURLToPath } from 'url';
import path from 'path';
const require = createRequire(import.meta.url);
const { chromium } = require(process.env.PLAYWRIGHT || '/root/lemo-opuscar/node_modules/playwright-core');
const here = path.dirname(fileURLToPath(import.meta.url)); const ext = path.join(here, '..');
const shots = process.env.SHOTS || here;
const STUB = `window.__store = { sync: {}, local: {} };
  const area = n => ({ get: (k, cb) => { const o = {}; for (const x of [].concat(k)) if (x in __store[n]) o[x] = __store[n][x]; setTimeout(() => cb(o), 0); }, set: (o, cb) => { Object.assign(__store[n], JSON.parse(JSON.stringify(o))); cb && cb(); }, remove: k => { delete __store[n][k]; } });
  window.chrome = { storage: { sync: area('sync'), local: area('local'), onChanged: { addListener() {} } }, runtime: { onMessage: { addListener() {} }, getManifest: () => ({ version: 'bench' }) } };`;
const WORD = `<html xmlns:o="urn:schemas-microsoft-com:office:office" xmlns:w="urn:schemas-microsoft-com:office:word"><body><!--StartFragment-->
<h1>Intracellular staining</h1>
<p class=MsoListParagraphCxSpFirst style='margin-left:36.0pt;text-indent:-18.0pt;mso-list:l0 level1 lfo1'><![if !supportLists]><span style='mso-list:Ignore'>1.<span style='font:7.0pt "Times New Roman"'>&nbsp;&nbsp;&nbsp;</span></span><![endif]>Fix cells 30 min at RT in 100 µL <b>Fix/Perm</b></p>
<p class=MsoListParagraphCxSpMiddle style='margin-left:72.0pt;text-indent:-18.0pt;mso-list:l0 level2 lfo1'><![if !supportLists]><span style='mso-list:Ignore'>a.<span>&nbsp;</span></span><![endif]>Vortex before adding</p>
<p class=MsoListParagraphCxSpMiddle style='margin-left:72.0pt;text-indent:-18.0pt;mso-list:l0 level2 lfo1'><![if !supportLists]><span style='mso-list:Ignore'>b.<span>&nbsp;</span></span><![endif]>Protect from light</p>
<p class=MsoListParagraphCxSpLast style='margin-left:36.0pt;text-indent:-18.0pt;mso-list:l0 level1 lfo1'><![if !supportLists]><span style='mso-list:Ignore'>2.<span>&nbsp;</span></span><![endif]>Wash twice in 200 µL Perm buffer</p>
<p class=MsoListParagraph style='margin-left:36.0pt;mso-list:l1 level1 lfo2'><![if !supportLists]><span style='font-family:Symbol;mso-list:Ignore'>·<span>&nbsp;</span></span><![endif]>Keep on ice</p>
<table class=MsoTableGrid border=1><tr><td><p class=MsoNormal><b>Antibody</b></p></td><td><p class=MsoNormal><b>Fluorochrome</b></p></td><td><p class=MsoNormal><b>Dilution</b></p></td></tr>
<tr><td><p class=MsoNormal>Bcl6</p></td><td><p class=MsoNormal>PE</p></td><td><p class=MsoNormal>1:50</p></td></tr>
<tr><td><p class=MsoNormal>Foxp3</p></td><td><p class=MsoNormal>AF647</p></td><td><p class=MsoNormal>1:100</p></td></tr></table><!--EndFragment--></body></html>`;
let fails = 0;
const ok = (name, cond, extra = '') => { console.log((cond ? 'ok   ' : 'FAIL ') + name + (extra ? '  ' + extra : '')); if (!cond) fails++; };
const browser = await chromium.launch();
async function open(file, waitFor) {
  const page = await browser.newPage({ viewport: { width: 1320, height: 860 } });
  page.on('pageerror', e => { console.log('PAGE ERROR ' + e.message); fails++; });
  await page.addInitScript(STUB);
  await page.goto('file://' + path.join(here, file));
  if (waitFor) await page.waitForFunction(waitFor, null, { timeout: 30000 });
  await page.addStyleTag({ content: readFileSync(path.join(ext, 'content.css'), 'utf8') + readFileSync(path.join(ext, 'write.css'), 'utf8').replace(/chrome-extension:\/\/__MSG_@@extension_id__/g, 'file://' + ext) });
  for (const f of ['engine/seal.js', 'engine/detect.js', 'engine/parse.js', 'engine/edit.js', 'engine/mix.js', 'engine/copy.js', 'write.js']) await page.addScriptTag({ content: readFileSync(path.join(ext, f), 'utf8') });
  await page.waitForTimeout(200);
  return page;
}
const html = (page, sel) => page.evaluate(s => document.querySelector(s).innerHTML, sel);
// Selectionne un passage de texte comme le ferait la souris.
const select = (page, sel, text) => page.evaluate(([s, t]) => {
  const el = document.querySelector(s); const w = document.createTreeWalker(el, NodeFilter.SHOW_TEXT);
  for (let n = w.nextNode(); n; n = w.nextNode()) { const i = n.nodeValue.indexOf(t); if (i >= 0) { const r = document.createRange(); r.setStart(n, i); r.setEnd(n, i + t.length); el.closest('[contenteditable]').focus(); const x = getSelection(); x.removeAllRanges(); x.addRange(r); return true; } }
  return false; }, [sel, text]);
const caretEnd = (page, sel) => page.evaluate(s => { const el = document.querySelector(s); el.closest('[contenteditable]').focus(); const r = document.createRange(); r.selectNodeContents(el); r.collapse(false); const x = getSelection(); x.removeAllRanges(); x.addRange(r); }, sel);
const paste = (page, h, t) => page.evaluate(([h, t]) => { const dt = new DataTransfer(); dt.setData('text/html', h); dt.setData('text/plain', t); const n = getSelection().anchorNode; (n.nodeType === 1 ? n : n.parentElement).dispatchEvent(new ClipboardEvent('paste', { clipboardData: dt, bubbles: true, cancelable: true })); }, [h, t]);
const diag = page => page.evaluate(() => window.SealHelperWrite.diag());

for (const [name, file, ED, waitFor] of [['plain', 'plain.html', '[data-native-document-editor]', null], ['prosemirror', 'tiptap.html', '.ProseMirror', 'window.ready === true']]) {
  console.log('\n== ' + name);
  const page = await open(file, waitFor);
  const P = name === 'plain' ? '#end' : ED + ' > p:last-child';
  // 1. barre
  await page.waitForSelector('#sh-wbar');
  ok('bar shown when reading (Bench, Aa, words)', /Bench/.test(await html(page, '#sh-wbar')) && !/Value/.test(await html(page, '#sh-wbar')));
  // 2. valeur sur une selection
  ok('select text', await select(page, ED, '30 min'));
  await page.waitForSelector('#sh-wbubble');
  ok('bar in edit state', /Value/.test(await html(page, '#sh-wbar')));
  await page.click('#sh-wbubble .sh-wb.val'); await page.waitForTimeout(350);
  // Un contenteditable nu (voie insertHTML) ne garde que le gras : Chrome retire le span. ProseMirror (voie collage) garde le bleu.
  ok('Value marks the selection' + (name === 'plain' ? ' (bold only on this path)' : ' blue'), (name === 'plain' ? /<(strong|b)>30 min/ : /data-native-color="blue"[^>]*>(<strong>|<b>)?30 min/).test(await html(page, ED)), (await diag(page)).split('\n')[0]);
  // 3. gras par le raccourci rendu a l editeur
  await select(page, ED, 'CXCR5'); await page.waitForTimeout(200);
  await page.click('#sh-wbar .sh-wb >> nth=0'); await page.waitForTimeout(200);
  ok('Bold', /<(strong|b)>CXCR5/.test(await html(page, ED)));
  // 4. collage Word nettoye
  await caretEnd(page, P); await page.keyboard.press('Enter'); await page.waitForTimeout(800); // l editeur regroupe sinon Entree et collage dans la meme annulation
  await paste(page, WORD, 'plain'); await page.waitForTimeout(500);
  let out = await html(page, ED);
  const t0 = await page.evaluate(() => document.querySelector('#sh-wtoast')?.textContent || '');
  ok('protocol paste: lab format by default', /lab protocol format/.test(t0) && /<h2[^>]*>I\. /.test(out) && /Vortex before adding/.test(out) && /Bcl6/.test(out), t0);
  if (name === 'prosemirror') console.log('     ' + out.replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').replace(/-{20,}/g, '[rule]').slice(60, 420));
  await page.screenshot({ path: path.join(shots, name + '-0-protocol.png') });
  await page.click('#sh-wtoast button:has-text("Keep the Word layout")'); await page.waitForTimeout(900);
  out = await html(page, ED);
  ok('Keep the Word layout replaces it', !/<h2[^>]*>I\. /.test(out) && (out.match(/Vortex before adding/g) || []).length === 1);
  ok('clean paste: nested sub-steps', /<li>(<p>)?Fix cells[\s\S]*?<ol[^>]*>\s*<li>(<p>)?Vortex before adding[\s\S]*?Protect from light/.test(out));
  ok('clean paste: bullet list kept as bullets', /<ul[^>]*>\s*<li>(<p>)?Keep on ice/.test(out));
  ok('clean paste: table rebuilt', /<table[\s\S]*Bcl6[\s\S]*AF647/.test(out) && !/Mso/.test(out));
  ok('clean paste: values marked', (name === 'plain' ? /<(strong|b)>100 µL/ : /data-native-color="blue"[^>]*>(<strong>|<b>)?100 µL/).test(out));
  ok('clean paste: heading', /<h2[^>]*>Intracellular staining/.test(out));
  const toast = await page.evaluate(() => document.querySelector('#sh-wtoast')?.textContent || '');
  ok('toast counts', /3 steps, 2 sub-steps, 1 table/.test(toast), toast);
  await page.screenshot({ path: path.join(shots, name + '-1-paste.png') });
  // 5. Ctrl+Shift+V laisse faire Seal
  // 6. Blocks par Ctrl+J
  await caretEnd(page, ED + ' h2'); await page.waitForTimeout(150);
  await page.keyboard.press('Control+j'); await page.waitForSelector('.sh-wpop[data-kind="blocks"]');
  await page.screenshot({ path: path.join(shots, name + '-2-blocks.png') });
  await page.keyboard.type('buff'); await page.keyboard.press('Enter'); await page.waitForTimeout(500);
  out = await html(page, ED);
  ok('Blocks > Buffer recipe inserts a table', /Component[\s\S]*Stock[\s\S]*Final/.test(out));
  // 7. « / » en ecrivant
  await caretEnd(page, name === 'plain' ? '#s4' : ED + ' ol li:first-child p'); await page.waitForTimeout(150);
  await page.keyboard.type(' /dat'); await page.waitForTimeout(250);
  ok('typing / opens Blocks', !!(await page.$('.sh-wpop[data-kind="blocks"]')));
  await page.keyboard.press('Enter'); await page.waitForTimeout(400);
  out = await html(page, ED);
  ok('/date inserts the date and removes “/dat”', /\d{1,2} \w{3} 20\d\d/.test(out) && !/\/dat/.test(out), out.replace(/<[^>]+>/g, ' ').slice(-260));
  // 8. mix
  await page.keyboard.press('Control+j'); await page.waitForSelector('.sh-wpop[data-kind="blocks"]');
  await page.keyboard.type('mix'); await page.keyboard.press('Enter'); await page.waitForSelector('.sh-wpop[data-kind="mix"] textarea');
  await page.fill('.sh-wpop[data-kind="mix"] textarea', 'Marker\tFluorochrome\tDilution\nCXCR5\tBV421\t1:50\nPD-1\tPE-Cy7\t1:100\nCD4\tBUV395\t1:200');
  await page.waitForTimeout(150);
  await page.screenshot({ path: path.join(shots, name + '-3-mix.png') });
  const prev = await page.evaluate(() => document.querySelector('.sh-wprev').textContent);
  ok('mix preview: 12 samples +10 % at 50 µL = 660 µL, CXCR5 13.2', /660 µL/.test(prev) && /13\.2 µL/.test(prev) && /636\.9 µL/.test(prev), prev.slice(0, 160));
  await page.click('.sh-wpop[data-kind="mix"] button.pri'); await page.waitForTimeout(500);
  ok('mix inserted', /CXCR5[\s\S]*13\.2 µL/.test(await html(page, ED)));
  // 9. symboles
  await caretEnd(page, ED + ' h2'); await page.waitForTimeout(150);
  await page.click('#sh-wbar .sh-wb:has-text("µ °C ±")'); await page.click('.sh-wsym button:has-text("≥")'); await page.waitForTimeout(150);
  ok('symbol typed', /≥/.test(await html(page, ED)));
  await page.keyboard.press('Escape');
  // 10. confort
  await page.click('#sh-wbar .sh-wb:has-text("Aa")'); await page.click('.sh-wseg button:has-text("Large")'); await page.click('.sh-wseg button:has-text("Atkinson")');
  await page.waitForTimeout(150);
  ok('reading comfort classes', await page.evaluate(() => document.documentElement.matches('.sh-v-size-l.sh-v-face-atk')));
  await page.screenshot({ path: path.join(shots, name + '-4-comfort.png') });
  await page.keyboard.press('Escape');
  // 11. paillasse
  await caretEnd(page, ED + ' h2'); await page.keyboard.press('Enter'); await page.waitForTimeout(200);
  await page.click('#sh-wbar .sh-wb:has-text("Bench")'); await page.waitForSelector('#sh-bench');
  const n = await page.$$eval('#sh-bench .sh-bstep', l => l.length);
  ok('bench lists the steps', n >= 4, n + ' steps');
  await page.click('#sh-bench .sh-bstep >> nth=0 >> .sh-bbox');
  await page.click('#sh-bench .sh-bstep >> nth=1 >> .sh-blink:has-text("Deviation")');
  await page.fill('#sh-bench .sh-bnote', 'lysed 3 min'); await page.keyboard.press('Tab'); await page.waitForTimeout(150);
  const start = await page.$('#sh-bench .sh-blink:has-text("Start")'); ok('a timed step offers a timer', !!start); if (start) await start.click();
  await page.waitForTimeout(1200);
  ok('timer runs', /left/.test(await html(page, '#sh-bench .sh-btimers')));
  await page.screenshot({ path: path.join(shots, name + '-5-bench.png') });
  await page.click('#sh-bench .sh-bbtn.pri'); await page.waitForTimeout(700);
  out = await html(page, ED);
  ok('run log written at the cursor', /Run log, [\s\S]*Done at[\s\S]*lysed 3 min/.test(out) && !(await page.$('#sh-bench')));
  await page.screenshot({ path: path.join(shots, name + '-6-end.png'), fullPage: true });
  console.log((await diag(page)).split('\n').map(l => '     ' + l.slice(0, 230)).join('\n'));
  await page.close();
}
await browser.close();
console.log(fails ? '\n' + fails + ' FAILED' : '\nall green');
process.exit(fails ? 1 : 0);
