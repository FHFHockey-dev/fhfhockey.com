const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const source = require('./actual-source.cjs');
const fixture = require('./fixtures.cjs');
const model = source.load('web/lib/projections/goalieModel.ts').computeGoalieProjectionModel;
const gap = source.load('web/lib/sko/gap.ts');
const context = source.load('web/lib/projections/calculators/team-context-adjustments.ts');
const rest = source.load('web/lib/projections/calculators/goalie-save-pct-context.ts');
const interpretation = source.load('web/lib/skoElement/interpret.ts');
const skoFixture = source.load('web/lib/skoElement/fixtures.ts');
const observations = { runtime: process.version, existingCompiler: source.compilerVersion, findings: {} };
const record = (key, value) => { observations.findings[key] = value; };
const plain = value => JSON.parse(JSON.stringify(value));
const close = (a, b) => assert.ok(Math.abs(a - b) < 1e-10, `${a} != ${b}`);
const runGoalie = change => {
  const player = structuredClone(skoFixture.FIXTURE_PLAYERS.find(value => value.key === 'g1'));
  change(player);
  return interpretation.interpretPlayer({ evidence: player.evidence, forecast: player.forecasts[10], config: skoFixture.FIXTURE_CONFIG,
    asOf: skoFixture.FIXTURE_AS_OF, horizon: 10, fixture: true });
};

test('N1: native VuDu units, pooled ratio, zero and invalid-count guards behave as declared', () => {
  close(gap.vuduSaveGap({ expectedSaveProb: 0.91, recentSaves: 90, recentShotsOnNet: 100 }), 1);
  assert.equal(gap.vuduSaveGap({ expectedSaveProb: 0.91, recentSaves: 0, recentShotsOnNet: 0 }), null);
  assert.equal(gap.vuduSaveGap({ expectedSaveProb: null, recentSaves: 9, recentShotsOnNet: 10 }), null);
  assert.throws(() => gap.vuduSaveGap({ expectedSaveProb: 0.91, recentSaves: 11, recentShotsOnNet: 10 }), /exceed/);
  // Either guard can reject a negative denominator; count ordering runs first here.
  assert.throws(() => gap.vuduSaveGap({ expectedSaveProb: 0.91, recentSaves: 0, recentShotsOnNet: -1 }), /exceed|nonnegative/);
  close(gap.rateFromTotals(9 + 36, 10 + 40), 0.9);
  record('N1', { extraSavesPer100: 1, zeroExposure: null, invalidPositiveExposureCountsRejected: true });
});

test('N2: valid conditional goalie counts conserve shots and scale with volume, not starting probability', () => {
  const low = model({ ...fixture.modelInput(), projectedShotsAgainst: 20 });
  const high = model({ ...fixture.modelInput(), projectedShotsAgainst: 40 });
  close(low.projectedSaves + low.projectedGoalsAllowed, 20);
  close(high.projectedSaves + high.projectedGoalsAllowed, 40);
  close(low.modeledSavePct, high.modeledSavePct);
  close(2 * low.projectedSaves, high.projectedSaves);
  const p = model({ ...fixture.modelInput(), starterProbability: 0.2 }), full = model(fixture.modelInput());
  close(p.projectedSaves, full.projectedSaves);
  close(p.projectedGoalsAllowed, full.projectedGoalsAllowed);
  close(p.winProbability, full.winProbability * 0.2);
  close(p.shutoutProbability, full.shutoutProbability * 0.2);
  record('N2', { low, high, lowStarterProbability: p, fullStart: full });
});

test('D1: observed goalie preview accepts saves above on-net shots and inconsistent joint counts', () => {
  const result = runGoalie(player => {
    player.evidence.teamGames = [player.evidence.teamGames.at(-1)];
    player.evidence.teamGames[0].status = 'appeared';
    player.evidence.teamGames[0].goalie = { saves: 31, shotsAgainst: 30, goalsAgainst: 3, minutes: 60 };
  });
  assert.equal(result.diagnostics.invalidRows, 0);
  close(result.goalie.observed.savePercentage.value, 31 / 30);
  assert.equal(result.goalie.observed.saves + result.goalie.observed.goalsAgainst, 34);
  assert.equal(result.goalie.gap.status, 'pending_goalie_adapter');
  record('D1', { observed: result.goalie.observed, diagnostics: result.diagnostics, gap: result.goalie.gap });
});

