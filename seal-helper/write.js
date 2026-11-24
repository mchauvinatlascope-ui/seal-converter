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
  const DEFAULTS = { on: true, wbar: true, paste: true, proto: true, values: true, slash: true, pubkey: true };
  const VERSION = '2.7.1';
  const root = document.documentElement;
  const isMac = /Mac/.test(navigator.platform);
  const Seal = window.Seal, Detect = window.Detect, Parse = window.Parse, Edit = window.Edit, Mix = window.Mix, Copy = window.Copy;
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
  function redo() { if (!restore()) return; if (!sendKey('y') && !sendKey('z', true)) { try { document.execCommand('redo'); } catch (e) {} } }
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
    let res = null, proto = null;
    try { res = cleanHtml(html, { values: isOn('values') }); } catch (err) { console.warn('[Seal Helper] clean paste', err); return; }
    if (!res.html) return;
    if (isOn('proto')) { try { proto = protocolHtml(html); } catch (err) { console.warn('[Seal Helper] protocol paste', err); } }
    const text = e.clipboardData.getData('text/plain') || plainOf(res.html);
    e.preventDefault(); e.stopImmediatePropagation();
    noteSelection();
    const raw = ['Paste as it was', async () => { undo(); await wait(120); noteSelection(); await insertHtml(html, text); }];
    const said = r => { const s = r.stats; return [s.chapters && plural(s.chapters, 'chapter'), s.steps && plural(s.steps, 'step'), s.subs && plural(s.subs, 'sub-step'), s.tables && plural(s.tables, 'table'), s.values && plural(s.values, 'value') + ' marked'].filter(Boolean).join(', '); };
    const layout = () => insertHtml(res.html, text).then(ok => { if (ok) toast('Pasted with the Word layout' + (said(res) ? ': ' + said(res) : '') + '.', 'ok', 9000, [['Undo', () => undo()], raw]); });
    insertHtml((proto || res).html, text, { fresh: true }).then(ok => {
      if (!ok) return;
      if (proto) toast('Pasted in the lab protocol format' + (said(proto) ? ': ' + said(proto) : '') + '.', 'ok', 12000, [
        ['Undo', () => undo()], ['Keep the Word layout', async () => { undo(); await wait(120); noteSelection(); await layout(); }], raw]);
      else toast('Pasted clean' + (said(res) ? ': ' + said(res) : '') + '.', 'ok', 9000, [['Undo', () => undo()], raw]);
    });
  }, true);
  // Un protocole entier (des titres, ou au moins trois etapes) : le format du labo, celui de seal-converter,
  // chapitres I, II, sections a, b, etapes renumerotees, valeurs en bleu, bloc de titre laisse a Seal.
  function protocolHtml(html) {
    const blocks = Parse.htmlToBlocks(html);
    const items = blocks.filter(b => b.kind === 'item' || (b.kind === 'para' && (b.depth || 0) > 0)).length;
    if (!blocks.some(b => b.kind === 'heading') && items < 3) return null;
    let doc = Parse.blocksToDoc(blocks, { dropHeader: true });
    let out = doc && !doc.error ? Seal.document(doc) : '';
    if (!out) { doc = Parse.blocksToDoc(blocks); out = doc && !doc.error ? Seal.document(doc) : ''; }
    if (!out) return null;
    out = Copy.sealHtml(out);
    const n = re => (out.match(re) || []).length;
    return { html: out, stats: { chapters: n(/<h2[\s>]/g), steps: n(/<li[\s>]/g), subs: 0, tables: n(/<table[\s>]/g), values: n(/data-native-color="blue"/g) } };
  }

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
      { g: 'Blocks', t: 'Formatting test', s: 'what Seal keeps (test record)', title: 'Inserts one line per format, then reads back what Seal kept. Use it in a test record; Ctrl Z removes it.', run: formatTest },
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
    // Ctrl+S : le bouton Publish de Seal, presse pour toi. Rien d autre : si Seal demande une confirmation, elle reste a toi.
    if (e.key.toLowerCase() === 's' && (e.ctrlKey || e.metaKey) && !e.shiftKey && !e.altKey && isOn('pubkey') && !e.repeat) {
      const b = publishButton();
      if (b) { e.preventDefault(); e.stopImmediatePropagation(); try { b.scrollIntoView({ block: 'center' }); } catch (err) {} pressSeal(b); toast('Publish pressed for you. Seal takes it from here.', 'ok', 3500); return; }
      const waiting = publishWaiting() || (onChangePage() ? signBlock() : null);
      if (waiting) { // Seal attend encore quelque chose (le sens de la signature, une revue) : on y va, on ne le remplit pas
        e.preventDefault(); e.stopImmediatePropagation(); try { waiting.scrollIntoView({ block: 'center', behavior: 'smooth' }); } catch (err) {}
        toast('This is where Seal publishes. Complete what it asks (the signature is yours), then ' + (isMac ? '⌘S' : 'Ctrl S') + ' again or press Publish.', 'info', 8000); return;
      }
      const cs = changeButton();
      if (cs) { e.preventDefault(); e.stopImmediatePropagation(); pressSeal(cs); toast('Opened the change this record belongs to. Press ' + (isMac ? '⌘S' : 'Ctrl S') + ' again there to publish.', 'info', 7000); return; }
      if (docRoot() || onChangePage()) { e.preventDefault(); toast('No Publish button found on this page. Open the change in “To publish”, or send me the Diagnostic.', 'info', 7000); return; }
    }
    if (e.key.toLowerCase() === 'h' && !e.altKey && (isMac ? e.metaKey && e.shiftKey : e.ctrlKey && !e.shiftKey) && isOn('wbar') && docRoot()) {
      e.preventDefault(); e.stopImmediatePropagation(); openFind(); return;
    }
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
  function openLink() {
    restore(); const text0 = oneBlock(selText()) ? selText().trim() : '';
    const url = h('input', { type: 'text', placeholder: 'https://', 'aria-label': 'Address' }), text = h('input', { type: 'text', value: text0, placeholder: 'Text shown', 'aria-label': 'Text shown' });
    const go = () => {
      let u = url.value.trim(); if (u && !/^[a-z][a-z0-9+.-]*:/i.test(u)) u = 'https://' + u;
      const safe = Parse.safeHref(u);
      if (!safe) return toast('Give a web or e-mail address (https://… or mailto:…).', 'info');
      const t = text.value.trim() || safe;
      closePop(); insertHtml('<a href="' + esc(safe) + '">' + esc(t) + '</a>', t);
    };
    const el = h('form', { onsubmit: e => { e.preventDefault(); go(); } }, h('h3', {}, 'Link'), field('Address', url), field('Text shown', text),
      h('div', { class: 'sh-wact' }, h('button', { type: 'button', onclick: closePop }, 'Cancel'), h('button', { type: 'submit', class: 'pri' }, 'Insert link')));
    openPop('link', el, caretRect() || $('#sh-wbar'));
    url.focus();
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
  // Essai des formats : une ligne par format, inseree comme un collage, puis relue dans la fiche.
  // Le resultat (quels formats Seal a gardes, sous quelle balise) va dans le Diagnostic : il decide du ruban.
  const FORMATS = [
    ['underline', '<p><u>SHT underline</u></p>', (el, cs) => !!el.closest('u') || /underline/.test(cs.textDecorationLine)],
    ['strike', '<p><s>SHT strike</s></p>', (el, cs) => !!el.closest('s, strike, del') || /line-through/.test(cs.textDecorationLine)],
    ['subscript', '<p>CO<sub>SHT subscript</sub></p>', (el, cs) => !!el.closest('sub') || cs.verticalAlign === 'sub'],
    ['superscript', '<p>10<sup>SHT superscript</sup></p>', (el, cs) => !!el.closest('sup') || cs.verticalAlign === 'super'],
    ['highlight', '<p><mark style="background-color: rgb(255, 235, 59);">SHT highlight</mark></p>', (el, cs, base) => !!el.closest('mark') || (cs.backgroundColor !== base.backgroundColor && !/rgba\(0, 0, 0, 0\)|transparent/.test(cs.backgroundColor))],
    ['red text', '<p><span style="color: rgb(200, 30, 30);">SHT red text</span></p>', (el, cs, base) => cs.color !== base.color],
    ['code', '<p><code>SHT code</code></p>', el => !!el.closest('code, pre')],
    ['centre', '<p style="text-align: center;">SHT centre</p>', (el, cs) => cs.textAlign === 'center'],
    ['heading 1', '<h1>SHT heading 1</h1>', el => !!el.closest('h1, [data-native-block-type="h1"]')],
    ['heading 2', '<h2>SHT heading 2</h2>', el => !!el.closest('h2, [data-native-block-type="h2"]')],
    ['heading 3', '<h3>SHT heading 3</h3>', el => !!el.closest('h3, [data-native-block-type="h3"]')],
    ['heading 4', '<h4>SHT heading 4</h4>', el => !!el.closest('h4, [data-native-block-type="h4"]')],
    ['bullets', '<ul><li>SHT bullets</li></ul>', el => !!el.closest('ul') || /bullet|ul|unordered/i.test((el.closest('[data-native-block-type]') || el).getAttribute('data-native-block-type') || '')],
    ['numbered', '<ol><li>SHT numbered<ol><li>SHT nested</li></ol></li></ol>', el => !!el.closest('ol') || /number|ol|ordered|step/i.test((el.closest('[data-native-block-type]') || el).getAttribute('data-native-block-type') || '')],
    ['nested', '', el => !!(el.closest('li') && el.closest('li').parentElement.closest('li')) || !!(el.closest('[data-native-block-type]') && el.closest('[data-native-block-type]').parentElement.closest('[data-native-block-type]'))],
    ['checklist', '<ul><li><input type="checkbox">SHT checklist</li></ul>', el => !!(el.closest('li, [data-native-block-type]') && $('input[type="checkbox"], [role="checkbox"]', el.closest('li, [data-native-block-type]')))],
    ['quote', '<blockquote><p>SHT quote</p></blockquote>', el => !!el.closest('blockquote, [data-native-block-type*="quote"]')],
    ['link', '<p><a href="https://example.org/">SHT link</a></p>', el => !!el.closest('a')],
    ['value', '<p>' + Seal.value('SHT value') + '</p>', el => !!el.closest('[data-native-color="blue"]')],
    ['table', '<table><tr><th>SHT table</th><th>B</th></tr><tr><td>1</td><td>2</td></tr></table>', el => !!el.closest('table, [role="table"], [data-native-block-type*="table"]')],
  ];
  async function formatTest() {
    const html = '<p><strong>Formatting test (Seal Helper): delete me</strong></p>' + FORMATS.map(f => f[1]).join('');
    const plain = 'Formatting test (Seal Helper): delete me\n' + FORMATS.map(f => f[1].replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim()).filter(Boolean).join('\n');
    const count = () => { const o = {}; for (const el of $$('[data-native-block-type]', cur.ed || document)) { const t = el.getAttribute('data-native-block-type'); o[t] = (o[t] || 0) + 1; } return o; };
    const before = count();
    if (!await insertHtml(html, plain)) return;
    await wait(900);
    const ed = cur.ed; const base = getComputedStyle(ed);
    const after = count();
    const added = Object.keys(after).map(k => [k, after[k] - (before[k] || 0)]).filter(x => x[1]).map(x => x[0] + (x[1] > 0 ? '+' : '') + x[1]).join(' ') || 'no block';
    const names = FORMATS.map(f => f[0]).sort((a, b) => b.length - a.length);
    const found = {}; const nodes = new Set(); const w = document.createTreeWalker(ed, NodeFilter.SHOW_TEXT);
    for (let n = w.nextNode(); n; n = w.nextNode()) {
      if (n.nodeValue.indexOf('SHT ') < 0) continue;
      for (const name of names) if (!found[name] && n.nodeValue.indexOf('SHT ' + name) >= 0) { found[name] = n.parentElement; nodes.add(n); }
    }
    const kept = [], lost = [], chains = [];
    for (const [name, , test] of FORMATS) {
      const el = found[name];
      if (!el) { lost.push(name + ' (text gone)'); continue; }
      let ok = false; try { ok = test(el, getComputedStyle(el), base); } catch (e) {}
      (ok ? kept : lost).push(name);
      const blk = el.closest('[data-native-block-type]');
      const cs = getComputedStyle(el);
      chains.push(name + '=' + (blk ? blk.getAttribute('data-native-block-type') : '?') + (blk && listStyled(blk) ? '(list)' : '') + '/' + el.tagName.toLowerCase() + (Number(cs.fontWeight) >= 600 ? '.b' : '') + (cs.fontStyle === 'italic' ? '.i' : ''));
    }
    local.caps = { at: today(), way: lastInsert, kept, lost, chains, added, nodes: nodes.size }; saveLocal();
    toast('Seal kept ' + kept.length + ' of ' + FORMATS.length + ' formats. Now open the extension menu, Diagnostic, and paste it to me. Ctrl Z removes the test.', 'ok', 15000, [['Undo', () => undo()]]);
  }
  const SYMBOLS = ['µ', '°C', '°', '±', '×', '÷', '→', '←', '≥', '≤', '≈', '≠', 'α', 'β', 'γ', 'δ', 'ε', 'κ', 'λ', 'Δ', '⁺', '⁻', '²', '³', '⁶', '₂', '½', '‰'];
  function openSymbols(anchor) {
    if (pop && pop.kind === 'symbols') return closePop();
    openPop('symbols', h('div', { class: 'sh-wsym' }, SYMBOLS.map(s => h('button', { type: 'button', onmousedown: keep, onclick: () => insertText(s) }, s))), anchor, { above: true });
  }

  // ------------------------------------------------------------ publier au clavier
  // Le bouton de Seal, dans l en-tete de la fiche ou du changement. Jamais Approve : valider le travail d un autre ne se fait pas par reflexe.
  const PUBLISH = /^(publish|review and publish|submit for review)\b/i;
  const HEADERS = '[data-testid="changeset-top-navbar"], [data-testid="entity-top-navbar"]';
  const labelsOf = x => [x.textContent, x.getAttribute('aria-label'), x.getAttribute('title'), x.getAttribute('data-tooltip')].map(t => (t || '').replace(/\s+/g, ' ').trim()).filter(t => t && t.length <= 40);
  const usable = x => !x.closest('.sh') && !x.disabled && x.getAttribute('aria-disabled') !== 'true' && x.getClientRects().length > 0;
  const PUBLISH_ANY = /\bpublish\b/i, PUBLISH_NOT = /unpublish|published|approve|reject|to publish|publish(ing)? (history|settings)/i;
  // Publier dans Seal est une signature a ton nom (« Signing as », « Signature meaning ») : on appuie sur
  // Publish quand Seal le propose, on ne remplit ni ne confirme jamais la signature a ta place.
  const shown = x => !x.closest('.sh') && x.getClientRects().length > 0;
  const publishWaiting = () => $$('button, [role="button"]').find(x => shown(x) && !usable(x) && labelsOf(x).some(t => PUBLISH_ANY.test(t) && !PUBLISH_NOT.test(t))) || null;
  const signBlock = () => $$('h1, h2, h3, h4, label, div, span, p, b, strong').find(el => shown(el) && !el.children.length && /^(ready to publish|signing as|signature meaning)/i.test(el.textContent.trim())) || null;
  const onChangePage = () => /\/cs\/\d+/.test(location.pathname);
  function publishButton() {
    const clickable = 'button, a, [role="button"], [role="menuitem"]';
    // D abord l en-tete de la fiche ou du changement, libelle exact ; sinon tout bouton visible qui dit « publish ».
    for (const header of $$(HEADERS)) {
      const b = $$(clickable, header).find(x => usable(x) && labelsOf(x).some(t => PUBLISH.test(t)));
      if (b) return b;
    }
    return $$(clickable).find(x => usable(x) && labelsOf(x).some(t => PUBLISH_ANY.test(t) && !PUBLISH_NOT.test(t))) || null;
  }
  // Le changement auquel la fiche appartient : c est souvent la que Seal met Publish.
  function changeButton() {
    for (const header of $$(HEADERS)) {
      const b = $$('button, a, [role="button"]', header).find(x => usable(x) && labelsOf(x).some(t => /change\s*set\s*#?\s*\d+|^#\d+$/i.test(t)));
      if (b) return b;
    }
    return null;
  }
  function pressSeal(el) {
    const o = { bubbles: true, cancelable: true, view: window, button: 0, pointerType: 'mouse', isPrimary: true };
    el.dispatchEvent(new PointerEvent('pointerdown', o)); el.dispatchEvent(new MouseEvent('mousedown', o));
    el.dispatchEvent(new PointerEvent('pointerup', o)); el.dispatchEvent(new MouseEvent('mouseup', o)); el.click();
  }

  // ------------------------------------------------------------ rechercher et remplacer dans la fiche
  // Les occurrences sont peintes par l API Highlight (rien n est ecrit dans le document) ; un
  // remplacement selectionne l occurrence puis tape le nouveau texte, comme le ferait le clavier.
  let find = null; // { q, rep, cs, hits: [Range], idx }
  const hl = (name, ranges) => { try { if (!window.Highlight || !CSS.highlights) return; if (ranges && ranges.length) CSS.highlights.set(name, new Highlight(...ranges)); else CSS.highlights.delete(name); } catch (e) {} };
  function findHits(q, cs) {
    const doc = docRoot(); const out = [];
    if (!doc || !q) return out;
    const needle = cs ? q : q.toLowerCase();
    const w = document.createTreeWalker(doc, NodeFilter.SHOW_TEXT);
    for (let n = w.nextNode(); n && out.length < 2000; n = w.nextNode()) {
      if (n.parentElement.closest('.sh')) continue;
      const hay = cs ? n.nodeValue : n.nodeValue.toLowerCase();
      for (let i = hay.indexOf(needle); i >= 0; i = hay.indexOf(needle, i + needle.length)) { const r = document.createRange(); r.setStart(n, i); r.setEnd(n, i + needle.length); out.push(r); }
    }
    return out;
  }
  function paintFind(scroll) {
    if (!find) { hl('sh-find'); hl('sh-find-cur'); return; }
    find.hits = findHits(find.q, find.cs);
    find.idx = find.hits.length ? Math.max(0, Math.min(find.idx, find.hits.length - 1)) : 0;
    hl('sh-find', find.hits); hl('sh-find-cur', find.hits.length ? [find.hits[find.idx]] : null);
    const c = $('.sh-wpop[data-kind="find"] .sh-fcount'); if (c) c.textContent = !find.q ? '' : find.hits.length ? (find.idx + 1) + ' of ' + find.hits.length : 'Not found';
    if (scroll && find.hits.length) { const el = find.hits[find.idx].startContainer.parentElement; if (el && el.scrollIntoView) el.scrollIntoView({ block: 'center' }); }
  }
  async function replaceHit(range, text) {
    const ed = editorOf(range.startContainer); if (!ed) return false;
    ed.focus({ preventScroll: true });
    const sel = document.getSelection(); sel.removeAllRanges(); sel.addRange(range);
    cur = { ed, range: range.cloneRange() };
    await wait(30);
    let ok = false;
    try { ok = text ? document.execCommand('insertText', false, text) : document.execCommand('delete'); } catch (e) {}
    await wait(25);
    return ok;
  }
  async function replaceOne(all) {
    if (!find || !find.hits.length) return;
    const input = $('.sh-wpop[data-kind="find"] input');
    if (!editorOf(find.hits[find.idx].startContainer)) return toast('This record is not being edited: press Edit in Seal first.', 'info');
    let done = 0;
    if (all) { // de la derniere a la premiere : ce qui precede ne bouge pas, et un remplacement qui contient le mot n est jamais repris
      for (let i = Math.min(find.hits.length, 500) - 1; i >= 0; i--) { const hits = findHits(find.q, find.cs); if (!hits[i]) continue; if (await replaceHit(hits[i], find.rep)) done++; }
    } else if (await replaceHit(find.hits[find.idx], find.rep)) done = 1;
    paintFind(!all);
    if (input) input.focus();
    if (all) toast(done ? plural(done, 'replacement') + ' made. Ctrl Z undoes them one by one.' : 'Seal did not accept the replacement here.', done ? 'ok' : 'warn', 6000);
    else if (!done) toast('Seal did not accept the replacement here.', 'warn');
  }
  function openFind() {
    if (!docRoot()) return;
    const start = selText().trim();
    find = { q: oneBlock(start) && start.length < 80 ? start : (find ? find.q : ''), rep: find ? find.rep : '', cs: find ? find.cs : false, hits: [], idx: 0 };
    const q = h('input', { type: 'text', value: find.q, placeholder: 'Find in this record', 'aria-label': 'Find' });
    const rep = h('input', { type: 'text', value: find.rep, placeholder: 'Replace with', 'aria-label': 'Replace with' });
    const step = d => { if (!find.hits.length) return; find.idx = (find.idx + d + find.hits.length) % find.hits.length; paintFind(true); };
    q.addEventListener('input', () => { find.q = q.value; find.idx = 0; paintFind(true); });
    rep.addEventListener('input', () => { find.rep = rep.value; });
    const el = h('form', { onsubmit: e => { e.preventDefault(); step(1); }, onkeydown: e => { if (e.key === 'Enter' && e.shiftKey) { e.preventDefault(); step(-1); } } },
      h('h3', {}, 'Find and replace'),
      h('div', { class: 'sh-wrow' }, q, h('span', { class: 'sh-fcount' })),
      rep,
      h('label', { class: 'sh-wcheck' }, h('input', { type: 'checkbox', checked: find.cs, onchange: e => { find.cs = e.target.checked; find.idx = 0; paintFind(true); } }), 'Match case'),
      h('div', { class: 'sh-wact' }, h('button', { type: 'button', onclick: () => step(-1) }, 'Previous'), h('button', { type: 'submit' }, 'Next'),
        h('button', { type: 'button', onclick: () => replaceOne(false) }, 'Replace'), h('button', { type: 'button', class: 'pri', onclick: () => replaceOne(true) }, 'Replace all')));
    openPop('find', el, { left: innerWidth - 340, right: innerWidth - 20, top: 60, bottom: 60 }, { onclose: () => { hl('sh-find'); hl('sh-find-cur'); } });
    q.focus(); q.select(); paintFind(true);
  }

  // ------------------------------------------------------------ controle avant publication (lecture seule)
  const HEAD = 'h1, h2, h3, h4, [data-native-block-type="h1"], [data-native-block-type="h2"], [data-native-block-type="h3"]';
  function checkRecord() {
    const doc = docRoot(); const out = [];
    if (!doc) return out;
    const add = (msg, el) => out.push({ msg, el });
    const title = ($('[data-title-text]') ? $('[data-title-text]').textContent : '').replace(/\s+/g, ' ').trim();
    if (/^(untitled|new (experiment|protocol|project|record))\b/i.test(title) || /^untitled/i.test(document.title)) add('The record is still called “' + (title || 'Untitled') + '”.', $('[data-title-text]'));
    // Titre sans rien dessous
    let curH = null, has = false;
    const closeH = () => { if (curH && !has && !between(curH)) add('Nothing written under “' + short(curH.textContent.replace(/\s+/g, ' ').trim(), 50) + '”.', curH); };
    const between = hd => { // une image ou un tableau juste apres le titre compte comme du contenu
      for (let n = hd.nextElementSibling; n && !n.matches(HEAD) && !$(HEAD, n); n = n.nextElementSibling) if (n.matches('img, table') || $('img, table', n)) return true;
      return false;
    };
    const w = document.createTreeWalker(doc, NodeFilter.SHOW_TEXT);
    for (let n = w.nextNode(); n; n = w.nextNode()) {
      const p = n.parentElement; if (!p || p.closest('.sh') || !n.nodeValue.trim()) continue;
      const hd = p.closest(HEAD);
      if (hd) { if (hd !== curH) { closeH(); curH = hd; has = false; } }
      else {
        has = true;
        const t = n.nodeValue.trim();
        if (/^\((the question this experiment answers|tissue, groups|markers, fluorochromes|steps with times|cytometer, settings|gating strategy|what the data show|samples, dilutions|standards, blanks|coating, blocking|reader, wavelength|samples, extraction|kit, input|targets, reference|instrument and programme|strain, sex|day 0, treatments|immunisation, dosing|tissues collected)/i.test(t)) add('A template hint is still there: “' + short(t, 44) + '”.', p);
        else if (/\b(TODO|TBD|TBC|XXX)\b|\?\?\?/.test(t)) add('To finish: “' + short(t, 50) + '”.', p);
        else if (/^Deviation \([^)]*\):\s*$/.test(p.textContent.trim())) add('A deviation has no text.', p);
      }
    }
    closeH();
    for (const t of $$('table', doc)) {
      const cells = $$('td', t); const blank = cells.filter(c => !c.textContent.trim()).length;
      if (cells.length >= 4 && blank / cells.length > 0.5) add('A table is mostly empty (' + blank + ' of ' + cells.length + ' cells).', t);
    }
    if (benchCount()) add('Bench mode has ticks or deviations that are not in the record yet (Add run log).', null);
    return out;
  }
  function openCheck(anchor) {
    if (pop && pop.kind === 'check') return closePop();
    const list = checkRecord();
    const flash = el => { if (!el) return; el.scrollIntoView({ block: 'center', behavior: 'smooth' }); const r = document.createRange(); r.selectNodeContents(el); hl('sh-find-cur', [r]); setTimeout(() => hl('sh-find-cur'), 2500); };
    openPop('check', h('div', {}, h('h3', {}, 'Before you publish'),
      list.length ? list.slice(0, 30).map(it => h('button', { type: 'button', class: 'sh-wcheckrow', disabled: !it.el, onclick: () => flash(it.el) }, it.msg))
        : h('p', { class: 'sh-wnote' }, 'Nothing to flag: no empty section, no leftover hint, no half-empty table.'),
      h('p', { class: 'sh-wnote' }, 'A reading aid only: it changes nothing and does not replace Seal\'s review.')), anchor, { above: true });
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
  // La fiche telle qu elle est ecrite, dans l ordre : titres, texte et tableaux restent du contexte a lire,
  // seules les etapes (elements de liste) se cochent. Sans aucune liste dans la fiche, une ligne est une etape
  // si elle est numerotee, commence par un verbe de paillasse ou porte une valeur ; chaque ligne se corrige a la main.
  const isHead = el => /^H[1-4]$/.test(el.tagName) || /^h[1-6]$/i.test(el.getAttribute('data-native-block-type') || '');
  // Dans Seal (editeur Plate) une etape numerotee n est pas un <li> : c est un bloc « p » qui porte un style de liste.
  // On le reconnait a son affichage (list-item, compteur CSS) ou a ses attributs, jamais a son texte.
  const LISTY = /list-?style|listStyle|ordered|numbered|bullet|todo|checklist|indent-?list/i;
  function listStyled(el) {
    if (!el.hasAttribute('data-native-block-type')) return false;
    for (const a of el.attributes) if (a.name !== 'data-native-block-type' && (/list|todo|check/i.test(a.name) || ((a.name === 'class' || a.name === 'style') && (LISTY.test(a.value) || /counter-(increment|reset|set)/.test(a.value))))) return true;
    try {
      const cs = getComputedStyle(el);
      if (cs.display === 'list-item' || (cs.counterIncrement && cs.counterIncrement !== 'none')) return true;
      const before = getComputedStyle(el, '::before').content;
      if (before && /counter\(|"\d+[.)]"|"[•◦▪–-]"/.test(before)) return true;
      const kid = el.firstElementChild;
      if (kid && (getComputedStyle(kid).display === 'list-item' || /counter\(/.test(getComputedStyle(kid, '::before').content || ''))) return true;
    } catch (e) {}
    return false;
  }
  const isListEl = el => el.tagName === 'LI' || LIST_BLOCK.test(el.getAttribute('data-native-block-type') || '') || listStyled(el);
  const BLOCKS = 'li, p, h1, h2, h3, h4, table, ol, ul, [data-native-block-type]';
  const MARKER = /^\s*(?:step\s*)?(?:\d{1,3}[.)]|[a-z][.)]|[-•*–])\s+/i;
  const VERB = /^(?:then |next |finally |carefully |gently )?(?:add|aspirate|acquire|block|bleed|centrifuge|collect|count|cull|decant|discard|dilute|dissolve|filter|fix|flick|harvest|incubate|inject|keep|label|leave|lyse|mash|mix|pellet|permeabili[sz]e|pipette|place|plate|pour|prepare|record|remove|repeat|resuspend|rinse|run|seed|spin|stain|store|thaw|top up|transfer|vortex|wait|wash|weigh)\b/i;
  function durationOf(text) {
    for (const v of Detect.findValues(text)) {
      const m = v.text.match(DURATION); if (!m) continue;
      const num = parseFloat(m[1].replace(',', '.')); const u = m[2].toLowerCase();
      const secs = Math.round(num * (u[0] === 'h' ? 3600 : u[0] === 'm' ? 60 : 1)); if (secs > 0 && secs <= 86400) return secs;
    }
    return 0;
  }
  function readSheet() {
    const doc = docRoot(); if (!doc) return [];
    const out = []; const seen = {};
    const idOf = text => { const k = hash(text); seen[k] = (seen[k] || 0) + 1; return k + '.' + seen[k]; };
    const clean = el => el.textContent.replace(/\s+/g, ' ').trim();
    const nested = el => { const list = []; for (const c of el.children) { if (c.matches('ol, ul, table') || isListEl(c)) list.push(c); else list.push(...nested(c)); } return list; };
    const ownOf = el => { // le texte propre d une etape, sans ses sous-etapes ni ses tableaux
      const inner = nested(el); if (!inner.length) return el;
      const c = el.cloneNode(true); const drop = nested(c); for (const x of drop) x.parentNode.removeChild(x); return c;
    };
    const tableOf = t => '<table>' + $$('tr', t).map(tr => '<tr>' + Array.from(tr.children).map(c => { const tag = c.tagName === 'TH' ? 'th' : 'td'; return `<${tag}>${stepHtml(c)}</${tag}>`; }).join('') + '</tr>').join('') + '</table>';
    const walk = (el, depth) => {
      if (el.closest('.sh')) return;
      if (el.tagName === 'TABLE') {
        if (!clean(el)) return;
        const rows = $$('tr', el).map(tr => Array.from(tr.children)).filter(r => r.length);
        const head = rows.length > 1 ? rows[0].map(c => clean(c)) : [];
        const stepCol = head.findIndex(t => /^(steps?|action|procedure|task|what to do)$/i.test(t));
        if (stepCol < 0) { out.push({ kind: 'table', html: tableOf(el), el }); return; }
        // Le tableau d etapes de la fiche : chaque ligne se coche ; les autres colonnes suivent en petit, sauf le numero et la case « Done ».
        const numCol = head.findIndex(t => /^(#|no\.?|n°|nr\.?|step ?#)$/i.test(t));
        const skip = new Set([stepCol, numCol, ...head.map((t, k) => (/^(done|✓|✔|check|tick|ok|initials?)$/i.test(t) ? k : -1))]);
        rows.slice(1).forEach(r => {
          const cell = r[stepCol]; const text = cell ? clean(cell) : '';
          if (!text) return;
          const num = numCol >= 0 && r[numCol] ? clean(r[numCol]) : '';
          const extra = r.map((c, k) => (skip.has(k) || !clean(c) ? '' : '<span class="sh-bextra">' + (head[k] ? esc(head[k]) + ': ' : '') + stepHtml(c) + '</span>')).join('');
          out.push({ kind: 'step', id: idOf(text), text, html: (num ? '<span class="sh-bnum">' + esc(num.replace(/[.)]$/, '')) + '.</span> ' : '') + stepHtml(cell) + extra, secs: durationOf(text), sub: false, el: r[0].parentElement });
        });
        return;
      }
      if (isHead(el)) { const t = clean(el); if (t) out.push({ kind: 'head', text: t, el }); return; }
      if (isListEl(el)) {
        const own = ownOf(el); const text = clean(own);
        if (text) out.push({ kind: 'step', id: idOf(text), text, html: stepHtml(own), secs: durationOf(text), sub: depth > 0, el });
        for (const c of nested(el)) walk(c, depth + (text ? 1 : 0));
        return;
      }
      const kids = Array.from(el.children).filter(c => c.matches(BLOCKS) || c.querySelector(BLOCKS));
      if (kids.length) { for (const c of kids) walk(c, depth); return; }
      const text = clean(el);
      if (text) out.push({ kind: 'text', id: idOf(text), text, html: stepHtml(el), el, para: true,
        bold: text.length <= 80 && !/[.;,]$/.test(text) && $$('b, strong', el).map(b => b.textContent).join('').replace(/\s+/g, ' ').trim() === text });
    };
    walk(doc, 0);
    const loose = !out.some(e => e.kind === 'step');
    const kinds = benchState().kinds || {};
    for (const e of out) {
      if (!e.para) continue;
      let kind = 'text';
      if (loose) kind = e.bold ? 'head' : (MARKER.test(e.text) || (VERB.test(e.text) && e.text.length <= 260)) ? 'step' : 'text';
      if (kinds[e.id]) kind = kinds[e.id];
      e.kind = kind; e.loose = loose;
      if (kind === 'step') { e.secs = durationOf(e.text); e.sub = false; }
    }
    return out;
  }
  const readSteps = () => readSheet().filter(e => e.kind === 'step');
  const benchKey = () => location.pathname.replace(/\/+$/, '');
  const benchState = () => (benchAll[benchKey()] = benchAll[benchKey()] || { steps: {}, timers: {}, at: Date.now() });
  function saveBench() {
    const lim = Date.now() - 21 * 864e5;
    benchAll = Object.fromEntries(Object.entries(benchAll).filter(([, v]) => v.at > lim && (Object.keys(v.steps).length || Object.keys(v.timers).length || Object.keys(v.kinds || {}).length)));
    try { chrome.storage.local.set({ [BENCH]: benchAll }); } catch (e) {}
  }
  const benchCount = () => { const b = benchAll[benchKey()]; return b ? Object.values(b.steps).filter(s => s.done || s.note).length : 0; };
  let benchOpen = false, benchSteps = [], benchSheet = [], benchTick = 0;
  function loadSheet() { benchSheet = readSheet(); benchSteps = benchSheet.filter(e => e.kind === 'step'); }
  function setKind(id, kind) { const st = benchState(); st.kinds = { ...(st.kinds || {}), [id]: kind }; saveBench(); loadSheet(); drawBench(); }
  const left = ms => { const s = Math.max(0, Math.ceil(ms / 1000)); return String(Math.floor(s / 60)).padStart(2, '0') + ':' + String(s % 60).padStart(2, '0'); };
  const short = (t, n = 28) => (t.length > n ? t.slice(0, n - 1).trimEnd() + '…' : t);
  function beep() { try { const a = new AudioContext(); const o = a.createOscillator(), g = a.createGain(); o.frequency.value = 880; g.gain.value = 0.08; o.connect(g); g.connect(a.destination); o.start(); o.stop(a.currentTime + 0.5); setTimeout(() => a.close(), 800); } catch (e) {} }
  function openBench() {
    loadSheet();
    if (!benchSheet.length) return toast('Nothing to show yet: this record has no text.', 'info');
    closePop(); hideToast(); benchOpen = true; root.classList.add('sh-bench-open'); applyView(); drawBench();
    clearInterval(benchTick); benchTick = setInterval(tickBench, 1000);
  }
  function closeBench() { benchOpen = false; root.classList.toggle('sh-bench-open', false); clearInterval(benchTick); $('#sh-bench')?.remove(); applyView(); update(); }
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
        h('button', { type: 'button', class: 'sh-bbtn', title: 'Print this checklist, or choose “Save as PDF” in the print window', onclick: () => window.print() }, 'Print / PDF'),
        h('button', { type: 'button', class: 'sh-bbtn', onclick: closeBench }, 'Exit')),
      // En-tete de la feuille imprimee (cache a l ecran)
      h('div', { class: 'sh-bprint' }, h('h1', {}, title || 'Bench sheet'),
        h('p', {}, 'Bench sheet · printed ' + today() + ' · ' + plural(benchSteps.length, 'step')),
        h('p', { class: 'sh-bfill' }, h('span', {}, 'Date'), h('i', {}), h('span', {}, 'Name'), h('i', {}))),
      h('div', { class: 'sh-bsteps' },
        benchSheet.some(e => e.loose) ? h('p', { class: 'sh-wnote sh-bhint' }, 'No list or step table in this record: numbered lines and lines that start with a bench verb can be ticked. “Step” and “Not a step” on the right correct a line.') : null,
        benchSheet.map(s => {
          if (s.kind === 'head') return h('h4', { class: 'sh-bhead' }, s.text);
          if (s.kind === 'table') return h('div', { class: 'sh-btable', html: s.html });
          if (s.kind === 'text') return h('div', { class: 'sh-bpara' }, h('div', { html: s.html }),
            h('button', { type: 'button', class: 'sh-blink quiet', title: 'Tick this line as a step', onclick: () => setKind(s.id, 'step') }, 'Step'));
          const x = st.steps[s.id] || {};
          const toggle = () => { st.steps[s.id] = { ...x, done: x.done ? 0 : Date.now() }; saveBench(); drawBench(); };
          const note = h('input', { type: 'text', class: 'sh-bnote', placeholder: 'What was different?', value: x.note || '', 'aria-label': 'Deviation on this step',
            onchange: e => { st.steps[s.id] = { ...(st.steps[s.id] || {}), note: e.target.value.trim() }; saveBench(); drawBench(); } });
          return h('div', { class: 'sh-bstep' + (x.done ? ' done' : '') + (s === current ? ' cur' : '') + (s.sub ? ' sub' : '') },
            h('button', { type: 'button', class: 'sh-bbox', role: 'checkbox', 'aria-checked': x.done ? 'true' : 'false', 'aria-label': 'Done: ' + short(s.text, 60), onclick: toggle }, x.done ? '✓' : ''),
            h('div', { class: 'sh-btx', html: s.html, onclick: toggle }),
            h('div', { class: 'sh-bside' },
              x.done ? h('span', { class: 'sh-btime' }, clock(x.done)) : h('span', { class: 'sh-bblank', 'aria-hidden': 'true' }),
              s.secs && !x.done && !st.timers[s.id] ? h('button', { type: 'button', class: 'sh-blink', onclick: () => { st.timers[s.id] = Date.now() + s.secs * 1000; saveBench(); drawBench(); } }, 'Start ' + (s.secs >= 3600 ? Math.round(s.secs / 360) / 10 + ' h' : s.secs >= 60 ? Math.round(s.secs / 6) / 10 + ' min' : s.secs + ' s')) : null,
              !x.note && x.open !== true ? h('button', { type: 'button', class: 'sh-blink', onclick: () => { st.steps[s.id] = { ...x, open: true }; drawBench(); setTimeout(() => { const i = $$('#sh-bench .sh-bnote').find(n => n.dataset.id === s.id); if (i) i.focus(); }, 0); } }, 'Deviation') : null,
              s.para && !x.done ? h('button', { type: 'button', class: 'sh-blink quiet', title: 'Show this line as plain text', onclick: () => setKind(s.id, 'text') }, 'Not a step') : null),
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
    // Ruban : pose dans la page juste sous l en-tete de la fiche (comme la barre de fil d Ariane), il pousse le texte
    // vers le bas au lieu de le recouvrir. Sans en-tete reconnu, il reste la barre flottante du bas.
    const anchor = $('#sh-props') || $(HEADERS);
    const docked = !!(anchor && anchor.parentElement && !local.view.focus);
    const caps = local.caps && Array.isArray(local.caps.kept) ? local.caps.kept : null;
    const can = name => !!caps && caps.includes(name);
    if (!bar || sig + docked + (caps ? caps.join() : '') !== barSig) {
      barSig = sig + docked + (caps ? caps.join() : '');
      const key = (label, title, onclick, k, cls = '') => { const b = btn(label, title, onclick, cls); b.dataset.k = k; return b; };
      const group = (name, ...kids) => { const list = kids.flat().filter(Boolean); return list.length ? h('div', { class: 'sh-wg', role: 'group', 'aria-label': name }, h('div', { class: 'sh-wgr' }, list), h('div', { class: 'sh-wgn' }, name)) : null; };
      const wrap = (tag, k) => async () => { restore(); const t = selText(); if (!t.trim()) return toast('Select the words first.', 'info'); if (!oneBlock(t)) return toast('This works inside one paragraph at a time.', 'info'); await insertHtml('<' + tag + '>' + esc(t) + '</' + tag + '>', t); };
      const mod = isMac ? '⌘' : 'Ctrl ';
      const el = h('div', { id: 'sh-wbar', class: 'sh' + (docked ? ' docked' : ''), role: 'toolbar', 'aria-label': 'Seal Helper writing bar' },
        edit ? [
          group('Undo',
            key('↶', 'Undo (' + mod + 'Z)', undo, 'undo'),
            key('↷', 'Redo (' + (isMac ? '⌘⇧Z' : 'Ctrl Y') + ')', redo, 'redo')),
          // Seal montre sa propre barre au-dessus d une selection (style, B, I, U, S, code, exposant, indice, couleur,
          // alignement, lien, commentaire) : le ruban ne porte que ce qu elle n a pas.
          group('Text',
            key('Value', 'Blue bold: a value to respect (select it first)', makeValue, 'value', 'val'),
            key('Clear', 'Remove the formatting of the selection', clearFormat, 'clear')),
          group('Insert',
            key('Table', 'Insert a table', () => { noteSelection(); openTable(); }, 'table'),
            key('µ °C ±', 'Lab symbols', e => openSymbols(e.currentTarget), 'symbols'),
            key('Date', 'Today: ' + today(), () => insertText(today()), 'date'),
            key('Blocks', 'Mix, templates, snippets (' + mod + 'J' + (isOn('slash') && !local.sealSlash ? ', or type /' : '') + ')', () => { noteSelection(); openBlocks(false); }, 'blocks'))] : null,
        group('Tools',
          edit ? key('Find', 'Find and replace in this record (' + (isMac ? '⌘⇧H' : 'Ctrl H') + ')', openFind, 'find') : null,
          key('Check', 'Before you publish: empty sections, leftover hints, half-empty tables', e => openCheck(e.currentTarget), 'check'),
          key('Bench', 'Bench mode: tick the steps, time them, note a deviation', openBench, 'bench'),
          logs ? key('Add run log', 'Write the ticks and deviations of bench mode where your cursor is', addRunLog, 'runlog', 'accent') : null,
          key('Aa', 'Reading comfort: size, width, typeface, focus', e => openView(e.currentTarget), 'aa'),
          local.view.focus ? key('Exit focus', 'Show the sidebar and panels again', () => setView({ focus: false }), 'exitfocus') : null),
        h('span', { class: 'sh-wfill' }),
        h('span', { class: 'sh-wcount', title: 'Words in this record' }, words.toLocaleString('en-NZ') + ' words'));
      if (bar) bar.replaceWith(el); else root.append(el);
    }
    const now = $('#sh-wbar');
    if (docked) { if (now.previousElementSibling !== anchor) anchor.after(now); now.style.left = ''; }
    else { if (now.parentElement !== root) root.append(now); now.style.left = center + 'px'; }
    drawBubble(edit);
  }
  function drawBubble() { const b = $('#sh-wbubble'); if (b) b.parentNode.removeChild(b); } // 2.7 : plus de bulle, la barre de Seal occupe cette place
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
    // Libelles des boutons de l en-tete (interface de Seal, pas du contenu) : pour reperer Publish.
    const heads = $$(HEADERS).flatMap(hd => $$('button, a, [role="button"]', hd)).filter(x => !x.closest('.sh')).map(x => (labelsOf(x)[0] || '?').replace(/\d{3,}/g, 'N') + (usable(x) ? '' : ' (off)'));
    const pb = publishButton();
    out.push('header buttons ' + (heads.slice(0, 30).join(' | ') || 'none seen') + ' || publish found: ' + (pb ? labelsOf(pb)[0] : 'no') + ' || change found: ' + (changeButton() ? 'yes' : 'no')
      + ' || publish waiting: ' + (publishWaiting() ? labelsOf(publishWaiting())[0] : 'no') + ' || sign block: ' + (signBlock() ? 'yes' : 'no')
      + ' || page buttons saying publish/sign: ' + ($$('button, [role="button"], a').filter(x => shown(x) && labelsOf(x).some(t => /publish|sign/i.test(t))).map(x => labelsOf(x)[0] + (usable(x) ? '' : ' (off)')).slice(0, 12).join(' | ') || 'none'));
    try {
      const ps = $$('[data-native-block-type="p"]', doc || document);
      const names = {}; for (const el of ps) for (const a of el.attributes) names[a.name] = (names[a.name] || 0) + 1;
      const shape = el => { if (!el) return 'none'; const cs = getComputedStyle(el); let path = ''; for (let x = el.firstElementChild, d = 0; x && d < 4; x = x.firstElementChild, d++) path += '>' + x.tagName.toLowerCase() + (x.className && typeof x.className === 'string' ? '.' + x.className.split(/\s+/).slice(0, 2).join('.') : '');
        return 'display ' + cs.display + ' counter ' + cs.counterIncrement + ' before ' + (getComputedStyle(el, '::before').content || '').slice(0, 30) + ' | class ' + (el.getAttribute('class') || '').slice(0, 90) + ' | style ' + (el.getAttribute('style') || '').slice(0, 90) + ' | ' + Array.from(el.attributes).filter(a => /^data-/.test(a.name) && a.value.length <= 24).map(a => a.name + '=' + a.value).join(' ').slice(0, 200) + ' | ' + path; };
      const lists = ps.filter(listStyled);
      const numbered = ps.find(el => /^\s*\d{1,2}[.)]\s/.test(el.textContent)); // numero tape a la main ?
      out.push('p blocks ' + ps.length + ' | list-styled ' + lists.length + ' | typed numbers ' + ps.filter(el => /^\s*\d{1,2}[.)]\s/.test(el.textContent)).length + ' | attrs ' + Object.entries(names).map(([k, v]) => k + '×' + v).join(' ').slice(0, 400));
      out.push('p plain: ' + shape(ps.find(el => !listStyled(el) && el.textContent.trim())));
      out.push('p list: ' + shape(lists[0]) + (numbered && !lists.length ? ' || p with a typed number: ' + shape(numbered) : ''));
      const sc = (function up(el) { for (let x = el; x && x !== document.body; x = x.parentElement) { const o = getComputedStyle(x).overflowY; if (/auto|scroll/.test(o) && x.scrollHeight > x.clientHeight + 4) return x; } return null; })(doc);
      out.push('scroller ' + (sc ? sc.tagName.toLowerCase() + ' ' + sc.clientWidth + 'x' + sc.clientHeight + ' scrollW ' + sc.scrollWidth + ' overscroll ' + getComputedStyle(sc).overscrollBehaviorX : 'page') + ' | page scrollW ' + document.documentElement.scrollWidth + ' of ' + innerWidth + ' | bar ' + ($('#sh-wbar') ? ($('#sh-wbar').classList.contains('docked') ? 'docked' : 'floating') : 'none'));
    } catch (e) { out.push('p shape failed: ' + e.message); }
    const c = local.caps;
    out.push(c ? 'format test ' + c.at + ' via ' + c.way + ' | blocks added: ' + (c.added || '?') + ' | text nodes: ' + (c.nodes || '?') + ' | kept: ' + c.kept.join(', ') + ' | lost: ' + c.lost.join(', ') + ' | ' + c.chains.join(' ; ') : 'format test not run (Blocks, Formatting test, in a test record)');
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
