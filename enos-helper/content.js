// enos Helper 1.1.3
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
  const VERSION = '1.1.3';
  const KEY = 'enosHelper';
  const DEFAULTS = { on: true, layout: 'drawer', recentMax: 30, palette: true, autoOpen: false, chips: true, calm: true, forms: false, resume: true, home: true };
  const root = document.documentElement;
  const isMac = /Mac/.test(navigator.platform);
  const SITE = 'eh:' + location.origin;
  let opts = { ...DEFAULTS };
  let store = { pins: [], recent: [] };
  let lastError = '';
  let lastStop = ''; // dernier arret d un trajet, en comptes et oui / non (pour le diagnostic)
  const WEL = 'eh:welcome';
  let welcomed = null; // null = pas encore lu ; false = premiere installation a montrer

  // ---------------------------------------------------------------- outils
  const $ = (sel, scope = document) => scope.querySelector(sel);
  const $$ = (sel, scope = document) => [...scope.querySelectorAll(sel)];
  const txt = el => (el ? (el.textContent || '').replace(/\s+/g, ' ').trim() : '');
  const ours = el => !!(el && el.closest && el.closest('#eh-side, #eh-pal, #eh-tab, #eh-toast, #eh-chips, #eh-pop, #eh-home, #eh-welcome, #eh-prog, [data-eh]'));
  function h(tag, attrs, ...kids) {
    const el = document.createElement(tag);
    for (const [k, v] of Object.entries(attrs || {})) {
      if (v == null || v === false) continue;
      if (k === 'class') el.className = v;
      else if (k === 'html') el.innerHTML = v; // seulement nos constantes d icones
      else if (k.startsWith('on')) el.addEventListener(k.slice(2), v);
      else el.setAttribute(k, v === true ? '' : v);
    }
    for (const kid of kids.flat(Infinity)) {
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
    home: '<svg viewBox="0 0 16 16"><path d="M2.5 7.5 8 2.8l5.5 4.7V13h-3.6V9.6H6.1V13H2.5z"/></svg>',
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
          chrome.storage.local.get(WEL, w => { welcomed = !!(w && w[WEL]); cb(); });
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
  const noisyStep = st => /^(form|fieldset|table|tbody|thead|section|main|aside|header|body|html)$/.test(st.tag || '') || NOISE.test(st.text || st.title || '') || (st.icon || '').split(/\s+/).some(c => /^(fa|glyphicon|bsi)-(navicon|bars|power-off|user|login-changer2|login-reset)$/.test(c));
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
  const ACTIONABLE = 'input[type="checkbox"], input[type="radio"], a, button, [role="button"], [role="menuitem"], [role="tab"], [ng-click], [data-ng-click], [ui-sref], li, i, svg, img, th, td, tr, label, [tabindex]';
  // Une fenetre d enos (« Query Parameters »...) : le bloc le plus haut, en position fixe ou absolue, qui n est ni la zone de travail,
  // ni la barre, ni un volet. Ce qu on y clique se compte DANS la fenetre (la 5e case de la fenetre, pas de la page).
  function layerOf(el) {
    let best = null;
    for (let p = el; p && p !== document.body && p !== root; p = p.parentElement) {
      if (ours(p) || p.matches('#content, section.content-main, #content-navbar, header, #sidebar_left, #sidebar_right, #sidebar-menu')) return null;
      if (p.querySelector('#content, #content-navbar')) break;
      const pos = getComputedStyle(p).position;
      if (pos === 'fixed' || pos === 'absolute') best = p;
    }
    return best;
  }
  function topLayer() {
    for (const y of [0.35, 0.5, 0.2]) {
      const e = document.elementFromPoint(Math.round(innerWidth / 2), Math.round(innerHeight * y));
      const L = e && !ours(e) ? layerOf(e) : null;
      if (L) { const r = L.getBoundingClientRect(); if (r.width > 280 && r.height > 120) return L; }
    }
    return null;
  }
  // Le champ d une ligne de parametres (« Line - Name ») pour dire quelle case est cochee : la premiere liste remplie de la ligne.
  function fieldOfBox(el) {
    let p = el.parentElement;
    for (let k = 0; p && k < 6; k++, p = p.parentElement) {
      const sel = $$('select', p);
      if (!sel.length) continue;
      if ($$('input[type="checkbox"]', p).length !== 1) return '';
      const t = sel.map(x => (x.selectedIndex >= 0 && x.options[x.selectedIndex] ? x.options[x.selectedIndex].text.trim() : '')).filter(Boolean)[0];
      return (t || '').slice(0, 40);
    }
    return '';
  }
  const CONTAINER = /^(FORM|FIELDSET|TABLE|TBODY|THEAD|SECTION|MAIN|ASIDE|HEADER|BODY|HTML)$/;
  function iconOf(el) {
    const cls = e => (e && typeof e.className === 'string' ? e.className.trim().split(/\s+/).filter(c => /^(fa|fas|far|fab|glyphicon|icon|imoon|icomoon|bsi|ion|mdi)-/.test(c)) : []);
    let c = cls(el);
    if (!c.length) for (const k of el.children) { c = cls(k); if (c.length) break; }
    if (!c.length) { const d = el.querySelector('[class*="fa-"], [class*="glyphicon-"], [class*="imoon-"], [class*="bsi-"]'); if (d) c = cls(d); }
    if (!c.length) { const b = el.getAttribute('bsi-icon') || (el.querySelector('[bsi-icon]') ? el.querySelector('[bsi-icon]').getAttribute('bsi-icon') : ''); if (b) c = ['bsi-icon:' + b.slice(0, 40)]; }
    return c.slice(0, 3).join(' ');
  }
  function sig(target) {
    if (!target.closest || target.closest('input:not([type="checkbox"]):not([type="radio"]), select, textarea, option, [contenteditable="true"]')) return null; // taper dans un champ n est pas un pas
    let el = target.closest(ACTIONABLE);
    if (!el || ours(el)) return null;
    if (CONTAINER.test(el.tagName) || (!el.matches('a, button, [role="button"]') && el.querySelector('input, select, textarea'))) return null; // un formulaire, un bloc de filtres
    // Une icone dans un bouton : on vise le bouton.
    if (/^(i|svg|img)$/i.test(el.tagName) && el.parentElement && el.parentElement.closest('a, button, [role="button"], [ng-click], [data-ng-click]')) el = el.parentElement.closest('a, button, [role="button"], [ng-click], [data-ng-click]');
    const s = sigOf(el);
    if (el.tagName === 'INPUT') { s.want = el.type === 'radio' ? true : el.checked; s.say = (el.type === 'radio' ? 'option' : (s.want ? 'tick' : 'untick')) + (fieldOfBox(el) ? ' « ' + fieldOfBox(el) + ' »' : (s.title ? ' ' + s.title : '')); } // l etat voulu : au moment du clic, la case a deja pris son nouvel etat
    const row = el.closest('tr, [role="row"]');
    if (row && !/^(th|tr)$/.test(s.tag)) {
      s.row = rowKey(row);
      s.rowLabel = rowLabel(row);
      s.filters = listFilters(row.closest('table, [role="grid"]'));
      if (!/^(td|tr|th)$/.test(s.tag)) { const bs = rowButtons(row, s.tag); s.pos = bs.indexOf(el); s.posN = bs.length; }
      const inRow = $$(ACTIONABLE, row).filter(e => same(sigOf(e), s, true));
      s.n = Math.max(0, inRow.indexOf(el));
    } else {
      const L = layerOf(el);
      if (L) s.layer = 1;
      const all = $$(ACTIONABLE, L || document).filter(e => !ours(e) && same(sigOf(e), s, true));
      s.n = Math.max(0, all.indexOf(el));
    }
    if (noise(el, s)) return null;
    s.root = railOf(el) || (topBarOf(el) && /home|logo|brand/i.test((el.className || '') + ' ' + s.icon + ' ' + (el.getAttribute('href') || '')));
    s.menu = el.closest('#sidebar-menu, .sidebar-menu') ? menuPath(el).concat(s.text || s.title).filter(Boolean).join(' › ') : '';
    s.label = (s.menu || s.say || s.text || s.title || (s.icon ? s.icon.replace(/^(fa|fas|far|glyphicon|icon|imoon|bsi)-/, '') : s.tag)) + (s.row ? ' on ' + (s.rowLabel || s.row) : '');
    return s;
  }
  // Les filtres remplis au-dessus d une liste (Reference « *ml* », Status...) : leur libelle et leur valeur, pour les remettre au rejeu.
  function filterLabel(inp) {
    const id = inp.id;
    const lab = (id && $('label[for="' + CSS.escape(id) + '"]')) || null;
    const holder = inp.closest('[bsi-attribute], [bsi-label], .form-group, .col-sm-1, .col-sm-2, .col-sm-3, .col-sm-4, .col-md-3, .col-md-4, div');
    const near = lab || (holder && $$('label, span, b, div', holder).find(e => e !== inp && e.children.length === 0 && txt(e) && txt(e).length < 40 && e.compareDocumentPosition(inp) & Node.DOCUMENT_POSITION_FOLLOWING));
    const attr = inp.closest('[bsi-attribute]');
    return { label: txt(near) || inp.getAttribute('placeholder') || inp.getAttribute('aria-label') || inp.name || '', attr: attr ? attr.getAttribute('bsi-attribute') : '', name: inp.name || inp.id || '' };
  }
  function listFilters(table) {
    const content = $('#content, section.content-main') || document.body;
    const out = [];
    for (const inp of $$('input:not([type="checkbox"]):not([type="radio"]):not([type="hidden"]):not([type="button"]):not([type="submit"]), select', content)) {
      if (ours(inp) || (table && table.contains(inp)) || inp.closest('table, [role="grid"], #eh-chips') || !visible(inp)) continue;
      const v = inp.tagName === 'SELECT' ? (inp.selectedIndex > 0 ? inp.options[inp.selectedIndex].text : '') : (inp.value || '').trim();
      if (!v || inp.closest('.navbar, header, #sidebar_left, #sidebar_right')) continue;
      if (inp.closest('form') && inp.closest('form').querySelector('[type="password"]')) continue;
      out.push({ ...filterLabel(inp), value: v.slice(0, 80), select: inp.tagName === 'SELECT' });
    }
    return out.slice(0, 8);
  }
  function findFilterInput(f) {
    const content = $('#content, section.content-main') || document.body;
    const all = $$('input, select', content).filter(inp => !ours(inp) && visible(inp) && !inp.closest('table, [role="grid"]'));
    if (f.attr) { const a = all.find(inp => inp.closest('[bsi-attribute="' + f.attr.replace(/"/g, '') + '"]')); if (a) return a; }
    if (f.name) { const n = all.find(inp => (inp.name || inp.id) === f.name); if (n) return n; }
    return all.find(inp => filterLabel(inp).label === f.label) || null;
  }
  // Remettre une valeur dans un champ d enos comme si elle etait tapee (AngularJS ecoute input/change).
  function setField(inp, f) {
    if (inp.tagName === 'SELECT') {
      const o = [...inp.options].find(o => o.text.trim() === f.value);
      if (!o) return false;
      inp.value = o.value;
    } else {
      const proto = Object.getPrototypeOf(inp);
      const d = Object.getOwnPropertyDescriptor(proto, 'value') || Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value');
      if (d && d.set) d.set.call(inp, f.value); else inp.value = f.value;
    }
    inp.dispatchEvent(new Event('input', { bubbles: true }));
    inp.dispatchEvent(new Event('change', { bubbles: true }));
    inp.dispatchEvent(new KeyboardEvent('keyup', { bubbles: true, key: 'Enter' }));
    return true;
  }
  function searchButton() {
    const content = $('#content, section.content-main') || document.body;
    const c = $$('button, a, [ng-click], [data-ng-click], i', content).filter(e => !ours(e) && visible(e) && !e.closest('table, tr, .navbar, header'));
    return c.find(e => /^search$/i.test(txt(e) || tipOf(e))) || c.find(e => /binocular|fa-search/.test(iconOf(e))) || c.find(e => /search/i.test(tipOf(e)) && !/clear|reset|filter selection/i.test(tipOf(e)));
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
  // Le nom d un bouton sans texte : son infobulle, ou qu enos la range (title, data-original-title, bsi-tooltip...).
  const tipOf = el => el.getAttribute('title') || el.getAttribute('aria-label') || el.getAttribute('data-original-title') || el.getAttribute('bsi-tooltip') || el.getAttribute('uib-tooltip') || el.getAttribute('tooltip') || el.getAttribute('placeholder') || '';
  // Les boutons d une ligne, dans l ordre (loupe, crayon, executer, imprimer...) : la place d un bouton dans sa ligne ne change pas.
  const rowButtons = (row, tag) => $$(tag, row).filter(e => !ours(e) && !e.querySelector(tag));
  const actOf = el => (el.getAttribute('ng-click') || el.getAttribute('data-ng-click') || el.getAttribute('ui-sref') || '').slice(0, 120);
  const sigOf = el => ({ tag: el.tagName.toLowerCase(), text: txt(el).length > 60 ? '' : txt(el).slice(0, 60), title: tipOf(el).slice(0, 60), icon: iconOf(el), href: (el.getAttribute('href') || '').slice(0, 80), act: actOf(el) });
  // Meme element : meme balise et, soit la meme action AngularJS (hors $index / $event), soit le meme texte et le meme titre.
  const actKey = a => (a || '').replace(/\$(index|event|parent)\b/g, '').replace(/\s+/g, '');
  const same = (a, b, loose) => a.tag === b.tag
    && ((a.tag === 'input' && !a.act && !b.act) || (a.act && b.act && actKey(a.act) === actKey(b.act)) || (a.text === b.text && a.title === b.title))
    && (loose ? true : a.icon === b.icon) && (a.icon === b.icon || !b.icon || !a.icon);
  function find(s) {
    let scope = [document];
    if (s.row) {
      let rows = $$('tr, [role="row"]').filter(r => !ours(r) && visible(r) && rowKey(r) === s.row);
      if (!rows.length && refLike(s.row)) rows = $$('td, [role="cell"], [role="gridcell"]').filter(c => !ours(c) && txt(c) === s.row).map(c => c.closest('tr, [role="row"]')).filter(r => r && visible(r));
      const norm = t => (t || '').toLowerCase().replace(/[^a-z0-9]+/g, '');
      const all = $$('tr, [role="row"]').filter(r => !ours(r) && visible(r) && r.querySelector('td, [role="cell"], [role="gridcell"]'));
      if (!rows.length) rows = all.filter(r => norm(rowKey(r)) === norm(s.row));
      if (!rows.length && norm(s.rowLabel).length > 2) rows = all.filter(r => $$('td, [role="cell"], [role="gridcell"]', r).some(c => norm(txt(c)) === norm(s.rowLabel)));
      if (!rows.length && norm(s.rowLabel).length > 4) rows = all.filter(r => norm(txt(r)).includes(norm(s.rowLabel)));
      // De quoi comprendre un arret, sans rien du contenu : des comptes et des oui / non.
      find.report = 'rows ' + all.length + ' matched ' + rows.length + ' · recorded key ' + (s.row || '').length + ' label ' + (s.rowLabel || '').length + ' chars · ' + all.slice(0, 4).map(r => { const cs = $$('td, [role="cell"], [role="gridcell"]', r); return cs.length + ' cells/key ' + rowKey(r).length + (rowKey(r) === s.row ? ' =' : ' ≠') + '/label ' + (cs.some(c => txt(c) === s.rowLabel) ? 'yes' : 'no'); }).join(' ; ');
      find.rowSeen = rows.length;
      if (!rows.length) return null;
      scope = rows;
      // Bouton d une ligne : d abord son icone ou son infobulle si elles le designent seul, sinon sa place dans la ligne.
      if (s.pos >= 0 && s.posN) {
        const bs = rowButtons(rows[0], s.tag);
        const byIcon = s.icon ? bs.filter(e => iconOf(e) === s.icon) : [];
        if (byIcon.length === 1) return byIcon[0];
        const byTip = s.title ? bs.filter(e => tipOf(e).slice(0, 60) === s.title) : [];
        if (byTip.length === 1) return byTip[0];
        if (bs.length === s.posN && bs[s.pos]) return bs[s.pos];
      }
    }
    let cands = scope.flatMap(sc => $$(ACTIONABLE, sc)).filter(e => !ours(e) && same(sigOf(e), s, true) && (s.row || visible(e) || s.tag === 'li' || s.tag === 'a' || s.menu));
    if (s.href) { const byHref = cands.filter(e => (e.getAttribute('href') || '').slice(0, 80) === s.href); if (byHref.length) cands = byHref; }
    if (s.act) { const byAct = cands.filter(e => actKey(actOf(e)) === actKey(s.act)); if (byAct.length) cands = byAct; }
    // Un pas fait dans une fenetre d enos se cherche dans la fenetre ouverte, pas dans la page derriere.
    if (s.layer) { const inL = cands.filter(e => layerOf(e)); if (!inL.length) return null; cands = inL; }
    // Plusieurs boutons pour la meme action d enos (executeAction(a,item)) : leur infobulle les departage.
    if (s.title) { const byTip = cands.filter(e => tipOf(e).slice(0, 60) === s.title); if (byTip.length) cands = byTip; }
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
    if (homeOpen && !docked() && (s || (e.target.closest && railOf(e.target)))) closeHome(); // pose sur l accueil d enos, Home ne recouvre rien : il reste
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
  // Apres un clic : la page est prete quand enos n attend plus son serveur (compteur pose par net.js) et que l ecran ne bouge plus.
  // Sans compteur (net.js absent), on garde l ancienne regle : 350 ms de calme.
  const netBusy = () => { const n = root.getAttribute('data-eh-net'); return n == null ? null : +n; };
  function settle(max = 5000) {
    return new Promise(res => {
      const t0 = Date.now();
      let last = t0;
      const mo = new MutationObserver(() => { last = Date.now(); });
      mo.observe(document.body, { childList: true, subtree: true, attributes: true });
      const iv = setInterval(() => {
        const now = Date.now(), quiet = now - last, net = netBusy();
        if (now - t0 >= max || (net === null && quiet >= 350 && now - t0 >= 450) || (net === 0 && quiet >= 160 && now - t0 >= 160)) { clearInterval(iv); mo.disconnect(); res(); }
      }, 40);
    });
  }
  async function waitFor(s, max = 8000) {
    const t0 = Date.now();
    while (Date.now() - t0 < max && !stopAsked) { const el = find(s); if (el) return el; await sleep(50); }
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
    const began = Date.now();
    replaying = item; recording = false; stopAsked = false;
    closeHome();
    root.classList.add('eh-busy');
    const halted = () => { if (!stopAsked) return false; toast('Stopped. The view stays as it is.', false, 3500); return true; };
    try {
      for (let i = 0; i < steps.length; i++) {
        const s = steps[i];
        progress(item, i, steps.length, stepText(s));
        let el = findMenuStep(s) || await waitFor(s, i === 0 ? 2500 : (s.row ? ((s.filters || []).length ? 1200 : 6000) : 8000)); // filtres notes : inutile d attendre longtemps une ligne que la liste ne montrera pas sans eux
        if (!el && s.row) {
          // La liste n a pas la ligne : les filtres tapes a l epingle sont remis, Search relance, puis on attend la liste.
          let changed = 0;
          for (const f of s.filters || []) { const inp = findFilterInput(f); if (inp && setField(inp, f)) changed++; }
          const btn = searchButton();
          if (changed || btn) { progress(item, i, steps.length, 'searching the list for ' + (s.rowLabel || s.row)); if (btn) press(btn.closest('button, a, [ng-click], [data-ng-click]') || btn); await settle(6000); el = await waitFor(s, 15000); }
        }
        if (halted()) return;
        if (!el) lastStop = 'step ' + (i + 1) + '/' + steps.length + ' [' + (s.row ? 'row button ' + (s.title || s.icon || s.tag) + ' pos ' + s.pos + '/' + s.posN : s.label) + '] crumb [' + crumb() + '] panel [' + panelTitle() + '] filters noted ' + (s.filters || []).length + ' search button ' + !!searchButton() + ' net ' + netBusy() + (s.row ? ' · ' + (find.report || '') : '') + ' · steps ' + steps.map(x => (x.menu ? 'menu' : x.row ? 'row' : x.tag)).join('>');
        if (!el && s.row && find.rowSeen) { toast('Stopped at step ' + (i + 1) + ' of ' + steps.length + ': the row « ' + (s.rowLabel || s.row) + ' » is there, but its button (' + (s.title || s.text || s.icon || s.tag) + ') was not recognised. Click it by hand once more, pin the view again, and if it still stops send me a diagnostic taken on this list.', false, 16000); return; }
        if (!el) { toast('Stopped at step ' + (i + 1) + ' of ' + steps.length + ' (' + s.label + '): not found on this page. The view stays as it is.' + (s.row ? ' The row « ' + (s.rowLabel || s.row) + ' » was not found in the list. If you can see it on screen, click the extension icon and « Copy a diagnostic » now, and send it to me.' : ' Open the view by hand once, then pin it again (drop the steps that are not part of the way).'), false, 14000); return; }
        if (halted()) return;
        // Un Search juste avant une ligne dont on connait les filtres : les remettre AVANT de chercher, un aller-retour de moins.
        const nx = steps[i + 1];
        if (!s.row && nx && nx.row && (nx.filters || []).length && (/^search$/i.test(s.text || s.title || '') || /binocular/.test(s.icon || ''))) for (const f of nx.filters) { const inp = findFilterInput(f); if (inp && (inp.tagName === 'SELECT' || inp.value !== f.value)) setField(inp, f); }
        if (!(typeof s.want === 'boolean' && el.tagName === 'INPUT' && el.checked === s.want)) press(el); // une case deja dans le bon etat reste comme elle est
        await settle();
        if (halted()) return;
      }
      toast('Opened ' + item.name + ' in ' + ((Date.now() - began) / 1000).toFixed(1) + ' s', false, 2200);
      trail = steps.map(s => ({ ...s }));
      lastView = '';
      noteVisit();
    } catch (e) { lastError = 'replay: ' + e; toast('Something went wrong while opening ' + item.name + '.'); }
    finally { replaying = null; recording = true; root.classList.remove('eh-busy'); progEl.hidden = true; }
  }
  let stopAsked = false;
  const progEl = h('div', { id: 'eh-prog', role: 'status', hidden: true });
  function progress(item, i, n, label) {
    if (!progEl.isConnected) document.body.append(progEl);
    toastEl.hidden = true;
    progEl.replaceChildren(
      h('div', { class: 'eh-prog-t' }, h('b', {}, 'Opening ' + item.name), h('span', {}, 'Step ' + (i + 1) + ' of ' + n + ' · ' + label), h('button', { type: 'button', title: 'Stop here', onclick: () => { stopAsked = true; } }, 'Stop')),
      h('div', { class: 'eh-prog-bar' }, h('i', { style: 'width:' + Math.round((i + 0.5) / n * 100) + '%' })));
    progEl.hidden = false;
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
      const note = filterNote(naming.steps);
      popEl.replaceChildren(
        h('div', { class: 'eh-pop-h' }, h('b', {}, 'Pin this view'), h('button', { type: 'button', class: 'eh-x', title: 'Close', 'aria-label': 'Close', onclick: closePop }, icon('x'))),
        h('p', { class: 'eh-pop-sub' }, 'Next time, one click brings you straight here.'),
        h('label', { class: 'eh-lab', for: 'eh-name' }, 'Name'),
        h('input', { id: 'eh-name', type: 'text', value: naming.name, placeholder: 'Name', oninput: e => { naming.name = e.target.value; }, onkeydown: e => { if (e.key === 'Enter') { confirmPin(); closePop(); } if (e.key === 'Escape') closePop(); } }),
        h('div', { class: 'eh-lab' }, 'The path it will follow for you'),
        h('ol', { class: 'eh-steps' }, naming.steps.map((st, i) => h('li', {}, h('span', { class: 'eh-t' }, stepText(st)), naming.edit && h('button', { type: 'button', title: 'Remove this step', 'aria-label': 'Remove the step ' + stepText(st), onclick: () => { naming.steps.splice(i, 1); renderPop(); } }, icon('x'))))),
        h('small', {}, note ? 'Also remembers the list filter: ' + note + ' · ' : (naming.steps.length + ' click' + (naming.steps.length > 1 ? 's' : '') + ' · '), h('button', { type: 'button', class: 'eh-link', onclick: () => { naming.edit = !naming.edit; renderPop(); } }, naming.edit ? 'Done' : 'Edit steps')),
        h('div', { class: 'eh-pop-b' }, h('button', { type: 'button', class: 'eh-btn eh-main', disabled: !naming.steps.length, onclick: () => { confirmPin(); closePop(); } }, 'Pin'), h('button', { type: 'button', class: 'eh-btn', onclick: closePop }, 'Cancel'), store.pins.length < 9 ? h('kbd', {}, 'Alt ' + (store.pins.length + 1)) : null));
      const i = $('#eh-name'); if (i && document.activeElement !== i && !naming.edit) { i.focus(); i.select(); }
      return;
    }
    if (popChip) {
      const p = popChip, i = store.pins.indexOf(p);
      const nameIn = h('input', { type: 'text', value: p.name, 'aria-label': 'Shortcut name', onkeydown: e => { if (e.key === 'Enter') { p.name = nameIn.value.trim() || p.name; save(); render(); closePop(); } if (e.key === 'Escape') closePop(); } });
      popEl.replaceChildren(
        h('div', { class: 'eh-pop-h' }, h('b', {}, p.name), h('button', { type: 'button', class: 'eh-x', title: 'Close', onclick: closePop }, icon('x'))),
        nameIn,
        h('small', {}, pathOf(p)),
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
  document.addEventListener('pointerdown', e => { if (!popEl.hidden && !popEl.contains(e.target) && !chipsEl.contains(e.target)) closePop(); }, true);
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
  const SKIP = /^(ok|cancel|close|yes|no|×|x|\d+(\.\d+)+)$/i;
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
      const inMenu = !!el.closest('#sidebar-menu, .sidebar-menu');
      const key = (inMenu ? menuPath(el).join('>') + '>' : '') + label.toLowerCase() + '|' + (el.getAttribute('href') || el.getAttribute('ng-click') || el.getAttribute('data-ng-click') || el.getAttribute('ui-sref') || '');
      if (seen.has(key)) continue;
      seen.add(key);
      out.push({ el, label, path: menuPath(el), hidden: !visible(el), menu: !!el.closest('#sidebar-menu, .sidebar-menu') });
    }
    return out;
  }
  // Le menu de gauche d enos, a plat : Projects › Management, Animals › Reports › Queries...
  const leaves = list => list.filter(a => !a.menu || !list.some(b => b !== a && b.menu && b.path.length > a.path.length && b.path[a.path.length] === a.label && a.path.every((x, i) => b.path[i] === x)));
  function menuTree() {
    const m = sideMenu();
    if (!m) return [];
    return leaves(scanActions()).filter(a => a.menu).map(a => ({ ...a, full: a.path.concat(a.label).join(' › '), top: a.path[0] || a.label }));
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
    closeHome();
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
    chipsEl.classList.remove('eh-tight');
    const more = h('button', { type: 'button', class: 'eh-chip eh-chip-more', hidden: true, title: 'All your pinned views', onclick: () => openHome() }, '');
    chipsEl.replaceChildren(
      h('button', { type: 'button', class: 'eh-chip eh-chip-home' + (homeOpen ? ' eh-on' : ''), title: 'Your pinned views, recent views, queries and the whole enos menu', 'aria-pressed': homeOpen ? 'true' : 'false', onclick: () => toggleHome() }, h('span', {}, 'Home')),
      ...pins.map((p, i) => h('button', { type: 'button', class: 'eh-chip eh-chip-v', title: pathOf(p) + ' · Alt ' + (i + 1) + ' · right click to rename, move or remove', onclick: () => replay(p), oncontextmenu: e => { e.preventDefault(); naming = null; popChip = p; renderPop(); } }, h('span', {}, p.name))),
      more,
      h('button', { type: 'button', class: 'eh-chip eh-chip-pin', title: trail.length ? 'Pin this view (' + trail.length + ' click' + (trail.length > 1 ? 's' : '') + ')' : 'Go to a view first, then pin it here', onclick: () => pinHere(true) }, icon('star'), h('span', {}, 'Pin this view')));
    // Ce qui ne tient pas dans la barre passe dans « +n » (qui ouvre Home) ; en dernier recours l etoile perd son texte.
    const vs = $$('.eh-chip-v', chipsEl);
    let gone = store.pins.length - pins.length;
    const over = () => chipsEl.scrollWidth > chipsEl.clientWidth + 1;
    if (gone) { more.hidden = false; more.textContent = '+' + gone; }
    if (over()) chipsEl.classList.add('eh-tight');
    while (over() && vs.length) { vs.pop().hidden = true; gone++; more.hidden = false; more.textContent = '+' + gone; }
  }

  // ------------------------------------------------------------ lire un chemin pour toi
  const stepText = s => (s.row ? (s.rowLabel || s.row) : s.label) || '';
  const domainOf = it => { const s = (it.trail || [])[0] || {}; return ((s.menu || s.label || '').split(' › ')[0] || 'enos').slice(0, 30); };
  // « Management › ML-040014 › Procedures » : le premier mot du menu est deja dit par l etiquette, Search avant une ligne ne se lit pas.
  function pathOf(it) {
    const t = it.trail || [];
    if (t.length < 2) return stepsHint(it);
    const parts = [];
    t.forEach((s, i) => {
      if (!s.row && /^search$/i.test(s.label || '') && t[i + 1] && t[i + 1].row) return;
      let x = stepText(s);
      if (i === 0 && s.menu && s.menu.includes(' › ')) x = s.menu.split(' › ').slice(1).join(' › ');
      if (x) parts.push(x);
    });
    return parts.join(' › ');
  }
  const pathFull = it => { const t = it.trail || []; const first = t[0] && t[0].menu; const rest = pathOf(it); return t.length < 2 || !first || !first.includes(' › ') ? rest : first.split(' › ')[0] + ' › ' + rest; };
  function filterNote(steps) {
    const f = (steps || []).flatMap(s => s.filters || [])[0];
    return f ? ((f.label || f.attr || 'filter') + ' ' + f.value).trim() : '';
  }
  const whenLong = at => { const w = when(at); return /^\d/.test(w) && new Date(at).toDateString() === new Date().toDateString() ? 'Today ' + w : w; };

  // ------------------------------------------------------------ Home : le tableau de bord
  const homeEl = h('div', { id: 'eh-home', role: 'region', 'aria-label': 'enos Helper home', hidden: true });
  let homeOpen = false, homeLoad = false, dragPin = null, homeDismissed = false, mapShown = null;
  // Le vrai tableau de bord d enos (tes widgets, tes requetes) : sur cette page, Home se pose AU-DESSUS, dans la page, sans rien recouvrir.
  const dashBox = () => { if (loggedOut()) return null; const d = $('#content .dashboard-container, section.content-main .dashboard-container'); return d && visible(d) ? d : null; };
  const docked = () => homeEl.classList.contains('eh-docked');
  // Ton prenom tel qu enos l affiche en haut a droite (« Manon CHAUVIN ») : lu dans la page, garde nulle part.
  function firstName() {
    const nb = navbar(); if (!nb) return '';
    for (const e of $$('*', $('.navbar-right', nb) || nb)) {
      if (e.children.length || ours(e)) continue;
      const m = txt(e).match(/^([A-Za-zÀ-ÿ][A-Za-zÀ-ÿ'-]+) [A-ZÀ-Ý][A-ZÀ-Ý' -]+$/);
      if (m) return m[1][0].toUpperCase() + m[1].slice(1).toLowerCase();
    }
    return '';
  }
  function placeHome() {
    const d = dashBox();
    if (d) { if (homeEl.parentElement !== d) d.prepend(homeEl); homeEl.classList.add('eh-docked'); homeEl.style.top = ''; homeEl.style.left = ''; return; }
    if (homeEl.parentElement !== document.body) document.body.append(homeEl);
    homeEl.classList.remove('eh-docked');
    const nb = navbar(), rail = $('#sidebar_left, aside.sidebar-left');
    const top = nb && visible(nb) ? Math.round(nb.getBoundingClientRect().bottom) : 40;
    const left = rail && visible(rail) ? Math.round(rail.getBoundingClientRect().right) : 0;
    homeEl.style.top = Math.max(0, Math.min(top, 120)) + 'px';
    homeEl.style.left = Math.max(0, Math.min(left, 420)) + 'px';
  }
  function openHome(load) {
    if (!opts.on || loggedOut()) return;
    homeOpen = true; homeLoad = !!load; homeDismissed = false;
    closePalette(); if (opts.layout !== 'push') toggleSide(false);
    homeEl.hidden = false;
    renderHome(); renderChips();
    homeEl.scrollTop = 0;
    if (docked() && homeEl.scrollIntoView) homeEl.scrollIntoView({ block: 'start' });
  }
  function closeHome(byYou) { if (!homeOpen) return; homeOpen = false; homeLoad = false; homeEl.hidden = true; if (byYou) homeDismissed = true; renderChips(); }
  function toggleHome() { if (homeOpen) closeHome(true); else openHome(); }
  function howToPin() { closeHome(); toast('Open the view in enos as usual (left menu, then the row or the Details entry), then press ★ Pin this view in the orange bar.', false, 12000); }
  function exportPins() {
    if (!store.pins.length) { toast('No pinned view to save yet.', false, 4000); return; }
    const data = JSON.stringify({ app: 'enos Helper', version: VERSION, pins: store.pins }, null, 1);
    const url = URL.createObjectURL(new Blob([data], { type: 'application/json' }));
    const a = h('a', { href: url, download: 'enos-helper-shortcuts.json', 'data-eh': '1', style: 'display:none' });
    document.body.append(a); a.click(); a.remove();
    setTimeout(() => URL.revokeObjectURL(url), 5000);
    toast(store.pins.length + ' pinned view' + (store.pins.length > 1 ? 's' : '') + ' saved to enos-helper-shortcuts.json (your Downloads folder).', false, 5000);
  }
  function importFile(file) {
    if (!file) return;
    const fr = new FileReader();
    fr.onload = () => {
      try {
        const d = JSON.parse(String(fr.result));
        const pins = cleanItems((Array.isArray(d) ? d : d.pins).map(p => ({ name: String(p.name || '').slice(0, 80), at: +p.at || Date.now(), trail: (p.trail || []).filter(st => st && typeof st.tag === 'string') }))).filter(p => p.name);
        if (!pins.length) throw new Error('empty');
        const names = new Set(pins.map(p => p.name));
        store.pins = store.pins.filter(p => !names.has(p.name)).concat(pins);
        homeLoad = false; save(); render();
        toast(pins.length + ' pinned view' + (pins.length > 1 ? 's' : '') + ' loaded.', false, 4000);
      } catch (e) { toast('This file holds no enos Helper shortcuts.', false, 6000); }
    };
    fr.readAsText(file);
  }
  const filePick = text => h('label', { class: 'eh-link eh-file' }, text, h('input', { type: 'file', accept: '.json,application/json', 'aria-label': text, onchange: e => importFile(e.target.files[0]) }));
  function renderHome() {
    if (!homeOpen) return;
    placeHome();
    const hr = new Date().getHours();
    const who = firstName();
    const hello = (hr < 5 ? 'Good evening' : hr < 12 ? 'Good morning' : hr < 18 ? 'Good afternoon' : 'Good evening') + (who ? ', ' + who : '');
    const go = it => { closeHome(); replay(it); };
    const pinned = new Set(store.pins.map(p => p.name));
    // Retirer une epingle : l etoile pleine de sa carte ; le message propose de la remettre.
    const unpin = p => {
      const at = store.pins.indexOf(p); if (at < 0) return;
      store.pins.splice(at, 1); save(); render();
      if (!toastEl.isConnected) document.body.append(toastEl);
      toastEl.replaceChildren(h('span', {}, 'Unpinned « ' + p.name + ' »'), h('button', { type: 'button', class: 'eh-tbtn', onclick: () => { toastEl.hidden = true; if (!store.pins.some(x => x.name === p.name)) { store.pins.splice(Math.min(at, store.pins.length), 0, p); save(); render(); } } }, 'Undo'), h('button', { type: 'button', title: 'Close', onclick: () => { toastEl.hidden = true; } }, icon('x')));
      toastEl.hidden = false; clearTimeout(toastT); toastT = setTimeout(() => { toastEl.hidden = true; }, 8000);
    };
    const card = (p, i) => h('div', { class: 'eh-cardw' }, cardBtn(p, i), h('button', { type: 'button', class: 'eh-star eh-on eh-unpin', title: 'Unpin', 'aria-label': 'Unpin ' + p.name, onclick: () => unpin(p) }, icon('starFull')));
    const cardBtn = (p, i) => h('button', { type: 'button', class: 'eh-card', draggable: 'true', title: stepsHint(p) + ' · right click to rename or move',
      onclick: () => go(p), oncontextmenu: e => { e.preventDefault(); naming = null; popChip = p; renderPop(); },
      ondragstart: e => { dragPin = p; try { e.dataTransfer.effectAllowed = 'move'; e.dataTransfer.setData('text/plain', p.name); } catch (_) {} },
      ondragover: e => { if (dragPin && dragPin !== p) e.preventDefault(); },
      ondrop: e => { e.preventDefault(); const a = store.pins.indexOf(dragPin), b = store.pins.indexOf(p); dragPin = null; if (a < 0 || b < 0 || a === b) return; const [m] = store.pins.splice(a, 1); store.pins.splice(b, 0, m); save(); render(); },
      ondragend: () => { dragPin = null; } },
      h('span', { class: 'eh-card-top' }, h('span', { class: 'eh-eyebrow' }, domainOf(p)), i < 9 ? h('kbd', {}, 'Alt ' + (i + 1)) : null),
      h('span', { class: 'eh-card-name' }, p.name),
      h('span', { class: 'eh-card-path' }, pathOf(p) + (filterNote(p.trail) ? ' · filter ' + filterNote(p.trail) : '')));
    const add = h('button', { type: 'button', class: 'eh-card eh-add', onclick: howToPin },
      h('span', { class: 'eh-card-name' }, icon('star'), 'Pin a view'),
      h('span', { class: 'eh-card-path' }, 'Open the view in enos as usual, then press the star in the orange bar.'));
    const recent = store.recent.slice(0, 5).map(r => {
      const on = pinned.has(r.name);
      return h('div', { class: 'eh-hrow' },
        h('button', { type: 'button', class: 'eh-hrow-main', title: stepsHint(r), onclick: () => go(r) }, h('b', {}, r.name), h('span', { class: 'eh-hrow-path' }, pathFull(r)), h('span', { class: 'eh-hrow-when' }, whenLong(r.at))),
        h('button', { type: 'button', class: 'eh-star' + (on ? ' eh-on' : ''), title: on ? 'Unpin' : 'Pin', 'aria-label': (on ? 'Unpin ' : 'Pin ') + r.name, onclick: () => { if (on) store.pins = store.pins.filter(p => p.name !== r.name); else store.pins.push({ name: r.name, trail: r.trail, at: Date.now() }); save(); render(); } }, icon(on ? 'starFull' : 'star')));
    });
    // Le menu d enos a plat : les entrees qui ne font qu ouvrir un sous-menu ne sont pas des destinations.
    const tree = menuTree();
    // Epingler une entree du menu sans y aller : « Animals selection », « Cages selection », « Records »...
    const pinName = a => (tree.filter(b => b.label === a.label).length > 1 && a.top !== a.label ? a.top + ' ' + a.label.toLowerCase() : a.label);
    const menuStar = a => {
      const name = pinName(a), on = store.pins.some(p => p.name === name);
      return h('button', { type: 'button', class: 'eh-star' + (on ? ' eh-on' : ''), title: on ? 'Unpin ' + name : 'Pin ' + name, 'aria-label': (on ? 'Unpin ' : 'Pin ') + name, onclick: () => {
        if (on) store.pins = store.pins.filter(p => p.name !== name);
        else { const s = sig(a.el) || { ...sigOf(a.el), n: 0 }; s.root = true; s.menu = a.full; s.label = a.full; store.pins.push({ name, trail: [s], at: Date.now() }); toast('Pinned « ' + name + ' »', false, 2500); }
        save(); render(); } }, icon(on ? 'starFull' : 'star'));
    };
    const entry = (a, text) => h('div', { class: 'eh-map-r' }, h('button', { type: 'button', class: 'eh-link', title: a.full, onclick: () => openMenuEntry(a) }, text), menuStar(a));
    const openEntry = a => entry(a, a.path.slice(1).concat(a.label).join(' › '));
    const tops = [...new Set(tree.map(a => a.top))];
    const groups = tops.map(t => ({ t, kids: tree.filter(a => a.top === t && a.path.length) })).filter(g => g.kids.length);
    const singles = tree.filter(a => !a.path.length);
    const isDocked = docked();
    const showMap = mapShown == null ? !isDocked : mapShown;
    const dash = tree.find(a => !a.path.length && /^dashboard$/i.test(a.label)) || tree.find(a => /^#\/?(home)?$/.test(a.el.getAttribute('href') || ''));
    const isQ = it => /quer|filter selection/i.test(stepsHint(it));
    const myQ = store.pins.filter(isQ);
    const qLists = tree.filter(a => /^quer/i.test(a.label));
    homeEl.replaceChildren(h('div', { class: 'eh-home-in' },
      h('div', { class: 'eh-home-top' },
        h('div', {}, h('div', { class: 'eh-eyebrow' }, 'enos Helper'), h('h1', {}, hello)),
        h('button', { type: 'button', class: 'eh-find', onclick: () => openPalette() }, icon('search'), h('span', { class: 'eh-t' }, 'Go to a view, a menu entry, a query'), h('kbd', {}, mod() + ' K')),
        h('button', { type: 'button', class: 'eh-close', title: 'Close Home and show enos (Esc)', 'aria-label': 'Close Home', onclick: () => closeHome(true) }, icon('x'))),
      homeLoad ? h('div', { class: 'eh-banner' }, h('b', {}, 'Load pinned views from a file saved by enos Helper'), filePick('Choose the file'), h('button', { type: 'button', class: 'eh-link', onclick: () => { homeLoad = false; renderHome(); } }, 'Cancel')) : null,
      h('section', { class: 'eh-sec' },
        h('div', { class: 'eh-sec-h' }, h('h2', {}, 'Pinned views'), h('span', {}, store.pins.length ? 'One click instead of the whole path. Drag to reorder, the star unpins.' : 'A pinned view opens in one click instead of the whole path.')),
        h('div', { class: 'eh-cards' }, store.pins.map(card), add)),
      h('div', { class: 'eh-two' },
        h('section', { class: 'eh-panel eh-wide' },
          h('div', { class: 'eh-sec-h' }, h('h2', {}, 'Pick up where you left off'), h('span', {}, 'Your last views, kept on this computer only')),
          recent.length ? recent : h('p', { class: 'eh-note' }, 'The views you open in enos will be listed here, most recent first.')),
        h('section', { class: 'eh-panel' },
          h('div', { class: 'eh-sec-h' }, h('h2', {}, 'My queries'), h('span', {}, 'All in one place')),
          myQ.map(p => h('div', { class: 'eh-hrow' }, h('button', { type: 'button', class: 'eh-hrow-main', title: stepsHint(p), onclick: () => go(p) }, h('b', {}, p.name), h('span', { class: 'eh-hrow-path' }, ''), h('span', { class: 'eh-hrow-when' }, domainOf(p))))),
          !myQ.length ? h('p', { class: 'eh-note' }, 'Open a query or a saved filter once, pin it with the star, and it is listed here by its name.') : null,
          isDocked ? h('p', { class: 'eh-note' }, 'The query widgets of your enos dashboard are just below this page.') : (dash ? h('p', { class: 'eh-note' }, 'Your query widgets are on the enos dashboard:', h('button', { type: 'button', class: 'eh-link', onclick: () => openMenuEntry(dash) }, 'Open it')) : null),
          qLists.length ? h('p', { class: 'eh-note' }, 'Open the query lists:', qLists.map(a => h('button', { type: 'button', class: 'eh-link', title: a.full, onclick: () => openMenuEntry(a) }, a.top))) : null)),
      tree.length ? h('section', { class: 'eh-sec' },
        h('div', { class: 'eh-sec-h' }, h('h2', {}, 'All of enos'), h('span', {}, 'The whole left menu, with its names, one click each. The star pins an entry.'), h('button', { type: 'button', class: 'eh-link', 'aria-expanded': showMap ? 'true' : 'false', onclick: () => { mapShown = !showMap; renderHome(); } }, showMap ? 'Hide' : 'Show the menu')),
        showMap && h('div', { class: 'eh-map' },
          groups.map(g => h('div', {}, h('div', { class: 'eh-map-h' }, g.t), g.kids.map(openEntry))),
          singles.length ? h('div', {}, h('div', { class: 'eh-map-h' }, groups.length ? 'Also' : 'Menu'), singles.map(a => entry(a, a.label))) : null)) : null,
      h('div', { class: 'eh-home-foot' },
        h('button', { type: 'button', class: 'eh-link', onclick: exportPins }, 'Save my pinned views to a file'), filePick('Load from a file'),
        h('span', { class: 'eh-sp' }), h('span', {}, 'v' + VERSION + ' · Stays on this computer. Sends nothing, changes nothing in enos.'))));
  }

  // ------------------------------------------------------------ premiere installation
  const welEl = h('div', { id: 'eh-welcome', role: 'dialog', 'aria-modal': 'true', 'aria-label': 'Welcome to enos Helper', hidden: true });
  function closeWelcome() { welEl.hidden = true; welEl.remove(); }
  function maybeWelcome() {
    if (welcomed !== false) return;
    welcomed = true;
    try { chrome.storage.local.set({ [WEL]: 1 }); } catch (e) {}
    if (store.pins.length) return; // deja a l aise avec une version d avant
    welEl.replaceChildren(h('div', { class: 'eh-wel' },
      h('div', {}, h('div', { class: 'eh-eyebrow' }, 'enos Helper is installed'), h('h1', {}, 'Get to any enos view in one click'), h('p', { class: 'eh-wel-lead' }, 'Three things to know. It takes a minute.')),
      h('div', { class: 'eh-wel-3' },
        h('div', {}, h('i', {}, '1'), h('b', {}, 'Go where you usually go'), h('p', {}, 'Open a view in enos the long way, once. The Helper notes the clicks.'), h('div', { class: 'eh-wel-x' }, h('span', {}, 'Projects'), h('span', {}, 'Details'), h('span', {}, 'Procedures'))),
        h('div', {}, h('i', {}, '2'), h('b', {}, 'Press the star'), h('p', {}, 'It sits in the orange bar. Give the view a name and it is pinned.'), h('div', { class: 'eh-wel-x' }, h('span', { class: 'eh-chip eh-chip-pin' }, icon('star'), 'Pin this view'))),
        h('div', {}, h('i', {}, '3'), h('b', {}, 'One click from now on'), h('p', {}, 'From Home, from the bar, or with the keyboard.'), h('div', { class: 'eh-wel-x' }, h('kbd', {}, 'Alt 1'), h('kbd', {}, mod() + ' K')))),
      h('div', { class: 'eh-wel-b' },
        h('button', { type: 'button', class: 'eh-btn eh-main', onclick: () => { closeWelcome(); howToPin(); } }, 'Pin my first view'),
        h('button', { type: 'button', class: 'eh-btn', onclick: closeWelcome }, 'Skip'),
        h('p', {}, 'Stays on this computer.', h('br'), 'Sends nothing, changes nothing in enos.'))));
    document.body.append(welEl);
    welEl.hidden = false;
    const b = $('.eh-main', welEl); if (b) b.focus();
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
  function closeAll() { if (opts.layout !== 'push') toggleSide(false); closePalette(); closeHome(); }

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
    renderHome();
    if (!opts.on || !sideEl.isConnected) return;
    const q = filter.trim().toLowerCase();
    const inQ = it => !q || (it.name + ' ' + stepsHint(it)).toLowerCase().includes(q);
    const pins = store.pins.filter(inQ);
    const pinned = new Set(store.pins.map(p => p.name));
    const recent = store.recent.filter(r => !pinned.has(r.name) && inQ(r)).slice(0, q ? 30 : 8);
    const acts = leaves(scanActions());
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
      h('footer', {}, 'v' + VERSION + ' · ' + mod() + ' K finds · Alt 1-9 shortcuts'),
    ];
    sideEl.replaceChildren(...body.flat(3).filter(Boolean));
  }

  // ------------------------------------------------------------ le chercheur Ctrl K
  const palEl = h('div', { id: 'eh-pal', role: 'dialog', 'aria-label': 'Find in enos', hidden: true });
  let palQ = '', palSel = 0, palItems = [];
  // Le mot cherche en gras dans le resultat.
  function mark(label, q) {
    const w = q.toLowerCase().split(/\s+/).filter(Boolean)[0];
    const i = w ? label.toLowerCase().indexOf(w) : -1;
    return i < 0 ? [label] : [label.slice(0, i), h('b', {}, label.slice(i, i + w.length)), label.slice(i + w.length)];
  }
  function palette() {
    const q = palQ.trim();
    const inQ = it => !q || matches(q, { label: it.name || '', path: (it.trail || []).map(s => s.label) });
    const pinned = new Set(store.pins.map(p => p.name));
    const groups = [
      ['Pinned', store.pins.filter(inQ).map(p => ({ label: p.name, sub: pathOf(p), run: () => replay(p) }))],
      ['Recent', store.recent.filter(r => !pinned.has(r.name) && inQ(r)).slice(0, q ? 8 : 6).map(r => ({ label: r.name, sub: whenLong(r.at), run: () => replay(r), pin: () => { pinFromRecent(r); toast('Pinned « ' + r.name + ' »', false, 3000); } }))],
    ];
    if (q) {
      const found = leaves(scanActions()).map(a => [matches(q, a), a]).filter(x => x[0]).sort((a, b) => b[0] - a[0]).map(x => x[1]);
      groups.push(['enos menu', found.filter(a => a.menu).slice(0, 8).map(a => ({ label: a.label, sub: a.path.join(' › '), run: () => openMenuEntry(a) }))]);
      groups.push(['On this page', found.filter(a => !a.menu).slice(0, 6).map(a => ({ label: a.label, sub: a.path.join(' › ') + (a.hidden ? (a.path.length ? ' · ' : '') + 'in a closed menu' : ''), run: () => openMenuEntry(a) }))]);
    }
    const items = groups.flatMap(g => g[1]);
    palItems = items;
    palSel = Math.min(palSel, Math.max(0, items.length - 1));
    let n = 0;
    const list = h('div', { class: 'eh-list', role: 'listbox' }, items.length ? groups.filter(g => g[1].length).map(g => [h('div', { class: 'eh-gh' }, g[0]), g[1].map(it => { const i = n++; return h('button', { class: 'eh-it' + (i === palSel ? ' eh-sel' : ''), type: 'button', role: 'option', 'aria-selected': i === palSel ? 'true' : 'false',
      onclick: () => { closeAll(); it.run(); }, onmousemove: () => { if (palSel !== i) { palSel = i; palette(); } } },
      h('span', { class: 'eh-t' }, mark(it.label, q)), it.sub ? h('small', {}, it.sub) : null, i === palSel ? h('kbd', {}, 'Enter') : null); })]) : h('p', { class: 'eh-empty' }, q ? 'Nothing matches « ' + q + ' ».' : 'Type to find a pinned view, a recent view or an entry of the enos menu (Procedures, Queries, Animals…).'));
    const had = document.activeElement && document.activeElement.id === 'eh-pq';
    palEl.replaceChildren(h('div', { class: 'eh-pal-box' },
      h('label', { class: 'eh-search' }, icon('search'), h('input', { id: 'eh-pq', type: 'search', placeholder: 'Find in enos', 'aria-label': 'Find in enos', value: palQ, autocomplete: 'off',
        oninput: e => { palQ = e.target.value; palSel = 0; palette(); },
        onkeydown: e => {
          if (e.key === 'ArrowDown') { e.preventDefault(); palSel = Math.min(palItems.length - 1, palSel + 1); palette(); }
          else if (e.key === 'ArrowUp') { e.preventDefault(); palSel = Math.max(0, palSel - 1); palette(); }
          else if (e.key === 'Enter') { e.preventDefault(); const it = palItems[palSel]; if (!it) return; if ((e.ctrlKey || e.metaKey) && it.pin) { closePalette(); it.pin(); } else { closeAll(); it.run(); } }
          else if (e.key === 'Escape') { e.preventDefault(); closePalette(); }
        } }), h('kbd', {}, 'Esc')),
      list,
      h('footer', {}, h('span', {}, h('kbd', {}, '↑ ↓'), ' move'), h('span', {}, h('kbd', {}, 'Enter'), ' open'), h('span', {}, h('kbd', {}, mod() + ' Enter'), ' pin a recent view'), h('span', { class: 'eh-sp' }), items.length ? h('span', {}, items.length + ' result' + (items.length > 1 ? 's' : '')) : null)));
    const inp = $('#eh-pq'); if (inp && (had || !palEl.hidden)) { inp.focus(); inp.setSelectionRange(palQ.length, palQ.length); }
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
    else if (e.key === 'Escape' && !welEl.hidden) { closeWelcome(); }
    else if (e.key === 'Escape' && homeOpen && !/^(INPUT|TEXTAREA|SELECT)$/.test((e.target && e.target.tagName) || '')) { closeHome(true); }
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
    if (!opts.on) { sideOpen = false; root.classList.remove('eh-open', 'eh-calm', 'eh-forms', 'eh-chips'); palEl.hidden = true; popEl.hidden = true; chipsEl.remove(); closeHome(); closeWelcome(); return; }
    mount();
    if (opts.layout === 'push') toggleSide(true);
    else if (opts.layout === 'none') toggleSide(false);
    else if (opts.autoOpen && !sideOpen) toggleSide(true);
    render();
  }
  // A l arrivee sur l accueil (apres connexion ou rechargement) : proposer de rouvrir la derniere vue.
  let resumed = false;
  function offerResume() {
    if (resumed || !opts.on || loggedOut() || replaying) return;
    if (!/^#\/?(home\/?)?$/i.test(location.hash) || trail.length) return; // l accueil d enos est #/home
    if (opts.home) { resumed = true; return; } // Home (pose sur l accueil par tick) dit deja ou tu en etais
    if (!opts.resume) return;
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
    if (!out && sideMenu()) { offerResume(); maybeWelcome(); }
    root.classList.toggle('eh-modal', $$('.modal, [uib-modal-window], .modal-dialog').some(m => !ours(m) && visible(m)) || !!topLayer());
    const dash = out ? null : dashBox();
    if (!dash) homeDismissed = false; // quitter l accueil d enos : Home y reviendra a la prochaine visite
    if (homeOpen) { if (out || (docked() && !dash)) closeHome(); else if (!!dash !== docked()) renderHome(); else placeHome(); }
    else if (dash && opts.home && !homeDismissed && !replaying && sideMenu()) openHome();
  }

  // Etat de la page pour la fenetre de l extension : structure et libelles de menus, jamais le contenu des tableaux ni tes raccourcis.
  function diagnose() {
    const lines = ['enos Helper ' + VERSION, 'url ' + location.href, 'title ' + (document.title || '').slice(0, 60),
      'layout ' + opts.layout + ' home ' + opts.home + ' open ' + homeOpen + ' net ' + netBusy() + ' chips ' + opts.chips + ' calm ' + opts.calm + ' forms ' + opts.forms + ' resume ' + opts.resume + ' open ' + sideOpen + ' pins ' + store.pins.length + ' recent ' + store.recent.length + ' trail ' + trail.length + ' logged out ' + loggedOut() + ' · last error ' + (lastError || 'none'),
      'last stop: ' + (lastStop || 'none'),
      'crumb [' + crumb() + '] panel [' + panelTitle() + '] reference found ' + !!reference() + ' navbar ' + !!navbar() + ' side menu ' + !!sideMenu()];
    const attrs = new Map();
    for (const el of $$('*')) for (const a of el.attributes) if (/^(bsi-|data-testid|ng-controller|ui-view|ng-view|ng-app|ng-repeat)/.test(a.name)) attrs.set(a.name, (attrs.get(a.name) || 0) + 1);
    lines.push('markers ' + [...attrs.entries()].sort((a, b) => b[1] - a[1]).slice(0, 40).map(([k, v]) => k + '×' + v).join(' '));
    lines.push('frames ' + $$('iframe').length + ' · links ' + $$('a[href]').length + ' · ng-click ' + $$('[ng-click], [data-ng-click]').length + ' · tables ' + $$('table').length + ' · rows ' + $$('tr').length);
    lines.push('filters ' + listFilters(null).map(f => (f.attr || f.label || f.name) + '=' + f.value.length + ' chars').join(' | '));
    const acts = scanActions();
    lines.push('menu entries ' + acts.length + ' (hidden ' + acts.filter(a => a.hidden).length + '): ' + acts.slice(0, 90).map(a => (a.path.length ? a.path.join('›') + '›' : '') + a.label.slice(0, 30) + (a.hidden ? '*' : '') + ((a.el.getAttribute('href') || '').replace(/[0-9a-f-]{20,}/g, 'ID') ? '=' + (a.el.getAttribute('href') || '').slice(0, 40) : '')).join(' | '));
    const top = navbar();
    if (top) lines.push('navbar texts ' + $$('*', top).filter(e => e.children.length === 0 && txt(e)).map(e => txt(e).slice(0, 40)).slice(0, 20).join(' | '));
    const rect = el => { const r = el.getBoundingClientRect(); return Math.round(r.left) + ',' + Math.round(r.top) + ' ' + Math.round(r.width) + 'x' + Math.round(r.height); };
    const selOf = el => el.tagName.toLowerCase() + (el.id ? '#' + el.id : '') + (el.className && typeof el.className === 'string' ? '.' + el.className.trim().split(/\s+/).slice(0, 3).join('.') : '') + [...el.attributes].filter(a => /^bsi-/.test(a.name)).slice(0, 3).map(a => '[' + a.name + '=' + a.value.slice(0, 25) + ']').join('');
    const content = $('#content, section.content-main');
    if (content) { lines.push('content tree:'); const dump = (el, depth) => { if (!el || depth > 5 || ours(el)) return; lines.push('  '.repeat(depth) + selOf(el) + ' ' + rect(el) + (el.children.length === 0 && txt(el) && txt(el).length < 30 && !el.closest('table') ? ' "' + txt(el) + '"' : '')); for (const c of [...el.children].slice(0, 10)) dump(c, depth + 1); }; dump(content, 0); }
    const attrsOf = e => e.tagName.toLowerCase() + [...e.attributes].filter(a => /^(class|title|data-original-title|ng-click|data-ng-click|ui-sref|type|role)$|^bsi-|tooltip/.test(a.name)).map(a => '[' + a.name + '=' + a.value.replace(/\s+/g, ' ').slice(0, 50) + ']').join('');
    $$('table').filter(t => !ours(t) && visible(t)).slice(0, 3).forEach((t, k) => {
      const row = $$('tr', t).find(r => r.querySelector('td') && visible(r)); if (!row) return;
      const cells = $$('td', row);
      lines.push('table ' + k + ' first row: ' + cells.length + ' cells, key cells ' + rowCells(row).length + '; buttons: ' + $$('a, button, i, span[ng-click], [bsi-icon], input', row).slice(0, 24).map(e => attrsOf(e) + (e.children.length ? '>' + [...e.children].slice(0, 2).map(attrsOf).join('+') : '')).join(' | '));
    });
    const mid = document.elementFromPoint(Math.round(innerWidth / 2), Math.round(innerHeight * 0.35));
    if (mid && !ours(mid)) { const chain = []; for (let p = mid; p && p !== document.body && chain.length < 14; p = p.parentElement) { const cs = getComputedStyle(p); chain.push(selOf(p) + '{' + cs.position + (cs.zIndex !== 'auto' ? ' z' + cs.zIndex : '') + '}'); } lines.push('at screen centre: ' + chain.join(' < ')); }
    const modal = topLayer() || $$('.modal, [uib-modal-window], .modal-dialog').find(m => !ours(m) && visible(m));
    if (modal) lines.push('window open ' + selOf(modal) + ' ' + rect(modal) + ': labels ' + $$('label, th, h3, h4, .modal-title', modal).map(e => txt(e).slice(0, 30)).filter(Boolean).slice(0, 30).join(' | ') + ' ; fields ' + $$('input, select, textarea, button, a[ng-click]', modal).slice(0, 70).map(e => e.tagName.toLowerCase() + (e.type ? ':' + e.type : '') + (e.parentElement ? '<' + e.parentElement.tagName.toLowerCase() + (typeof e.parentElement.className === 'string' && e.parentElement.className ? '.' + e.parentElement.className.trim().split(/\s+/).slice(0, 2).join('.') : '') : '') + [...e.attributes].filter(a => /^(ng-model|data-ng-model|name|ng-click|ng-change|typeahead|uib-typeahead|bsi-attribute|bsi-name|bsi-label|bsi-source|bsi-entity|class)$/.test(a.name)).map(a => '[' + a.name + '=' + a.value.slice(0, 40) + ']').join('')).join(' | '));
    const right = $('#sidebar_right');
    if (right) lines.push('details entries ' + detailEntries().map(d => d.label).join(' | '));
    if (right) { lines.push('right panel ' + rect(right) + ' texts ' + $$('*', right).filter(e => e.children.length === 0 && txt(e)).map(e => txt(e).slice(0, 30)).slice(0, 20).join(' | ')); }
    return lines.join('\n');
  }

  try {
    chrome.runtime.onMessage.addListener((m, _s, reply) => {
      if (!m || !/^(status|diag|forget|home|find|export|import)$/.test(m.eh)) return;
      if (m.eh === 'home') { openHome(); reply({ ok: homeOpen }); return; }
      if (m.eh === 'find') { openPalette(); reply({ ok: true }); return; }
      if (m.eh === 'export') { exportPins(); reply({ ok: true, pins: store.pins.length }); return; }
      if (m.eh === 'import') { openHome(true); reply({ ok: homeOpen }); return; }
      if (m.eh === 'diag') { let text = ''; try { text = diagnose(); } catch (e) { text = 'diag failed: ' + e; } reply({ text }); return; }
      if (m.eh === 'forget') { store = { pins: [], recent: [] }; save(); render(); reply({ ok: true }); return; }
      const out = loggedOut();
      reply({ v: VERSION, on: !!opts.on, out, layout: opts.layout, shown: sideEl.isConnected, pins: store.pins.length, recent: store.recent.length, error: lastError });
    });
  } catch (e) { lastError = 'message: ' + e; }

  load(() => {
    apply();
    setInterval(tick, 800);
  });
})();
