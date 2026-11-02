const KEY = 'sealHelper';
const DEFAULTS = { on: true, side: true, home: true, appmenu: true, props: true, doc: true, dates: true, info: true, quiet: true };
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
