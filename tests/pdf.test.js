// All protocols here are made up. Never paste real lab protocols here.
const test = require('node:test');
const assert = require('node:assert/strict');
const Pdf = require('../js/pdf.js');
const Parse = require('../js/parse.js');
const Seal = require('../js/seal.js');

// A word placed on the page: width grows with its length, like a real font.
const word = (text, x, y, size = 11, opts = {}) => ({ text, x, y, w: text.length * size * 0.5, size, ...opts });
const page = (items) => ({ width: 595, height: 842, items });

test('lines are rebuilt from words, a bigger line is a heading, the biggest one the title', () => {
  const html = Pdf.toHtml([page([
    word('Mouse', 72, 760, 20), word('immunisation', 130, 760, 20),
    word('1. Before', 72, 720, 14),
    word('Thaw the', 72, 700), word('adjuvant.', 120, 700),
  ])]);
  assert.equal(html, '<h1>Mouse immunisation</h1><h2>1. Before</h2><p>Thaw the adjuvant.</p>');
});

test('a step wrapped over two lines becomes one paragraph, a new marker starts another', () => {
  const long = 'Inject 100 µL of the emulsion under the skin of each mouse and return them to';
  const html = Pdf.toHtml([page([
    word(long, 72, 700),
    word('their cage.', 90, 686),
    word('2. Wait 14 days.', 72, 672),
  ])]);
  assert.equal(html, `<p>${long} their cage.</p><p>2. Wait 14 days.</p>`);
});

test('a hyphen at the end of a full line joins the word back', () => {
  const html = Pdf.toHtml([page([
    word('Spin the tubes at 300 x g for five minutes then carefully remove the super-', 72, 700),
    word('natant.', 72, 686),
  ])]);
  assert.match(html, /supernatant\./);
});

test('bold words keep their weight, a Symbol bullet becomes a bullet', () => {
  const html = Pdf.toHtml([page([
    word('Buffers', 72, 720, 11, { bold: true }),
    word('\uf0b7', 72, 700), word('PBS with 2% FCS', 90, 700),
  ])]);
  assert.equal(html, '<p><strong>Buffers</strong></p><p>• PBS with 2% FCS</p>');
});

test('lines indented to the right carry a margin the parser reads as depth', () => {
  const html = Pdf.toHtml([page([
    word('1. Prepare the plate.', 72, 720),
    word('a. Add 50 µL per well.', 108, 706),
    word('2. Read the plate.', 72, 692),
  ])]);
  assert.equal(html, '<p>1. Prepare the plate.</p><p style="margin-left: 48px">a. Add 50 µL per well.</p><p>2. Read the plate.</p>');
});

test('words aligned in columns on following lines make a table', () => {
  const html = Pdf.toHtml([page([
    word('Reagent', 72, 720, 11, { bold: true }), word('Volume', 250, 720, 11, { bold: true }),
    word('PBS', 72, 706), word('5 mL', 250, 706),
    word('Serum', 72, 692), word('50 µL', 250, 692),
    word('Mix well.', 72, 672),
  ])]);
  assert.equal(html,
    '<table><tr><td><strong>Reagent</strong></td><td><strong>Volume</strong></td></tr>'
    + '<tr><td>PBS</td><td>5 mL</td></tr><tr><td>Serum</td><td>50 µL</td></tr></table><p>Mix well.</p>');
});

test('page numbers and a header repeated on every page are dropped', () => {
  const html = Pdf.toHtml([
    page([word('Lab protocol ML-001', 72, 800, 9), word('First step.', 72, 700), word('1', 300, 40, 9)]),
    page([word('Lab protocol ML-001', 72, 800, 9), word('Second step.', 72, 700), word('2', 300, 40, 9)]),
    page([word('Lab protocol ML-001', 72, 800, 9), word('Third step.', 72, 700), word('Page 3 of 3', 280, 40, 9)]),
  ]);
  assert.equal(html, '<p>First step.</p><p>Second step.</p><p>Third step.</p>');
});

test('a scan with no words gives nothing', () => {
  assert.equal(Pdf.toHtml([page([])]), '');
});

test('a document title in the biggest size on one line only, chapters in the next size', () => {
  const html = Pdf.toHtml([page([
    word('Cell staining', 72, 760, 20),
    word('1. Staining', 72, 720, 14),
    word('Add 50 µL of antibody mix.', 72, 700),
    word('2. Washing', 72, 680, 14),
    word('Wash twice.', 72, 660),
  ])]);
  assert.equal(html, '<h1>Cell staining</h1><h2>1. Staining</h2><p>Add 50 µL of antibody mix.</p><h2>2. Washing</h2><p>Wash twice.</p>');
});

test('words under a link rectangle take its address, a longer piece is cut at its edge', () => {
  const items = Pdf.applyLinks([
    word('See the', 72, 700), word('staining SOP', 120, 700), word('first.', 200, 700),
    // One piece of 20 characters, 110 wide: the link covers "datasheet" only.
    word('Read the datasheet .', 72, 680),
    word('Not here', 120, 660),
  ], [
    { url: 'https://example.org/sop', rect: [119, 697, 187, 711] },
    // The rectangle is a little off, as it is when letters differ in width.
    { url: 'https://example.org/d', rect: [72 + 7.6 * 5.5, 677, 72 + 16.4 * 5.5, 691] },
  ]);
  assert.deepEqual(items.map((it) => [it.text, it.href || '']), [
    ['See the', ''], ['staining SOP', 'https://example.org/sop'], ['first.', ''],
    ['Read the ', ''], ['datasheet', 'https://example.org/d'], [' .', ''],
    ['Not here', ''],
  ]);
  assert.equal(Pdf.toHtml([page(items.slice(0, 3))]),
    '<p>See the <a href="https://example.org/sop">staining SOP</a> first.</p>');
});
