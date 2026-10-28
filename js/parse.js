// Turns a protocol (plain text, a Word file read by mammoth, or HTML pasted from Word
// or a web page) into chapters, sections and steps for Seal.
//
// Everything goes through "blocks" first:
//   { kind: 'heading', level: 1..6, runs }    real headings (Word styles, <h1>..<h6>)
//   { kind: 'line', runs }                    a line of plain text
//   { kind: 'para', runs }                    a paragraph from HTML
//   { kind: 'item', runs }                    a list item (always a step)
//   { kind: 'table', head: [runs] | null, rows: [[runs]] }
// and a run is a piece of text with its formatting: { text, b, i }.
(function (root) {
  const Seal = root.Seal || require('./seal.js');
  const Detect = root.Detect || require('./detect.js');

  const ROMAN = /^\s*([IVX]{1,6})[.)]\s+/;
  const LETTER = /^\s*([a-zA-Z])[.)]\s+/;
  const NUMBER = /^\s*(?:step\s*)?\d{1,3}(?:\.\d{1,2})*[.):]\s+(?=\S)/i;
  const BULLET = /^\s*[-•*·▪◦–]\s+/;
  const HEADING_MAX = 80;

  const runsText = (runs) => runs.map((r) => r.text).join('');
  const oneLine = (s) => s.replace(/\s+/g, ' ').trim();
  const titleText = (runs) => oneLine(runsText(runs)).replace(/:$/, '');
  // Short, and not a sentence: "Thawing", "1. Reagents and consumables".
  const looksLikeTitle = (text) => {
    const t = oneLine(text);
    return t.length > 0 && t.length <= HEADING_MAX && !/[.;,]$/.test(t);
  };

  function isRoman(s) {
    const v = { I: 1, V: 5, X: 10 };
    let n = 0;
    for (let k = 0; k < s.length; k++) {
      const cur = v[s[k]], next = v[s[k + 1]] || 0;
      n += cur < next ? -cur : cur;
    }
    return n > 0 && Seal.roman(n) === s;
  }

  // Removes the first `length` characters from the runs (used to drop "1." or "a.").
  function dropStart(runs, length) {
    const out = [];
    let left = length;
    for (const r of runs) {
      if (left >= r.text.length) { left -= r.text.length; continue; }
      out.push({ ...r, text: r.text.slice(left) });
      left = 0;
    }
    return out;
  }

  // What the start of a line says it is. Seal renumbers everything, so the marker is dropped.
  function readMarker(runs) {
    const text = runsText(runs);
    const title = looksLikeTitle(text);
    let m = text.match(ROMAN);
    if (m && isRoman(m[1]) && title) return { type: 'roman', runs: dropStart(runs, m[0].length) };
    m = text.match(LETTER);
    // "a. Buffer preparation" is a section; "a. Add 5 mL PBS." is a sub step.
    if (m) return { type: title ? 'letter' : 'bullet', runs: dropStart(runs, m[0].length) };
    m = text.match(NUMBER);
    if (m) return { type: 'number', title, runs: dropStart(runs, m[0].length) };
    m = text.match(BULLET);
    if (m) return { type: 'bullet', runs: dropStart(runs, m[0].length) };
    return { type: null, runs };
  }

  // A short paragraph entirely in bold reads as a heading.
  function isBoldTitle(runs) {
    return looksLikeTitle(runsText(runs)) && runs.every((r) => r.b || !r.text.trim());
  }

  // Runs to Seal HTML: values in blue bold, then bold and italic kept from the source.
  function runsToHtml(runs) {
    // One space at most, even across runs ("50 " + " µL").
    let prevSpace = true;
    const clean = runs.map((r) => {
      let t = Detect.cleanDashes(r.text.replace(/\s+/g, ' '));
      if (prevSpace) t = t.replace(/^ /, '');
      if (t) prevSpace = t.endsWith(' ');
      return { ...r, text: t };
    });
    const text = clean.map((r) => r.text).join('');
    const end = text.trimEnd().length;

    // Formatting of every character, then values on top.
    const fmt = [];
    for (const r of clean) for (let k = 0; k < r.text.length; k++) fmt.push({ b: !!r.b, i: !!r.i, v: -1 });
    Detect.findValues(text).forEach((v, n) => { for (let k = v.start; k < v.end; k++) fmt[k].v = n; });

    const pieces = [];
    let k = 0;
    while (k < end) {
      const f = fmt[k];
      let j = k + 1;
      while (j < end && fmt[j].v === f.v && fmt[j].i === f.i && (f.v >= 0 || fmt[j].b === f.b)) j++;
      const piece = text.slice(k, j);
      let h = f.v >= 0 ? Seal.value(piece) : Seal.esc(piece);
      if (f.v < 0 && f.b && piece.trim()) h = `<strong>${h}</strong>`;
      pieces.push({ html: h, i: f.i && !!piece.trim() });
      k = j;
    }
    // One <em> around a whole italic remark, values inside it included.
    let html = '';
    for (let n = 0; n < pieces.length; n++) {
      if (!pieces[n].i) { html += pieces[n].html; continue; }
      let inner = '';
      while (n < pieces.length && pieces[n].i) inner += pieces[n++].html;
      html += `<em>${inner}</em>`;
      n--;
    }
    return html;
  }

  function cellToHtml(runs) {
    const text = oneLine(runsText(runs));
    return /^[<>~≈]?\s*\d+([.,]\d+)?$/.test(text) ? Seal.value(text) : runsToHtml(runs);
  }

  // Heading levels actually used, from the top: a single top heading is the document title,
  // the next level gives chapters, anything below gives sections.
  function headingPlan(blocks) {
    const headings = blocks.filter((b) => b.kind === 'heading');
    const levels = [...new Set(headings.map((h) => h.level))].sort((a, b) => a - b);
    const plan = { title: null, chapter: levels[0], section: levels[1] };
    if (levels.length > 1 && headings.filter((h) => h.level === levels[0]).length === 1) {
      plan.title = headings.find((h) => h.level === levels[0]);
      plan.chapter = levels[1];
      plan.section = levels[2];
    }
    return plan;
  }

  // Blocks to the structure Seal.document() renders.
  function blocksToDoc(blocks) {
    const plan = headingPlan(blocks);
    const hasHeadings = plan.chapter !== undefined;
    // In plain text, numbered lines that read like titles are chapter headings
    // when the steps under them are not numbered ("1. Reagents" then plain lines).
    const lines = blocks.filter((b) => b.kind === 'line' && runsText(b.runs).trim());
    const numbered = lines.map((b) => readMarker(b.runs)).filter((m) => m.type === 'number');
    const numberedTitles = numbered.length > 0 && numbered.every((m) => m.title) && numbered.length < lines.length / 2;
    const textHasHeadings = numberedTitles || lines.some((b) => /^(roman|letter)$/.test(readMarker(b.runs).type));
    // When a list or indentation has sub levels, the top level holds the section titles.
    const deepest = blocks.reduce((max, b) => Math.max(max, b.depth || 0), 0);

    const chapters = [];
    let chapter = null;
    let section = null;
    let afterTable = false;

    const ensureChapter = () => {
      if (!chapter) { chapter = { title: null, blocks: [], sections: [] }; chapters.push(chapter); }
      return chapter;
    };
    const target = () => (section || ensureChapter()).blocks;
    const addStep = (runs) => {
      const html = runsToHtml(runs);
      if (!html) return;
      const list = target();
      const last = list[list.length - 1];
      if (last && last.type === 'steps') last.items.push(html);
      else list.push({ type: 'steps', items: [html] });
    };
    const addPara = (runs, bold) => {
      const html = runsToHtml(bold ? runs.map((r) => ({ ...r, b: true })) : runs);
      if (html) target().push({ type: 'para', html });
    };
    const newChapter = (runs) => {
      chapter = { title: titleText(runs), blocks: [], sections: [] };
      chapters.push(chapter);
      section = null;
    };
    const newSection = (runs) => {
      section = { title: titleText(runs), blocks: [] };
      ensureChapter().sections.push(section);
    };
    const started = () => chapters.some((c) => c.title || c.sections.length);

    for (const block of blocks) {
      if (block.kind === 'table') {
        if (!block.rows.length && !block.head) continue;
        target().push({
          type: 'table',
          head: block.head ? block.head.map((c) => Seal.bold(titleText(c))) : null,
          rows: block.rows.map((row) => row.map(cellToHtml)),
        });
        afterTable = true;
        continue;
      }
      if (!runsText(block.runs).trim()) continue;
      const wasAfterTable = afterTable;
      afterTable = false;

      if (block.kind === 'heading') {
        const m = readMarker(block.runs);
        const runs = m.type && m.type !== 'bullet' ? m.runs : block.runs;
        if (block === plan.title) addPara(runs, true);
        else if (block.level === plan.chapter) newChapter(runs);
        else newSection(runs);
        continue;
      }

      const m = readMarker(block.runs);
      const depth = block.depth || 0;
      if (m.type === 'roman') newChapter(m.runs);
      else if (m.type === 'letter') newSection(m.runs);
      else if (m.type === 'number' && block.kind === 'line' && numberedTitles) newChapter(m.runs);
      else if (deepest > 0 && depth === 0 && block.kind !== 'line' && looksLikeTitle(runsText(m.runs))) newSection(m.runs);
      else if (depth > 0 || block.kind === 'item' || m.type === 'number' || m.type === 'bullet') addStep(m.runs);
      else if (block.kind === 'para' && !hasHeadings && isBoldTitle(block.runs)) newSection(block.runs);
      // Plain lines are steps, except an introduction before the first heading
      // and a note right after a table.
      else if (block.kind === 'line' && (started() || !textHasHeadings) && !wasAfterTable) addStep(block.runs);
      else addPara(block.runs);
    }
    return chapters;
  }

  // Plain text: one block per line, and runs of tab separated lines become a table.
  function textToBlocks(text) {
    const blocks = [];
    let table = null;
    for (const line of String(text).split(/\r?\n/)) {
      if (line.includes('\t')) {
        const cells = line.split('\t').map((c) => [{ text: c }]);
        if (!table) { table = { kind: 'table', head: null, rows: [] }; blocks.push(table); }
        table.rows.push(cells);
        continue;
      }
      if (table) { guessHead(table); table = null; }
      blocks.push({ kind: 'line', runs: [{ text: line }] });
    }
    if (table) guessHead(table);
    return blocks;
  }

  // A first row of short labels without numbers ("Observation | Suggested action") is a header.
  function guessHead(table) {
    const first = table.rows[0];
    if (table.rows.length > 1 && first.every((c) => { const t = runsText(c).trim(); return t && t.length <= 30 && !/\d/.test(t); })) {
      table.head = table.rows.shift();
    }
  }

  // ---- Browser only: HTML (from mammoth, a Word paste or a web page) to blocks ----

  const SUP = { 0: '⁰', 1: '¹', 2: '²', 3: '³', 4: '⁴', 5: '⁵', 6: '⁶', 7: '⁷', 8: '⁸', 9: '⁹', '+': '⁺', '-': '⁻', '−': '⁻' };
  const SUB = { 0: '₀', 1: '₁', 2: '₂', 3: '₃', 4: '₄', 5: '₅', 6: '₆', 7: '₇', 8: '₈', 9: '₉', '+': '₊', '-': '₋', '−': '₋' };
  // 10<sup>4</sup> -> 10⁴ and CO<sub>2</sub> -> CO₂, so the text survives any paste.
  function scriptText(text, map, fallback) {
    const chars = [...text.trim()];
    return chars.every((c) => map[c]) ? chars.map((c) => map[c]).join('') : fallback + text;
  }

  // Word and Google Docs indent sub steps with margin-left instead of nesting them.
  function indentOf(el) {
    const margin = el.style && (el.style.marginLeft || el.style.paddingLeft);
    if (!margin) return 0;
    const value = parseFloat(margin);
    if (!value) return 0;
    const px = /pt$/.test(margin) ? value * 4 / 3 : /e[mn]$/.test(margin) ? value * 16 : value;
    return Math.min(3, Math.floor(px / 24));
  }

  function isBoldEl(el) {
    if (/^(B|STRONG|TH)$/.test(el.tagName)) return true;
    const w = el.style && el.style.fontWeight;
    return w === 'bold' || w === 'bolder' || Number(w) >= 600;
  }
  function isItalicEl(el) {
    return /^(I|EM)$/.test(el.tagName) || (el.style && el.style.fontStyle === 'italic');
  }

  function inlineRuns(node, b = false, i = false, out = []) {
    for (const child of node.childNodes) {
      if (child.nodeType === 3) out.push({ text: child.nodeValue, b, i });
      else if (child.nodeType === 1) {
        const tag = child.tagName;
        if (/^(UL|OL|TABLE|STYLE|SCRIPT)$/.test(tag)) continue;
        if (tag === 'BR') out.push({ text: ' ', b, i });
        else if (tag === 'SUP') out.push({ text: scriptText(child.textContent, SUP, '^'), b, i });
        else if (tag === 'SUB') out.push({ text: scriptText(child.textContent, SUB, '_'), b, i });
        else inlineRuns(child, b || isBoldEl(child), i || isItalicEl(child), out);
      }
    }
    return out;
  }

  function domToBlocks(rootEl) {
    // Word pastes its own list numbers in hidden spans; the list itself says it is a list.
    rootEl.querySelectorAll('[style*="mso-list:Ignore"], [style*="mso-list: Ignore"]').forEach((s) => s.remove());
    const blocks = [];

    // A nested list is sometimes inside its <li> and sometimes a sibling of it
    // (Word and Google Docs both do the second), so both shapes count as one level deeper.
    const walkList = (list, depth) => {
      for (const el of list.children) {
        if (el.tagName === 'UL' || el.tagName === 'OL') { walkList(el, depth + 1); continue; }
        if (el.tagName !== 'LI') continue;
        blocks.push({ kind: 'item', depth, runs: inlineRuns(el) });
        for (const sub of el.children) if (sub.tagName === 'UL' || sub.tagName === 'OL') walkList(sub, depth + 1);
      }
    };

    const walk = (node, depth = 0) => {
      for (const el of node.children) {
        const tag = el.tagName;
        const h = tag.match(/^H([1-6])$/);
        // Word's "Title" style arrives as <h1 class="doc-title">: always the document title.
        if (h) blocks.push({ kind: 'heading', level: el.classList.contains('doc-title') ? 0 : Number(h[1]), runs: inlineRuns(el) });
        else if (tag === 'P') {
          const listPara = /MsoListParagraph/.test(el.className);
          blocks.push({ kind: listPara ? 'item' : 'para', depth: depth + indentOf(el), runs: inlineRuns(el) });
        } else if (tag === 'UL' || tag === 'OL') {
          walkList(el, depth);
        } else if (tag === 'TABLE') {
          const rows = Array.from(el.querySelectorAll('tr')).map((tr) => Array.from(tr.children));
          // A header row is made of <th>, or is bold all the way across.
          const headRow = rows.length > 1 && rows[0].every((c) => c.tagName === 'TH' || inlineRuns(c).every((r) => r.b || !r.text.trim()));
          const toRuns = (row) => row.map((c) => inlineRuns(c, c.tagName === 'TH' || isBoldEl(c)));
          blocks.push({
            kind: 'table',
            head: headRow ? toRuns(rows[0]) : null,
            rows: (headRow ? rows.slice(1) : rows).map(toRuns),
          });
        } else if (/^(DIV|SECTION|ARTICLE|MAIN|BODY|BLOCKQUOTE|LI|CENTER|FONT|SPAN)$/.test(tag) && el.children.length) walk(el, depth + indentOf(el));
        else if (!/^(STYLE|SCRIPT|META|LINK|TITLE|HEAD)$/.test(tag) && el.textContent.trim()) {
          blocks.push({ kind: 'para', runs: inlineRuns(el) });
        }
      }
    };
    walk(rootEl);
    return blocks;
  }

  function htmlToBlocks(html) {
    const doc = new DOMParser().parseFromString(html, 'text/html');
    return domToBlocks(doc.body);
  }

  // Text typed or pasted as plain text can itself be HTML source code.
  function looksLikeHtml(text) {
    return /^\s*</.test(text) && /<\/(p|div|h[1-6]|li|td|table|span)>/i.test(text);
  }

  const Parse = { textToBlocks, htmlToBlocks, blocksToDoc, runsToHtml, readMarker, looksLikeHtml };

  if (typeof module !== 'undefined' && module.exports) module.exports = Parse;
  else root.Parse = Parse;
})(this);
