// Builds the HTML that Seal keeps when it is pasted in.
// Every tag and attribute here was checked by hand in Seal: change them only after a new paste test.
(function (root) {
  const BLUE_STYLE = 'color: rgb(45, 114, 210);';
  const SEPARATOR_LENGTH = 184;

  // Escapes text so that "<", "&" or quotes in a protocol never turn into markup.
  function esc(text) {
    return String(text)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;');
  }

  // Values to respect: volumes, concentrations, durations, temperatures, speeds, dilutions, repeats.
  function value(text) {
    return `<span data-native-color="blue" style="${BLUE_STYLE}"><strong>${esc(text)}</strong></span>`;
  }

  // Reagents, equipment and warnings.
  function bold(text) {
    return `<strong>${esc(text)}</strong>`;
  }

  // Remarks and tips, always wrapped in brackets.
  function note(text) {
    return `<em>(${esc(text)})</em>`;
  }

  function roman(n) {
    if (!Number.isInteger(n) || n < 1 || n > 3999) throw new RangeError(`No roman numeral for ${n}`);
    const table = [[1000, 'M'], [900, 'CM'], [500, 'D'], [400, 'CD'], [100, 'C'], [90, 'XC'],
      [50, 'L'], [40, 'XL'], [10, 'X'], [9, 'IX'], [5, 'V'], [4, 'IV'], [1, 'I']];
    let out = '';
    for (const [size, sign] of table) {
      while (n >= size) { out += sign; n -= size; }
    }
    return out;
  }

  // 1 -> a, 26 -> z, 27 -> aa, like spreadsheet columns.
  function letter(n) {
    if (!Number.isInteger(n) || n < 1) throw new RangeError(`No letter for ${n}`);
    let out = '';
    while (n > 0) {
      n -= 1;
      out = String.fromCharCode(97 + (n % 26)) + out;
      n = Math.floor(n / 26);
    }
    return out;
  }

  function separator() {
    return `<p>${'-'.repeat(SEPARATOR_LENGTH)}</p>`;
  }

  // A chapter always comes with the separator paragraph before it.
  function chapter(n, title) {
    return `${separator()}<h2>${roman(n)}. ${esc(title)}</h2>`;
  }

  function section(n, title) {
    return `<h3>${letter(n)}. ${esc(title)}</h3>`;
  }

  // Each step is HTML already built with value(), bold(), note() and esc().
  function steps(items) {
    return `<ol>${items.map((item) => `<li>${item}</li>`).join('')}</ol>`;
  }

  function paragraph(html) {
    return `<p>${html}</p>`;
  }

  // Headers in bold; cells that are numbers (with or without a unit) in blue bold.
  function table(headers, rows) {
    return rawTable(
      headers.map(bold),
      rows.map((row) => row.map((cell) => (isNumeric(cell) ? value(cell) : esc(cell ?? ''))))
    );
  }

  // Same table from cells that are already HTML. A table may have no header row.
  function rawTable(headHtml, rowsHtml) {
    const head = headHtml ? `<tr>${headHtml.map((h) => `<th>${h}</th>`).join('')}</tr>` : '';
    const body = rowsHtml.map((row) => `<tr>${row.map((c) => `<td>${c}</td>`).join('')}</tr>`).join('');
    return `<table>${head}${body}</table>`;
  }

  function isNumeric(cell) {
    if (typeof cell === 'number') return Number.isFinite(cell);
    return typeof cell === 'string' && /^\s*[<>~≈]?\s*\d+([.,]\d+)?/.test(cell);
  }

  // An image travels inside the HTML, so Seal receives it with the text.
  function image(src, alt = '') {
    return `<p><img src="${esc(src)}" alt="${esc(alt)}"></p>`;
  }

  function blocks(list) {
    return (list || []).map((b) => {
      if (b.type === 'steps') return b.items.length ? steps(b.items) : '';
      if (b.type === 'para') return paragraph(b.html);
      if (b.type === 'table') return rawTable(b.head, b.rows);
      if (b.type === 'image') return image(b.src, b.alt);
      if (b.type === 'raw') return b.html;
      return '';
    }).join('');
  }

  // A whole document: [{ title, blocks?, intro?, steps?, sections: [{ title, blocks?, steps? }] }]
  // A chapter without a title (text before the first chapter) gets no heading and no separator.
  function document(chapters) {
    let n = 0;
    return chapters.map((ch) => {
      const parts = [];
      if (ch.title) parts.push(chapter(++n, ch.title));
      if (ch.intro) parts.push(paragraph(ch.intro));
      if (ch.steps && ch.steps.length) parts.push(steps(ch.steps));
      parts.push(blocks(ch.blocks));
      (ch.sections || []).forEach((sec, j) => {
        parts.push(section(j + 1, sec.title));
        if (sec.steps && sec.steps.length) parts.push(steps(sec.steps));
        parts.push(blocks(sec.blocks));
      });
      return parts.join('');
    }).join('');
  }

  const Seal = { esc, value, bold, note, roman, letter, separator, chapter, section, steps, paragraph, table, rawTable, image, document };

  if (typeof module !== 'undefined' && module.exports) module.exports = Seal;
  else root.Seal = Seal;
})(this);