test('N3: preview rejects negative primitives and keeps missing/zero denominator ratios unavailable', () => {
  const negative = runGoalie(player => {
    player.evidence.teamGames = [player.evidence.teamGames.at(-1)];
    player.evidence.teamGames[0].goalie = { saves: -1, shotsAgainst: 30, goalsAgainst: 3, minutes: 60 };
  });
  assert.equal(negative.diagnostics.invalidRows, 1);
  const missing = runGoalie(player => {
    player.evidence.teamGames = [player.evidence.teamGames.at(-1)];
    player.evidence.teamGames[0].status = 'appeared';
    player.evidence.teamGames[0].goalie = { saves: null, shotsAgainst: 30, goalsAgainst: 3, minutes: 60 };
  });
  assert.equal(missing.goalie.observed.savePercentage.value, null);
  const zero = runGoalie(player => {
    player.evidence.teamGames = [player.evidence.teamGames.at(-1)];
    player.evidence.teamGames[0].status = 'appeared';
    player.evidence.teamGames[0].goalie = { saves: 0, shotsAgainst: 0, goalsAgainst: 0, minutes: 0 };
  });
  assert.equal(zero.goalie.observed.savePercentage.value, null);
  assert.equal(zero.goalie.observed.goalsAgainstAverage.value, null);
});

test('D2: actual evidence reader converts missing goal counts into observed zero', async () => {
  const validDb = source.mockDb(fixture.evidenceResponses([fixture.sourceRow()]));
  const missingDb = source.mockDb(fixture.evidenceResponses([fixture.sourceRow({ goals_allowed: null })]));
  const valid = await source.goalieQueries(validDb).fetchGoalieEvidence(999001, '2026-10-22');
  const missing = await source.goalieQueries(missingDb).fetchGoalieEvidence(999001, '2026-10-22');
  validDb.assertConsumed(); missingDb.assertConsumed();
  assert.equal(missing.recentShotsAgainst, 30);
  assert.equal(missing.recentGoalsAllowed, 0);
  const a = model({ ...fixture.modelInput(), evidence: valid }), b = model({ ...fixture.modelInput(), evidence: missing });
  assert.ok(b.modeledSavePct > a.modeledSavePct);
  record('D2', { validEvidence: valid, missingEvidence: missing, validOutput: a, missingOutput: b, mockedQueries: missingDb.calls });
});

test('D2 control: evidence reader propagates query failure instead of silently producing history', async () => {
  const responses = fixture.evidenceResponses([]); responses[0].error = new Error('synthetic read failed');
  const db = source.mockDb(responses);
  await assert.rejects(source.goalieQueries(db).fetchGoalieEvidence(999001, '2026-10-22'), /synthetic read failed/);
});

test('H1: one real event sample occupies three nested evidence windows; this proves overlap, not a correction', async () => {
  const db = source.mockDb(fixture.evidenceResponses([fixture.sourceRow({ goals_allowed: 2, saves: 28 })]));
  const evidence = await source.goalieQueries(db).fetchGoalieEvidence(999001, '2026-10-22');
  const mass = evidence.recentShotsAgainst + evidence.seasonShotsAgainst + evidence.baselineShotsAgainst;
  assert.equal(mass, 90); // the same fictional 30-shot game returned by all three date windows
  assert.equal(evidence.recentStarts, 1);
  record('H1', { uniqueSyntheticShots: 30, summedWindowMass: mass, evidence, output: model({ ...fixture.modelInput(), evidence }) });
});

test('D3: all observed goalies are materialized; six relief appearances become six starts in workload', async () => {
  const prepare = source.load('web/lib/projections/derived/buildGoalieGameV2.ts').prepareGoalieGameV2;
  const reliefRows = [];
  for (let day = 16; day <= 21; day++) {
    const game = { id: 990000 + day, date: `2026-10-${day}`, homeTeamId: 9901, awayTeamId: 9902 };
    const base = { gameid: game.id, situationcode: '1551', typedesckey: 'shot-on-goal', eventownerteamid: 9901,
      shootingplayerid: 999101, scoringplayerid: null, assist1playerid: null, assist2playerid: null };
    const result = prepare({ game, plays: [{ ...base, id: 1, goalieinnetid: 999001 }, { ...base, id: 2, goalieinnetid: 999002 }] });
    assert.equal(result.rows.length, 2);
    reliefRows.push(result.rows.find(row => row.goalie_id === 999002));
  }
  const db = source.mockDb([{ table: 'forge_goalie_game', data: reliefRows.map(row => ({ game_date: row.game_date })) }]);
  const workload = await source.goalieQueries(db).fetchGoalieWorkloadContext(999002, '2026-10-22');
  assert.equal(workload.startsLast14Days, 6);
  assert.equal(workload.isGoalieBackToBack, true);
  close(rest.computeWorkloadSavePctPenalty(workload), 0.07);
  record('D3', { syntheticGroundTruth: 'Six appearances by a designated relief goalie; no start flags exist in materialized rows.',
    materializedSample: reliefRows[0], workload, savePctPenalty: rest.computeWorkloadSavePctPenalty(workload), query: db.calls });
});

