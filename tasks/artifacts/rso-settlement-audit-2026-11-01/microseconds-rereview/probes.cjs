const assert = require('node:assert/strict');
const { normalizeStartChartReadback } = require('../../rso-resume-2026-11-01/release-prep/qualification-capture/normalize-readbacks.ts');
const root = '/Users/tim/Code/fhfhockey.com/tasks/artifacts/rso-resume-2026-11-01/release-prep';
const fixture = () => ({ capture: { date: '2026-11-02', observedAt: '2026-11-03T17:00:00Z', gameIds: [2026020232], settlementVersion: 1 }, issued: [{
  playerId: '1', gameId: '2026020232', target: 'SHOTS_ON_GOAL', gameDate: '2026-11-02', revisionId: 'synthetic', method: 'baseline', codeVersion: 'a'.repeat(40), configurationHash: 'b'.repeat(64), artifactHash: 'c'.repeat(64), horizon: 1,
  participationRevisionId: 'synthetic-participation', cutoffAt: '2026-11-02T22:00:00Z', issuedAt: '2026-11-02T22:05:00Z', scheduledAt: '2026-11-03T00:00:00Z', value: { unconditionalMean: 2.5 } }],
  outcomes: [{ player_id: 1, game_id: 2026020232, shots_es: 2, shots_pp: 1, shots_pk: 0, updated_at: '2026-11-03T03:00:00Z' }] });
const board = i => ({ publishedForecastsEnabled: true, contractVersion: 2, dateUsed: i.capture.date, resolvedDate: i.capture.date, fallbackApplied: false,
  gameRevisions: [{ gameId: 2026020232, revisionId: 'synthetic', modelMode: 'baseline', codeVersion: 'a'.repeat(40), inputCutoff: i.issued[0].cutoffAt }],
  players: [{ player_id: 1, game_id: 2026020232, proj_shots: 2.5, forecast: { expected: { SHOTS_ON_GOAL: 2.5 }, conditioning: 'unconditional' } }] });
