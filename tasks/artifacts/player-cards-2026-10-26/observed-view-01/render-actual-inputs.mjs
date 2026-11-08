import { createRequire } from 'node:module';
import { readFileSync, writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
import assert from 'node:assert/strict';
const here = path.dirname(fileURLToPath(import.meta.url));
const web = path.resolve(here, '../../../../web');
const require = createRequire(path.join(web, 'package.json'));
const { build } = require('esbuild');
const bundle = path.join(here, 'server-preview.cjs');
await build({ stdin: { contents: `
export { observedCardView } from './lib/player-cards/cardEvidenceVerdict';
import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import ObservedPlayerCard from './components/player-cards/ObservedPlayerCard';
export const renderCard = view => renderToStaticMarkup(React.createElement(ObservedPlayerCard, {view}));
`, resolveDir: web }, outfile: bundle, bundle: true, platform: 'node', format: 'cjs', jsx: 'automatic',
  plugins: [{ name: 'unused-scss', setup(build) { build.onLoad({ filter: /\.scss$/ }, () => ({ contents: 'export default {};', loader: 'js' })); } }],
});
globalThis.fetch = async () => { throw new Error('Offline actual-input rendering; network forbidden'); };
process.chdir(web);
const api = require(bundle);
const dates = JSON.parse(readFileSync(path.join(here, '../history-qualification-01/GAME-DATE-MAP.json'), 'utf8'));
const capturedAt = JSON.parse(readFileSync(path.join(here, '../history-qualification-01/SCHEDULE-RECEIPT.json'), 'utf8')).finishedAt;
const settings = { season: 20262027, gameType: 'regular', strength: 'all', cutoff: '2026-10-24T00:00:00Z', period: { mode: 'appearances', count: 5 }, seasonPolicy: 'season-only-proposed', shortSamplePolicy: 'allow-known-short-proposed', rankPolicy: 'competition-midrank-proposed' };
const batch = { toiUnit: 'seconds', capturedAt, reference: 'NST metric capture absent', readStatus: 'error', identity: { mode: 'row-player-id' }, rows: [] };
const capture = {
  id: `observed-history-${dates.historySha256}-${dates.scheduleSha256}`, capturedAt, settings,
  source: { definition: 'NST count contract; definition unverified', version: 'metric-capture-unavailable', definitionReference: '', verifiedMetrics: [] },
  population: { scope: 'all-nhl', complete: false, reference: '', expectedPlayerIds: [] },
  frames: [{ playerId: 8476453, season: 20262027, gameType: 'regular', dateBasis: 'UTC', completeHistory: false, historyThrough: capturedAt, historyReference: '', appearances: dates.mapping.map(game => ({ playerId: 8476453, gameId: game.gameId, season: 20262027, gameType: 'regular', date: game.utcStartDate, sourceDate: game.sourceGameDate, played: true, completion: { status: 'unverified' } })) }],
  individual: { ...batch, table: 'nst_gamelog_as_counts' }, onIce: { ...batch, table: 'nst_gamelog_as_counts_oi' },
};
const bundleInput = { id: 'unadmitted-public-history', origin: 'local-observed', selection: { playerId: 8476453, ...settings }, history: [], finality: [], definitions: [], populations: [] };
const view = await api.observedCardView(capture, bundleInput, { id: 8476453, name: 'Nikita Kucherov', team: 'TBL' });
assert.ok(view); assert.equal(view.source, 'local-observed'); assert.equal(view.evidenceState, 'incomplete');
assert.equal(view.sample.gp, null); assert.equal(view.exportable, false);
assert.ok(view.readings.every(row => row.value === null && row.rank === null));
assert.ok(!JSON.stringify(view).includes('NST metric capture absent'));
assert.ok(!JSON.stringify(view).includes('unadmitted-public-history'));
writeFileSync(path.join(here, 'OBSERVED-VIEW.json'), JSON.stringify(view, null, 2) + '\n');
writeFileSync(path.join(here, 'OBSERVED-INPUT.json'), JSON.stringify(capture, null, 2) + '\n');
const svg = api.renderCard(view);
writeFileSync(path.join(here, 'observed-card.svg'), svg);
const html = `<!doctype html><html lang="en"><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><meta http-equiv="Content-Security-Policy" content="default-src 'none';style-src 'unsafe-inline';img-src data:;base-uri 'none';object-src 'none'"><title>FHFH observed-input checkpoint</title><style>*{box-sizing:border-box}body{margin:0;background:#111417;color:#f2f1eb;font:18px Arial;padding:24px}main{max-width:1200px;margin:auto}h1{font-size:30px;color:#07aae2}p{line-height:1.5}section{background:#f2f1eb;color:#1a1d21}svg{display:block;width:100%;height:auto}button{font:inherit;min-height:44px;margin:0 12px 16px 0;padding:8px 16px}button:disabled{color:#bfc3c5;background:#34383d;border:1px solid #747b81}summary{min-height:44px;padding-top:12px}code{overflow-wrap:anywhere}@media(max-width:480px){body{padding:12px}h1{font-size:25px}}</style><main><h1>FHFH / Observed-input checkpoint</h1><p>Captured official Kucherov history and schedule identities:11matched entries. Complete-history admission, metric inputs and comparison coverage remain unverified. The11entries are not a verified selected-period GP count.</p><button disabled>Download PNG</button><button disabled>Social Share</button><p role="status">GP unverified. Metric inputs unavailable; export is blocked.</p><section aria-label="Observed card">${svg}</section><details><summary>Readable values and provenance</summary><p>Player identity follows the scoped official NHL request for8476453. Dates are matched by official gameID, season, type, team and opponent. Provider lookup dates and UTC calendar dates are retained separately.</p><p>All12metric values and ranks remain unavailable. No NST counts, xG model or full-NHL population is supplied or substituted. No live or premium activation. Captured${view.capturedAt}; cutoff${settings.cutoff}.</p><p>Official sources: api-web.nhle.com/v1/player/8476453/game-log/20262027/2 and /club-schedule-season/TBL/20262027.</p></details></main></html>`;
writeFileSync(path.join(here, 'preview.html'), html);
console.log(JSON.stringify({ status: 'rendered-observed-with-unknowns', historyEntries: dates.mapping.length, qualifiedValues: 0, ranks: 0, exportBlocked: true, svgBytes: Buffer.byteLength(svg), htmlBytes: Buffer.byteLength(html), networkRequests: 0 }));
