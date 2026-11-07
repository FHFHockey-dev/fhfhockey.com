const fs = require('node:fs'), assert = require('node:assert/strict'), crypto = require('node:crypto');
const { createRequire } = require('node:module');
const web = '/Users/tim/Code/fhfhockey.com/web', req = createRequire(web + '/package.json');
const ts = req('typescript'), React = req('react'), { renderToStaticMarkup } = req('react-dom/server'), { JSDOM } = req('jsdom');
for (const ext of ['.ts', '.tsx']) require.extensions[ext] = (m, f) => m._compile(ts.transpileModule(fs.readFileSync(f, 'utf8'), { compilerOptions: { target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.CommonJS, jsx: ts.JsxEmit.React, esModuleInterop: true } }).outputText, f);
require.extensions['.scss'] = m => m.exports = {};
const { CurrentBlshPlayerDetail } = req('./components/buyLowSellHigh/BlshPlayerDetail.tsx');
const { parseCurrentResearchSnapshot } = req('./lib/buyLowSellHigh/researchSnapshot.ts');
const bytes = fs.readFileSync(web + '/lib/buyLowSellHigh/research-snapshots/2026-10-28.arm-a-canonical-repaired.v2.json');
assert.equal(crypto.createHash('sha256').update(bytes).digest('hex'), '2f380c2539390f6931ec92ab1d0b1d8cced2b55f5f4cefb8c6e88a694909f2c8');
const s = parseCurrentResearchSnapshot(JSON.parse(bytes)), before = JSON.stringify(s);
const cases = [...new Set(['Brent Burns', 'Justin Dowling', 'Jamie Benn'].map(name => s.profiles.find(p => p.displayName === name)).concat([
  s.profiles.find(p => p.tracks.length && p.evidence.window.games === 1),
  s.profiles.find(p => p.tracks.length && p.evidence.reference.personalGames === 0),
]))];
assert(cases.every(Boolean));
const results = [];
for (const p of cases) {
  const html = renderToStaticMarkup(React.createElement(CurrentBlshPlayerDetail, { id: 'review-' + p.playerId, profile: p, snapshot: s, onClose() {} }));
  const dom = new JSDOM(html), doc = dom.window.document, table = doc.querySelector('table[aria-label="Three-track production breakdown"]'), w = p.evidence.window;
  if (p.tracks.length) {
    assert(table);
    assert.equal(table.querySelector('caption').textContent, `${w.games} recorded ${w.games === 1 ? 'appearance' : 'appearances'} · ${w.minutes.toFixed(2)} total minutes. All values are totals in each row’s units.`);
    assert([...table.querySelectorAll('thead th')].every(t => t.getAttribute('scope') === 'col'));
    assert([...table.querySelectorAll('tbody th')].every(t => t.getAttribute('scope') === 'row'));
    for (const [i, tr] of [...table.querySelectorAll('tbody tr')].entries()) {
      const t = p.tracks[i];
      assert.deepEqual([...tr.querySelectorAll('td')].map(x => x.textContent), [t.observed.toFixed(2), t.referenceAtCurrentTOI.toFixed(2), t.supportConditioned.toFixed(2), (t.gap > 0 ? '+' : '') + t.gap.toFixed(4)]);
    }
    const explanation = [...doc.querySelectorAll('h3')].find(h => h.textContent === 'Production totals across the selected games').parentElement;
    assert.equal(explanation.closest('details'), null);
    assert(explanation.textContent.includes(`${w.games} recorded ${w.games === 1 ? 'appearance' : 'appearances'}`));
    assert(explanation.textContent.includes('not per-game averages'));
    assert(explanation.textContent.includes('not a forecast or proof of good or bad luck'));
    assert([...doc.querySelectorAll('svg')].every(svg => svg.getAttribute('aria-hidden') === 'true' && svg.getAttribute('focusable') === 'false'));
    assert.equal(doc.querySelectorAll('figure').length, 3);
  } else {
    assert.equal(table, null); assert.equal(doc.querySelectorAll('figure').length, 0);
  }
  assert(doc.body.textContent.includes('A low or high total across five games does not establish five consecutive cold or hot games'));
  assert.equal(p.claims.forecast, false); assert.equal(p.claims.trusted, false);
  results.push({ playerId: p.playerId, name: p.displayName, appearances: w.games, minutes: w.minutes, personalReferenceGames: p.evidence.reference.personalGames, score: p.score.value, list: p.score.list, tablePresent: !!table, caption: table?.querySelector('caption').textContent ?? null, fp: p.tracks[0] ?? null });
  fs.writeFileSync(`${__dirname}/${p.playerId}.html`, html); dom.window.close();
}
assert.equal(JSON.stringify(s), before);
let maxResidual = 0;
for (const p of s.profiles) {
  if (p.tracks.length) {
    assert.equal(p.evidence.window.minutes, p.evidence.window.seconds / 60);
    assert.equal(p.evidence.window.games, p.evidence.window.dates.length);
  }
  for (const t of p.tracks) {
    const residual = Math.abs((t.supportConditioned - t.observed) - t.gap);
    maxResidual = Math.max(maxResidual, residual); assert(residual < 1e-9);
  }
}
const result = { cases: results, totalProfiles: s.profiles.length, numeric: s.counts.numeric, counts: s.counts, allNumericExposuresAndGapSignsChecked: true, maxNativeGapResidual: maxResidual, snapshotObjectUnchanged: true,
  visibility: 'Production explanation and caption outside disclosures; comparison remains optional native details', accessibility: 'Scoped headers, caption, equivalent text and decorative nonfocusable SVG verified; no live assistive-technology session',
  harnessCorrection: 'Initial ad hoc verifier used Document.textContent (null); corrected to document.body.textContent. No product change.' };
fs.writeFileSync(`${__dirname}/RENDER-RESULT.json`, JSON.stringify(result, null, 2) + '\n');
console.log(JSON.stringify({ cases: results.map(({ fp, ...r }) => r), totalProfiles: result.totalProfiles, maxNativeGapResidual: maxResidual, snapshotObjectUnchanged: true }, null, 2));
