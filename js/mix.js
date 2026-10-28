// Antibody mix calculations, following the rules of the lab spreadsheet:
//   volume per test      Vf          (100 µL by default)
//   total volume         Vtotal      = tests × Vf
//   Brilliant Stain Buffer           = Vtotal / 2
//   each antibody                    = Vtotal / dilution
//   PBS                              = Vtotal − BSB − sum of the antibodies
//   single stain                     = Vf / dilution
(function (root) {
  const COLUMNS = [
    ['channel', /^(channel|detector|laser)/i],
    ['fluorochrome', /^(fluoro|fluor|dye|conjugate)/i],
    ['marker', /^(marker|antigen|target|specificity|spec)/i],
    ['clone', /^clone/i],
    ['supplier', /^(supplier|vendor|company|brand|manufacturer)/i],
    ['catalogue', /^(cat|ref|product)/i],
    ['dilution', /^(dilution|dil|titre|titer|final)/i],
  ];

  // "1:200", "1/200", "200" and "0.005" all mean the same dilution.
  function readDilution(cell) {
    if (cell === null || cell === undefined) return null;
    const text = String(cell).trim().replace(',', '.');
    if (!text) return null;
    const ratio = text.match(/^1\s*[:/]\s*([\d.]+)$/);
    if (ratio) return Number(ratio[1]) || null;
    const number = Number(text);
    if (!Number.isFinite(number) || number <= 0) return null;
    return number < 1 ? 1 / number : number;
  }

  // Rows of cells, header included, to antibodies.
  function readPanel(rows) {
    const clean = rows.filter((row) => row.some((cell) => String(cell ?? '').trim()));
    if (!clean.length) return [];
    const header = clean[0].map((cell) => String(cell ?? '').trim());
    const map = {};
    header.forEach((name, index) => {
      const match = COLUMNS.find(([key, test]) => test.test(name) && map[key] === undefined);
      if (match) map[match[0]] = index;
    });
    // Without a dilution column there is nothing to compute.
    if (map.dilution === undefined) return [];
    const at = (row, key) => (map[key] === undefined ? '' : String(row[map[key]] ?? '').trim());
    return clean.slice(1).map((row) => ({
      channel: at(row, 'channel'),
      fluorochrome: at(row, 'fluorochrome'),
      marker: at(row, 'marker'),
      clone: at(row, 'clone'),
      supplier: at(row, 'supplier'),
      catalogue: at(row, 'catalogue'),
      dilution: readDilution(at(row, 'dilution')),
    })).filter((ab) => ab.marker || ab.fluorochrome || ab.dilution);
  }

  const nameOf = (ab) => [ab.marker, ab.fluorochrome].filter(Boolean).join(' ') || 'Antibody';

  // Volumes are pipetted, so two decimals is already more than a pipette can do.
  function round(volume) {
    return Math.round(volume * 100) / 100;
  }

  function computeMix({ antibodies = [], samples = 1, excess = 0, vf = 100 } = {}) {
    const usable = antibodies.filter((ab) => ab.dilution > 0);
    const tests = Math.max(0, samples) * (1 + Math.max(0, excess) / 100);
    const vTotal = tests * vf;
    const bsb = vTotal / 2;
    const rows = usable.map((ab) => ({ name: nameOf(ab), dilution: ab.dilution, volume: round(vTotal / ab.dilution) }));
    const antibodyVolume = rows.reduce((sum, row) => sum + row.volume, 0);
    const pbs = round(vTotal - bsb - antibodyVolume);

    const warnings = [];
    if (!usable.length) warnings.push('No antibody has a dilution yet.');
    if (pbs < 0) warnings.push('The antibodies alone exceed the total volume: check the dilutions.');

    return {
      tests: round(tests),
      vf,
      vTotal: round(vTotal),
      bsb: round(bsb),
      pbs,
      antibodyVolume: round(antibodyVolume),
      rows,
      singleStains: usable.map((ab) => ({ name: nameOf(ab), volume: round(vf / ab.dilution) })),
      warnings,
    };
  }

  const Mix = { readDilution, readPanel, computeMix, nameOf, round, COLUMNS };

  if (typeof module !== 'undefined' && module.exports) module.exports = Mix;
  else root.Mix = Mix;
})(this);
