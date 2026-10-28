// Run with: npm test (or node --test)
// All examples are made up. Never paste real lab protocols here.
const test = require('node:test');
const assert = require('node:assert/strict');
const Seal = require('../js/seal.js');

const BLUE = (t) => `<span data-native-color="blue" style="color: rgb(45, 114, 210);"><strong>${t}</strong></span>`;

test('the reference step comes out character for character', () => {
  const { value, bold, steps } = Seal;
  const html = steps([
    `Inject ${value('50 µL')} of ${bold('biotin-LPETG')} at ${value('1 mM')} subcutaneously at the immunisation site, ${value('6 times')}, ${value('20 min')} apart.`,
  ]);
  const expected = '<ol><li>Inject <span data-native-color="blue" style="color: rgb(45, 114, 210);"><strong>50 µL</strong></span> of <strong>biotin-LPETG</strong> at <span data-native-color="blue" style="color: rgb(45, 114, 210);"><strong>1 mM</strong></span> subcutaneously at the immunisation site, <span data-native-color="blue" style="color: rgb(45, 114, 210);"><strong>6 times</strong></span>, <span data-native-color="blue" style="color: rgb(45, 114, 210);"><strong>20 min</strong></span> apart.</li></ol>';
  assert.equal(html, expected);
});

test('chapter: separator of 184 dashes, then roman numeral', () => {
  const html = Seal.chapter(1, 'Before experiments');
  assert.equal(html, `<p>${'-'.repeat(184)}</p><h2>I. Before experiments</h2>`);
  assert.equal(html.match(/-/g).length, 184);
});

test('section uses a lower case letter', () => {
  assert.equal(Seal.section(1, 'Biotin-LPETG preparation'), '<h3>a. Biotin-LPETG preparation</h3>');
  assert.equal(Seal.section(3, 'Staining'), '<h3>c. Staining</h3>');
});

test('roman numerals and letters', () => {
  assert.deepEqual([1, 2, 4, 9, 14, 40, 90, 400, 1994].map(Seal.roman),
    ['I', 'II', 'IV', 'IX', 'XIV', 'XL', 'XC', 'CD', 'MCMXCIV']);
  assert.deepEqual([1, 2, 26, 27, 28, 52].map(Seal.letter), ['a', 'b', 'z', 'aa', 'ab', 'az']);
  assert.throws(() => Seal.roman(0));
  assert.throws(() => Seal.letter(0));
});

test('notes are italic and in brackets', () => {
  assert.equal(Seal.note('avoid bubbles'), '<em>(avoid bubbles)</em>');
});

test('text is escaped, so a protocol cannot inject markup', () => {
  assert.equal(Seal.bold('PBS < 4 °C & "fresh"'), '<strong>PBS &lt; 4 °C &amp; &quot;fresh&quot;</strong>');
  assert.equal(Seal.value('<1 h'), BLUE('&lt;1 h'));
});

test('table: bold headers, numbers in blue bold, text left plain', () => {
  const html = Seal.table(['Reagent', 'Volume'], [['PBS', '50 µL'], ['Mouse serum', 2]]);
  assert.equal(html,
    '<table>' +
    '<tr><th><strong>Reagent</strong></th><th><strong>Volume</strong></th></tr>' +
    `<tr><td>PBS</td><td>${BLUE('50 µL')}</td></tr>` +
    `<tr><td>Mouse serum</td><td>${BLUE('2')}</td></tr>` +
    '</table>');
});

test('whole document numbers chapters and restarts letters in each chapter', () => {
  const html = Seal.document([
    { title: 'Before experiments', sections: [
      { title: 'Buffer preparation', steps: ['Mix.'] },
      { title: 'Mouse preparation', steps: ['Weigh.'] },
    ] },
    { title: 'Day 0', sections: [{ title: 'Injection', steps: ['Inject.'] }] },
  ]);
  const sep = `<p>${'-'.repeat(184)}</p>`;
  assert.equal(html,
    `${sep}<h2>I. Before experiments</h2>` +
    '<h3>a. Buffer preparation</h3><ol><li>Mix.</li></ol>' +
    '<h3>b. Mouse preparation</h3><ol><li>Weigh.</li></ol>' +
    `${sep}<h2>II. Day 0</h2>` +
    '<h3>a. Injection</h3><ol><li>Inject.</li></ol>');
});