const clone = x => JSON.parse(JSON.stringify(x));
async function main() {
  const load = new Function('path', 'return import(path)');
  const { normalizeSettlement } = await load(root + '/qualification-capture/normalize-settlement.mjs');
  const { checkReadbacks: before } = await load(root + '/qualification-readbacks/microseconds-review/before-check-readbacks.mjs');
  const { checkReadbacks: after } = await load(root + '/qualification-readbacks/tooling/check-readbacks.mjs');
  const originalReadback = fixture(); originalReadback.issued[0].issuedAt = '2026-11-02T22:05:00.000002Z';
  const capture = { date: originalReadback.capture.date, gameIds: originalReadback.capture.gameIds, observedAt: '2026-11-02T22:05:00.000001Z' };
  const readbackRows = normalizeStartChartReadback(board(originalReadback), capture);
  const originalInput = { issued: originalReadback.issued, consumers: { start_chart: readbackRows } };
  const readbackBefore = before(originalInput), readbackAfter = after(originalInput);
  assert.equal(readbackBefore.summary.pass, true);
  assert.deepEqual(readbackAfter.summary.findingCodes, { readback_before_issue: 1 });
  assert.equal(readbackRows[0].observedAt, capture.observedAt);
  const originalSettlement = fixture(); originalSettlement.outcomes[0].updated_at = '2026-11-03T00:00:00.000001Z';
  const settledRows = normalizeSettlement(originalSettlement).rows;
  const rb = { ...originalSettlement.issued[0], observedAt: '2026-11-02T23:00:00Z' };
  const settlementInput = { issued: originalSettlement.issued, consumers: { rso: [rb], start_chart: [rb] }, settlement: settledRows };
  const settlementBefore = before(settlementInput), settlementAfter = after(settlementInput);
  assert.equal(settledRows[0].actual, 3);
  assert.deepEqual(settlementBefore.summary.findingCodes, { settlement_before_game: 1 });
  assert.equal(settlementBefore.summary.settled, 0);
  assert.equal(settlementAfter.summary.pass, true); assert.equal(settlementAfter.summary.settled, 1);
  const clean = () => {
    const input = clone(settlementInput);
    input.scope = { protocol: { readback: { consumers: ['rso', 'start_chart'] } } };
    input.issued[0].issuedAt = '2026-11-02T22:05:00.000002Z';
    input.issued[0].scheduledAt = '2026-11-03T00:00:00.000002Z';
    input.settlement[0].recordedAt = '2026-11-03T03:00:00Z';
    return input;
  };
  assert.equal(after(clean()).summary.pass, true);
  const boundaryCases = [];
  for (const boundary of ['cutoff_issue', 'issue_start', 'readback_issue', 'readback_start', 'settlement_start']) {
    for (const digit of [1, 2, 3]) {
      const input = clean(); const issue = `2026-11-02T22:05:00.00000${digit}Z`, start = `2026-11-03T00:00:00.00000${digit}Z`;
      let expected;
      if (boundary === 'cutoff_issue') {
        input.issued[0].cutoffAt = issue;
        for (const rows of Object.values(input.consumers)) rows[0].cutoffAt = issue;
        expected = digit <= 2;
      } else if (boundary === 'issue_start') {
        input.issued[0].issuedAt = start;
        for (const rows of Object.values(input.consumers)) rows[0].observedAt = start;
        expected = digit < 2;
      } else if (boundary === 'readback_issue') {
        for (const rows of Object.values(input.consumers)) rows[0].observedAt = `2026-11-02T17:05:00.00000${digit}-05:00`;
        expected = digit >= 2;
      } else if (boundary === 'readback_start') {
        for (const rows of Object.values(input.consumers)) rows[0].observedAt = start;
        expected = digit < 2;
      } else { input.settlement[0].recordedAt = start; expected = digit > 2; }
      const result = after(input);
      assert.equal(result.summary.pass, expected, boundary + ':' + digit);
      if (boundary === 'settlement_start') assert.equal(result.summary.settled, expected ? 1 : 0);
      JSON.stringify(result);
      boundaryCases.push({ boundary, relativeMicroseconds: digit - 2, expectedPass: expected, summary: result.summary });
    }
  }
  const bad = [undefined, null, 0, false, [], {}, 'not-a-date', '2026-11-02T22:00:00', '2026-11-31T22:00:00Z', '2027-02-29T22:00:00Z', '2026-11-02T22:00:00.1234567Z'];
  const invalidCases = [];
  for (const field of ['cutoffAt', 'issuedAt', 'scheduledAt', 'observedAt', 'recordedAt']) for (const value of bad) {
    const input = clean();
    if (field === 'observedAt') input.consumers.rso[0][field] = value;
    else if (field === 'recordedAt') input.settlement[0][field] = value;
    else input.issued[0][field] = value;
    const result = after(input); assert.equal(result.summary.pass, false, field + ':' + String(value));
    if (field === 'recordedAt' || field === 'scheduledAt') assert.equal(result.summary.settled, 0);
    invalidCases.push({ field, value: value === undefined ? 'undefined' : value, findings: result.summary.findingCodes });
  }
  const sameInstant = clean();
  sameInstant.issued[0].cutoffAt = '2026-11-02T17:05:00.000002-05:00';
  for (const rows of Object.values(sameInstant.consumers)) {
    rows[0].cutoffAt = sameInstant.issued[0].cutoffAt; rows[0].observedAt = '2026-11-02T17:05:00.000002-05:00';
  }
  assert.equal(after(sameInstant).summary.pass, true);
  const leap = clean();
  leap.issued[0].cutoffAt = '2028-02-29T10:00:00.123456Z'; leap.issued[0].issuedAt = '2028-02-29T10:00:00.123457Z'; leap.issued[0].scheduledAt = '2028-02-29T11:00:00Z';
  for (const rows of Object.values(leap.consumers)) { rows[0].cutoffAt = leap.issued[0].cutoffAt; rows[0].observedAt = '2028-02-29T05:00:00.123457-05:00'; }
  leap.settlement[0].recordedAt = '2028-02-29T11:00:00.000001Z'; assert.equal(after(leap).summary.pass, true);
  console.log(JSON.stringify({ timezone: process.env.TZ, originalReadback: { issuedAt: originalReadback.issued[0].issuedAt, observedAt: readbackRows[0].observedAt, before: readbackBefore.summary, after: readbackAfter.summary },
    originalSettlement: { scheduledAt: originalSettlement.issued[0].scheduledAt, recordedAt: settledRows[0].recordedAt, actual: settledRows[0].actual, before: settlementBefore.summary, after: settlementAfter.summary },
    boundaryCases, invalidCases, equivalentOffsetAccepted: true, leapDaySixDigitAccepted: true, reportSerializationPassed: true }, null, 2));
}
main().catch(error => { console.error(error); process.exitCode = 1; });
