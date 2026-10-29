// All examples are made up. Never paste real lab protocols here.
const test = require('node:test');
const assert = require('node:assert/strict');
const Check = require('../js/check.js');

const kinds = (issues) => issues.map((issue) => issue.kind);

test('a faithful conversion reports nothing', () => {
  const source = '<h1>Day 0</h1><ol><li>Weigh the mice and record the weight before anything else.</li>'
    + '<li>Inject 50 µL subcutaneously at the base of the tail.</li></ol>';
  const result = '<h2>I. Day 0</h2><ol><li>Weigh the mice and record the weight before anything else.</li>'
    + '<li>Inject 50 µL subcutaneously at the base of the tail.</li></ol>';
  assert.deepEqual(Check.checkDocument({ source, result }), []);
});

test('what the app drops on purpose is not an alarm', () => {
  // The original numbering, a bench sheet header, and a sentence Word cut into spans.
  const source = '<p>1. Heat the serum for 30 minutes in the water bath at 56 degrees.</p>'
    + '<table><tr><td>#</td><td>STEP</td><td>DONE</td></tr></table>'
    + '<p><span>Spin the tubes</span><span> at 300 x g for ten minutes</span><span>, then discard the liquid.</span></p>';
  const result = `<p>${'-'.repeat(184)}</p><h2>I. Steps</h2>`
    + '<ol><li>Heat the serum for 30 minutes in the water bath at 56 degrees.</li>'
    + '<li>Spin the tubes at 300 x g for ten minutes, then discard the liquid.</li></ol>';
  assert.deepEqual(Check.checkDocument({ source, result }), []);
});

test('a lost paragraph is named, with its first words', () => {
  const source = '<p>Weigh the mice and record the weight before anything else.</p>'
    + '<p>Keep every tube on ice until the staining is finished and the plate is ready.</p>';
  const result = '<ol><li>Weigh the mice and record the weight before anything else.</li></ol>';
  const issues = Check.checkDocument({ source, result });
  assert.deepEqual(kinds(issues), ['missing-text']);
  assert.match(issues[0].message, /Keep every tube on ice/);
});

test('several lost passages are counted', () => {
  const source = '<p>The first passage of the protocol, long enough to be checked.</p>'
    + '<p>The second passage of the protocol, also long enough to be checked.</p>'
    + '<p>The third passage of the protocol, long enough to be checked as well.</p>';
  const result = '<ol><li>The first passage of the protocol, long enough to be checked.</li></ol>';
  const issues = Check.checkDocument({ source, result });
  assert.match(issues[0].message, /^2 passages did not come through/);
});

test('a short line is not worth an alarm', () => {
  const source = '<p>Notes</p><p>Keep every tube on ice until the staining is finished.</p>';
  const result = '<ol><li>Keep every tube on ice until the staining is finished.</li></ol>';
  assert.deepEqual(Check.checkDocument({ source, result }), []);
});

test('a document that came out with no step at all is reported', () => {
  const source = '<p>The first line of the protocol, long enough to count as a passage.</p>'
    + '<p>The second line of the protocol, long enough to count as a passage.</p>'
    + '<p>The third line of the protocol, long enough to count as a passage.</p>';
  const result = source;
  assert.deepEqual(kinds(Check.checkDocument({ source, result })), ['no-steps']);
});

test('a bench sheet row is checked on its step, not on its tick column', () => {
  const source = '1\tHeat the serum for thirty minutes in the water bath.\tX\n'
    + '2\tMix the medium and the serum, then store at four degrees.\tX';
  const result = '<ol><li>Heat the serum for thirty minutes in the water bath.</li>'
    + '<li>Mix the medium and the serum, then store at four degrees.</li></ol>';
  assert.deepEqual(Check.checkDocument({ source, result, isHtml: false }), []);
});

test('a picture left behind is reported', () => {
  const source = '<p>Gating strategy of the day, with the plates in order:</p><p><img src="images/gating.png"></p>';
  const result = '<ol><li>Gating strategy of the day, with the plates in order:</li></ol>';
  assert.deepEqual(kinds(Check.checkDocument({ source, result })), ['missing-images']);
});

test('plain text is compared as text, not as HTML', () => {
  const source = 'Spin at 300 x g for five minutes at four degrees.\nWash twice with cold buffer, then resuspend.';
  const result = '<ol><li>Spin at 300 x g for five minutes at four degrees.</li>'
    + '<li>Wash twice with cold buffer, then resuspend.</li></ol>';
  assert.deepEqual(Check.checkDocument({ source, result, isHtml: false }), []);
});

test('entities and non breaking spaces do not raise false alarms', () => {
  const source = '<p>Rinse the monolayer with Ca&#178;&#43;/Mg free PBS&#58;&nbsp;2 mL per flask.</p>';
  const result = '<ol><li>Rinse the monolayer with Ca²+/Mg free PBS: 2 mL per flask.</li></ol>';
  assert.deepEqual(Check.checkDocument({ source, result }), []);
});
