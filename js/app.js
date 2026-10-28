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

// Protocol: source on the left (typed, pasted or opened), Seal preview on the right.
(function () {
  const { value, bold, note } = Seal;
  const card = document.getElementById('protocol-source');
  const input = document.getElementById('protocol-input');
  const fileInput = document.getElementById('protocol-file');
  const imported = document.getElementById('protocol-imported');
  const importedName = document.getElementById('protocol-imported-name');
  const importedNote = document.getElementById('protocol-imported-note');
  const clearBtn = document.getElementById('protocol-clear');
  const READY_NOTE = importedNote.textContent;

  const editor = createEditor({
    preview: document.getElementById('protocol-sample'),
    label: document.getElementById('protocol-label'),
    toolbar: document.getElementById('protocol-toolbar'),
    copyBtn: document.getElementById('protocol-copy'),
  });

  const example = Seal.document([
    { title: 'Before experiments', sections: [
      { title: 'Biotin-LPETG preparation', steps: [
        `Inject ${value('50 µL')} of ${bold('biotin-LPETG')} at ${value('1 mM')} subcutaneously at the immunisation site, ${value('6 times')}, ${value('20 min')} apart.`,
        `Keep the ${bold('syringes')} on ice ${note('avoid bubbles')}.`,
      ] },
    ] },
  ]);

  // HTML read from a file or a rich paste; null while the text box is the source.
  let importedHtml = null;
  let errorBox = null;

  function render() {
    if (importedHtml !== null) {
      editor.showDocument(Parse.blocksToDoc(Parse.htmlToBlocks(importedHtml)));
      return;
    }
    const text = input.value;
    if (!text.trim()) { editor.showEmpty(example); return; }
    const blocks = Parse.looksLikeHtml(text) ? Parse.htmlToBlocks(text) : Parse.textToBlocks(text);
    editor.showDocument(Parse.blocksToDoc(blocks));
  }

  function setImported(html, name) {
    importedHtml = html;
    importedName.textContent = name;
    importedNote.textContent = READY_NOTE;
    imported.hidden = false;
    input.hidden = true;
    clearBtn.disabled = false;
    setError(null);
    render();
  }

  function clearImport() {
    importedHtml = null;
    imported.hidden = true;
    input.hidden = false;
    fileInput.value = '';
    render();
    input.focus();
  }

  function setReading(name) {
    importedName.textContent = name;
    importedNote.textContent = 'Reading the file…';
    imported.hidden = false;
    input.hidden = true;
    clearBtn.disabled = true;
    setError(null);
  }

  function setError(message) {
    if (errorBox) { errorBox.remove(); errorBox = null; }
    if (!message) return;
    errorBox = document.createElement('p');
    errorBox.className = 'error';
    errorBox.textContent = message;
    card.querySelector('.card-head').after(errorBox);
  }

  async function openFile(file) {
    // An exported web page, a protocol list page, or anything already in HTML.
    if (/\.html?$/i.test(file.name)) { setImported(await file.text(), file.name); return; }
    if (/\.(txt|md|csv|tsv)$/i.test(file.name)) {
      clearImport();
      input.value = await file.text();
      render();
      return;
    }
    if (!/\.docx$/i.test(file.name)) {
      setError('Open a .docx, .html or .txt file. Save an older .doc file as .docx in Word first.');
      return;
    }
    setReading(file.name);
    try {
      setImported(await Files.readDocx(file), file.name);
    } catch (err) {
      clearImport();
      setError(`This file could not be read (${err.message}).`);
    }
  }

  input.addEventListener('input', render);

  // A paste from Word or a web page carries HTML: use it to keep headings, lists, tables and bold.
  input.addEventListener('paste', (e) => {
    const html = e.clipboardData && e.clipboardData.getData('text/html');
    if (!html || !/<(p|h[1-6]|li|td|table|b|strong)[\s>]/i.test(html) || input.value.trim()) return;
    e.preventDefault();
    setImported(html, 'Pasted content');
  });

  fileInput.addEventListener('change', () => { if (fileInput.files[0]) openFile(fileInput.files[0]); });
  clearBtn.addEventListener('click', clearImport);

  let depth = 0;
  card.addEventListener('dragenter', (e) => { e.preventDefault(); depth++; card.classList.add('dragging'); });
  card.addEventListener('dragover', (e) => e.preventDefault());
  card.addEventListener('dragleave', () => { if (--depth <= 0) { depth = 0; card.classList.remove('dragging'); } });
  card.addEventListener('drop', (e) => {
    e.preventDefault();
    depth = 0;
    card.classList.remove('dragging');
    const file = e.dataTransfer.files[0];
    if (file) openFile(file);
  });

  render();
})();

