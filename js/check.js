// Compares a document with its Seal version and says what did not make it through.
// A migration is only safe if nothing disappears quietly.
//
// Words are a poor measure here: the app drops the original numbering on purpose,
// a bench sheet loses its "#" and "DONE" columns, and a sentence cut into five
// spans by Word comes back as one. So whole passages are compared instead, on
// their letters and digits alone.
(function (root) {
  const ENTITIES = { amp: '&', lt: '<', gt: '>', quot: '"', apos: "'", nbsp: ' ' };

  function textOf(html) {
    return String(html)
      .replace(/<(script|style)[^>]*>[\s\S]*?<\/\1>/gi, ' ')
      .replace(/<(p|div|li|tr|h[1-6]|br)\b[^>]*>/gi, '\n')
      .replace(/<[^>]+>/g, ' ')
      .replace(/&#(\d+);/g, (m, code) => String.fromCharCode(Number(code)))
      .replace(/&(amp|lt|gt|quot|apos|nbsp);/g, (m, name) => ENTITIES[name])
      .replace(/[ \t ]+/g, ' ')
      .replace(/\n{2,}/g, '\n')
      .trim();
  }

  // Letters and digits only: spacing, punctuation and tags cannot cause a false alarm.
  const normalise = (text) => String(text).toLowerCase().replace(/[^\p{L}\p{N}]+/gu, '');

  // A passage worth checking: long enough that its absence means lost content.
  const MIN_LENGTH = 30;
  const PROBE = 40;

  // A row of a table is checked cell by cell: the tick of a "DONE" column
  // belongs to the sheet, not to the protocol.
  function passages(text) {
    return String(text).split(/\n+/)
      .flatMap((line) => (line.includes('\t') ? line.split('\t') : [line]))
      .map((line) => line.trim())
      .filter((line) => normalise(line).length >= MIN_LENGTH);
  }

  function shorten(text) {
    const clean = text.replace(/\s+/g, ' ').trim();
    return clean.length > 70 ? `${clean.slice(0, 70)}…` : clean;
  }

  // The numbering of the source is dropped on purpose, so it is dropped here too.
  const MARKER = new RegExp([
    '^\\s*(?:step\\s*)?\\d{1,3}\\.\\d{1,2}[.)]?\\s+', // 6.1 Master mix
    '^\\s*(?:step\\s*)?\\d{1,3}[.)]\\s+',            // 3. KLH preparation
    '^\\s*\\d{1,3}\\t',                              // a bench sheet row
    '^\\s*[IVXivx]{1,6}[.)]\\s+',                    // I. Before experiments
    '^\\s*[a-zA-Z][.)]\\s+',                         // a. Buffers
    '^\\s*[-•*·▪◦–]\\s+',                            // a bullet
  ].join('|'));

  // Passages of the source that are nowhere in the result.
  function missingPassages(sourceText, resultText) {
    const haystack = normalise(resultText);
    return passages(sourceText).filter((line) => !haystack.includes(normalise(line.replace(MARKER, '')).slice(0, PROBE)));
  }

  // source: the document as it arrived (HTML or plain text). result: the Seal HTML.
  function checkDocument({ source = '', result = '', isHtml = true } = {}) {
    const sourceText = isHtml ? textOf(source) : String(source);
    const resultText = textOf(result);
    const issues = [];

    const missing = missingPassages(sourceText, resultText);
    if (missing.length) {
      const sample = missing.slice(0, 2).map(shorten).join(' / ');
      issues.push({
        kind: 'missing-text',
        message: missing.length === 1
          ? `One passage did not come through: ${sample}`
          : `${missing.length} passages did not come through, starting with: ${sample}`,
      });
    }

    if (passages(sourceText).length > 2 && !/<li>/.test(result)) {
      issues.push({ kind: 'no-steps', message: 'No step was found: the lines may need Up and Down.' });
    }

    const sourceImages = (String(source).match(/<img\b/gi) || []).length;
    const resultImages = (String(result).match(/<img\b/gi) || []).length;
    if (sourceImages > resultImages) {
      issues.push({
        kind: 'missing-images',
        message: `${sourceImages - resultImages} picture(s) were left out, probably stored outside the file.`,
      });
    }

    return issues;
  }

  const Check = { checkDocument, missingPassages, passages, textOf, normalise };

  if (typeof module !== 'undefined' && module.exports) module.exports = Check;
  else root.Check = Check;
})(this);
