// All panels here are made up. Never commit a real lab panel.
const test = require('node:test');
const assert = require('node:assert/strict');
const Mix = require('../js/mix.js');

const panel = [
  ['Channel', 'Fluorochrome', 'Marker', 'Clone', 'Supplier', 'Cat. no.', 'Dilution'],
  ['BUV395', 'BUV395', 'CD90.2', '53-2.1', 'BD', '565257', '1:200'],
  ['BV510', 'BV510', 'CD95', 'Jo2', 'BD', '563646', '1:100'],
];

test('a dilution is read however it is written', () => {
  assert.equal(Mix.readDilution('1:200'), 200);
  assert.equal(Mix.readDilution('1/50'), 50);
  assert.equal(Mix.readDilution('200'), 200);
  assert.equal(Mix.readDilution('0.005'), 200);
  assert.equal(Mix.readDilution('0,005'), 200);
  assert.equal(Mix.readDilution(''), null);
  assert.equal(Mix.readDilution('n/a'), null);
});

test('a panel is read by its column names, in any order', () => {
  const rows = Mix.readPanel([
    ['Marker', 'Dilution', 'Fluorophore', 'Vendor'],
    ['CD19', '1:100', 'BUV661', 'BD'],
  ]);
  assert.deepEqual(rows, [{
    channel: '', fluorochrome: 'BUV661', marker: 'CD19', clone: '',
    supplier: 'BD', catalogue: '', dilution: 100,
  }]);
});

test('a panel without a dilution column gives nothing to compute', () => {
  assert.deepEqual(Mix.readPanel([['Marker', 'Clone'], ['CD19', '1D3']]), []);
});

test('the spreadsheet rules, on two antibodies and five samples', () => {
  const mix = Mix.computeMix({ antibodies: Mix.readPanel(panel), samples: 5 });
  assert.equal(mix.tests, 5);
  assert.equal(mix.vTotal, 500);        // 5 × 100 µL
  assert.equal(mix.bsb, 250);           // Vtotal / 2
  assert.deepEqual(mix.rows.map((r) => r.volume), [2.5, 5]); // 500/200, 500/100
  assert.equal(mix.antibodyVolume, 7.5);
  assert.equal(mix.pbs, 242.5);         // 500 − 250 − 7.5
  assert.deepEqual(mix.singleStains.map((s) => s.volume), [0.5, 1]); // Vf / dilution
  assert.deepEqual(mix.warnings, []);
});

test('excess adds tests, and the volume per test can change', () => {
  const antibodies = Mix.readPanel(panel);
  const mix = Mix.computeMix({ antibodies, samples: 10, excess: 10 });
  assert.equal(mix.tests, 11);
  assert.equal(mix.vTotal, 1100);
  assert.equal(mix.bsb, 550);
  assert.deepEqual(mix.rows.map((r) => r.volume), [5.5, 11]);

  const half = Mix.computeMix({ antibodies, samples: 10, vf: 50 });
  assert.equal(half.vTotal, 500);
  assert.deepEqual(half.singleStains.map((s) => s.volume), [0.25, 0.5]);
});

test('an impossible mix is reported instead of a negative volume', () => {
  const mix = Mix.computeMix({ antibodies: [{ marker: 'CD4', dilution: 1 }], samples: 2 });
  assert.equal(mix.pbs < 0, true);
  assert.deepEqual(mix.warnings, ['The antibodies alone exceed the total volume: check the dilutions.']);
});

test('an empty panel says so', () => {
  assert.deepEqual(Mix.computeMix({ samples: 5 }).warnings, ['No antibody has a dilution yet.']);
});

test('an antibody is named by its marker and its fluorochrome', () => {
  assert.equal(Mix.nameOf({ marker: 'CD19', fluorochrome: 'BUV661' }), 'CD19 BUV661');
  assert.equal(Mix.nameOf({ fluorochrome: 'BV510' }), 'BV510');
  assert.equal(Mix.nameOf({}), 'Antibody');
});
