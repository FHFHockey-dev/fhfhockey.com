import { createRequire } from 'node:module';
import { readFileSync, writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';

const here = path.dirname(fileURLToPath(import.meta.url));
const repo = path.resolve(here, '../../../..');
const web = path.join(repo, 'web');
const require = createRequire(path.join(web, 'package.json'));
const { buildSync } = require('esbuild');
const pinned = JSON.parse(readFileSync(path.join(here, 'SOURCE-PINS.json'), 'utf8'));
const sha = p => createHash('sha256').update(readFileSync(p)).digest('hex');
for (const pin of pinned) assert.equal(sha(path.join(repo, pin.path)), pin.sha256, pin.path);

globalThis.fetch = async () => { throw new Error('Offline reconciliation: network forbidden'); };
const code = buildSync({ stdin: { contents: `
export { loadAdmittedEvidence } from './lib/player-cards/evidenceLoader';
export { cardEvidenceVerdict, unclaimedBundle, clientEvidence } from './lib/player-cards/cardEvidenceVerdict';
export { buildInteractionFixture } from './lib/player-cards/interactionFixtures';
export { flowSettings, INITIAL_FLOW } from './lib/player-cards/interactionSnapshot';
`, resolveDir: web }, bundle: true, platform: 'node', format: 'esm', write: false }).outputFiles[0].text;
const api = await import(`data:text/javascript;base64,${Buffer.from(code).toString('base64')}`);
process.chdir(web);
const root = path.join(web, 'lib/player-cards/__fixtures__/retained');
const observed = await api.loadAdmittedEvidence({ root, origin: 'local-observed' });
assert.equal(observed.receipts.length, 5);
assert.deepEqual(observed.issues, []);
assert.ok(observed.receipts.every(r => r.kind === 'game-finality' && r.subject.sourceClass === 'ingestion-completion'));
const input = api.buildInteractionFixture(api.flowSettings(api.INITIAL_FLOW), api.INITIAL_FLOW.scenario, api.INITIAL_FLOW.playerId);
const verdict = await api.cardEvidenceVerdict(input, api.unclaimedBundle(input, api.INITIAL_FLOW.playerId, 'studio-preview'));
assert.equal(verdict.state, 'incomplete');
assert.equal(verdict.liveActivation, false);
assert.equal(verdict.premiumActivation, false);
assert.deepEqual(api.clientEvidence(verdict), { state: 'incomplete' });
assert.ok(Object.values(verdict.metrics).every(state => state === 'incomplete'));
assert.ok(['appearance-history-missing', 'game-finality-missing', 'metric-definition-missing', 'population-membership-missing'].every(code => verdict.issueCodes.includes(code)));
for (const pin of pinned) assert.equal(sha(path.join(repo, pin.path)), pin.sha256, pin.path);
const result = {
  at: new Date().toISOString(),
  observedAdmission: { receiptCount: observed.receipts.length, kinds: [...new Set(observed.receipts.map(r => r.kind))], sourceClasses: [...new Set(observed.receipts.map(r => r.subject.sourceClass))], loadIssues: observed.issues },
  actualGameEndsVerified: false, historyVerified: false, metricDefinitionsVerified: false, populationVerified: false,
  currentPageInput: 'Existing fabricated fixture; no actual player statistics loaded',
  currentPageVerdict: verdict, currentPageProps: { evidence: api.clientEvidence(verdict) },
  currentExportScope: 'Existing shareExport assertCardExport requires snapshot.source === synthetic; this check does not expand that scope',
  sourceFilesPreserved: pinned.length, productionRequests: 0, providerRequests: 0,
};
writeFileSync(path.join(here, 'CURRENT-EVIDENCE-CHECK.json'), JSON.stringify(result, null, 2) + '\n');
console.log(JSON.stringify(result));
