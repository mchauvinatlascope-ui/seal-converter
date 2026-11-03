// Seal Helper 0.7
// Ne fait que changer l affichage dans ce navigateur : n ecrit jamais dans Seal,
// n envoie rien, ne touche pas au texte d un document.
// La nouvelle barre et les pages Home / My work / To publish relisent les listes
// que Seal a deja chargees (volets Views, Entities, Changes) et, au clic, cliquent
// pour toi sur la ligne Seal d origine : la navigation reste celle de Seal.
// Si un repere de Seal disparait, la partie concernee ne s affiche pas et Seal
// reste comme d habitude.
(() => {
  const KEY = 'sealHelper';
  const DEFAULTS = { on: true, side: true, home: true, appmenu: false, props: true, doc: true, dates: true, info: true, quiet: true, slot: true, readnb: true };
  const CLASSES = ['side', 'props', 'doc', 'dates', 'info', 'quiet', 'slot'];
  const root = document.documentElement;
  const isMac = /Mac/.test(navigator.platform);
  let opts = { ...DEFAULTS };
  const isOn = k => opts.on && opts[k];
  const VERSION = '1.5.9';

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
    tpl: '<svg viewBox="0 0 16 16"><path d="M3 3h10v10H3z" stroke-dasharray="2 1.6"/><path d="M5.5 6h5 M5.5 8.5h5 M5.5 11h3"/></svg>',
    check: '<svg viewBox="0 0 16 16"><path d="m3.5 8.5 3 3 6-7"/></svg>',
    warn: '<svg viewBox="0 0 16 16"><path d="M8 2.5 14 13H2z M8 6.5v3 M8 11.5h.01"/></svg>',
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
      const lab = txt($('[data-testid="system-name"]'));
      // « Labo — receive lot: … » : le nom du labo est deja partout, on l enleve a l affichage.
      const title = txt($('[data-nav-panel-title]', content)).replace(/ #\d+$/, '')
        .replace(lab ? new RegExp('^' + lab.replace(/[.*+?^${}()|[\]\\]/g, '\\$&') + '\\s*[—–-]\\s*', 'i') : /^$/, '')
        .replace(/^\p{Ll}/u, c => c.toUpperCase());
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
        current: item.hasAttribute('data-highlighted'),
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
    if (!views.length && tries < 4) { panesTried = 0; ensurePanes(); setTimeout(() => openShortcut(sc, tries + 1), 700); return; }
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

  // Seal ne remplit les listes Views et Changes qu une fois leur onglet ouvert : on les
  // ouvre une fois pour toi dans la colonne Seal cachee, puis on revient a l onglet d avant.
  let panesTried = 0;
  function ensurePanes() {
    if (Date.now() - panesTried < 15000) return;
    const empty = name => { const pane = $(`[data-nav-pane="${name}"]`); return pane && !pane.children.length; };
    const tabs = [empty('views') && $('[data-testid="nav-panel-tab-views"]'), empty('changes') && $('[data-testid="nav-panel-tab-changes"]')].filter(Boolean);
    if (!tabs.length) return;
    panesTried = Date.now();
    const back = $('[data-testid="nav-panel-tabs"] [aria-selected="true"]');
    let i = 0;
    const step = () => {
      if (i < tabs.length) { press(tabs[i++]); setTimeout(step, 300); return; }
      if (back) press(back);
      sideSig = '';
      setTimeout(schedule, 300);
    };
    step();
  }

  // Les Views rangees dans des groupes replies sont invisibles : on deplie les groupes une fois (volet cache).
  let expandRounds = 0;
  function expandViews() {
    if (expandRounds >= 3) return;
    const views = readViews();
    if (!views || !views.length) return;
    const closed = views.filter(v => v.group && !v.open);
    if (!closed.length) { expandRounds = 3; return; }
    expandRounds++;
    closed.forEach((v, i) => setTimeout(() => press(v.el), i * 120));
    setTimeout(() => { sideSig = ''; schedule(); }, closed.length * 120 + 400);
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

  // L appli du cahier n est jamais lue pendant son demarrage : on attend que son cadre ait fini
  // de charger (evenement load, sans y toucher), puis encore un peu. Avant, on fait comme si on ne la voyait pas.
  const hooked = new WeakSet();
  const frameReady = new WeakMap(); // cadre -> { src, at } du dernier chargement fini
  const hookedAt = new WeakMap();
  let frameLoads = []; // instants des chargements du cadre de l appli
  const READY_DELAY = 1500;
  function hookFrame() {
    const f = $('iframe[title="Custom Content"]');
    if (f && !hooked.has(f)) {
      hooked.add(f); hookedAt.set(f, Date.now());
      f.addEventListener('load', () => {
        frameReady.set(f, { src: f.getAttribute('src'), at: Date.now() });
        frameLoads.push(Date.now()); frameLoads = frameLoads.slice(-20);
        setTimeout(schedule, READY_DELAY + 50);
      });
    }
    return f;
  }
  function frameState(f) {
    if (!f) return 'none';
    const r = frameReady.get(f);
    if (r && r.src === f.getAttribute('src')) return Date.now() - r.at < READY_DELAY ? 'settling' : 'ready';
    // Load manque (cadre deja charge avant nous) : le navigateur note la fin du chargement du cadre.
    const src = f.getAttribute('src');
    if (src) { try { const url = new URL(src, location.href).href; if (performance.getEntriesByType('resource').some(e => e.initiatorType === 'iframe' && e.name === url && e.responseEnd > 0)) { frameReady.set(f, { src, at: Date.now() - READY_DELAY }); return 'ready'; } } catch (e) {} }
    return Date.now() - (hookedAt.get(f) || Date.now()) > 20000 ? 'late' : 'booting';
  }
  function appDoc() {
    const f = hookFrame();
    const st = frameState(f);
    if (st !== 'ready' && st !== 'late') return null;
    try { return f && f.contentDocument && f.contentDocument.body ? f.contentDocument : null; } catch (e) { return null; }
  }

  // Le menu = le plus petit bloc qui contient « Experiments » (ou « Protocols ») et au moins 4 entrees.
  // Le menu de l appli : on part des textes visibles (pas des balises, inconnues).
  // Libelles connus d un cahier de labo ; il en faut au moins 3 pour reconnaitre le menu.
  const GUESS = /^(overview|home|dashboard|projects?|experiments?|manips?|protocols?|sops?|methods?|inventory|stock|reagents?|samples?|calculators?( & files)?|files|how to.*|lab tree|.*faqs?|give feedback|feedback|equipment|tasks?)$/i;
  function leafTexts(scope) {
    const out = [];
    const w = scope.ownerDocument.createTreeWalker(scope, NodeFilter.SHOW_TEXT);
    for (let n = w.nextNode(); n; n = w.nextNode()) {
      const t = n.nodeValue.replace(/\s+/g, ' ').trim();
      const el = n.parentElement;
      if (!t || t.length > 32 || !/\p{L}{2}/u.test(t) || !el || /^(SCRIPT|STYLE|TITLE|OPTION)$/.test(el.tagName)) continue;
      if (!el.getClientRects().length && !(hiddenEl(scope.ownerDocument) && hiddenEl(scope.ownerDocument).contains(el))) continue;
      out.push({ t, el });
    }
    return out;
  }
  function lca(a, b) { while (a && !a.contains(b)) a = a.parentElement; return a; }
  function clickTarget(el, box) {
    // L element qui porte le clic : le plus proche ancetre cliquable dans le menu, sinon le texte lui-meme.
    for (let x = el; x && x !== box.parentElement; x = x.parentElement) {
      if (x.matches('a,button,[role="button"],[role="tab"],[role="link"],[role="menuitem"],[onclick]')) return x;
      if (x !== el && getComputedStyle(x).cursor === 'pointer' && x.parentElement && getComputedStyle(x.parentElement).cursor !== 'pointer') return x;
    }
    return el;
  }
  // Libelle d un bouton du menu sans son pictogramme.
  const railLabel = b => [...b.childNodes].filter(n => n.nodeType === 3 || !n.matches('.nav-icon')).map(n => n.textContent).join('').replace(/\s+/g, ' ').trim();
  function appNav(doc) {
    const rail = $('nav[aria-label="Lab navigation"]', doc);
    if (rail) {
      const byLabel = new Map();
      const meta = new Map();
      for (const b of $$('.rail-button, button, a', rail)) {
        const l = railLabel(b);
        if (!l || byLabel.has(l)) continue;
        byLabel.set(l, b);
        meta.set(l, { view: b.getAttribute('data-view') || '', external: b.tagName === 'A' && b.target === '_blank' });
      }
      const on = $('[aria-current="page"]', rail);
      return { byLabel, meta, active: on ? railLabel(on) : '', box: rail };
    }
    const all = leafTexts(doc.body);
    const hits = [];
    const seen = new Set();
    for (const x of all) if (GUESS.test(x.t) && !seen.has(x.t.toLowerCase())) { seen.add(x.t.toLowerCase()); hits.push(x); }
    if (hits.length < 3 || !hits.some(x => /^(experiments?|manips?|protocols?|projects?)$/i.test(x.t))) return null;
    let box = hits.slice(1).reduce((a, x) => lca(a, x.el), hits[0].el);
    if (!box) return null;
    const lab = (txt($('[data-testid="system-name"]')) + ' lab').toLowerCase();
    const byLabel = new Map();
    for (const x of leafTexts(box)) {
      if (byLabel.has(x.t) || x.t.toLowerCase() === lab || /·|\bseal\b.*\blinterman\b|^electronic lab notebook$/i.test(x.t) || /^\d+$/.test(x.t)) continue;
      const target = clickTarget(x.el, box);
      if (target !== x.el || GUESS.test(x.t) || getComputedStyle(x.el).cursor === 'pointer') byLabel.set(x.t, target);
    }
    if (byLabel.size < 3) return null;
    // Section active : celle dont l allure (fond, couleur, graisse) differe des autres.
    const sig = el => { const c = getComputedStyle(el); return c.backgroundColor + c.color + c.fontWeight; };
    const sigs = [...byLabel].map(([l, e]) => [l, sig(e), e]);
    const count = new Map();
    for (const [, g] of sigs) count.set(g, (count.get(g) || 0) + 1);
    const marked = sigs.find(([, , e]) => [e, e.parentElement].some(x => x && (x.getAttribute('aria-current') && x.getAttribute('aria-current') !== 'false' || x.getAttribute('aria-selected') === 'true')));
    const odd = sigs.filter(([, g]) => count.get(g) === 1);
    const active = marked ? marked[0] : odd.length === 1 && sigs.length > 3 ? odd[0][0] : '';
    return { byLabel, active, box };
  }

  // Les boutons « + New … » de l appli : on les liste pour la barre et Today.
  const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
  const CREATE_LABEL = { experiment: 'New experiment', project: 'New project', protocol: 'New protocol', panel: 'New antibody panel', general: 'New inventory item', antibodies: 'New antibody' };
  const CREATE_ICON = { experiment: 'flask', project: 'folder', protocol: 'proto', panel: 'view', general: 'stock', antibodies: 'stock' };
  const CREATE_HINT = { experiment: 'Pick a project, give it a title', project: 'Groups the experiments of one question', protocol: 'A copy of the master protocol to fill in', panel: 'Markers, fluorochromes, clones', general: 'Reagent, kit or consumable', antibodies: 'Clone, lot and dilution' };
  const CREATE_SECTION = { experiment: /experiment|manip/i, project: /project/i, protocol: /protocol/i, panel: /protocol|panel/i, general: /inventor/i, antibodies: /inventor/i };
  let appCreates = []; // [{ key, label }]
  let appData = null;  // ce que l accueil du labo affiche : compteurs, recents, projets
  const APPDATA_KEY = 'sealHelperAppData';

  function readCreates(doc) {
    const seen = new Map();
    for (const b of $$('[data-create]', doc)) {
      const key = b.getAttribute('data-create');
      if (!seen.has(key)) seen.set(key, { key, label: CREATE_LABEL[key] || txt(b).replace(/^\+\s*/, '') });
    }
    const order = ['experiment', 'project', 'protocol', 'panel', 'general', 'antibodies'];
    return [...seen.values()].sort((x, y) => (order.indexOf(x.key) + 1 || 99) - (order.indexOf(y.key) + 1 || 99));
  }

  function readAppData(doc) {
    const tagOf = el => { const t = $('.tag', el); return t ? txt(t) : ''; };
    const rows = (h2re) => {
      const panel = $$('.panel', doc).find(pn => h2re.test(txt($('h2', pn))));
      return panel ? $$('.item-row[data-record], .item-row[data-native]', panel).map(b => ({
        id: b.getAttribute('data-record') || '', native: b.getAttribute('data-native') || '',
        title: txt($('strong', b)), sub: txt($('small', b)), status: tagOf(b),
      })) : [];
    };
    const hero = $('.hero', doc);
    const heroBtn = hero && $('[data-record]', hero);
    return {
      at: Date.now(),
      user: txt($('.user-name', doc)),
      metrics: $$('.metrics button[data-view]', doc).map(b => ({ view: b.getAttribute('data-view'), n: parseInt(txt($('b', b)), 10) || 0, label: txt($('span', b)) })),
      hero: hero && heroBtn ? { id: heroBtn.getAttribute('data-record'), title: txt($('h2', hero)), sub: txt($('.muted', hero)), status: tagOf(hero) } : null,
      experiments: rows(/recent experiments/i),
      projects: rows(/recent projects/i),
      protocols: rows(/^protocols$/i),
      cards: $$('.project-card[data-record]', doc).map(c => ({ id: c.getAttribute('data-record'), title: txt($('h3', c)), sub: txt($('p', c)), status: tagOf(c),
        n: parseInt(txt($('.project-stats b', c)), 10) || 0, updated: (txt($('.project-stats span', c)) || '').replace(/^updated\s*/i, '') })),
    };
  }

  // Tableau d une section de l appli (Experiments, Projects, Protocols) : colonnes reconnues par leur en-tete.
  const COL = { title: /^(experiment|project|protocol|name|title)$/i, id: /^id$/i, project: /^project$/i, status: /^status$/i, folder: /^folder$/i, updated: /^(updated|modified|last edit)$/i, owner: /^(owner|by)$/i };
  const TABLES_KEY = 'sealHelperAppTables';
  let appTables = {}; // { 'Experiments': { at, rows: [{ title, id, project, status, updated, record }] } }
  function readAppTable(doc, section) {
    if (!section) return null;
    try { return readAppTableUnsafe(doc, section); } catch (e) { lastError = 'table: ' + (e && e.message); return null; }
  }
  function readAppTableUnsafe(doc, section) {
    for (const table of $$('table', doc)) {
      const heads = $$('thead th, thead td, tr:first-child th', table).map(th => txt(th));
      if (heads.length < 2) continue;
      const col = {};
      for (const [k, re] of Object.entries(COL)) { const i = heads.findIndex(x => re.test(x)); if (i >= 0 && col[k] === undefined) col[k] = i; }
      if (col.title === undefined && col.id === undefined) continue;
      const rows = $$('tbody tr', table).filter(tr => tr.children.length >= 2).map(tr => {
        const cells = [...tr.children].map(td => txt(td));
        const cell = k => (col[k] !== undefined ? cells[col[k]] || '' : '');
        const cellEl = tr.children[col.title !== undefined ? col.title : 0] || tr.children[0];
        const link = cellEl ? $('a[href], [data-record], [data-native], button', cellEl) : null;
        const href = link && link.getAttribute('href') || '';
        const m = href.match(/[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/i);
        return { title: cell('title') || cell('id'), id: cell('id'), project: cell('project'), status: cell('status'), updated: cell('updated'), owner: cell('owner'),
          record: (link && (link.getAttribute('data-record') || link.getAttribute('data-native'))) || (m ? m[0] : ''), href };
      }).filter(r => r.title);
      if (rows.length) return { at: Date.now(), rows };
    }
    return null;
  }
  function openTableRow(section, r) {
    if (UUID.test(r.record || '')) { openRecord({ id: r.record, title: r.title }); return; }
    // Pas d identifiant : on ouvre la section puis on clique la ligne par son titre.
    appAct(doc => { const nav = appNav(doc); if (!nav || nav.active !== section) return null; return $$('table tbody tr', doc).map(tr => $('a[href], [data-record], button', tr)).find(a => a && txt(a) === r.title) || null; }, null, r.title, { section });
  }

  // Clique pour toi dans l appli (bouton + New…, fiche, section), en ouvrant l accueil s il le faut.
  // Si on doit recharger la page pour revenir au cahier, on garde l action demandee et on la rejoue.
  const PENDING = 'sh-pending';
  // Voile uni sur la zone de travail le temps qu une action se joue dans l appli : on ne voit
  // ni son accueil ni son changement de vue, seulement le resultat.
  let veilTimer = 0;
  function veil(on, ms = 6000) {
    clearTimeout(veilTimer);
    let v = $('#sh-veil');
    if (!on) { if (v) v.remove(); return; }
    if (!v) { v = h('div', { id: 'sh-veil', class: 'sh', 'aria-hidden': 'true' }); root.append(v); }
    veilTimer = setTimeout(() => veil(false), ms);
  }
  // Leve le voile quand l appli a fini : vue active attendue, fenetre ouverte ou fiche partie.
  // L appli affiche son menu avant d etre prete a reagir : tant que rien ne bouge, on reclique (5 fois au plus).
  function settle(resume, from, find) {
    const until = Date.now() + 4000;
    let presses = 1, lastPress = Date.now();
    const loadsBefore = frameLoads.length;
    const done = () => {
      const doc = appDoc();
      if (!doc) return location.pathname !== from;
      if (resume && resume.section) { const nav = appNav(doc); return !!nav && nav.active === resume.section; }
      if (resume && resume.create) return !!$('[role="dialog"], dialog[open], [class*="modal"], [class*="dialog"], [class*="overlay"]', doc);
      return location.pathname !== from;
    };
    const tick = () => {
      if (done() || Date.now() > until) { setTimeout(() => veil(false), 150); render(true); return; }
      if (find && presses < 4 && Date.now() - lastPress > 500 && frameLoads.length === loadsBefore) {
        const doc = appDoc(); const el = doc && find(doc);
        if (el) { pressIn(el); presses++; lastPress = Date.now(); }
      }
      setTimeout(tick, 60);
    };
    tick();
  }
  function appAct(find, after, what, resume) {
    page = null;
    guideOpened = true;
    clearTimeout(appWait);
    const from = location.pathname;
    let homeTried = 0, pressedAt = 0;
    const tryIt = () => {
      const doc = appDoc();
      const el = doc && find(doc);
      if (el) { pressIn(el); pressedAt = Date.now(); if (after) after(); hideToast(); render(true); settle(resume, from, find); return true; }
      // Le bouton n est pas dans la vue courante de l appli : on repasse par son accueil, une fois.
      if (doc && !homeTried && Date.now() - started > 400) { const nav = appNav(doc); const first = nav && nav.byLabel.values().next().value; if (first) { homeTried = 1; pressIn(first); } }
      return false;
    };
    const started = Date.now();
    veil(true);
    if (atNotebook() && tryIt()) return;
    if (what) toast(`Opening ${what}…`);
    if (!atNotebook()) {
      const d = data();
      const home = [...d.favourites, ...d.recent].find(r => r.type && r.type[0] === 'Page');
      const header = $('[data-testid="entity-top-navbar"]');
      const onHome = home && header && txt($('[data-title-text]', header)) === home.title;
      if (onHome) { /* deja sur la page du cahier, son menu n est pas encore la : la boucle attend */ }
      else { loadNotebook(resume); return; }
    }
    render(true);
    const until = Date.now() + 12000;
    const loop = () => {
      if (tryIt()) return;
      if (Date.now() < until) appWait = setTimeout(loop, 120);
      else { veil(false); if (what) toast(`Couldn’t find “${what}” in the notebook. Open it from the notebook page.`, 'warn', 6000); }
    };
    appWait = setTimeout(loop, 120);
  }
  // Dernier choix du menu New : il remonte en tete de son groupe la fois suivante.
  let lastNew = (() => { try { return JSON.parse(localStorage.getItem('sh-lastnew') || 'null'); } catch (e) { return null; } })();
  function rememberNew(kind, key) { lastNew = { kind, key }; try { localStorage.setItem('sh-lastnew', JSON.stringify(lastNew)); } catch (e) {} }
  const firstLast = (list, kind, keyOf) => { const i = lastNew && lastNew.kind === kind ? list.findIndex(x => keyOf(x) === lastNew.key) : -1; return i > 0 ? [list[i], ...list.slice(0, i), ...list.slice(i + 1)] : list; };
  const openCreate = key => { rememberNew('create', key); appAct(doc => $(`[data-create="${key}"]`, doc), null, CREATE_LABEL[key] || 'the notebook', { create: key }); };
  const openRecord = r => {
    // Un identifiant Seal : la fiche s ouvre par son adresse, sans repasser par l accueil du cahier.
    const id = UUID.test(r.id || '') ? r.id : UUID.test(r.native || '') ? r.native : '';
    const base = location.pathname.match(/^\/o\/[^/]+\/s\/[^/]+/);
    if (id && base) { page = null; guideOpened = true; veil(true, 4000); toast(`Opening ${r.title}…`); location.assign(base[0] + '/' + id); return; }
    appAct(doc => (r.id ? $(`[data-record="${r.id}"]`, doc) : $(`[data-native="${r.native}"]`, doc)), null, r.title, { record: r.id, native: r.native, title: r.title });
  };
  let resumed = false;
  function resumePending() {
    if (resumed || !appDoc()) return;
    resumed = true;
    let p = null;
    try { p = JSON.parse(sessionStorage.getItem(PENDING) || 'null'); sessionStorage.removeItem(PENDING); } catch (e) {}
    if (!p || Date.now() - p.at > 60000) return;
    if (p.create) openCreate(p.create);
    else if (p.record || p.native) openRecord({ id: p.record, native: p.native, title: p.title });
    else if (p.section) openAppSection(p.section);
  }

  // Petit mot en bas de l ecran : ce qu on est en train d ouvrir, ou pourquoi rien ne vient.
  let toastTimer = 0;
  function toast(msg, kind = 'info', ms = 4000) {
    if (!document.body) return;
    let el = $('#sh-toast');
    if (!el) { el = h('div', { id: 'sh-toast', class: 'sh', role: 'status', 'aria-live': 'polite' }); root.append(el); }
    el.replaceChildren(icon(kind === 'warn' ? 'warn' : kind === 'ok' ? 'check' : 'today'), h('span', {}, msg));
    el.className = 'sh show ' + kind;
    clearTimeout(toastTimer);
    toastTimer = setTimeout(hideToast, ms);
  }
  function hideToast() { const el = $('#sh-toast'); if (el) el.classList.remove('show'); }

  // « From template » : Seal liste les modeles dans le bouton « + New instance » de la View
  // d une categorie (Protocols, Experiments, Projects). On ouvre la View, puis ce bouton.
  const TEMPLATE_VIEW = { experiment: /experiment/i, protocol: /protocol/i, project: /project/i };
  function templateView(key, views) {
    const re = TEMPLATE_VIEW[key];
    if (!re) return null;
    const hits = views.filter(v => re.test(v.title) && !v.group);
    return hits.find(v => !/template|archive/i.test(v.title)) || hits[0] || null;
  }
  const NEW_INSTANCE = /^\+?\s*new (instance|record|entity|item)\b/i;
  function openFromTemplate(key, tries = 0) {
    if (!tries) rememberNew('tpl', key);
    const views = readViews() || [];
    if (!views.length && tries < 4) { panesTried = 0; ensurePanes(); setTimeout(() => openFromTemplate(key, tries + 1), 700); return; }
    const v = templateView(key, views);
    if (!v) {
      const nb = $('[data-testid="navbar-new-entity-button"]');
      if (nb) { page = null; press(nb); toast(`Choose the ${key} template in Seal’s list.`, 'ok', 5000); render(true); }
      else toast(`Seal has no “${key}s” view yet, so there is no template list to open.`, 'warn', 6000);
      return;
    }
    toast(`Opening ${v.title}: pick a template…`);
    go(v.el);
    const until = Date.now() + 8000;
    const loop = () => {
      const scope = $('[data-testid="platform-layout"]') || document.body;
      const btn = $$('button', scope).find(b => !b.closest('.sh') && !b.closest('[data-testid="nav-panel"]') && NEW_INSTANCE.test(txt(b)));
      if (btn) { press(btn); toast('Choose a template in the list.', 'ok', 3500); return; }
      if (Date.now() < until) setTimeout(loop, 250);
      else toast('Use “+ New instance” at the top of this view to pick a template.', 'warn', 6000);
    };
    setTimeout(loop, 500);
  }

  let lastRead = 0;
  function readApp() {
    // Une lecture par seconde au plus : l appli n est jamais sollicitee en continu.
    if (Date.now() - lastRead < 1000) { setTimeout(schedule, 1050); return; }
    lastRead = Date.now();
    const doc = appDoc();
    const nav = doc && appNav(doc);
    if (!nav) { appActive = ''; return; }
    appActive = nav.active;
    const creates = readCreates(doc);
    if (creates.length && JSON.stringify(creates) !== JSON.stringify(appCreates)) { appCreates = creates; try { chrome.storage.local.set({ sealHelperAppCreates: creates }); } catch (e) {} }
    const prevT = appTables[nav.active];
    if (!prevT || Date.now() - prevT.at > 5000) {
      const tbl = readAppTable(doc, nav.active);
      if (tbl && (!prevT || JSON.stringify(prevT.rows) !== JSON.stringify(tbl.rows))) {
        appTables = { ...appTables, [nav.active]: tbl };
        try { chrome.storage.local.set({ [TABLES_KEY]: appTables }); } catch (e) {}
      } else if (tbl && prevT) prevT.at = Date.now();
    }
    const ad = readAppData(doc);
    if (ad.metrics.length || ad.experiments.length) {
      const sig = JSON.stringify({ ...ad, at: 0 });
      if (!appData || JSON.stringify({ ...appData, at: 0 }) !== sig) { appData = ad; try { chrome.storage.local.set({ [APPDATA_KEY]: ad }); } catch (e) {} }
    }
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
  // On ne touche a rien dans la page de l appli : son menu reste entier et mesurable. C est le CADRE
  // (l iframe, dans la page Seal) qu on decale vers la gauche de la largeur du menu, qui sort ainsi de l ecran.
  const hiddenOf = new WeakMap(); // document de l appli -> { el, w }
  const hiddenEl = doc => { const st = hiddenOf.get(doc); return st && st.el && st.el.isConnected ? st.el : null; };
  const HIDE_WAYS = ['shift'];
  const WAY_KEY = 'sealHelperHideWay';
  let learnedWay = '';
  const hideWay = () => 'shift';
  function appFrame() { return $('iframe[title="Custom Content"]'); }
  function hideAppMenu(doc, box) {
    const want = isOn('side') && isOn('appmenu');
    const f = appFrame();
    if (!f) return;
    if (!want) { unshiftFrame(f); hiddenOf.delete(doc); return; }
    const rail = box.closest('aside.rail, aside') || box;
    const r = rail.getBoundingClientRect();
    const W = doc.documentElement.clientWidth;
    const w = Math.round(r.width);
    // Seulement une colonne a gauche, etroite ; sinon on laisse le menu tel quel.
    if (!w || r.left > 4 || w > W * 0.45 || r.height < doc.documentElement.clientHeight * 0.4) { unshiftFrame(f); hiddenOf.delete(doc); return; }
    if (f.dataset.shShift !== String(w)) {
      f.style.marginLeft = -w + 'px';
      f.style.width = 'calc(100% + ' + w + 'px)';
      f.style.maxWidth = 'none';
      f.dataset.shShift = String(w);
      const wrap = f.parentElement; if (wrap) wrap.style.overflow = 'hidden';
    }
    hiddenOf.set(doc, { el: rail, w });
  }
  function unshiftFrame(f) {
    if (!f || !f.dataset.shShift) return;
    f.style.marginLeft = ''; f.style.width = ''; f.style.maxWidth = ''; delete f.dataset.shShift;
    const wrap = f.parentElement; if (wrap) wrap.style.overflow = '';
  }
  const selOf = el => el.tagName.toLowerCase() + [...el.classList].filter(c => /^[\w-]+$/.test(c)).map(c => '.' + c).join('');
  function ensureHideStyle() {}
  function dropHideStyle() {}
  // Le contenu du cahier (hors menu) occupe-t-il bien l ecran du cadre ?
  function contentVisible(doc) {
    const hid = hiddenEl(doc);
    const W = doc.documentElement.clientWidth, H = doc.documentElement.clientHeight;
    if (!W || !H) return true;
    // Elements porteurs de texte : ils doivent etre dans la largeur du cadre (la page peut
    // defiler en hauteur, donc ce qui est sous la ligne de flottaison compte comme visible),
    // et le debut du contenu doit etre a l ecran.
    let total = 0, across = 0, n = 0, firstTop = null;
    const walk = el => {
      if (!el || el === hid || n++ > 1500) return;
      if ([...el.childNodes].some(c => c.nodeType === 3 && c.textContent.trim().length > 1)) {
        const r = el.getBoundingClientRect();
        total++;
        if (r.width > 0 && r.height > 0) {
          if (r.right > 0 && r.left < W) across++;
          if (firstTop === null) firstTop = r.top;
        }
      }
      for (const c of el.children) walk(c);
    };
    walk(doc.body);
    if (total < 5) return true;
    return across / total >= 0.3 && firstTop !== null && firstTop < H;
  }
  const badSince = new WeakMap();
  function verifyHide(doc) {
    return;
    const hid = hiddenEl(doc);
    if (!hid || hideWay(doc) === 'plain' || hideWay(doc) === 'none') return;
    if ($('#sh-veil') || doc.body.querySelectorAll('*').length < 30) return; // en transition, ou l appli n a encore rien affiche
    if (contentVisible(doc)) { badSince.delete(doc); return; }
    const t = badSince.get(doc) || Date.now();
    badSince.set(doc, t);
    if (Date.now() - t < 700) { setTimeout(() => { try { verifyHide(doc); } catch (e) {} }, 400); return; }
    const next = HIDE_WAYS[Math.min(HIDE_WAYS.indexOf(hideWay(doc)) + 1, HIDE_WAYS.indexOf('plain'))];
    const st0 = hiddenOf.get(doc); if (st0) st0.way = next;
    learnedWay = next;
    try { chrome.storage.local.set({ [WAY_KEY]: next }); } catch (e) {}
    badSince.delete(doc);
    console.warn('[Seal Helper] notebook content hidden by the menu rule, switching to', next);
    ensureHideStyle(doc, hid);
    setTimeout(() => { try { verifyHide(doc); } catch (e) {} }, 400);
  }
  // Etat de la page pour la fenetre de l extension : structure seulement, jamais de contenu.
  function diagnose() {
    const lines = ['Seal Helper ' + VERSION, 'path ' + location.pathname.replace(/[0-9a-f-]{20,}/g, 'ID'), 'side ' + !!$('#sh-side') + ' page ' + page + ' sections ' + appSections.length,
      'renders last 5 s ' + renderTimes.filter(t => Date.now() - t < 5000).length + ' · last error ' + (lastError || 'none') + ' · tables ' + Object.keys(appTables).join(',')];
    lines.push('frame ' + frameState(appFrame()) + ' · loads ' + frameLoads.length);
    const doc = appDoc();
    if (!doc) { lines.push('no notebook frame read'); return lines.join('\n'); }
    const nav = appNav(doc);
    const hid = hiddenEl(doc);
    lines.push('shift ' + ((appFrame() && appFrame().dataset.shShift) || 'none') + ' rail ' + (hid ? selOf(hid) : 'none') + ' nav ' + (nav ? nav.byLabel.size : 0) + ' active [' + (nav ? nav.active : '') + '] visible ' + contentVisible(doc));
    const now = Date.now();
    lines.push('opts slot ' + isOn('slot') + ' readnb ' + isOn('readnb') + ' home ' + isOn('home') + ' appmenu ' + isOn('appmenu'));
    lines.push('quiet on notebook ' + atNotebook() + ' · panes views ' + paneLoaded('views') + ' changes ' + paneLoaded('changes'));
    lines.push('frame loads last 10 s ' + frameLoads.filter(t => now - t < 10000).length + ' · last 60 s ' + frameLoads.filter(t => now - t < 60000).length + ' · src ' + (appFrame() ? (appFrame().getAttribute('src') || '').replace(/\?.*$/, '?…').replace(/[0-9a-f-]{20,}/g, 'ID').slice(0, 80) : '-'));
    if (nav) { const marks = [...nav.byLabel.values()].slice(0, 3).map(b => [...b.attributes].map(a => a.name).filter(n => /aria-|class|data-/.test(n)).join(',')); lines.push('rail attrs ' + marks.join(' | ')); }
    const rect = el => { const r = el.getBoundingClientRect(); return Math.round(r.left) + ',' + Math.round(r.top) + ' ' + Math.round(r.width) + 'x' + Math.round(r.height); };
    const cs = el => { const c = doc.defaultView.getComputedStyle(el); return c.display + (c.display.includes('grid') ? ' cols[' + c.gridTemplateColumns + '] rows[' + c.gridTemplateRows + ']' : '') + (c.position !== 'static' ? ' ' + c.position : ''); };
    lines.push('frame ' + doc.documentElement.clientWidth + 'x' + doc.documentElement.clientHeight + ' scroll ' + doc.documentElement.scrollWidth + 'x' + doc.documentElement.scrollHeight + ' learned ' + (learnedWay || '-'));
    const dump = (el, depth) => { if (!el || depth > 3) return; lines.push('  '.repeat(depth) + selOf(el) + (el === hid ? ' [HIDDEN]' : '') + ' ' + rect(el) + ' ' + cs(el)); if (el !== hid) for (const c of [...el.children].slice(0, 8)) dump(c, depth + 1); };
    dump(doc.body, 0);
    return lines.join('\n');
  }

  // Type de la fiche ouverte (icone de l en-tete) -> section du cahier qui la contient.
  const KIND = { 'lab-test': /experiment|manip/i, box: /project/i };
  function recordSection() {
    if (atNotebook() || page) return '';
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
    let vt = 0;
    new MutationObserver(() => {
      if (isOn('side') && isOn('appmenu') && !hiddenEl(doc)) { try { const nav = appNav(doc); if (nav) hideAppMenu(doc, nav.box); } catch (e) {} }
      clearTimeout(vt); vt = setTimeout(() => { try { verifyHide(doc); } catch (e) {} }, 300);
      schedule();
    }).observe(doc.body, { childList: true, subtree: true, attributes: true, attributeFilter: ['class', 'aria-current', 'aria-selected'] });
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
    appAct(doc => { const nav = appNav(doc); return nav && nav.byLabel.get(label); }, () => { appActive = label; }, label, { section: label });
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

  const paneLoaded = name => { const pane = $(`[data-nav-pane="${name}"]`); return !!pane && pane.children.length > 0; };
  function data() {
    const views = readViews();
    const changes = readChanges() || [];
    return {
      changesLoaded: paneLoaded('changes'),
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
  const isWorkspaceRoot = () => /^\/o\/[^/]+\/s\/[^/]+\/?$/.test(location.pathname);
  // La page d accueil du labo (« Start Here ») est une fiche Seal qui contient l appli : c est le cahier.
  // Une manip peut aussi contenir un cadre (modeles de protocoles) : seul un cadre qui porte le menu du labo compte.
  const navCache = new WeakMap();
  function notebookDoc() {
    if (!isOn('readnb')) return null;
    const doc = appDoc();
    if (!doc) return null;
    const c = navCache.get(doc);
    if (c && Date.now() - c.at < 800) return c.nav ? doc : null;
    let nav = null;
    try { nav = appNav(doc); } catch (e) {}
    navCache.set(doc, { at: Date.now(), nav: !!nav });
    return nav ? doc : null;
  }
  const atNotebook = () => isWorkspaceRoot() || !!notebookDoc() || ((!isOn('readnb') || !appDoc()) && (() => { const f = $('iframe[title="Custom Content"]'); return !!f && f.getBoundingClientRect().height > 200; })());

  function onRoute() {
    if (location.pathname === lastRoute) return;
    lastRoute = location.pathname;
    closeUntil = Date.now() + 4000;
    page = null;
  }
  let arrived = false;
  function arriveOnToday() {
    if (arrived || !isOn('home') || !isOn('side') || page || guideOpened) return;
    if (!atNotebook() || !$('[data-testid="platform-layout"]')) return;
    arrived = true;
    page = 'home';
  }

  function go(el) {
    if (!atNotebook() && isNotebookRow(el)) { page = null; guideOpened = true; loadNotebook(null); return; }
    // Une ligne Seal : on quitte nos pages et on laisse Seal ouvrir la fiche.
    page = null;
    guideOpened = true; // Home ne s ouvre seul qu a la premiere arrivee sur l accueil

    press(el);
    render(true);
  }

  const PAGE_NAME = { home: 'Today', work: 'My work', pub: 'To publish', pick: 'Shortcut' };
  function whereAmI(d) {
    if (page) return [PAGE_NAME[page] || ''];
    if (atNotebook()) return appActive ? ['Notebook', appActive] : ['Notebook'];
    const sec = recordSection();
    const cur = d.views.find(v => v.current && !v.group);
    if (cur && !sec && !$('[data-testid="entity-top-navbar"]')) return ['View', cur.title];
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
    if (!atNotebook()) { loadNotebook(null); return; }
    render(true);
  }
  // Adresse de la page du cahier, notee quand on y est ; a defaut, la racine de l espace (qui l affiche).
  const NB_PATH = 'sh-nbpath';
  function rememberNotebook() {
    if (isWorkspaceRoot() || !notebookDoc()) return;
    try { if (localStorage.getItem(NB_PATH) !== location.pathname) localStorage.setItem(NB_PATH, location.pathname); } catch (e) {}
  }
  function loadNotebook(resume) {
    const m = location.pathname.match(/^\/o\/[^/]+\/s\/[^/]+/);
    if (!m) return;
    let path = '';
    try { path = localStorage.getItem(NB_PATH) || ''; } catch (e) {}
    if (!path.startsWith(m[0] + '/')) path = m[0];
    try { if (resume) sessionStorage.setItem(PENDING, JSON.stringify({ ...resume, at: Date.now() })); } catch (e) {}
    veil(true, 8000);
    location.assign(path);
  }
  function isNotebookRow(el) {
    const d = data();
    return [...d.favourites, ...d.recent].some(r => r.el === el && r.type && r.type[0] === 'Page');
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
    if (/run|progress|active|ongoing/i.test(s)) return 'run';
    if (/plan/i.test(s)) return 'plan';
    if (/complete|done|finish|signed|closed/i.test(s)) return 'done';
    if (/hold|pause|block/i.test(s)) return 'plan';
    return 'draft';
  }

  // Nombre affiche a droite d une section : experiences en cours, projets, modeles de protocoles.
  function sectionCount(label) {
    if (!appData) return null;
    const m = appData.metrics.find(x => new RegExp(x.view || x.label.split(' ')[0], 'i').test(label) || new RegExp(label.split(/\W/)[0], 'i').test(x.label));
    return m && m.n ? h('span', { class: 'sh-n', title: m.label }, String(m.n)) : null;
  }

  const HELP_RE = /how to|faq|feedback|help|lab tree|guide/i;
  let helpOpen = false;
  document.addEventListener('click', e => { if (helpOpen && !(e.target.closest && e.target.closest('.sh-help'))) { helpOpen = false; render(true); } }, true);

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
    if (appCreates.length) {
      const tpls = Object.keys(TEMPLATE_VIEW).filter(k => templateView(k, d.views) || (d.newBtn && appCreates.some(c => c.key === k)));
      const item = (cls, ico, tintKey, label, hint, onclick, last) => h('button', { type: 'button', role: 'menuitem', class: 'sh-newitem ' + cls, onclick },
        h('span', { class: 'sh-ti sm ' + tint(tintKey) }, icon(ico)),
        h('span', { class: 'sh-nt' }, h('span', { class: 'sh-t' }, label, last ? h('span', { class: 'sh-last' }, 'Last used') : null), hint ? h('small', {}, hint) : null));
      const isLast = (kind, key) => !!lastNew && lastNew.kind === kind && lastNew.key === key;
      const menu = h('div', { class: 'sh-newmenu', role: 'menu', hidden: !newOpen },
        h('div', { class: 'sh-newhead' }, 'In the lab notebook'),
        firstLast(appCreates, 'create', c => c.key).map(c => item('', CREATE_ICON[c.key] || 'doc', CREATE_ICON[c.key] || 'doc', c.label, CREATE_HINT[c.key], () => { newOpen = false; openCreate(c.key); }, isLast('create', c.key))),
        tpls.length ? h('div', { class: 'sh-newhead' }, 'From a Seal template') : null,
        firstLast(tpls, 'tpl', k => k).map(k => item('tpl', 'tpl', CREATE_ICON[k] || 'doc', (CREATE_LABEL[k] || 'New ' + k) + ' from template', templateView(k, d.views) ? 'Choose among the templates of ' + templateView(k, d.views).title : 'Choose the template in Seal’s New list', () => { newOpen = false; openFromTemplate(k); }, isLast('tpl', k))),
        d.newBtn ? item('other', 'plus', 'grey', 'Other Seal record…', 'Any record type Seal knows', () => { newOpen = false; press(d.newBtn); }) : null);
      top.append(h('div', { class: 'sh-new' },
        h('button', { type: 'button', class: 'sh-newbtn', 'aria-expanded': String(newOpen), 'aria-haspopup': 'menu', onclick: () => { newOpen = !newOpen; render(true); } },
          icon('plus'), h('span', { class: 'sh-t' }, 'New'), h('span', { class: 'sh-chev' + (newOpen ? ' open' : ''), 'aria-hidden': 'true', html: ICON.chev })),
        menu));
    } else if (d.newBtn) top.append(sideItem('plus', 'New', { onclick: () => press(d.newBtn) }));
    side.append(top);

    const scroll = h('div', { class: 'sh-scroll' });
    const you = () => {
      scroll.append(h('div', { class: 'sh-group' }, 'You'));
      scroll.append(sideItem('today', 'Today', { on: page === 'home', onclick: () => openPage('home') }));
      scroll.append(sideItem('work', 'My work', { on: page === 'work', count: group(d.mine).length || '', onclick: () => openPage('work') }));
      scroll.append(sideItem('pub', 'To publish', { on: page === 'pub', count: d.pending.length || '', hot: d.pending.length > 0, onclick: () => openPage('pub'), title: 'Changes to publish, and your inbox' }));
    };

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
      const here = atNotebook() && !page;
      const inSec = recordSection();
      scroll.append(h('div', { class: 'sh-group sh-first' }, 'Lab notebook'));
      for (const l of appSections.filter(l => !HELP_RE.test(l))) {
        const create = appCreates.find(c => CREATE_SECTION[c.key] && CREATE_SECTION[c.key].test(l) && !/panel|antibodies/.test(c.key));
        scroll.append(h('div', { class: 'sh-sc' },
          h('button', { type: 'button', class: 'sh-row sh-app' + ((here && appActive === l) || inSec === l ? ' on' : ''), title: `Open ${l} in the lab notebook`, onclick: () => openAppSection(l) },
            icon(appIcon(l)), h('span', { class: 'sh-t' }, l), sectionCount(l)),
          create ? h('button', { type: 'button', class: 'sh-edit', title: create.label, 'aria-label': create.label, onclick: () => openCreate(create.key) }, icon('plus')) : null));
      }
    }
    if (!appSections.length) scroll.append(h('div', { class: 'sh-group sh-first' }, 'Lab'));
    if (!appSections.length) for (const sc of lab) {
      const v = resolve(sc, d.views);
      const row = h('div', { class: 'sh-sc' + (v || sc.path ? '' : ' unset') },
        h('button', { type: 'button', class: 'sh-row' + (page === 'pick' && pickFor === sc.id ? ' on' : ''), title: v ? `${sc.label}: ${v.key}` : `Choose the Seal view for ${sc.label}`, onclick: () => openShortcut(sc) },
          icon(sc.icon || 'view'), h('span', { class: 'sh-t' }, sc.label),
          v ? (v.group ? h('span', { class: 'sh-chev' + (labOpen === sc.id && v.open ? ' open' : ''), 'aria-hidden': 'true', html: ICON.chev }) : null) : sc.path ? null : h('span', { class: 'sh-set' }, 'Choose')),
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

    you();

    // Recent : les 5 dernieres fiches ouvertes (liste Seal « Recent activity »), point de statut.
    const recent = group(d.recent).filter(r => r.type[0] !== 'Page').slice(0, 5);
    if (recent.length) {
      scroll.append(h('div', { class: 'sh-group' }, 'Recent'));
      for (const r of recent) scroll.append(h('button', { type: 'button', class: 'sh-row sh-recent' + (r.current ? ' on' : ''), title: r.title + (r.status ? ' · ' + r.status : ''), onclick: () => go(r.el) },
        h('span', { class: 'sh-dot ' + (r.status ? statusClass(r.status) : '') }), h('span', { class: 'sh-t' }, r.title)));
    }

    if (d.favourites.length) {
      scroll.append(h('div', { class: 'sh-group' }, 'Favourites'));
      for (const f of d.favourites) scroll.append(rowButton(f, { showTag: false }));
    }

    if (d.views.length) {
      scroll.append(h('button', { type: 'button', class: 'sh-group sh-toggle', 'aria-expanded': String(allViewsOpen), onclick: () => { allViewsOpen = !allViewsOpen; try { localStorage.setItem('sh-allviews', allViewsOpen ? '1' : '0'); } catch (e) {} render(true); } },
        h('span', { class: 'sh-chev' + (allViewsOpen ? ' open' : ''), 'aria-hidden': 'true', html: ICON.chev }), 'Seal views', h('span', { class: 'sh-act' }, String(d.views.filter(v => !v.group).length))));
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

    side.append(scroll);

    const set = $('[data-testid="nav-panel-settings-button"]');
    const help = $('[data-testid="nav-panel-help-menu"]');
    const inbox = $('[data-testid="nav-panel-inbox-button"]');
    const helpSections = appSections.filter(l => HELP_RE.test(l));
    const helpMenu = h('div', { class: 'sh-helpmenu', role: 'menu', hidden: !helpOpen },
      helpSections.length ? h('div', { class: 'sh-newhead' }, 'Lab notebook') : null,
      helpSections.map(l => h('button', { type: 'button', role: 'menuitem', class: 'sh-newitem', onclick: () => { helpOpen = false; openAppSection(l); } },
        h('span', { class: 'sh-ti sm tint-grey' }, icon(appIcon(l))), h('span', { class: 'sh-nt' }, h('span', { class: 'sh-t' }, l), h('small', {}, sectionText(l))))),
      help ? h('div', { class: 'sh-newhead' }, 'Seal') : null,
      help ? h('button', { type: 'button', role: 'menuitem', class: 'sh-newitem', onclick: () => { helpOpen = false; press(help); } },
        h('span', { class: 'sh-ti sm tint-grey' }, icon('help')), h('span', { class: 'sh-nt' }, h('span', { class: 'sh-t' }, 'Seal help and more'), h('small', {}, 'Documentation, keyboard shortcuts, support'))) : null,
      h('button', { type: 'button', role: 'menuitem', class: 'sh-newitem', onclick: () => { helpOpen = false; tipsDone = false; try { localStorage.removeItem('sh-tips'); } catch (e) {} openPage('home'); } },
        h('span', { class: 'sh-ti sm tint-grey' }, icon('today')), h('span', { class: 'sh-nt' }, h('span', { class: 'sh-t' }, 'Getting around Seal Helper'), h('small', {}, 'The four moves, on Today'))),
      h('button', { type: 'button', role: 'menuitem', class: 'sh-newitem', onclick: () => { helpOpen = false; keysOpen = true; renderKeys(); render(true); } },
        h('span', { class: 'sh-ti sm tint-grey' }, h('kbd', {}, '?')), h('span', { class: 'sh-nt' }, h('span', { class: 'sh-t' }, 'Keyboard shortcuts'), h('small', {}, 'N, T, W, P, G then a letter, ? for the list'))));
    side.append(h('div', { class: 'sh-foot' },
      set ? h('button', { type: 'button', class: 'sh-iconbtn', title: 'Settings', onclick: () => press(set) }, icon('gear')) : null,
      h('div', { class: 'sh-help' },
        h('button', { type: 'button', class: 'sh-iconbtn', title: 'Help', 'aria-haspopup': 'menu', 'aria-expanded': String(helpOpen), onclick: () => { helpOpen = !helpOpen; render(true); } }, icon('help')),
        helpMenu),
      inbox ? h('button', { type: 'button', class: 'sh-iconbtn', title: 'Inbox', onclick: () => press(inbox) }, icon('inbox')) : null,
      h('span', { class: 'sh-ver', title: 'Seal Helper ' + VERSION }, 'v' + VERSION),
      h('button', { type: 'button', class: 'sh-classic', title: 'Classic Seal: show Seal without the new layout', 'aria-label': 'Classic Seal', onclick: () => save({ side: false }) }, icon('classic'), h('span', { class: 'sh-classic-t' }, 'Classic'))));
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
      days.push(h('div', { class: 'sh-wday' + (d.getTime() === now.getTime() ? ' today' : '') + (n ? ' busy' : ''), title: n ? `${n} change${n > 1 ? 's' : ''}` : 'No change' },
        h('small', {}, d.toLocaleDateString('en-NZ', { weekday: 'short' })),
        h('b', {}, String(d.getDate())),
        h('span', { class: 'sh-dots' }, Array.from({ length: Math.min(n, 4) }, () => h('i', {})))));
    }
    const week = changes.filter(c => { const d = dayDate(c.day); return d && d >= monday; }).length;
    return { el: h('div', { class: 'sh-week' }, days), week };
  }

  const eyebrow = (d, what) => (d.lab ? d.lab.charAt(0) + d.lab.slice(1).toLowerCase() + ' lab' : 'Lab') + ' · ' + what;
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
        h('h1', {}, hello + (appData && appData.user ? ', ' + appData.user.split(' ')[0] : '')),
        h('p', {}, now.toLocaleDateString('en-NZ', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' }))),
      h('div', { class: 'sh-dash-tools' },
        q ? h('button', { type: 'button', class: 'sh-bigsearch', onclick: () => press(q) }, icon('search'), h('span', {}, 'Search records, protocols, samples…'), h('kbd', {}, isMac ? '⌘K' : 'Ctrl K')) : null,
        appCreates.some(c => c.key === 'experiment') ? h('button', { type: 'button', class: 'sh-btn primary', onclick: () => openCreate('experiment') }, icon('plus'), 'New experiment')
          : d.newBtn ? h('button', { type: 'button', class: 'sh-btn', onclick: () => press(d.newBtn) }, icon('plus'), 'New record') : null));

    const ad = appData;
    const metric = re => ad && ad.metrics.find(m => re.test(m.label + ' ' + m.view));
    const mExp = metric(/experiment/i), mProj = metric(/project/i), mProt = metric(/protocol/i);
    const secFor = re => appSections.find(l => re.test(l));
    const stats = h('div', { class: 'sh-stats' },
      mExp ? stat('Experiments', mExp.n, mExp.label.replace(/^experiments?\s*/i, '') || 'in progress', () => openAppSection(secFor(/experiment/i) || mExp.label), 'blue')
        : stat('In progress', drafts.length, drafts.length === 1 ? 'draft record' : 'draft records', () => { workType = ''; openPage('work'); }),
      stat('To publish', d.changesLoaded ? d.pending.length : '…', d.pending.length ? 'waiting for review' : d.changesLoaded ? 'all published' : atNotebook() ? 'open a record to load' : 'loading', () => openPage('pub'), d.pending.length ? 'hot' : ''),
      mProj ? stat('Projects', mProj.n, ad.cards.length ? `${ad.cards.filter(c => /active|progress/i.test(c.status)).length} active` : 'in the lab', () => openAppSection(secFor(/project/i) || 'Projects'), 'violet')
        : stat('Published', published.length, 'in your recent records', () => openPage('work')),
      mProt ? stat('Protocols', mProt.n, 'templates ready to run', () => openAppSection(secFor(/protocol/i) || 'Protocols'), 'teal')
        : stat('Last 7 days', weekCount, weekCount === 1 ? 'change made' : 'changes made', () => openPage('pub')));

    const ah = ad && ad.hero;
    const heroCard = ah ? h('button', { type: 'button', class: 'sh-hero', onclick: () => openRecord(ah) },
      h('span', { class: 'sh-ti big tint-blue' }, icon('flask')),
      h('span', { class: 'sh-hero-t' },
        h('small', {}, 'Continue an experiment'),
        h('b', {}, ah.title),
        h('span', { class: 'sh-meta' }, h('span', { class: 'sh-type' }, ah.sub), pill(ah.status))),
      h('span', { class: 'sh-open' }, 'Open', icon('chev')))
    : hero ? h('button', { type: 'button', class: 'sh-hero', onclick: () => go(hero.el) },
      h('span', { class: 'sh-ti big ' + tint(hero.type[1]) }, icon(hero.type[1])),
      h('span', { class: 'sh-hero-t' },
        h('small', {}, 'Pick up where you left off'),
        h('b', {}, hero.title),
        h('span', { class: 'sh-meta' }, h('span', { class: 'sh-type' }, hero.type[0]), pill(hero.status))),
      h('span', { class: 'sh-open' }, 'Open', icon('chev'))) : null;

    const appExps = ad ? ad.experiments.filter(x => !ah || x.id !== ah.id).slice(0, 5) : [];
    const next = appExps.length ? appExps.map(x => h('button', { type: 'button', class: 'sh-line', onclick: () => openRecord(x) },
      h('span', { class: 'sh-ti tint-blue' }, icon('flask')),
      h('span', { class: 'sh-lt' }, h('b', {}, x.title), h('small', {}, x.sub)),
      pill(x.status)))
    : recent.slice(1, 6).map(r => h('button', { type: 'button', class: 'sh-line', onclick: () => go(r.el) },
      h('span', { class: 'sh-ti ' + tint(r.type[1]) }, icon(r.type[1])),
      h('span', { class: 'sh-lt' }, h('b', {}, r.title, r.n > 1 ? h('span', { class: 'sh-x' }, '×' + r.n) : null), h('small', {}, r.type[0])),
      pill(r.status)));
    const newExp = appCreates.find(c => c.key === 'experiment');
    const newProj = appCreates.find(c => c.key === 'project');
    const newProt = appCreates.find(c => c.key === 'protocol');

    // Projets du cahier en cartes, avec leur nombre d experiences.
    const projects = ad && ad.cards.length ? h('section', { class: 'sh-panel' },
      h('header', {}, h('h3', {}, 'Projects'), h('span', { class: 'sh-hdr-actions' },
        newProj ? h('button', { type: 'button', class: 'sh-more sh-plus', onclick: () => openCreate('project') }, icon('plus'), newProj.label) : null,
        h('button', { type: 'button', class: 'sh-more', onclick: () => openAppSection(secFor(/project/i) || 'Projects') }, 'All ›'))),
      h('div', { class: 'sh-projects' }, ad.cards.slice(0, 6).map(c => h('button', { type: 'button', class: 'sh-project', onclick: () => openRecord(c) },
        h('span', { class: 'sh-project-top' }, pill(c.status), h('small', {}, c.updated ? 'Updated ' + c.updated : '')),
        h('b', {}, c.title),
        h('span', { class: 'sh-project-n' }, h('strong', {}, String(c.n)), c.n === 1 ? ' experiment' : ' experiments'))))) : null;

    // Modeles de protocoles du cahier.
    const protocols = ad && ad.protocols.length ? h('section', { class: 'sh-panel' },
      h('header', {}, h('h3', {}, 'Protocols'), h('span', { class: 'sh-hdr-actions' },
        newProt ? h('button', { type: 'button', class: 'sh-more sh-plus', onclick: () => openCreate('protocol') }, icon('plus'), newProt.label) : null,
        h('button', { type: 'button', class: 'sh-more', onclick: () => openAppSection(secFor(/protocol/i) || 'Protocols') }, 'All ›'))),
      ad.protocols.slice(0, 5).map(x => h('button', { type: 'button', class: 'sh-line', onclick: () => openRecord(x) },
        h('span', { class: 'sh-ti tint-teal' }, icon('proto')),
        h('span', { class: 'sh-lt' }, h('b', {}, x.title), h('small', {}, x.sub || 'Protocol template'))))) : null;

    const sections = appSections.filter(l => !HELP_RE.test(l) && !/overview|start/i.test(l)).slice(0, 6);
    const notebook = sections.length ? h('section', { class: 'sh-panel' },
      h('header', {}, h('h3', {}, 'Lab notebook'), h('span', { class: 'sh-sub' }, 'Open a section')),
      h('div', { class: 'sh-tiles' }, sections.map(l => {
        const create = appCreates.find(c => CREATE_SECTION[c.key] && CREATE_SECTION[c.key].test(l) && !/panel|antibodies/.test(c.key));
        return h('div', { class: 'sh-tilewrap' },
          h('button', { type: 'button', class: 'sh-tile', onclick: () => openAppSection(l) },
            h('span', { class: 'sh-ti ' + tint(appIcon(l)) }, icon(appIcon(l))),
            h('b', {}, l), h('small', {}, sectionText(l))),
          create ? h('button', { type: 'button', class: 'sh-tileplus', title: create.label, 'aria-label': create.label, onclick: () => openCreate(create.key) }, icon('plus')) : null);
      }))) : null;

    const toPublish = h('section', { class: 'sh-panel' },
      h('header', {}, h('h3', {}, 'To publish'), pend.length ? h('button', { type: 'button', class: 'sh-more', onclick: () => openPage('pub') }, `All ${d.pending.length} ›`) : null),
      pend.length ? pend.slice(0, 5).map(c => h('button', { type: 'button', class: 'sh-check', onclick: () => go(c.el) },
        h('span', { class: 'sh-box' }), h('span', { class: 'sh-lt' }, h('b', {}, c.title), h('small', {}, [c.hash, c.day, c.time].filter(Boolean).join(' · '))),
        c.n > 1 ? h('span', { class: 'sh-x' }, '×' + c.n) : null))
        : h('p', { class: 'sh-empty' + (d.changesLoaded || atNotebook() ? '' : ' sh-loading') }, d.changesLoaded ? 'Nothing waiting. Everything you changed is published.' : atNotebook() ? 'Seal fills this list once you open a record or a Seal view.' : 'Loading your changes from Seal…'));

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

    const tips = tipsDone ? null : h('section', { class: 'sh-panel sh-tips' },
      h('header', {}, h('h3', {}, 'Getting around'), h('button', { type: 'button', class: 'sh-more', onclick: () => { tipsDone = true; try { localStorage.setItem('sh-tips', '1'); } catch (e) {} render(true); } }, 'Got it')),
      h('ul', {},
        h('li', {}, h('span', { class: 'sh-ti sm tint-grey' }, icon('plus')), h('span', {}, h('b', {}, 'New'), ' at the top of the sidebar creates an experiment, project or protocol, or starts one from a Seal template.')),
        h('li', {}, h('span', { class: 'sh-ti sm tint-grey' }, icon('search')), h('span', {}, h('b', {}, isMac ? '⌘K' : 'Ctrl K'), ' searches all of Seal from anywhere.')),
        h('li', {}, h('span', { class: 'sh-ti sm tint-grey' }, icon('back')), h('span', {}, h('b', {}, 'Back and forward'), ' arrows above the search, or Alt ← and Alt →. The line next to them says where you are.')),
        h('li', {}, h('span', { class: 'sh-ti sm tint-grey' }, icon('classic')), h('span', {}, h('b', {}, 'Classic Seal'), ' at the bottom brings the usual Seal panel back whenever you need it.')),
        h('li', {}, h('span', { class: 'sh-ti sm tint-grey' }, h('kbd', {}, '?')), h('span', {}, h('b', {}, 'Keys'), ': N new, T today, W my work, P to publish, G then a letter for a section. Press ? for the list.'))));
    const favs = d.favourites.length ? h('section', { class: 'sh-panel' },
      h('header', {}, h('h3', {}, 'Favourites')),
      d.favourites.map(r => h('button', { type: 'button', class: 'sh-line', onclick: () => go(r.el) },
        h('span', { class: 'sh-ti ' + tint(r.type[1]) }, icon('star')), h('span', { class: 'sh-lt' }, h('b', {}, r.title), h('small', {}, r.type[0]))))) : null;

    return h('div', { class: 'sh-wrap sh-dash' },
      head, stats,
      h('div', { class: 'sh-cols' },
        h('div', { class: 'sh-col' },
          h('section', { class: 'sh-panel' },
            h('header', {}, h('h3', {}, appExps.length ? 'Experiments' : 'Continue'), h('span', { class: 'sh-hdr-actions' },
              newExp ? h('button', { type: 'button', class: 'sh-more sh-plus', onclick: () => openCreate('experiment') }, icon('plus'), newExp.label) : null,
              h('button', { type: 'button', class: 'sh-more', onclick: () => (appExps.length ? openAppSection(secFor(/experiment/i) || 'Experiments') : openPage('work')) }, appExps.length ? 'All ›' : 'All my work ›'))),
            heroCard, next.length ? next : null, !heroCard && !next.length ? h('p', { class: 'sh-empty' }, 'Records you open will show here.') : null),
          projects, notebook, protocols),
        h('div', { class: 'sh-col' }, tips, toPublish, activity, favs)));
  }

  let tipsDone = (() => { try { return localStorage.getItem('sh-tips') === '1'; } catch (e) { return false; } })();
  let pickFor = null;
  let newOpen = false;
  document.addEventListener('click', e => { if (newOpen && !(e.target.closest && e.target.closest('.sh-new'))) { newOpen = false; render(true); } }, true);
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
  let workSrc = ''; // '' = cahier si disponible, 'seal' = fiches recentes de Seal
  let workStatus = '';
  function buildWork(d) {
    const ad = appData;
    const nb = ad && (ad.experiments.length || ad.cards.length);
    const src = workSrc || (nb ? 'notebook' : 'seal');
    const srcChips = nb ? h('div', { class: 'sh-chips sh-src', role: 'group', 'aria-label': 'Source' },
      [['notebook', 'Lab notebook'], ['seal', 'Recent in Seal']].map(([k, l]) => h('button', { type: 'button', class: 'sh-chip' + (src === k ? ' on' : ''), 'aria-pressed': String(src === k), onclick: () => { workSrc = k; render(true); } }, l))) : null;
    if (src === 'notebook') return buildNotebookWork(d, ad, srcChips);
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
        h('td', {}, h('span', { class: 'sh-cell' }, h('span', { class: 'sh-ti sm ' + tint(r.type[1]) }, icon(r.type[1])), h('b', {}, r.title), r.n > 1 ? h('span', { class: 'sh-x', title: `${r.n} records with this name` }, '×' + r.n) : null)),
        h('td', { class: 'sh-muted' }, r.type[0]), h('td', {}, pill(r.status)), h('td', { class: 'sh-go' }, 'Open ›')))));
    return h('div', { class: 'sh-wrap' },
      h('div', { class: 'sh-hello' }, h('div', {}, h('div', { class: 'sh-eyebrow' }, eyebrow(d, 'My work')), h('h1', {}, 'My work'), h('p', {}, 'Records you opened recently or created, same names grouped together.')), input),
      srcChips, chips,
      h('section', { class: 'sh-panel' }, rows.length ? table : h('p', { class: 'sh-empty' }, 'No record matches.')));
  }

  // My work, version cahier : experiences et projets lus sur l accueil du labo, filtres par statut.
  function buildNotebookWork(d, ad, srcChips) {
    const f = workFilter.toLowerCase();
    const match = r => !f || (r.title + ' ' + r.sub).toLowerCase().includes(f);
    const stKey = s => statusClass(s || '');
    const secFor0 = re => appSections.find(l => re.test(l));
    const expSec = secFor0(/experiment|manip/i), projSec = secFor0(/project/i);
    const fullExp = expSec && appTables[expSec] ? appTables[expSec] : null;
    const fullProj = projSec && appTables[projSec] ? appTables[projSec] : null;
    const expRows = fullExp ? fullExp.rows.map(r => ({ ...r, sub: [r.id, r.project].filter(Boolean).join(' · '), full: true, sec: expSec })) : ad.experiments;
    const projRows = fullProj ? fullProj.rows.map(r => ({ ...r, sub: r.id, n: null, full: true, sec: projSec })) : (ad.cards.length ? ad.cards : ad.projects);
    const exps = expRows.filter(match).filter(r => !workStatus || stKey(r.status) === workStatus);
    const projs = projRows.filter(match).filter(r => !workStatus || stKey(r.status) === workStatus);
    const statuses = [...new Set([...expRows, ...projRows].map(r => r.status).filter(Boolean))];
    const openRow = r => (r.full ? openTableRow(r.sec, r) : openRecord(r));
    const seen = t => t ? 'Seen ' + new Date(t).toLocaleDateString('en-NZ', { day: 'numeric', month: 'short' }) + ' · ' : '';
    const stChips = statuses.length > 1 ? h('div', { class: 'sh-chips', role: 'group', 'aria-label': 'Status' },
      [['', 'All'], ...statuses.map(st => [stKey(st), st])].filter((x, i, a) => a.findIndex(y => y[0] === x[0]) === i)
        .map(([k, l]) => h('button', { type: 'button', class: 'sh-chip' + (workStatus === k ? ' on' : ''), 'aria-pressed': String(workStatus === k), onclick: () => { workStatus = k; render(true); } }, l))) : null;
    const input = h('input', { type: 'search', id: 'sh-filter', class: 'sh-input', placeholder: 'Filter by name or project', value: workFilter,
      oninput: e => { workFilter = e.target.value; render(true); const i = $('#sh-filter'); if (i) { i.focus(); i.setSelectionRange(i.value.length, i.value.length); } } });
    const secFor = re => appSections.find(l => re.test(l));
    const expTable = h('table', { class: 'sh-table' },
      h('thead', {}, h('tr', {}, h('th', {}, 'Experiment'), h('th', {}, 'Project'), h('th', {}, 'Status'), h('th', {}, ''))),
      h('tbody', {}, exps.map(r => h('tr', { onclick: () => openRow(r), tabindex: '0', onkeydown: e => e.key === 'Enter' && openRow(r) },
        h('td', {}, h('span', { class: 'sh-cell' }, h('span', { class: 'sh-ti sm tint-blue' }, icon('flask')), h('b', {}, r.title))),
        h('td', { class: 'sh-muted' }, r.project || (r.sub || '').split(' · ').pop()), h('td', {}, pill(r.status)), h('td', { class: 'sh-go' }, 'Open ›')))));
    const projTable = h('table', { class: 'sh-table' },
      h('thead', {}, h('tr', {}, h('th', {}, 'Project'), h('th', { class: 'sh-num' }, 'Experiments'), h('th', {}, 'Status'), h('th', {}, ''))),
      h('tbody', {}, projs.map(r => h('tr', { onclick: () => openRow(r), tabindex: '0', onkeydown: e => e.key === 'Enter' && openRow(r) },
        h('td', {}, h('span', { class: 'sh-cell' }, h('span', { class: 'sh-ti sm tint-violet' }, icon('folder')), h('b', {}, r.title))),
        h('td', { class: 'sh-num sh-muted' }, r.n != null ? String(r.n) : ''), h('td', {}, pill(r.status)), h('td', { class: 'sh-go' }, 'Open ›')))));
    const panel = (title, re, n, table, empty, full) => h('section', { class: 'sh-panel' },
      h('header', {}, h('h3', {}, title), h('span', { class: 'sh-hdr-actions' }, h('span', { class: 'sh-sub' }, (full ? seen(full.at) + n + ' in the notebook' : n + ' recent') ),
        h('button', { type: 'button', class: 'sh-more', onclick: () => openAppSection(secFor(re) || title) }, 'All in the notebook ›'))),
      n ? table : h('p', { class: 'sh-empty' }, empty));
    return h('div', { class: 'sh-wrap' },
      h('div', { class: 'sh-hello' }, h('div', {}, h('div', { class: 'sh-eyebrow' }, eyebrow(d, 'My work')), h('h1', {}, 'My work'), h('p', {}, fullExp ? 'All experiments and projects of the notebook, as last seen in its Experiments and Projects sections.' : 'Recent experiments and projects of the notebook. Open its Experiments section once to get the full list here.')), input),
      srcChips, stChips,
      panel('Experiments', /experiment|manip/i, exps.length, expTable, 'No experiment matches.', fullExp),
      panel('Projects', /project/i, projs.length, projTable, 'No project matches.', fullProj));
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
    const inbox = $('[data-testid="nav-panel-inbox-button"]');
    const tabs = inbox ? h('div', { class: 'sh-chips sh-src', role: 'tablist' },
      h('button', { type: 'button', role: 'tab', class: 'sh-chip on', 'aria-selected': 'true' }, 'To publish', d.pending.length ? h('span', { class: 'sh-x' }, String(d.pending.length)) : null),
      h('button', { type: 'button', role: 'tab', class: 'sh-chip', 'aria-selected': 'false', title: 'Open your Seal inbox: mentions, requests, reviews', onclick: () => press(inbox) }, 'Inbox', icon('chev'))) : null;
    return h('div', { class: 'sh-wrap' },
      h('div', { class: 'sh-hello' },
        h('div', {}, h('div', { class: 'sh-eyebrow' }, eyebrow(d, 'To publish')), h('h1', {}, 'To publish'), h('p', {}, 'Changes you started and have not published yet. The lab sees them only once they are published. Inbox holds what others sent you.')),
        emptyCount > 0 ? h('button', { type: 'button', class: 'sh-btn ghost', onclick: () => { showEmpty = !showEmpty; render(true); } },
          showEmpty ? 'Hide empty changes' : `Show ${emptyCount} empty`) : null),
      tabs,
      h('section', { class: 'sh-panel' }, list.length ? h('table', { class: 'sh-table' },
        h('thead', {}, h('tr', {}, h('th', {}, 'Change'), h('th', {}, 'What'), h('th', { class: 'sh-num' }, 'Records'), h('th', { class: 'sh-num' }, 'Last edit'), h('th', {}, ''))), body)
        : d.changesLoaded ? h('p', { class: 'sh-empty' }, 'Nothing waiting. Everything you changed is published.')
        : h('p', { class: 'sh-empty' + (atNotebook() ? '' : ' sh-loading') }, atNotebook() ? 'Seal fills this list once you open a record or a Seal view; it then stays here.' : 'Loading your changes from Seal…')));
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
      // Une valeur qui est une reference (un projet, un protocole) : l element qui l ouvre.
      const link = $('a[href], [role="link"], [data-list-item-content], button', valEl);
      out.push({ label, value, card, link: link && txt(link) === value ? link : null });
      if (out.length >= 6) break;
    }
    return out;
  }
  const projectProp = props => props.find(p => /project/i.test(p.label) && !/template/i.test(p.label));

  function readHeadings() {
    return $$('[data-native-block-type="h2"], [data-native-block-type="h3"]')
      .map(b => ({ b, t: txt(b), lvl: b.getAttribute('data-native-block-type') }))
      .filter(x => x.t);
  }

  let propsSig = '';
  // Boutons de l en-tete Seal qu on relaie : trouves par leur role, jamais recrees.
  function headerActions(header) {
    const btns = $$('button, a', header).filter(b => !b.closest('.sh'));
    const byText = re => btns.find(b => re.test(txt(b)) || re.test(b.getAttribute('aria-label') || ''));
    const out = [];
    const status = $('[data-seal-header-badge] button, [data-seal-header-badge] [role="button"]', header) || byText(/^select status$/i);
    if (status) { const t = txt(status); out.push({ key: 'status', label: /select status/i.test(t) ? 'Set status' : t, el: status, pill: !/select status/i.test(t), title: 'Change the status' }); }
    const ver = $('[data-seal-version-and-badge] [role="button"], [data-seal-version-and-badge] button', header);
    if (ver) out.push({ key: 'version', label: txt(ver).replace(/\s+/g, ' '), el: ver, pill: true, title: 'Versions' });
    const edit = byText(/^edit$/i); if (edit) out.push({ key: 'edit', label: 'Edit', el: edit, title: 'Edit this record' });
    const changes = byText(/show changes|^changes\b/i); if (changes) out.push({ key: 'changes', label: txt(changes).replace(/^show /i, '') || 'Changes', el: changes, title: 'What changed in this version' });
    const cs = byText(/changeset\s*#\d+/i); if (cs) out.push({ key: 'cs', label: txt(cs), el: cs, title: 'Open this change set' });
    const pub = byText(/publish|submit for review|review and publish|approve/i); if (pub) out.push({ key: 'pub', label: txt(pub), el: pub, primary: true, title: 'Publish this change' });
    if (isOn('doc') && $('[data-native-document-editor], [data-native-document-root], [data-page-scroll-container]')) out.push({ key: 'print', label: 'Print', title: 'Print this record as a clean notebook page', print: true });
    return out;
  }
  function renderProps() {
    const header = atNotebook() ? null : $('[data-testid="changeset-top-navbar"], [data-testid="entity-top-navbar"]');
    const old = $('#sh-props');
    const props = isOn('props') && header ? readProps() : [];
    const sec = isOn('props') && header && isOn('side') ? recordSection() : '';
    const acts = isOn('props') && header ? headerActions(header) : [];
    const sig = sec + '#' + props.map(p => p.label + '=' + p.value).join('|') + '#' + acts.map(a => a.key + a.label).join('|');
    if (!props.length && !sec && !acts.length) { if (old) old.remove(); propsSig = ''; return; }
    if (old && sig === propsSig && old.previousElementSibling === header) return;
    propsSig = sig;
    const bar = h('div', { id: 'sh-props', class: 'sh' },
      sec ? h('nav', { class: 'sh-crumbs', 'aria-label': 'You are here' },
        h('button', { type: 'button', class: 'sh-crumb', title: 'Lab notebook', onclick: () => openAppSection(appSections[0]) }, 'Notebook'),
        h('span', { class: 'sh-sep' }, '›'),
        h('button', { type: 'button', class: 'sh-crumb', title: `Back to ${sec}`, onclick: () => openAppSection(sec) }, sec),
        h('span', { class: 'sh-sep' }, '›'),
        ...(projectProp(props) && !/project/i.test(sec) ? [
          h('button', { type: 'button', class: 'sh-crumb', title: 'Open the project: ' + projectProp(props).value, onclick: () => { const p = projectProp(props); if (p.link) go(p.link); else p.card.scrollIntoView({ behavior: 'smooth', block: 'center' }); } }, projectProp(props).value.split(/\s+[-–—]\s+/)[0].slice(0, 24)),
          h('span', { class: 'sh-sep' }, '›')] : []),
        h('span', { class: 'sh-crumb-here' }, (txt($('[data-title-text]', header)) || '').split(/\s+[-–—]\s+/)[0].slice(0, 32))) : null,
      props.map(p => h('button', { type: 'button', class: 'sh-prop', title: 'Go to ' + p.label, onclick: () => p.card.scrollIntoView({ behavior: 'smooth', block: 'center' }) },
        h('small', {}, p.label), /status/i.test(p.label) ? pill(p.value) : h('span', {}, p.value))),
      acts.length ? h('div', { class: 'sh-acts', role: 'group', 'aria-label': 'Record actions' },
        acts.map(a => h('button', { type: 'button', class: 'sh-act' + (a.primary ? ' primary' : '') + (a.pill ? ' aspill' : '') + (a.print ? ' quiet' : ''), title: a.title, onclick: () => (a.print ? window.print() : press(a.el)) },
          a.pill ? h('span', { class: 'sh-pill ' + statusClass(a.label) }, a.label) : a.label, a.key === 'status' || a.key === 'version' ? h('span', { class: 'sh-chev', 'aria-hidden': 'true', html: ICON.chev }) : null))) : null);
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
  let renderTimes = [], renderCooldown = 0, lastError = '';
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
      d.changeset && [d.changeset.hash, d.changeset.name, d.changeset.rows.map(r => r.title + r.current)], !!d.newBtn, d.changesLoaded, showEmpty, workFilter, workType, workSrc, workStatus, tipsDone, helpOpen, Object.values(appTables).map(t => t.rows.length), lab, labOpen, pickFor, allViewsOpen, appSections, appActive, atNotebook(), recordSection(), location.pathname, newOpen, appCreates, appData && appData.at]);
    if (!force && sig === sideSig && $('#sh-side')) return;
    // Garde-fou : plus de 40 rendus en 5 s, c est une boucle ; on souffle 3 s et on le note.
    const now = Date.now();
    renderTimes = renderTimes.filter(t => now - t < 5000); renderTimes.push(now);
    if (renderTimes.length > 40) { if (!renderCooldown) { renderCooldown = now; lastError = 'render loop: ' + renderTimes.length + ' renders in 5 s (sig ' + sig.length + ')'; console.warn('[Seal Helper] ' + lastError); } if (now - renderCooldown < 3000) return; renderCooldown = 0; renderTimes = []; }
    sideSig = sig;
    let side;
    try { side = buildSide(d); } catch (e) { lastError = 'side: ' + (e && e.message); console.warn('[Seal Helper] side', e); return; }
    const oldSide = $('#sh-side');
    if (oldSide) oldSide.replaceWith(side); else root.append(side);
    const old = $('#sh-page');
    if (page) {
      let body;
      try { body = page === 'home' ? buildHome(d) : page === 'work' ? buildWork(d) : page === 'pick' ? buildPick(d) : buildPub(d); }
      catch (e) { lastError = 'page ' + page + ': ' + (e && e.message); console.warn('[Seal Helper] page', e); return; }
      const pg = h('main', { id: 'sh-page', class: 'sh', 'aria-label': page }, body);
      const top = old ? old.scrollTop : 0;
      if (old) old.replaceWith(pg); else root.append(pg);
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
    if (!isOn('info') || Date.now() > closeUntil || atNotebook()) return;
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
    // Chaque etape a part : une lecture qui casse n empeche jamais la barre de s afficher.
    const step = (name, fn) => { try { fn(); } catch (e) { lastError = name + ': ' + (e && e.message); console.warn('[Seal Helper] ' + name, e); } };
    step('route', onRoute);
    step('theme', followTheme);
    if (isOn('dates')) step('dates', () => shortenTexts(document.body));
    if (isOn('doc')) step('doc', () => markRules(document.body));
    if (isOn('quiet')) step('quiet', () => markFaded(document.body));
    step('info', closeInfoOnArrival);
    if (isOn('side')) {
      if (isOn('readnb')) { step('app', readApp); step('nbpath', rememberNotebook); }
      if (!atNotebook()) { if (page && !paneLoaded('changes') && Date.now() - panesTried > 3000) panesTried = 0; step('panes', ensurePanes); step('views', expandViews); }
      step('resume', resumePending);
    }
    else step('unhide', () => { unshiftFrame(appFrame()); const doc = appDoc(); if (doc) hiddenOf.delete(doc); });
    if (isOn('side')) step('arrive', arriveOnToday);
    step('side', () => render(false));
    if (isOn('props')) { step('props', renderProps); step('outline', renderOutline); }
    else { $('#sh-props')?.remove(); $('#sh-outline')?.remove(); root.classList.remove('sh-has-outline'); }
    observer.observe(document.body, { childList: true, subtree: true, characterData: true, attributes: true, attributeFilter: ['data-side-panel', 'data-highlighted'] });
  }
  function schedule() {
    if (timer) return;
    timer = setTimeout(run, Math.max(60, 350 - (Date.now() - lastRun)));
  }
  const observer = new MutationObserver(muts => {
    // Nos propres elements ne relancent rien.
    if (muts.every(m => m.target.closest && m.target.closest('.sh'))) return;
    hookFrame();
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

  // Raccourcis : Ctrl/Cmd K = recherche de Seal, Echap = fermer nos pages ; lettres seules hors saisie.
  let keysOpen = false;
  let goPending = 0;
  const KEYS = [['N', 'New record'], ['T', 'Today'], ['W', 'My work'], ['P', 'To publish'], ['G then a letter', 'Go to a notebook section (its first letter)'], ['/', 'Search in Seal'], ['Alt ← / Alt →', 'Back / forward'], ['Esc', 'Close Today, My work or To publish'], ['?', 'This list']];
  // Une lettre par section : la premiere lettre libre de son nom (Projects P, Protocols R).
  function sectionKeys() {
    const used = new Set(['n', 't', 'w', 'p', 'g']); const out = [];
    for (const l of appSections.filter(l => !HELP_RE.test(l))) {
      const k = [...l.toLowerCase()].find(ch => /[a-z]/.test(ch) && !out.some(o => o.key === ch));
      if (k) out.push({ key: k, label: l });
    }
    return out;
  }
  function renderKeys() {
    $('#sh-keys')?.remove();
    if (!keysOpen) return;
    const secs = sectionKeys();
    root.append(h('div', { id: 'sh-keys', class: 'sh', role: 'dialog', 'aria-label': 'Keyboard shortcuts', onclick: e => { if (e.target.id === 'sh-keys') { keysOpen = false; renderKeys(); } } },
      h('div', { class: 'sh-keys-box' },
        h('header', {}, h('h3', {}, 'Keyboard shortcuts'), h('button', { type: 'button', class: 'sh-more', onclick: () => { keysOpen = false; renderKeys(); } }, 'Close')),
        h('dl', {}, KEYS.flatMap(([k, l]) => [h('dt', {}, h('kbd', {}, k)), h('dd', {}, l)])),
        secs.length ? h('p', { class: 'sh-keys-secs' }, 'G then: ', secs.map((o, i) => h('span', {}, h('kbd', {}, o.key.toUpperCase()), ' ' + o.label + (i < secs.length - 1 ? ' · ' : '')))) : null)));
  }
  document.addEventListener('keydown', e => {
    if (!isOn('side')) return;
    const inText = e.target && (e.target.isContentEditable || /^(INPUT|TEXTAREA|SELECT)$/.test(e.target.tagName));
    if ((e.ctrlKey || e.metaKey) && !e.shiftKey && e.key.toLowerCase() === 'k' && !inText) {
      const q = $('[data-testid="nav-panel-query-button"]');
      if (q) { e.preventDefault(); press(q); }
      return;
    }
    if (e.key === 'Escape' && !inText) {
      if (keysOpen) { keysOpen = false; renderKeys(); e.preventDefault(); return; }
      if (page) { page = null; render(true); }
      return;
    }
    if (inText || e.ctrlKey || e.metaKey || e.altKey || e.repeat) return;
    if ($('[role="dialog"]:not(.sh), [role="menu"]:not(.sh):not(.sh *)')) return; // une fenetre de Seal est ouverte
    const k = e.key;
    if (goPending && Date.now() - goPending < 1500) {
      goPending = 0;
      const sec = sectionKeys().find(o => o.key === k.toLowerCase());
      if (sec) { e.preventDefault(); openAppSection(sec.label); }
      return;
    }
    if (k === '?') { e.preventDefault(); keysOpen = !keysOpen; renderKeys(); return; }
    if (k === '/') { const q = $('[data-testid="nav-panel-query-button"]'); if (q) { e.preventDefault(); press(q); } return; }
    if (e.shiftKey) return;
    const act = { n: () => { if (appCreates.length) { newOpen = true; render(true); } else { const nb = $('[data-testid="navbar-new-entity-button"]'); if (nb) press(nb); } },
      t: () => openPage('home'), w: () => openPage('work'), p: () => openPage('pub'), g: () => { goPending = Date.now(); } }[k.toLowerCase()];
    if (act) { e.preventDefault(); act(); }
  }, true);

  function applyClasses() {
    for (const k of CLASSES) root.classList.toggle('sh-' + k, !!isOn(k));
  }
  // Seal en sombre (ses variables --color-bg0) : nos elements suivent.
  function followTheme() {
    if (!document.body) return;
    let c = getComputedStyle(document.body).getPropertyValue('--color-bg0').trim();
    if (!c) { c = getComputedStyle(document.body).backgroundColor; if (/rgba\([^)]*,\s*0\)$/.test(c) || c === 'transparent') c = getComputedStyle(root).backgroundColor; }
    if (/rgba\([^)]*,\s*0\)$/.test(c) || c === 'transparent') c = '#ffffff';
    const m = c.match(/^#([0-9a-f]{3,8})$/i) || c.match(/rgba?\(\s*(\d+)[,\s]+(\d+)[,\s]+(\d+)/i);
    let lum = 1;
    if (m && m[3] !== undefined) lum = (0.2126 * m[1] + 0.7152 * m[2] + 0.0722 * m[3]) / 255;
    else if (m) { const hex = m[1].length < 6 ? m[1].split('').map(x => x + x).join('') : m[1]; lum = (0.2126 * parseInt(hex.slice(0, 2), 16) + 0.7152 * parseInt(hex.slice(2, 4), 16) + 0.0722 * parseInt(hex.slice(4, 6), 16)) / 255; }
    root.classList.toggle('sh-dark', lum < 0.4);
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

  try { chrome.storage.local.get([APP_KEY, 'sealHelperAppCreates', APPDATA_KEY, WAY_KEY, TABLES_KEY], r => {
    if (HIDE_WAYS.includes(r[WAY_KEY])) learnedWay = r[WAY_KEY];
    if (r[TABLES_KEY] && typeof r[TABLES_KEY] === 'object') appTables = r[TABLES_KEY];
    if (Array.isArray(r[APP_KEY])) appSections = r[APP_KEY];
    if (Array.isArray(r.sealHelperAppCreates)) appCreates = r.sealHelperAppCreates;
    if (r[APPDATA_KEY] && r[APPDATA_KEY].metrics) appData = r[APPDATA_KEY];
    schedule();
  }); } catch (e) {}
  chrome.storage.sync.get([KEY, LAB_KEY, 'sealHelperMigr155'], r => {
    opts = { ...DEFAULTS, ...(r[KEY] || {}) };
    if (!r.sealHelperMigr155) { opts = { ...opts, appmenu: false }; try { chrome.storage.sync.set({ [KEY]: opts, sealHelperMigr155: true }); } catch (e) {} }
    if (Array.isArray(r[LAB_KEY]) && r[LAB_KEY].length) lab = r[LAB_KEY];
    applyClasses();
    if (document.body) schedule();
    else document.addEventListener('DOMContentLoaded', schedule, { once: true });
  });
  try { chrome.runtime.onMessage.addListener((m, sender, reply) => {
    if (!m || !/^(status|diag|forget)$/.test(m.sh)) return;
    if (m.sh === 'diag') { let text = ''; try { text = diagnose(); } catch (e) { text = 'diag failed: ' + e; } reply({ text }); return; }
    if (m.sh === 'forget') {
      learnedWay = '';
      try { chrome.storage.local.remove(WAY_KEY); } catch (e) {}
      const doc = appDoc();
      unshiftFrame(appFrame()); if (doc) hiddenOf.delete(doc);
      reply({ ok: true }); return;
    }
    reply({ v: VERSION, on: !!opts.on, side: !!isOn('side'), workspace: !!$('[data-testid="platform-layout"]'), shown: !!$('#sh-side') });
  }); } catch (e) {}
  chrome.storage.onChanged.addListener((changes, area) => {
    if (area !== 'sync' || !changes[KEY]) return;
    opts = { ...DEFAULTS, ...(changes[KEY].newValue || {}) };
    clearMarks();
    refresh();
  });
})();
