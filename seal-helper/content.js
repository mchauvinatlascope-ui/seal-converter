// Seal Helper 0.2
// Ne fait que changer l affichage dans ce navigateur : n ecrit jamais dans Seal,
// n envoie rien, ne touche pas au texte d un document.
// La nouvelle barre et les pages Home / My work / To publish relisent les listes
// que Seal a deja chargees (volets Views, Entities, Changes) et, au clic, cliquent
// pour toi sur la ligne Seal d origine : la navigation reste celle de Seal.
// Si un repere de Seal disparait, la partie concernee ne s affiche pas et Seal
// reste comme d habitude.
(() => {
  const KEY = 'sealHelper';
  const DEFAULTS = { on: true, side: true, home: true, props: true, doc: true, dates: true, info: true, quiet: true };
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
    gear: '<svg viewBox="0 0 16 16"><circle cx="8" cy="8" r="2.2"/><path d="M8 1.8v1.8 M8 12.4v1.8 M1.8 8h1.8 M12.4 8h1.8 M3.6 3.6l1.3 1.3 M11.1 11.1l1.3 1.3 M3.6 12.4l1.3-1.3 M11.1 4.9l1.3-1.3"/></svg>',
    help: '<svg viewBox="0 0 16 16"><circle cx="8" cy="8" r="5.8"/><path d="M6.4 6.3a1.7 1.7 0 1 1 2.4 1.6c-.5.3-.8.6-.8 1.2v.4 M8 11.3v.1"/></svg>',
    back: '<svg viewBox="0 0 16 16"><path d="M9.5 3.5 5 8l4.5 4.5"/></svg>',
    chev: '<svg viewBox="0 0 16 16"><path d="m6 4 4 4-4 4"/></svg>',
    view: '<svg viewBox="0 0 16 16"><path d="M2.5 3.5h11v9h-11z M2.5 6.5h11 M6.5 6.5v6"/></svg>',
    star: '<svg viewBox="0 0 16 16"><path d="m8 2.5 1.7 3.5 3.8.5-2.8 2.6.7 3.8L8 11.1l-3.4 1.8.7-3.8L2.5 6.5l3.8-.5z"/></svg>',
    exp: '<svg viewBox="0 0 16 16"><path d="M6 2.5h4 M6.5 2.5v4L3 13.5h10L9.5 6.5v-4 M4.6 10.5h6.8"/></svg>',
    doc: '<svg viewBox="0 0 16 16"><path d="M4 2.5h5.5L12.5 5.5v8H4z M9.5 2.5v3h3"/></svg>',
    box: '<svg viewBox="0 0 16 16"><path d="M2.5 5 8 2.5 13.5 5v6L8 13.5 2.5 11z M2.5 5 8 7.5 13.5 5 M8 7.5v6"/></svg>',
    app: '<svg viewBox="0 0 16 16"><path d="M2.5 3h11v10h-11z M2.5 6h11"/></svg>',
    classic: '<svg viewBox="0 0 16 16"><path d="M2.5 3h11v10h-11z M6.5 3v10"/></svg>',
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
    });
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
  const isWorkspaceRoot = () => /^\/o\/[^/]+\/s\/[^/]+\/?$/.test(location.pathname);

  function onRoute() {
    if (location.pathname === lastRoute) return;
    lastRoute = location.pathname;
    closeUntil = Date.now() + 4000;
    page = isOn('home') && isWorkspaceRoot() && !guideOpened ? 'home' : null;
  }

  function go(el) {
    // Une ligne Seal : on quitte nos pages et on laisse Seal ouvrir la fiche.
    page = null;
    guideOpened = true; // Home ne s ouvre seul qu a la premiere arrivee sur l accueil

    press(el);
    render(true);
  }

  function openPage(p) {
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

    const q = $('[data-testid="nav-panel-query-button"]');
    if (q) side.append(h('button', { type: 'button', class: 'sh-search', onclick: () => press(q) },
      icon('search'), h('span', {}, 'Search'), h('kbd', {}, isMac ? '⌘K' : 'Ctrl K')));

    const top = h('div', { class: 'sh-block' });
    if (d.newBtn) top.append(sideItem('plus', 'New', { onclick: () => press(d.newBtn) }));
    top.append(sideItem('home', 'Home', { on: page === 'home', onclick: () => openPage('home') }));
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

    if (d.views.length) {
      scroll.append(h('div', { class: 'sh-group' }, 'Lists'));
      for (const v of d.views) {
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

  function buildHome(d) {
    const today = new Date().toLocaleDateString('en-NZ', { weekday: 'long', day: 'numeric', month: 'long' });
    const pend = groupChanges(d.pending);
    const summary = [today, d.pending.length ? `${d.pending.length} change${d.pending.length > 1 ? 's' : ''} to publish` : 'nothing waiting to publish'].join(' · ');
    const recent = group(d.recent).slice(0, 6);
    const mine = group(d.mine).slice(0, 6);
    return h('div', { class: 'sh-wrap' },
      h('div', { class: 'sh-hello' },
        h('div', {}, h('h1', {}, 'Home'), h('p', {}, summary)),
        h('div', { class: 'sh-actions' },
          d.newBtn ? h('button', { type: 'button', class: 'sh-btn', onclick: () => press(d.newBtn) }, icon('plus'), 'New') : null,
          h('button', { type: 'button', class: 'sh-btn ghost', onclick: () => openGuide(d) }, 'Open the lab guide'))),
      h('div', { class: 'sh-grid' },
        listCard('Continue where you left off', h('button', { type: 'button', class: 'sh-more', onclick: () => openPage('work') }, 'All my work ›'),
          recent.map(entityLine), 'Records you open will show here.'),
        listCard('To publish', pend.length ? h('button', { type: 'button', class: 'sh-more', onclick: () => openPage('pub') }, `See all ${d.pending.length} ›`) : null,
          pend.slice(0, 5).map(changeLine), 'Nothing waiting. Everything you changed is published.')),
      h('div', { class: 'sh-grid' },
        listCard('Created by you', null, mine.map(entityLine), 'Nothing yet.'),
        listCard('Favourites', null, d.favourites.map(entityLine), 'Star a record in Seal to keep it here.')));
  }

  let workFilter = '';
  function buildWork(d) {
    const all = group([...d.recent, ...d.mine]);
    const rows = all.filter(r => !workFilter || r.title.toLowerCase().includes(workFilter.toLowerCase()));
    const input = h('input', { type: 'search', id: 'sh-filter', class: 'sh-input', placeholder: 'Filter by name', value: workFilter,
      oninput: e => { workFilter = e.target.value; render(true); const i = $('#sh-filter'); if (i) { i.focus(); i.setSelectionRange(i.value.length, i.value.length); } } });
    const table = h('table', { class: 'sh-table' },
      h('thead', {}, h('tr', {}, h('th', {}, 'Name'), h('th', {}, 'Type'), h('th', {}, 'Status'), h('th', {}, ''))),
      h('tbody', {}, rows.map(r => h('tr', { onclick: () => go(r.el), tabindex: '0', onkeydown: e => e.key === 'Enter' && go(r.el) },
        h('td', {}, h('span', { class: 'sh-cell' }, icon(r.type[1]), h('b', {}, r.title), r.n > 1 ? h('span', { class: 'sh-x', title: `${r.n} records with this name` }, '×' + r.n) : null)),
        h('td', { class: 'sh-muted' }, r.type[0]), h('td', {}, pill(r.status)), h('td', { class: 'sh-go' }, 'Open ›')))));
    return h('div', { class: 'sh-wrap' },
      h('div', { class: 'sh-hello' }, h('div', {}, h('h1', {}, 'My work'), h('p', {}, 'Records you opened recently or created, same names grouped together.')), input),
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
    const sig = props.map(p => p.label + '=' + p.value).join('|');
    if (!props.length) { if (old) old.remove(); propsSig = ''; return; }
    if (old && sig === propsSig && old.previousElementSibling === header) return;
    propsSig = sig;
    const bar = h('div', { id: 'sh-props', class: 'sh' },
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
      d.changeset && [d.changeset.hash, d.changeset.name, d.changeset.rows.map(r => r.title + r.current)], !!d.newBtn, showEmpty, workFilter]);
    if (!force && sig === sideSig && $('#sh-side')) return;
    sideSig = sig;
    $('#sh-side')?.remove();
    document.body.append(buildSide(d));
    const old = $('#sh-page');
    if (page) {
      const pg = h('main', { id: 'sh-page', class: 'sh', 'aria-label': page }, page === 'home' ? buildHome(d) : page === 'work' ? buildWork(d) : buildPub(d));
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
  window.addEventListener('popstate', schedule);

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
