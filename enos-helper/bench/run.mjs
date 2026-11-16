// Banc enos Helper : charge l extension dans Chrome (headless) sur une page enos factice
// (adresse qui ne change jamais, rail, barre orange, fil d Ariane, table avec loupes, volet Details).
// EH_BENCH_DIR=<dossier temporaire> NODE_PATH=/opt/atlas-plaquo/node_modules node bench/run.mjs
import { createRequire } from 'node:module';
import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
const require = createRequire(import.meta.url);
const puppeteer = require('puppeteer');
const here = path.dirname(fileURLToPath(import.meta.url));
const src = path.resolve(here, '..');
// Copie de l extension dont le manifeste vise le serveur du banc au lieu d enos.
const ext = fs.mkdtempSync(path.join(process.env.EH_BENCH_DIR || '/tmp', 'enos-helper-bench-'));
for (const f of ['manifest.json', 'background.js', 'content.js', 'content.css', 'popup.html', 'popup.js']) fs.copyFileSync(path.join(src, f), path.join(ext, f));
fs.mkdirSync(path.join(ext, 'icons')); for (const f of fs.readdirSync(path.join(src, 'icons'))) fs.copyFileSync(path.join(src, 'icons', f), path.join(ext, 'icons', f));
const man = JSON.parse(fs.readFileSync(path.join(ext, 'manifest.json'), 'utf8')); man.content_scripts[0].matches = ['http://127.0.0.1/*']; fs.writeFileSync(path.join(ext, 'manifest.json'), JSON.stringify(man));

let fails = 0;
const ok = (cond, msg) => { console.log((cond ? 'ok   ' : 'FAIL ') + msg); if (!cond) fails++; };
const sleep = ms => new Promise(r => setTimeout(r, ms));

const srv = http.createServer((req, res) => { res.setHeader('content-type', 'text/html'); res.end(fs.readFileSync(path.join(here, 'mock.html'))); });
await new Promise(r => srv.listen(0, '127.0.0.1', r));
const base = 'http://127.0.0.1:' + srv.address().port + '/#/Project/list/';

const browser = await puppeteer.launch({ headless: true, args: ['--no-sandbox', `--disable-extensions-except=${ext}`, `--load-extension=${ext}`] });
const sw = await browser.waitForTarget(t => t.type() === 'service_worker', { timeout: 10000 }).then(t => t.worker());
const setOpts = o => sw.evaluate(async o => { await chrome.storage.sync.set({ enosHelper: o }); }, o);
const page = await browser.newPage();
await page.setViewport({ width: 1400, height: 900 });
page.on('pageerror', e => console.log('page error', e.message));
page.on('console', m => { if (m.type() === 'error' || m.type() === 'warning') console.log('console', m.type(), m.text()); });
await page.goto(base);
await sleep(800);
ok(await page.$('#eh-side'), 'sidebar mounted');
ok(await page.$eval('#eh-tab', e => getComputedStyle(e).display !== 'none'), 'drawer tab visible');
ok(await page.$eval('html', e => !e.classList.contains('eh-open')), 'drawer closed by default');
const crumbs = async () => page.$eval('#crumbs', e => e.textContent);
const ctrl = async key => { await page.keyboard.down('Control'); await page.keyboard.press(key); await page.keyboard.up('Control'); await sleep(150); };

// Manon navigue a la main : rail Projects, loupe de la 2e ligne, Procedures dans Details, loupe de la 2e procedure.
await page.click('.rail i[title="Projects"]'); await sleep(500);
await page.click('tr:nth-child(3) i.fa-search'); await sleep(500);
await page.click('#details-panel li:nth-child(3)'); await sleep(500);
await page.click('#procedures-panel tr:nth-child(3) i.fa-search'); await sleep(1800);
ok((await crumbs()) === 'Projects / Procedures / Procedure', 'mock reached the procedure by hand');

