// Seal Helper 2.0 : ecrire.
// Tout ce qui est ici n ecrit qu a l endroit du curseur, sur un geste de l utilisateur (clic,
// raccourci, Ctrl+V), en passant par l editeur de Seal : un collage ou une frappe, que Seal
// enregistre avec son propre historique et annule avec Ctrl+Z. Rien n est envoye ailleurs.
// Le fichier vit a part de content.js : une erreur ici ne touche ni la barre ni la navigation.
(() => {
  if (window.top !== window || window.SealHelperWrite) return;
  const KEY = 'sealHelper';
  const LOCAL = 'sealHelperWrite';   // reglages d affichage, snippets, ce qu on a appris de Seal
  const BENCH = 'sealHelperBench';   // coches de paillasse, par fiche
  const DEFAULTS = { on: true, wbar: true, paste: true, values: true, slash: true };
  const VERSION = '2.0.0';
  const root = document.documentElement;
  const isMac = /Mac/.test(navigator.platform);
  const Seal = window.Seal, Detect = window.Detect, Parse = window.Parse, Edit = window.Edit, Mix = window.Mix;
  let opts = { ...DEFAULTS };
  let local = { view: { size: 'm', width: 'seal', face: 'seal', focus: false, sticky: false }, snippets: [], sealSlash: false };
  let benchAll = {};
  const isOn = k => opts.on && opts[k];
  const $ = (s, el = document) => el.querySelector(s);
  const $$ = (s, el = document) => Array.from(el.querySelectorAll(s));
  const wait = ms => new Promise(r => setTimeout(r, ms));
  const esc = s => Seal.esc(s);
  const saveLocal = () => { try { chrome.storage.local.set({ [LOCAL]: local }); } catch (e) {} };

  function h(tag, attrs, ...kids) {
    const el = document.createElement(tag);
    for (const [k, v] of Object.entries(attrs || {})) {
      if (v === null || v === undefined || v === false) continue;
      if (k === 'html') el.innerHTML = v;
      else if (k.startsWith('on')) el.addEventListener(k.slice(2), v);
      else el.setAttribute(k, v === true ? '' : v);
    }
    for (const kid of kids.flat(3)) if (kid !== null && kid !== undefined && kid !== false) el.append(kid);
    return el;
  }
  // Un bouton de nos barres ne prend jamais le focus : le curseur reste dans le texte.
  const keep = e => e.preventDefault();
  const btn = (label, title, onclick, cls = '') => h('button', { type: 'button', class: 'sh-wb ' + cls, title, onmousedown: keep, onclick }, label);

  // ------------------------------------------------------------ ou est le texte de la fiche
  const DOC = '[data-native-document-editor], [data-testid="native-document-editor"], [data-native-document-root]';
  function docRoot() {
    const all = $$(DOC).filter(el => !el.closest('.sh') && el.getClientRects().length);
    if (all.length) return all.find(el => !all.some(o => o !== el && o.contains(el))) || all[0];
    // Reperes de Seal absents : la plus grande zone de texte modifiable de la page.
    let best = null, area = 0;
    for (const el of $$('[contenteditable="true"], [contenteditable=""]')) {
      if (el.closest('.sh') || (el.parentElement && el.parentElement.isContentEditable)) continue;
      const r = el.getBoundingClientRect(); const a = r.width * r.height;
      if (a > area && r.height > 80) { best = el; area = a; }
    }
    return best;
  }
  // La zone modifiable qui contient ce noeud (la plus haute), ou rien : champs de titre exclus.
  function editorOf(node) {
    let el = node && (node.nodeType === 1 ? node : node.parentElement);
    if (!el || !el.isContentEditable || el.closest('.sh')) return null;
    while (el.parentElement && el.parentElement.isContentEditable) el = el.parentElement;
    if (el.getAttribute('contenteditable') === 'plaintext-only') return null;
    const known = !!$(DOC + ', [data-native-block-type]');
    if (known && !(el.closest(DOC) || el.closest('[data-native-block-type]') || $('[data-native-block-type]', el) || $(DOC, el))) return null;
    return el;
  }
  // Derniere position connue du curseur dans la fiche : les boutons et les fenetres y reviennent.
  let cur = { ed: null, range: null };
  function noteSelection() {
    const sel = document.getSelection();
    if (!sel || !sel.rangeCount) return;
    const ed = editorOf(sel.anchorNode);
    if (!ed) return;
    cur = { ed, range: sel.getRangeAt(0).cloneRange() };
  }
  const editing = () => !!(cur.ed && cur.ed.isConnected && document.activeElement && (cur.ed === document.activeElement || cur.ed.contains(document.activeElement) || document.activeElement.contains(cur.ed)) && editorOf(document.getSelection().anchorNode));
  function restore() {
    if (!cur.ed || !cur.ed.isConnected) return false;
    try {
      // Le curseur est deja dans la fiche : on le laisse ou il est (un editeur redessine ses noeuds en ecrivant).
      const live = document.getSelection(); const act = document.activeElement;
      if (live && live.rangeCount && editorOf(live.anchorNode) === cur.ed && act && (act === cur.ed || cur.ed.contains(act))) return true;
      if (!cur.range || !cur.range.startContainer.isConnected) return false;
      cur.ed.focus({ preventScroll: true });
      const sel = document.getSelection(); sel.removeAllRanges(); sel.addRange(cur.range);
      return true;
    } catch (e) { return false; }
  }
  const selText = () => { const s = document.getSelection(); return s && s.rangeCount && editorOf(s.anchorNode) ? s.toString() : ''; };
  const anchorEl = () => { const n = document.getSelection().anchorNode; return n ? (n.nodeType === 1 ? n : n.parentElement) : cur.ed; };

  // ------------------------------------------------------------ ecrire au curseur
  // Trois voies, dans l ordre : un collage rendu a l editeur de Seal (il lit le presse-papiers de
  // l evenement comme pour Ctrl+V), puis insertHTML, puis du texte simple. Le Diagnostic dit laquelle a pris.
  let ours = false;
  let lastInsert = 'none yet';
  async function insertHtml(html, plain, { fresh = false } = {}) {
    if (!fresh && !restore()) { toast('Click in the text of the record first, then try again.', 'warn'); return false; }
    await wait(40); // l editeur relit la selection apres selectionchange
    const ed = cur.ed; const before = ed.textContent.length;
    let way = '';
    try {
      const dt = new DataTransfer(); dt.setData('text/html', html); dt.setData('text/plain', plain === undefined ? html.replace(/<[^>]+>/g, '') : plain);
      const ev = new ClipboardEvent('paste', { clipboardData: dt, bubbles: true, cancelable: true });
      ours = true; const untouched = (anchorEl() || ed).dispatchEvent(ev); ours = false;
      if (!untouched) way = 'paste';
    } catch (e) { ours = false; }
    if (!way) {
      await wait(90); restore(); // un editeur qui attendait un vrai collage a pu deplacer le focus
      try { if (document.execCommand('insertHTML', false, html)) way = 'insertHTML'; } catch (e) {}
    }
    if (!way) { try { if (document.execCommand('insertText', false, plain || '')) way = 'insertText'; } catch (e) {} }
    await wait(60);
    lastInsert = (way || 'refused') + ' (' + (ed.isConnected ? ed.textContent.length - before : '?') + ' chars)';
    if (!way) toast('Seal did not accept this here. Nothing was changed.', 'warn');
    noteSelection();
    return !!way;
  }
  async function insertText(text) {
    if (!restore()) { toast('Click in the text of the record first, then try again.', 'warn'); return false; }
    let ok = false;
    try { ok = document.execCommand('insertText', false, text); } catch (e) {}
    if (!ok) return insertHtml(esc(text), text);
    lastInsert = 'insertText'; noteSelection();
    return true;
  }
  // Un raccourci clavier rendu a l editeur (Ctrl+B, Ctrl+Z) : vrai si l editeur l a pris.
  function sendKey(k, shift) {
    const code = k.toUpperCase().charCodeAt(0);
    const ev = new KeyboardEvent('keydown', { key: k, code: 'Key' + k.toUpperCase(), keyCode: code, which: code, ctrlKey: !isMac, metaKey: isMac, shiftKey: !!shift, bubbles: true, cancelable: true });
    ours = true; const untouched = (anchorEl() || cur.ed).dispatchEvent(ev); ours = false;
    return !untouched;
  }
  function format(cmd, k) { if (!restore()) return; if (!sendKey(k)) { try { document.execCommand(cmd); } catch (e) {} } noteSelection(); }
  function undo() { if (!restore()) return; if (!sendKey('z')) { try { document.execCommand('undo'); } catch (e) {} } }
  const oneBlock = s => s && !/[\r\n]/.test(s.trim());
  async function makeValue() {
    restore(); const s = selText();
    if (!s.trim()) return toast('Select the value first, for example “30 min”, then press Value.', 'info');
    if (!oneBlock(s)) return toast('Value works inside one paragraph at a time.', 'info');
    const inBlue = anchorEl() && anchorEl().closest('[data-native-color="blue"]');
    await insertHtml(inBlue ? esc(s) : Seal.value(s), s);
  }
  async function clearFormat() {
    restore(); const s = selText();
    if (!s.trim()) return toast('Select the words to clear first.', 'info');
    if (!oneBlock(s)) return toast('Clear works inside one paragraph at a time.', 'info');
    await insertHtml(esc(s), s);
  }

  // ------------------------------------------------------------ nettoyer un collage (moteur de seal-converter)
  const BULLET = '\uE000', NUMBER = '\uE001'; // marques privees, retirees avant de rendre le texte
  const FROM_OFFICE = /class="?Mso|mso-[a-z]|urn:schemas-microsoft-com|docs-internal-guid|<google-sheets-html-origin/i;
  const HAS_BLOCKS = /<(table|li|h[1-6])[\s>]/i;
  const needsCleaning = html => !!html && !/data-native-/.test(html) && (FROM_OFFICE.test(html) || HAS_BLOCKS.test(html));
  function runsHtml(runs, values) {
    if (values) return Parse.runsToHtml(runs);
    let space = true;
    return Edit.renderRuns(runs.map(r => { let t = r.text.replace(/\s+/g, ' '); if (space) t = t.replace(/^ /, ''); if (t) space = t.endsWith(' '); return { ...r, text: t }; })).trim();
  }
  // HTML quelconque (Word, Excel, Google Docs, page web) -> le balisage que Seal garde, structure conservee :
  // titres, listes avec leurs sous-niveaux, tableaux, gras, italique, liens, valeurs en bleu.
  function cleanHtml(html, { values = true } = {}) {
    const doc = new DOMParser().parseFromString(html, 'text/html');
    // Puces ou numeros : note avant que le moteur n enleve les marqueurs de Word.
    for (const li of $$('li', doc)) li.prepend(doc.createTextNode(li.parentElement && li.parentElement.tagName === 'UL' ? BULLET : NUMBER));
    for (const p of $$('p[class*="MsoList"]', doc)) {
      const mark = $('[style*="mso-list:Ignore"], [style*="mso-list: Ignore"]', p);
      const t = mark ? mark.textContent.trim() : '';
      p.prepend(doc.createTextNode(/^[\dA-Za-z]{1,4}[.)]/.test(t) ? NUMBER : BULLET));
    }
    const stats = { steps: 0, subs: 0, tables: 0, values: 0 };
    const blocks = Parse.htmlToBlocks(doc.body.innerHTML);
    const take = b => { // retire notre marque et dit si c est une puce
      let bullet = null;
      for (const r of b.runs) { const m = r.text.match(/[\uE000\uE001]/); if (m) { bullet = m[0] === BULLET; break; } }
      return { runs: b.runs.map(r => ({ ...r, text: r.text.replace(/[\uE000\uE001]/g, '') })), bullet };
    };
    const levels = blocks.filter(b => b.kind === 'heading').map(b => b.level);
    const top = levels.length ? Math.min(...levels) : 0;
    let out = '';
    for (let i = 0; i < blocks.length; i++) {
      const b = blocks[i];
      if (b.kind === 'heading') { const t = runsHtml(take(b).runs, false); if (t) out += b.level <= top ? `<h2>${t}</h2>` : `<h3>${t}</h3>`; }
      else if (b.kind === 'item') {
        const items = [];
        while (i < blocks.length && (blocks[i].kind === 'item' || (blocks[i].kind === 'para' && (blocks[i].depth || 0) > 0 && items.length))) items.push(blocks[i++]);
        i--;
        const base = Math.min(...items.map(x => x.depth || 0));
        const tags = []; let d = -1;
        for (const it of items) {
          const k = Math.max(0, Math.min((it.depth || 0) - base, d + 1));
          const { runs, bullet } = take(it);
          const tag = bullet === null ? (k <= d && tags[k] ? tags[k] : 'ol') : bullet ? 'ul' : 'ol';
          if (k > d) { tags.push(tag); out += `<${tag}>`; d = k; }
          else {
            out += '</li>'; while (d > k) { out += `</${tags.pop()}></li>`; d--; }
            // Des puces apres des numeros, au meme niveau : une autre liste.
            if (tags[d] !== tag) { out += `</${tags.pop()}><${tag}>`; tags.push(tag); }
          }
          out += '<li>' + runsHtml(runs, values);
          if (k === 0) stats.steps++; else stats.subs++;
        }
        out += '</li>'; while (tags.length > 1) out += `</${tags.pop()}></li>`;
        out += `</${tags.pop()}>`;
      }
      else if (b.kind === 'para' || b.kind === 'line') { const t = runsHtml(take(b).runs, values); if (t) out += `<p>${t}</p>`; }
      else if (b.kind === 'table') {
        const cell = runs => runsHtml(take({ runs }).runs, values);
        out += Seal.rawTable(b.head ? b.head.map(cell) : null, b.rows.map(r => r.map(cell))); stats.tables++;
      }
      else if (b.kind === 'image') out += Seal.image(b.src, b.alt);
    }
    stats.values = (out.match(/data-native-color="blue"/g) || []).length;
    // Un seul paragraphe : il se colle dans la ligne, sans en ouvrir une autre.
    const single = blocks.length === 1 && blocks[0].kind === 'para';
    return { html: single ? out.replace(/^<p>|<\/p>$/g, '') : out, stats };
  }
  const plainOf = html => html.replace(/<\/(p|li|h[1-6]|tr)>/gi, '\n').replace(/<\/t[dh]>/gi, '\t').replace(/<[^>]+>/g, '').replace(/&amp;/g, '&').replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&quot;/g, '"').trim();
  const plural = (n, w) => n + ' ' + w + (n === 1 ? '' : 's');

  let rawV = 0; // Ctrl+Shift+V : le collage de Seal, sans nous
  document.addEventListener('keydown', e => { if (!ours && e.key && e.key.toLowerCase() === 'v' && (e.ctrlKey || e.metaKey) && e.shiftKey) rawV = Date.now(); }, true);
  document.addEventListener('paste', e => {
    if (ours || !isOn('paste') || Date.now() - rawV < 800) return;
    const ed = editorOf(e.target);
    if (!ed || !e.clipboardData) return;
    const html = e.clipboardData.getData('text/html');
    if (!needsCleaning(html)) return;
    let res = null;
    try { res = cleanHtml(html, { values: isOn('values') }); } catch (err) { console.warn('[Seal Helper] clean paste', err); return; }
    if (!res.html) return;
    const text = e.clipboardData.getData('text/plain') || plainOf(res.html);
    e.preventDefault(); e.stopImmediatePropagation();
    noteSelection();
    insertHtml(res.html, text, { fresh: true }).then(ok => {
      if (!ok) return;
      const s = res.stats;
      const parts = [s.steps && plural(s.steps, 'step'), s.subs && plural(s.subs, 'sub-step'), s.tables && plural(s.tables, 'table'), s.values && plural(s.values, 'value') + ' marked'].filter(Boolean);
      toast('Pasted clean' + (parts.length ? ': ' + parts.join(', ') : '') + '.', 'ok', 9000, [
        ['Undo', () => undo()],
        ['Paste as it was', async () => { undo(); await wait(120); noteSelection(); await insertHtml(html, text); }]]);
    });
  }, true);

  // ------------------------------------------------------------ message en bas, avec actions
  let toastTimer = 0;
  function hideToast() { const t = $('#sh-wtoast'); if (t) t.remove(); }
  function toast(msg, kind = 'info', ms = 4500, actions = []) {
    $('#sh-wtoast')?.remove();
    const el = h('div', { id: 'sh-wtoast', class: 'sh ' + kind, role: 'status' }, h('span', {}, msg),
      actions.map(([label, run]) => h('button', { type: 'button', onmousedown: keep, onclick: () => { el.remove(); run(); } }, label)));
    root.append(el);
    clearTimeout(toastTimer); toastTimer = setTimeout(() => el.remove(), ms);
  }

  // ------------------------------------------------------------ fenetres et menus (un seul ouvert)
  let pop = null; // { el, kind, close }
  function closePop() { if (pop) { pop.el.remove(); const p = pop; pop = null; if (p.onclose) p.onclose(); } }
  function openPop(kind, el, anchor, opt = {}) {
    closePop(); hideToast();
    const bubble = $('#sh-wbubble'); if (bubble) bubble.remove();
    el.classList.add('sh', 'sh-wpop'); el.dataset.kind = kind;
    root.append(el);
    pop = { el, kind, anchor, ...opt };
    place(el, anchor, opt.above);
    return el;
  }
  // Pose un menu pres d un rectangle, sans sortir de la fenetre.
  function place(el, anchor, above) {
    const a = anchor && anchor.getBoundingClientRect ? anchor.getBoundingClientRect() : anchor || { left: innerWidth / 2, right: innerWidth / 2, top: innerHeight / 2, bottom: innerHeight / 2 };
    const r = el.getBoundingClientRect();
    let top = above ? a.top - r.height - 8 : a.bottom + 6;
    if (top + r.height > innerHeight - 8) top = a.top - r.height - 8;
    if (top < 8) top = Math.max(8, Math.min(a.bottom + 6, innerHeight - r.height - 8));
    const left = Math.max(8, Math.min(a.left, innerWidth - r.width - 8));
    el.style.top = Math.round(top) + 'px'; el.style.left = Math.round(left) + 'px';
  }
  function caretRect() {
    const sel = document.getSelection();
    if (sel && sel.rangeCount) {
      const rs = sel.getRangeAt(0).getClientRects(); if (rs.length) return rs[rs.length - 1];
      const el = anchorEl(); if (el) { const r = el.getBoundingClientRect(); return { left: r.left, right: r.left, top: r.top, bottom: r.bottom }; }
    }
    return null;
  }
  document.addEventListener('mousedown', e => { if (pop && !pop.el.contains(e.target) && !(e.target.closest && e.target.closest('#sh-wbar, #sh-wbubble'))) closePop(); else if (!pop && menu) menu = null; }, true);

  // ------------------------------------------------------------ blocs : tableau, mix, modeles, snippets
  const today = () => new Date().toLocaleDateString('en-NZ', { day: 'numeric', month: 'short', year: 'numeric' });
  const clock = (t = Date.now()) => new Date(t).toLocaleTimeString('en-NZ', { hour: '2-digit', minute: '2-digit', hour12: false });
  const tableHtml = (rows, cols, head) => Seal.rawTable(head ? Array.from({ length: cols }, () => '') : null, Array.from({ length: rows }, () => Array.from({ length: cols }, () => '')));
  const sectionHtml = list => list.map(([t, hint]) => `<h2>${esc(t)}</h2><p><em>(${esc(hint)})</em></p>`).join('');
  const TEMPLATES = [
    ['Flow staining', 'Aim, samples, panel, staining, acquisition, analysis, results', [['Aim', 'the question this experiment answers'], ['Samples and groups', 'tissue, groups, n per group, controls and FMOs'], ['Panel and antibody mix', 'markers, fluorochromes, dilutions, mix volumes'], ['Staining', 'steps with times, temperatures and volumes'], ['Acquisition', 'cytometer, settings, events recorded'], ['Analysis', 'gating strategy, software, statistics'], ['Results and conclusion', 'what the data show, what to do next']]],
    ['ELISA', 'Aim, samples, plate layout, protocol, standard curve, results', [['Aim', 'the question this experiment answers'], ['Samples and dilutions', 'samples, dilutions, replicates'], ['Plate layout', 'standards, blanks and samples on the plate'], ['Protocol', 'coating, blocking, incubations, washes, substrate'], ['Standard curve and read', 'reader, wavelength, fit'], ['Results and conclusion', 'what the data show, what to do next']]],
    ['qPCR', 'Aim, samples, primers, plate, cycling, results', [['Aim', 'the question this experiment answers'], ['Samples and RNA', 'samples, extraction, RNA quantity and quality'], ['cDNA synthesis', 'kit, input, conditions'], ['Primers and plate layout', 'targets, reference genes, replicates'], ['Cycling', 'instrument and programme'], ['Results and conclusion', 'what the data show, what to do next']]],
    ['Mouse cohort', 'Aim, animals, groups, timeline, procedures, readouts', [['Aim', 'the question this experiment answers'], ['Animals and groups', 'strain, sex, age, n per group, ethics approval'], ['Timeline', 'day 0, treatments, bleeds, end point'], ['Procedures', 'immunisation, dosing, monitoring'], ['Readouts and conclusion', 'tissues collected, assays, what to do next']]],
  ];
  function blockItems() {
    const snips = local.snippets || [];
    return [
      { g: 'Blocks', t: 'Antibody mix', s: 'calculated from a panel', run: openMix },
      { g: 'Blocks', t: 'Table', s: 'choose rows and columns', run: openTable },
      { g: 'Blocks', t: 'Buffer recipe', s: 'component, stock, final, volume', run: () => insertHtml(Seal.rawTable(['Component', 'Stock', 'Final', 'Volume'].map(Seal.bold), [['', '', '', ''], ['', '', '', ''], [Seal.bold('Total'), '', '', '']])) },
      { g: 'Blocks', t: 'Deviation', s: 'dated note', run: () => insertHtml(`<p><strong>Deviation (${esc(today())}, ${clock()}):</strong> </p>`) },
      { g: 'Blocks', t: 'Date', s: today(), run: () => insertText(today()) },
      { g: 'Blocks', t: 'Time', s: clock(), run: () => insertText(clock()) },
      ...TEMPLATES.map(([t, s, list]) => ({ g: 'Experiment templates', t, s: list.length + ' sections', title: s, run: () => insertHtml(sectionHtml(list)) })),
      ...snips.map((sn, n) => ({ g: 'My snippets', t: sn.name, s: 'saved ' + sn.date, run: () => insertHtml(sn.html, sn.text), del: () => { local.snippets.splice(n, 1); saveLocal(); } })),
      ...(selText().trim() ? [{ g: 'My snippets', t: 'Save the selection as a snippet…', s: '', run: openSaveSnippet }] : []),
    ];
  }
  // Le menu s ouvre par le bouton Blocks, par Ctrl+J, ou en tapant « / » : dans ce dernier cas le
  // texte tape reste dans la fiche pendant qu on filtre, puis il est retire au moment de choisir.
  let menu = null; // { typed: nombre de caracteres tapes dans la fiche, q, idx, items }
  function openBlocks(typed) {
    if (!cur.ed) return toast('Click in the text of the record first.', 'info');
    closePop();
    // L etat existe tout de suite : les lettres tapees juste apres « / » sont comptees meme si le menu n est pas encore dessine.
    const mine = menu = { typed: typed ? 1 : 0, slash: !!typed, q: '', idx: 0, items: blockItems() };
    const show = () => {
      if (menu !== mine) return;
      if (typed) noteSelection();
      openPop('blocks', h('div', { role: 'listbox', 'aria-label': 'Blocks' }), caretRect() || $('#sh-wbar'), { onclose: () => { if (menu === mine) menu = null; } });
      menu = mine; drawBlocks();
    };
    if (typed) setTimeout(show, 0); else show();
  }
  function drawBlocks() {
    if (!menu) return;
    const q = menu.q.toLowerCase();
    menu.items = blockItems().filter(it => !q || it.t.toLowerCase().includes(q) || it.g.toLowerCase().includes(q));
    menu.idx = Math.max(0, Math.min(menu.idx, menu.items.length - 1));
    if (!pop || pop.kind !== 'blocks') return;
    const el = pop.el; el.textContent = '';
    if (!menu.slash) el.append(h('div', { class: 'sh-wq' }, menu.q ? 'Filter: ' + menu.q : 'Type to filter, Enter to insert'));
    let g = '';
    menu.items.forEach((it, n) => {
      if (it.g !== g) { g = it.g; el.append(h('div', { class: 'sh-wgrp' }, g)); }
      el.append(h('div', { class: 'sh-wmi' + (n === menu.idx ? ' on' : ''), role: 'option', 'aria-selected': n === menu.idx ? 'true' : 'false', title: it.title || null, onmousedown: keep, onclick: e => { if (e.target.closest('.sh-wdel')) return; pick(n); } },
        h('span', {}, it.t), h('small', {}, it.s),
        it.del ? h('button', { type: 'button', class: 'sh-wdel', title: 'Delete this snippet', onmousedown: keep, onclick: () => { it.del(); drawBlocks(); } }, '×') : null));
    });
    if (!menu.items.length) el.append(h('div', { class: 'sh-wq' }, 'Nothing matches “' + menu.q + '”. Esc closes.'));
    const on = $('.sh-wmi.on', el); if (on && on.scrollIntoView) on.scrollIntoView({ block: 'nearest' });
  }
  async function pick(n) {
    const it = menu && menu.items[n]; if (!it) return;
    const typed = menu.typed;
    menu = null; closePop();
    if (typed) { // retire « /mix » de la fiche avant d inserer
      restore();
      const sel = document.getSelection();
      for (let k = 0; k < typed; k++) sel.modify('extend', 'backward', 'character');
      try { document.execCommand('delete'); } catch (e) {}
      await wait(30); noteSelection();
    }
    it.run();
  }
  function menuKey(e) {
    if (!menu) return false;
    const shut = () => { menu = null; closePop(); };
    const stop = () => { e.preventDefault(); e.stopImmediatePropagation(); };
    if (e.key === 'ArrowDown') { menu.idx = (menu.idx + 1) % Math.max(1, menu.items.length); stop(); drawBlocks(); return true; }
    if (e.key === 'ArrowUp') { menu.idx = (menu.idx - 1 + menu.items.length) % Math.max(1, menu.items.length); stop(); drawBlocks(); return true; }
    if (e.key === 'Enter' || e.key === 'Tab') { if (menu.items.length) { stop(); pick(menu.idx); } else shut(); return true; }
    if (e.key === 'Escape') { stop(); shut(); return true; }
    if (e.ctrlKey || e.metaKey || e.altKey) return false;
    if (e.key === 'Backspace') {
      if (menu.slash) { if (!menu.q) { shut(); return false; } menu.q = menu.q.slice(0, -1); menu.typed--; drawBlocks(); return false; }
      menu.q = menu.q.slice(0, -1); stop(); drawBlocks(); return true;
    }
    if (e.key.length === 1) {
      if (menu.slash) { if (e.key === ' ' && !blockItems().some(it => it.t.toLowerCase().includes((menu.q + ' ').toLowerCase()))) { shut(); return false; } menu.q += e.key; menu.typed++; menu.idx = 0; drawBlocks(); return false; }
      menu.q += e.key; menu.idx = 0; stop(); drawBlocks(); return true;
    }
    return false;
  }
  // Seal a-t-il son propre menu « / » ? S il en ouvre un, on lui laisse la touche pour de bon.
  const sealMenuOpen = () => $$('[role="listbox"], [role="menu"], [data-radix-popper-content-wrapper], [data-floating-ui-portal] > *').some(el => !el.closest('.sh') && el.getClientRects().length);
  document.addEventListener('keydown', e => {
    if (ours || !opts.on) return;
    if (menuKey(e)) return;
    if (e.key === 'Escape' && pop) { closePop(); return; }
    if (e.key === 'Escape' && benchOpen) { closeBench(); return; }
    const inEd = !!editorOf(e.target);
    if ((e.ctrlKey || e.metaKey) && !e.shiftKey && !e.altKey && e.key.toLowerCase() === 'j' && isOn('wbar') && (inEd || cur.ed)) {
      e.preventDefault(); e.stopImmediatePropagation(); if (inEd) noteSelection(); openBlocks(false); return;
    }
    if (e.key === '/' && inEd && isOn('slash') && !local.sealSlash && !e.ctrlKey && !e.metaKey && !e.altKey && !pop && !menu) {
      const sel = document.getSelection(); const n = sel.anchorNode;
      const prev = n && n.nodeType === 3 && sel.anchorOffset > 0 ? n.nodeValue[sel.anchorOffset - 1] : '';
      if (prev && !/\s/.test(prev)) return; // au milieu d un mot ou d une fraction : c est une barre oblique
      noteSelection(); openBlocks(true);
      setTimeout(() => {
        setTimeout(() => {
          if (!menu || !menu.slash || !sealMenuOpen()) return;
          menu = null; closePop(); local.sealSlash = true; saveLocal();
          toast('Seal has its own “/” menu. Blocks stays in the bar and on ' + (isMac ? '⌘J' : 'Ctrl J') + '.', 'info', 7000);
        }, 320);
      }, 0);
    }
  }, true);

  function field(label, input) { return h('label', { class: 'sh-wf' }, h('span', {}, label), input); }
  function openTable() {
    const rows = h('input', { type: 'number', min: 1, max: 60, value: 3 }), cols = h('input', { type: 'number', min: 1, max: 12, value: 3 });
    const head = h('input', { type: 'checkbox', checked: true });
    const go = () => { const r = Math.max(1, Math.min(60, +rows.value || 1)), c = Math.max(1, Math.min(12, +cols.value || 1)); closePop(); insertHtml(tableHtml(r, c, head.checked)); };
    const el = h('form', { onsubmit: e => { e.preventDefault(); go(); } }, h('h3', {}, 'Table'),
      h('div', { class: 'sh-wrow' }, field('Rows', rows), field('Columns', cols)),
      h('label', { class: 'sh-wcheck' }, head, 'First row is a header'),
      h('div', { class: 'sh-wact' }, h('button', { type: 'button', onclick: closePop }, 'Cancel'), h('button', { type: 'submit', class: 'pri' }, 'Insert table')));
    openPop('table', el, caretRect() || $('#sh-wbar'));
    rows.focus(); rows.select();
  }
  function openSaveSnippet() {
    restore(); const sel = document.getSelection(); if (!sel.rangeCount || !sel.toString().trim()) return;
    const box = h('div', {}); box.append(sel.getRangeAt(0).cloneContents());
    const text = sel.toString();
    let html = '';
    try { html = cleanHtml(box.innerHTML, { values: false }).html; } catch (e) {}
    if (!html) html = esc(text);
    const name = h('input', { type: 'text', maxlength: 40, value: text.trim().replace(/\s+/g, ' ').slice(0, 32) });
    const go = () => { local.snippets = [...(local.snippets || []), { name: name.value.trim() || 'Snippet', html, text, date: today().replace(/ \d{4}$/, '') }].slice(-40); saveLocal(); closePop(); toast('Snippet saved. Find it under Blocks, My snippets.', 'ok'); };
    const el = h('form', { onsubmit: e => { e.preventDefault(); go(); } }, h('h3', {}, 'Save as a snippet'), field('Name', name),
      h('p', { class: 'sh-wnote' }, 'Kept in this browser only.'),
      h('div', { class: 'sh-wact' }, h('button', { type: 'button', onclick: closePop }, 'Cancel'), h('button', { type: 'submit', class: 'pri' }, 'Save')));
    openPop('snippet', el, caretRect() || $('#sh-wbar'));
    name.focus(); name.select();
  }
  // Mix d anticorps : les regles de la feuille du labo (seal-converter), pose en tableau ordinaire.
  const µL = v => (Math.round(v * 10) / 10).toFixed(1).replace(/\.0$/, '') + ' µL';
  function mixHtml(mix, o) {
    const val = t => Seal.value(t);
    return `<p><strong>Samples:</strong> ${val(String(o.samples))}, <strong>excess:</strong> ${val(o.excess + ' %')}, <strong>volume per test:</strong> ${val(µL(o.vf))}, <strong>total:</strong> ${val(µL(mix.vTotal))}.</p>`
      + Seal.rawTable(['Reagent', 'Dilution', 'Volume'].map(Seal.bold), [
        ...(o.bsb ? [[Seal.bold('Brilliant Stain Buffer'), '', val(µL(mix.bsb))]] : []),
        ...mix.rows.map(r => [Seal.bold(r.name), val('1:' + r.dilution), val(µL(r.volume))]),
        [Seal.bold(o.buffer || 'PBS'), '', val(µL(o.bsb ? mix.pbs : mix.pbs + mix.bsb))],
        [Seal.bold('Total'), '', val(µL(mix.vTotal))]]);
  }
  function openMix() {
    const panel = h('textarea', { rows: 6, spellcheck: 'false', placeholder: 'Marker\tFluorochrome\tDilution\nCXCR5\tBV421\t1:50\nPD-1\tPE-Cy7\t1:100' });
    const samples = h('input', { type: 'number', min: 1, value: 12 }), excess = h('input', { type: 'number', min: 0, value: 10 }), vf = h('input', { type: 'number', min: 1, value: 50 });
    const bsb = h('input', { type: 'checkbox' }), buffer = h('input', { type: 'text', value: 'FACS buffer' });
    const out = h('div', { class: 'sh-wprev' });
    let html = '';
    const calc = () => {
      html = '';
      const lines = panel.value.split(/\r?\n/).map(l => l.split(/\t| {2,}|;/).map(c => c.trim())).filter(r => r.some(Boolean));
      if (!lines.length) { out.textContent = 'Paste the panel from Excel, header line first. Only the Dilution column is needed (1:200, 1/200 or 200).'; return; }
      let abs = [];
      try { abs = Mix.readPanel(lines); } catch (e) {}
      if (!abs.length) { // sans ligne d en-tete : nom puis dilution
        abs = lines.map(r => ({ marker: r[0], dilution: Mix.readDilution(r[r.length - 1]) })).filter(a => a.dilution);
      }
      const o = { samples: +samples.value || 1, excess: +excess.value || 0, vf: +vf.value || 50, bsb: bsb.checked, buffer: buffer.value.trim() };
      const mix = Mix.computeMix({ antibodies: abs, samples: o.samples, excess: o.excess, vf: o.vf });
      if (!mix.rows.length) { out.textContent = 'No dilution found yet. Add a Dilution column, or put the dilution last on each line.'; return; }
      html = mixHtml(mix, o);
      out.innerHTML = html + (mix.warnings.length ? `<p class="sh-wwarn">${esc(mix.warnings.join(' '))}</p>` : '');
      if (pop && pop.kind === 'mix') place(pop.el, pop.anchor);
    };
    const go = () => { if (!html) return; closePop(); insertHtml(html); };
    const el = h('form', { class: 'wide', oninput: calc, onsubmit: e => { e.preventDefault(); go(); } }, h('h3', {}, 'Antibody mix'),
      field('Panel (paste from Excel)', panel),
      h('div', { class: 'sh-wrow' }, field('Samples', samples), field('Excess %', excess), field('µL per test', vf)),
      h('div', { class: 'sh-wrow' }, field('Top up with', buffer), h('label', { class: 'sh-wcheck' }, bsb, 'Brilliant Stain Buffer (half)')),
      out,
      h('div', { class: 'sh-wact' }, h('button', { type: 'button', onclick: closePop }, 'Cancel'), h('button', { type: 'submit', class: 'pri' }, 'Insert mix')));
    openPop('mix', el, caretRect() || $('#sh-wbar'));
    calc(); panel.focus();
  }
  const SYMBOLS = ['µ', '°C', '°', '±', '×', '÷', '→', '←', '≥', '≤', '≈', '≠', 'α', 'β', 'γ', 'δ', 'ε', 'κ', 'λ', 'Δ', '⁺', '⁻', '²', '³', '⁶', '₂', '½', '‰'];
  function openSymbols(anchor) {
    if (pop && pop.kind === 'symbols') return closePop();
    openPop('symbols', h('div', { class: 'sh-wsym' }, SYMBOLS.map(s => h('button', { type: 'button', onmousedown: keep, onclick: () => insertText(s) }, s))), anchor, { above: true });
  }

  // ------------------------------------------------------------ confort de lecture (affichage seul)
  const VIEW = { size: ['s', 'm', 'l'], width: ['read', 'seal', 'full'], face: ['seal', 'atk', 'serif'] };
  let hasDoc = false;
  function applyView() {
    const v = local.view || {};
    for (const [k, list] of Object.entries(VIEW)) for (const x of list) root.classList.toggle(`sh-v-${k}-${x}`, opts.on && hasDoc && v[k] === x);
    root.classList.toggle('sh-v-focus', !!(opts.on && hasDoc && v.focus && !benchOpen));
    root.classList.toggle('sh-v-sticky', !!(opts.on && hasDoc && v.sticky));
  }
  function setView(patch) { local.view = { ...local.view, ...patch }; saveLocal(); applyView(); }
  function openView(anchor) {
    if (pop && pop.kind === 'view') return closePop();
    const seg = (key, labels) => h('div', { class: 'sh-wseg', role: 'group' }, VIEW[key].map((x, n) => h('button', { type: 'button', 'aria-pressed': (local.view[key] || VIEW[key][1]) === x ? 'true' : 'false', onclick: () => { setView({ [key]: x }); openView(anchor); openView(anchor); } }, labels[n])));
    const sw = (key, label) => h('label', { class: 'sh-wcheck' }, h('input', { type: 'checkbox', checked: !!local.view[key], onchange: e => setView({ [key]: e.target.checked }) }), label);
    openPop('view', h('div', {}, h('h3', {}, 'Reading comfort'),
      h('div', { class: 'sh-wf' }, h('span', {}, 'Text size'), seg('size', ['Small', 'Seal', 'Large'])),
      h('div', { class: 'sh-wf' }, h('span', {}, 'Page width'), seg('width', ['Reading', 'Seal', 'Full'])),
      h('div', { class: 'sh-wf' }, h('span', {}, 'Typeface'), seg('face', ['Seal', 'Atkinson', 'Serif'])),
      sw('focus', 'Focus: hide the sidebar and panels'), sw('sticky', 'Keep table headers in view'),
      h('p', { class: 'sh-wnote' }, 'Only you see these settings. Nothing is written to the record.')), anchor, { above: true });
  }

  // ------------------------------------------------------------ mode paillasse
  const hash = s => { let x = 0; for (let k = 0; k < s.length; k++) x = (x * 31 + s.charCodeAt(k)) | 0; return (x >>> 0).toString(36); };
  const LIST_BLOCK = /^(li|ol|ul|list|numbered|bullet|ordered|unordered|step|todo|check)/i;
  const DURATION = /^\s*([\d.,]+)(?:\s*(?:-|–|to)\s*[\d.,]+)?\s*(seconds?|secs?|s|minutes?|mins?|min|hours?|hrs?|hr|h)\s*$/i;
  function stepHtml(el) { // le texte de l etape, valeurs en bleu, rien d autre
    let out = '';
    const walker = document.createTreeWalker(el, NodeFilter.SHOW_TEXT);
    for (let n = walker.nextNode(); n; n = walker.nextNode()) {
      const t = esc(n.nodeValue); if (!t) continue;
      out += n.parentElement.closest('[data-native-color="blue"]') ? `<b class="sh-val">${t}</b>` : t;
    }
    return out;
  }
  function readSteps() {
    const doc = docRoot(); if (!doc) return [];
    let els = $$('li, [data-native-block-type]', doc).filter(el => el.tagName === 'LI' || LIST_BLOCK.test(el.getAttribute('data-native-block-type') || ''));
    els = els.filter(el => !els.some(o => o !== el && el.contains(o)) || el.tagName === 'LI'); // feuilles
    let loose = false;
    if (!els.length) { loose = true; els = $$('[data-native-block-type="p"], p', doc).filter(el => !$('p, [data-native-block-type="p"]', el)); }
    const seen = {};
    return els.map(el => {
      // Une etape qui porte des sous-etapes : son propre texte seulement.
      const own = $('ol, ul, table', el) ? (() => { const c = el.cloneNode(true); $$('ol, ul, table', c).forEach(x => x.remove()); return c; })() : el;
      const text = own.textContent.replace(/\s+/g, ' ').trim();
      if (!text) return null;
      const key = hash(text); seen[key] = (seen[key] || 0) + 1;
      let secs = 0;
      for (const v of Detect.findValues(text)) {
        const m = v.text.match(DURATION); if (!m) continue;
        const num = parseFloat(m[1].replace(',', '.')); const u = m[2].toLowerCase();
        secs = Math.round(num * (u[0] === 'h' ? 3600 : u[0] === 'm' ? 60 : 1)); if (secs > 0 && secs <= 86400) break; secs = 0;
      }
      return { id: key + '.' + seen[key], text, html: stepHtml(own), secs, sub: el.tagName === 'LI' && !!el.parentElement.closest('li'), el, loose };
    }).filter(Boolean);
  }
  const benchKey = () => location.pathname.replace(/\/+$/, '');
  const benchState = () => (benchAll[benchKey()] = benchAll[benchKey()] || { steps: {}, timers: {}, at: Date.now() });
  function saveBench() {
    const lim = Date.now() - 21 * 864e5;
    benchAll = Object.fromEntries(Object.entries(benchAll).filter(([, v]) => v.at > lim && (Object.keys(v.steps).length || Object.keys(v.timers).length)));
    try { chrome.storage.local.set({ [BENCH]: benchAll }); } catch (e) {}
  }
  const benchCount = () => { const b = benchAll[benchKey()]; return b ? Object.values(b.steps).filter(s => s.done || s.note).length : 0; };
  let benchOpen = false, benchSteps = [], benchTick = 0;
  const left = ms => { const s = Math.max(0, Math.ceil(ms / 1000)); return String(Math.floor(s / 60)).padStart(2, '0') + ':' + String(s % 60).padStart(2, '0'); };
  const short = (t, n = 28) => (t.length > n ? t.slice(0, n - 1).trimEnd() + '…' : t);
  function beep() { try { const a = new AudioContext(); const o = a.createOscillator(), g = a.createGain(); o.frequency.value = 880; g.gain.value = 0.08; o.connect(g); g.connect(a.destination); o.start(); o.stop(a.currentTime + 0.5); setTimeout(() => a.close(), 800); } catch (e) {} }
  function openBench() {
    benchSteps = readSteps();
    if (!benchSteps.length) return toast('No steps found in this record yet. Write them as a numbered list.', 'info');
    closePop(); hideToast(); benchOpen = true; applyView(); drawBench();
    clearInterval(benchTick); benchTick = setInterval(tickBench, 1000);
  }
  function closeBench() { benchOpen = false; clearInterval(benchTick); $('#sh-bench')?.remove(); applyView(); update(); }
  function tickBench() {
    const st = benchState(); let ended = false;
    for (const [id, end] of Object.entries(st.timers)) if (end > 0 && end <= Date.now()) { st.timers[id] = -1; ended = true; }
    if (ended) { beep(); saveBench(); drawBench(); return; }
    const chips = $('#sh-bench .sh-btimers'); if (chips) chips.replaceChildren(...timerChips());
  }
  function timerChips() {
    const st = benchState();
    return Object.entries(st.timers).map(([id, end]) => {
      const step = benchSteps.find(s => s.id === id); if (!step) return null;
      return h('button', { type: 'button', class: 'sh-btimer' + (end < 0 ? ' up' : ''), title: 'Click to clear this timer', onclick: () => { delete st.timers[id]; saveBench(); drawBench(); } },
        short(step.text) + (end < 0 ? ' · time is up' : ' · ' + left(end - Date.now()) + ' left'));
    }).filter(Boolean);
  }
  function drawBench() {
    const st = benchState(); st.at = Date.now();
    const done = benchSteps.filter(s => st.steps[s.id] && st.steps[s.id].done).length;
    const notes = benchSteps.filter(s => st.steps[s.id] && st.steps[s.id].note).length;
    const current = benchSteps.find(s => !(st.steps[s.id] && st.steps[s.id].done));
    const title = ($('[data-title-text]') ? $('[data-title-text]').textContent : document.title).replace(/\s+/g, ' ').trim();
    const old = $('#sh-bench'); const scroll = old ? $('.sh-bsteps', old).scrollTop : 0;
    const el = h('div', { id: 'sh-bench', class: 'sh' + ($('#sh-side') ? ' with-side' : ''), role: 'dialog', 'aria-label': 'Bench mode' },
      h('header', {}, h('b', {}, short(title, 70)), h('span', { class: 'sh-bpill' }, 'Bench mode'), h('span', { class: 'sh-btimers' }, timerChips()),
        h('button', { type: 'button', class: 'sh-bbtn', onclick: closeBench }, 'Exit')),
      h('div', { class: 'sh-bsteps' },
        benchSteps[0].loose ? h('p', { class: 'sh-wnote' }, 'No numbered list in this record: every paragraph is shown as a step.') : null,
        benchSteps.map(s => {
          const x = st.steps[s.id] || {};
          const toggle = () => { st.steps[s.id] = { ...x, done: x.done ? 0 : Date.now() }; saveBench(); drawBench(); };
          const note = h('input', { type: 'text', class: 'sh-bnote', placeholder: 'What was different?', value: x.note || '', 'aria-label': 'Deviation on this step',
            onchange: e => { st.steps[s.id] = { ...(st.steps[s.id] || {}), note: e.target.value.trim() }; saveBench(); drawBench(); } });
          return h('div', { class: 'sh-bstep' + (x.done ? ' done' : '') + (s === current ? ' cur' : '') + (s.sub ? ' sub' : '') },
            h('button', { type: 'button', class: 'sh-bbox', role: 'checkbox', 'aria-checked': x.done ? 'true' : 'false', 'aria-label': 'Done: ' + short(s.text, 60), onclick: toggle }, x.done ? '✓' : ''),
            h('div', { class: 'sh-btx', html: s.html, onclick: toggle }),
            h('div', { class: 'sh-bside' },
              x.done ? h('span', { class: 'sh-btime' }, clock(x.done)) : null,
              s.secs && !x.done && !st.timers[s.id] ? h('button', { type: 'button', class: 'sh-blink', onclick: () => { st.timers[s.id] = Date.now() + s.secs * 1000; saveBench(); drawBench(); } }, 'Start ' + (s.secs >= 3600 ? Math.round(s.secs / 360) / 10 + ' h' : s.secs >= 60 ? Math.round(s.secs / 6) / 10 + ' min' : s.secs + ' s')) : null,
              !x.note && x.open !== true ? h('button', { type: 'button', class: 'sh-blink', onclick: () => { st.steps[s.id] = { ...x, open: true }; drawBench(); setTimeout(() => { const i = $$('#sh-bench .sh-bnote').find(n => n.dataset.id === s.id); if (i) i.focus(); }, 0); } }, 'Deviation') : null),
            x.note || x.open ? h('div', { class: 'sh-bdev' }, h('span', {}, 'Deviation'), (note.dataset.id = s.id, note)) : null);
        })),
      h('footer', {}, h('span', {}, done + ' of ' + benchSteps.length + ' steps done'), notes ? h('span', {}, plural(notes, 'deviation')) : null,
        h('span', { class: 'sh-wnote' }, 'Ticks stay in this browser until you add the run log.'),
        h('button', { type: 'button', class: 'sh-bbtn', onclick: () => { benchAll[benchKey()] = { steps: {}, timers: {}, at: Date.now() }; saveBench(); drawBench(); } }, 'Reset'),
        h('button', { type: 'button', class: 'sh-bbtn pri', disabled: !(done || notes), onclick: addRunLog }, 'Add run log to the record')));
    if (old) old.replaceWith(el); else root.append(el);
    $('.sh-bsteps', el).scrollTop = scroll;
  }
  function runLogHtml() {
    const st = benchState(); const steps = benchSteps.length ? benchSteps : readSteps();
    const rows = steps.map((s, n) => { const x = st.steps[s.id] || {}; return [esc((n + 1) + '. ' + short(s.text, 110)), x.done ? esc(clock(x.done)) : '', x.note ? esc(x.note) : '']; });
    return `<p><strong>Run log, ${esc(today())}</strong></p>` + Seal.rawTable(['Step', 'Done at', 'Deviation'].map(Seal.bold), rows);
  }
  async function addRunLog() {
    const html = runLogHtml();
    if (benchOpen) closeBench();
    if (!cur.ed || !cur.ed.isConnected || !cur.range || !cur.range.startContainer.isConnected) {
      update();
      return toast('Click in the record where the run log should go (Edit first), then press “Add run log” in the bar.', 'info', 9000);
    }
    if (await insertHtml(html)) toast('Run log added where your cursor was. Ctrl Z removes it.', 'ok', 7000, [['Clear the ticks', () => { delete benchAll[benchKey()]; saveBench(); update(); }]]);
  }

  // ------------------------------------------------------------ barre d ecriture et bulle
  let words = 0, wordsAt = 0, barSig = '';
  function countWords(doc) {
    if (Date.now() - wordsAt < 2500) return;
    wordsAt = Date.now();
    const t = doc.textContent || ''; words = t.trim() ? t.trim().split(/\s+/).length : 0;
  }
  function update() {
    const doc = opts.on ? docRoot() : null;
    if (hasDoc !== !!doc) { hasDoc = !!doc; applyView(); }
    const bar = $('#sh-wbar');
    if (!doc || !isOn('wbar') || benchOpen) { if (bar) bar.remove(); barSig = ''; $('#sh-wbubble')?.remove(); return; }
    countWords(doc);
    const edit = editing();
    const logs = benchCount();
    const sig = [edit, words, logs, !!local.view.focus, isOn('slash') && !local.sealSlash].join('|');
    const r = doc.getBoundingClientRect();
    const center = Math.round(Math.max(r.left, 0) + (Math.min(r.right, innerWidth) - Math.max(r.left, 0)) / 2);
    if (!bar || sig !== barSig) {
      barSig = sig;
      const sep = () => h('span', { class: 'sh-wsep' });
      const el = h('div', { id: 'sh-wbar', class: 'sh', role: 'toolbar', 'aria-label': 'Seal Helper writing bar' },
        edit ? [
          btn(h('b', {}, 'B'), 'Bold (' + (isMac ? '⌘B' : 'Ctrl B') + ')', () => format('bold', 'b')),
          btn(h('i', {}, 'I'), 'Italic (' + (isMac ? '⌘I' : 'Ctrl I') + ')', () => format('italic', 'i')),
          btn('Value', 'Blue bold: a value to respect (select it first)', makeValue, 'val'),
          btn('Clear', 'Remove the formatting of the selection', clearFormat), sep(),
          btn('Table', 'Insert a table', () => { noteSelection(); openTable(); }),
          btn('µ °C ±', 'Lab symbols', e => openSymbols(e.currentTarget)),
          btn('Blocks', 'Mix, templates, snippets, date (' + (isMac ? '⌘J' : 'Ctrl J') + (isOn('slash') && !local.sealSlash ? ', or type /' : '') + ')', () => { noteSelection(); openBlocks(false); }), sep()] : null,
        logs ? btn('Add run log', 'Write the ticks and deviations of bench mode where your cursor is', addRunLog, 'accent') : null,
        btn('Bench', 'Bench mode: tick the steps, time them, note a deviation', openBench),
        btn('Aa', 'Reading comfort: size, width, typeface, focus', e => openView(e.currentTarget)),
        local.view.focus ? btn('Exit focus', 'Show the sidebar and panels again', () => setView({ focus: false })) : null,
        h('span', { class: 'sh-wcount', title: 'Words in this record' }, words.toLocaleString('en-NZ') + ' words'));
      if (bar) bar.replaceWith(el); else root.append(el);
    }
    $('#sh-wbar').style.left = center + 'px';
    drawBubble(edit);
  }
  // Bulle au-dessus d une selection : les trois formats, sans descendre a la barre.
  function drawBubble(edit) {
    const sel = document.getSelection();
    const show = edit && sel && sel.rangeCount && !sel.isCollapsed && sel.toString().trim() && !pop;
    let b = $('#sh-wbubble');
    if (!show) { if (b) b.remove(); return; }
    if (!b) {
      b = h('div', { id: 'sh-wbubble', class: 'sh', role: 'toolbar', 'aria-label': 'Format the selection' },
        btn(h('b', {}, 'B'), 'Bold', () => format('bold', 'b')), btn(h('i', {}, 'I'), 'Italic', () => format('italic', 'i')),
        btn('Value', 'Blue bold: a value to respect', makeValue, 'val'), btn('Clear', 'Remove formatting', clearFormat));
      root.append(b);
    }
    const r = sel.getRangeAt(0).getBoundingClientRect(); const w = b.offsetWidth || 190;
    const top = r.top - 40 < 6 ? r.bottom + 8 : r.top - 40;
    b.style.top = Math.round(top) + 'px'; b.style.left = Math.round(Math.max(8, Math.min(r.left + r.width / 2 - w / 2, innerWidth - w - 8))) + 'px';
  }
  let selTimer = 0;
  document.addEventListener('selectionchange', () => { noteSelection(); clearTimeout(selTimer); selTimer = setTimeout(update, 120); });
  document.addEventListener('focusin', () => setTimeout(update, 0), true);
  document.addEventListener('scroll', () => { $('#sh-wbubble')?.remove(); }, true);
  window.addEventListener('resize', () => update());
  setInterval(() => { try { update(); } catch (e) { console.warn('[Seal Helper] write', e); } }, 800);

  // ------------------------------------------------------------ diagnostic (structure seulement, aucun contenu)
  function diag() {
    const doc = docRoot(); const out = ['write v' + VERSION + ' opts ' + Object.keys(DEFAULTS).filter(k => opts[k]).join(' ') + ' | seal slash ' + !!local.sealSlash + ' | last insert ' + lastInsert];
    const tag = el => el ? el.tagName.toLowerCase() + '[' + Array.from(el.attributes).map(a => a.name + (/^(contenteditable|role|data-testid|data-native-block-type)$/.test(a.name) ? '=' + a.value : '')).filter(n => !/^(class|style|id)$/.test(n)).join(' ').slice(0, 160) + ']' : 'none';
    out.push('doc ' + tag(doc) + ' | editable roots ' + $$('[contenteditable="true"], [contenteditable=""]').filter(el => !el.closest('.sh') && !(el.parentElement && el.parentElement.isContentEditable)).length + ' | cursor in ' + tag(cur.ed && cur.ed.isConnected ? cur.ed : null));
    const types = {}; for (const el of $$('[data-native-block-type]')) { const t = el.getAttribute('data-native-block-type'); types[t] = (types[t] || 0) + 1; }
    out.push('blocks ' + (Object.entries(types).map(([k, v]) => k + '×' + v).join(' ') || 'none') + ' | li ' + (doc ? $$('li', doc).length : 0) + ' | tables ' + (doc ? $$('table', doc).length : 0));
    const tools = $$('[role="toolbar"] button, [role="toolbar"] [role="button"]').filter(el => !el.closest('.sh')).map(el => el.getAttribute('aria-label') || el.getAttribute('title') || '').filter(Boolean);
    out.push('seal toolbar ' + (tools.slice(0, 40).join(', ') || 'none seen'));
    return out.join('\n');
  }
  window.SealHelperWrite = { diag, cleanHtml, readSteps, version: VERSION };

  // ------------------------------------------------------------ reglages
  function refresh() { applyView(); barSig = ''; if (!opts.on) { closePop(); if (benchOpen) closeBench(); } update(); }
  try {
    chrome.storage.local.get([LOCAL, BENCH], r => {
      if (r[LOCAL] && typeof r[LOCAL] === 'object') local = { ...local, ...r[LOCAL], view: { ...local.view, ...(r[LOCAL].view || {}) } };
      if (r[BENCH] && typeof r[BENCH] === 'object') benchAll = r[BENCH];
      refresh();
    });
    chrome.storage.sync.get(KEY, r => { opts = { ...DEFAULTS, ...(r[KEY] || {}) }; refresh(); });
    chrome.storage.onChanged.addListener((changes, area) => {
      if (area === 'sync' && changes[KEY]) { opts = { ...DEFAULTS, ...(changes[KEY].newValue || {}) }; refresh(); }
    });
  } catch (e) {}
})();