test('D4: unknown last-start date selects the populated 4-plus rest bucket', () => {
  const profile = { savePctByBucket: { '0': 0.9, '1': 0.9, '2': 0.9, '3': 0.9, '4_plus': 0.94 },
    gamesByBucket: { '0': 10, '1': 10, '2': 10, '3': 10, '4_plus': 10 } };
  const unknown = rest.computeGoalieRestSplitSavePctAdjustment({ profile, daysSinceLastStart: null });
  const knownLongRest = rest.computeGoalieRestSplitSavePctAdjustment({ profile, daysSinceLastStart: 4 });
  assert.equal(rest.toGoalieRestSplitBucket(null), '4_plus');
  assert.equal(unknown, knownLongRest); assert.ok(unknown > 0);
  record('D4', { unknownRestAdjustment: unknown, knownLongRestAdjustment: knownLongRest });
});

test('D5: empty historical team prior read falls back to a future-dated row', async () => {
  const db = source.mockDb([{ table: 'nhl_team_data', data: [] }, { table: 'nhl_team_data', data: [
    { date: '2026-10-23', games_played: 10, xga: 34, xga_per_game: 3.4, xgf_per_game: 2.95 },
  ] }]);
  const prior = await source.teamQueries(db).fetchTeamStrengthPrior('SYN', '2026-10-22', 9901);
  assert.equal(prior.sourceDate, '2026-10-23');
  assert.equal(db.calls[1].operations.some(value => ['lt', 'lte'].includes(value.operation)), false);
  const adjustment = context.computeTeamStrengthContextAdjustment({ defendingTeamPrior: prior, opponentTeamPrior: fixture.prior() });
  assert.ok(adjustment.shotsAgainstPctAdjustment > 0);
  record('D5', { requestedAsOf: '2026-10-22', returnedPrior: prior, resultingAdjustment: adjustment, queries: db.calls });
});

test('N4: NST xGA-per-60 is derived in minutes, with missing exposure unavailable', async () => {
  const read = async toi => {
    const db = source.mockDb([{ table: 'nst_team_all', data: { date: '2026-10-21', gp: 10, xga: 25, toi } }]);
    return source.teamQueries(db).fetchTeamNstExpectedGoalsProfile('SYN', '2026-10-22');
  };
  assert.equal((await read(600)).xgaPer60, 2.5);
  assert.equal((await read(null)).xgaPer60, null);
  assert.equal((await read(0)).xgaPer60, null);
});

test('N5/H2: aggregate xGA denominator is unblocked; substituting it for on-net shots changes VuDu', () => {
  const aggregate = source.load('web/lib/xg/aggregates.ts').buildXgAggregates;
  const semantics = source.load('web/lib/rankings/xgDenominatorSemantics.ts');
  const base = { model_version: 'synthetic-model', prediction_type: 'shot_goal', feature_version: 1,
    game_id: 990001, season_id: 20262027, game_date: '2026-10-21', event_owner_team_id: 9901,
    shooter_player_id: 999101, goalie_in_net_id: 999001, model_approved: true };
  // Synthetic truth: one save, one goal, one miss; all three are unblocked prediction events.
  const result = aggregate([{ ...base, event_id: 1, label: false, xg: 0.1 },
    { ...base, event_id: 2, label: true, xg: 0.2 }, { ...base, event_id: 3, label: false, xg: 0.4 }],
    [{ id: 990001, seasonId: 20262027, date: '2026-10-21', homeTeamId: 9901, awayTeamId: 9902 }], { generatedAt: '2026-10-22T00:00:00Z' });
  const row = result.goalieGameRows[0];
  const prepare = source.load('web/lib/projections/derived/buildGoalieGameV2.ts').prepareGoalieGameV2;
  const onNet = prepare({ game: { id: 990001, date: '2026-10-21', homeTeamId: 9901, awayTeamId: 9902 },
    plays: ['shot-on-goal', 'goal', 'missed-shot'].map((type, i) => ({ id: i + 1, gameid: 990001, situationcode: '1551',
      typedesckey: type, eventownerteamid: 9901, shootingplayerid: 999101, scoringplayerid: type === 'goal' ? 999101 : null,
      assist1playerid: null, assist2playerid: null, goalieinnetid: 999001 })) }).rows[0];
  assert.equal(row.shots_against, 3); close(row.xg_against, 0.7);
  assert.equal(onNet.shots_against, 2); assert.equal(onNet.saves, 1); assert.equal(onNet.goals_allowed, 1);
  assert.equal(semantics.XG_SHOT_UNIVERSE, 'fenwick_unblocked');
  close(semantics.calculateGoalieXgaPerUnblockedAttempt({ xgAgainst: row.xg_against, fenwickAgainst: 3 }), 0.233333);
  const onNetGap = gap.vuduSaveGap({ expectedSaveProb: 0.9, recentSaves: 1, recentShotsOnNet: 2 });
  const wrongPopulationGap = gap.vuduSaveGap({ expectedSaveProb: 0.9, recentSaves: 1, recentShotsOnNet: row.shots_against });
  close(onNetGap, 40); close(wrongPopulationGap, 56.66666666666667);
  record('N5_H2', { aggregate: row, onNetMaterialized: onNet, onNetShots: 2, onNetGap, deliberateWrongPopulationGap: wrongPopulationGap,
    wrongAllUnblockedXgPerOnNetShot: row.xg_against / 2, matchedOnNetPredictionsPerShot: (0.1 + 0.2) / 2,
    limit: 'No active adapter misuse asserted; conditional-on-net model calibration remains unproved.' });
});

