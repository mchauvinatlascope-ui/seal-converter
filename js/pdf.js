// A PDF is a sheet of positioned words, not a document: this rebuilds lines,
// paragraphs, headings and simple tables from where the text sits on the page.
//
// Input: pages = [{ width, height, items: [{ text, x, y, w, size, bold, italic }] }]
// with PDF coordinates (origin bottom left, y grows upwards), as read by pdf.js.
// Output: HTML that the rest of the app reads like a saved web page.
(function (root) {
  const NUMBER = /^\s*(?:step\s*)?\d{1,3}(?:\.\d{1,2})*[.):]\s+(?=\S)/i;
  const LETTER = /^\s*[a-zA-Z][.)]\s+/;
  const ROMAN = /^\s*[IVX]{1,6}[.)]\s+/;
  const BULLET = /^\s*[-•*·▪◦–]\s+/;
  // Word prints its bullets with Symbol glyphs that land in the private use area.
  const GLYPH_BULLET = /^[-●○◦▪■□➢►]\s*/;
  const PAGE_NUMBER = /^(?:page\s*)?\d{1,4}(?:\s*(?:of|\/|-)\s*\d{1,4})?$/i;

  const esc = (s) => String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
  const round = (n, step = 0.5) => Math.round(n / step) * step;
  const hasMarker = (text) => NUMBER.test(text) || LETTER.test(text) || ROMAN.test(text) || BULLET.test(text);

  // Words of one page grouped into lines, with the text of each line in runs
  // and the start of each column where a wide gap splits the line.
  function linesOf(page, pageIndex) {
    const items = page.items.filter((it) => it.text && it.text.trim() && it.size > 0)
      .map((it) => ({ ...it, right: it.x + (it.w || 0) }))
      .sort((a, b) => (b.y - a.y) || (a.x - b.x));
    const lines = [];
    for (const it of items) {
      const line = lines[lines.length - 1];
      if (line && Math.abs(line.y - it.y) < 0.45 * Math.max(line.size, it.size)) line.items.push(it);
      else lines.push({ page: pageIndex, y: it.y, size: it.size, items: [it] });
    }
    for (const line of lines) {
      line.items.sort((a, b) => a.x - b.x);
      line.size = round(Math.max(...line.items.map((it) => it.size)));
      line.x = line.items[0].x;
      line.right = Math.max(...line.items.map((it) => it.right));
      line.cols = [[]];
      let prev = null;
      for (const it of line.items) {
        let text = it.text;
        if (prev) {
          const gap = it.x - prev.right;
          if (gap > 1.2 * line.size) line.cols.push([]);
          else if (gap > 0.18 * line.size && !/\s$/.test(prev.text) && !/^\s/.test(text)) text = ' ' + text;
        }
        line.cols[line.cols.length - 1].push({ text, b: !!it.bold, i: !!it.italic, x: it.x });
        prev = it;
      }
      line.cols = line.cols.filter((c) => c.length);
      line.runs = line.cols.flatMap((c, n) => (n ? [{ text: ' ', b: false, i: false }, ...c] : c));
      line.text = line.runs.map((r) => r.text).join('').replace(/\s+/g, ' ').trim();
    }
    return lines.filter((l) => l.text);
  }

  // Page numbers, and anything printed at the same place on most pages (a header or footer).
  function dropFurniture(lines, pageCount) {
    const key = (l) => `${l.text.toLowerCase().replace(/\d+/g, '#')}@${Math.round(l.y / 5)}`;
    const seen = new Map();
    for (const l of lines) seen.set(key(l), (seen.get(key(l)) || new Set()).add(l.page));
    return lines.filter((l) => {
      if (PAGE_NUMBER.test(l.text)) return false;
      const pages = seen.get(key(l)).size;
      return !(pageCount >= 2 && pages >= 2 && pages >= pageCount / 2);
    });
  }

  // The size most of the text is written in, counted in characters.
  function bodySize(lines) {
    const weight = new Map();
    for (const l of lines) weight.set(l.size, (weight.get(l.size) || 0) + l.text.length);
    // Headings are short, so the most written size wins; on a near tie the smaller one is the body.
    const best = Math.max(...weight.values());
    return Math.min(...Array.from(weight).filter(([, w]) => w >= best / 2).map(([s]) => s));
  }

  // Bigger text is a heading; the biggest size, used once, is the document title.
  function headingLevels(lines, body) {
    const count = new Map();
    for (const l of lines) if (l.size >= body * 1.12 && l.text.length <= 120) count.set(l.size, (count.get(l.size) || 0) + 1);
    const sizes = Array.from(count.keys()).sort((a, b) => b - a);
    const levels = new Map();
    let level = sizes.length && count.get(sizes[0]) === 1 ? 1 : 2;
    for (const s of sizes) levels.set(s, Math.min(level++, 4));
    return levels;
  }

  function runsToHtml(runs) {
    let html = '';
    for (const r of runs) {
      if (!r.text) continue;
      let t = esc(r.text);
      if (r.b) t = `<strong>${t}</strong>`;
      if (r.i) t = `<em>${t}</em>`;
      html += t;
    }
    return html;
  }

  function cleanRuns(runs) {
    const out = runs.map((r) => ({ ...r }));
    // A bullet glyph becomes a bullet the parser knows, and its font tells nothing.
    const first = out.find((r) => r.text.trim());
    if (first && GLYPH_BULLET.test(first.text)) {
      first.text = first.text.replace(GLYPH_BULLET, '• ');
      first.b = false;
      first.i = false;
      const next = out[out.indexOf(first) + 1];
      if (next) next.text = next.text.replace(/^\s+/, '');
    }
    return out;
  }

  // Two lines belong to one paragraph when the first one runs to the right
  // edge and the second one does not start a new step.
  function continues(prev, next, rightEdge) {
    if (!prev || prev.level || next.level || prev.table || next.table) return false;
    if (Math.abs(prev.size - next.size) > 0.5) return false;
    if (prev.right < rightEdge - 2.5 * prev.size) return false;
    if (hasMarker(next.text) || GLYPH_BULLET.test(next.text)) return false;
    if (next.x > prev.x + 3 * prev.size || next.x < prev.x - 1.5 * prev.size) return false;
    if (/[.:;!?]$/.test(prev.text) && /^[A-Z0-9]/.test(next.text)) return false;
    return true;
  }

  // Rows of a table: following lines split into the same columns.
  function sameColumns(a, b, size) {
    if (a.cols.length < 2 || b.cols.length < 2) return false;
    const starts = (l) => l.cols.map((c) => c[0].x);
    const sa = starts(a), sb = starts(b);
    const matched = sb.filter((x) => sa.some((y) => Math.abs(x - y) < 1.2 * size)).length;
    return matched >= Math.min(sa.length, sb.length) - (sa.length > 2 ? 1 : 0) && matched >= 2;
  }

  // The columns of a table are where its cells start, over all its rows:
  // a long cell that nearly touches the next one still lands in its own column.
  function tableCells(lines, size) {
    const starts = lines.flatMap((l) => l.cols.map((c) => c[0].x)).sort((a, b) => a - b);
    const columns = [];
    for (const x of starts) {
      if (!columns.length || x - columns[columns.length - 1] > 1.2 * size) columns.push(x);
    }
    return lines.map((l) => {
      const cells = columns.map(() => []);
      for (const col of l.cols) {
        let k = 0;
        for (let n = 0; n < columns.length; n++) if (columns[n] <= col[0].x + 0.6 * size) k = n;
        if (cells[k].length) cells[k].push({ text: ' ', b: false, i: false });
        cells[k].push(...col);
      }
      return cells;
    });
  }

  function toHtml(pages) {
    let lines = pages.flatMap((p, n) => linesOf(p, n));
    lines = dropFurniture(lines, pages.length);
    if (!lines.length) return '';
    const body = bodySize(lines);
    const levels = headingLevels(lines, body);
    for (const l of lines) l.level = levels.get(l.size) || 0;

    const bodyLines = lines.filter((l) => !l.level);
    const rights = bodyLines.map((l) => l.right).sort((a, b) => a - b);
    const rightEdge = rights.length ? rights[Math.floor(rights.length * 0.9)] : 0;
    const lefts = bodyLines.map((l) => l.x).sort((a, b) => a - b);
    const margin = lefts.length ? lefts[Math.floor(lefts.length * 0.1)] : 0;

    // Tables first: a run of at least two lines sharing their columns.
    for (let i = 0; i < lines.length; i++) {
      const l = lines[i];
      if (l.level || l.cols.length < 2) continue;
      let j = i;
      while (j + 1 < lines.length && !lines[j + 1].level && sameColumns(l, lines[j + 1], body)) j++;
      if (j > i) for (let k = i; k <= j; k++) lines[k].table = true;
      i = j;
    }

    const out = [];
    let para = null;
    let table = null;
    const flush = () => {
      if (para) {
        const indent = Math.max(0, Math.round((para.x - margin) * 4 / 3));
        const style = indent >= 12 ? ` style="margin-left: ${indent}px"` : '';
        out.push(`<p${style}>${runsToHtml(cleanRuns(para.runs))}</p>`);
        para = null;
      }
      if (table) {
        const rows = tableCells(table, body);
        out.push(`<table>${rows.map((row) => `<tr>${row.map((c) => `<td>${runsToHtml(cleanRuns(c))}</td>`).join('')}</tr>`).join('')}</table>`);
        table = null;
      }
    };

    for (const l of lines) {
      if (l.table) {
        if (para) flush();
        table = table || [];
        table.push(l);
        continue;
      }
      if (table) flush();
      if (l.level) {
        flush();
        out.push(`<h${l.level}>${runsToHtml(cleanRuns(l.runs))}</h${l.level}>`);
        continue;
      }
      if (para && continues(para.last, l, rightEdge)) {
        const joiner = /-$/.test(para.last.text) ? '' : ' ';
        if (joiner) para.runs.push({ text: ' ', b: false, i: false });
        else para.runs[para.runs.length - 1].text = para.runs[para.runs.length - 1].text.replace(/-$/, '');
        para.runs.push(...l.runs);
        para.last = l;
        continue;
      }
      flush();
      para = { x: l.x, runs: l.runs.slice(), last: l };
    }
    flush();
    return out.join('');
  }

  const Pdf = { toHtml, linesOf };
  if (typeof module !== 'undefined' && module.exports) module.exports = Pdf;
  else root.Pdf = Pdf;
})(this);
