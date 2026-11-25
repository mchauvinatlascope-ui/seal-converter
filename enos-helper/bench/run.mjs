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
for (const d of ['icons', 'fonts']) { fs.mkdirSync(path.join(ext, d)); for (const f of fs.readdirSync(path.join(src, d))) fs.copyFileSync(path.join(src, d, f), path.join(ext, d, f)); }
const man = JSON.parse(fs.readFileSync(path.join(ext, 'manifest.json'), 'utf8')); man.content_scripts[0].matches = ['http://127.0.0.1/*']; man.web_accessible_resources[0].matches = ['http://127.0.0.1/*']; fs.writeFileSync(path.join(ext, 'manifest.json'), JSON.stringify(man));

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
let rows = [];
const crumbs = async () => page.$eval('#crumbtext', e => e.textContent);
const ctrl = async key => { await page.keyboard.down('Control'); await page.keyboard.press(key); await page.keyboard.up('Control'); await sleep(150); };
const trailLen = () => page.$eval('#eh-side .eh-pin', e => (e.textContent.match(/(\d+) step/) || [0, 0])[1] | 0).catch(() => 0);

// Connexion : le clic Sign In ne compte pas.
await page.click('#loginForm button'); await sleep(1400);
await ctrl('.');
ok((await trailLen()) === 0, 'Sign In not recorded as a step');
await ctrl('.');
// 1.0 : premiere installation, puis Home a la place de l accueil vide.
ok(await page.$eval('#eh-welcome', e => !e.hidden && /Get to any enos view in one click/.test(e.textContent)).catch(() => false), 'first run: the three steps are shown once');
await page.screenshot({ path: path.join(here, 'shot-welcome.png') });
await page.$$eval('#eh-welcome .eh-btn', bs => bs.find(b => b.textContent === 'Skip').click()); await sleep(150);
ok(!(await page.$('#eh-welcome')), 'Skip closes the first run');
ok(await page.$eval('#eh-home', e => !e.hidden && /Good (morning|afternoon|evening), Manon/.test(e.querySelector('h1').textContent)), 'Home opens on arrival and greets by first name: ' + await page.$eval('#eh-home h1', e => e.textContent).catch(() => '-'));
ok(await page.$eval('#eh-home', e => e.parentElement.classList.contains('dashboard-container') && e.getBoundingClientRect().bottom <= document.querySelector('.widget').getBoundingClientRect().top + 1), 'on the enos home page, Home sits above the enos widgets, which stay visible below');
ok(!(await page.$('#eh-home .eh-map')) && await page.$eval('#eh-home', e => /Show the menu/.test(e.textContent)), 'above the widgets the enos menu is folded');
await page.$$eval('#eh-home .eh-sec-h .eh-link', bs => bs.find(b => b.textContent === 'Show the menu').click()); await sleep(150);
ok(await page.$eval('#eh-home .eh-cards', e => e.children.length === 1 && /Pin a view/.test(e.textContent)), 'no pinned view yet: the Pin a view tile alone');
const map = await page.$$eval('#eh-home .eh-map > div', ds => ds.map(d => d.querySelector('.eh-map-h').textContent + ':' + [...d.querySelectorAll('.eh-link')].map(a => a.textContent).join('|')));
ok(map.join(' ; ') === 'Locations:Records|Reports › Queries ; Animals:Locations|Entries|Reports › Queries ; Projects:Management|Reports › Queries ; Also:Dashboard|Settings', 'All of enos lists the destinations, not the folders: ' + map.join(' ; '));
ok(await page.$eval('#eh-chips .eh-chip-home', e => e.classList.contains('eh-on')), 'Home chip is on');
// 1.0.1 : epingler une entree du menu depuis Home, sans y aller ; le nom leve l ambiguite (trois « Queries »).
await page.$$eval('#eh-home .eh-map-r', rs => rs.find(r => r.querySelector('.eh-link').title === 'Projects › Reports › Queries').querySelector('.eh-star').click()); await sleep(200);
ok((await page.$$eval('#eh-home .eh-card .eh-card-name', els => els.map(e => e.textContent))).join(',') === 'Projects queries,Pin a view', 'a menu entry pinned from Home by its star, named after its domain');
await page.click('#eh-home .eh-card'); await sleep(1500);
ok((await page.$eval('#crumbtext', e => e.textContent)) === 'Projects queries', 'the pinned menu entry opens');
await page.click('#eh-chips .eh-chip-home'); await sleep(200);
await page.$$eval('#eh-home .eh-map-r .eh-star.eh-on', bs => bs[0].click()); await sleep(200);
ok((await page.$$eval('#eh-home .eh-card', els => els.length)) === 1, 'the same star unpins');
await page.$$eval('#eh-home .eh-map-r', rs => rs.find(r => r.querySelector('.eh-link').title === 'Settings').querySelector('.eh-star').click()); await sleep(200);
await page.click('#eh-home .eh-unpin'); await sleep(200);
ok((await page.$$eval('#eh-home .eh-card', els => els.length)) === 1 && await page.$eval('#eh-toast', e => !e.hidden && /Unpinned « Settings »/.test(e.textContent)), 'the star on a card unpins it and says so');
await page.click('#eh-toast .eh-tbtn'); await sleep(200);
ok((await page.$$eval('#eh-home .eh-card-name', els => els.map(e => e.textContent))).join(',') === 'Settings,Pin a view', 'Undo puts it back');
await page.click('#eh-home .eh-unpin'); await sleep(200);
await page.keyboard.press('Escape'); await sleep(100);
ok(await page.$eval('#eh-home', e => e.hidden), 'Escape closes Home');
await page.click('#eh-chips .eh-chip-home'); await sleep(150);
ok(await page.$eval('#eh-home', e => !e.hidden), 'Home chip opens it again');
await page.$$eval('#eh-home .eh-map .eh-link', as => as.find(a => a.textContent === 'Entries').click()); await sleep(1500);
ok((await page.$eval('#crumbtext', e => e.textContent)) === 'Animals entries' && await page.$eval('#eh-home', e => e.hidden), 'a menu name on Home opens the view and closes Home');
await page.click('#eh-chips .eh-chip-home'); await sleep(200);
ok(await page.$eval('#eh-home', e => !e.hidden && e.parentElement === document.body && e.getBoundingClientRect().left === 60 && e.getBoundingClientRect().top === 40 && /Your query widgets are on the enos dashboard/.test(e.textContent)), 'from another view, Home opens over it and points to the enos dashboard');
await page.$$eval('#eh-home .eh-note .eh-link', bs => bs.find(b => b.textContent === 'Open it').click()); await sleep(1800);
ok(await page.$eval('#eh-home', e => !e.hidden && e.classList.contains('eh-docked')), 'back on the enos home page, Home is there again above the widgets');
await ctrl('.');
const groups = await page.$$eval('#eh-side .eh-grp .eh-t', els => els.map(e => e.textContent));
ok(groups.join(',') === 'Dashboard,Locations,Animals,Projects,Settings', 'enos menu listed in the drawer: ' + groups.join(','));
await page.$$eval('#eh-side .eh-grp', els => els.find(e => e.textContent.includes('Projects')).click()); await sleep(100);
const subs = await page.$$eval('#eh-side .eh-sub .eh-t', els => els.map(e => e.textContent));
ok(subs.join(',') === 'Management,Reports › Queries', 'Projects group opens its entries: ' + subs.join(','));
ok(await page.$eval('#eh-chips', e => e.textContent.includes('Pin this view')), 'chips bar invites to pin');
ok(await page.$eval('#eh-tab', e => getComputedStyle(e).display === 'none'), 'bottom tab hidden while the bar shows');
await ctrl('.');