test('H3: xGA context has a volume path and a separate context/prior path; no calibration verdict', () => {
  const low = context.computeTeamStrengthContextAdjustment({ defendingTeamPrior: fixture.prior(), opponentTeamPrior: fixture.prior() });
  const high = context.computeTeamStrengthContextAdjustment({ defendingTeamPrior: fixture.prior(3.54), opponentTeamPrior: fixture.prior() });
  const lowDanger = context.computeNstOpponentDangerAdjustment({ defendingTeamProfile: fixture.nst(), opponentTeamProfile: fixture.nst() });
  const highDanger = context.computeNstOpponentDangerAdjustment({ defendingTeamProfile: fixture.nst(3.125), opponentTeamProfile: fixture.nst() });
  const baseline = source.stageContext(fixture.neutralStage());
  const volume = source.stageContext({ ...fixture.neutralStage(), baseShotsAgainst: 30 * (1 + high.shotsAgainstPctAdjustment) });
  const danger = source.stageContext({ ...fixture.neutralStage(), nstOpponentDangerAdjustment: highDanger });
  const both = source.stageContext({ ...fixture.neutralStage(), baseShotsAgainst: 30 * (1 + high.shotsAgainstPctAdjustment), nstOpponentDangerAdjustment: highDanger });
  assert.equal(low.shotsAgainstPctAdjustment, 0); assert.equal(lowDanger.contextPctAdjustment, 0);
  assert.ok(volume.shotsAgainst > baseline.shotsAgainst); close(volume.leagueSavePct, baseline.leagueSavePct);
  assert.ok(danger.shotsAgainst > baseline.shotsAgainst); assert.ok(danger.leagueSavePct < baseline.leagueSavePct);
  assert.ok(both.shotsAgainst > volume.shotsAgainst && both.shotsAgainst > danger.shotsAgainst);
  record('H3', { teamXgaAdjustment: high, nstDangerAdjustment: highDanger, baseline, volumeOnly: volume, dangerOnly: danger, both,
    note: 'Unchanged stage formulas. Independent source inputs are stressed; this is attribution, not an accepted multiplier removal.' });
});

test('H4: team SV/PDO can change modeled goalie output with individual history fixed', () => {
  const make = savePct5v5 => context.computeTeamFiveOnFiveContextAdjustment({
    defendingTeamProfile: { gamesPlayed: 20, savePct5v5, shootingPlusSavePct5v5: 1 },
    opponentTeamProfile: { gamesPlayed: 20, savePct5v5: 0.922, shootingPlusSavePct5v5: 1 } });
  const neutral = source.stageContext({ ...fixture.neutralStage(), teamFiveOnFiveContextAdjustment: make(0.922) });
  const high = source.stageContext({ ...fixture.neutralStage(), teamFiveOnFiveContextAdjustment: make(0.942) });
  const a = model({ ...fixture.modelInput(), projectedShotsAgainst: neutral.shotsAgainst, leagueSavePct: neutral.leagueSavePct });
  const b = model({ ...fixture.modelInput(), projectedShotsAgainst: high.shotsAgainst, leagueSavePct: high.leagueSavePct });
  assert.ok(b.modeledSavePct > a.modeledSavePct);
  record('H4', { neutral, highTeamSavePct: high, neutralOutput: a, alteredEnvironmentOutput: b,
    note: 'Outputs are context-sensitive, not a context-neutral skill estimate. No empirical double-counting harm proved.' });
});

test('H5: invalid nonfinite input is not fully rejected by the model boundary', () => {
  assert.throws(() => model({ ...fixture.modelInput(), projectedGoalsFor: NaN }), /finite/);
  const invalid = model({ ...fixture.modelInput(), projectedShotsAgainst: NaN });
  assert.ok(Number.isNaN(invalid.projectedSaves));
  record('H5', { projectedShotsAgainstNaN: 'NaN projected saves/GA; caller qualification required; live reachability not established' });
});

test.after(() => fs.writeFileSync(path.join(__dirname, 'OBSERVATIONS.json'), JSON.stringify(plain(observations), null, 2) + '\n'));
