// Tab switching. The active tab is kept in the URL hash so a link opens the right module.
(function () {
  const tabs = Array.from(document.querySelectorAll('[role="tab"]'));
  const names = tabs.map((t) => t.dataset.tab);

  function show(name) {
    if (!names.includes(name)) name = names[0];
    for (const tab of tabs) {
      const active = tab.dataset.tab === name;
      tab.setAttribute('aria-selected', String(active));
      tab.tabIndex = active ? 0 : -1;
      document.getElementById(tab.getAttribute('aria-controls')).hidden = !active;
    }
  }

  for (const tab of tabs) {
    tab.addEventListener('click', () => {
      history.replaceState(null, '', '#' + tab.dataset.tab);
      show(tab.dataset.tab);
    });
    // Arrow keys move between tabs, as in a native tab bar.
    tab.addEventListener('keydown', (e) => {
      if (e.key !== 'ArrowRight' && e.key !== 'ArrowLeft') return;
      const step = e.key === 'ArrowRight' ? 1 : -1;
      const next = tabs[(tabs.indexOf(tab) + step + tabs.length) % tabs.length];
      next.click();
      next.focus();
    });
  }

  window.addEventListener('hashchange', () => show(location.hash.slice(1)));
  show(location.hash.slice(1));
})();

// Opening files: Word through mammoth, a saved web page as it is, plain text in the box.
const Files = (function () {
  // mammoth.js is 620 kB, so it loads the first time a Word file is opened.
  let mammothReady = null;
  function loadMammoth() {
    mammothReady = mammothReady || new Promise((resolve, reject) => {
      const s = document.createElement('script');
      s.src = 'vendor/mammoth.browser.min.js';
      s.onload = () => resolve(window.mammoth);
      s.onerror = () => { mammothReady = null; reject(new Error('Could not load the Word reader.')); };
      document.head.appendChild(s);
    });
    return mammothReady;
  }

  async function readDocx(file) {
    const mammoth = await loadMammoth();
    const result = await mammoth.convertToHtml(
      { arrayBuffer: await file.arrayBuffer() },
      { styleMap: ["p[style-name='Title'] => h1.doc-title:fresh"] }
    );
    return result.value;
  }

  return { readDocx };
})();

