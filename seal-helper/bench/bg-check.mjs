// Essai de bg.js hors navigateur : node bg-check.mjs. Chrome et le reseau sont simules.
import { createRequire } from 'module';
import { fileURLToPath } from 'url';
import path from 'path';
const require = createRequire(import.meta.url);
const here = path.dirname(fileURLToPath(import.meta.url));
let fails = 0;
const ok = (name, cond, extra = '') => { console.log((cond ? 'ok   ' : 'FAIL ') + name + (extra ? '  ' + extra : '')); if (!cond) fails++; };

const store = {}; let running = '2.9.0', disk = '2.9.0', remote = { version: '2.9.0', zip: 'seal-helper-2.9.0.zip', notes: '' }, online = true, fetched = 0, reloaded = 0;
let listener = null;
globalThis.chrome = {
  runtime: { getManifest: () => ({ version: running }), getURL: f => 'chrome-extension://x/' + f, onMessage: { addListener: f => { listener = f; } }, reload: () => { reloaded++; } },
  storage: { local: { get: async k => ({ [k]: store[k] }), set: async o => { Object.assign(store, JSON.parse(JSON.stringify(o))); } } },
};
globalThis.fetch = async url => {
  if (url.startsWith('chrome-extension://')) return { ok: true, json: async () => ({ version: disk }) };
  fetched++;
  if (!online) throw new Error('offline');
  return { ok: true, json: async () => remote };
};
const { newer, check } = require(path.join(here, '..', 'bg.js'));
const realNow = Date.now; let shift = 0; Date.now = () => realNow() + shift;

ok('2.10.0 is newer than 2.9.0, 2.9.0 is not newer than itself', newer('2.10.0', '2.9.0') && !newer('2.9.0', '2.9.0') && !newer('2.8.9', '2.9.0'));
let u = await check();
ok('up to date: nothing to show', !u.available && !u.ready && fetched === 1);
u = await check();
ok('the published version is read at most every six hours', fetched === 1);
remote = { version: '2.10.0', zip: 'seal-helper-2.10.0.zip', notes: 'Plate layouts.' };
shift += 7 * 3600e3; u = await check();
ok('a newer published version is announced with its zip', u.available && u.latest === '2.10.0' && /seal-helper-2\.10\.0\.zip$/.test(u.url) && u.notes === 'Plate layouts.', u.url);
disk = '2.10.0'; u = await check();
ok('files just replaced: wait until the folder is complete', u.settling && !u.ready && !u.available, JSON.stringify(u).slice(0, 120));
shift += 100e3; u = await check();
ok('after the wait: ready to restart', u.ready && u.onDisk === '2.10.0');
remote = { version: '9.9.9', zip: '../../evil.zip', notes: '<img onerror=x>' }; shift += 7 * 3600e3; u = await check();
ok('a zip name that is not ours is never used', /seal-helper-9\.9\.9\.zip$/.test(u.url) && !/evil/.test(u.url), u.url);
online = false; shift += 7 * 3600e3; const before = fetched; u = await check(); const mid = fetched; u = await check();
ok('offline: no error, one try, retried later', mid === before + 1 && fetched === mid && u.latest === '9.9.9');
let replied = null; const keep = listener({ sh: 'update', apply: true }, {}, r => { replied = r; });
await new Promise(r => setTimeout(r, 400));
ok('apply restarts the extension', replied && replied.ok && reloaded === 1 && keep !== true);
console.log(fails ? fails + ' FAILED' : 'all green'); process.exit(fails ? 1 : 0);
