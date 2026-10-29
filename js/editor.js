// The right hand side of a module: the Seal preview, the formatting toolbar and
// the copy button. The Protocol and Experiment tabs each create one.
(function (root) {
  const ROLE_NAMES = { chapter: 'Chapter', section: 'Section', step: 'Step', text: 'Paragraph' };
  const LINES = 'li, p, h2, h3, td, th';

  function createEditor({ preview, label, toolbar, copyBtn, emptyLabel = 'Example output', onCopy }) {
    const tools = Array.from(toolbar.querySelectorAll('.tool'));
    const hint = toolbar.querySelector('.toolbar-hint');
    const roleLabel = toolbar.querySelector('.tool-role');

    // ---- showing a document ----

    function plural(n, word) { return `${n} ${word}${n === 1 ? '' : 's'}`; }

    // The 184 dash separator is wider than the card: drawn as a clipped line on screen.
    function paint(html) {
      preview.innerHTML = html;
      for (const p of preview.querySelectorAll('p')) if (/^-{184}$/.test(p.textContent)) p.className = 'sep';
      updateTools();
    }

    function showDocument(doc) {
      const html = Seal.document(doc);
      const chapters = doc.filter((c) => c.title).length;
      const steps = (html.match(/<li>/g) || []).length;
      const values = (html.match(/data-native-color="blue"/g) || []).length;
      label.textContent = [chapters && plural(chapters, 'chapter'), plural(steps, 'step'), plural(values, 'value')]
        .filter(Boolean).join(', ');
      paint(html);
    }

    function showEmpty(html) {
      label.textContent = emptyLabel;
      paint(html);
    }

    // A document that is already Seal HTML, counted the same way.
    function showHtml(html) {
      const steps = (html.match(/<li>/g) || []).length;
      const chapters = (html.match(/<h2>/g) || []).length;
      const values = (html.match(/data-native-color="blue"/g) || []).length;
      label.textContent = [chapters && plural(chapters, 'chapter'), plural(steps, 'step'), plural(values, 'value')]
        .filter(Boolean).join(', ');
      paint(html);
    }

    function currentHtml() {
      return Copy.sealHtml(preview.innerHTML);
    }

    // ---- formatting the selection ----

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
      const point = (el, offset) => {
        const walker = document.createTreeWalker(el, NodeFilter.SHOW_TEXT);
        let pos = 0;
        for (let node = walker.nextNode(); node; node = walker.nextNode()) {
          if (pos + node.nodeValue.length >= offset) return [node, offset - pos];
          pos += node.nodeValue.length;
        }
        return [el, el.childNodes.length];
      };
      const range = document.createRange();
      range.setStart(...point(first.el, first.start));
      range.setEnd(...point(last.el, last.end));
      const sel = window.getSelection();
      sel.removeAllRanges();
      sel.addRange(range);
      updateTools();
    }

    // ---- chapter, section or step ----

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

    function textOf(html) {
      const holder = document.createElement('div');
      holder.innerHTML = html;
      return holder.textContent.replace(/\s+/g, ' ').trim();
    }

    // The I. and a. the preview shows come from the renderer, not from the title.
    function stripMarker(html) {
      return textOf(html).replace(/^(?:[IVXLC]+|[a-z]{1,2})[.)]\s+/, '');
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
        if (el.tagName === 'P' && el.children.length === 1 && el.firstElementChild.tagName === 'IMG') {
          blocks.push({ kind: 'image', el, html: el.innerHTML });
          continue;
        }
        if (el.tagName === 'OL') {
          for (const li of el.children) blocks.push({ kind: 'step', el: li, html: li.innerHTML });
          continue;
        }
        const kind = el.tagName === 'H2' ? 'chapter' : el.tagName === 'H3' ? 'section' : 'text';
        // A title shown as "I. Day 0" is stored as "Day 0": Seal numbers it again.
        blocks.push({ kind, el, html: kind === 'text' ? el.innerHTML : stripMarker(el.innerHTML) });
      }
      if (!changer(blocks)) return;

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
          chapter = { title: textOf(block.html), blocks: [], sections: [] };
          chapters.push(chapter);
          section = null;
        } else if (block.kind === 'section') {
          section = { title: textOf(block.html), blocks: [] };
          ensure().sections.push(section);
        } else if (block.kind === 'step') {
          const list = target();
          const last = list[list.length - 1];
          if (last && last.type === 'steps') last.items.push(block.html);
          else list.push({ type: 'steps', items: [block.html] });
        } else if (block.kind === 'table') {
          target().push({ type: 'table', head: block.head, rows: block.rows });
        } else if (block.kind === 'image') {
          target().push({ type: 'para', html: block.html });
        } else {
          target().push({ type: 'para', html: block.html });
        }
      }
      paint(Seal.document(chapters));
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

    function updateTools() {
      const lines = selectedLines();
      const line = lineAt();
      roleLabel.textContent = line ? ROLE_NAMES[line.role] : '';
      for (const tool of tools) {
        if (tool.dataset.level) {
          tool.disabled = !line || (tool.dataset.level === 'up' && line.role === 'chapter')
            || (tool.dataset.level === 'down' && (line.role === 'step' || line.role === 'text'));
          continue;
        }
        tool.disabled = !lines.length;
        const kind = tool.dataset.format;
        if (kind === 'none') continue;
        const active = lines.length > 0 && lines.every(({ el, start, end }) =>
          Edit.hasFormat(Parse.runsFromElement(el), start, end, kind));
        tool.setAttribute('aria-pressed', String(active));
      }
      hint.textContent = lines.length
        ? 'Formatting applies to the selected text'
        : 'Select text to format it, or click a line and use Up and Down';
    }

    // ---- copying ----

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
        if (onCopy) onCopy();
        return;
      } catch {
        // falls through to the selection based copy
      }
      if (copyBySelection(html)) {
        flash('Copied, paste in Seal');
        if (onCopy) onCopy();
      } else {
        flash('Copy failed, select the preview and press Ctrl+C', false);
      }
    }

    // ---- wiring ----

    for (const tool of tools) {
      // mousedown would drop the selection before the click arrives.
      tool.addEventListener('mousedown', (e) => e.preventDefault());
      tool.addEventListener('click', () => {
        if (tool.dataset.level) moveLine(tool.dataset.level);
        else applyFormat(tool.dataset.format);
      });
    }

    preview.addEventListener('keydown', (e) => {
      if (!(e.ctrlKey || e.metaKey)) return;
      const key = e.key.toLowerCase();
      const kind = key === 'b' ? 'b' : key === 'i' ? 'i' : (key === 'v' && e.shiftKey) ? 'v' : null;
      if (!kind) return;
      e.preventDefault();
      applyFormat(kind);
    });

    copyBtn.addEventListener('click', copyForSeal);
    document.addEventListener('selectionchange', () => {
      if (preview.closest('.panel').hidden) return;
      updateTools();
    });

    preview.contentEditable = 'true';
    preview.spellcheck = false;

    return { showDocument, showEmpty, showHtml, paint, updateTools, html: currentHtml };
  }

  root.createEditor = createEditor;
})(this);
