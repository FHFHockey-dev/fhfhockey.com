import test from 'node:test';
import assert from 'node:assert/strict';
import { buildRequest, createShadowAdapter, MODEL } from '../adapter.mjs';

const NOW = '2026-10-16T12:00:00.000Z';
const input = () => ({
  source: { id: 'post-1', authorId: 'reporter-1', url: 'https://example.test/post/1',
    text: 'Player A is out. Player B could return.', publishedAt: '2026-10-16T11:00:00Z', ingestedAt: NOW },
  claims: [
    { id: 'claim-A', sourceId: 'post-1', playerId: 'player-A', statement: 'Player A is out.', sourceSpan: { start: 0, end: 16, quote: 'Player A is out.' } },
    { id: 'claim-B', sourceId: 'post-1', playerId: 'player-B', statement: 'Player B could return.', sourceSpan: { start: 17, end: 39, quote: 'Player B could return.' } },
  ],
});
// All probabilities below are synthetic parser/flow fixtures, not model evaluations.
function reply(request) {
  return { requestId: 'offline-fixture', body: { model: MODEL, usage: { input_tokens: 1_000 },
    answers: request.questions.map(q => q.type === 'predicate'
      ? { name: q.name, type: 'predicate', probability: 0.88 }
      : { name: q.name, type: 'choice', choice: q.choices[0].value, confidence: 0.8,
        probabilities: q.choices.map((option, index) => ({ value: option.value, probability: index === 0 ? 1 : 0 })) }) } };
}
const config = { enabled: true, maxRequests: 20, maxInputTokens: 200_000, maxEstimatedUsd: 1 };
const adapter = (transport = async request => reply(request), extra = {}) => createShadowAdapter({ config, transport, now: () => NOW, ...extra });

test('default off never invokes transport', async () => {
  let calls = 0;
  const a = createShadowAdapter({ transport: async () => { calls++; }, now: () => NOW });
  assert.equal((await a.evaluate(input())).status, 'disabled');
  assert.equal(calls, 0);
});

test('enabled without explicit positive budgets remains blocked', async () => {
  const a = adapter(async () => assert.fail('must not call'), { config: { enabled: true } });
  assert.equal((await a.evaluate(input())).reason, 'budget_exhausted');
});

test('request uses per-claim questions plus independent whole-post triage', () => {
  const built = buildRequest(input());
  assert.equal(built.request.model, MODEL);
  assert.equal(built.request.questions.length, 5);
  assert.deepEqual(built.request.questions.map(q => q.name), ['post_material_news', 'claim_0_support', 'claim_0_wording', 'claim_1_support', 'claim_1_wording']);
  assert.equal(JSON.parse(built.request.input).claims[1].playerId, 'player-B');
});

test('bad claim bindings are withheld while post and valid-claim scoring continue', async () => {
  for (const change of [
    value => { value.claims[0].sourceId = 'wrong'; },
    value => { value.claims[0].sourceSpan.quote = 'fabricated'; },
    value => { value.claims[1].id = value.claims[0].id; },
  ]) {
    const value = input(); change(value);
    const result = await adapter().evaluate(value);
    assert.equal(result.status, 'partial_or_unknown');
    assert.equal(result.audit.invalidClaims.length, 1);
    assert.equal(result.results[0].name, 'post_material_news');
    assert.equal(result.results[0].status, 'scored');
    assert.ok(result.reviewReasons.includes('invalid_claim_binding'));
  }
});

test('invalid source timestamp prevents any request', async () => {
  const value = input(); value.source.publishedAt = '2027-01-01T00:00:00Z';
  const result = await adapter(async () => assert.fail('invalid source must not be sent')).evaluate(value);
  assert.equal(result.status, 'invalid_input');
});

