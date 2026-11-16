// Banc enos Helper : charge l extension dans Chrome (headless) sur une page enos factice
// (connexion d abord, adresse qui ne change pas, header#content-navbar, #sidebar-menu replie, tables avec loupes, #sidebar_right Details).
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
const base = 'http://127.0.0.1:' + srv.address().port + '/#/login';

const browser = await puppeteer.launch({ headless: true, args: ['--no-sandbox', `--disable-extensions-except=${ext}`, `--load-extension=${ext}`] });
const sw = await browser.waitForTarget(t => t.type() === 'service_worker', { timeout: 10000 }).then(t => t.worker());
const setOpts = o => sw.evaluate(async o => { await chrome.storage.sync.set({ enosHelper: o }); }, o);
const page = await browser.newPage();
await page.setViewport({ width: 1600, height: 900 });
page.on('pageerror', e => console.log('page error', e.message));
page.on('console', m => { if (m.type() === 'error' || m.type() === 'warning') console.log('console', m.type(), m.text()); });
await page.goto(base);
await sleep(800);
ok(await page.$('#eh-side'), 'sidebar mounted');
ok(!(await page.$('#eh-chips')), 'no chips on the login page');
const crumbs = async () => page.$eval('#crumbtext', e => e.textContent);
const ctrl = async key => { await page.keyboard.down('Control'); await page.keyboard.press(key); await page.keyboard.up('Control'); await sleep(150); };
const trailLen = () => page.$eval('#eh-side .eh-pin', e => (e.textContent.match(/(\d+) step/) || [0, 0])[1] | 0).catch(() => 0);

// Connexion : le clic Sign In ne compte pas.
await page.click('#loginForm button'); await sleep(1200);
await ctrl('.');
ok((await trailLen()) === 0, 'Sign In not recorded as a step');
const groups = await page.$$eval('#eh-side .eh-grp .eh-t', els => els.map(e => e.textContent));
ok(groups.join(',') === 'Dashboard,Locations,Animals,Projects,Settings', 'enos menu listed in the drawer: ' + groups.join(','));
await page.$$eval('#eh-side .eh-grp', els => els.find(e => e.textContent.includes('Projects')).click()); await sleep(100);
const subs = await page.$$eval('#eh-side .eh-sub .eh-t', els => els.map(e => e.textContent));
ok(subs.join(',') === 'Management,Reports › Queries', 'Projects group opens its entries: ' + subs.join(','));
ok(await page.$eval('#eh-chips', e => e.textContent.includes('Pin a view')), 'chips bar invites to pin');
await ctrl('.');

// Manon navigue a la main : ≡ (bruit), menu Projects › Management (replie), loupe de la 2e ligne, Procedures dans Details, loupe de la 2e procedure.
await page.click('#toggle_sidemenu_l'); await sleep(200);
await page.$$eval('#sidebar-menu > li', lis => lis.find(l => l.textContent.includes('Projects')).querySelector('a').click()); await sleep(200);
await page.$$eval('#sidebar-menu a', as => as.find(a => a.textContent === 'Management').click()); await sleep(500);
ok((await crumbs()) === 'Projects', 'projects list open');
await page.click('tr:nth-child(3) i.fa-search'); await sleep(500);
await page.$$eval('#sidebar_right li', lis => lis.find(l => l.textContent.includes('Procedures')).click()); await sleep(500);
await page.click('#procedures-panel tr:nth-child(3) i.fa-search'); await sleep(1800);
ok((await crumbs()) === 'Projects / Procedures / Procedure', 'mock reached the procedure by hand');

// Epingler : les pas, sans le ≡ ; la derniere entree de menu cliquee (Management) est le depart.
await ctrl('.');
const n = await trailLen();
ok(n === 4, 'four steps noted (menu toggle ignored, Management is the start): ' + await page.$eval('#eh-side .eh-pin', e => e.title));
await page.click('#eh-side .eh-pin'); await sleep(150);
const suggested = await page.$eval('#eh-name', e => e.value);
ok(suggested === 'Projects / Procedures / Procedure · ML-2025-0026', 'suggested name from crumb and reference: ' + suggested);
let steps = await page.$$eval('#eh-side .eh-steps li .eh-t', els => els.map(e => e.textContent));
ok(steps[0] === 'Projects › Management' && /search on ML-040014/.test(steps[1]) && steps[2] === 'Procedures' && /search on ML-2025-0026/.test(steps[3]), 'steps readable: ' + JSON.stringify(steps));
await page.$$eval('#eh-side .eh-steps li button', bs => bs[3].click()); await sleep(100);
steps = await page.$$eval('#eh-side .eh-steps li .eh-t', els => els.map(e => e.textContent));
ok(steps.length === 3 && steps[2] === 'Procedures', 'a step can be removed by hand');
await page.$$eval('#eh-side .eh-naming .eh-btn', bs => bs[1].click()); await sleep(100);
await page.click('#eh-side .eh-pin'); await sleep(150);
ok((await page.$$eval('#eh-side .eh-steps li', els => els.length)) === 4, 'cancel keeps the full path');
await page.$eval('#eh-name', e => { e.value = ''; });
await page.type('#eh-name', 'Procedure two');
await page.keyboard.press('Enter'); await sleep(200);
let rows = await page.$$eval('#eh-side .eh-row', els => els.map(e => e.textContent));
ok(rows.some(t => t.startsWith('Procedure two')), 'pinned under its name');
ok(!rows.some(t => /SECRET/.test(t)), 'no title text in the names');
ok(await page.$eval('#eh-chips', e => e.textContent.includes('Procedure two')), 'chip in the orange bar');
await ctrl('.');

