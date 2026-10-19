import test from 'node:test';
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { buildRequest, createShadowAdapter, MODEL } from '../ifttt-decisions-shadow-20261016/adapter.mjs';

const NOW = '2026-10-16T12:00:00.000Z';
const config = { enabled: true, maxRequests: 12, maxInputTokens: 500_000, maxEstimatedUsd: 1, timeoutMs: 50 };
const input = () => ({ source: { id: 'post', authorId: 'reporter', url: 'https://example.test/post',
  text: '🏒 A will not play. B may play if cleared.', publishedAt: '2026-10-16T11:00:00Z', ingestedAt: NOW },
  claims: [{ id: 'a', sourceId: 'post', playerId: 'A', statement: 'A will not play.', sourceSpan: { start: 3, end: 19, quote: 'A will not play.' } },
    { id: 'b', sourceId: 'post', playerId: 'B', statement: 'B may play if cleared.', sourceSpan: { start: 20, end: 42, quote: 'B may play if cleared.' } }] });
// Compute exact offsets so fixtures themselves do not conflate code points and UTF-16 offsets.
function evidence() { const x = input(); for (const c of x.claims) { c.sourceSpan.start = x.source.text.indexOf(c.sourceSpan.quote); c.sourceSpan.end = c.sourceSpan.start + c.sourceSpan.quote.length; } return x; }
function reply(request) { return { requestId: 'independent-offline-probe', body: { model: MODEL, usage: { input_tokens: 123 }, answers: request.questions.map(q => q.type === 'predicate' ? { name: q.name, type: q.type, probability: .6 } : { name: q.name, type: q.type, choice: q.choices[0].value, confidence: .7, probabilities: q.choices.map((c, i) => ({ value: c.value, probability: i === 0 ? 1 : 0 })) }) } }; }
const adapter = (transport = async r => reply(r), options = {}) => createShadowAdapter({ config, now: () => NOW, transport, ...options });
const hash = x => createHash('sha256').update(JSON.stringify(x)).digest('hex');

for (const value of [undefined, null, {}, {source: null}, {source: []}]) test(`invalid root ${JSON.stringify(value)} is fail-closed`, async () => { let calls = 0; const r = await adapter(async () => { calls++; }).evaluate(value); assert.equal(r.status, 'invalid_input'); assert.equal(calls, 0); });

test('disabled adapter does not inspect untrusted input or call transport', async () => { let calls = 0; const trap = new Proxy({}, {get() { throw new Error('must not read'); }}); const r = await createShadowAdapter({ transport: () => { calls++; }, now: () => NOW }).evaluate(trap); assert.equal(r.status, 'disabled'); assert.equal(calls, 0); });

test('Unicode UTF-16 quote binding rejects code-point offsets without losing good neighbors', async () => { const x = evidence(); x.claims[0].sourceSpan.start--; x.claims[0].sourceSpan.end--; const r = await adapter().evaluate(x); assert.equal(r.status, 'partial_or_unknown'); assert.equal(r.audit.invalidClaims[0].reason, 'source_quote_mismatch'); assert.equal(r.audit.claimBindings[0].claimId, 'b'); assert.deepEqual(r.audit.claimBindings[0].questionNames, ['claim_0_support', 'claim_0_wording']); });

test('request hashes and question bindings change with actual candidate/source evidence', async () => { const x = evidence(); const first = await adapter().evaluate(x); for (const change of [y => {y.source.text += ' Correction.';}, y => {y.claims[0].statement = 'A will play.';}, y => {y.claims[0].playerId = 'wrong-player';}, y => {y.claims.reverse();}]) { const y = evidence(); change(y); const next = await adapter().evaluate(y); assert.notEqual(first.audit.requestHash, next.audit.requestHash); assert.notEqual(first.audit.idempotencyKey, next.audit.idempotencyKey); const built = buildRequest(y); assert.equal(next.audit.requestHash, hash(built.request)); assert.equal(next.audit.evidenceHash, hash(built.evidence)); } });

test('99-claim limit retains overflow as unknown and triage remains independent', () => { const x = evidence(); x.claims = Array.from({length: 101}, (_, i) => ({...x.claims[0], id: `claim-${i}`})); const built = buildRequest(x); assert.equal(built.evidence.claims.length, 99); assert.equal(built.request.questions.length, 199); assert.equal(built.invalidClaims.length, 2); assert.ok(built.invalidClaims.every(x => x.reason === 'claim_limit')); assert.equal(built.request.questions[0].name, 'post_material_news'); });

test('all rejected candidates still produce triage and review reasons', async () => { const x = evidence(); x.claims.forEach(c => {c.sourceId = 'other-source';}); const r = await adapter().evaluate(x); assert.equal(r.results.length, 1); assert.equal(r.results[0].status, 'scored'); assert.equal(r.audit.invalidClaims.length, 2); for (const expected of ['invalid_claim_binding', 'zero_claim_post_requires_sampling_or_review', 'uncalibrated_shadow_only']) assert.ok(r.reviewReasons.includes(expected)); });

