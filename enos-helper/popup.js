const KEY = 'enosHelper';
const DEFAULTS = { on: true, layout: 'drawer', recentMax: 30, palette: true, autoOpen: false, chips: true, calm: true, forms: false, resume: true, home: true, updates: true };
const BOOLS = { on: 'on', calm: 'calm', forms: 'forms', homeOn: 'home', updates: 'updates' }; // case a cocher -> reglage
const $ = id => document.getElementById(id);
$('ver').textContent = chrome.runtime.getManifest().version;
if (/Mac/.test(navigator.platform)) $('find').querySelector('kbd').textContent = '⌘ K';

function paint(opts) {
  for (const [id, k] of Object.entries(BOOLS)) $(id).checked = !!opts[k];
  $('all').classList.toggle('off', !opts.on);
}
chrome.storage.sync.get(KEY, r => {
  let opts = { ...DEFAULTS, ...(r[KEY] || {}) };
  paint(opts);
  for (const [id, k] of Object.entries(BOOLS)) $(id).addEventListener('change', e => { opts = { ...opts, [k]: e.target.checked }; paint(opts); chrome.storage.sync.set({ [KEY]: opts }); });
});

// Etat sur l onglet actif : l extension y tourne-t-elle ? (URL lue grace a activeTab, seulement au clic sur l icone)
const ENOS = /^https:\/\/malaghan\.poweredbyenos\.com\//;
const state = $('state');
const say = t => { $('msg').textContent = t; };
function showState(cls, title, text, action) {
  state.hidden = false; state.className = cls;
  state.querySelector('b').textContent = title; state.querySelector('span').textContent = text;
  state.querySelector('button')?.remove();
  if (action) { const b = document.createElement('button'); b.type = 'button'; b.textContent = action.label; b.onclick = action.run; state.querySelector('div').append(b); }
}
chrome.tabs.query({ active: true, currentWindow: true }, tabs => {
  const tab = tabs && tabs[0];
  if (!tab) return;
  if (!tab.url || !ENOS.test(tab.url)) {
    showState('off', 'Not an enos tab', 'Open enos to see your Home and your pinned views.',
      { label: 'Open enos', run: () => chrome.tabs.create({ url: 'https://malaghan.poweredbyenos.com/' }) });
    return;
  }
  const send = (eh, cb) => chrome.tabs.sendMessage(tab.id, { eh }, r => { void chrome.runtime.lastError; if (cb) cb(r); });
  send('status', r => {
    if (!r) {
      showState('warn', 'This enos tab needs a reload', 'The extension was installed or updated after this tab was opened.',
        { label: 'Reload the tab', run: () => { chrome.tabs.reload(tab.id); window.close(); } });
      return;
    }
    if (!r.on) { showState('off', 'enos Helper is paused', 'Switch it on at the top right.'); return; }
    if (r.out) { showState('off', 'Sign in to enos first', 'Your Home and your pinned views show once you are signed in.'); return; }
    showState('ok', 'Working on this enos tab', r.pins + ' pinned view' + (r.pins === 1 ? '' : 's') + (r.error ? ' · ' + r.error : ''));
    for (const id of ['home', 'find', 'export', 'import', 'diagb', 'forget']) $(id).disabled = false;
    $('home').onclick = () => send('home', () => window.close());
    $('find').onclick = () => send('find', () => window.close());
    $('export').onclick = () => send('export', x => say(x && x.pins ? 'Saved to enos-helper-shortcuts.json in your Downloads.' : 'No pinned view to save yet.'));
    $('import').onclick = () => send('import', () => window.close()); // le choix du fichier se fait dans la page, sur Home
    $('diagb').onclick = () => send('diag', d => {
      const ta = $('diag'); ta.value = (d && d.text) || 'No answer from the page.'; ta.classList.add('show'); ta.select();
      try { navigator.clipboard.writeText(ta.value); } catch (e) {}
      say('Copied. Page structure and menu names only: no table content, none of your shortcuts.');
    });
    let sure = false;
    $('forget').onclick = () => {
      if (!sure) { sure = true; $('forget').textContent = 'Click again to forget all pinned and recent views'; return; }
      send('forget', () => { say('Pinned and recent views forgotten.'); $('forget').textContent = 'Forget everything'; sure = false; });
    };
  });
});