// Depuis l accueil, Alt 1 rejoue : Management direct (menu replie), bonne ligne malgre les compteurs qui changent, Details, procedure.
await page.$$eval('#sidebar-menu a', as => as.find(a => a.textContent === 'Dashboard').click()); await sleep(500);
await page.evaluate(() => { window.pressed = []; });
await page.keyboard.down('Alt'); await page.keyboard.press('1'); await page.keyboard.up('Alt');
let opened = false;
for (let i = 0; i < 30 && !opened; i++) { await sleep(200); opened = await page.$eval('#eh-toast', e => !e.hidden && /Opened Procedure two/.test(e.textContent)).catch(() => false); }
await sleep(800);
ok((await crumbs()) === 'Projects / Procedures / Procedure' && (await page.$eval('#proc-ref', e => e.value)) === 'ML-2025-0026' && (await page.evaluate(() => window.pressed.includes("open('ML-040014')"))), 'Alt 1 replayed to the right procedure: ' + await page.evaluate(() => window.pressed.join(',')));
ok(opened, 'toast says opened');

// Un clic de puce depuis une autre vue.
await page.$$eval('#sidebar-menu a', as => as.find(a => a.textContent === 'Settings').click()); await sleep(500);
await page.click('#eh-chips .eh-chip'); await sleep(4500);
ok((await crumbs()) === 'Projects / Procedures / Procedure', 'chip replays from another view');

// Ctrl K : une entree repliee du menu (Queries de Projects) et un filtre enregistre.
await ctrl('k');
await page.keyboard.type('quer'); await sleep(150);
let items = await page.$$eval('#eh-pal .eh-it', els => els.map(e => e.textContent));
ok(items.some(t => /Menu.*Queries.*Projects › Reports/.test(t)), 'Queries found in the folded menu: ' + JSON.stringify(items));
await page.$$eval('#eh-pal .eh-it', els => els.find(e => /Projects › Reports/.test(e.textContent)).click()); await sleep(600);
ok((await crumbs()) === 'Projects queries', 'folded menu entry opened from the finder');
await page.$$eval('#sidebar-menu a', as => as.find(a => a.textContent === 'Management').click()); await sleep(500);
await ctrl('k');
await page.keyboard.type('2026'); await sleep(150);
items = await page.$$eval('#eh-pal .eh-it', els => els.map(e => e.textContent));
ok(items.some(t => /Menu.*My projects 2026.*Filter Selection/.test(t)), 'saved filter found under Filter Selection');
await page.keyboard.press('Enter'); await sleep(400);
ok((await crumbs()) === 'Projects · mine', 'saved filter applied from the finder');

// Un pas introuvable : message, pas de boucle.
await page.evaluate(() => { document.querySelectorAll('#sidebar_right li').forEach(l => { if (l.textContent.includes('Procedures')) l.remove(); }); });
await ctrl('.');
await page.click('#eh-side .eh-row'); await sleep(12000);
ok(await page.$eval('#eh-toast', e => !e.hidden && /Could not follow step 3 of 4/.test(e.textContent)), 'missing step reported: ' + await page.$eval('#eh-toast', e => e.textContent));

// Reglages : puces coupees, mode « push », extinction.
await setOpts({ on: true, layout: 'drawer', palette: true, autoOpen: false, recentMax: 30, chips: false }); await sleep(300);
ok(!(await page.$('#eh-chips')), 'chips can be turned off');
await setOpts({ on: true, layout: 'push', palette: true, autoOpen: false, recentMax: 30, chips: true }); await sleep(300);
ok(await page.$eval('body', e => getComputedStyle(e).marginLeft === '248px'), 'push layout pushes the page');
await setOpts({ on: false, layout: 'push', palette: true, autoOpen: false, recentMax: 30, chips: true }); await sleep(300);
ok(await page.$eval('body', e => getComputedStyle(e).marginLeft === '0px') && !(await page.$('#eh-chips')), 'off: page back to normal');
await setOpts({ on: true, layout: 'drawer', palette: true, autoOpen: false, recentMax: 30, chips: true }); await sleep(300);
await ctrl('.'); await sleep(200);
ok(await page.$eval('html', e => e.classList.contains('eh-open')), 'drawer opens again after off/on');
await page.screenshot({ path: path.join(here, 'shot.png') });
await browser.close();
srv.close();
fs.rmSync(ext, { recursive: true, force: true });
console.log(fails ? fails + ' FAILED' : 'all green');
process.exit(fails ? 1 : 0);
