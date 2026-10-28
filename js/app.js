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

// Protocol: source (typed text, pasted HTML or a .docx) on the left, Seal preview on the right.
(function () {
  const { value, bold, note } = Seal;
  const card = document.getElementById('protocol-source');
  const input = document.getElementById('protocol-input');
  const fileInput = document.getElementById('protocol-file');
  const imported = document.getElementById('protocol-imported');
  const importedName = document.getElementById('protocol-imported-name');
  const clearBtn = document.getElementById('protocol-clear');
  const preview = document.getElementById('protocol-sample');
  const label = document.getElementById('protocol-label');

  const example = Seal.document([
    { title: 'Before experiments', sections: [
      { title: 'Biotin-LPETG preparation', steps: [
        `Inject ${value('50 µL')} of ${bold('biotin-LPETG')} at ${value('1 mM')} subcutaneously at the immunisation site, ${value('6 times')}, ${value('20 min')} apart.`,
        `Keep the ${bold('syringes')} on ice ${note('avoid bubbles')}.`,
      ] },
    ] },
  ]);

  // HTML read from a .docx or a rich paste; null while the text box is the source.
  let importedHtml = null;
  let errorBox = null;

  function plural(n, word) { return `${n} ${word}${n === 1 ? '' : 's'}`; }

  function show(doc) {
    const html = Seal.document(doc);
    const chapters = doc.filter((c) => c.title).length;
    const steps = (html.match(/<li>/g) || []).length;
    const values = (html.match(/data-native-color="blue"/g) || []).length;
    label.textContent = [chapters && plural(chapters, 'chapter'), plural(steps, 'step'), plural(values, 'value')]
      .filter(Boolean).join(', ');
    paint(html);
  }

  // The 184 dash separator is wider than the card: drawn as a clipped line in the preview only.
  function paint(html) {
    preview.innerHTML = html;
    for (const p of preview.querySelectorAll('p')) if (/^-{184}$/.test(p.textContent)) p.className = 'sep';
  }

  function render() {
    if (importedHtml !== null) return show(Parse.blocksToDoc(Parse.htmlToBlocks(importedHtml)));
    const text = input.value;
    if (!text.trim()) {
      label.textContent = 'Example output';
      paint(example);
      return;
    }
    const blocks = Parse.looksLikeHtml(text) ? Parse.htmlToBlocks(text) : Parse.textToBlocks(text);
    show(Parse.blocksToDoc(blocks));
  }

  function setImported(html, name) {
    importedHtml = html;
    importedName.textContent = name;
    imported.hidden = false;
    input.hidden = true;
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

  function setError(message) {
    if (errorBox) { errorBox.remove(); errorBox = null; }
    if (!message) return;
    errorBox = document.createElement('p');
    errorBox.className = 'error';
    errorBox.textContent = message;
    card.querySelector('.card-head').after(errorBox);
  }

  // mammoth.js is large, so it loads the first time a Word file is opened.
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

  async function openDocx(file) {
    if (!/\.docx$/i.test(file.name)) {
      setError('Only .docx files can be imported. Save older .doc files as .docx in Word first.');
      return;
    }
    try {
      const mammoth = await loadMammoth();
      const result = await mammoth.convertToHtml(
        { arrayBuffer: await file.arrayBuffer() },
        { styleMap: ["p[style-name='Title'] => h1.doc-title:fresh"] }
      );
      setImported(result.value, file.name);
    } catch (err) {
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

  fileInput.addEventListener('change', () => { if (fileInput.files[0]) openDocx(fileInput.files[0]); });
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
    if (file) openDocx(file);
  });

  // ---- Editing the preview by hand (step 5) ----

  // Character offsets of the selection inside one line of the preview.
  function offsetsIn(el, range) {
    const walker = document.createTreeWalker(el, NodeFilter.SHOW_TEXT);
    let pos = 0;
    let start = null;
    let end = null;
    for (let node = walker.nextNode(); node; node = walker.nextNode()) {
      if (node === range.startContainer) start = pos + range.startOffset;
      if (node === range.endContainer) end = pos + range.endOffset;
      pos += node.nodeValue.length;
    }
    if (start === null) start = range.intersectsNode(el) ? 0 : null;
    if (end === null) end = range.intersectsNode(el) ? pos : null;
    return start === null || end === null ? null : { start: Math.min(start, end), end: Math.max(start, end) };
  }

  // The lines the user can format: steps, paragraphs, titles and table cells.
  const LINES = 'li, p, h2, h3, td, th';

  function selectedLines() {
    const sel = window.getSelection();
    if (!sel || sel.isCollapsed || !sel.rangeCount) return [];
    const range = sel.getRangeAt(0);
    if (!preview.contains(range.commonAncestorContainer)) return [];
    const out = [];
    for (const el of preview.querySelectorAll(LINES)) {
      if (el.querySelector(LINES) || !range.intersectsNode(el)) continue;
      const offsets = offsetsIn(el, range);
      if (offsets && offsets.end > offsets.start) out.push({ el, ...offsets });
    }
    return out;
  }

  function applyFormat(kind) {
    const lines = selectedLines();
    if (!lines.length) return;
    // One click formats everything selected, unless it is all formatted already.
    const on = kind !== 'none' && !lines.every(({ el, start, end }) =>
      Edit.hasFormat(Parse.runsFromElement(el), start, end, kind));
    for (const { el, start, end } of lines) {
      const runs = Parse.runsFromElement(el);
      const next = kind === 'none' ? Edit.clearFormat(runs, start, end) : Edit.setFormat(runs, start, end, kind, on);
      el.innerHTML = Edit.renderRuns(next);
    }
    // Keep the same characters selected, so the user can try another button.
    const first = lines[0];
    const last = lines[lines.length - 1];
    const sel = window.getSelection();
    const range = document.createRange();
    const point = (el, offset) => {
      const walker = document.createTreeWalker(el, NodeFilter.SHOW_TEXT);
      let pos = 0;
      for (let node = walker.nextNode(); node; node = walker.nextNode()) {
        if (pos + node.nodeValue.length >= offset) return [node, offset - pos];
        pos += node.nodeValue.length;
      }
      return [el, el.childNodes.length];
    };
    range.setStart(...point(first.el, first.start));
    range.setEnd(...point(last.el, last.end));
    sel.removeAllRanges();
    sel.addRange(range);
    updateTools();
  }

  const tools = Array.from(document.querySelectorAll('.tool'));
  const hint = document.getElementById('protocol-hint');

  function updateTools() {
    const lines = selectedLines();
    for (const tool of tools) {
      const kind = tool.dataset.format;
      tool.disabled = !lines.length;
      if (kind === 'none') continue;
      const active = lines.length > 0 && lines.every(({ el, start, end }) =>
        Edit.hasFormat(Parse.runsFromElement(el), start, end, kind));
      tool.setAttribute('aria-pressed', String(active));
    }
    hint.textContent = lines.length ? 'Formatting applies to the selected text' : 'Select text in the preview to format it';
  }

  for (const tool of tools) {
    // mousedown would drop the selection before the click arrives.
    tool.addEventListener('mousedown', (e) => e.preventDefault());
    tool.addEventListener('click', () => applyFormat(tool.dataset.format));
  }

  document.addEventListener('selectionchange', () => { if (!preview.hidden) updateTools(); });

  preview.addEventListener('keydown', (e) => {
    if (!(e.ctrlKey || e.metaKey)) return;
    const key = e.key.toLowerCase();
    const kind = key === 'b' ? 'b' : key === 'i' ? 'i' : (key === 'v' && e.shiftKey) ? 'v' : null;
    if (!kind) return;
    e.preventDefault();
    applyFormat(kind);
  });

  preview.contentEditable = 'true';
  preview.spellcheck = false;

  render();
  updateTools();
})();
