const KEY = 'sealHelper';
const DEFAULTS = { on: true, side: true, home: true, appmenu: false, props: true, doc: true, dates: true, info: true, quiet: true };
const IDS = Object.keys(DEFAULTS);

function paint(opts) {
  for (const id of IDS) document.getElementById(id).checked = !!opts[id];
  document.getElementById('all').classList.toggle('off', !opts.on);
}

chrome.storage.sync.get(KEY, r => {
  let opts = { ...DEFAULTS, ...(r[KEY] || {}) };
  paint(opts);
  for (const id of IDS) {
    document.getElementById(id).addEventListener('change', e => {
      opts = { ...opts, [id]: e.target.checked };
      paint(opts);
      chrome.storage.sync.set({ [KEY]: opts });
    });
  }
});

// Etat sur l onglet actif : l extension y tourne-t-elle ? (URL lue grace a activeTab, seulement au clic sur l icone)
const SEAL = /^https:\/\/us\.platform\.seal\.run\/o\/malaghan\//;
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
  if (!tab.url || !SEAL.test(tab.url)) {
    showState('off', 'Not a Seal tab', 'Open us.platform.seal.run/o/malaghan to see Seal Helper at work.',
      { label: 'Open Seal', run: () => chrome.tabs.create({ url: 'https://us.platform.seal.run/o/malaghan/' }) });
    return;
  }
  chrome.tabs.sendMessage(tab.id, { sh: 'status' }, r => {
    if (chrome.runtime.lastError || !r) {
      showState('warn', 'This Seal tab needs a reload', 'The extension was updated after this tab was opened. Reload it once.',
        { label: 'Reload the tab', run: () => { chrome.tabs.reload(tab.id); window.close(); } });
    } else if (!r.on) showState('off', 'Seal Helper is paused', 'Turn it on above to see the new layout.');
    else if (!r.side) showState('off', 'Classic layout', 'Turn on « New sidebar » to get the dashboard and the New menu.');
    else if (!r.workspace) showState('ok', 'Active on this tab · v' + r.v, 'The new layout shows on lab pages and records.');
    else if (!r.shown) showState('warn', 'Running but hidden · v' + r.v, 'Reload the tab; if it stays hidden, send a screenshot.',
      { label: 'Reload the tab', run: () => { chrome.tabs.reload(tab.id); window.close(); } });
    else showState('ok', 'Active on this tab · v' + r.v, 'Sidebar, Today, New menu and navigation arrows are on.',
      { label: 'Diagnostic', run: () => chrome.tabs.sendMessage(tab.id, { sh: 'diag' }, d => {
        const ta = document.getElementById('diag'); ta.value = (d && d.text) || 'No answer from the page.'; ta.classList.add('show'); ta.select();
        try { navigator.clipboard.writeText(ta.value); } catch (e) {}
        state.querySelector('span').textContent = 'Diagnostic copied: paste it to me. Structure only, no record content.';
      }) });
    if (r.on && r.side) {
      const tools = document.getElementById('tools'); tools.hidden = false;
      document.getElementById('forget').onclick = () => chrome.tabs.sendMessage(tab.id, { sh: 'forget' }, () => { state.querySelector('span').textContent = 'Menu hiding reset. Reload the Seal tab.'; });
    }
  });
});
