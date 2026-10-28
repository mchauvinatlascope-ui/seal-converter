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
  const importedNote = document.getElementById('protocol-imported-note');
  const clearBtn = document.getElementById('protocol-clear');
  const READY_NOTE = importedNote.textContent;
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
    importedNote.textContent = READY_NOTE;
    imported.hidden = false;
    input.hidden = true;
    setError(null);
    render();
  }

  // The Word reader is 620 kB and loads on the first file, which takes a moment.
  function setReading(name) {
    importedName.textContent = name;
    importedNote.textContent = 'Reading the file…';
    imported.hidden = false;
    input.hidden = true;
    clearBtn.disabled = true;
    setError(null);
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

  async function openFile(file) {
    // An exported web page, a protocol list page, or anything already in HTML.
    if (/\.html?$/i.test(file.name)) {
      setImported(await file.text(), file.name);
      return;
    }
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
      const mammoth = await loadMammoth();
      const result = await mammoth.convertToHtml(
        { arrayBuffer: await file.arrayBuffer() },
        { styleMap: ["p[style-name='Title'] => h1.doc-title:fresh"] }
      );
      setImported(result.value, file.name);
    } catch (err) {
      clearImport();
      setError(`This file could not be read (${err.message}).`);
    }
    clearBtn.disabled = false;
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

  // ---- Chapter, section or step: moving a line between the three ----

  // What the caret sits in, and where that line can go.
  const ROLES = ['chapter', 'section', 'step'];

  function lineAt() {
    const sel = window.getSelection();
    if (!sel || !sel.rangeCount) return null;
    let node = sel.getRangeAt(0).startContainer;
    if (!preview.contains(node)) return null;
    if (node.nodeType === 3) node = node.parentNode;
    const el = node.closest('h2, h3, li, p');
    if (!el || el.classList.contains('sep')) return null;
    const role = el.tagName === 'H2' ? 'chapter' : el.tagName === 'H3' ? 'section' : el.tagName === 'LI' ? 'step' : 'text';
    return { el, role };
  }

  // Rebuilds the whole preview from its own content, so numbering follows.
  function rebuild(changer) {
    const blocks = [];
    for (const el of preview.children) {
      if (el.tagName === 'P' && el.classList.contains('sep')) continue;
      if (el.tagName === 'TABLE') {
        const rows = Array.from(el.querySelectorAll('tr'));
        const head = rows[0] && Array.from(rows[0].children).every((c) => c.tagName === 'TH') ? rows.shift() : null;
        blocks.push({
          kind: 'table',
          head: head && Array.from(head.children).map((c) => c.innerHTML),
          rows: rows.map((tr) => Array.from(tr.children).map((c) => c.innerHTML)),
        });
        continue;
      }
      if (el.tagName === 'OL') {
        for (const li of el.children) blocks.push({ kind: 'step', el: li, html: li.innerHTML });
        continue;
      }
      const kind = el.tagName === 'H2' ? 'chapter' : el.tagName === 'H3' ? 'section' : 'text';
      // A title shown as "I. Day 0" is stored as "Day 0": Seal numbers it again.
      const html = kind === 'text' ? el.innerHTML : stripMarker(el.innerHTML);
      blocks.push({ kind, el, html });
    }
    const changed = changer(blocks);
    if (!changed) return;

    // Back to the shape Seal.document() renders.
    const chapters = [];
    let chapter = null;
    let section = null;
    const ensure = () => {
      if (!chapter) { chapter = { title: null, blocks: [], sections: [] }; chapters.push(chapter); }
      return chapter;
    };
    const target = () => (section || ensure()).blocks;
    for (const block of blocks) {
      if (block.kind === 'chapter') {
        chapter = { title: block.html, blocks: [], sections: [] };
        chapters.push(chapter);
        section = null;
      } else if (block.kind === 'section') {
        section = { title: block.html, blocks: [] };
        ensure().sections.push(section);
      } else if (block.kind === 'step') {
        const list = target();
        const last = list[list.length - 1];
        if (last && last.type === 'steps') last.items.push(block.html);
        else list.push({ type: 'steps', items: [block.html] });
      } else if (block.kind === 'table') {
        target().push({ type: 'table', head: block.head, rows: block.rows });
      } else {
        target().push({ type: 'para', html: block.html });
      }
    }
    // Titles are plain text in Seal, so a title keeps its words, not its tags.
    for (const ch of chapters) {
      if (ch.title) ch.title = textOf(ch.title);
      for (const sec of ch.sections) sec.title = textOf(sec.title);
    }
    paint(Seal.document(chapters));
    updateTools();
  }

  // The I. and a. the preview shows come from the renderer, not from the title.
  function stripMarker(html) {
    return textOf(html).replace(/^(?:[IVXLC]+|[a-z]{1,2})[.)]\s+/, '');
  }

  function textOf(html) {
    const holder = document.createElement('div');
    holder.innerHTML = html;
    return holder.textContent.replace(/\s+/g, ' ').trim();
  }

  function moveLine(direction) {
    const line = lineAt();
    if (!line) return;
    const wanted = {
      up: { step: 'section', text: 'section', section: 'chapter', chapter: 'chapter' },
      down: { chapter: 'section', section: 'step', step: 'step', text: 'text' },
    }[direction][line.role];
    if (wanted === line.role) return;
    rebuild((blocks) => {
      const block = blocks.find((b) => b.el === line.el);
      if (!block) return false;
      block.kind = wanted;
      return true;
    });
  }

  const tools = Array.from(document.querySelectorAll('.tool'));
  const hint = document.getElementById('protocol-hint');
  const roleLabel = document.getElementById('protocol-role');

  function updateTools() {
    const lines = selectedLines();
    const line = lineAt();
    const ROLE_NAMES = { chapter: 'Chapter', section: 'Section', step: 'Step', text: 'Paragraph' };
    roleLabel.textContent = line ? ROLE_NAMES[line.role] : '';
    for (const tool of tools) {
      const kind = tool.dataset.format;
      if (tool.dataset.level) {
        tool.disabled = !line || (tool.dataset.level === 'up' && line.role === 'chapter')
          || (tool.dataset.level === 'down' && (line.role === 'step' || line.role === 'text'));
        continue;
      }
      tool.disabled = !lines.length;
      if (kind === 'none') continue;
      const active = lines.length > 0 && lines.every(({ el, start, end }) =>
        Edit.hasFormat(Parse.runsFromElement(el), start, end, kind));
      tool.setAttribute('aria-pressed', String(active));
    }
    hint.textContent = lines.length
      ? 'Formatting applies to the selected text'
      : 'Select text to format it, or click a line and use Up and Down';
  }

  for (const tool of tools) {
    // mousedown would drop the selection before the click arrives.
    tool.addEventListener('mousedown', (e) => e.preventDefault());
    tool.addEventListener('click', () => {
      if (tool.dataset.level) moveLine(tool.dataset.level);
      else applyFormat(tool.dataset.format);
    });
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

  // ---- Copy for Seal (step 6) ----

  const copyBtn = document.getElementById('protocol-copy');

  function flash(message, ok = true) {
    copyBtn.textContent = message;
    copyBtn.classList.toggle('btn-done', ok);
    clearTimeout(flash.timer);
    flash.timer = setTimeout(() => {
      copyBtn.textContent = 'Copy for Seal';
      copyBtn.classList.remove('btn-done');
    }, 2200);
  }

  // Older browsers, and any page served without https, have no clipboard.write.
  function copyBySelection(html) {
    const holder = document.createElement('div');
    holder.setAttribute('contenteditable', 'true');
    holder.style.cssText = 'position:fixed;left:-9999px;top:0;white-space:pre-wrap;';
    holder.innerHTML = html;
    document.body.appendChild(holder);
    const sel = window.getSelection();
    const saved = sel.rangeCount ? sel.getRangeAt(0) : null;
    const range = document.createRange();
    range.selectNodeContents(holder);
    sel.removeAllRanges();
    sel.addRange(range);
    let ok = false;
    try { ok = document.execCommand('copy'); } catch { ok = false; }
    sel.removeAllRanges();
    if (saved) sel.addRange(saved);
    holder.remove();
    return ok;
  }

  async function copyForSeal() {
    const html = Copy.sealHtml(preview.innerHTML);
    const text = Copy.plainText(html);
    try {
      await navigator.clipboard.write([new ClipboardItem({
        'text/html': new Blob([html], { type: 'text/html' }),
        'text/plain': new Blob([text], { type: 'text/plain' }),
      })]);
      flash('Copied, paste in Seal');
      return;
    } catch {
      // falls through to the selection based copy
    }
    if (copyBySelection(html)) flash('Copied, paste in Seal');
    else flash('Copy failed, select the preview and press Ctrl+C', false);
  }

  copyBtn.addEventListener('click', copyForSeal);

  preview.contentEditable = 'true';
  preview.spellcheck = false;

  render();
  updateTools();
})();
