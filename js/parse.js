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

  // "3. KLH preparation, n = 4" and "5.1 Biotin-LPETG" are headings, while
  // "0.4 mg/mL in PBS: 20 µL of the stock" is a step that happens to start with a number.
  const NUMBER_HEADING = /^\s*(\d{1,3})(?:\.(\d{1,2}))?[.)]?\s+(?=\S)/;

  function readNumberHeading(runs) {
    const text = oneLine(runsText(runs));
    const m = text.match(NUMBER_HEADING);
    if (!m) return null;
    const rest = text.slice(m[0].length);
    if (!looksLikeTitle(rest) || !/^[\p{L}]/u.test(rest)) return null;
    return { major: Number(m[1]), minor: m[2] ? Number(m[2]) : null, runs: dropStart(runs, m[0].length) };
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
    clean.forEach((r, n) => {
      for (let k = 0; k < r.text.length; k++) fmt.push({ b: !!r.b, i: !!r.i, v: r.v ? `kept${n}` : -1 });
    });
    Detect.findValues(text).forEach((v, n) => {
      for (let k = v.start; k < v.end; k++) if (fmt[k].v === -1) fmt[k].v = n;
    });

    const pieces = [];
    let k = 0;
    while (k < end) {
      const f = fmt[k];
      let j = k + 1;
      while (j < end && fmt[j].v === f.v && fmt[j].i === f.i && (f.v !== -1 || fmt[j].b === f.b)) j++;
      const piece = text.slice(k, j);
      let h = f.v !== -1 ? Seal.value(piece) : Seal.esc(piece);
      if (f.v === -1 && f.b && piece.trim()) h = `<strong>${h}</strong>`;
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

  // A bare number in a cell is as often a catalogue number as a value,
  // so only numbers with a unit turn blue, like everywhere else.
  function cellToHtml(runs) {
    return runsToHtml(runs);
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
  function blocksToDoc(blocks, { dropHeader = false } = {}) {
    const plan = headingPlan(blocks);
    const hasHeadings = plan.chapter !== undefined;
    // In plain text, numbered lines that read like titles are chapter headings
    // when the steps under them are not numbered ("1. Reagents" then plain lines).
    const lines = blocks.filter((b) => b.kind === 'line' && runsText(b.runs).trim());
    const numbered = lines.map((b) => readMarker(b.runs)).filter((m) => m.type === 'number');
    const numberedTitles = numbered.length > 0 && numbered.every((m) => m.title) && numbered.length < lines.length / 2;
    const textHasHeadings = numberedTitles || lines.some((b) => /^(roman|letter)$/.test(readMarker(b.runs).type));

    // Numbered headings only count when they run 1, 2, 3 through the document:
    // that is what tells them apart from the steps, which restart in every part.
    const numberHeadings = new Map();
    const majors = [];
    for (const block of blocks) {
      if (block.kind === 'table' || !block.runs) continue;
      const heading = readNumberHeading(block.runs);
      if (!heading) continue;
      numberHeadings.set(block, heading);
      if (heading.minor === null) majors.push({ block, number: heading.major });
    }
    const sequence = [];
    for (const entry of majors) {
      const last = sequence[sequence.length - 1];
      if (entry.number === (last ? last.number + 1 : 1)) sequence.push(entry);
    }
    const chapterBlocks = new Set(sequence.length >= 2 ? sequence.map((entry) => entry.block) : []);
    // A line is a title when the line just after it sits one level deeper.
    const opensSubLevel = blocks.map((b, n) => {
      const next = blocks.slice(n + 1).find((other) => other.kind !== 'table');
      return next ? (next.depth || 0) > (b.depth || 0) : false;
    });

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

    blocks.forEach((block, index) => {
      if (block.kind === 'image') {
        target().push({ type: 'image', src: block.src, alt: block.alt });
        return;
      }
      if (block.kind === 'table') {
        if (!block.rows.length && !block.head) return;
        // A bench sheet table (# | STEP | DONE) is a list of steps, not a table.
        const stepColumn = stepColumnOf(block);
        if (stepColumn >= 0) {
          block.rows.forEach((row) => addStep(row[stepColumn] || []));
          afterTable = true;
          return;
        }
        target().push({
          type: 'table',
          head: block.head ? block.head.map((c) => Seal.bold(titleText(c))) : null,
          rows: block.rows.map((row) => row.map(cellToHtml)),
        });
        afterTable = true;
        return;
      }
      if (!runsText(block.runs).trim()) return;
      const wasAfterTable = afterTable;
      afterTable = false;

      if (block.kind === 'heading') {
        const m = readMarker(block.runs);
        const runs = m.type && m.type !== 'bullet' ? m.runs : block.runs;
        if (block === plan.title) addPara(runs, true);
        else if (block.level === plan.chapter) newChapter(runs);
        else newSection(runs);
        return;
      }

      const m = readMarker(block.runs);
      const depth = block.depth || 0;
      const heading = numberHeadings.get(block);
      if (m.type === 'roman') newChapter(m.runs);
      else if (m.type === 'letter') newSection(m.runs);
      // A heading that belongs to the 1, 2, 3 run of the document.
      else if (chapterBlocks.has(block)) newChapter(heading.runs);
      // "5.1 Biotin-LPETG" sits under the chapter numbered 5.
      else if (heading && heading.minor !== null && chapterBlocks.size) newSection(heading.runs);
      else if (m.type === 'number' && block.kind === 'line' && numberedTitles) newChapter(m.runs);
      // A list item that opens a sub level is the title of what follows.
      else if (opensSubLevel[index] && block.kind === 'item' && looksLikeTitle(runsText(m.runs))) newSection(m.runs);
      // A short paragraph entirely in bold is a title, numbered or not.
      else if (block.kind === 'para' && isBoldTitle(m.runs)) newSection(m.runs);
      else if (depth > 0 || block.kind === 'item' || m.type === 'number' || m.type === 'bullet') addStep(m.runs);
      // Plain text carries no formatting, so a title is read from the wording.
      else if (block.kind === 'line' && (started() || !textHasHeadings) && looksLikePlainTitle(m.runs)) newSection(m.runs);
      else if (block.kind === 'line' && (started() || !textHasHeadings) && !wasAfterTable) addStep(block.runs);
      else addPara(block.runs);
    });
    // On an exported page, what comes before the first title is the document name,
    // its reference and its version, which Seal holds itself.
    if (dropHeader && chapters.length > 1 && !chapters[0].title) chapters.shift();
    return chapters;
  }

  // The index of a STEP column in a bench sheet, or -1 when the table is a real table.
  const TICK_COLUMN = /^(?:#|n°|no\.?|step ?#|done|ok|check(?:ed)?|✓|☐)$/i;
  function stepColumnOf(table) {
    if (!table.head) return -1;
    const names = table.head.map((cell) => oneLine(runsText(cell)));
    const step = names.findIndex((name) => /^steps?$/i.test(name));
    if (step < 0) return -1;
    return names.every((name, k) => k === step || TICK_COLUMN.test(name)) ? step : -1;
  }

  // Words a step starts with. A line that opens with one of them is an instruction,
  // however short it is ("Place mouse down").
  const ACTIONS = new RegExp('^(?:do not|if |when |once |avoid |add|allow|anaesthetize|anesthetize|aspirate|book|bring|centrifuge|change|check|collect|count|cover|discard|dilute|dispose|dissolve|draw|ensure|fill|filter|fix|harvest|heat|hold|immunis|immuniz|incubate|inject|insert|keep|label|leave|let|make|measure|mix|monitor|move|open|place|plate|pool|prepare|press|put|record|remove|repeat|replace|resuspend|return|rinse|run|seed|set|shake|spin|spray|stain|start|stop|store|take|tap|test|thaw|transfer|turn|update|use|validate|vortex|wait|warm|wash|weigh|weight|wrap|write)\\b', 'i');

  // In plain text a title is short, has no final punctuation, no value, and is not an order.
  function looksLikePlainTitle(runs) {
    const text = oneLine(runsText(runs));
    if (!looksLikeTitle(text) || text.length > 60) return false;
    if (ACTIONS.test(text)) return false;
    if (Detect.findValues(text).length) return false;
    return text === text.toUpperCase() || text.split(/\s+/).length <= 5;
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
    // Word and SharePoint write 4<sup>o</sup>C for 4 °C.
    if (map === SUP && /^[oO0]$/.test(text.trim())) return '°';
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

  // Text already in Seal blue stays a value, whoever wrote it.
  function isValueEl(el) {
    return el.getAttribute && el.getAttribute('data-native-color') === 'blue';
  }

  function inlineRuns(node, b = false, i = false, out = [], v = false) {
    for (const child of node.childNodes) {
      if (child.nodeType === 3) out.push({ text: child.nodeValue, b, i, v });
      else if (child.nodeType === 1) {
        const tag = child.tagName;
        if (/^(UL|OL|TABLE|STYLE|SCRIPT)$/.test(tag)) continue;
        if (tag === 'BR') out.push({ text: ' ', b, i, v });
        else if (tag === 'SUP') out.push({ text: scriptText(child.textContent, SUP, '^'), b, i, v });
        else if (tag === 'SUB') out.push({ text: scriptText(child.textContent, SUB, '_'), b, i, v });
        else inlineRuns(child, b || isBoldEl(child), i || isItalicEl(child), out, v || isValueEl(child));
      }
    }
    return out;
  }

  // Reads one line of the preview back into runs, so a button can change it.
  function runsFromElement(el) {
    return inlineRuns(el).filter((r) => r.text);
  }

  // Only an image that travels with the document (data:) or one Seal can fetch (http).
  function isUsableImage(src) {
    return /^(?:data:image\/|https?:)/i.test(src || '');
  }

  function domToBlocks(rootEl) {
    // Word pastes its own list numbers in hidden spans; the list itself says it is a list.
    rootEl.querySelectorAll('[style*="mso-list:Ignore"], [style*="mso-list: Ignore"]').forEach((s) => s.remove());
    const blocks = [];
    const pushImage = (img) => {
      const src = img.getAttribute('src') || '';
      if (isUsableImage(src)) blocks.push({ kind: 'image', src, alt: img.getAttribute('alt') || '' });
    };

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
          const runs = inlineRuns(el);
          if (runsText(runs).trim()) blocks.push({ kind: listPara ? 'item' : 'para', depth: depth + indentOf(el), runs });
          // A picture sitting inside a paragraph is a block of its own.
          for (const img of el.querySelectorAll('img')) pushImage(img);
        } else if (tag === 'UL' || tag === 'OL') {
          walkList(el, depth);
        } else if (tag === 'IMG') {
          pushImage(el);
        } else if (tag === 'TABLE') {
          const rows = Array.from(el.querySelectorAll('tr')).map((tr) => Array.from(tr.children));
          // A header row is made of <th>, or is bold all the way across.
          const headRow = rows.length > 1 && rows[0].every((c) => c.tagName === 'TH' || inlineRuns(c).every((r) => r.b || !r.text.trim()));
          const toRuns = (row) => row.map((c) => inlineRuns(c, c.tagName === 'TH' || isBoldEl(c)));
          const table = {
            kind: 'table',
            head: headRow ? toRuns(rows[0]) : null,
            rows: (headRow ? rows.slice(1) : rows).map(toRuns),
          };
          // A table of empty cells is page furniture, not content.
          table.rows = table.rows.filter((row) => row.some((cell) => runsText(cell).trim()));
          if (table.rows.length) blocks.push(table);
        } else if (/^(DIV|SECTION|ARTICLE|MAIN|BODY|BLOCKQUOTE|LI|CENTER|FONT|SPAN)$/.test(tag) && el.children.length) {
          // Walk into a container of blocks; a container of words is a paragraph,
          // otherwise the text around its links would be dropped.
          if (el.querySelector(':scope > p, :scope > div, :scope > ul, :scope > ol, :scope > table, :scope > h1, :scope > h2, :scope > h3, :scope > h4, :scope > h5, :scope > h6')) {
            walk(el, depth + indentOf(el));
          } else {
            const runs = inlineRuns(el);
            if (runsText(runs).trim()) blocks.push({ kind: 'para', depth: depth + indentOf(el), runs });
            for (const img of el.querySelectorAll('img')) pushImage(img);
          }
        }
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

  const Parse = { textToBlocks, htmlToBlocks, blocksToDoc, runsToHtml, runsFromElement, readMarker, looksLikeHtml };

  if (typeof module !== 'undefined' && module.exports) module.exports = Parse;
  else root.Parse = Parse;
})(this);
