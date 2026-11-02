// Seal Helper 0.5
// Ne fait que changer l affichage dans ce navigateur : n ecrit jamais dans Seal,
// n envoie rien, ne touche pas au texte d un document.
// La nouvelle barre et les pages Home / My work / To publish relisent les listes
// que Seal a deja chargees (volets Views, Entities, Changes) et, au clic, cliquent
// pour toi sur la ligne Seal d origine : la navigation reste celle de Seal.
// Si un repere de Seal disparait, la partie concernee ne s affiche pas et Seal
// reste comme d habitude.
(() => {
  const KEY = 'sealHelper';
  const DEFAULTS = { on: true, side: true, home: true, appmenu: true, props: true, doc: true, dates: true, info: true, quiet: true };
  const CLASSES = ['side', 'props', 'doc', 'dates', 'info', 'quiet'];
  const root = document.documentElement;
  const isMac = /Mac/.test(navigator.platform);
  let opts = { ...DEFAULTS };
  const isOn = k => opts.on && opts[k];

  // ---------------------------------------------------------------- outils
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
  const $ = (sel, scope = document) => scope.querySelector(sel);
  const $$ = (sel, scope = document) => [...scope.querySelectorAll(sel)];
  const txt = el => (el ? el.textContent.replace(/\s+/g, ' ').trim() : '');

  // Clic pour toi sur un element de Seal (boutons et lignes de liste).
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

  const ICON = {
    search: '<svg viewBox="0 0 16 16"><circle cx="7" cy="7" r="4.3"/><path d="m10.3 10.3 3.2 3.2"/></svg>',
    home: '<svg viewBox="0 0 16 16"><path d="M2.5 7.5 8 3l5.5 4.5V13.5h-3.5V10h-4v3.5H2.5z"/></svg>',
    work: '<svg viewBox="0 0 16 16"><path d="M4 2.5h5.5L12.5 5.5v8H4z M9.5 2.5v3h3 M6 8.5h4.5 M6 11h4.5"/></svg>',
    pub: '<svg viewBox="0 0 16 16"><path d="M8 10.5V3 M5 6l3-3 3 3 M3 10v3.5h10V10"/></svg>',
    inbox: '<svg viewBox="0 0 16 16"><path d="M2.5 9.5 4 3.5h8l1.5 6v4h-11z M2.5 9.5h3.5l.8 1.5h2.4l.8-1.5h3.5"/></svg>',
    plus: '<svg viewBox="0 0 16 16"><path d="M8 3v10 M3 8h10"/></svg>',
    swap: '<svg viewBox="0 0 16 16"><path d="M5 2.5v11 M2.5 5 5 2.5 7.5 5 M11 13.5v-11 M8.5 11 11 13.5l2.5-2.5"/></svg>',
    gear: '<svg viewBox="0 0 24 24" class="w24"><path d="M12.22 2h-.44a2 2 0 0 0-2 2v.18a2 2 0 0 1-1 1.73l-.43.25a2 2 0 0 1-2 0l-.15-.08a2 2 0 0 0-2.73.73l-.22.38a2 2 0 0 0 .73 2.73l.15.1a2 2 0 0 1 1 1.72v.51a2 2 0 0 1-1 1.74l-.15.09a2 2 0 0 0-.73 2.73l.22.38a2 2 0 0 0 2.73.73l.15-.08a2 2 0 0 1 2 0l.43.25a2 2 0 0 1 1 1.73V20a2 2 0 0 0 2 2h.44a2 2 0 0 0 2-2v-.18a2 2 0 0 1 1-1.73l.43-.25a2 2 0 0 1 2 0l.15.08a2 2 0 0 0 2.73-.73l.22-.39a2 2 0 0 0-.73-2.73l-.15-.08a2 2 0 0 1-1-1.74v-.5a2 2 0 0 1 1-1.74l.15-.09a2 2 0 0 0 .73-2.73l-.22-.38a2 2 0 0 0-2.73-.73l-.15.08a2 2 0 0 1-2 0l-.43-.25a2 2 0 0 1-1-1.73V4a2 2 0 0 0-2-2z"/><circle cx="12" cy="12" r="3"/></svg>',
    help: '<svg viewBox="0 0 24 24" class="w24"><circle cx="12" cy="12" r="9.5"/><path d="M9.1 9a3 3 0 0 1 5.8 1c0 2-2.9 2.7-2.9 4"/><path d="M12 17.5h.01"/></svg>',
    back: '<svg viewBox="0 0 16 16"><path d="M9.5 3.5 5 8l4.5 4.5"/></svg>',
    chev: '<svg viewBox="0 0 16 16"><path d="m6 4 4 4-4 4"/></svg>',
    view: '<svg viewBox="0 0 16 16"><path d="M2.5 3.5h11v9h-11z M2.5 6.5h11 M6.5 6.5v6"/></svg>',
    star: '<svg viewBox="0 0 16 16"><path d="m8 2.5 1.7 3.5 3.8.5-2.8 2.6.7 3.8L8 11.1l-3.4 1.8.7-3.8L2.5 6.5l3.8-.5z"/></svg>',
    exp: '<svg viewBox="0 0 16 16"><path d="M6 2.5h4 M6.5 2.5v4L3 13.5h10L9.5 6.5v-4 M4.6 10.5h6.8"/></svg>',
    doc: '<svg viewBox="0 0 16 16"><path d="M4 2.5h5.5L12.5 5.5v8H4z M9.5 2.5v3h3"/></svg>',
    box: '<svg viewBox="0 0 16 16"><path d="M2.5 5 8 2.5 13.5 5v6L8 13.5 2.5 11z M2.5 5 8 7.5 13.5 5 M8 7.5v6"/></svg>',
    app: '<svg viewBox="0 0 16 16"><path d="M2.5 3h11v10h-11z M2.5 6h11"/></svg>',
    pen: '<svg viewBox="0 0 16 16"><path d="M10.5 3 13 5.5 6 12.5H3.5V10z"/></svg>',
    classic: '<svg viewBox="0 0 16 16"><path d="M2.5 3h11v10h-11z M6.5 3v10"/></svg>',
    today: '<svg viewBox="0 0 16 16"><path d="M2.5 4h11v9.5h-11z M2.5 7h11 M5.5 2.5v3 M10.5 2.5v3"/></svg>',
    folder: '<svg viewBox="0 0 16 16"><path d="M2 4.5h4l1.5 1.5H14V13H2z"/></svg>',
    flask: '<svg viewBox="0 0 16 16"><path d="M6 2.5h4 M6.5 2.5v4L3 13.5h10L9.5 6.5v-4 M4.6 10.5h6.8"/></svg>',
    proto: '<svg viewBox="0 0 16 16"><path d="M4 2.5h8v11H4z M6 5.5h4 M6 8h4 M6 10.5h2.5"/></svg>',
    stock: '<svg viewBox="0 0 16 16"><path d="M3 5.5h10v8H3z M3 5.5 4.5 2.5h7L13 5.5 M6.5 8.5h3"/></svg>',
    calc: '<svg viewBox="0 0 16 16"><path d="M4 2.5h8v11H4z M5.8 4.5h4.4v2H5.8z M6 9h.1 M8 9h.1 M10 9h.1 M6 11.3h.1 M8 11.3h.1 M10 11.3h.1"/></svg>',
    tree: '<svg viewBox="0 0 16 16"><path d="M8 2.5v3 M4 13.5v-3h8v3 M8 8v2.5 M5.5 5.5h5V8h-5z"/></svg>',
    chat: '<svg viewBox="0 0 16 16"><path d="M2.5 3.5h11v7.5H7l-3 2.5V11H2.5z"/></svg>',
    book: '<svg viewBox="0 0 16 16"><path d="M3 3.5c2-1 4-1 5 .5 1-1.5 3-1.5 5-.5v9.5c-2-1-4-1-5 .5-1-1.5-3-1.5-5-.5z M8 4v9.5"/></svg>',
  };
  const TYPE = {
    'lab-test': ['Experiment', 'exp'], document: ['Document', 'doc'], box: ['Project', 'box'],
    application: ['Page', 'app'], th: ['View', 'view'], properties: ['Overview', 'doc'],
  };
  const typeOf = row => {
    const ic = $('[data-icon]', row);
    return TYPE[ic && ic.getAttribute('data-icon')] || ['Record', 'doc'];
  };
  const icon = (name, cls = 'sh-i') => h('span', { class: cls, 'aria-hidden': 'true', html: ICON[name] || ICON.doc });

  // ------------------------------------------------- lecture des listes de Seal
  function readRow(item) {
    const content = $('[data-list-item-content]', item) || item;
    const titleEl = $('[data-nav-panel-title]', content);
    const tags = $$('[data-seal-tag]', content)
      .filter(t => !t.closest('[data-seal-tag] [data-seal-tag]'))
      .map(t => txt(t)).filter(Boolean);
    const statusEl = $('[data-seal-status-value-text]', content);
    return {
      el: content,
      title: txt(titleEl) || 'Untitled',
      type: typeOf(content),
      tags,
      status: statusEl ? txt(statusEl) : (tags.find(t => /^(draft|published|archived)/i.test(t)) || ''),
      current: item.hasAttribute('data-highlighted') || content.getAttribute('role') === 'presentation',
    };
  }

  function readSection(id) {
    const sec = $(`[data-testid="${id}"]`);
    if (!sec) return null;
    return $$('[data-list-item]', sec).map(readRow);
  }

  function readChanges() {
    const sec = $('[data-testid="section-changes:recent-activity"]');
    if (!sec) return null;
    return $$('[data-list-item]', sec).map(item => {
      const content = $('[data-list-item-content]', item) || item;
      const hashEl = $$('div,span', content).find(e => e.children.length === 0 && /^#\d+$/.test(txt(e)));
      const dateEl = $('span[title]', content);
      const tag = $('[data-seal-compound-tag]', content);
      const right = tag && $('[data-seal-compound-tag-right]', tag);
      const title = txt($('[data-nav-panel-title]', content)).replace(/ #\d+$/, '');
      const full = dateEl ? (dateEl.getAttribute('title') || txt(dateEl)) : '';
      const short = full.replace(/ (?:[A-Z][a-z]+ ){1,3}(?:Daylight|Standard|Summer) Time\b/, '');
      const m = short.match(/^(.*?)\s*(\d{1,2}:\d{2})$/);
      return {
        el: content,
        hash: hashEl ? txt(hashEl) : '',
        title: title || 'Untitled change',
        day: fullDay(m ? (m[1] || 'Today') : short),
        time: m ? m[2] : '',
        open: right ? parseInt(txt(right), 10) || 0 : 0,
      };
    });
  }

  const DAYS = { Mon: 'Monday', Tue: 'Tuesday', Wed: 'Wednesday', Thu: 'Thursday', Fri: 'Friday', Sat: 'Saturday', Sun: 'Sunday' };
  const fullDay = d => DAYS[d] || d;

  function readViews() {
    const pane = $('[data-nav-pane="views"]');
    if (!pane) return null;
    return $$('[data-list-item]', pane).map(item => {
      const content = $('[data-list-item-content]', item) || item;
      const wrap = item.closest('div[style*="padding-left"]');
      const chev = $('[data-group-chevron] [data-icon]', content);
      return {
        el: content,
        title: txt($('[data-nav-panel-title]', content)) || 'Untitled view',
        depth: wrap ? Math.round((parseFloat(wrap.style.paddingLeft) || 0) / 14) : 0,
        group: !!chev,
        open: chev ? chev.getAttribute('data-icon') === 'chevron-down' : false,
      };
    }).map((v, i, all) => {
      const path = [v.title];
      let d = v.depth;
      for (let j = i - 1; j >= 0 && d > 0; j--) {
        if (all[j].group && all[j].depth < d) { path.unshift(all[j].title); d = all[j].depth; }
      }
      return { ...v, path, key: path.join(' / ') };
    }).map((v, i, all) => {
      // Deux lignes au meme chemin (un groupe et une View homonymes) : on numerote.
      const n = all.slice(0, i).filter(x => x.key === v.key).length;
      return n ? { ...v, key: `${v.key} #${n + 1}` } : v;
    });
  }

  // ---------------------------------------- raccourcis Lab (Experiments, ...)
  // Chaque raccourci pointe sur une View de Seal : trouvee par son nom, ou
  // choisie une fois par l utilisatrice (chemin garde dans ce navigateur).
  const LAB_KEY = 'sealHelperLab';
  const LAB_DEFAULT = [
    { id: 'exp', label: 'Experiments', icon: 'exp', match: 'experiment|manip' },
    { id: 'prot', label: 'Protocols', icon: 'doc', match: 'protocol|sop|method' },
    { id: 'inv', label: 'Inventory', icon: 'box', match: 'inventor|stock|reagent|antibod|sample|freezer' },
  ];
  let lab = LAB_DEFAULT.map(x => ({ ...x }));
  let labOpen = null; // raccourci-groupe deplie dans la barre

  function resolve(sc, views) {
    if (sc.path) return views.find(v => v.key === sc.path) || null;
    if (!sc.match) return null;
    const re = new RegExp(sc.match, 'i');
    const hits = views.filter(v => re.test(v.title));
    return hits.find(v => !v.group) || hits[0] || null;
  }

  // Ouvre la View du raccourci ; deplie dans Seal les groupes parents si besoin.
  function openShortcut(sc, tries = 0) {
    const views = readViews() || [];
    const v = resolve(sc, views);
    if (v) {
      if (v.group) {
        labOpen = labOpen === sc.id ? null : sc.id;
        if (!v.open) press(v.el);
        setTimeout(() => render(true), 150);
      } else go(v.el);
      return;
    }
    if (sc.path && tries < 4) {
      const parts = sc.path.split(' / ');
      for (let k = parts.length - 1; k > 0; k--) {
        const anc = views.find(x => x.key === parts.slice(0, k).join(' / '));
        if (anc && anc.group && !anc.open) { press(anc.el); setTimeout(() => openShortcut(sc, tries + 1), 250); return; }
      }
    }
    pickFor = sc.id;
    openPage('pick');
  }

  function saveLab() {
    chrome.storage.sync.set({ [LAB_KEY]: lab.map(({ id, label, icon, match, path }) => ({ id, label, icon, match, path })) });
  }

  // ------------------------------------- appli du labo (page d accueil de Seal)
  // L accueil du labo est une appli dans un cadre de meme origine, avec son
  // propre menu (Overview, Projects, Experiments, Protocols, Inventory...).
  // On relit ce menu pour la barre et, au clic, on clique dessus pour toi,
  // en ouvrant d abord l accueil si tu es ailleurs. Rien n est ecrit.
  const APP_KEY = 'sealHelperApp';
  let appSections = []; // libelles du menu de l appli, gardes dans ce navigateur
  let appActive = '';
  let appWait = 0;
  const APP_ICON = [[/overview|home|dashboard|start/i, 'home'], [/project/i, 'folder'], [/experiment|manip/i, 'flask'],
    [/protocol|sop|method/i, 'proto'], [/inventor|stock|reagent|antibod|sample/i, 'stock'], [/calcul|file/i, 'calc'],
    [/tree/i, 'tree'], [/how|faq|help|guide/i, 'help'], [/feedback|contact/i, 'chat']];
  const appIcon = l => (APP_ICON.find(([re]) => re.test(l)) || [0, 'doc'])[1];
  const CLICKABLE = 'a,button,[role="button"],[role="tab"],[role="link"],[role="menuitem"],li';

  function appDoc() {
    const f = $('iframe[title="Custom Content"]');
    try { return f && f.contentDocument && f.contentDocument.body ? f.contentDocument : null; } catch (e) { return null; }
  }

  // Le menu = le plus petit bloc qui contient « Experiments » (ou « Protocols ») et au moins 4 entrees.
  function appNav(doc) {
    const items = $$(CLICKABLE, doc).filter(e => { const t = txt(e); return t && t.length <= 32 && (e.getClientRects().length || e.closest('[data-sh-hidden]')); });
    const anchor = items.find(e => /^(experiments?|manips?)$/i.test(txt(e))) || items.find(e => /^protocols?$/i.test(txt(e)));
    if (!anchor) return null;
    let box = anchor.parentElement;
    let inside = [];
    while (box && box !== doc.documentElement) {
      inside = items.filter(e => box.contains(e));
      if (new Set(inside.map(txt)).size >= 4) break;
      box = box.parentElement;
    }
    const byLabel = new Map();
    // Pour chaque libelle, l element le plus interieur : c est lui qui porte le clic.
    for (const e of inside) { const prev = byLabel.get(txt(e)); if (!prev || prev.contains(e)) byLabel.set(txt(e), e); }
    const isOnItem = e => [e, ...$$('*', e)].some(x => x.getAttribute('aria-current') && x.getAttribute('aria-current') !== 'false'
      || x.getAttribute('aria-selected') === 'true' || /(^|[\s_-])(active|selected|current)([\s_-]|$)/i.test(x.getAttribute('class') || ''));
    let active = '';
    for (const [l, e] of byLabel) if (isOnItem(e) || (e.parentElement && isOnItem(e.parentElement) && e.parentElement !== box)) { active = l; break; }
    return { byLabel, active, box };
  }

  const hooked = new WeakSet();
  function readApp() {
    const f = $('iframe[title="Custom Content"]');
    if (f && !hooked.has(f)) { hooked.add(f); f.addEventListener('load', schedule); }
    const doc = appDoc();
    const nav = doc && appNav(doc);
    if (!nav) { appActive = ''; return; }
    appActive = nav.active;
    const labels = [...nav.byLabel.keys()];
    if (JSON.stringify(labels) !== JSON.stringify(appSections)) {
      appSections = labels;
      try { chrome.storage.local.set({ [APP_KEY]: labels }); } catch (e) {}
    }
    watchApp(doc);
    hideAppMenu(doc, nav.box);
  }

  // Le menu de l appli fait doublon avec la barre : on masque sa colonne (jamais supprimee,
  // on clique toujours dessus pour toi). Seulement si c est bien une colonne etroite et haute.
  function hideAppMenu(doc, box) {
    const want = isOn('side') && isOn('appmenu');
    const prev = $('[data-sh-hidden]', doc);
    if (!want) { if (prev) prev.removeAttribute('data-sh-hidden'); return; }
    if (prev) return;
    const W = doc.documentElement.clientWidth, H = doc.documentElement.clientHeight;
    let col = box;
    while (col.parentElement && col.parentElement !== doc.body && col.parentElement.getBoundingClientRect().width < W * 0.45) col = col.parentElement;
    const r = col.getBoundingClientRect();
    if (!r.width || r.width > W * 0.45 || r.height < H * 0.5) return;
    if (!$('#sh-app-style', doc)) {
      const st = doc.createElement('style');
      st.id = 'sh-app-style';
      st.textContent = '[data-sh-hidden]{display:none!important}';
      doc.head.append(st);
    }
    col.setAttribute('data-sh-hidden', '');
  }

  // Type de la fiche ouverte (icone de l en-tete) -> section du cahier qui la contient.
  const KIND = { 'lab-test': /experiment|manip/i, box: /project/i };
  function recordSection() {
    if (isWorkspaceRoot() || page) return '';
    const header = $('[data-testid="changeset-top-navbar"], [data-testid="entity-top-navbar"]');
    const ic = header && $('[data-title-heading] [data-icon], [data-icon]', header);
    const re = ic && KIND[ic.getAttribute('data-icon')];
    return re ? appSections.find(l => re.test(l)) || '' : '';
  }

  // Les changements dans l appli (changer d onglet) relancent notre lecture.
  const watched = new WeakSet();
  function watchApp(doc) {
    if (watched.has(doc)) return;
    watched.add(doc);
    new MutationObserver(schedule).observe(doc.body, { childList: true, subtree: true, attributes: true, attributeFilter: ['class', 'aria-current', 'aria-selected'] });
  }

  function pressIn(el) {
    const w = el.ownerDocument.defaultView || window;
    const o = { bubbles: true, cancelable: true, view: w, button: 0, pointerType: 'mouse', isPrimary: true };
    el.dispatchEvent(new w.PointerEvent('pointerdown', o));
    el.dispatchEvent(new w.MouseEvent('mousedown', o));
    el.dispatchEvent(new w.PointerEvent('pointerup', o));
    el.dispatchEvent(new w.MouseEvent('mouseup', o));
    el.click();
  }

  function openAppSection(label) {
    page = null;
    guideOpened = true;
    clearTimeout(appWait);
    const tryClick = () => {
      const doc = appDoc();
      const nav = doc && appNav(doc);
      const el = nav && nav.byLabel.get(label);
      if (el) { pressIn(el); appActive = label; render(true); return true; }
      return false;
    };
    if (isWorkspaceRoot() && tryClick()) return;
    if (!isWorkspaceRoot()) {
      const d = data();
      const home = [...d.favourites, ...d.recent].find(r => r.type && r.type[0] === 'Page');
      if (home) press(home.el);
      else { const m = location.pathname.match(/^\/o\/[^/]+\/s\/[^/]+/); if (m) location.assign(m[0]); return; }
    }
    render(true);
    const until = Date.now() + 12000;
    const loop = () => { if (!tryClick() && Date.now() < until) appWait = setTimeout(loop, 250); };
    appWait = setTimeout(loop, 250);
  }

  function readChangeset() {
    const nav = $('[data-testid="change-set-navigation"]');
    if (!nav) return null;
    const back = $('button [data-icon="arrow-left"]', nav);
    const hashEl = $$('div,span', nav).find(e => e.children.length === 0 && /^#\d+$/.test(txt(e)));
    const head = hashEl && hashEl.closest('.flex') && hashEl.closest('.flex').parentElement;
    const nameEl = head && $('span[title]', head);
    const right = $('[data-seal-compound-tag-right]', nav);
    return {
      back: back && back.closest('button'),
      hash: hashEl ? txt(hashEl) : '',
      name: nameEl ? (nameEl.getAttribute('title') || txt(nameEl)) : '',
      open: right ? txt(right) : '',
      rows: $$('[data-list-item]', nav).map(readRow),
    };
  }

  function group(rows) {
    const out = [];
    const by = new Map();
    for (const r of rows) {
      const k = r.title.toLowerCase();
      if (by.has(k)) { by.get(k).n++; by.get(k).all.push(r); continue; }
      const g = { ...r, n: 1, all: [r] };
      by.set(k, g);
      out.push(g);
    }
    return out;
  }

  function data() {
    const views = readViews();
    const changes = readChanges() || [];
    return {
      lab: txt($('[data-testid="system-name"]')),
      favourites: readSection('section-entities:favourites') || [],
      recent: readSection('section-entities:recent-activity') || [],
      mine: readSection('section-entities:recently-created-by-you') || [],
      changes,
      pending: changes.filter(c => c.open > 0),
      views: views || [],
      changeset: readChangeset(),
      newBtn: $('[data-testid="navbar-new-entity-button"]'),
    };
  }

  // ----------------------------------------------------------- etat de la page
  // page = null (Seal visible) ou 'home' | 'work' | 'pub'
  let page = null;
  let lastRoute = '';
  let guideOpened = false;
  let autoHome = false;
  const isWorkspaceRoot = () => /^\/o\/[^/]+\/s\/[^/]+\/?$/.test(location.pathname);

  function onRoute() {
    if (location.pathname === lastRoute) return;
    lastRoute = location.pathname;
    closeUntil = Date.now() + 4000;
    page = isOn('home') && isWorkspaceRoot() && !guideOpened && !appSections.length ? 'home' : null;
    autoHome = page === 'home';
  }

  function go(el) {
    // Une ligne Seal : on quitte nos pages et on laisse Seal ouvrir la fiche.
    page = null;
    guideOpened = true; // Home ne s ouvre seul qu a la premiere arrivee sur l accueil

    press(el);
    render(true);
  }

  const PAGE_NAME = { home: 'Today', work: 'My work', pub: 'To publish', pick: 'Shortcut' };
  function whereAmI(d) {
    if (page) return [PAGE_NAME[page] || ''];
    if (isWorkspaceRoot()) return appActive ? ['Notebook', appActive] : ['Notebook'];
    const sec = recordSection();
    const header = $('[data-testid="changeset-top-navbar"], [data-testid="entity-top-navbar"]');
    const t = header ? txt($('[data-title-text]', header)) || txt($('h1[data-document-title]')) : '';
    const short = t.split(/\s+[-–—]\s+/)[0].slice(0, 28);
    return [sec || (d.changeset && d.changeset.hash ? 'Change ' + d.changeset.hash : 'Record'), short].filter(Boolean);
  }

  // Nos pages entrent dans l historique du navigateur : la fleche retour y ramene.
  function openPage(p) {
    if (page !== p) { try { history.pushState({ ...(history.state || {}), sh: p }, '', location.href); } catch (e) {} }
    page = p;
    render(true);
    const pg = $('#sh-page');
    if (pg) pg.scrollTop = 0;
  }

  function openGuide(d) {
    guideOpened = true;
    page = null;
    if (!isWorkspaceRoot()) {
      const app = d.favourites.find(f => f.type[0] === 'Page') || d.favourites[0];
      if (app) press(app.el);
    }
    render(true);
  }

  // --------------------------------------------------------------- la barre
  function sideItem(name, label, { on, count, hot, onclick, kbd, title } = {}) {
    return h('button', { type: 'button', class: 'sh-item' + (on ? ' on' : ''), onclick, title, 'aria-current': on ? 'page' : null },
      icon(name), h('span', { class: 'sh-t' }, label),
      count != null && count !== '' ? h('span', { class: 'sh-n' + (hot ? ' hot' : '') }, count) : null,
      kbd ? h('kbd', {}, kbd) : null);
  }

  function rowButton(r, { cls = 'sh-row', showTag = true } = {}) {
    return h('button', { type: 'button', class: cls + (r.current ? ' on' : ''), title: r.title, onclick: () => go(r.el) },
      icon(r.type[1]), h('span', { class: 'sh-t' }, r.title),
      r.n > 1 ? h('span', { class: 'sh-x' }, '×' + r.n) : null,
      showTag && r.status ? h('span', { class: 'sh-dot ' + statusClass(r.status), title: r.status }) : null);
  }

  function statusClass(s) {
    if (/publish/i.test(s)) return 'pub';
    if (/draft/i.test(s)) return 'draft';
    if (/run|progress|active/i.test(s)) return 'run';
    if (/plan/i.test(s)) return 'plan';
    return 'draft';
  }

  function buildSide(d) {
    const side = h('aside', { id: 'sh-side', class: 'sh', 'aria-label': 'Seal navigation' });
    const sw = $('[data-testid="system-switcher"]');
    side.append(h('div', { class: 'sh-lab' },
      h('span', { class: 'sh-mark' }, (d.lab || 'S').slice(0, 1)),
      h('span', { class: 'sh-labname' }, d.lab ? d.lab.charAt(0) + d.lab.slice(1).toLowerCase() : 'Seal'),
      sw ? h('button', { type: 'button', class: 'sh-iconbtn', title: 'Switch system', onclick: () => press(sw) }, icon('swap')) : null));
    const nav = window.navigation;
    side.append(h('div', { class: 'sh-nav' },
      h('button', { type: 'button', class: 'sh-arrow', title: 'Back (Alt ←)', 'aria-label': 'Back', disabled: nav && !nav.canGoBack, onclick: () => history.back() }, icon('back')),
      h('button', { type: 'button', class: 'sh-arrow', title: 'Forward (Alt →)', 'aria-label': 'Forward', disabled: nav && !nav.canGoForward, onclick: () => history.forward() }, icon('chev')),
      h('span', { class: 'sh-here', title: 'Where you are' }, ...whereAmI(d).flatMap((c, i) => i ? [h('span', { class: 'sh-sep' }, '/'), h('span', {}, c)] : [h('span', {}, c)]))));

    const q = $('[data-testid="nav-panel-query-button"]');
    if (q) side.append(h('button', { type: 'button', class: 'sh-search', onclick: () => press(q) },
      icon('search'), h('span', {}, 'Search'), h('kbd', {}, isMac ? '⌘K' : 'Ctrl K')));

    const top = h('div', { class: 'sh-block' });
    if (d.newBtn) top.append(sideItem('plus', 'New', { onclick: () => press(d.newBtn) }));
    top.append(sideItem('today', 'Today', { on: page === 'home', onclick: () => openPage('home') }));
    top.append(sideItem('work', 'My work', { on: page === 'work', count: group(d.mine).length || '', onclick: () => openPage('work') }));
    top.append(sideItem('pub', 'To publish', { on: page === 'pub', count: d.pending.length || '', hot: d.pending.length > 0, onclick: () => openPage('pub') }));
    const inbox = $('[data-testid="nav-panel-inbox-button"]');
    if (inbox) top.append(sideItem('inbox', 'Inbox', { onclick: () => press(inbox) }));
    side.append(top);

    const scroll = h('div', { class: 'sh-scroll' });

    const cs = d.changeset;
    if (cs && cs.rows.length) {
      const blk = h('div', { class: 'sh-cs' },
        h('div', { class: 'sh-cs-head' },
          cs.back ? h('button', { type: 'button', class: 'sh-iconbtn', title: 'Leave this change', onclick: () => press(cs.back) }, icon('back')) : null,
          h('span', { class: 'sh-hash' }, cs.hash),
          h('span', { class: 'sh-t', title: cs.name }, cs.name || 'This change'),
          cs.open ? h('span', { class: 'sh-n', title: 'Records in this change' }, cs.open) : null));
      for (const r of group(cs.rows)) blk.append(rowButton({ ...r, current: r.all.some(x => x.current) }, { cls: 'sh-row sh-cs-row' }));
      scroll.append(h('div', { class: 'sh-group' }, 'This change'), blk);
    }

    if (appSections.length) {
      const here = isWorkspaceRoot() && !page;
      const inSec = recordSection();
      scroll.append(h('div', { class: 'sh-group' }, d.lab ? (d.lab.charAt(0) + d.lab.slice(1).toLowerCase() + ' lab') : 'Lab'));
      for (const l of appSections) {
        scroll.append(h('button', { type: 'button', class: 'sh-row sh-app' + ((here && appActive === l) || inSec === l ? ' on' : ''), title: `Open ${l} in the lab notebook`, onclick: () => openAppSection(l) },
          icon(appIcon(l)), h('span', { class: 'sh-t' }, l)));
      }
    }
    if (!appSections.length) scroll.append(h('div', { class: 'sh-group' }, 'Lab'));
    if (!appSections.length) for (const sc of lab) {
      const v = resolve(sc, d.views);
      const row = h('div', { class: 'sh-sc' + (v ? '' : ' unset') },
        h('button', { type: 'button', class: 'sh-row' + (page === 'pick' && pickFor === sc.id ? ' on' : ''), title: v ? `${sc.label}: ${v.key}` : `Choose the Seal view for ${sc.label}`, onclick: () => openShortcut(sc) },
          icon(sc.icon || 'view'), h('span', { class: 'sh-t' }, sc.label),
          v ? (v.group ? h('span', { class: 'sh-chev' + (labOpen === sc.id && v.open ? ' open' : ''), 'aria-hidden': 'true', html: ICON.chev }) : null) : h('span', { class: 'sh-set' }, 'Choose')),
        h('button', { type: 'button', class: 'sh-edit', title: `Change what ${sc.label} opens`, onclick: () => { pickFor = sc.id; openPage('pick'); } }, icon('pen')));
      scroll.append(row);
      if (v && v.group && v.open && labOpen === sc.id) {
        const i = d.views.indexOf(v);
        for (const c of d.views.slice(i + 1)) {
          if (c.depth <= v.depth) break;
          scroll.append(h('button', { type: 'button', class: 'sh-row sh-sub', title: c.title, style: `padding-left:${30 + (c.depth - v.depth - 1) * 14}px`,
            onclick: () => (c.group ? (press(c.el), setTimeout(() => render(true), 150)) : go(c.el)) },
          c.group ? h('span', { class: 'sh-chev' + (c.open ? ' open' : ''), 'aria-hidden': 'true', html: ICON.chev }) : icon('view'), h('span', { class: 'sh-t' }, c.title)));
        }
      }
    }
    if (!appSections.length) scroll.append(h('button', { type: 'button', class: 'sh-row sh-add', onclick: () => { pickFor = 'new'; openPage('pick'); } }, icon('plus'), h('span', { class: 'sh-t' }, 'Add a shortcut')));

    if (d.views.length) {
      scroll.append(h('button', { type: 'button', class: 'sh-group sh-toggle', 'aria-expanded': String(allViewsOpen), onclick: () => { allViewsOpen = !allViewsOpen; try { localStorage.setItem('sh-allviews', allViewsOpen ? '1' : '0'); } catch (e) {} render(true); } },
        h('span', { class: 'sh-chev' + (allViewsOpen ? ' open' : ''), 'aria-hidden': 'true', html: ICON.chev }), 'All views'));
      if (allViewsOpen) for (const v of d.views) {
        scroll.append(h('button', {
          type: 'button', class: 'sh-row sh-view' + (v.group ? ' grp' : ''), title: v.title,
          style: `padding-left:${8 + v.depth * 14}px`,
          onclick: () => (v.group ? (press(v.el), setTimeout(() => render(true), 120)) : go(v.el)),
        },
        v.group ? h('span', { class: 'sh-chev' + (v.open ? ' open' : ''), 'aria-hidden': 'true', html: ICON.chev }) : icon('view'),
        h('span', { class: 'sh-t' }, v.title)));
      }
    }

    if (d.favourites.length) {
      scroll.append(h('div', { class: 'sh-group' }, 'Favourites'));
      for (const f of d.favourites) scroll.append(rowButton(f, { showTag: false }));
    }
    side.append(scroll);

    const set = $('[data-testid="nav-panel-settings-button"]');
    const help = $('[data-testid="nav-panel-help-menu"]');
    side.append(h('div', { class: 'sh-foot' },
      set ? h('button', { type: 'button', class: 'sh-iconbtn', title: 'Settings', onclick: () => press(set) }, icon('gear')) : null,
      help ? h('button', { type: 'button', class: 'sh-iconbtn', title: 'Help and more', onclick: () => press(help) }, icon('help')) : null,
      h('button', { type: 'button', class: 'sh-classic', title: 'Show Seal without the new layout', onclick: () => save({ side: false }) }, icon('classic'), 'Classic Seal')));
    return side;
  }

  // ------------------------------------------------------------- les pages
  function pill(s) {
    return s ? h('span', { class: 'sh-pill ' + statusClass(s) }, s.replace(/\s*v\d+$/, '')) : null;
  }

  function listCard(title, more, rows, empty) {
    const card = h('section', { class: 'sh-card' }, h('header', {}, h('h3', {}, title), more));
    if (!rows.length) card.append(h('p', { class: 'sh-empty' }, empty));
    for (const r of rows) card.append(r);
    return card;
  }

  function entityLine(r) {
    return h('button', { type: 'button', class: 'sh-line', onclick: () => go(r.el) },
      h('span', { class: 'sh-ti' }, icon(r.type[1])),
      h('span', { class: 'sh-lt' }, h('b', {}, r.title, r.n > 1 ? h('span', { class: 'sh-x' }, '×' + r.n) : null), h('small', {}, r.type[0])),
      pill(r.status));
  }

  function changeLine(c) {
    return h('button', { type: 'button', class: 'sh-line', onclick: () => go(c.el) },
      h('span', { class: 'sh-ti v' }, icon('pub')),
      h('span', { class: 'sh-lt' }, h('b', {}, c.title),
        h('small', {}, [c.hash, c.open + (c.open === 1 ? ' record' : ' records'), [c.day, c.time].filter(Boolean).join(' ')].filter(Boolean).join(' · '))),
      c.n > 1 ? h('span', { class: 'sh-x', title: `${c.n} changes with this name` }, '×' + c.n) : null,
      h('span', { class: 'sh-go' }, 'Review'));
  }

  function groupChanges(list) {
    const out = [];
    for (const c of list) {
      const prev = out[out.length - 1];
      if (prev && prev.title === c.title && prev.day === c.day) { prev.n++; prev.open += c.open; continue; }
      out.push({ ...c, n: 1 });
    }
    return out;
  }

  // ---------------------------------------------------- tableau de bord Today
  const TINT = { exp: 'blue', doc: 'teal', box: 'violet', app: 'grey', view: 'grey', proto: 'teal', stock: 'amber', folder: 'violet', flask: 'blue', calc: 'grey', home: 'grey', help: 'grey', tree: 'grey', chat: 'grey' };
  const tint = k => 'tint-' + (TINT[k] || 'grey');
  const SECTION_TEXT = [[/overview|start/i, 'Lab start page and news'], [/project/i, 'Experiments grouped by question'], [/experiment|manip/i, 'Plans, runs and results'],
    [/protocol|sop|method/i, 'Methods and SOPs'], [/inventor|stock/i, 'Reagents, antibodies, samples'], [/calcul|file/i, 'Tools and shared files'],
    [/tree/i, 'How records connect'], [/how|faq|help/i, 'Guides for the lab'], [/feedback/i, 'Tell the team what to improve']];
  const sectionText = l => (SECTION_TEXT.find(([re]) => re.test(l)) || [0, ''])[1];

  // « Today », « Yesterday », « Fri », « 28 Oct » -> date (jour seul).
  function dayDate(label) {
    const now = new Date(); now.setHours(0, 0, 0, 0);
    if (!label || /^today$/i.test(label)) return now;
    if (/^yesterday$/i.test(label)) return new Date(now - 864e5);
    const wd = ['sun', 'mon', 'tue', 'wed', 'thu', 'fri', 'sat'].indexOf(label.slice(0, 3).toLowerCase());
    if (wd >= 0 && !/\d/.test(label)) { const d = new Date(now); do d.setDate(d.getDate() - 1); while (d.getDay() !== wd); return d; }
    const t = Date.parse(label + ' ' + now.getFullYear());
    return isNaN(t) ? null : new Date(t);
  }

  function weekStrip(changes) {
    const now = new Date(); now.setHours(0, 0, 0, 0);
    const monday = new Date(now); monday.setDate(now.getDate() - 6); // 7 derniers jours, aujourd hui a droite
    const counts = new Map();
    for (const c of changes) { const d = dayDate(c.day); if (d) counts.set(d.toDateString(), (counts.get(d.toDateString()) || 0) + 1); }
    const days = [];
    for (let i = 0; i < 7; i++) {
      const d = new Date(monday); d.setDate(monday.getDate() + i);
      const n = counts.get(d.toDateString()) || 0;
      days.push(h('div', { class: 'sh-day' + (d.getTime() === now.getTime() ? ' today' : '') + (n ? ' busy' : ''), title: n ? `${n} change${n > 1 ? 's' : ''}` : 'No change' },
        h('small', {}, d.toLocaleDateString('en-NZ', { weekday: 'short' })),
        h('b', {}, String(d.getDate())),
        h('span', { class: 'sh-dots' }, Array.from({ length: Math.min(n, 4) }, () => h('i', {})))));
    }
    const week = changes.filter(c => { const d = dayDate(c.day); return d && d >= monday; }).length;
    return { el: h('div', { class: 'sh-week' }, days), week };
  }

  function stat(label, value, caption, onclick, accent) {
    return h('button', { type: 'button', class: 'sh-stat' + (accent ? ' ' + accent : ''), onclick },
      h('small', {}, label), h('b', {}, String(value)), h('span', {}, caption));
  }

  function buildHome(d) {
    const now = new Date();
    const hour = now.getHours();
    const hello = hour < 12 ? 'Good morning' : hour < 18 ? 'Good afternoon' : 'Good evening';
    const labName = d.lab ? d.lab.charAt(0) + d.lab.slice(1).toLowerCase() + ' lab' : 'Lab';
    const work = group([...d.recent, ...d.mine]);
    const drafts = work.filter(r => /draft/i.test(r.status));
    const published = work.filter(r => /publish/i.test(r.status));
    const pend = groupChanges(d.pending);
    const { el: week, week: weekCount } = weekStrip(d.changes);
    const recent = group(d.recent).filter(r => r.type[0] !== 'Page');
    const hero = recent[0];
    const q = $('[data-testid="nav-panel-query-button"]');

    const head = h('header', { class: 'sh-dash-head' },
      h('div', {},
        h('div', { class: 'sh-eyebrow' }, labName + ' · electronic lab notebook'),
        h('h1', {}, hello),
        h('p', {}, now.toLocaleDateString('en-NZ', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' }))),
      h('div', { class: 'sh-dash-tools' },
        q ? h('button', { type: 'button', class: 'sh-bigsearch', onclick: () => press(q) }, icon('search'), h('span', {}, 'Search records, protocols, samples…'), h('kbd', {}, isMac ? '⌘K' : 'Ctrl K')) : null,
        d.newBtn ? h('button', { type: 'button', class: 'sh-btn', onclick: () => press(d.newBtn) }, icon('plus'), 'New record') : null));

    const stats = h('div', { class: 'sh-stats' },
      stat('In progress', drafts.length, drafts.length === 1 ? 'draft record' : 'draft records', () => { workType = ''; openPage('work'); }),
      stat('To publish', d.pending.length, d.pending.length ? 'waiting for review' : 'all published', () => openPage('pub'), d.pending.length ? 'hot' : ''),
      stat('Published', published.length, 'in your recent records', () => openPage('work')),
      stat('Last 7 days', weekCount, weekCount === 1 ? 'change made' : 'changes made', () => openPage('pub')));

    const heroCard = hero ? h('button', { type: 'button', class: 'sh-hero', onclick: () => go(hero.el) },
      h('span', { class: 'sh-ti big ' + tint(hero.type[1]) }, icon(hero.type[1])),
      h('span', { class: 'sh-hero-t' },
        h('small', {}, 'Pick up where you left off'),
        h('b', {}, hero.title),
        h('span', { class: 'sh-meta' }, h('span', { class: 'sh-type' }, hero.type[0]), pill(hero.status))),
      h('span', { class: 'sh-open' }, 'Open', icon('chev'))) : null;

    const next = recent.slice(1, 6).map(r => h('button', { type: 'button', class: 'sh-line', onclick: () => go(r.el) },
      h('span', { class: 'sh-ti ' + tint(r.type[1]) }, icon(r.type[1])),
      h('span', { class: 'sh-lt' }, h('b', {}, r.title, r.n > 1 ? h('span', { class: 'sh-x' }, '×' + r.n) : null), h('small', {}, r.type[0])),
      pill(r.status)));

    const sections = appSections.filter(l => !/how|faq|feedback|help/i.test(l));
    const notebook = sections.length ? h('section', { class: 'sh-panel' },
      h('header', {}, h('h3', {}, 'Lab notebook'), h('span', { class: 'sh-sub' }, 'Open a section')),
      h('div', { class: 'sh-tiles' }, sections.map(l => h('button', { type: 'button', class: 'sh-tile', onclick: () => openAppSection(l) },
        h('span', { class: 'sh-ti ' + tint(appIcon(l)) }, icon(appIcon(l))),
        h('b', {}, l), h('small', {}, sectionText(l)))))) : null;

    const toPublish = h('section', { class: 'sh-panel' },
      h('header', {}, h('h3', {}, 'To publish'), pend.length ? h('button', { type: 'button', class: 'sh-more', onclick: () => openPage('pub') }, `All ${d.pending.length} ›`) : null),
      pend.length ? pend.slice(0, 5).map(c => h('button', { type: 'button', class: 'sh-check', onclick: () => go(c.el) },
        h('span', { class: 'sh-box' }), h('span', { class: 'sh-lt' }, h('b', {}, c.title), h('small', {}, [c.hash, c.day, c.time].filter(Boolean).join(' · '))),
        c.n > 1 ? h('span', { class: 'sh-x' }, '×' + c.n) : null))
        : h('p', { class: 'sh-empty' }, 'Nothing waiting. Everything you changed is published.'));

    // Fil d activite : changements groupes par jour, facon journal de labo.
    const feed = h('div', { class: 'sh-feed' });
    let day = null;
    for (const c of groupChanges(d.changes).slice(0, 8)) {
      if (c.day !== day) { day = c.day; feed.append(h('div', { class: 'sh-feed-day' }, day || 'Earlier')); }
      feed.append(h('button', { type: 'button', class: 'sh-feed-item' + (c.open ? '' : ' faint'), onclick: () => go(c.el) },
        h('span', { class: 'sh-feed-dot' }), h('span', { class: 'sh-feed-time' }, c.time),
        h('span', { class: 'sh-lt' }, h('b', {}, c.title), h('small', {}, c.hash + (c.open ? ` · ${c.open} record${c.open > 1 ? 's' : ''}` : ' · empty')))));
    }
    const activity = h('section', { class: 'sh-panel' },
      h('header', {}, h('h3', {}, 'Last 7 days'), h('span', { class: 'sh-sub' }, `${weekCount} change${weekCount === 1 ? '' : 's'}`)),
      week, d.changes.length ? feed : h('p', { class: 'sh-empty' }, 'No activity yet.'));

    const favs = d.favourites.length ? h('section', { class: 'sh-panel' },
      h('header', {}, h('h3', {}, 'Favourites')),
      d.favourites.map(r => h('button', { type: 'button', class: 'sh-line', onclick: () => go(r.el) },
        h('span', { class: 'sh-ti ' + tint(r.type[1]) }, icon('star')), h('span', { class: 'sh-lt' }, h('b', {}, r.title), h('small', {}, r.type[0]))))) : null;

    return h('div', { class: 'sh-wrap sh-dash' },
      head, stats,
      h('div', { class: 'sh-cols' },
        h('div', { class: 'sh-col' },
          h('section', { class: 'sh-panel' },
            h('header', {}, h('h3', {}, 'Continue'), h('button', { type: 'button', class: 'sh-more', onclick: () => openPage('work') }, 'All my work ›')),
            heroCard, next.length ? next : null, !hero ? h('p', { class: 'sh-empty' }, 'Records you open will show here.') : null),
          notebook),
        h('div', { class: 'sh-col' }, toPublish, activity, favs)));
  }

  let pickFor = null;
  let allViewsOpen = (() => { try { return localStorage.getItem('sh-allviews') === '1'; } catch (e) { return false; } })();

  function buildPick(d) {
    const isNew = pickFor === 'new';
    const sc = isNew ? { id: 'c' + Date.now(), label: '', icon: 'view' } : lab.find(x => x.id === pickFor);
    if (!sc) return h('div', { class: 'sh-wrap' }, h('p', { class: 'sh-empty' }, 'Shortcut not found.'));
    const cur = resolve(sc, d.views);
    const name = h('input', { type: 'text', id: 'sh-scname', class: 'sh-input', value: sc.label, placeholder: 'Name, e.g. Antibodies' });
    const choose = v => {
      const label = name.value.trim() || sc.label || v.title;
      const next = { ...sc, label, path: v.key };
      lab = isNew ? [...lab, next] : lab.map(x => (x.id === sc.id ? next : x));
      saveLab();
      page = null;
      openShortcut(next);
    };
    const list = h('div', { class: 'sh-card sh-picklist' },
      d.views.map(v => h('button', { type: 'button', class: 'sh-line' + (cur && cur.key === v.key ? ' on' : ''), style: `padding-left:${14 + v.depth * 18}px`,
        onclick: () => (v.group && !v.open ? (press(v.el), setTimeout(() => render(true), 150)) : choose(v)) },
      v.group ? h('span', { class: 'sh-chev' + (v.open ? ' open' : ''), 'aria-hidden': 'true', html: ICON.chev }) : icon('view'),
      h('span', { class: 'sh-lt' }, h('b', {}, v.title), v.group ? h('small', {}, v.open ? 'Group, click to use it as the shortcut' : 'Group, click to see what is inside') : null),
      cur && cur.key === v.key ? h('span', { class: 'sh-go' }, 'Current') : h('span', { class: 'sh-go' }, 'Use'))));
    return h('div', { class: 'sh-wrap sh-narrow' },
      h('div', { class: 'sh-hello' }, h('div', {}, h('h1', {}, isNew ? 'Add a shortcut' : `What should ${sc.label} open?`),
        h('p', {}, 'Pick one of your Seal views. Seal Helper remembers it in this browser; nothing changes in Seal.'))),
      h('label', { class: 'sh-field', for: 'sh-scname' }, h('span', {}, 'Name in the sidebar'), name),
      d.views.length ? list : h('p', { class: 'sh-empty' }, 'No Seal views found yet. Open the Views tab in classic Seal once, then come back.'),
      h('div', { class: 'sh-actions' },
        h('button', { type: 'button', class: 'sh-btn ghost', onclick: () => { page = null; render(true); } }, 'Cancel'),
        !isNew && sc.path ? h('button', { type: 'button', class: 'sh-btn ghost', onclick: () => { lab = lab.map(x => (x.id === sc.id ? { ...x, path: undefined } : x)); saveLab(); render(true); } }, 'Reset to automatic') : null,
        !isNew ? h('button', { type: 'button', class: 'sh-btn ghost', onclick: () => { lab = lab.filter(x => x.id !== sc.id); saveLab(); page = null; render(true); } }, 'Remove from sidebar') : null));
  }

  let workFilter = '';
  let workType = '';
  function buildWork(d) {
    const all = group([...d.recent, ...d.mine]);
    const types = [...new Set(all.map(r => r.type[0]))];
    const rows = all.filter(r => (!workFilter || r.title.toLowerCase().includes(workFilter.toLowerCase())) && (!workType || r.type[0] === workType));
    const chips = types.length > 1 ? h('div', { class: 'sh-chips', role: 'group', 'aria-label': 'Type' },
      ['', ...types].map(t => h('button', { type: 'button', class: 'sh-chip' + (workType === t ? ' on' : ''), 'aria-pressed': String(workType === t), onclick: () => { workType = t; render(true); } },
        t ? t + 's' : 'All'))) : null;
    const input = h('input', { type: 'search', id: 'sh-filter', class: 'sh-input', placeholder: 'Filter by name', value: workFilter,
      oninput: e => { workFilter = e.target.value; render(true); const i = $('#sh-filter'); if (i) { i.focus(); i.setSelectionRange(i.value.length, i.value.length); } } });
    const table = h('table', { class: 'sh-table' },
      h('thead', {}, h('tr', {}, h('th', {}, 'Name'), h('th', {}, 'Type'), h('th', {}, 'Status'), h('th', {}, ''))),
      h('tbody', {}, rows.map(r => h('tr', { onclick: () => go(r.el), tabindex: '0', onkeydown: e => e.key === 'Enter' && go(r.el) },
        h('td', {}, h('span', { class: 'sh-cell' }, icon(r.type[1]), h('b', {}, r.title), r.n > 1 ? h('span', { class: 'sh-x', title: `${r.n} records with this name` }, '×' + r.n) : null)),
        h('td', { class: 'sh-muted' }, r.type[0]), h('td', {}, pill(r.status)), h('td', { class: 'sh-go' }, 'Open ›')))));
    return h('div', { class: 'sh-wrap' },
      h('div', { class: 'sh-hello' }, h('div', {}, h('h1', {}, 'My work'), h('p', {}, 'Records you opened recently or created, same names grouped together.')), input),
      chips,
      rows.length ? table : h('p', { class: 'sh-empty' }, 'No record matches.'));
  }

  let showEmpty = false;
  function buildPub(d) {
    const list = groupChanges(showEmpty ? d.changes : d.pending);
    const emptyCount = d.changes.length - d.pending.length;
    const body = h('tbody', {});
    let day = null;
    for (const c of list) {
      if (c.day !== day) { day = c.day; body.append(h('tr', { class: 'sh-day' }, h('td', { colspan: '5' }, day || 'Earlier'))); }
      body.append(h('tr', { class: c.open ? '' : 'sh-faint', onclick: () => go(c.el), tabindex: '0', onkeydown: e => e.key === 'Enter' && go(c.el) },
        h('td', { class: 'sh-hashcell' }, c.hash),
        h('td', {}, h('span', { class: 'sh-cell' }, h('b', {}, c.title), c.n > 1 ? h('span', { class: 'sh-x' }, '×' + c.n) : null)),
        h('td', { class: 'sh-num' }, c.open), h('td', { class: 'sh-num sh-muted' }, c.time), h('td', { class: 'sh-go' }, 'Review ›')));
    }
    return h('div', { class: 'sh-wrap' },
      h('div', { class: 'sh-hello' },
        h('div', {}, h('h1', {}, 'To publish'), h('p', {}, 'Changes you started and have not published yet. The lab sees them only once they are published.')),
        emptyCount > 0 ? h('button', { type: 'button', class: 'sh-btn ghost', onclick: () => { showEmpty = !showEmpty; render(true); } },
          showEmpty ? 'Hide empty changes' : `Show ${emptyCount} empty`) : null),
      list.length ? h('table', { class: 'sh-table' },
        h('thead', {}, h('tr', {}, h('th', {}, 'Change'), h('th', {}, 'What'), h('th', { class: 'sh-num' }, 'Records'), h('th', { class: 'sh-num' }, 'Last edit'), h('th', {}, ''))), body)
        : h('p', { class: 'sh-empty' }, 'Nothing waiting. Everything you changed is published.'));
  }

  // ------------------------------------------------ fiche : proprietes et plan
  function readProps() {
    const out = [];
    for (const card of $$('[data-testid^="form-field-card-"]')) {
      const label = card.getAttribute('data-testid').slice('form-field-card-'.length);
      if (/title$/i.test(label) || /^title$/i.test(label)) continue;
      const valEl = $('[data-field-value]', card) || $('.document-field-row__value', card) || card;
      const input = $('input, textarea, select', valEl);
      let value = input && input.value ? input.value : txt(valEl);
      if (!value || value.length > 60) continue;
      out.push({ label, value, card });
      if (out.length >= 6) break;
    }
    return out;
  }

  function readHeadings() {
    return $$('[data-native-block-type="h2"], [data-native-block-type="h3"]')
      .map(b => ({ b, t: txt(b), lvl: b.getAttribute('data-native-block-type') }))
      .filter(x => x.t);
  }

  let propsSig = '';
  function renderProps() {
    const header = $('[data-testid="changeset-top-navbar"], [data-testid="entity-top-navbar"]');
    const old = $('#sh-props');
    const props = isOn('props') && header ? readProps() : [];
    const sec = isOn('props') && header && isOn('side') ? recordSection() : '';
    const sig = sec + '#' + props.map(p => p.label + '=' + p.value).join('|');
    if (!props.length && !sec) { if (old) old.remove(); propsSig = ''; return; }
    if (old && sig === propsSig && old.previousElementSibling === header) return;
    propsSig = sig;
    const bar = h('div', { id: 'sh-props', class: 'sh' },
      sec ? h('nav', { class: 'sh-crumbs', 'aria-label': 'You are here' },
        h('button', { type: 'button', class: 'sh-crumb', title: 'Lab notebook', onclick: () => openAppSection(appSections[0]) }, 'Notebook'),
        h('span', { class: 'sh-sep' }, '›'),
        h('button', { type: 'button', class: 'sh-crumb', title: `Back to ${sec}`, onclick: () => openAppSection(sec) }, sec),
        h('span', { class: 'sh-sep' }, '›'),
        h('span', { class: 'sh-crumb-here' }, (txt($('[data-title-text]', header)) || '').split(/\s+[-–—]\s+/)[0].slice(0, 32))) : null,
      props.map(p => h('button', { type: 'button', class: 'sh-prop', title: 'Go to ' + p.label, onclick: () => p.card.scrollIntoView({ behavior: 'smooth', block: 'center' }) },
        h('small', {}, p.label), /status/i.test(p.label) ? pill(p.value) : h('span', {}, p.value))));
    if (old) old.remove();
    header.after(bar);
  }

  let outlineSig = '';
  let heads = [];
  function renderOutline() {
    const old = $('#sh-outline');
    const wide = window.innerWidth >= 1280 && !$('[data-side-panel="open"]');
    heads = isOn('props') && wide && !page ? readHeadings() : [];
    root.classList.toggle('sh-has-outline', heads.length >= 3);
    if (heads.length < 3) { if (old) old.remove(); outlineSig = ''; return; }
    const sig = heads.map(x => x.lvl + x.t).join('|');
    if (old && sig === outlineSig) return markActive();
    outlineSig = sig;
    const box = h('nav', { id: 'sh-outline', class: 'sh', 'aria-label': 'On this page' },
      h('div', { class: 'sh-group' }, 'On this page'),
      heads.map((x, i) => h('button', { type: 'button', class: 'sh-oh ' + x.lvl, 'data-i': i, title: x.t,
        onclick: () => x.b.scrollIntoView({ behavior: 'smooth', block: 'start' }) }, x.t)));
    if (old) old.remove();
    document.body.append(box);
    markActive();
  }

  function markActive() {
    const box = $('#sh-outline');
    if (!box || !heads.length) return;
    let cur = 0;
    heads.forEach((x, i) => { if (x.b.isConnected && x.b.getBoundingClientRect().top < 160) cur = i; });
    $$('.sh-oh', box).forEach((b, i) => b.classList.toggle('on', i === cur));
  }
  document.addEventListener('scroll', () => requestAnimationFrame(markActive), { capture: true, passive: true });

  // ------------------------------------------------------------- rendu
  let sideSig = '';
  function render(force) {
    if (!document.body) return;
    if (!isOn('side')) {
      $('#sh-side')?.remove(); $('#sh-page')?.remove(); sideSig = '';
      page = null;
      return;
    }
    if (!$('[data-testid="platform-layout"]')) return; // pas une page de l espace de travail
    const d = data();
    const sig = JSON.stringify([page, d.lab, d.favourites.map(r => r.title + r.status + r.current), d.recent.map(r => r.title + r.status + r.current),
      d.mine.map(r => r.title + r.status), d.changes.map(c => c.hash + c.open + c.title + c.day + c.time), d.views.map(v => v.title + v.depth + v.open),
      d.changeset && [d.changeset.hash, d.changeset.name, d.changeset.rows.map(r => r.title + r.current)], !!d.newBtn, showEmpty, workFilter, workType, lab, labOpen, pickFor, allViewsOpen, appSections, appActive, isWorkspaceRoot(), recordSection(), location.pathname]);
    if (!force && sig === sideSig && $('#sh-side')) return;
    sideSig = sig;
    $('#sh-side')?.remove();
    document.body.append(buildSide(d));
    const old = $('#sh-page');
    if (page) {
      const pg = h('main', { id: 'sh-page', class: 'sh', 'aria-label': page }, page === 'home' ? buildHome(d) : page === 'work' ? buildWork(d) : page === 'pick' ? buildPick(d) : buildPub(d));
      const top = old ? old.scrollTop : 0;
      if (old) old.replaceWith(pg); else document.body.append(pg);
      pg.scrollTop = top;
    } else if (old) old.remove();
    root.classList.toggle('sh-page-open', !!page);
  }

  // ------------------------------------------- textes courts (v0.1, inchange)
  const original = new WeakMap();
  const ZONE = / (?:[A-Z][a-z]+ ){1,3}(?:Daylight|Standard|Summer) Time\b/;
  const changed = new Set();
  function setText(node, text) {
    if (!original.has(node)) original.set(node, node.nodeValue);
    node.nodeValue = text;
    changed.add(node);
  }
  function restoreTexts() {
    for (const node of changed) if (original.has(node)) node.nodeValue = original.get(node);
    changed.clear();
  }
  function shortenTexts(scope) {
    const walker = document.createTreeWalker(scope, NodeFilter.SHOW_ELEMENT | NodeFilter.SHOW_TEXT, {
      acceptNode: n => n.nodeType === 1
        ? (n.isContentEditable || n.classList.contains('sh') || n.matches('[data-testid="native-document-editor"], input, textarea') ? NodeFilter.FILTER_REJECT : NodeFilter.FILTER_SKIP)
        : NodeFilter.FILTER_ACCEPT,
    });
    for (let n = walker.nextNode(); n; n = walker.nextNode()) {
      const v = n.nodeValue;
      if (!ZONE.test(v)) continue;
      const el = n.parentElement;
      if (el && !el.title) el.title = v.trim();
      setText(n, v.replace(ZONE, ''));
    }
    for (const t of $$('[data-nav-pane="changes"] [data-nav-panel-title]', scope)) {
      const n = t.firstChild;
      if (n && n.nodeType === 3 && / #\d+$/.test(n.nodeValue)) setText(n, n.nodeValue.replace(/ #\d+$/, ''));
    }
  }

  // ------------------------------------------- document propre (v0.1)
  const RULE = /^[\s\-‐-―_=~*·•─━]{6,}$/;
  function markRules(scope) {
    for (const b of $$('[data-native-block-type="p"]', scope)) {
      const p = $('[data-document-paragraph]', b);
      const isRule = !!p && RULE.test(p.textContent) && /\S/.test(p.textContent);
      if (isRule) b.setAttribute('data-sh-rule', '');
      else if (b.hasAttribute('data-sh-rule')) b.removeAttribute('data-sh-rule');
    }
  }
  document.addEventListener('selectionchange', () => {
    const sel = document.getSelection();
    const node = sel && sel.anchorNode;
    const el = node && (node.nodeType === 1 ? node : node.parentElement);
    const block = el && el.closest('[data-sh-rule]');
    for (const b of $$('[data-sh-caret]')) if (b !== block) b.removeAttribute('data-sh-caret');
    if (block) block.setAttribute('data-sh-caret', '');
  });

  // ------------------------------------------- listes plus calmes (v0.1)
  const PLACEHOLDER = /^(untitled|test\b|tests?\s*[-_:])/i;
  function markFaded(scope) {
    for (const tag of $$('[data-nav-pane="changes"] [data-seal-compound-tag]', scope)) {
      const left = $('[data-seal-compound-tag-left]', tag);
      const right = $('[data-seal-compound-tag-right]', tag);
      const row = tag.closest('[data-list-item]');
      if (!left || !right || !row) continue;
      row.toggleAttribute('data-sh-faded', /open/i.test(left.textContent) && right.textContent.trim() === '0');
    }
    for (const t of $$('[data-nav-pane="entities"] [data-nav-panel-title]', scope)) {
      const row = t.closest('[data-list-item]');
      if (row) row.toggleAttribute('data-sh-faded', PLACEHOLDER.test(t.textContent.trim()));
    }
  }
  function clearMarks() {
    for (const el of $$('[data-sh-rule]')) el.removeAttribute('data-sh-rule');
    for (const el of $$('[data-sh-faded]')) el.removeAttribute('data-sh-faded');
  }

  // ------------------------------------------- Info ferme a l arrivee (v0.1)
  let closeUntil = 0;
  function closeInfoOnArrival() {
    if (!isOn('info') || Date.now() > closeUntil) return;
    const panel = $('[data-side-panel="open"]');
    const btn = panel && $('button[aria-label="Close panel"]', panel);
    if (btn) { closeUntil = 0; btn.click(); }
  }

  // ------------------------------------------------------------- boucle
  let timer = 0;
  let lastRun = 0;
  function run() {
    timer = 0;
    lastRun = Date.now();
    if (!document.body) return;
    observer.disconnect();
    try {
      onRoute();
      if (isOn('dates')) shortenTexts(document.body);
      if (isOn('doc')) markRules(document.body);
      if (isOn('quiet')) markFaded(document.body);
      closeInfoOnArrival();
      if (isOn('side')) readApp();
      else { const doc = appDoc(); const hid = doc && $('[data-sh-hidden]', doc); if (hid) hid.removeAttribute('data-sh-hidden'); }
      // Le labo a sa propre page d accueil : on la laisse a l arrivee au lieu de Today.
      if (page === 'home' && autoHome && $('iframe[title="Custom Content"]')) { page = null; autoHome = false; }
      render(false);
      if (isOn('props')) { renderProps(); renderOutline(); }
      else { $('#sh-props')?.remove(); $('#sh-outline')?.remove(); root.classList.remove('sh-has-outline'); }
    } catch (e) {
      console.warn('[Seal Helper]', e);
    }
    observer.observe(document.body, { childList: true, subtree: true, characterData: true, attributes: true, attributeFilter: ['data-side-panel', 'data-highlighted'] });
  }
  function schedule() {
    if (timer) return;
    timer = setTimeout(run, Math.max(60, 350 - (Date.now() - lastRun)));
  }
  const observer = new MutationObserver(muts => {
    // Nos propres elements ne relancent rien.
    if (muts.every(m => m.target.closest && m.target.closest('.sh'))) return;
    schedule();
  });
  window.addEventListener('resize', schedule);
  window.addEventListener('popstate', e => {
    const st = e.state && e.state.sh;
    page = st || null;
    if (st) lastRoute = location.pathname;
    sideSig = '';
    schedule();
  });
  // Alt + fleches, comme dans un navigateur, sauf en ecrivant.
  document.addEventListener('keydown', e => {
    if (!isOn('side') || !e.altKey || e.ctrlKey || e.metaKey) return;
    if (e.target && (e.target.isContentEditable || /^(INPUT|TEXTAREA|SELECT)$/.test(e.target.tagName))) return;
    if (e.key === 'ArrowLeft') { e.preventDefault(); history.back(); }
    if (e.key === 'ArrowRight') { e.preventDefault(); history.forward(); }
  }, true);

  // Raccourcis : Ctrl/Cmd K = recherche de Seal, Echap = fermer nos pages.
  document.addEventListener('keydown', e => {
    if (!isOn('side')) return;
    const inText = e.target && (e.target.isContentEditable || /^(INPUT|TEXTAREA|SELECT)$/.test(e.target.tagName));
    if ((e.ctrlKey || e.metaKey) && !e.shiftKey && e.key.toLowerCase() === 'k' && !inText) {
      const q = $('[data-testid="nav-panel-query-button"]');
      if (q) { e.preventDefault(); press(q); }
    } else if (e.key === 'Escape' && page && !inText) {
      page = null; render(true);
    }
  }, true);

  function applyClasses() {
    for (const k of CLASSES) root.classList.toggle('sh-' + k, !!isOn(k));
  }
  function refresh() {
    applyClasses();
    if (!isOn('dates')) restoreTexts();
    if (!opts.on) clearMarks();
    if (!isOn('home') && page === 'home') page = null;
    lastRoute = '';
    sideSig = '';
    propsSig = '';
    outlineSig = '';
    schedule();
  }
  function save(patch) {
    opts = { ...opts, ...patch };
    chrome.storage.sync.set({ [KEY]: opts });
    refresh();
  }

  try { chrome.storage.local.get(APP_KEY, r => { if (Array.isArray(r[APP_KEY])) { appSections = r[APP_KEY]; schedule(); } }); } catch (e) {}
  chrome.storage.sync.get([KEY, LAB_KEY], r => {
    opts = { ...DEFAULTS, ...(r[KEY] || {}) };
    if (Array.isArray(r[LAB_KEY]) && r[LAB_KEY].length) lab = r[LAB_KEY];
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