test('claim question bindings remain correct after an earlier claim is rejected', () => {
  const value = input(); value.claims[0].sourceSpan.quote = 'wrong';
  const built = buildRequest(value);
  assert.equal(built.evidence.claims[0].id, 'claim-B');
  assert.match(built.request.questions[1].instructions, /claims\[0\]/);
  assert.equal(built.evidence.claims[0].inputIndex, 1);
});

test('invalid claims array preserves source-only triage', async () => {
  const value = input(); value.claims = null;
  const result = await adapter().evaluate(value);
  assert.equal(result.results.length, 1);
  assert.equal(result.audit.invalidClaims[0].reason, 'invalid_claims_array');
});

test('built requests cannot mutate future question definitions', () => {
  const first = buildRequest(input());
  first.request.questions[1].choices[0].description = 'tampered';
  assert.notEqual(buildRequest(input()).request.questions[1].choices[0].description, 'tampered');
});

test('source/claim objects are unmodified; unrecognized fields never sent', async () => {
  const value = input(); value.source.secret = 'do-not-forward';
  const copy = structuredClone(value);
  const a = adapter(async request => { assert.ok(!JSON.stringify(request).includes('do-not-forward')); return reply(request); });
  const result = await a.evaluate(value);
  assert.equal(result.status, 'scored');
  assert.deepEqual(value, copy);
  assert.equal(result.audit.claimBindings.length, 2);
  assert.equal(result.audit.usage.inputTokens, 1_000);
  assert.ok(result.reviewReasons.includes('uncalibrated_shadow_only'));
  assert.ok(!('assignment' in result));
});

test('zero-claim post is still evaluated and queued for development review', async () => {
  const value = input(); value.claims = [];
  const result = await adapter().evaluate(value);
  assert.equal(result.results.length, 1);
  assert.equal(result.results[0].probability, 0.88);
  assert.ok(result.reviewReasons.includes('zero_claim_post_requires_sampling_or_review'));
});

test('only explicit frozen calibration can flag material zero-claim posts', async () => {
  const value = input(); value.claims = [];
  // Unit-test threshold only. Not a calibration artifact and never shipped as a default.
  const calibration = { version: 'synthetic-unit-test-only', developmentDatasetHash: 'synthetic-not-real-data', frozenAt: NOW, postMaterialMinProbability: 0.8 };
  const result = await adapter(undefined, { calibration }).evaluate(value);
  assert.ok(result.reviewReasons.includes('material_news_without_extracted_claims'));
  assert.ok(!result.reviewReasons.includes('uncalibrated_shadow_only'));
});

test('per-question refusal does not overwrite other claim results', async () => {
  const result = await adapter(async request => {
    const r = reply(request); r.body.answers[1] = { name: 'claim_0_support', type: 'refusal' }; return r;
  }).evaluate(input());
  assert.equal(result.status, 'partial_or_unknown');
  assert.equal(result.results[1].reason, 'refusal');
  assert.equal(result.results[3].status, 'scored');
});

test('different wording labels in one tweet remain independent per claim', async () => {
  const result = await adapter(async request => {
    const r = reply(request);
    for (const [name, choice] of [['claim_0_wording', 'direct_assertion'], ['claim_1_wording', 'speculation']]) {
      const answer = r.body.answers.find(a => a.name === name);
      answer.choice = choice;
      answer.probabilities = answer.probabilities.map(p => ({ ...p, probability: p.value === choice ? 1 : 0 }));
    }
    return r;
  }).evaluate(input());
  assert.equal(result.results.find(r => r.name === 'claim_0_wording').choice, 'direct_assertion');
  assert.equal(result.results.find(r => r.name === 'claim_1_wording').choice, 'speculation');
});

test('missing, duplicate and invalid probability values are unknown', async () => {
  for (const mutate of [
    answers => answers.splice(1, 1),
    answers => answers.push(structuredClone(answers[1])),
    answers => { answers[1].probabilities[0].probability = NaN; },
    answers => { answers[1].probabilities[0].probability = 0.4; },
  ]) {
    const result = await adapter(async request => { const r = reply(request); mutate(r.body.answers); return r; }).evaluate(input());
    assert.equal(result.results[1].status, 'unknown');
  }
});

