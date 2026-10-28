// All sentences are made up. Never paste real lab protocols here.
const test = require('node:test');
const assert = require('node:assert/strict');
const Detect = require('../js/detect.js');

const values = (text) => Detect.findValues(text).map((v) => v.text);

test('the reference step finds its four values and nothing else', () => {
  assert.deepEqual(
    values('Inject 50 µL of biotin-LPETG at 1 mM subcutaneously at the immunisation site, 6 times, 20 min apart.'),
    ['50 µL', '1 mM', '6 times', '20 min']
  );
});

test('volumes, masses and concentrations', () => {
  assert.deepEqual(values('Add 200 uL PBS, 0.5 mL serum and 2 L water.'), ['200 uL', '0.5 mL', '2 L']);
  assert.deepEqual(values('Use 10 µg/mL anti-CD3 and 5 mg/kg drug.'), ['10 µg/mL', '5 mg/kg']);
  assert.deepEqual(values('Dilute to 100 nM, then 2 M NaCl, 10 U/mL IL-2.'), ['100 nM', '2 M', '10 U/mL']);
  assert.deepEqual(values('Fix in 4% (w/v) PFA, then 70% ethanol.'), ['4% (w/v)', '70%']);
  assert.deepEqual(values('Plate 1 x 10^6 cells/well, or 2e5 cells.'), ['1 x 10^6 cells/well', '2e5 cells']);
  assert.deepEqual(values('Use 10X PBS diluted to 1x.'), ['10X', '1x']);
});

test('durations, temperatures and speeds', () => {
  assert.deepEqual(values('Incubate 30 min at 37 °C, then 2 h at 4°C and overnight.'), ['30 min', '37 °C', '2 h', '4°C']);
  assert.deepEqual(values('Store at -80 °C for 3 weeks.'), ['-80 °C', '3 weeks']);
  assert.deepEqual(values('Spin at 300 x g for 5 min, or 1,500 rpm.'), ['300 x g', '5 min', '1,500 rpm']);
  assert.deepEqual(values('Spin 400 ×g, 10 s.'), ['400 ×g', '10 s']);
});

test('ranges stay in one piece', () => {
  assert.deepEqual(values('Wait 5-10 min, or 5–10 min, or 2 to 3 h.'), ['5-10 min', '5–10 min', '2 to 3 h']);
});

test('dilutions and repeats', () => {
  assert.deepEqual(values('Stain at 1:200, or 1/50, or 1 in 100.'), ['1:200', '1/50', '1 in 100']);
  assert.deepEqual(values('Wash twice, then three times, then x3.'), ['twice', 'three times', 'x3']);
  assert.deepEqual(values('A 10-fold dilution at pH 7.4.'), ['10-fold', 'pH 7.4']);
});

test('scientific notation written in full', () => {
  assert.deepEqual(values('Dilute to 0.167 x 1E6 PFU/mL from 2 x 1E7 PFU/mL.'),
    ['0.167 x 1E6 PFU/mL', '2 x 1E7 PFU/mL']);
  assert.deepEqual(values('Give a 5,000 PFU dose in 30 µL.'), ['5,000 PFU', '30 µL']);
});

test('a strain name keeps its number, a repeat count is one digit', () => {
  assert.deepEqual(values('Thaw Influenza A x31 and wash x3.'), ['x3']);
});

test('a clock is not a dilution', () => {
  assert.deepEqual(values('Last modified on 2026-07-27 22:26.'), []);
  assert.deepEqual(values('Stain at 1:200 and 20:1.'), ['1:200', '20:1']);
});

test('numbers glued to names are not values', () => {
  assert.deepEqual(values('Stain CD45 with BV421 and PE-Cy7.'), []);
  assert.deepEqual(values('Take 5 mice and 3 samples from group 2.'), []);
  assert.deepEqual(values('Use a 27G needle.'), ['27G']);
  assert.deepEqual(values('Done on 28/10/2026.'), []);
});

test('highlight escapes text and wraps values in blue bold', () => {
  assert.equal(
    Detect.highlight('Add 5 µL <fresh> buffer'),
    'Add <span data-native-color="blue" style="color: rgb(45, 114, 210);"><strong>5 µL</strong></span> &lt;fresh&gt; buffer'
  );
});

test('em dashes become commas, ranges keep their en dash', () => {
  assert.equal(Detect.cleanDashes('Wash the cells — gently — with PBS.'), 'Wash the cells, gently, with PBS.');
  assert.equal(Detect.cleanDashes('Spin—then wash.'), 'Spin, then wash.');
  assert.equal(Detect.cleanDashes('Mix well — .'), 'Mix well.');
  assert.equal(Detect.cleanDashes('Keep on ice – always.'), 'Keep on ice, always.');
  assert.equal(Detect.cleanDashes('Wait 5–10 min.'), 'Wait 5–10 min.');
});
