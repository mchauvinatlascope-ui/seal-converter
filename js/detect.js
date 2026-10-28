// Finds the values to respect in a protocol (volumes, concentrations, durations,
// temperatures, speeds, dilutions, repeats) so they can be put in blue bold.
(function (root) {
  const SP = '[ \\u00a0\\u202f]?'; // at most one space, including the non-breaking kinds Word uses
  const MINUS = '[-\\u2212]';

  // x 10^6 | × 10⁶ | e6
  const SCI = `(?:${SP}[x×]${SP}10(?:${SP}\\^?${SP}${MINUS}?\\d+|[⁻]?[⁰¹²³⁴⁵⁶⁷⁸⁹]+)|e[-+]?\\d+)`;
  // 5 | 0.5 | 1,000 | 1 x 10^6 | 2e6 | -80
  const NUM = `(?:${MINUS})?\\d+(?:[.,]\\d+)?${SCI}?`;
  // 5-10 | 5–10 | 5 to 10 | 37 ± 1
  const RANGE = `${NUM}(?:\\s*(?:-|–|to|±|\\+\\/-)\\s*${NUM})?`;

  // Order matters: longer forms first so "mins" wins over "min" and "x g" over "x".
  const UNITS = [
    '°' + SP + 'C', 'º' + SP + 'C', '˚' + SP + 'C', 'degrees' + SP + 'C',
    '[x×]' + SP + 'g', 'rpm', 'RPM',
    '%' + SP + '\\((?:w\\/v|v\\/v|w\\/w)\\)', '%',
    '[µμu]L', '[µμu]l', 'nL', 'mL', 'ml', 'L',
    '[µμu]M', 'nM', 'pM', 'fM', 'mM', 'M',
    '[µμun]mol', 'mmol', 'mol',
    'kDa', 'Da',
    '[µμu]g', 'ng', 'pg', 'mg', 'kg', 'g',
    'IU', 'U',
    'minutes', 'minute', 'mins', 'min',
    'seconds', 'second', 'secs', 'sec', 's',
    'hours', 'hour', 'hrs', 'hr', 'h',
    'days', 'day', 'weeks', 'week', 'wk', 'months', 'month',
    '[µμu]m', 'nm', 'mm', 'cm',
    'Gy', 'mA', 'V', 'G',
    'cells', 'cell',
    'times', '-?fold', `[xX×](?!${SP}\\d)`,
  ];
  const UNIT = `(?:${UNITS.join('|')})`;
  // mg/mL, U/mL, cells/well, µg/mouse...
  const PER = `(?:${SP}\\/${SP}(?:[µμun]?[Lgl]|mL|ml|kg|g|well|mouse|animal|cm2|cm²|min|h|s))?`;

  const WORD_NUMBERS = '[Oo]ne|[Tt]wo|[Tt]hree|[Ff]our|[Ff]ive|[Ss]ix|[Ss]even|[Ee]ight|[Nn]ine|[Tt]en';

  const PATTERNS = [
    `${RANGE}${SP}${UNIT}${PER}`, // 50 µL, 1 mM, 300 x g, 10 µg/mL
    `\\d+(?:[.,]\\d+)?(?:\\s*(?:-|–|to)\\s*\\d+(?:[.,]\\d+)?)?${SCI}`, // counts: 7.5 to 22.5 × 10⁵
    `\\d+${SP}(?::|\\/|in)${SP}\\d+(?![\\/\\d])`, // dilutions 1:200, 1/50, 1 in 100
    `[xX×]${SP}\\d+`, // x3
    `pH${SP}\\d+(?:\\.\\d+)?`,
    `(?:${WORD_NUMBERS})\\s+times`,
    '[Oo]nce|[Tt]wice|[Tt]hrice',
  ];

  // Case sensitive on purpose: M is molar, m is not a unit here.
  // Not glued to a word on the left (CD45, BV421, Cy7) nor on the right (5 mice, 3 samples).
  const FIND = new RegExp(
    `(?<![\\p{L}\\p{N}.,/:])(?:${PATTERNS.join('|')})(?![\\p{L}\\p{N}µμ°])`,
    'gu'
  );

  function findValues(text) {
    return Array.from(String(text).matchAll(FIND), (m) => (
      { start: m.index, end: m.index + m[0].length, text: m[0] }
    ));
  }

  // Em dashes, and spaced en dashes used the same way, become commas.
  // En dashes inside ranges ("5–10 min") are left alone.
  // Only the dash and the spaces around it change, so formatting around it is kept.
  function cleanDashes(text) {
    return String(text).replace(/\s*(?:—|(?<=\s)–(?=\s))\s*/g, (dash, offset, all) => {
      const before = all.slice(0, offset);
      const after = all.slice(offset + dash.length);
      if (!before.trim() || !after.trim() || /^[,.;:!?)]/.test(after)) return '';
      return ', ';
    });
  }

  // Plain text in, Seal HTML out: escaped text with every value in blue bold.
  function highlight(text) {
    const Seal = root.Seal || require('./seal.js');
    let html = '';
    let last = 0;
    for (const v of findValues(text)) {
      html += Seal.esc(text.slice(last, v.start)) + Seal.value(v.text);
      last = v.end;
    }
    return html + Seal.esc(text.slice(last));
  }

  const Detect = { findValues, cleanDashes, highlight };

  if (typeof module !== 'undefined' && module.exports) module.exports = Detect;
  else root.Detect = Detect;
})(this);