// Convert: a queue of documents on the left, the Seal version on the right.
(function () {
  const { value, bold, note } = Seal;
  const card = document.getElementById('convert-source');
  const fileInput = document.getElementById('convert-files');
  const folderInput = document.getElementById('convert-folder');
  const issuesBox = document.getElementById('convert-issues');
  const list = document.getElementById('convert-list');
  const emptyState = document.getElementById('convert-empty');
  const progress = document.getElementById('convert-progress');
  const pasteBox = document.getElementById('convert-input');
  const title = document.getElementById('convert-title');
  const nextBtn = document.getElementById('convert-next');
  const allBtn = document.getElementById('convert-all');
  const restoredNote = document.getElementById('convert-restored');
  const dropHeaderBox = document.getElementById('convert-drop-header');
  const copyBtn = document.getElementById('convert-copy');

  const editor = createEditor({
    preview: document.getElementById('convert-preview'),
    label: document.getElementById('convert-label'),
    toolbar: document.getElementById('convert-toolbar'),
    copyBtn,
    onCopy: () => { if (current) markDone(current); },
  });

  const example = Seal.document([
    { title: 'Before experiments', sections: [
      { title: 'Biotin-LPETG preparation', steps: [
        `Inject ${value('50 µL')} of ${bold('biotin-LPETG')} at ${value('1 mM')} subcutaneously at the immunisation site, ${value('6 times')}, ${value('20 min')} apart.`,
        `Keep the ${bold('syringes')} on ice ${note('avoid bubbles')}.`,
      ] },
    ] },
  ]);

  // One entry per document: { name, file, kind, source, html, done, error }
  const documents = [];
  let current = null;
  let skippedFiles = 0;
  let converting = false;
  // The document the preview is actually showing, which may lag behind a click.
  let showing = null;

  function render() {
    list.innerHTML = '';
    for (const doc of documents) {
      const item = document.createElement('li');
      item.className = 'queue-item';
      if (doc === current) item.classList.add('is-current');
      if (doc.done) item.classList.add('is-done');
      item.innerHTML = `<span class="queue-tick" aria-hidden="true"></span>`
        + `<span class="queue-name"></span>`
        + (doc.issues && doc.issues.length ? '<span class="queue-warn" title="Something may be missing"></span>' : '')
        + `<button class="queue-drop" title="Remove from the list" aria-label="Remove">×</button>`;
      const name = item.querySelector('.queue-name');
      name.textContent = doc.error ? `${doc.name}, ${doc.error}` : doc.name;
      if (doc.folder) {
        const path = document.createElement('span');
        path.className = 'queue-path';
        path.textContent = doc.folder;
        name.appendChild(path);
      }
      item.addEventListener('click', (e) => {
        if (e.target.closest('.queue-drop')) { remove(doc); return; }
        open(doc);
      });
      list.appendChild(item);
    }
    emptyState.hidden = documents.length > 0;
    const done = documents.filter((d) => d.done).length;
    progress.hidden = documents.length === 0 && !skippedFiles;
    progress.textContent = `${done} of ${documents.length} copied`
      + (skippedFiles ? `, ${skippedFiles} file(s) ignored (not .docx, .html or .txt)` : '');
    nextBtn.hidden = !documents.some((d) => !d.done && d !== current);
    const pending = documents.filter((d) => d.html === null && !d.error).length;
    allBtn.hidden = pending === 0;
    allBtn.textContent = converting ? 'Converting…' : `Convert all (${pending})`;
    allBtn.disabled = converting;
    const warned = documents.filter((d) => d.issues && d.issues.length).length;
    if (warned) progress.textContent += `, ${warned} to look at`;
    remember();
  }

  function remove(doc) {
    const index = documents.indexOf(doc);
    documents.splice(index, 1);
    if (current === doc) {
      current = documents[index] || documents[index - 1] || null;
      if (current) open(current); else showExample();
    }
    render();
  }

  function showExample() {
    title.textContent = 'Seal preview';
    showing = null;
    showIssues([]);
    editor.showEmpty(example);
  }

  // What the conversion could not carry over, named rather than left to chance.
  function showIssues(issues) {
    issuesBox.innerHTML = '';
    issuesBox.hidden = !issues.length;
    for (const issue of issues) {
      const line = document.createElement('li');
      line.textContent = issue.message;
      issuesBox.appendChild(line);
    }
  }

  // What the user corrected in the preview is kept with the document.
  function save() {
    if (showing && !showing.error) showing.html = editor.html();
  }

  async function open(doc) {
    save();
    showing = null;
    current = doc;
    render();
    title.textContent = doc.name;
    if (doc.error) { showIssues([]); editor.showEmpty(`<p class="hint">${Seal.esc(doc.error)}</p>`); return; }
    if (doc.html === null) {
      showIssues([]);
      editor.showEmpty('<p class="hint">Reading the file…</p>');
      try {
        doc.source = doc.source !== null ? doc.source : await readFile(doc.file);
        convert(doc);
        render();
      } catch (err) {
        doc.error = err.message;
        render();
        editor.showEmpty(`<p class="hint">${Seal.esc(err.message)}</p>`);
        return;
      }
    }
    if (current !== doc) return; // the user clicked another document meanwhile
    showIssues(doc.issues || []);
    editor.showHtml(doc.html);
    showing = doc;
  }

  // Reads and converts a document without opening it, for Convert all.
  async function prepare(doc) {
    if (doc.html !== null || doc.error) return;
    try {
      if (doc.source === null) doc.source = await readFile(doc.file);
      convert(doc);
    } catch (err) {
      doc.error = err.message;
    }
  }

  async function convertAll() {
    converting = true;
    render();
    for (const doc of documents.slice()) {
      await prepare(doc);
      render();
    }
    converting = false;
    const warned = documents.filter((d) => d.issues && d.issues.length);
    render();
    if (warned.length && (!current || !current.issues || !current.issues.length)) open(warned[0]);
  }

  // The check always looks at the whole document, so leaving the title block
  // out on purpose is never reported as lost content.
  function convert(doc) {
    const blocks = blocksOf(doc);
    const whole = Seal.document(Parse.blocksToDoc(blocks));
    doc.html = dropHeaderBox.checked ? Seal.document(Parse.blocksToDoc(blocks, { dropHeader: true })) : whole;
    doc.issues = Check.checkDocument({ source: doc.source, result: whole, isHtml: doc.kind === 'html' });
  }

  function blocksOf(doc) {
    if (doc.kind === 'html') return Parse.htmlToBlocks(doc.source);
    return Parse.looksLikeHtml(doc.source) ? Parse.htmlToBlocks(doc.source) : Parse.textToBlocks(doc.source);
  }

  async function readFile(file) {
    if (/\.docx$/i.test(file.name)) return Files.readDocx(file);
    return file.text();
  }

  function kindOf(name) {
    if (/\.docx$/i.test(name)) return 'html';
    if (/\.html?$/i.test(name)) return 'html';
    if (/\.(txt|md|csv|tsv)$/i.test(name)) return 'text';
    return null;
  }

  // Word leaves ~$ lock files behind, and a folder carries all sorts of things.
  function isWanted(file) {
    const name = file.name;
    return !/^[.~]/.test(name) && !/^~\$/.test(name) && kindOf(name) !== null;
  }

  function add(files) {
    const wanted = Array.from(files).filter(isWanted);
    skippedFiles += Array.from(files).length - wanted.length;
    let first = null;
    for (const file of wanted) {
      const path = file.webkitRelativePath || file.fullPath || '';
      const folder = path.includes('/') ? path.slice(0, path.lastIndexOf('/')) : '';
      if (documents.some((d) => d.name === file.name && d.folder === folder)) continue;
      const doc = {
        name: file.name,
        folder,
        file,
        kind: kindOf(file.name),
        source: null,
        html: null,
        issues: null,
        done: false,
        error: null,
      };
      documents.push(doc);
      first = first || doc;
    }
    render();
    if (first && (!current || current.done)) open(first);
  }

  // A folder dropped on the card: walk it, subfolders included.
  async function filesFromEntry(entry, path = '') {
    if (entry.isFile) {
      const file = await new Promise((resolve, reject) => entry.file(resolve, reject));
      file.fullPath = path + file.name;
      return [file];
    }
    const reader = entry.createReader();
    const entries = [];
    for (;;) {
      const batch = await new Promise((resolve, reject) => reader.readEntries(resolve, reject));
      if (!batch.length) break;
      entries.push(...batch);
    }
    const nested = await Promise.all(entries.map((child) => filesFromEntry(child, `${path}${entry.name}/`)));
    return nested.flat();
  }

  function markDone(doc) {
    doc.done = true;
    render();
  }

  // The list lives in this browser only, so a migration can span several days.
  const STORE = 'seal-converter.queue.v1';
  const STORE_LIMIT = 4e6;

  function remember() {
    save();
    const kept = documents.filter((d) => d !== pasted).map((d) => ({
      name: d.name, folder: d.folder, kind: d.kind, done: d.done, html: d.html, issues: d.issues,
    }));
    // Pictures make a document heavy; the biggest lose their body rather than their place in the list.
    let payload = JSON.stringify(kept);
    while (payload.length > STORE_LIMIT && kept.some((d) => d.html)) {
      const heaviest = kept.reduce((worst, d) => ((d.html || '').length > (worst.html || '').length ? d : worst), kept[0]);
      heaviest.html = null;
      heaviest.issues = null;
      payload = JSON.stringify(kept);
    }
    try { localStorage.setItem(STORE, payload); } catch { /* private window, or no room */ }
  }

  function recall() {
    let kept = [];
    try { kept = JSON.parse(localStorage.getItem(STORE) || '[]'); } catch { kept = []; }
    if (!Array.isArray(kept) || !kept.length) return;
    for (const entry of kept) {
      documents.push({
        name: entry.name,
        folder: entry.folder || '',
        file: null,
        kind: entry.kind || 'text',
        source: null,
        html: entry.html || null,
        issues: entry.issues || null,
        done: !!entry.done,
        error: entry.html ? null : 'Add the file again to convert it.',
      });
    }
    const done = documents.filter((d) => d.done).length;
    restoredNote.hidden = false;
    restoredNote.innerHTML = `<button class="link" id="convert-forget">Clear the list</button>`;
    restoredNote.insertAdjacentText('afterbegin', `${documents.length} documents from last time, ${done} already copied. `);
    document.getElementById('convert-forget').addEventListener('click', () => {
      documents.length = 0;
      current = null;
      skippedFiles = 0;
      restoredNote.hidden = true;
      try { localStorage.removeItem(STORE); } catch { /* nothing to clear */ }
      render();
      showExample();
    });
    render();
  }

  nextBtn.addEventListener('click', () => {
    const start = documents.indexOf(current) + 1;
    const next = documents.slice(start).find((d) => !d.done) || documents.find((d) => !d.done && d !== current);
    if (next) open(next);
  });

  allBtn.addEventListener('click', convertAll);

  // The setting changes the shape of every document, so the list is converted again.
  dropHeaderBox.addEventListener('change', () => {
    for (const doc of documents) {
      if (doc.source !== null) convert(doc);
      else if (doc.file) { doc.html = null; doc.issues = null; }
    }
    showing = null;
    render();
    if (current) open(current); else showExample();
  });

  for (const input of [fileInput, folderInput]) {
    input.addEventListener('change', () => {
      if (input.files.length) add(Array.from(input.files));
      input.value = '';
    });
  }

  // Pasted text behaves like a document of its own.
  let pasted = null;
  function showPasted() {
    const text = pasteBox.value;
    if (!text.trim()) {
      if (pasted) { remove(pasted); pasted = null; }
      return;
    }
    if (!pasted) {
      pasted = { name: 'Pasted document', folder: '', file: null, kind: 'text', source: text, html: null, issues: null, done: false, error: null };
      documents.push(pasted);
    }
    pasted.source = text;
    convert(pasted);
    pasted.done = false;
    current = pasted;
    showing = null;
    render();
    title.textContent = pasted.name;
    showIssues(pasted.issues);
    editor.showHtml(pasted.html);
    showing = pasted;
  }
  pasteBox.addEventListener('input', showPasted);

  let depth = 0;
  card.addEventListener('dragenter', (e) => { e.preventDefault(); depth++; card.classList.add('dragging'); });
  card.addEventListener('dragover', (e) => e.preventDefault());
  card.addEventListener('dragleave', () => { if (--depth <= 0) { depth = 0; card.classList.remove('dragging'); } });
  card.addEventListener('drop', async (e) => {
    e.preventDefault();
    depth = 0;
    card.classList.remove('dragging');
    const entries = Array.from(e.dataTransfer.items || [])
      .map((item) => (item.webkitGetAsEntry ? item.webkitGetAsEntry() : null))
      .filter(Boolean);
    if (entries.some((entry) => entry.isDirectory)) {
      const groups = await Promise.all(entries.map((entry) => filesFromEntry(entry)));
      add(groups.flat());
      return;
    }
    if (e.dataTransfer.files.length) add(Array.from(e.dataTransfer.files));
  });

  recall();
  render();
  const firstPending = documents.find((d) => !d.done && d.html);
  if (firstPending) open(firstPending); else showExample();
})();

