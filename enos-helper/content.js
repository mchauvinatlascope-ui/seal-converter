// enos Helper 0.1
// Ne fait que changer l affichage dans ce navigateur : n ecrit jamais dans enos,
// n envoie rien, ne touche a aucun formulaire.
// Dans enos l adresse ne change pas quand on ouvre un projet, une procedure ou une fiche :
// un raccourci est donc un chemin de clics (le rail, la loupe d une ligne, « Procedures »
// dans Details...) que l extension note en te regardant naviguer, et rejoue pour toi,
// clic par clic, sur les elements d origine d enos. Si un pas n est plus trouvable,
// elle s arrete et le dit ; enos reste comme d habitude.
(() => {
  if (window.top !== window) return; // jamais dans un cadre interne
  const VERSION = '0.1.0';
  const KEY = 'enosHelper';
  const DEFAULTS = { on: true, layout: 'drawer', recentMax: 30, palette: true, autoOpen: false };
  const root = document.documentElement;
  const isMac = /Mac/.test(navigator.platform);
  const SITE = 'eh:' + location.origin;
  let opts = { ...DEFAULTS };
  let store = { pins: [], recent: [] };
  let lastError = '';

  // ---------------------------------------------------------------- outils
  const $ = (sel, scope = document) => scope.querySelector(sel);
  const $$ = (sel, scope = document) => [...scope.querySelectorAll(sel)];
  const txt = el => (el ? (el.textContent || '').replace(/\s+/g, ' ').trim() : '');
  const ours = el => !!(el && el.closest && el.closest('#eh-side, #eh-pal, #eh-tab, #eh-toast'));
  function h(tag, attrs, ...kids) {
    const el = document.createElement(tag);
    for (const [k, v] of Object.entries(attrs || {})) {
      if (v == null || v === false) continue;
      if (k === 'class') el.className = v;
      else if (k === 'html') el.innerHTML = v; // seulement nos constantes d icones
      else if (k.startsWith('on')) el.addEventListener(k.slice(2), v);
      else el.setAttribute(k, v === true ? '' : v);
    }
    for (const kid of kids.flat()) {
      if (kid == null || kid === false) continue;
      el.append(kid instanceof Node ? kid : document.createTextNode(String(kid)));
    }
    return el;
  }
  const ICON = {
    search: '<svg viewBox="0 0 16 16"><circle cx="7" cy="7" r="4.3"/><path d="m10.3 10.3 3.2 3.2"/></svg>',
    star: '<svg viewBox="0 0 16 16"><path d="m8 2.5 1.7 3.5 3.8.5-2.8 2.6.7 3.8L8 11.1l-3.4 1.8.7-3.8L2.5 6.5l3.8-.5z"/></svg>',
    starFull: '<svg viewBox="0 0 16 16"><path fill="currentColor" d="m8 2.5 1.7 3.5 3.8.5-2.8 2.6.7 3.8L8 11.1l-3.4 1.8.7-3.8L2.5 6.5l3.8-.5z"/></svg>',
    clock: '<svg viewBox="0 0 16 16"><circle cx="8" cy="8" r="5.5"/><path d="M8 5v3.2l2 1.3"/></svg>',
    menu: '<svg viewBox="0 0 16 16"><path d="M3 4.5h10 M3 8h10 M3 11.5h10"/></svg>',
    page: '<svg viewBox="0 0 16 16"><path d="M4 2.5h5.5L12.5 5.5v8H4z M9.5 2.5v3h3"/></svg>',
    x: '<svg viewBox="0 0 16 16"><path d="m4 4 8 8 M12 4l-8 8"/></svg>',
    up: '<svg viewBox="0 0 16 16"><path d="m4 10 4-4 4 4"/></svg>',
    down: '<svg viewBox="0 0 16 16"><path d="m4 6 4 4 4-4"/></svg>',
    pen: '<svg viewBox="0 0 16 16"><path d="M10.5 3 13 5.5 6 12.5H3.5V10z"/></svg>',
  };
  const icon = (name, cls = 'eh-i') => h('span', { class: cls, 'aria-hidden': 'true', html: ICON[name] || ICON.page });
  const visible = el => { if (!el || !el.isConnected) return false; const r = el.getBoundingClientRect(); return r.width > 0 && r.height > 0 && getComputedStyle(el).visibility !== 'hidden'; };
  const sleep = ms => new Promise(r => setTimeout(r, ms));

  // Clic pour toi sur un element d enos (liens, boutons, icones, lignes).
  function press(el) {
    if (!el || !el.isConnected) return false;
    const o = { bubbles: true, cancelable: true, view: window, button: 0, pointerType: 'mouse', isPrimary: true };
    el.dispatchEvent(new PointerEvent('pointerdown', o));
    el.dispatchEvent(new MouseEvent('mousedown', o));
    el.dispatchEvent(new PointerEvent('pointerup', o));
    el.dispatchEvent(new MouseEvent('mouseup', o));
    el.click();
    return true;
  }

  // ------------------------------------------------------------ reglages
  function load(cb) {
    try {
      chrome.storage.sync.get(KEY, r => {
        opts = { ...DEFAULTS, ...((r && r[KEY]) || {}) };
        chrome.storage.local.get(SITE, s => {
          const v = (s && s[SITE]) || {};
          store = { pins: Array.isArray(v.pins) ? v.pins : [], recent: Array.isArray(v.recent) ? v.recent : [] };
          cb();
        });
      });
      chrome.storage.onChanged.addListener((ch, area) => {
        if (area === 'sync' && ch[KEY]) { opts = { ...DEFAULTS, ...(ch[KEY].newValue || {}) }; apply(); }
        if (area === 'local' && ch[SITE]) { const v = ch[SITE].newValue || {}; store = { pins: v.pins || [], recent: v.recent || [] }; render(); }
      });
    } catch (e) { lastError = 'storage: ' + e; cb(); }
  }
  function save() { try { chrome.storage.local.set({ [SITE]: store }); } catch (e) { lastError = 'save: ' + e; } }

  // ------------------------------------------------------------ la page en cours
  // Le rail d icones a gauche et la barre du haut : un clic la-dedans repart de zero.
  function railOf(el) { const r = el.getBoundingClientRect(); return r.left < 64 && r.width < 64 && r.top < window.innerHeight; }
  function topBarOf(el) { const r = el.getBoundingClientRect(); return r.top < 130 && r.height < 60; }
  // Fil d Ariane « Projects / Procedures / Procedure » dans la barre du haut.
  function crumb() {
    const cands = $$('.breadcrumb, [class*="breadcrumb"], [class*="crumb"]').filter(e => !ours(e) && visible(e));
    for (const c of cands) { const t = txt(c); if (t && t.length < 120) return t.replace(/\s*\/\s*/g, ' / '); }
    for (const e of $$('nav *, header *, div, span, a')) {
      if (ours(e) || e.children.length > 6) continue;
      const t = txt(e);
      if (t.length > 4 && t.length < 120 && / \/ /.test(t) && e.getBoundingClientRect().top < 130 && visible(e) && ![...e.children].some(k => / \/ /.test(txt(k)))) return t.replace(/\s*\/\s*/g, ' / ');
    }
    return '';
  }
  // Reference de la fiche ouverte (libelle « Reference » puis son champ) : lue dans ton navigateur, jamais envoyee.
  function reference() {
    const lab = $$('label, b, strong, span, div').find(e => !ours(e) && /^Reference$/i.test(txt(e)) && e.children.length === 0 && visible(e));
    if (!lab) return '';
    let box = lab.nextElementSibling;
    while (box && !box.matches('input, select, textarea, [contenteditable], .form-control') && !box.querySelector('input, select, textarea, [contenteditable], .form-control')) box = box.nextElementSibling;
    if (box && !box.matches('input, select, textarea, [contenteditable], .form-control')) box = box.querySelector('input, select, textarea, [contenteditable], .form-control');
    const v = box ? (box.value != null && box.value !== '' ? box.value : txt(box)) : '';
    return (v || '').trim().slice(0, 40);
  }
  function viewName() {
    const c = crumb();
    const ref = reference();
    const base = c || txt($$('h1, h2, h3, h4, [class*="panel-title"], [class*="panel-heading"], [class*="header"]').find(e => !ours(e) && visible(e) && txt(e).length > 1 && txt(e).length < 60)) || 'enos';
    return ref ? base + ' · ' + ref : base;
  }

  // ------------------------------------------------------------ le chemin de clics
  // Signature d un element clique : de quoi le retrouver (texte, titre, icone, ligne de tableau).
  const ACTIONABLE = 'a, button, [role="button"], [role="menuitem"], [role="tab"], [ng-click], [data-ng-click], [ui-sref], li, i, svg, img, th, td, tr, label, [tabindex]';
  function iconOf(el) {
    const cls = e => (e && typeof e.className === 'string' ? e.className.trim().split(/\s+/).filter(c => /^(fa|fas|far|fab|glyphicon|icon|bsi|ion|mdi)/.test(c)) : []);
    let c = cls(el);
    if (!c.length) for (const k of el.children) { c = cls(k); if (c.length) break; }
    return c.slice(0, 3).join(' ');
  }
  function sig(target) {
    let el = target.closest ? target.closest(ACTIONABLE) : null;
    if (!el || ours(el)) return null;
    // Une icone dans un bouton : on vise le bouton ; un td sans action : on vise la ligne.
    if (/^(i|svg|img)$/i.test(el.tagName) && el.parentElement && el.parentElement.closest('a, button, [role="button"], [ng-click], [data-ng-click]')) el = el.parentElement.closest('a, button, [role="button"], [ng-click], [data-ng-click]');
    const s = { tag: el.tagName.toLowerCase(), text: txt(el).slice(0, 60), title: (el.getAttribute('title') || el.getAttribute('aria-label') || el.getAttribute('placeholder') || '').slice(0, 60), icon: iconOf(el) };
    if (txt(el).length > 60) s.text = '';
    const row = el.closest('tr, [role="row"]');
    if (row && !/^(th|tr)$/.test(s.tag)) {
      s.row = rowKey(row);
      s.rowLabel = rowLabel(row);
      const inRow = $$(ACTIONABLE, row).filter(e => same(sigOf(e), s, true));
      s.n = Math.max(0, inRow.indexOf(el));
    } else {
      const all = $$(ACTIONABLE).filter(e => !ours(e) && same(sigOf(e), s, true));
      s.n = Math.max(0, all.indexOf(el));
    }
    s.root = railOf(el) || (topBarOf(el) && /home|logo|brand/i.test((el.className || '') + ' ' + s.icon + ' ' + (el.getAttribute('href') || '')));
    s.label = (s.text || s.title || (s.icon ? s.icon.replace(/^(fa|fas|far|glyphicon|icon|bsi)[- ]?/, '') : s.tag)) + (s.row ? ' on ' + (s.rowLabel || s.row) : '');
    return s;
  }
  // Une ligne de tableau : ses cellules (sans la colonne des actions) ; pour l afficher, la cellule qui ressemble a une reference.
  const rowCells = row => $$('td, [role="cell"], [role="gridcell"]', row).filter(c => txt(c) && !c.querySelector('a, button, [ng-click], [data-ng-click]'));
  const rowKey = row => rowCells(row).map(c => txt(c).slice(0, 40)).join(' | ').slice(0, 160) || txt(row).slice(0, 60);
  const rowLabel = row => { const t = rowCells(row).map(c => txt(c)); return (t.find(x => /^[A-Z]{1,5}-?\d{2,}/.test(x)) || t[1] || t[0] || '').slice(0, 40); };
  const sigOf = el => ({ tag: el.tagName.toLowerCase(), text: txt(el).length > 60 ? '' : txt(el).slice(0, 60), title: (el.getAttribute('title') || el.getAttribute('aria-label') || el.getAttribute('placeholder') || '').slice(0, 60), icon: iconOf(el) });
  const same = (a, b, loose) => a.tag === b.tag && a.text === b.text && a.title === b.title && (loose ? true : a.icon === b.icon) && (a.icon === b.icon || !b.icon || !a.icon);
  function find(s) {
    let scope = [document];
    if (s.row) {
      const rows = $$('tr, [role="row"]').filter(r => !ours(r) && visible(r) && rowKey(r) === s.row);
      if (!rows.length) return null;
      scope = rows;
    }
    const cands = scope.flatMap(sc => $$(ACTIONABLE, sc)).filter(e => !ours(e) && same(sigOf(e), s, true) && (s.row || visible(e) || s.tag === 'li' || s.tag === 'a'));
    if (!cands.length) return null;
    const exact = cands.filter(e => sigOf(e).icon === s.icon);
    const pool = exact.length ? exact : cands;
    return pool[Math.min(s.n || 0, pool.length - 1)] || pool[0];
  }

  // En te regardant naviguer : chaque clic dans enos est note ; un clic dans le rail repart de zero.
  let trail = [];
  let recording = true;
  document.addEventListener('click', e => {
    if (!opts.on || !recording || ours(e.target)) return;
    const s = sig(e.target);
    if (!s) return;
    if (s.root) trail = [s]; else { trail.push(s); if (trail.length > 14) trail = trail.slice(-14); }
    scheduleVisit();
  }, true);

  // Quand la page s est calmee apres un clic : la vue en cours va dans « Recent views ».
  let visitTimer = 0, lastView = '';
  function scheduleVisit() { clearTimeout(visitTimer); visitTimer = setTimeout(noteVisit, 1200); }
  function noteVisit() {
    if (!opts.on || !trail.length) return;
    const name = viewName();
    if (!name || name === 'enos' || name === lastView) { render(); return; }
    lastView = name;
    const r = store.recent.filter(x => x.name !== name);
    r.unshift({ name, trail: trail.map(s => ({ ...s })), at: Date.now() });
    store.recent = r.slice(0, Math.max(5, Math.min(100, opts.recentMax | 0 || 30)));
    save(); render();
  }

  // Rejouer un chemin : chaque pas attend que son element existe, clique, puis attend le calme.
  let replaying = null;
  function settle(max = 5000) {
    return new Promise(res => {
      let t = 0, done = false;
      const end = () => { if (done) return; done = true; mo.disconnect(); clearTimeout(t); res(); };
      const mo = new MutationObserver(() => { clearTimeout(t); t = setTimeout(end, 350); });
      mo.observe(document.body, { childList: true, subtree: true, attributes: true });
      t = setTimeout(end, 450);
      setTimeout(end, max);
    });
  }
  async function waitFor(s, max = 8000) {
    const t0 = Date.now();
    while (Date.now() - t0 < max) { const el = find(s); if (el) return el; await sleep(120); }
    return null;
  }
  function goHome() {
    const home = $$('a, button, [ng-click], i, span').find(e => !ours(e) && topBarOf(e) && /home/i.test(iconOf(e) + ' ' + (e.getAttribute('title') || '') + ' ' + (e.getAttribute('href') || '')));
    if (home) return press(home.closest('a, button, [ng-click]') || home);
    return false;
  }
  async function replay(item) {
    if (replaying) return;
    const steps = item.trail || [];
    if (!steps.length) { toast('This shortcut has no steps.'); return; }
    replaying = item; recording = false;
    root.classList.add('eh-busy');
    try {
      for (let i = 0; i < steps.length; i++) {
        const s = steps[i];
        toast('Opening ' + item.name + ' · step ' + (i + 1) + ' of ' + steps.length + ' (' + s.label + ')', true);
        let el = await waitFor(s, i === 0 ? 2500 : 8000);
        if (!el && i === 0 && goHome()) { await settle(); el = await waitFor(s, 6000); }
        if (!el) { toast('Could not follow step ' + (i + 1) + ' of ' + steps.length + ' (' + s.label + '). enos may have changed, or this view is reached from elsewhere. Open it by hand once, then pin it again.'); return; }
        press(el);
        await settle();
      }
      toast('Opened ' + item.name, false, 1800);
      trail = steps.map(s => ({ ...s }));
      lastView = '';
      noteVisit();
    } catch (e) { lastError = 'replay: ' + e; toast('Something went wrong while opening ' + item.name + '.'); }
    finally { replaying = null; recording = true; root.classList.remove('eh-busy'); }
  }
  const toastEl = h('div', { id: 'eh-toast', role: 'status', hidden: true });
  let toastT = 0;
  function toast(text, busy, ms) {
    if (!toastEl.isConnected) document.body.append(toastEl);
    toastEl.replaceChildren(...[busy ? h('span', { class: 'eh-spin' }) : null, h('span', {}, text), h('button', { type: 'button', title: 'Close', onclick: () => { toastEl.hidden = true; } }, icon('x'))].filter(Boolean));
    toastEl.hidden = false;
    clearTimeout(toastT);
    if (!busy) toastT = setTimeout(() => { toastEl.hidden = true; }, ms || 9000);
  }

  // ------------------------------------------------------------ epingles
  let naming = null; // { name } : saisie du nom en cours
  function pinHere() {
    if (!trail.length) { toast('Nothing to pin yet: open the view you want in enos first (from the rail), then Pin this view.'); return; }
    naming = { name: viewName() };
    render();
    const i = $('#eh-name'); if (i) { i.focus(); i.select(); }
  }
  function confirmPin() {
    if (!naming) return;
    const name = (naming.name || '').trim() || viewName();
    store.pins = store.pins.filter(p => p.name !== name);
    store.pins.push({ name, trail: trail.map(s => ({ ...s })), at: Date.now() });
    naming = null;
    save(); render();
    toast('Pinned « ' + name + ' » · ' + trail.length + ' step' + (trail.length > 1 ? 's' : ''), false, 3000);
  }
  function pinFromRecent(r) { store.pins = store.pins.filter(p => p.name !== r.name); store.pins.push({ name: r.name, trail: r.trail, at: Date.now() }); save(); render(); }
  function rename(p) {
    const i = h('input', { type: 'text', value: p.name, 'aria-label': 'Shortcut name', onkeydown: e => { if (e.key === 'Enter') { p.name = i.value.trim() || p.name; save(); render(); } if (e.key === 'Escape') render(); }, onblur: () => { p.name = i.value.trim() || p.name; save(); render(); } });
    return i;
  }

  // ------------------------------------------------------------ les menus d enos (Ctrl K)
  const ACT = 'a[href], button, [role="menuitem"], [role="button"], [role="tab"], [ng-click], [data-ng-click], [ui-sref], [bsi-action]';
  const SKIP = /^(ok|cancel|close|yes|no|×|x)$/i;
  function menuPath(el) {
    const parts = [];
    let p = el.parentElement;
    while (p && p !== document.body && parts.length < 3) {
      if (p.matches('li, .dropdown, [uib-dropdown], [class*="dropdown"], [class*="submenu"], [bsi-menu], [role="menuitem"]')) {
        const kids = [...p.children];
        const holder = kids.find(c => c.contains(el));
        const head = kids.find(c => c !== holder && kids.indexOf(c) < kids.indexOf(holder) && c.matches('a, button, span, label, [role="button"], [class*="toggle"]'));
        const t = txt(head);
        if (t && t.length < 40 && !parts.includes(t)) parts.unshift(t);
      }
      p = p.parentElement;
    }
    return parts;
  }
  function scanActions() {
    const out = [];
    const seen = new Set();
    for (const el of $$(ACT)) {
      if (ours(el) || el.closest('table, [role="grid"]')) continue;
      if (el.matches('input, textarea, select') || el.closest('[contenteditable="true"]')) continue;
      if (el.querySelector(ACT)) continue;
      const label = txt(el) || el.getAttribute('aria-label') || el.getAttribute('title') || '';
      if (!label || label.length > 60 || SKIP.test(label)) continue;
      const key = label.toLowerCase() + '|' + (el.getAttribute('href') || el.getAttribute('ng-click') || el.getAttribute('data-ng-click') || el.getAttribute('ui-sref') || '');
      if (seen.has(key)) continue;
      seen.add(key);
      out.push({ el, label, path: menuPath(el), hidden: !visible(el) });
    }
    return out;
  }
  function matches(q, a) {
    const hay = (a.label + ' ' + (a.path || []).join(' ')).toLowerCase();
    const words = q.toLowerCase().split(/\s+/).filter(Boolean);
    if (!words.every(w => hay.includes(w))) return 0;
    const l = a.label.toLowerCase();
    return l.startsWith(words[0]) ? 3 : l.includes(words[0]) ? 2 : 1;
  }

  // ------------------------------------------------------------ la barre
  const sideEl = h('aside', { id: 'eh-side', 'aria-label': 'enos Helper' });
  const tabEl = h('button', { id: 'eh-tab', type: 'button', title: 'enos Helper (' + (isMac ? '⌘' : 'Ctrl') + ' .)', onclick: () => toggleSide() }, h('span', {}, 'enos Helper'));
  let sideOpen = false;
  function toggleSide(force) {
    sideOpen = force == null ? !sideOpen : !!force;
    if (opts.layout === 'push') sideOpen = true;
    if (opts.layout === 'none') sideOpen = false;
    root.classList.toggle('eh-open', sideOpen);
    if (sideOpen) { render(); const q = $('#eh-q'); if (q) setTimeout(() => q.focus(), 30); }
  }
  function closeAll() { if (opts.layout !== 'push') toggleSide(false); closePalette(); }

  function when(at) {
    const d = new Date(at), now = new Date();
    const y = new Date(now); y.setDate(now.getDate() - 1);
    const hm = d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    if (d.toDateString() === now.toDateString()) return hm;
    if (d.toDateString() === y.toDateString()) return 'Yesterday ' + hm;
    return d.toLocaleDateString([], { day: 'numeric', month: 'short' });
  }
  const stepsHint = it => (it.trail || []).map(s => s.label).join(' › ');
  function row(it, kind, extra) {
    return h('button', { type: 'button', class: 'eh-row', title: stepsHint(it), onclick: () => { closeAll(); replay(it); } },
      icon(kind === 'pin' ? 'starFull' : 'clock'), h('span', { class: 'eh-t' }, it.name), extra);
  }
  let filter = '';
  function render() {
    if (!opts.on || !sideEl.isConnected) return;
    const q = filter.trim().toLowerCase();
    const inQ = it => !q || (it.name + ' ' + stepsHint(it)).toLowerCase().includes(q);
    const pins = store.pins.filter(inQ);
    const pinned = new Set(store.pins.map(p => p.name));
    const recent = store.recent.filter(r => !pinned.has(r.name) && inQ(r)).slice(0, q ? 30 : 12);
    const menu = q ? scanActions().map(a => [matches(q, a), a]).filter(x => x[0]).sort((a, b) => b[0] - a[0]).slice(0, 12).map(x => x[1]) : [];
    const tools = (i, arr, p) => h('span', { class: 'eh-mv' },
      h('button', { type: 'button', title: 'Rename', onclick: e => { e.stopPropagation(); const r = e.target.closest('.eh-row'); r.replaceChildren(rename(p)); r.querySelector('input').focus(); } }, icon('pen')),
      h('button', { type: 'button', title: 'Move up', disabled: i === 0, onclick: e => { e.stopPropagation(); [arr[i - 1], arr[i]] = [arr[i], arr[i - 1]]; save(); render(); } }, icon('up')),
      h('button', { type: 'button', title: 'Move down', disabled: i === arr.length - 1, onclick: e => { e.stopPropagation(); [arr[i + 1], arr[i]] = [arr[i], arr[i + 1]]; save(); render(); } }, icon('down')),
      h('button', { type: 'button', title: 'Remove shortcut', onclick: e => { e.stopPropagation(); arr.splice(i, 1); save(); render(); } }, icon('x')));
    const body = [
      h('header', {},
        h('b', {}, 'enos Helper'),
        opts.layout !== 'push' && h('button', { type: 'button', class: 'eh-x', title: 'Hide (' + (isMac ? '⌘' : 'Ctrl') + ' .)', onclick: () => toggleSide(false) }, icon('x'))),
      h('label', { class: 'eh-search' }, icon('search'), h('input', { id: 'eh-q', type: 'search', placeholder: 'Find a shortcut, a view, a menu…', value: filter, autocomplete: 'off',
        oninput: e => { filter = e.target.value; render(); const i = $('#eh-q'); if (i) { i.focus(); i.setSelectionRange(filter.length, filter.length); } },
        onkeydown: e => { if (e.key === 'Escape') { filter = ''; render(); } if (e.key === 'Enter') { const first = $('#eh-side .eh-row'); if (first) first.click(); } } })),
      naming
        ? h('div', { class: 'eh-naming' }, h('small', {}, 'Name of the shortcut (' + trail.length + ' step' + (trail.length > 1 ? 's' : '') + ': ' + trail.map(s => s.label).join(' › ') + ')'),
          h('input', { id: 'eh-name', type: 'text', value: naming.name, oninput: e => { naming.name = e.target.value; }, onkeydown: e => { if (e.key === 'Enter') confirmPin(); if (e.key === 'Escape') { naming = null; render(); } } }),
          h('div', {}, h('button', { type: 'button', class: 'eh-btn eh-main', onclick: confirmPin }, 'Pin'), h('button', { type: 'button', class: 'eh-btn', onclick: () => { naming = null; render(); } }, 'Cancel')))
        : h('button', { type: 'button', class: 'eh-pin', title: trail.length ? 'Steps so far: ' + trail.map(s => s.label).join(' › ') : 'Open a view in enos first', onclick: pinHere }, icon('star'), 'Pin this view', trail.length ? h('small', {}, trail.length + ' step' + (trail.length > 1 ? 's' : '')) : null),
      h('h2', {}, 'Shortcuts'),
      pins.length ? pins.map(p => row(p, 'pin', !q && tools(store.pins.indexOf(p), store.pins, p))) : h('p', { class: 'eh-empty' }, q ? 'No shortcut matches.' : 'Go to Procedures, to a query or to any view you use often, then Pin this view. From then on it opens in one click.'),
      q && h('h2', {}, 'In the enos menus'),
      q && (menu.length ? menu.map(a => h('button', { type: 'button', class: 'eh-row' + (a.hidden ? ' eh-dim' : ''), title: a.hidden ? 'In a closed menu' : '', onclick: () => { closeAll(); press(a.el); } },
        icon('menu'), h('span', { class: 'eh-t' }, a.label), a.path.length ? h('small', {}, a.path.join(' › ')) : null)) : h('p', { class: 'eh-empty' }, 'Nothing in the menus of this page.')),
      h('h2', {}, 'Recent views'),
      recent.length ? recent.map(r => row(r, 'recent', h('span', { class: 'eh-mv' }, h('button', { type: 'button', title: 'Pin as a shortcut', onclick: e => { e.stopPropagation(); pinFromRecent(r); } }, icon('star'))), h('small', {}, when(r.at)))) : h('p', { class: 'eh-empty' }, q ? 'No recent view matches.' : 'The views you open in enos will be listed here, and reopen in one click.'),
      h('footer', {}, 'v' + VERSION + ' · ' + (isMac ? '⌘' : 'Ctrl') + ' K finds · nothing is written to enos'),
    ];
    sideEl.replaceChildren(...body.flat().filter(Boolean));
  }

  // ------------------------------------------------------------ le chercheur Ctrl K
  const palEl = h('div', { id: 'eh-pal', role: 'dialog', 'aria-label': 'Find in enos', hidden: true });
  let palQ = '', palSel = 0, palItems = [];
  function palette() {
    const q = palQ.trim();
    const items = [];
    const inQ = it => !q || matches(q, { label: it.name || '', path: (it.trail || []).map(s => s.label) });
    for (const p of store.pins) if (inQ(p)) items.push({ kind: 'Shortcut', label: p.name, sub: stepsHint(p), run: () => replay(p) });
    if (q) for (const a of scanActions().map(a => [matches(q, a), a]).filter(x => x[0]).sort((a, b) => b[0] - a[0]).slice(0, 10)) items.push({ kind: 'Menu', label: a[1].label, sub: a[1].path.join(' › ') + (a[1].hidden ? ' · in a closed menu' : ''), run: () => press(a[1].el) });
    const pinned = new Set(store.pins.map(p => p.name));
    for (const r of store.recent.filter(r => !pinned.has(r.name) && inQ(r)).slice(0, q ? 10 : 6)) items.push({ kind: 'Recent', label: r.name, sub: when(r.at), run: () => replay(r) });
    palItems = items;
    palSel = Math.min(palSel, Math.max(0, items.length - 1));
    const list = h('div', { class: 'eh-list', role: 'listbox' }, items.length ? items.map((it, i) => h('button', { class: 'eh-it' + (i === palSel ? ' eh-sel' : ''), type: 'button', role: 'option', 'aria-selected': i === palSel ? 'true' : 'false',
      onclick: () => { closeAll(); it.run(); }, onmousemove: () => { if (palSel !== i) { palSel = i; palette(); } } },
      h('span', { class: 'eh-k' }, it.kind), h('span', { class: 'eh-t' }, it.label), it.sub ? h('small', {}, it.sub) : null)) : h('p', { class: 'eh-empty' }, q ? 'Nothing matches. Menus are found once enos has shown them at least once.' : 'Type to find a shortcut, a recent view or a menu entry.'));
    palEl.replaceChildren(
      h('label', { class: 'eh-search' }, icon('search'), h('input', { id: 'eh-pq', type: 'search', placeholder: 'Find in enos…', value: palQ, autocomplete: 'off',
        oninput: e => { palQ = e.target.value; palSel = 0; palette(); const i = $('#eh-pq'); if (i) { i.focus(); i.setSelectionRange(palQ.length, palQ.length); } },
        onkeydown: e => {
          if (e.key === 'ArrowDown') { e.preventDefault(); palSel = Math.min(palItems.length - 1, palSel + 1); palette(); }
          else if (e.key === 'ArrowUp') { e.preventDefault(); palSel = Math.max(0, palSel - 1); palette(); }
          else if (e.key === 'Enter') { e.preventDefault(); const it = palItems[palSel]; if (it) { closeAll(); it.run(); } }
          else if (e.key === 'Escape') { e.preventDefault(); closePalette(); }
        } })),
      list,
      h('footer', {}, '↑↓ choose · Enter open · Esc close'));
    const sel = $('#eh-pal .eh-sel'); if (sel) sel.scrollIntoView({ block: 'nearest' });
  }
  function openPalette() {
    if (!opts.on || !opts.palette) return;
    palQ = ''; palSel = 0;
    palEl.hidden = false;
    palette();
    const i = $('#eh-pq'); if (i) i.focus();
  }
  function closePalette() { palEl.hidden = true; }
  palEl.addEventListener('click', e => { if (e.target === palEl) closePalette(); });

  // ------------------------------------------------------------ clavier
  document.addEventListener('keydown', e => {
    if (!opts.on) return;
    const mod = isMac ? e.metaKey : e.ctrlKey;
    if (mod && !e.shiftKey && !e.altKey && e.key.toLowerCase() === 'k') { e.preventDefault(); e.stopImmediatePropagation(); if (palEl.hidden) openPalette(); else closePalette(); }
    else if (mod && !e.shiftKey && !e.altKey && e.key === '.') { e.preventDefault(); toggleSide(); }
    else if (e.key === 'Escape' && !palEl.hidden) { closePalette(); }
  }, true);

  // ------------------------------------------------------------ pose et retrait
  function mount() {
    if (!document.body) return;
    if (!sideEl.isConnected) document.body.append(sideEl);
    if (!tabEl.isConnected) document.body.append(tabEl);
    if (!palEl.isConnected) document.body.append(palEl);
  }
  function apply() {
    root.classList.toggle('eh-on', !!opts.on);
    root.classList.toggle('eh-push', opts.on && opts.layout === 'push');
    root.classList.toggle('eh-drawer', opts.on && opts.layout === 'drawer');
    if (!opts.on) { sideOpen = false; root.classList.remove('eh-open'); palEl.hidden = true; return; }
    mount();
    if (opts.layout === 'push') toggleSide(true);
    else if (opts.layout === 'none') toggleSide(false);
    else if (opts.autoOpen && !sideOpen) toggleSide(true);
    render();
  }
  function tick() { if (opts.on && !sideEl.isConnected) { mount(); render(); } }

  // Etat de la page pour la fenetre de l extension : structure et libelles de menus, jamais le contenu des tableaux ni tes raccourcis.
  function diagnose() {
    const lines = ['enos Helper ' + VERSION, 'url ' + location.href, 'title ' + (document.title || '').slice(0, 60),
      'layout ' + opts.layout + ' open ' + sideOpen + ' pins ' + store.pins.length + ' recent ' + store.recent.length + ' trail ' + trail.length + ' · last error ' + (lastError || 'none'),
      'crumb [' + crumb() + '] reference found ' + !!reference()];
    const attrs = new Map();
    for (const el of $$('*')) for (const a of el.attributes) if (/^(bsi-|data-testid|ng-controller|ui-view|ng-view|ng-app|ng-repeat)/.test(a.name)) attrs.set(a.name, (attrs.get(a.name) || 0) + 1);
    lines.push('markers ' + [...attrs.entries()].sort((a, b) => b[1] - a[1]).slice(0, 40).map(([k, v]) => k + '×' + v).join(' '));
    lines.push('frames ' + $$('iframe').length + ' · links ' + $$('a[href]').length + ' · ng-click ' + $$('[ng-click], [data-ng-click]').length + ' · tables ' + $$('table').length + ' · rows ' + $$('tr').length);
    const acts = scanActions();
    lines.push('menu entries ' + acts.length + ' (hidden ' + acts.filter(a => a.hidden).length + '): ' + acts.slice(0, 80).map(a => (a.path.length ? a.path.join('›') + '›' : '') + a.label.slice(0, 30) + (a.hidden ? '*' : '')).join(' | '));
    lines.push('rail icons ' + $$('i, svg, span').filter(e => !ours(e) && railOf(e) && iconOf(e)).map(e => iconOf(e) + (e.closest('[title]') ? '(' + e.closest('[title]').getAttribute('title') + ')' : '')).slice(0, 20).join(' '));
    lines.push('top bar icons ' + $$('i, svg').filter(e => !ours(e) && topBarOf(e) && iconOf(e)).map(e => iconOf(e)).slice(0, 20).join(' '));
    const selOf = el => el.tagName.toLowerCase() + (el.id ? '#' + el.id : '') + (el.className && typeof el.className === 'string' ? '.' + el.className.trim().split(/\s+/).slice(0, 3).join('.') : '') + [...el.attributes].filter(a => /^bsi-/.test(a.name)).slice(0, 3).map(a => '[' + a.name + '=' + a.value.slice(0, 25) + ']').join('');
    const rect = el => { const r = el.getBoundingClientRect(); return Math.round(r.left) + ',' + Math.round(r.top) + ' ' + Math.round(r.width) + 'x' + Math.round(r.height); };
    const dump = (el, depth) => { if (!el || depth > 4 || ours(el)) return; lines.push('  '.repeat(depth) + selOf(el) + ' ' + rect(el)); for (const c of [...el.children].slice(0, 8)) dump(c, depth + 1); };
    dump(document.body, 0);
    return lines.join('\n');
  }

  try {
    chrome.runtime.onMessage.addListener((m, _s, reply) => {
      if (!m || !/^(status|diag|forget)$/.test(m.eh)) return;
      if (m.eh === 'diag') { let text = ''; try { text = diagnose(); } catch (e) { text = 'diag failed: ' + e; } reply({ text }); return; }
      if (m.eh === 'forget') { store = { pins: [], recent: [] }; save(); render(); reply({ ok: true }); return; }
      reply({ v: VERSION, on: !!opts.on, layout: opts.layout, shown: sideEl.isConnected, pins: store.pins.length, recent: store.recent.length, error: lastError });
    });
  } catch (e) { lastError = 'message: ' + e; }

  load(() => {
    apply();
    setInterval(tick, 800);
  });
})();