// Une epingle d une version d avant, avec Sign In en pas 1 : nettoyee au chargement.
await sw.evaluate(async origin => {
  const k = 'eh:' + origin;
  await chrome.storage.local.set({ [k]: { pins: [{ name: 'Old procedures', at: 1, trail: [
    { tag: 'button', text: 'Sign In', title: '', icon: '', n: 0, label: 'Sign In' },
    { tag: 'span', text: '', title: '', icon: 'fa fa-navicon', n: 0, label: 'navicon' },
    { tag: 'a', text: 'Management', title: '', icon: '', n: 0, label: 'Projects › Management', menu: 'Projects › Management', act: "go('Projects')" } ] }], recent: [] } });
}, base.replace(/\/#.*$/, ''));
await sleep(400);
await ctrl('.');
rows = await page.$$eval('#eh-side .eh-row', els => els.map(e => e.title));
ok(rows.some(t => t === 'Projects › Management'), 'old pin cleaned of Sign In and menu toggle: ' + JSON.stringify(rows));
await ctrl('.');
await page.click('#eh-chips .eh-chip-v'); await sleep(2500);
ok((await crumbs()) === 'Projects', 'old pin now opens Projects: ' + await crumbs() + ' / ' + await page.evaluate(() => window.pressed.join(',')));
await sw.evaluate(async origin => { await chrome.storage.local.set({ ['eh:' + origin]: { pins: [], recent: [] } }); }, base.replace(/\/#.*$/, ''));
await sleep(400);

// Manon navigue a la main : ≡ (bruit), menu Projects › Management (replie), loupe de la 2e ligne, Procedures dans Details, loupe de la 2e procedure.
await page.click('#toggle_sidemenu_l'); await sleep(200);
await page.$$eval('#sidebar-menu > li', lis => lis.find(l => l.textContent.includes('Projects')).querySelector('a').click()); await sleep(200);
await page.$$eval('#sidebar-menu a', as => as.find(a => a.textContent === 'Management').click()); await sleep(500);
ok((await crumbs()) === 'Projects', 'projects list open');
ok(await page.$eval('tr:nth-child(3)', e => e.style.display === 'none'), 'the wanted row is not listed until a filter is typed and Search pressed');
await page.click('#f-ref'); await page.click('#projects-panel form', { offset: { x: 700, y: 8 } }); // un clic dans le champ puis dans le bloc de filtres : pas des pas
await page.type('#f-ref', '*040*'); await page.click('#projects-panel button'); await sleep(300);
await page.click('tr:nth-child(3) i.fa-search'); await sleep(500);
await page.$$eval('#sidebar_right li', lis => lis.find(l => l.textContent.includes('Procedures')).click()); await sleep(500);
await page.click('#procedures-panel tr:nth-child(3) i.fa-search'); await sleep(1800);
ok((await crumbs()) === 'Projects / Procedures / Procedure', 'mock reached the procedure by hand');

// Epingler depuis la barre : ★, nom court propose, pas listes, un pas retire, Entree.
ok(await page.$eval('#eh-chips .eh-chip-pin', e => /5 clicks/.test(e.title)), 'star chip counts the clicks (Search included): ' + await page.$eval('#eh-chips .eh-chip-pin', e => e.title));
await page.click('#eh-chips .eh-chip-pin'); await sleep(200);
ok(await page.$eval('#eh-pop', e => !e.hidden), 'pin window opens under the bar');
const suggested = await page.$eval('#eh-pop #eh-name', e => e.value);
ok(suggested === 'Procedure ML-2025-0026', 'short name proposed: ' + suggested);
let steps = await page.$$eval('#eh-pop .eh-steps li .eh-t', els => els.map(e => e.textContent));
ok(steps[0] === 'Projects › Management' && steps[1] === 'Search' && steps[2] === 'ML-040014' && steps[3] === 'Procedures' && steps[4] === 'ML-2025-0026', 'path readable: ' + JSON.stringify(steps));
ok(await page.$eval('#eh-pop', e => /Also remembers the list filter: Reference \*040\*/.test(e.textContent)), 'the remembered list filter is said');
await page.screenshot({ path: path.join(here, 'shot-pin.png') });
ok(!(await page.$('#eh-pop .eh-steps li button')), 'steps are plain until Edit steps');
await page.click('#eh-pop .eh-link'); await sleep(100);
ok(await page.evaluate(() => { const b = document.querySelector('#eh-chips .eh-chip-pin'); return /5 clicks/.test(b.title); }), 'the typed filter is not a click');
await page.$$eval('#eh-pop .eh-steps li button', bs => bs[4].click()); await sleep(100);
steps = await page.$$eval('#eh-pop .eh-steps li .eh-t', els => els.map(e => e.textContent));
ok(steps.length === 4 && steps[3] === 'Procedures', 'a step can be removed by hand');
await page.keyboard.press('Escape'); await sleep(100);
ok(await page.$eval('#eh-pop', e => e.hidden), 'Escape closes the window');
await page.click('#eh-chips .eh-chip-pin'); await sleep(200);
ok((await page.$$eval('#eh-pop .eh-steps li', els => els.length)) === 5, 'reopening starts from the full path');
await page.$eval('#eh-pop #eh-name', e => { e.value = ''; });
await page.type('#eh-pop #eh-name', 'Procedure two');
await page.keyboard.press('Enter'); await sleep(200);
ok(await page.$eval('#eh-pop', e => e.hidden), 'Enter pins and closes');
// Home : la carte de la vue epinglee, ses dernieres vues.
await page.click('#eh-chips .eh-chip-home'); await sleep(200);
const cardT = await page.$eval('#eh-home .eh-card', e => [...e.querySelectorAll('.eh-eyebrow, kbd, .eh-card-name, .eh-card-path')].map(x => x.textContent).join(' | '));
ok(cardT === 'Projects | Alt 1 | Procedure two | Management › ML-040014 › Procedures › ML-2025-0026 · filter Reference *040*', 'pinned card: domain, shortcut, name, path: ' + cardT);
const rec = await page.$$eval('#eh-home .eh-hrow-main b', els => els.map(e => e.textContent));
ok(rec.length >= 1 && rec[0] === 'Procedure ML-2025-0026', 'recent views listed on Home: ' + rec.join(', '));
ok(!(await page.$eval('#eh-home', e => /SECRET/.test(e.textContent))), 'no record content on Home');
await page.screenshot({ path: path.join(here, 'shot-home.png') });
await page.keyboard.press('Escape'); await sleep(100);
await ctrl('.');
rows = await page.$$eval('#eh-side .eh-row', els => els.map(e => e.textContent));
ok(rows.some(t => t.startsWith('Procedure two')), 'pinned under its name');
ok(!rows.some(t => /SECRET/.test(t)), 'no title text in the names');
ok(await page.$eval('#eh-chips', e => e.textContent.includes('Procedure two')), 'chip in the orange bar');
await ctrl('.');
// Clic droit sur la puce : renommer.
await page.click('#eh-chips .eh-chip-v', { button: 'right' }); await sleep(200);
ok(await page.$eval('#eh-pop', e => !e.hidden && /Rename/.test(e.textContent) && /Remove/.test(e.textContent)), 'right click opens rename / move / remove');
await page.$eval('#eh-pop input', e => { e.value = ''; });
await page.type('#eh-pop input', 'Proc 2');
await page.keyboard.press('Enter'); await sleep(200);
ok(await page.$eval('#eh-chips', e => e.textContent.includes('Proc 2')), 'chip renamed from the bar');
await page.click('#eh-chips .eh-chip-v', { button: 'right' }); await sleep(200);
await page.$eval('#eh-pop input', e => { e.value = ''; });
await page.type('#eh-pop input', 'Procedure two');
await page.keyboard.press('Enter'); await sleep(200);

// Depuis l accueil, Alt 1 rejoue : Management direct (menu replie), bonne ligne malgre les compteurs qui changent, Details, procedure.
await page.$$eval('#sidebar-menu a', as => as.find(a => a.textContent === 'Dashboard').click()); await sleep(500);
await page.evaluate(() => { window.pressed = []; });
await page.keyboard.down('Alt'); await page.keyboard.press('1'); await page.keyboard.up('Alt');
let opened = false, prog = '';
for (let i = 0; i < 60 && !opened; i++) { await sleep(200); prog = prog || await page.$eval('#eh-prog', e => (e.hidden ? '' : e.textContent)).catch(() => ''); opened = await page.$eval('#eh-toast', e => !e.hidden && /Opened Procedure two/.test(e.textContent)).catch(() => false); }
await sleep(800);
ok((await crumbs()) === 'Projects / Procedures / Procedure' && (await page.$eval('#proc-ref', e => e.value)) === 'ML-2025-0026' && (await page.evaluate(() => window.pressed.includes("open('ML-040014')"))), 'Alt 1 replayed to the right procedure: ' + await page.evaluate(() => window.pressed.join(',')));
ok(await page.evaluate(() => window.pressed.includes('search()')) && (await page.$eval('#f-ref', e => e.value)) === '*040*', 'typed filter put back and Search pressed before the row click');
ok(opened, 'toast says opened');
ok(/Opening Procedure two.*Step \d of 5/.test(prog) && await page.$eval('#eh-prog', e => e.hidden), 'progress banner during the replay, gone after: ' + prog);

// Un clic de puce depuis une autre vue.
await page.$$eval('#sidebar-menu a', as => as.find(a => a.textContent === 'Settings').click()); await sleep(500);
await page.click('#eh-chips .eh-chip-home'); await sleep(200);
await page.click('#eh-home .eh-card'); await sleep(11000);
ok((await crumbs()) === 'Projects / Procedures / Procedure' && await page.$eval('#eh-home', e => e.hidden), 'a card on Home replays from another view and Home closes');
await page.$$eval('#sidebar-menu a', as => as.find(a => a.textContent === 'Settings').click()); await sleep(500);
await page.click('#eh-chips .eh-chip-v'); await sleep(1200);
await page.$$eval('#eh-prog button', bs => bs[0].click()); await sleep(6000);
ok((await crumbs()) !== 'Projects / Procedures / Procedure' && await page.$eval('#eh-toast', e => /Stopped/.test(e.textContent)), 'Stop halts a replay: ' + await crumbs());

// Ctrl K : une entree repliee du menu (Queries de Projects) et un filtre enregistre.
await ctrl('k');
await page.keyboard.type('quer'); await sleep(150);
let items = await page.$$eval('#eh-pal .eh-it', els => els.map(e => e.textContent));
ok(items.some(t => /Queries.*Projects › Reports/.test(t)) && (await page.$$eval('#eh-pal .eh-gh', els => els.map(e => e.textContent))).includes('enos menu'), 'Queries found in the folded menu, under its heading: ' + JSON.stringify(items));
await page.screenshot({ path: path.join(here, 'shot-finder.png') });
await page.$$eval('#eh-pal .eh-it', els => els.find(e => /Projects › Reports/.test(e.textContent)).click()); await sleep(600);
ok((await crumbs()) === 'Projects queries', 'folded menu entry opened from the finder');
await page.$$eval('#sidebar-menu a', as => as.find(a => a.textContent === 'Management').click()); await sleep(500);
await ctrl('k');
await page.keyboard.type('2026'); await sleep(150);
items = await page.$$eval('#eh-pal .eh-it', els => els.map(e => e.textContent));
ok(items.some(t => /My projects 2026.*Filter Selection/.test(t)), 'saved filter found under Filter Selection');
await page.keyboard.press('Enter'); await sleep(400);
ok((await crumbs()) === 'Projects · mine', 'saved filter applied from the finder');

// Un pas introuvable : message, pas de boucle.
await page.evaluate(() => { document.querySelectorAll('#sidebar_right li').forEach(l => { if (l.textContent.includes('Procedures')) l.remove(); }); });
await ctrl('.');
await page.click('#eh-side .eh-row'); await sleep(24000);
ok(await page.$eval('#eh-toast', e => !e.hidden && /Stopped at step 4 of 5/.test(e.textContent)), 'missing step reported: ' + await page.$eval('#eh-toast', e => e.textContent));
ok((await crumbs()) === 'Projects / Project', 'the view stays where the replay stopped, no jump home: ' + await crumbs());

// Un libelle qui change (badge ajoute) : le pas est retrouve par son action ng-click.
await page.evaluate(() => { document.querySelectorAll('#sidebar_right li').forEach(l => { if (l.textContent.includes('Billing')) l.append(' (3)'); }); });
await page.evaluate(() => { const li = document.createElement('li'); li.setAttribute('ng-click', "detail('Procedures')"); li.textContent = 'Procedures (2)'; li.addEventListener('click', e => { e.preventDefault(); window.pressed.push("detail('Procedures')"); document.querySelectorAll('.panel').forEach(p => p.classList.toggle('hidden', p.id !== 'procedures-panel')); document.getElementById('crumbtext').textContent = 'Projects / Procedures'; }); document.querySelector('#sidebar_right ul').append(li); });
await ctrl('.');
await page.click('#eh-side .eh-row'); await sleep(9000);
ok((await crumbs()) === 'Projects / Procedures / Procedure', 'step found by its action after a label change: ' + await crumbs());

// 0.3 : feuille calme (titre sur une ligne, poubelle ecartee), entrees Details depuis la barre, My queries, reprise a l arrivee.
await page.$$eval('#sidebar-menu a', as => as.find(a => a.textContent === 'Management').click()); await sleep(500);
await page.type('#f-ref', '*ml*'); await page.click('#projects-panel button'); await sleep(300);
ok(await page.$eval('html', e => e.classList.contains('eh-calm')), 'calm sheet on by default');
ok(await page.$eval('td.long', e => getComputedStyle(e).whiteSpace === 'nowrap' && e.getBoundingClientRect().height < 40), 'long title on one line');
ok(await page.$eval('tr:nth-child(3) i.fa-trash', e => parseFloat(getComputedStyle(e).marginLeft) >= 16 && parseFloat(getComputedStyle(e).opacity) < 0.6), 'bin icon set apart and dimmed');
await page.click('tr:nth-child(3) i.fa-search'); await sleep(600);
await ctrl('.');
const tags = await page.$$eval('#eh-side .eh-tag', els => els.map(e => e.textContent));
ok(tags.length === 4 && tags[0] === 'Species' && tags[2].startsWith('Billing'), 'Details entries listed from the record: ' + tags.join(','));
const qs = await page.$$eval('#eh-side .eh-row', els => els.filter(e => !e.classList.contains('eh-sub') && e.textContent.endsWith('Queries')).map(e => e.textContent));
ok(qs.length === 3 && qs[0].startsWith('Locations'), 'My queries gathered from every domain: ' + JSON.stringify(qs));
await page.$$eval('#eh-side .eh-tag', els => els.find(e => e.textContent.startsWith('Billing')).click()); await sleep(500);
ok((await crumbs()) === 'Projects / Billing', 'Details entry opened from the sidebar');
// 1.0 : sauvegarde dans un fichier puis rechargement des vues epinglees.
await page.click('#eh-chips .eh-chip-home'); await sleep(200);
const jf = path.join(ext, 'pins.json');
fs.writeFileSync(jf, JSON.stringify({ app: 'enos Helper', pins: [{ name: 'Animal queries', trail: [{ tag: 'a', text: 'Queries', title: '', icon: '', n: 0, label: 'Animals › Reports › Queries', menu: 'Animals › Reports › Queries', act: "go('Animals queries')", root: true }, { tag: 'button', text: 'Sign In', label: 'Sign In' }] }] }));
await (await page.$('#eh-home .eh-home-foot input[type=file]')).uploadFile(jf); await sleep(500);
const cards = await page.$$eval('#eh-home .eh-card .eh-card-name', els => els.map(e => e.textContent));
ok(cards.join(',') === 'Procedure two,Animal queries,Pin a view', 'pinned views loaded from a file, added to mine: ' + cards.join(','));
ok(await page.$eval('#eh-home', e => /My queries/.test(e.textContent) && [...e.querySelectorAll('.eh-panel')][1].querySelector('.eh-hrow-main b').textContent === 'Animal queries'), 'a pinned query is listed under My queries');
await page.$$eval('#eh-home .eh-card', els => els[1].click()); await sleep(2500);
ok((await crumbs()) === 'Animals queries', 'the loaded view opens (its Sign In step dropped): ' + await crumbs());
await setOpts({ on: true, layout: 'drawer', palette: true, autoOpen: false, recentMax: 30, chips: true, calm: true, forms: false, resume: true, home: false }); await sleep(300);
await page.reload(); await sleep(800);
await page.click('#loginForm button'); await sleep(2500);
ok(!(await page.$('#eh-welcome')) && await page.$eval('#eh-home', e => e.hidden).catch(() => true), 'no first run twice, no Home when Start on Home is off');
ok(await page.$eval('#eh-toast', e => !e.hidden && /Back to «/.test(e.textContent)).catch(() => false), 'resume offered on arrival: ' + await page.$eval('#eh-toast', e => e.textContent).catch(() => '-'));
await page.click('#eh-toast .eh-tbtn'); await sleep(9000);
ok(/^Animals queries/.test(await crumbs()), 'resume replays the last view: ' + await crumbs());
await setOpts({ on: true, layout: 'drawer', palette: true, autoOpen: false, recentMax: 30, chips: true, calm: false, forms: false, resume: true, home: false }); await sleep(300);
ok(await page.$eval('html', e => !e.classList.contains('eh-calm')), 'calm sheet can be turned off');

// Reglages : puces coupees, mode « push », extinction.
await setOpts({ on: true, layout: 'drawer', palette: true, autoOpen: false, recentMax: 30, chips: false, calm: true, resume: true }); await sleep(300);
ok(!(await page.$('#eh-chips')), 'chips can be turned off');
await setOpts({ on: true, layout: 'push', palette: true, autoOpen: false, recentMax: 30, chips: true }); await sleep(300);
ok(await page.$eval('body', e => getComputedStyle(e).marginLeft === '264px'), 'push layout pushes the page');
await setOpts({ on: false, layout: 'push', palette: true, autoOpen: false, recentMax: 30, chips: true }); await sleep(300);
ok(await page.$eval('body', e => getComputedStyle(e).marginLeft === '0px') && !(await page.$('#eh-chips')), 'off: page back to normal');
await setOpts({ on: true, layout: 'drawer', palette: true, autoOpen: false, recentMax: 30, chips: true }); await sleep(300);
await ctrl('.'); await sleep(200);
ok(await page.$eval('html', e => e.classList.contains('eh-open')), 'drawer opens again after off/on');
await ctrl('.');
// La fenetre de l icone, ouverte en onglet pour la capture.
const pop = await browser.newPage(); await pop.setViewport({ width: 360, height: 560 });
await pop.goto('chrome-extension://' + new URL(sw.url()).host + '/popup.html'); await sleep(400);
ok(await pop.$eval('body', e => /Open Home/.test(e.textContent) && /Start on Home/.test(e.textContent) && /Save to a file/.test(e.textContent)), 'toolbar popup: Open Home, Comfort, My shortcuts');
await pop.screenshot({ path: path.join(here, 'shot-popup.png') }); await pop.close();
await browser.close();
srv.close();
fs.rmSync(ext, { recursive: true, force: true });
console.log(fails ? fails + ' FAILED' : 'all green');
process.exit(fails ? 1 : 0);
