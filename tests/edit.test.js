// All examples are made up. Never paste real lab protocols here.
const test = require('node:test');
const assert = require('node:assert/strict');
const Edit = require('../js/edit.js');

const B = (t) => `<span data-native-color="blue" style="color: rgb(45, 114, 210);"><strong>${t}</strong></span>`;
const plain = (text) => [{ text }];
// Offsets of a word, so the tests read like what the user selects.
const at = (text, word) => ({ start: text.indexOf(word), end: text.indexOf(word) + word.length });

test('blue on a selection, and off again', () => {
  const text = 'Add 5 mL of PBS.';
  const { start, end } = at(text, '5 mL');
  const blue = Edit.setFormat(plain(text), start, end, 'v', true);
  assert.equal(Edit.renderRuns(blue), `Add ${B('5 mL')} of PBS.`);
  assert.equal(Edit.renderRuns(Edit.setFormat(blue, start, end, 'v', false)), 'Add 5 mL of PBS.');
});

test('bold and italic, and both at once', () => {
  const text = 'Keep the syringes on ice.';
  const b = at(text, 'syringes');
  const bold = Edit.setFormat(plain(text), b.start, b.end, 'b', true);
  assert.equal(Edit.renderRuns(bold), 'Keep the <strong>syringes</strong> on ice.');
  const both = Edit.setFormat(bold, b.start, b.end, 'i', true);
  assert.equal(Edit.renderRuns(both), 'Keep the <em><strong>syringes</strong></em> on ice.');
});

test('spaces at the edges of a selection stay outside the tags', () => {
  const text = 'Mix PBS and serum.';
  const runs = Edit.setFormat(plain(text), 3, 8, 'b', true); // " PBS "
  assert.equal(Edit.renderRuns(runs), 'Mix <strong>PBS</strong> and serum.');
});

test('a value is bold in Seal already, so bold leaves it alone', () => {
  const text = 'Spin at 300 x g.';
  const { start, end } = at(text, '300 x g');
  const blue = Edit.setFormat(plain(text), start, end, 'v', true);
  assert.equal(Edit.renderRuns(Edit.setFormat(blue, start, end, 'b', true)), `Spin at ${B('300 x g')}.`);
});

test('clear removes every format on the selection only', () => {
  const text = 'Add 5 mL of serum.';
  const v = at(text, '5 mL');
  const bold = at(text, 'serum');
  let runs = Edit.setFormat(plain(text), v.start, v.end, 'v', true);
  runs = Edit.setFormat(runs, bold.start, bold.end, 'b', true);
  runs = Edit.clearFormat(runs, v.start, v.end);
  assert.equal(Edit.renderRuns(runs), 'Add 5 mL of <strong>serum</strong>.');
});

test('hasFormat answers for the whole selection, so a button can toggle', () => {
  const text = 'Wait 20 min at 4 °C.';
  const a = at(text, '20 min');
  const runs = Edit.setFormat(plain(text), a.start, a.end, 'v', true);
  assert.equal(Edit.hasFormat(runs, a.start, a.end, 'v'), true);
  assert.equal(Edit.hasFormat(runs, a.start, a.end + 5, 'v'), false);
  assert.equal(Edit.hasFormat(runs, a.start, a.start, 'v'), false);
});

test('formatting part of an existing run splits it', () => {
  const runs = [{ text: 'Spin ' }, { text: '5 min', v: true }, { text: ' at 4 °C.' }];
  const next = Edit.setFormat(runs, 0, 4, 'b', true);
  assert.equal(Edit.renderRuns(next), `<strong>Spin</strong> ${B('5 min')} at 4 °C.`);
});

test('text is escaped in the preview too', () => {
  assert.equal(Edit.renderRuns([{ text: 'Keep <5 min & cold' }]), 'Keep &lt;5 min &amp; cold');
});