// Experiment: a short header, the mice, what was done, and what changed on the day.
(function () {
  const fields = Array.from(document.querySelectorAll('#panel-experiment [data-field]'));
  const get = (name) => (document.getElementById(`exp-${name}`).value || '').trim();

  const editor = createEditor({
    preview: document.getElementById('exp-preview'),
    label: document.getElementById('exp-label'),
    toolbar: document.getElementById('exp-toolbar'),
    copyBtn: document.getElementById('exp-copy'),
    emptyLabel: 'Fill in the fields on the left',
  });

  // "Protocol: ML-014" with the label in bold and the answer in blue bold.
  function entry(label, text) {
    return `${Seal.bold(`${label}:`)} ${Detect.highlight(text)}`;
  }

  // A free answer stays prose: one paragraph per line, values in blue.
  function paragraphs(text) {
    return text.split(/\n/).map((line) => line.trim()).filter(Boolean)
      .map((line) => ({ type: 'para', html: Detect.highlight(Detect.cleanDashes(line)) }));
  }

  function blocksFromText(text) {
    if (!text.trim()) return [];
    const doc = Parse.blocksToDoc(Parse.textToBlocks(text));
    // A short answer has no chapters of its own, so only its content is kept.
    return doc.flatMap((ch) => [
      ...(ch.title ? [{ type: 'para', html: Seal.bold(ch.title) }] : []),
      ...ch.blocks,
      ...ch.sections.flatMap((sec) => [{ type: 'para', html: Seal.bold(sec.title) }, ...sec.blocks]),
    ]);
  }

  function build() {
    const header = [
      ['Protocol', get('protocol')],
      ['Experiment', get('name')],
      ['Date', get('date')],
      ['Operator', get('operator')],
    ].filter(([, text]) => text).map(([label, text]) => ({ type: 'para', html: entry(label, text) }));

    const design = get('design');
    const mice = get('mice');
    const method = get('method');
    const deviations = get('deviations');
    const volumes = get('volumes');

    const chapters = [];
    if (header.length || design) {
      chapters.push({
        title: 'Experiment',
        blocks: [
          ...header,
          ...(design ? [{ type: 'para', html: Seal.bold('Design at a glance:') }, ...paragraphs(design)] : []),
        ],
        sections: [],
      });
    }
    if (mice) {
      const blocks = Parse.blocksToDoc(Parse.textToBlocks(mice)).flatMap((ch) => ch.blocks);
      chapters.push({ title: 'Mice', blocks, sections: [] });
    }
    if (method) {
      const doc = Parse.blocksToDoc(Parse.textToBlocks(method));
      // Keep the chapters of a pasted procedure; wrap a plain list of steps in one.
      if (doc.some((ch) => ch.title)) chapters.push(...doc.filter((ch) => ch.title || ch.blocks.length));
      else chapters.push({ title: 'Procedure', blocks: doc.flatMap((ch) => ch.blocks), sections: [] });
    }
    if (deviations) chapters.push({ title: 'Deviations and notes', blocks: blocksFromText(deviations), sections: [] });
    if (volumes) chapters.push({ title: 'Volumes actually used', blocks: blocksFromText(volumes), sections: [] });
    return chapters;
  }

  function render() {
    const chapters = build();
    if (!chapters.length) {
      editor.showEmpty('<p class="hint">The Seal version appears here as you type.</p>');
      return;
    }
    editor.showDocument(chapters);
  }

  for (const field of fields) field.addEventListener('input', render);
  render();
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
