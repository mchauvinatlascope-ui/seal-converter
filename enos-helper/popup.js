const KEY = 'enosHelper';
const DEFAULTS = { on: true, layout: 'drawer', recentMax: 30, palette: true, autoOpen: false };
const BOOLS = ['on', 'autoOpen', 'palette'];
document.getElementById('ver').textContent = 'v' + chrome.runtime.getManifest().version;

function paint(opts) {
  for (const id of BOOLS) document.getElementById(id).checked = !!opts[id];
  document.getElementById('layout').value = opts.layout || 'drawer';
  document.getElementById('all').classList.toggle('off', !opts.on);
}
chrome.storage.sync.get(KEY, r => {
  let opts = { ...DEFAULTS, ...(r[KEY] || {}) };
  paint(opts);
  for (const id of BOOLS) document.getElementById(id).addEventListener('change', e => { opts = { ...opts, [id]: e.target.checked }; paint(opts); chrome.storage.sync.set({ [KEY]: opts }); });
  document.getElementById('layout').addEventListener('change', e => { opts = { ...opts, layout: e.target.value }; chrome.storage.sync.set({ [KEY]: opts }); });
});

// Etat sur l onglet actif : l extension y tourne-t-elle ? (URL lue grace a activeTab, seulement au clic sur l icone)
const ENOS = /^https:\/\/malaghan\.poweredbyenos\.com\//;
const state = document.getElementById('state');
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
    showState('off', 'Not an enos tab', 'Open malaghan.poweredbyenos.com to see enos Helper at work.',
      { label: 'Open enos', run: () => chrome.tabs.create({ url: 'https://malaghan.poweredbyenos.com/' }) });
    return;
  }
  chrome.tabs.sendMessage(tab.id, { eh: 'status' }, r => {
    if (chrome.runtime.lastError || !r) {
      showState('warn', 'This enos tab needs a reload', 'The extension was installed or updated after this tab was opened. Reload it once.',
        { label: 'Reload the tab', run: () => { chrome.tabs.reload(tab.id); window.close(); } });
    } else if (!r.on) showState('off', 'enos Helper is paused', 'Turn it on above to get the sidebar and Ctrl K.');
    else showState('ok', 'Active on this tab · v' + r.v, r.pins + ' shortcut' + (r.pins === 1 ? '' : 's') + ', ' + r.recent + ' recent view' + (r.recent === 1 ? '' : 's') + (r.error ? ' · ' + r.error : '') + '.',
      { label: 'Diagnostic', run: () => chrome.tabs.sendMessage(tab.id, { eh: 'diag' }, d => {
        const ta = document.getElementById('diag'); ta.value = (d && d.text) || 'No answer from the page.'; ta.classList.add('show'); ta.select();
        try { navigator.clipboard.writeText(ta.value); } catch (e) {}
        state.querySelector('span').textContent = 'Diagnostic copied: paste it to me. Page structure and menu labels only, no table content and none of your shortcuts.';
      }) });
    document.getElementById('forget').onclick = () => chrome.tabs.sendMessage(tab.id, { eh: 'forget' }, () => { state.querySelector('span').textContent = 'Shortcuts and recent views forgotten.'; });
  });
});
