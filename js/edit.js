// Manual formatting in the preview: read a line back as runs, set or clear a
// format on a range of characters, and write it out again as Seal HTML.
//
// A run is { text, b, i, v }: bold, italic, and v for a value in blue bold.
// Values are detected once, when the protocol is imported; after that the
// buttons decide, so nothing re-colours itself behind the user's back.
(function (root) {
  const Seal = root.Seal || require('./seal.js');

  const KINDS = ['v', 'b', 'i'];

  function renderRuns(runs) {
    let html = '';
    for (let k = 0; k < runs.length;) {
      const r = runs[k];
      // Join the neighbours that carry the same formatting.
      let text = '';
      while (k < runs.length && KINDS.every((f) => !!runs[k][f] === !!r[f])) text += runs[k++].text;
      if (!text) continue;
      if (r.v) { html += Seal.value(text); continue; }
      // Spaces at the edges stay outside the tags, so Seal keeps the words apart.
      const [, left, core, right] = text.match(/^(\s*)([\s\S]*?)(\s*)$/);
      let piece = Seal.esc(core);
      if (core) {
        if (r.b) piece = `<strong>${piece}</strong>`;
        if (r.i) piece = `<em>${piece}</em>`;
      }
      html += Seal.esc(left) + piece + Seal.esc(right);
    }
    return html;
  }

  // Splits the runs so that `start` and `end` fall between two runs.
  function splitAt(runs, offsets) {
    const out = [];
    let pos = 0;
    for (const r of runs) {
      let text = r.text;
      let from = pos;
      for (const cut of offsets) {
        if (cut > from && cut < from + text.length) {
          const k = cut - from;
          out.push({ ...r, text: text.slice(0, k) });
          text = text.slice(k);
          from = cut;
        }
      }
      out.push({ ...r, text });
      pos += r.text.length;
    }
    return out.filter((r) => r.text);
  }

  // True when every character of the range already carries the format.
  function hasFormat(runs, start, end, kind) {
    if (start >= end) return false;
    let pos = 0;
    for (const r of runs) {
      const from = pos;
      pos += r.text.length;
      if (pos <= start || from >= end) continue;
      if (!r[kind]) return false;
    }
    return true;
  }

  // Sets or clears one format on [start, end). Blue and bold cannot overlap:
  // a value is already bold in Seal, so bold on a value does nothing to it.
  function setFormat(runs, start, end, kind, on) {
    if (start >= end) return runs;
    const split = splitAt(runs, [start, end]);
    let pos = 0;
    return split.map((r) => {
      const from = pos;
      pos += r.text.length;
      if (pos <= start || from >= end) return r;
      const next = { ...r, [kind]: on };
      if (kind === 'v' && on) next.b = false;
      if (kind === 'b' && on && r.v) return r;
      return next;
    });
  }

  function clearFormat(runs, start, end) {
    return KINDS.reduce((acc, kind) => setFormat(acc, start, end, kind, false), runs);
  }

  const Edit = { renderRuns, setFormat, clearFormat, hasFormat, splitAt, KINDS };

  if (typeof module !== 'undefined' && module.exports) module.exports = Edit;
  else root.Edit = Edit;
})(this);
