// Seal Helper 0.1
// Ne fait que changer l affichage dans ce navigateur : n ecrit jamais dans Seal,
// n envoie rien, ne touche pas au texte d un document en cours d edition.
// Chaque reglage s appuie sur un repere de la page Seal ; si le repere disparait,
// le reglage ne trouve rien et Seal s affiche comme d habitude.
(() => {
  const KEY = 'sealHelper';
  const DEFAULTS = { on: true, doc: true, dates: true, info: true, quiet: true };
  const FEATURES = ['doc', 'dates', 'info', 'quiet'];
  const root = document.documentElement;
  let opts = { ...DEFAULTS };

  const isOn = k => opts.on && opts[k];

  function applyClasses() {
    for (const k of FEATURES) root.classList.toggle('sh-' + k, !!isOn(k));
  }

  // --- Textes courts (dates et titres de changesets) ----------------------
  // On garde le texte d origine pour le remettre quand le reglage est coupe.
  const original = new WeakMap();
  const ZONE = / (?:[A-Z][a-z]+ ){1,3}(?:Daylight|Standard|Summer) Time\b/;
  const changed = new Set();

  function setText(node, text) {
    if (!original.has(node)) original.set(node, node.nodeValue);
    node.nodeValue = text;
    changed.add(node);
  }

  function restoreTexts() {
    for (const node of changed) {
      if (original.has(node)) node.nodeValue = original.get(node);
    }
    changed.clear();
  }

  function shortenTexts(scope) {
    const walker = document.createTreeWalker(scope, NodeFilter.SHOW_TEXT);
    for (let n = walker.nextNode(); n; n = walker.nextNode()) {
      const el = n.parentElement;
      if (!el || el.closest('[contenteditable="true"], input, textarea')) continue;
      const v = n.nodeValue;
      if (ZONE.test(v)) {
        if (!el.title) el.title = v.trim();
        setText(n, v.replace(ZONE, ''));
      }
    }
    // « Editing X #454 » : le numero est deja dans la pastille de la ligne.
    for (const t of scope.querySelectorAll('[data-nav-pane="changes"] [data-nav-panel-title]')) {
      const n = t.firstChild;
      if (n && n.nodeType === 3 && / #\d+$/.test(n.nodeValue)) setText(n, n.nodeValue.replace(/ #\d+$/, ''));
    }
  }

  // --- Document propre : paragraphes de tirets ----------------------------
  const RULE = /^[\s\-‐-―_=~*·•─━]{6,}$/;

  function markRules(scope) {
    for (const b of scope.querySelectorAll('[data-native-block-type="p"]')) {
      const p = b.querySelector('[data-document-paragraph]');
      const isRule = !!p && RULE.test(p.textContent) && /[^\s]/.test(p.textContent);
      if (isRule) b.setAttribute('data-sh-rule', '');
      else if (b.hasAttribute('data-sh-rule')) b.removeAttribute('data-sh-rule');
    }
  }

  // Le curseur dans une ligne de tirets : on la remontre telle quelle pour l ecrire.
  document.addEventListener('selectionchange', () => {
    const sel = document.getSelection();
    const node = sel && sel.anchorNode;
    const el = node && (node.nodeType === 1 ? node : node.parentElement);
    const block = el && el.closest('[data-sh-rule]');
    for (const b of document.querySelectorAll('[data-sh-caret]')) if (b !== block) b.removeAttribute('data-sh-caret');
    if (block) block.setAttribute('data-sh-caret', '');
  });

  // --- Listes plus calmes ---------------------------------------------------
  const PLACEHOLDER = /^(untitled|test\b|tests?\s*[-_:])/i;

  function markFaded(scope) {
    // Changesets « Open 0 » dans l onglet Changes.
    for (const tag of scope.querySelectorAll('[data-nav-pane="changes"] [data-seal-compound-tag]')) {
      const left = tag.querySelector('[data-seal-compound-tag-left]');
      const right = tag.querySelector('[data-seal-compound-tag-right]');
      const row = tag.closest('[data-list-item]');
      if (!left || !right || !row) continue;
      const empty = /open/i.test(left.textContent) && right.textContent.trim() === '0';
      row.toggleAttribute('data-sh-faded', empty);
    }
    // Brouillons sans titre ou de test dans les listes de gauche.
    for (const t of scope.querySelectorAll('[data-nav-pane="entities"] [data-nav-panel-title]')) {
      const row = t.closest('[data-list-item]');
      if (row) row.toggleAttribute('data-sh-faded', PLACEHOLDER.test(t.textContent.trim()));
    }
  }

  function clearMarks() {
    for (const el of document.querySelectorAll('[data-sh-rule]')) el.removeAttribute('data-sh-rule');
    for (const el of document.querySelectorAll('[data-sh-faded]')) el.removeAttribute('data-sh-faded');
  }

  // --- Info ferme a l ouverture d une fiche --------------------------------
  // Une seule fois par fiche : si tu rouvres Info, on n y touche plus.
  let lastPath = '';
  let closeUntil = 0;

  function closeInfoOnArrival() {
    if (location.pathname !== lastPath) {
      lastPath = location.pathname;
      closeUntil = Date.now() + 4000;
    }
    if (!isOn('info') || Date.now() > closeUntil) return;
    const panel = document.querySelector('[data-side-panel="open"]');
    const btn = panel && panel.querySelector('button[aria-label="Close panel"]');
    if (btn) {
      closeUntil = 0;
      btn.click();
    }
  }

  // --- Boucle -----------------------------------------------------------------
  let queued = false;

  function run() {
    queued = false;
    if (!document.body) return;
    observer.disconnect();
    try {
      if (isOn('dates')) shortenTexts(document.body);
      if (isOn('doc')) markRules(document.body);
      if (isOn('quiet')) markFaded(document.body);
      closeInfoOnArrival();
    } catch (e) {
      console.warn('[Seal Helper]', e);
    }
    observer.observe(document.body, { childList: true, subtree: true, characterData: true });
  }

  function schedule() {
    if (!queued) {
      queued = true;
      requestAnimationFrame(run);
    }
  }

  const observer = new MutationObserver(schedule);

  function refresh() {
    applyClasses();
    if (!isOn('dates')) restoreTexts();
    if (!opts.on) clearMarks();
    schedule();
  }

  chrome.storage.sync.get(KEY, r => {
    opts = { ...DEFAULTS, ...(r[KEY] || {}) };
    applyClasses();
    if (document.body) schedule();
    else document.addEventListener('DOMContentLoaded', schedule, { once: true });
  });

  chrome.storage.onChanged.addListener((changes, area) => {
    if (area !== 'sync' || !changes[KEY]) return;
    opts = { ...DEFAULTS, ...(changes[KEY].newValue || {}) };
    clearMarks();
    refresh();
  });
})();