// Antibody mix: a panel in, the volumes to pipette out, as Seal tables.
(function () {
  const card = document.getElementById('mix-source');
  const fileInput = document.getElementById('mix-file');
  const panelInput = document.getElementById('mix-panel');
  const summary = document.getElementById('mix-summary');

  const editor = createEditor({
    preview: document.getElementById('mix-preview'),
    label: document.getElementById('mix-label'),
    toolbar: document.getElementById('mix-toolbar'),
    copyBtn: document.getElementById('mix-copy'),
    emptyLabel: 'Paste a panel to see the volumes',
  });

  function number(id, fallback) {
    const value = Number(document.getElementById(id).value);
    return Number.isFinite(value) && value > 0 ? value : fallback;
  }

  // SheetJS is 860 kB, so it loads the first time a workbook is opened.
  let sheetReady = null;
  function loadSheetJs() {
    sheetReady = sheetReady || new Promise((resolve, reject) => {
      const s = document.createElement('script');
      s.src = 'vendor/xlsx.full.min.js';
      s.onload = () => resolve(window.XLSX);
      s.onerror = () => { sheetReady = null; reject(new Error('Could not load the spreadsheet reader.')); };
      document.head.appendChild(s);
    });
    return sheetReady;
  }

  const µL = (volume) => `${volume} µL`;
  // Volumes and dilutions are values to respect; a clone or a catalogue number is not.
  const val = (text) => (text ? Seal.value(text) : '');
  const txt = (text) => Seal.esc(text || '');
  const table = (head, rows) => ({
    type: 'raw',
    html: Seal.rawTable(head.map(Seal.bold), rows),
  });

  function settings() {
    return {
      samples: number('mix-samples', 1),
      excess: Number(document.getElementById('mix-excess').value) || 0,
      vf: number('mix-vf', 100),
    };
  }

  function render() {
    const rows = panelInput.value.split(/\r?\n/).map((line) => line.split('\t'));
    const antibodies = Mix.readPanel(rows);
    const options = settings();
    const mix = Mix.computeMix({ antibodies, ...options });

    summary.innerHTML = mix.warnings.length
      ? `<span class="warn">${Seal.esc(mix.warnings.join(' '))}</span>`
      : `${mix.rows.length} antibodies, ${options.samples} samples + ${options.excess} % excess, total ${mix.vTotal} µL.`;

    if (!mix.rows.length) {
      editor.showEmpty('<p class="hint">The volumes appear here once the panel has a dilution column.</p>');
      return;
    }

    const sections = [];
    // The panel itself, when the file carries more than markers and dilutions.
    if (antibodies.some((ab) => ab.channel || ab.clone || ab.supplier || ab.catalogue)) {
      sections.push({
        title: 'Panel',
        blocks: [table(
          ['Channel', 'Fluorochrome', 'Marker', 'Clone', 'Supplier', 'Cat. no.', 'Dilution'],
          antibodies.map((ab) => [txt(ab.channel), txt(ab.fluorochrome), txt(ab.marker), txt(ab.clone),
            txt(ab.supplier), txt(ab.catalogue), val(ab.dilution ? `1:${ab.dilution}` : '')])
        )],
      });
    }
    sections.push({
      title: 'Master mix',
      blocks: [table(['Reagent', 'Dilution', 'Volume'], [
        [txt('PBS'), '', val(µL(mix.pbs))],
        [Seal.bold('Brilliant Stain Buffer'), '', val(µL(mix.bsb))],
        ...mix.rows.map((row) => [Seal.bold(row.name), val(`1:${row.dilution}`), val(µL(row.volume))]),
        [Seal.bold('Total'), '', val(µL(mix.vTotal))],
      ])],
    });
    sections.push({
      title: 'Single stains',
      blocks: [table(['Antibody', 'Volume in one test'],
        mix.singleStains.map((stain) => [Seal.bold(stain.name), val(µL(stain.volume))]))],
    });

    editor.showDocument([{
      title: 'Antibody mix',
      blocks: [{
        type: 'para',
        html: `${Seal.bold('Samples:')} ${Seal.value(String(options.samples))}, `
          + `${Seal.bold('excess:')} ${Seal.value(`${options.excess} %`)}, `
          + `${Seal.bold('volume per test:')} ${Seal.value(µL(options.vf))}, `
          + `${Seal.bold('total:')} ${Seal.value(µL(mix.vTotal))}.`,
      }],
      sections,
    }]);
  }

  async function openWorkbook(file) {
    try {
      const XLSX = await loadSheetJs();
      const book = XLSX.read(await file.arrayBuffer(), { type: 'array' });
      const sheet = book.Sheets[book.SheetNames[0]];
      const rows = XLSX.utils.sheet_to_json(sheet, { header: 1, blankrows: false, defval: '' });
      panelInput.value = rows.map((row) => row.join('\t')).join('\n');
      render();
    } catch (err) {
      summary.innerHTML = `<span class="warn">This file could not be read (${Seal.esc(err.message)}).</span>`;
    }
  }

  for (const field of document.querySelectorAll('#panel-mix [data-mix]')) {
    field.addEventListener('input', render);
  }
  fileInput.addEventListener('change', () => { if (fileInput.files[0]) openWorkbook(fileInput.files[0]); });

  let depth = 0;
  card.addEventListener('dragenter', (e) => { e.preventDefault(); depth++; card.classList.add('dragging'); });
  card.addEventListener('dragover', (e) => e.preventDefault());
  card.addEventListener('dragleave', () => { if (--depth <= 0) { depth = 0; card.classList.remove('dragging'); } });
  card.addEventListener('drop', (e) => {
    e.preventDefault();
    depth = 0;
    card.classList.remove('dragging');
    if (e.dataTransfer.files[0]) openWorkbook(e.dataTransfer.files[0]);
  });

  render();
})();