// Epingler cette vue.
await ctrl('.');
ok(await page.$eval('html', e => e.classList.contains('eh-open')), 'Ctrl . opens the drawer');
ok(await page.$eval('#eh-side .eh-pin', e => e.textContent.includes('4 steps')), 'four steps noted: ' + await page.$eval('#eh-side .eh-pin', e => e.title));
await page.click('#eh-side .eh-pin'); await sleep(150);
const suggested = await page.$eval('#eh-name', e => e.value);
ok(suggested === 'Projects / Procedures / Procedure · ML-2025-0026', 'suggested name from crumb and reference: ' + suggested);
await page.$eval('#eh-name', e => { e.value = ''; });
await page.type('#eh-name', 'Procedure two');
await page.keyboard.press('Enter'); await sleep(200);
let rows = await page.$$eval('#eh-side .eh-row', els => els.map(e => e.textContent));
ok(rows.some(t => t.startsWith('Procedure two')), 'pinned under its name: ' + JSON.stringify(rows));
ok(!rows.some(t => /SECRET/.test(t)), 'no title text in the names');
ok(rows.filter(t => /^Projects/.test(t)).length >= 1, 'recent views recorded');

// Retour a l accueil (rail), puis rejeu du raccourci : les 4 pas, dans l ordre, jusqu a la bonne procedure.
await ctrl('.');
await page.click('.rail i[title="Home"]'); await sleep(500);
ok((await crumbs()) === 'Home', 'back home');
await page.evaluate(() => { window.pressed = []; });
await ctrl('k');
ok(await page.$eval('#eh-pal', e => !e.hidden), 'palette opens on Ctrl K');
await page.keyboard.type('two'); await sleep(150);
await page.keyboard.press('Enter');
await sleep(4000);
ok((await crumbs()) === 'Projects / Procedures / Procedure' && (await page.$eval('#proc-ref', e => e.value)) === 'ML-2025-0026' && (await page.evaluate(() => window.pressed.includes("open('ML-040014')"))), 'shortcut replayed to the right procedure, right project row: ' + await crumbs() + ' / ' + await page.evaluate(() => window.pressed.join(',')));
ok(await page.$eval('#eh-toast', e => !e.hidden && /Opened Procedure two/.test(e.textContent)), 'toast says opened');

// Rejeu depuis une autre vue (Animals ouvert, pas l accueil) : le premier pas (rail) marche de partout.
await page.click('.rail i[title="Animals"]'); await sleep(500);
await ctrl('.');
await page.click('#eh-side .eh-row'); await sleep(4000);
ok((await crumbs()) === 'Projects / Procedures / Procedure', 'replay works from another view');

// Ctrl K trouve une requete enregistree (Filter Selection, menu ferme).
await page.click('.rail i[title="Projects"]'); await sleep(500);
await ctrl('k');
await page.keyboard.type('2026'); await sleep(150);
const items = await page.$$eval('#eh-pal .eh-it', els => els.map(e => e.textContent));
ok(items.some(t => /Menu.*My projects 2026.*Filter Selection/.test(t)), 'saved filter found under Filter Selection: ' + JSON.stringify(items));
await page.keyboard.press('Enter'); await sleep(400);
ok((await crumbs()) === 'Projects · mine', 'saved filter applied from the finder');

// Un pas introuvable : message, pas de boucle.
await page.evaluate(() => { document.querySelector('#details-panel li:nth-child(3)').remove(); });
await ctrl('.');
await page.click('#eh-side .eh-row'); await sleep(12000);
ok(await page.$eval('#eh-toast', e => !e.hidden && /Could not follow step 3 of 4/.test(e.textContent)), 'missing step reported: ' + await page.$eval('#eh-toast', e => e.textContent));

// Mode « push » et extinction.
await setOpts({ on: true, layout: 'push', palette: true, autoOpen: false, recentMax: 30 });
await sleep(300);
ok(await page.$eval('body', e => getComputedStyle(e).marginLeft === '248px'), 'push layout pushes the page');
await setOpts({ on: false, layout: 'push', palette: true, autoOpen: false, recentMax: 30 });
await sleep(300);
ok(await page.$eval('body', e => getComputedStyle(e).marginLeft === '0px'), 'off: page back to normal');
await setOpts({ on: true, layout: 'drawer', palette: true, autoOpen: false, recentMax: 30 });
await sleep(300);
await ctrl('.');
await sleep(200);
ok(await page.$eval('html', e => e.classList.contains('eh-open')), 'drawer opens again after off/on');
await page.screenshot({ path: path.join(here, 'shot.png') });
await browser.close();
srv.close();
fs.rmSync(ext, { recursive: true, force: true });
console.log(fails ? fails + ' FAILED' : 'all green');
process.exit(fails ? 1 : 0);