const corruptions = {
  'null body': r => { r.body = null; },
  'answers is object': r => { r.body.answers = {}; },
  'null answer': r => { r.body.answers[1] = null; },
  'foreign name': r => { r.body.answers[1].name = 'claim_999_support'; },
  'missing name': r => { delete r.body.answers[1].name; },
  'wrong answer type': r => { r.body.answers[1].type = 'predicate'; },
  'missing distribution': r => { delete r.body.answers[1].probabilities; },
  'duplicate distribution label': r => { r.body.answers[1].probabilities[1].value = r.body.answers[1].probabilities[0].value; },
  'foreign choice': r => { r.body.answers[1].choice = 'safe_to_publish'; },
  'string confidence': r => { r.body.answers[1].confidence = '0.9'; },
  'over-one confidence': r => { r.body.answers[1].confidence = 1.01; },
  'negative probability': r => { r.body.answers[1].probabilities[1].probability = -.1; },
  'sum above one': r => { r.body.answers[1].probabilities[1].probability = .1; },
};
for (const [name, mutate] of Object.entries(corruptions)) test(`malformed response: ${name}`, async () => { const r = await adapter(async request => { const result = reply(request); mutate(result); return result; }).evaluate(evidence()); assert.ok(['partial_or_unknown', 'unknown'].includes(r.status)); assert.ok(r.results.length === 0 || r.results[1].status === 'unknown'); });

for (const p of [-1, 1.01, Infinity, NaN, '0.8', null]) test(`predicate rejects ${String(p)} (${typeof p})`, async () => { const r = await adapter(async request => { const result = reply(request); result.body.answers[0].probability = p; return result; }).evaluate(evidence()); assert.equal(r.results[0].status, 'unknown'); assert.equal(r.results[1].status, 'scored'); });

test('shuffled answers are bound by exact question names; refusals stay local', async () => { const r = await adapter(async request => { const result = reply(request); result.body.answers[3] = { name: 'claim_1_support', type: 'refusal' }; result.body.answers.reverse(); return result; }).evaluate(evidence()); assert.equal(r.results[0].name, 'post_material_news'); assert.equal(r.results[1].status, 'scored'); assert.equal(r.results[3].reason, 'refusal'); assert.equal(r.results[4].status, 'scored'); });

test('input, transport request, calibration and returned result mutations do not contaminate stored snapshots', async () => { const x = evidence(); const calibration = { version: 'probe-only', developmentDatasetHash: 'synthetic-probe-only', frozenAt: NOW, postMaterialMinProbability: .8 }; let release; let started; const startedPromise = new Promise(r => { started = r; }); let originalRequest;
  const a = adapter(async request => { originalRequest = structuredClone(request); started(); await new Promise(r => {release = r;}); const result = reply(request); request.input = 'tampered'; request.questions[0].instructions = 'tampered'; return result; }, { calibration });
  const original = structuredClone(x); const pending = a.evaluate(x); await startedPromise; x.source.text = 'changed during request'; x.claims[0].sourceSpan.quote = 'changed'; calibration.postMaterialMinProbability = .01; release(); const first = await pending;
  assert.equal(first.audit.requestHash, hash(originalRequest)); assert.equal(first.audit.calibration.postMaterialMinProbability, .8); first.audit.claimBindings[0].sourceSpan.quote = 'tampered result'; first.audit.calibration.version = 'tampered result'; first.results[0].probability = 0; const next = await a.evaluate(original); assert.equal(next.results[0].probability, .6); assert.equal(next.audit.calibration.version, 'probe-only'); assert.equal(next.audit.claimBindings[0].sourceSpan.quote, original.claims[0].sourceSpan.quote); const b = a.budget(); b.requests = 999; assert.equal(a.budget().requests, 1);
});

test('timeout keeps reservation and block even if ignored abort later resolves', async () => { let settle; let calls = 0; let signal; const a = adapter((request, options) => { calls++; signal = options.signal; return new Promise(r => {settle = () => r(reply(request));}); }, { config: {...config, timeoutMs: 5} }); const r = await a.evaluate(evidence()); assert.equal(r.reason, 'timeout'); assert.equal(signal.aborted, true); const before = a.budget(); settle(); await new Promise(r => setTimeout(r, 5)); assert.deepEqual(a.budget(), before); const other = evidence(); other.source.text += ' Later.'; assert.equal((await a.evaluate(other)).reason, 'budget_blocked_or_period_changed'); assert.equal(calls, 1); });

test('unknown usage preserves reservation even for otherwise valid scores', async () => { const a = adapter(async request => {const r = reply(request); r.body.usage = {input_tokens: '123'}; return r;}); const r = await a.evaluate(evidence()); assert.equal(r.audit.budgetWarning, 'usage_unknown'); assert.equal(r.budget.chargedOrReservedInputTokens, r.audit.reservedInputTokens); assert.equal(r.budget.blocked, true); assert.ok(r.reviewReasons.includes('budget_accounting_warning')); });

test('calibrated zero-claim low score remains a shadow result without automatic action', async () => { const x = evidence(); x.claims = []; const r = await adapter(undefined, {calibration: {version: 'probe-only', developmentDatasetHash: 'synthetic-probe-only', frozenAt: NOW, postMaterialMinProbability: .8}}).evaluate(x); assert.equal(r.audit.mode, 'shadow'); assert.equal(r.results.length, 1); assert.equal(r.results[0].probability, .6); assert.ok(!('assignment' in r)); assert.ok(!('publish' in r)); assert.ok(!r.reviewReasons.includes('material_news_without_extracted_claims')); });
