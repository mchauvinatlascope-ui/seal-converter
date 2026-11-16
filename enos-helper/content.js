// enos Helper 0.4
// Ne fait que changer l affichage dans ce navigateur : n ecrit jamais dans enos,
// n envoie rien, ne touche a aucun formulaire.
// Dans enos l adresse ne change pas quand on ouvre un projet, une procedure ou une fiche :
// un raccourci est donc un chemin de clics (une entree du menu, la loupe d une ligne,
// « Procedures » dans Details...) que l extension note en te regardant naviguer, et rejoue
// pour toi, clic par clic, sur les elements d origine d enos. Si un pas n est plus trouvable,
// elle s arrete et le dit ; enos reste comme d habitude.
// Reperes d enos (diagnostic du 2026-11-16) : header#content-navbar (40 px, orange),
// aside#sidebar_left 60 px avec ul#sidebar-menu (menu complet, sous-menus presents meme replies),
// section#content, aside#sidebar_right (Details, 350 px), icones fa-* / bsi-* / glyphicon-*.
(() => {
  if (window.top !== window) return; // jamais dans un cadre interne
  const VERSION = '0.4.0';
  const KEY = 'enosHelper';
  const DEFAULTS = { on: true, layout: 'drawer', recentMax: 30, palette: true, autoOpen: false, chips: true, calm: true, forms: false, resume: true };
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
  const ours = el => !!(el && el.closest && el.closest('#eh-side, #eh-pal, #eh-tab, #eh-toast, #eh-chips, #eh-pop'));
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
    chev: '<svg viewBox="0 0 16 16"><path d="m6 4 4 4-4 4"/></svg>',
    filter: '<svg viewBox="0 0 16 16"><path d="M2.5 3.5h11L9.5 8.5v4l-3 1.5v-5.5z"/></svg>',
  };
  const icon = (name, cls = 'eh-i') => h('span', { class: cls, 'aria-hidden': 'true', html: ICON[name] || ICON.page });
  const visible = el => { if (!el || !el.isConnected) return false; const r = el.getBoundingClientRect(); return r.width > 0 && r.height > 0 && getComputedStyle(el).visibility !== 'hidden'; };
  const sleep = ms => new Promise(r => setTimeout(r, ms));
  const mod = () => (isMac ? '⌘' : 'Ctrl');

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
          store = { pins: cleanItems(Array.isArray(v.pins) ? v.pins : []), recent: cleanItems(Array.isArray(v.recent) ? v.recent : []) };
          cb();
        });
      });
      chrome.storage.onChanged.addListener((ch, area) => {
        if (area === 'sync' && ch[KEY]) { opts = { ...DEFAULTS, ...(ch[KEY].newValue || {}) }; apply(); }
        if (area === 'local' && ch[SITE]) { const v = ch[SITE].newValue || {}; store = { pins: cleanItems(v.pins || []), recent: cleanItems(v.recent || []) }; render(); }
      });
    } catch (e) { lastError = 'storage: ' + e; cb(); }
  }
  function save() { try { chrome.storage.local.set({ [SITE]: store }); } catch (e) { lastError = 'save: ' + e; } }

  // ------------------------------------------------------------ les reperes d enos
  const navbar = () => $('header#content-navbar, header.navbar-fixed-top, header.navbar');
  const sideMenu = () => $('#sidebar-menu, #sidebar_left ul.sidebar-menu, aside.nano ul.nav');
  const loggedOut = () => !!$$('input[type="password"]').some(visible) || /\/login/.test(location.hash);
  // Le menu de gauche et la barre du haut : un clic la-dedans repart de zero.
  function railOf(el) {
    if (el.closest('#sidebar_left, #sidebar-menu, aside.sidebar-left, .sidebar-menu')) return true;
    const r = el.getBoundingClientRect(); return r.left < 64 && r.width < 64 && r.top < window.innerHeight;
  }
  function topBarOf(el) { if (el.closest('header#content-navbar, header.navbar-fixed-top')) return true; const r = el.getBoundingClientRect(); return r.top < 130 && r.height < 60; }
  // Clics qui ne menent nulle part (menu replie/deplie, plein ecran, verrou, notifications, compte, connexion).
  const NOISE = /^(toggle menu|fullscreen|lock session|get search results|sign in|log ?in|connexion|se connecter|logout|notifications?|received notifications|sent notifications|collapse|select all|\d+)$/i;
  // Un chemin enregistre par une version d avant peut porter des pas parasites (Sign In, ≡, compte) : on les retire.
  const noisyStep = st => NOISE.test(st.text || st.title || '') || (st.icon || '').split(/\s+/).some(c => /^(fa|glyphicon|bsi)-(navicon|bars|power-off|user|login-changer2|login-reset)$/.test(c));
  function cleanItems(items) {
    return items.filter(it => it && Array.isArray(it.trail)).map(it => ({ ...it, trail: it.trail.filter(st => st && !noisyStep(st)) })).filter(it => it.trail.length);
  }
  function noise(el, s) {
    if (el.closest('#toggle_sidemenu_l, .navbar-right, .growl-container, .modal-backdrop, #eh-chips')) return true;
    if (NOISE.test(s.text || s.title || '')) return true;
    if (loggedOut()) return true;
    return false;
  }
  // Fil d Ariane « Projects / Procedures / Procedure » dans la barre du haut.
  function crumb() {
    const cands = $$('.breadcrumb, [class*="breadcrumb"], [class*="crumb"], ol.breadcrumb li, #content-navbar .navbar-left ~ *').filter(e => !ours(e) && visible(e));
    for (const c of cands) { const t = txt(c); if (t && t.length < 120 && t.length > 1) return t.replace(/\s*\/\s*/g, ' / '); }
    for (const e of $$('header *, nav *, section > div > div, span, a, h1, h2, h3, h4')) {
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
    const F = 'input, select, textarea, [contenteditable], .form-control';
    let box = lab.nextElementSibling;
    while (box && !box.matches(F) && !box.querySelector(F)) box = box.nextElementSibling;
    if (!box && lab.parentElement) { box = lab.parentElement.nextElementSibling; while (box && !box.matches(F) && !box.querySelector(F)) box = box.nextElementSibling; }
    if (box && !box.matches(F)) box = box.querySelector(F);
    const v = box ? (box.value != null && box.value !== '' ? box.value : txt(box)) : '';
    return (v || '').trim().slice(0, 40);
  }
  // Titre du volet au travail (« Procedures », « Procedure », « Projects »).
  function panelTitle() {
    const c = $$('#content .panel-title, #content .panel-heading, #content h1, #content h2, #content h3, #content h4, #content [class*="title"], .panel-title, h4').filter(e => !ours(e) && visible(e) && txt(e).length > 1 && txt(e).length < 60);
    return txt(c[0]) || '';
  }
  function viewName() {
    const c = crumb();
    const ref = reference();
    const parts = c.split(' / ').map(x => x.trim()).filter(Boolean);
    const base = parts[parts.length - 1] || panelTitle() || 'enos';
    return ref ? base + ' ' + ref : base;
  }

  // ------------------------------------------------------------ le chemin de clics
  // Signature d un element clique : de quoi le retrouver (texte, titre, icone, ligne de tableau).
  const ACTIONABLE = 'a, button, [role="button"], [role="menuitem"], [role="tab"], [ng-click], [data-ng-click], [ui-sref], li, i, svg, img, th, td, tr, label, [tabindex]';
  function iconOf(el) {
    const cls = e => (e && typeof e.className === 'string' ? e.className.trim().split(/\s+/).filter(c => /^(fa|fas|far|fab|glyphicon|icon|bsi|ion|mdi)-/.test(c)) : []);
    let c = cls(el);
    if (!c.length) for (const k of el.children) { c = cls(k); if (c.length) break; }
    return c.slice(0, 3).join(' ');
  }
  function sig(target) {
    let el = target.closest ? target.closest(ACTIONABLE) : null;
    if (!el || ours(el)) return null;
    // Une icone dans un bouton : on vise le bouton.
    if (/^(i|svg|img)$/i.test(el.tagName) && el.parentElement && el.parentElement.closest('a, button, [role="button"], [ng-click], [data-ng-click]')) el = el.parentElement.closest('a, button, [role="button"], [ng-click], [data-ng-click]');
    const s = sigOf(el);
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
    if (noise(el, s)) return null;
    s.root = railOf(el) || (topBarOf(el) && /home|logo|brand/i.test((el.className || '') + ' ' + s.icon + ' ' + (el.getAttribute('href') || '')));
    s.menu = el.closest('#sidebar-menu, .sidebar-menu') ? menuPath(el).concat(s.text || s.title).filter(Boolean).join(' › ') : '';
    s.label = (s.menu || s.text || s.title || (s.icon ? s.icon.replace(/^(fa|fas|far|glyphicon|icon|bsi)-/, '') : s.tag)) + (s.row ? ' on ' + (s.rowLabel || s.row) : '');
    return s;
  }
  // Une ligne de tableau : la cellule qui ressemble a une reference (ML-040014), sinon les deux premieres cellules de texte
  // sans chiffres (les compteurs changent d un jour a l autre).
  const rowCells = row => $$('td, [role="cell"], [role="gridcell"]', row).filter(c => txt(c) && !c.querySelector('a, button, [ng-click], [data-ng-click]'));
  const refLike = t => /^[A-Z]{1,6}[-_ ]?\d{2,}|^\d{4}\/[A-Z]/.test(t);
  function rowKey(row) {
    const t = rowCells(row).map(c => txt(c).slice(0, 40));
    const ref = t.find(refLike);
    if (ref) return ref;
    return t.filter(x => !/^[\d.,% ]+$/.test(x)).slice(0, 2).join(' | ').slice(0, 100) || txt(row).slice(0, 60);
  }
  const rowLabel = row => { const t = rowCells(row).map(c => txt(c)); return (t.find(refLike) || t[1] || t[0] || '').slice(0, 40); };
  const actOf = el => (el.getAttribute('ng-click') || el.getAttribute('data-ng-click') || el.getAttribute('ui-sref') || '').slice(0, 120);
  const sigOf = el => ({ tag: el.tagName.toLowerCase(), text: txt(el).length > 60 ? '' : txt(el).slice(0, 60), title: (el.getAttribute('title') || el.getAttribute('aria-label') || el.getAttribute('placeholder') || '').slice(0, 60), icon: iconOf(el), href: (el.getAttribute('href') || '').slice(0, 80), act: actOf(el) });
  // Meme element : meme balise et, soit la meme action AngularJS (hors $index / $event), soit le meme texte et le meme titre.
  const actKey = a => (a || '').replace(/\$(index|event|parent)\b/g, '').replace(/\s+/g, '');
  const same = (a, b, loose) => a.tag === b.tag
    && ((a.act && b.act && actKey(a.act) === actKey(b.act)) || (a.text === b.text && a.title === b.title))
    && (loose ? true : a.icon === b.icon) && (a.icon === b.icon || !b.icon || !a.icon);
  function find(s) {
    let scope = [document];
    if (s.row) {
      const rows = $$('tr, [role="row"]').filter(r => !ours(r) && visible(r) && rowKey(r) === s.row);
      if (!rows.length) return null;
      scope = rows;
    }
    let cands = scope.flatMap(sc => $$(ACTIONABLE, sc)).filter(e => !ours(e) && same(sigOf(e), s, true) && (s.row || visible(e) || s.tag === 'li' || s.tag === 'a' || s.menu));
    if (s.href) { const byHref = cands.filter(e => (e.getAttribute('href') || '').slice(0, 80) === s.href); if (byHref.length) cands = byHref; }
    if (s.act) { const byAct = cands.filter(e => actKey(actOf(e)) === actKey(s.act)); if (byAct.length) cands = byAct; }
    if (!cands.length) return null;
    const exact = cands.filter(e => sigOf(e).icon === s.icon);
    const pool = exact.length ? exact : cands;
    return pool[Math.min(s.n || 0, pool.length - 1)] || pool[0];
  }

  // En te regardant naviguer : chaque clic utile dans enos est note ; un clic dans le menu de gauche repart de zero.
  let trail = [];
  let recording = true;
  document.addEventListener('click', e => {
    if (!opts.on || !recording || ours(e.target)) return;
    const s = sig(e.target);
    if (!s) return;
    if (s.root) trail = [s]; else { trail.push(s); if (trail.length > 14) trail = trail.slice(-14); }
    scheduleVisit();
    renderChips();
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
    hintOnce();
  }
  function hintOnce() {
    let seen = false;
    try { seen = localStorage.getItem('eh-hint') === '1'; } catch (e) {}
    if (seen || store.pins.length || trail.length < 2 || !opts.chips) return;
    try { localStorage.setItem('eh-hint', '1'); } catch (e) {}
    toast('Use this view often? Pin it with the ★ in the orange bar: it then opens in one click.', false, 9000);
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
  // Un pas qui est une entree du menu de gauche se retrouve par son chemin de libelles (Projects › Management), meme replie.
  function findMenuStep(s) {
    if (!s.menu) return null;
    const a = menuTree().find(x => x.full === s.menu) || menuTree().find(x => x.label === (s.text || s.title));
    return a ? a.el : null;
  }
  async function replay(item) {
    if (replaying) return;
    const steps = item.trail || [];
    if (!steps.length) { toast('This shortcut has no steps.'); return; }
    if (loggedOut()) { toast('Sign in to enos first, then open the shortcut.'); return; }
    replaying = item; recording = false;
    root.classList.add('eh-busy');
    try {
      for (let i = 0; i < steps.length; i++) {
        const s = steps[i];
        toast('Opening ' + item.name + ' · step ' + (i + 1) + ' of ' + steps.length + ' (' + s.label + ')', true);
        let el = findMenuStep(s) || await waitFor(s, i === 0 ? 2500 : 8000);
        if (!el) { toast('Stopped at step ' + (i + 1) + ' of ' + steps.length + ' (' + s.label + '): not found on this page. The view stays as it is. Open the view by hand once, then pin it again (drop the steps that are not part of the way).', false, 14000); return; }
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
  let naming = null; // { name, steps } : saisie du nom en cours, pas que l on peut retirer
  function pinHere(fromBar) {
    if (!trail.length) { toast('Nothing to pin yet: go to the view you want (left menu, then the row or the Details entry), then click ★.', false, 7000); return; }
    naming = { name: viewName(), steps: trail.map(s => ({ ...s })) };
    toastEl.hidden = true;
    if (fromBar) { renderPop(); return; }
    render();
    const i = $('#eh-name'); if (i) { i.focus(); i.select(); }
  }
  // La petite fenetre sous la barre orange : nommer l epingle, retirer un pas ; ou renommer / deplacer / retirer une puce.
  const popEl = h('div', { id: 'eh-pop', role: 'dialog', hidden: true });
  let popChip = null; // epingle dont on gere la puce
  function closePop() { popEl.hidden = true; popChip = null; if (naming && !sideOpen) naming = null; }
  function renderPop() {
    if (!popEl.isConnected) document.body.append(popEl);
    popEl.hidden = false;
    if (naming) {
      popEl.replaceChildren(
        h('div', { class: 'eh-pop-h' }, icon('star'), h('b', {}, 'Pin this view'), h('button', { type: 'button', class: 'eh-x', title: 'Close', onclick: closePop }, icon('x'))),
        h('input', { id: 'eh-name', type: 'text', value: naming.name, 'aria-label': 'Name of the shortcut', placeholder: 'Name', oninput: e => { naming.name = e.target.value; }, onkeydown: e => { if (e.key === 'Enter') { confirmPin(); closePop(); } if (e.key === 'Escape') closePop(); } }),
        h('small', {}, naming.steps.length + ' click' + (naming.steps.length > 1 ? 's' : '') + ' to replay · × removes one'),
        h('ol', { class: 'eh-steps' }, naming.steps.map((st, i) => h('li', {}, h('span', { class: 'eh-t' }, st.label), h('button', { type: 'button', title: 'Remove this step', onclick: () => { naming.steps.splice(i, 1); renderPop(); } }, icon('x'))))),
        h('div', { class: 'eh-pop-b' }, h('button', { type: 'button', class: 'eh-btn eh-main', disabled: !naming.steps.length, onclick: () => { confirmPin(); closePop(); } }, 'Pin'), h('button', { type: 'button', class: 'eh-btn', onclick: closePop }, 'Cancel')));
      const i = $('#eh-name'); if (i) { i.focus(); i.select(); }
      return;
    }
    if (popChip) {
      const p = popChip, i = store.pins.indexOf(p);
      const nameIn = h('input', { type: 'text', value: p.name, 'aria-label': 'Shortcut name', onkeydown: e => { if (e.key === 'Enter') { p.name = nameIn.value.trim() || p.name; save(); render(); closePop(); } if (e.key === 'Escape') closePop(); } });
      popEl.replaceChildren(
        h('div', { class: 'eh-pop-h' }, icon('starFull'), h('b', {}, p.name), h('button', { type: 'button', class: 'eh-x', title: 'Close', onclick: closePop }, icon('x'))),
        nameIn,
        h('small', {}, stepsHint(p)),
        h('div', { class: 'eh-pop-b' },
          h('button', { type: 'button', class: 'eh-btn eh-main', onclick: () => { p.name = nameIn.value.trim() || p.name; save(); render(); closePop(); } }, 'Rename'),
          h('button', { type: 'button', class: 'eh-btn', disabled: i <= 0, title: 'Move left', onclick: () => { [store.pins[i - 1], store.pins[i]] = [store.pins[i], store.pins[i - 1]]; save(); render(); closePop(); } }, '← Move'),
          h('button', { type: 'button', class: 'eh-btn', disabled: i >= store.pins.length - 1, title: 'Move right', onclick: () => { [store.pins[i + 1], store.pins[i]] = [store.pins[i], store.pins[i + 1]]; save(); render(); closePop(); } }, 'Move →'),
          h('button', { type: 'button', class: 'eh-btn eh-danger', onclick: () => { store.pins.splice(i, 1); save(); render(); closePop(); toast('Shortcut « ' + p.name + ' » removed.', false, 3000); } }, 'Remove')));
      nameIn.focus();
      return;
    }
    closePop();
  }
  document.addEventListener('pointerdown', e => { if (!popEl.hidden && !ours(e.target)) closePop(); }, true);
  function confirmPin() {
    if (!naming || !naming.steps.length) return;
    const name = (naming.name || '').trim() || viewName();
    store.pins = store.pins.filter(p => p.name !== name);
    store.pins.push({ name, trail: naming.steps, at: Date.now() });
    const n = naming.steps.length;
    naming = null;
    save(); render();
    toast('Pinned « ' + name + ' » · ' + n + ' step' + (n > 1 ? 's' : ''), false, 3000);
  }
  function pinFromRecent(r) { store.pins = store.pins.filter(p => p.name !== r.name); store.pins.push({ name: r.name, trail: r.trail, at: Date.now() }); save(); render(); }
  function rename(p) {
    const i = h('input', { type: 'text', value: p.name, 'aria-label': 'Shortcut name', onkeydown: e => { if (e.key === 'Enter') { p.name = i.value.trim() || p.name; save(); render(); } if (e.key === 'Escape') render(); }, onblur: () => { p.name = i.value.trim() || p.name; save(); render(); } });
    return i;
  }

  // ------------------------------------------------------------ les menus d enos
  const ACT = 'a[href], button, [role="menuitem"], [role="button"], [role="tab"], [ng-click], [data-ng-click], [ui-sref], [bsi-action]';
  const SKIP = /^(ok|cancel|close|yes|no|×|x)$/i;
  function menuPath(el) {
    const parts = [];
    let p = el.parentElement;
    while (p && p !== document.body && parts.length < 4) {
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
      if (ours(el) || el.closest('table, [role="grid"], .navbar-right, .growl-container')) continue;
      if (el.matches('input, textarea, select') || el.closest('[contenteditable="true"]')) continue;
      if (el.querySelector(ACT)) continue;
      const label = txt(el) || el.getAttribute('aria-label') || el.getAttribute('title') || '';
      if (!label || label.length > 60 || SKIP.test(label) || NOISE.test(label)) continue;
      const key = label.toLowerCase() + '|' + (el.getAttribute('href') || el.getAttribute('ng-click') || el.getAttribute('data-ng-click') || el.getAttribute('ui-sref') || '');
      if (seen.has(key)) continue;
      seen.add(key);
      out.push({ el, label, path: menuPath(el), hidden: !visible(el), menu: !!el.closest('#sidebar-menu, .sidebar-menu') });
    }
    return out;
  }
  // Le menu de gauche d enos, a plat : Projects › Management, Animals › Reports › Queries...
  function menuTree() {
    const m = sideMenu();
    if (!m) return [];
    return scanActions().filter(a => a.menu).map(a => ({ ...a, full: a.path.concat(a.label).join(' › '), top: a.path[0] || a.label }));
  }
  // Le volet Details de la fiche ouverte (aside#sidebar_right) : ses entrees, meme quand le volet est hors ecran.
  function detailEntries() {
    const right = $('#sidebar_right, aside.sidebar-right');
    if (!right) return [];
    const out = [];
    const seen = new Set();
    for (const el of $$('li, a, [ng-click], [data-ng-click]', right)) {
      if (el.querySelector('li, a, [ng-click]')) continue;
      const label = txt(el);
      if (!label || label.length > 40 || seen.has(label)) continue;
      seen.add(label);
      out.push({ el, label });
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
  // Ouvrir une entree de menu : clic sur l entree, apres ses parents si elle est repliee.
  function openMenuEntry(a) {
    trail = [];
    press(a.el);
    const s = sig(a.el);
    if (s) { s.root = true; trail = [s]; }
    scheduleVisit();
  }

  // ------------------------------------------------------------ les puces dans la barre d enos
  const chipsEl = h('div', { id: 'eh-chips', role: 'toolbar', 'aria-label': 'enos Helper shortcuts' });
  function renderChips() {
    if (!opts.on || !opts.chips || loggedOut()) { chipsEl.remove(); root.classList.remove('eh-chips'); return; }
    if (!chipsEl.isConnected && document.body) document.body.append(chipsEl);
    const pins = store.pins.slice(0, 9);
    root.classList.add('eh-chips');
    chipsEl.replaceChildren(
      h('button', { type: 'button', class: 'eh-chip eh-chip-pin', title: trail.length ? 'Pin this view (' + trail.length + ' click' + (trail.length > 1 ? 's' : '') + ')' : 'Go to a view first, then pin it here', onclick: () => pinHere(true) }, icon('star'), !pins.length && h('span', {}, 'Pin this view')),
      ...pins.map((p, i) => h('button', { type: 'button', class: 'eh-chip', title: stepsHint(p) + ' · Alt ' + (i + 1) + ' · right click to rename, move or remove', onclick: () => replay(p), oncontextmenu: e => { e.preventDefault(); naming = null; popChip = p; renderPop(); } }, h('span', {}, p.name))),
      h('button', { type: 'button', class: 'eh-chip eh-chip-more', title: 'Recent views, My queries, the enos menu (' + mod() + ' .) · ' + mod() + ' K finds', onclick: () => toggleSide() }, icon('menu')));
  }

  // ------------------------------------------------------------ la barre
  const sideEl = h('aside', { id: 'eh-side', 'aria-label': 'enos Helper' });
  const tabEl = h('button', { id: 'eh-tab', type: 'button', title: 'enos Helper (' + mod() + ' .)', onclick: () => toggleSide() }, h('span', {}, 'enos Helper'));
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
  let openGroups = new Set();
  function render() {
    renderChips();
    if (!opts.on || !sideEl.isConnected) return;
    const q = filter.trim().toLowerCase();
    const inQ = it => !q || (it.name + ' ' + stepsHint(it)).toLowerCase().includes(q);
    const pins = store.pins.filter(inQ);
    const pinned = new Set(store.pins.map(p => p.name));
    const recent = store.recent.filter(r => !pinned.has(r.name) && inQ(r)).slice(0, q ? 30 : 8);
    const acts = scanActions();
    const found = q ? acts.map(a => [matches(q, a), a]).filter(x => x[0]).sort((a, b) => b[0] - a[0]).slice(0, 14).map(x => x[1]) : [];
    const tree = !q ? acts.filter(a => a.menu).map(a => ({ ...a, top: a.path[0] || a.label })) : [];
    const details = !q ? detailEntries() : [];
    const queries = !q ? acts.filter(a => a.menu && /^quer/i.test(a.label)).map(a => ({ ...a, domain: a.path[0] || '' })) : [];
    const tops = [...new Set(tree.map(a => a.top))];
    const tools = (i, arr, p) => h('span', { class: 'eh-mv' },
      h('button', { type: 'button', title: 'Rename', onclick: e => { e.stopPropagation(); const r = e.target.closest('.eh-row'); r.replaceChildren(rename(p)); r.querySelector('input').focus(); } }, icon('pen')),
      h('button', { type: 'button', title: 'Move up', disabled: i === 0, onclick: e => { e.stopPropagation(); [arr[i - 1], arr[i]] = [arr[i], arr[i - 1]]; save(); render(); } }, icon('up')),
      h('button', { type: 'button', title: 'Move down', disabled: i === arr.length - 1, onclick: e => { e.stopPropagation(); [arr[i + 1], arr[i]] = [arr[i], arr[i + 1]]; save(); render(); } }, icon('down')),
      h('button', { type: 'button', title: 'Remove shortcut', onclick: e => { e.stopPropagation(); arr.splice(i, 1); save(); render(); } }, icon('x')));
    const menuRow = a => h('button', { type: 'button', class: 'eh-row' + (a.hidden && !a.menu ? ' eh-dim' : ''), title: a.path.concat(a.label).join(' › '), onclick: () => { closeAll(); openMenuEntry(a); } },
      icon(/quer/i.test(a.label) ? 'filter' : 'menu'), h('span', { class: 'eh-t' }, a.label), a.path.length ? h('small', {}, a.path.join(' › ')) : null);
    const body = [
      h('header', {},
        h('b', {}, 'enos Helper'),
        opts.layout !== 'push' && h('button', { type: 'button', class: 'eh-x', title: 'Hide (' + mod() + ' .)', onclick: () => toggleSide(false) }, icon('x'))),
      h('label', { class: 'eh-search' }, icon('search'), h('input', { id: 'eh-q', type: 'search', placeholder: 'Find a shortcut, a view, a menu…', value: filter, autocomplete: 'off',
        oninput: e => { filter = e.target.value; render(); const i = $('#eh-q'); if (i) { i.focus(); i.setSelectionRange(filter.length, filter.length); } },
        onkeydown: e => { if (e.key === 'Escape') { filter = ''; render(); } if (e.key === 'Enter') { const first = $('#eh-side .eh-row'); if (first) first.click(); } } })),
      naming
        ? h('div', { class: 'eh-naming' },
          h('input', { id: 'eh-name', type: 'text', value: naming.name, 'aria-label': 'Name of the shortcut', oninput: e => { naming.name = e.target.value; }, onkeydown: e => { if (e.key === 'Enter') confirmPin(); if (e.key === 'Escape') { naming = null; render(); } } }),
          h('small', {}, naming.steps.length + ' step' + (naming.steps.length > 1 ? 's' : '') + ' · remove the ones that are not part of the way:'),
          h('ol', { class: 'eh-steps' }, naming.steps.map((s, i) => h('li', {}, h('span', { class: 'eh-t' }, s.label), h('button', { type: 'button', title: 'Remove this step', onclick: () => { naming.steps.splice(i, 1); render(); } }, icon('x'))))),
          h('div', {}, h('button', { type: 'button', class: 'eh-btn eh-main', disabled: !naming.steps.length, onclick: confirmPin }, 'Pin'), h('button', { type: 'button', class: 'eh-btn', onclick: () => { naming = null; render(); } }, 'Cancel')))
        : h('button', { type: 'button', class: 'eh-pin', title: trail.length ? 'Steps so far: ' + trail.map(s => s.label).join(' › ') : 'Go to a view in enos first', onclick: pinHere }, icon('star'), 'Pin this view', trail.length ? h('small', {}, trail.length + ' step' + (trail.length > 1 ? 's' : '')) : null),
      h('h2', {}, 'Shortcuts'),
      pins.length ? pins.map(p => row(p, 'pin', !q && tools(store.pins.indexOf(p), store.pins, p))) : h('p', { class: 'eh-empty' }, q ? 'No shortcut matches.' : 'Go to Procedures, to a query or to any view you use often, then Pin this view. It then opens in one click, here, in the orange bar, and with Alt 1 to 9.'),
      q && h('h2', {}, 'In the enos menus'),
      q && (found.length ? found.map(menuRow) : h('p', { class: 'eh-empty' }, 'Nothing in the menus of this page.')),
      !q && recent.length ? h('h2', {}, 'Recent views') : null,
      !q && recent.length ? recent.map(r => row(r, 'recent', h('span', { class: 'eh-mv' }, h('button', { type: 'button', title: 'Pin as a shortcut', onclick: e => { e.stopPropagation(); pinFromRecent(r); } }, icon('star'))), h('small', {}, when(r.at)))) : null,
      q && recent.length ? [h('h2', {}, 'Recent views'), recent.map(r => row(r, 'recent', h('small', {}, when(r.at))))] : null,
      details.length ? h('h2', {}, 'This record') : null,
      details.length ? h('div', { class: 'eh-wrap' }, details.map(d => h('button', { type: 'button', class: 'eh-tag', title: 'Open ' + d.label + ' in the Details panel', onclick: () => { closeAll(); press(d.el); const s = sig(d.el); if (s) { trail.push(s); scheduleVisit(); } } }, d.label))) : null,
      queries.length ? h('h2', {}, 'My queries') : null,
      queries.length ? queries.map(a => h('button', { type: 'button', class: 'eh-row', title: a.path.concat(a.label).join(' › '), onclick: () => { closeAll(); openMenuEntry(a); } }, icon('filter'), h('span', { class: 'eh-t' }, a.domain || a.label), h('small', {}, 'Queries'))) : null,
      !q && tops.length ? h('h2', {}, 'enos menu') : null,
      !q && tops.map(t => {
        const kids = tree.filter(a => a.top === t && a.path.length);
        const head = tree.find(a => a.top === t && !a.path.length);
        const open = openGroups.has(t);
        return h('div', { class: 'eh-group' + (open ? ' eh-open' : '') },
          h('button', { type: 'button', class: 'eh-row eh-grp', onclick: () => { if (!kids.length && head) { closeAll(); openMenuEntry(head); return; } if (open) openGroups.delete(t); else openGroups.add(t); render(); } },
            kids.length ? icon('chev', 'eh-i eh-chev') : icon('menu'), h('span', { class: 'eh-t' }, t), kids.length ? h('small', {}, kids.length) : null),
          open && kids.map(a => h('button', { type: 'button', class: 'eh-row eh-sub', title: a.path.concat(a.label).join(' › '), onclick: () => { closeAll(); openMenuEntry(a); } },
            icon(/quer/i.test(a.label) ? 'filter' : 'page'), h('span', { class: 'eh-t' }, a.path.slice(1).concat(a.label).join(' › ')))));
      }),
      h('footer', {}, 'v' + VERSION + ' · ' + mod() + ' K finds · Alt 1-9 shortcuts · nothing is written to enos'),
    ];
    sideEl.replaceChildren(...body.flat(3).filter(Boolean));
  }

  // ------------------------------------------------------------ le chercheur Ctrl K
  const palEl = h('div', { id: 'eh-pal', role: 'dialog', 'aria-label': 'Find in enos', hidden: true });
  let palQ = '', palSel = 0, palItems = [];
  function palette() {
    const q = palQ.trim();
    const items = [];
    const inQ = it => !q || matches(q, { label: it.name || '', path: (it.trail || []).map(s => s.label) });
    for (const p of store.pins) if (inQ(p)) items.push({ kind: 'Shortcut', label: p.name, sub: stepsHint(p), run: () => replay(p) });
    if (q) for (const a of scanActions().map(a => [matches(q, a), a]).filter(x => x[0]).sort((a, b) => b[0] - a[0]).slice(0, 10)) items.push({ kind: 'Menu', label: a[1].label, sub: a[1].path.join(' › ') + (a[1].hidden && !a[1].menu ? ' · in a closed menu' : ''), run: () => openMenuEntry(a[1]) });
    const pinned = new Set(store.pins.map(p => p.name));
    for (const r of store.recent.filter(r => !pinned.has(r.name) && inQ(r)).slice(0, q ? 10 : 6)) items.push({ kind: 'Recent', label: r.name, sub: when(r.at), run: () => replay(r) });
    palItems = items;
    palSel = Math.min(palSel, Math.max(0, items.length - 1));
    const list = h('div', { class: 'eh-list', role: 'listbox' }, items.length ? items.map((it, i) => h('button', { class: 'eh-it' + (i === palSel ? ' eh-sel' : ''), type: 'button', role: 'option', 'aria-selected': i === palSel ? 'true' : 'false',
      onclick: () => { closeAll(); it.run(); }, onmousemove: () => { if (palSel !== i) { palSel = i; palette(); } } },
      h('span', { class: 'eh-k' }, it.kind), h('span', { class: 'eh-t' }, it.label), it.sub ? h('small', {}, it.sub) : null)) : h('p', { class: 'eh-empty' }, q ? 'Nothing matches.' : 'Type to find a shortcut, a recent view or an entry of the enos menu (Procedures, Queries, Animals…).'));
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
    const m = isMac ? e.metaKey : e.ctrlKey;
    if (m && !e.shiftKey && !e.altKey && e.key.toLowerCase() === 'k') { e.preventDefault(); e.stopImmediatePropagation(); if (palEl.hidden) openPalette(); else closePalette(); }
    else if (m && !e.shiftKey && !e.altKey && e.key === '.') { e.preventDefault(); toggleSide(); }
    else if (e.altKey && !m && !e.shiftKey && /^[1-9]$/.test(e.key)) { const p = store.pins[+e.key - 1]; if (p) { e.preventDefault(); closeAll(); replay(p); } }
    else if (e.key === 'Escape' && !palEl.hidden) { closePalette(); }
    else if (e.key === 'Escape' && !popEl.hidden) { closePop(); }
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
    root.classList.toggle('eh-calm', opts.on && !!opts.calm);
    root.classList.toggle('eh-forms', opts.on && !!opts.forms);
    if (!opts.on) { sideOpen = false; root.classList.remove('eh-open', 'eh-calm', 'eh-forms', 'eh-chips'); palEl.hidden = true; popEl.hidden = true; chipsEl.remove(); return; }
    mount();
    if (opts.layout === 'push') toggleSide(true);
    else if (opts.layout === 'none') toggleSide(false);
    else if (opts.autoOpen && !sideOpen) toggleSide(true);
    render();
  }
  // A l arrivee sur l accueil (apres connexion ou rechargement) : proposer de rouvrir la derniere vue.
  let resumed = false;
  function offerResume() {
    if (resumed || !opts.on || !opts.resume || loggedOut() || replaying) return;
    if (!/^#\/?$/.test(location.hash) || trail.length) return;
    const last = store.recent[0];
    if (!last || !last.trail || !last.trail.length) { resumed = true; return; }
    resumed = true;
    if (!toastEl.isConnected) document.body.append(toastEl);
    toastEl.replaceChildren(h('span', {}, 'Back to « ' + last.name + ' »?'), h('button', { type: 'button', class: 'eh-tbtn', onclick: () => { toastEl.hidden = true; replay(last); } }, 'Open'), h('button', { type: 'button', title: 'Close', onclick: () => { toastEl.hidden = true; } }, icon('x')));
    toastEl.hidden = false;
    clearTimeout(toastT);
    toastT = setTimeout(() => { toastEl.hidden = true; }, 15000);
  }
  let wasOut = null;
  function tick() {
    if (!opts.on) return;
    if (!sideEl.isConnected) { mount(); render(); }
    const out = loggedOut();
    if (out !== wasOut) { wasOut = out; if (out) trail = []; renderChips(); }
    else if (!out && opts.chips && !chipsEl.isConnected) renderChips();
    if (!out && sideMenu()) offerResume();
  }

  // Etat de la page pour la fenetre de l extension : structure et libelles de menus, jamais le contenu des tableaux ni tes raccourcis.
  function diagnose() {
    const lines = ['enos Helper ' + VERSION, 'url ' + location.href, 'title ' + (document.title || '').slice(0, 60),
      'layout ' + opts.layout + ' chips ' + opts.chips + ' calm ' + opts.calm + ' forms ' + opts.forms + ' resume ' + opts.resume + ' open ' + sideOpen + ' pins ' + store.pins.length + ' recent ' + store.recent.length + ' trail ' + trail.length + ' logged out ' + loggedOut() + ' · last error ' + (lastError || 'none'),
      'crumb [' + crumb() + '] panel [' + panelTitle() + '] reference found ' + !!reference() + ' navbar ' + !!navbar() + ' side menu ' + !!sideMenu()];
    const attrs = new Map();
    for (const el of $$('*')) for (const a of el.attributes) if (/^(bsi-|data-testid|ng-controller|ui-view|ng-view|ng-app|ng-repeat)/.test(a.name)) attrs.set(a.name, (attrs.get(a.name) || 0) + 1);
    lines.push('markers ' + [...attrs.entries()].sort((a, b) => b[1] - a[1]).slice(0, 40).map(([k, v]) => k + '×' + v).join(' '));
    lines.push('frames ' + $$('iframe').length + ' · links ' + $$('a[href]').length + ' · ng-click ' + $$('[ng-click], [data-ng-click]').length + ' · tables ' + $$('table').length + ' · rows ' + $$('tr').length);
    const acts = scanActions();
    lines.push('menu entries ' + acts.length + ' (hidden ' + acts.filter(a => a.hidden).length + '): ' + acts.slice(0, 90).map(a => (a.path.length ? a.path.join('›') + '›' : '') + a.label.slice(0, 30) + (a.hidden ? '*' : '') + ((a.el.getAttribute('href') || '').replace(/[0-9a-f-]{20,}/g, 'ID') ? '=' + (a.el.getAttribute('href') || '').slice(0, 40) : '')).join(' | '));
    const top = navbar();
    if (top) lines.push('navbar texts ' + $$('*', top).filter(e => e.children.length === 0 && txt(e)).map(e => txt(e).slice(0, 40)).slice(0, 20).join(' | '));
    const rect = el => { const r = el.getBoundingClientRect(); return Math.round(r.left) + ',' + Math.round(r.top) + ' ' + Math.round(r.width) + 'x' + Math.round(r.height); };
    const selOf = el => el.tagName.toLowerCase() + (el.id ? '#' + el.id : '') + (el.className && typeof el.className === 'string' ? '.' + el.className.trim().split(/\s+/).slice(0, 3).join('.') : '') + [...el.attributes].filter(a => /^bsi-/.test(a.name)).slice(0, 3).map(a => '[' + a.name + '=' + a.value.slice(0, 25) + ']').join('');
    const content = $('#content, section.content-main');
    if (content) { lines.push('content tree:'); const dump = (el, depth) => { if (!el || depth > 5 || ours(el)) return; lines.push('  '.repeat(depth) + selOf(el) + ' ' + rect(el) + (el.children.length === 0 && txt(el) && txt(el).length < 30 && !el.closest('table') ? ' "' + txt(el) + '"' : '')); for (const c of [...el.children].slice(0, 10)) dump(c, depth + 1); }; dump(content, 0); }
    const right = $('#sidebar_right');
    if (right) lines.push('details entries ' + detailEntries().map(d => d.label).join(' | '));
    if (right) { lines.push('right panel ' + rect(right) + ' texts ' + $$('*', right).filter(e => e.children.length === 0 && txt(e)).map(e => txt(e).slice(0, 30)).slice(0, 20).join(' | ')); }
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
