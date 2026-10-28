// All examples are made up. Never paste real lab protocols here.
const test = require('node:test');
const assert = require('node:assert/strict');
const Copy = require('../js/copy.js');
const Seal = require('../js/seal.js');

const B = (t) => `<span data-native-color="blue" style="color: rgb(45, 114, 210);"><strong>${t}</strong></span>`;

test('screen classes are dropped, the Seal markup is untouched', () => {
  const html = `<p class="sep">${'-'.repeat(184)}</p><h2>I. Day 0</h2>` +
    `<ol><li id="x">Inject ${B('50 µL')} of <strong>OVA</strong>.</li></ol>`;
  assert.equal(Copy.sealHtml(html),
    `<p>${'-'.repeat(184)}</p><h2>I. Day 0</h2>` +
    `<ol><li>Inject ${B('50 µL')} of <strong>OVA</strong>.</li></ol>`);
});

test('the reference step survives the copy character for character', () => {
  const step = `<ol><li>Inject ${B('50 µL')} of <strong>biotin-LPETG</strong> at ${B('1 mM')} subcutaneously at the immunisation site, ${B('6 times')}, ${B('20 min')} apart.</li></ol>`;
  assert.equal(Copy.sealHtml(step), step);
});

test('the tbody the browser adds is dropped', () => {
  assert.equal(Copy.sealHtml('<table><tbody><tr><td>PBS</td></tr></tbody></table>'),
    '<table><tr><td>PBS</td></tr></table>');
});

test('plain text numbers the steps and restarts at each list', () => {
  const html = '<h2>I. Day 0</h2><ol><li>Weigh the mice.</li><li>Inject.</li></ol>' +
    '<h3>a. Later</h3><ol><li>Check them.</li></ol>';
  assert.equal(Copy.plainText(html), 'I. Day 0\n1. Weigh the mice.\n2. Inject.\n\na. Later\n1. Check them.');
});

test('plain text keeps the values, separates cells with tabs and decodes entities', () => {
  const html = `<table><tr><th><strong>Buffer</strong></th><th><strong>Volume</strong></th></tr>` +
    `<tr><td>PBS &amp; EDTA</td><td>${B('50 µL')}</td></tr></table>`;
  assert.equal(Copy.plainText(html), 'Buffer\tVolume\nPBS & EDTA\t50 µL');
});

test('plain text of a whole document keeps the separator line', () => {
  const html = Seal.document([{ title: 'Day 0', sections: [{ title: 'Injection', steps: ['Inject.'] }] }]);
  assert.equal(Copy.plainText(html), `${'-'.repeat(184)}\nI. Day 0\na. Injection\n1. Inject.`);
});
