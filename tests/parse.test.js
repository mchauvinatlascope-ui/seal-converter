// All protocols here are made up. Never paste real lab protocols here.
const test = require('node:test');
const assert = require('node:assert/strict');
const Seal = require('../js/seal.js');
const Parse = require('../js/parse.js');

const SEP = `<p>${'-'.repeat(184)}</p>`;
const B = (t) => `<span data-native-color="blue" style="color: rgb(45, 114, 210);"><strong>${t}</strong></span>`;
const fromText = (text) => Seal.document(Parse.blocksToDoc(Parse.textToBlocks(text)));
const run = (text, b = false, i = false) => ({ text, b, i });

test('plain lines without headings are numbered steps', () => {
  assert.equal(fromText('Spin at 300 x g.\n\nWash twice.'),
    `<ol><li>Spin at ${B('300 x g')}.</li><li>Wash ${B('twice')}.</li></ol>`);
});

test('roman and letter markers give chapters and sections, numbers are dropped', () => {
  const html = fromText([
    'I. Before experiments',
    'a. Buffer preparation',
    '1. Mix 5 mL PBS with 50 µL serum.',
    '2) Keep on ice.',
    'II. Day 0',
    'a. Injection',
    '- Inject 100 µL.',
  ].join('\n'));
  assert.equal(html,
    `${SEP}<h2>I. Before experiments</h2><h3>a. Buffer preparation</h3>` +
    `<ol><li>Mix ${B('5 mL')} PBS with ${B('50 µL')} serum.</li><li>Keep on ice.</li></ol>` +
    `${SEP}<h2>II. Day 0</h2><h3>a. Injection</h3><ol><li>Inject ${B('100 µL')}.</li></ol>`);
});

test('a lettered sentence ending with a period stays a step', () => {
  assert.equal(fromText('a. Add 5 mL PBS.'), `<ol><li>Add ${B('5 mL')} PBS.</li></ol>`);
});

test('numbered titles over unnumbered steps become chapters, text before them is an intro', () => {
  const html = fromText([
    'Example cell line',
    '1. Thawing',
    'Thaw the vial at 37 °C.',
    'Spin at 300 x g for 3 min.',
    '2. Subculture',
    'Rinse with PBS.',
  ].join('\n'));
  assert.equal(html,
    '<p>Example cell line</p>' +
    `${SEP}<h2>I. Thawing</h2><ol><li>Thaw the vial at ${B('37 °C')}.</li><li>Spin at ${B('300 x g')} for ${B('3 min')}.</li></ol>` +
    `${SEP}<h2>II. Subculture</h2><ol><li>Rinse with PBS.</li></ol>`);
});

test('tab separated lines become a table, with a header row only when it reads like one', () => {
  const html = fromText([
    'I. Conditions',
    'Incubator\t37 °C',
    'Split ratio\t1:3',
    'Note right after the table.',
    'II. Troubleshooting',
    'Observation\tSuggested action',
    'Cells float\tWait 24 h',
  ].join('\n'));
  assert.equal(html,
    `${SEP}<h2>I. Conditions</h2>` +
    `<table><tr><td>Incubator</td><td>${B('37 °C')}</td></tr><tr><td>Split ratio</td><td>${B('1:3')}</td></tr></table>` +
    '<p>Note right after the table.</p>' +
    `${SEP}<h2>II. Troubleshooting</h2>` +
    `<table><tr><th><strong>Observation</strong></th><th><strong>Suggested action</strong></th></tr>` +
    `<tr><td>Cells float</td><td>Wait ${B('24 h')}</td></tr></table>`);
});

test('headings: a single top heading is the title, the next level gives chapters', () => {
  const doc = Parse.blocksToDoc([
    { kind: 'heading', level: 1, runs: [run('Example protocol')] },
    { kind: 'para', runs: [run('Version 1.0.')] },
    { kind: 'heading', level: 2, runs: [run('1. Thawing')] },
    { kind: 'item', runs: [run('Thaw at 37 °C.')] },
    { kind: 'heading', level: 2, runs: [run('2. Subculture')] },
    { kind: 'heading', level: 3, runs: [run('Rinse')] },
    { kind: 'item', runs: [run('Rinse with '), run('PBS', true), run('.')] },
  ]);
  assert.equal(Seal.document(doc),
    '<p><strong>Example protocol</strong></p><p>Version 1.0.</p>' +
    `${SEP}<h2>I. Thawing</h2><ol><li>Thaw at ${B('37 °C')}.</li></ol>` +
    `${SEP}<h2>II. Subculture</h2><h3>a. Rinse</h3><ol><li>Rinse with <strong>PBS</strong>.</li></ol>`);
});

test('bold and italic are kept, values win over bold, values split across runs are joined', () => {
  assert.equal(
    Parse.runsToHtml([run('Add '), run('50', true), run(' µL of '), run('serum', true), run(' '), run('(fresh)', false, true)]),
    `Add ${B('50 µL')} of <strong>serum</strong> <em>(fresh)</em>`
  );
});

test('an italic remark stays in one <em>, with its values inside', () => {
  assert.equal(
    Parse.runsToHtml([run('Mix '), run('(vortex every 10 min)', false, true), run('.')]),
    `Mix <em>(vortex every ${B('10 min')})</em>.`
  );
});

test('formatting next to a run edge keeps its comma', () => {
  assert.equal(Parse.runsToHtml([run('CO'), run('₂'), run(', humidified')]), 'CO₂, humidified');
});

test('raw HTML typed as text is recognised', () => {
  assert.equal(Parse.looksLikeHtml('<div><h1>Title</h1></div>'), true);
  assert.equal(Parse.looksLikeHtml('Keep <5 min on ice.'), false);
});