test('foreign question names or wrong model cannot be bound to a claim', async () => {
  for (const mutate of [r => { r.body.answers[0].name = 'foreign_claim'; }, r => { r.body.model = 'wrong-model'; }]) {
    const result = await adapter(async request => { const r = reply(request); mutate(r); return r; }).evaluate(input());
    assert.ok(result.results.every(answer => answer.status === 'unknown'));
  }
});

test('same evidence and version are deduplicated, including concurrent calls', async () => {
  let calls = 0;
  const a = adapter(async request => { calls++; return reply(request); });
  const [first, second] = await Promise.all([a.evaluate(input()), a.evaluate(input())]);
  assert.equal(calls, 1);
  assert.equal(first.audit.idempotencyKey, second.audit.idempotencyKey);
  first.results[0].probability = 0;
  assert.equal((await a.evaluate(input())).results[0].probability, 0.88);
});

test('request limit reserves before concurrent distinct calls', async () => {
  let calls = 0;
  const a = adapter(async request => { calls++; return reply(request); }, { config: { ...config, maxRequests: 1 } });
  const other = input(); other.source.text += ' More.';
  const results = await Promise.all([a.evaluate(input()), a.evaluate(other)]);
  assert.equal(calls, 1);
  assert.ok(results.some(result => result.reason === 'budget_exhausted'));
});

test('request byte, token and cost limits are independently enforced', async () => {
  for (const override of [{ maxInputBytesPerRequest: 50 }, { maxReservedTokensPerRequest: 50 }, { maxInputTokens: 50 }, { maxEstimatedUsd: 0.000001 }]) {
    const result = await adapter(async () => assert.fail('limit must prevent call'), { config: { ...config, ...override } }).evaluate(input());
    assert.equal(result.status, 'skipped');
  }
});

test('unknown usage or over-reservation usage blocks subsequent requests', async () => {
  for (const usage of [{}, { input_tokens: 100_000 }]) {
    let calls = 0;
    const a = adapter(async request => { calls++; const r = reply(request); r.body.usage = usage; return r; });
    const first = await a.evaluate(input());
    assert.ok(first.audit.budgetWarning);
    const other = input(); other.source.text += ' Update.';
    assert.equal((await a.evaluate(other)).reason, 'budget_blocked_or_period_changed');
    assert.equal(calls, 1);
  }
});

test('transport failure never leaks error secrets or retries automatically', async () => {
  let calls = 0;
  const a = adapter(async () => { calls++; throw new Error('secret-do-not-log'); });
  const result = await a.evaluate(input());
  assert.equal(result.status, 'unknown');
  assert.ok(!JSON.stringify(result).includes('secret-do-not-log'));
  assert.equal(a.budget().blocked, true);
  await a.evaluate(input());
  assert.equal(calls, 1);
});

test('timeout aborts injected transport and retains reservation', async () => {
  let signal;
  const a = adapter(async (_, options) => { signal = options.signal; return new Promise(() => {}); }, { config: { ...config, timeoutMs: 5 } });
  const result = await a.evaluate(input());
  assert.equal(result.reason, 'timeout');
  assert.equal(signal.aborted, true);
  assert.ok(a.budget().chargedOrReservedInputTokens > 0);
});

test('period changes fail closed instead of silently resetting quotas', async () => {
  let time = NOW;
  const a = adapter(async () => assert.fail('new period needs explicit budget reset'), { now: () => time });
  time = '2026-11-01T00:00:00Z';
  assert.equal((await a.evaluate(input())).reason, 'budget_blocked_or_period_changed');
});

test('partial calibration configuration is rejected', () => {
  assert.throws(() => adapter(undefined, { calibration: { postMaterialMinProbability: 0.8 } }), /invalid_calibration/);
});
