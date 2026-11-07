import { strict as assert } from "node:assert";
import type { GameExpectationsResponse } from "../../../../web/lib/player-forecasts/gameExpectations";
import { leagueValuationComponents } from "./valuationAdapter";

// Synthetic trusted-adapter inputs exercise arithmetic/withholding, never real admission.
const asOf = "2026-11-04T12:00:00Z";
const view: GameExpectationsResponse = {
  version: "forge-game-expectations-v1", readAsOf: asOf,
  scope: { seasonId: 2026, startDate: "2026-11-05", endDate: "2026-11-20", timeZone: "America/New_York", mode: "next_n", games: 5 },
  manifestId: null, baselineChecksum: null, limitations: ["Synthetic adapter check only"],
  players: [{ playerId: "synthetic-player", nhlPlayerId: 1, teamId: 1, name: "Synthetic", team: "SYN", playerClass: "skater", positions: ["C"],
    scheduledOpportunities: 5, requestedGames: 5, horizonComplete: true, expectedAppearances: null, expectedStarts: null,
    games: Array.from({ length: 5 }, (_, i) => ({ gameId: `synthetic-${i}`, date: "2026-11-05", scheduledAt: "2026-11-05T12:00:00Z",
      team: "SYN", opponent: "OTHER", homeTeam: "SYN", awayTeam: "OTHER", scheduleRevision: "synthetic-schedule", rosterRevision: "synthetic-roster",
      appearanceProbability: null, startProbability: null, powerPlayRole: { value: null, status: "unavailable", reason: "current_role_evidence_unavailable", source: null }, limitations: [],
      targets: { GOALS: { expected: 1, conditional: null, basis: "unconditional_game", unit: "count", allowedUses: { assignment: true, totals: true, comparison: true, conditionalTieBreak: false }, sourceKind: null,
        sourceIds: ["synthetic-source"], methodVersions: ["synthetic-method"], sourceWatermarks: ["synthetic-watermark"], cutoffAt: "2026-11-04T10:00:00Z", issuedAt: "2026-11-04T11:00:00Z", expiresAt: "2026-11-05T12:00:00Z",
        sources: [], participation: null, participationRevisionId: null, reasons: [], limitations: [] } } })),
    totals: { GOALS: { expected: 5, coveredSum: 5, coveredGames: 5, requiredGames: 5, unit: "count", reason: null } }, ratios: {} }],
};
const input = { view, asOf, playerId: "synthetic-player", leagueProfile: { id: "synthetic-league", version: "v1", origin: "manual" as const },
  scoring: { mode: "points" as const, scoringBasis: "points:synthetic", weights: { GOALS: 3 } } };
let passed = 0;
function check(name: string, run: () => void) { run(); passed++; console.log(`PASS ${name}`); }
check("reuse existing scorer under two league profiles", () => {
  assert.deepEqual(leagueValuationComponents(input).projectedPoints, { status: "available", value: 15 });
  assert.deepEqual(leagueValuationComponents({ ...input, scoring: { ...input.scoring, weights: { GOALS: 2 } } }).projectedPoints, { status: "available", value: 10 });
});
check("legitimate zero remains available", () => {
  const zero = structuredClone(view); zero.players[0].games.forEach(game => { game.targets.GOALS.expected = 0; }); zero.players[0].totals.GOALS.expected = 0;
  assert.deepEqual(leagueValuationComponents({ ...input, view: zero }).projectedPoints, { status: "available", value: 0 });
});
check("absent view and unknown scored target withhold", () => {
  assert.equal(leagueValuationComponents({ ...input, view: null }).projectedPoints.status, "unavailable");
  assert.equal(leagueValuationComponents({ ...input, scoring: { ...input.scoring, weights: { ASSISTS: 2 } } }).projectedPoints.status, "unavailable");
});
check("denied comparison, expiry and partial horizon withhold", () => {
  for (const kind of ["permission", "expiry", "horizon"]) {
    const changed = structuredClone(view);
    if (kind === "permission") changed.players[0].games[0].targets.GOALS.allowedUses.comparison = false;
    if (kind === "expiry") changed.players[0].games[0].targets.GOALS.expiresAt = asOf;
    if (kind === "horizon") changed.players[0].horizonComplete = false;
    assert.equal(leagueValuationComponents({ ...input, view: changed }).projectedPoints.status, "unavailable");
  }
});
check("cached read cutoff and inconsistent totals withhold", () => {
  const inconsistent = structuredClone(view); inconsistent.players[0].totals.GOALS.expected = 6;
  assert.equal(leagueValuationComponents({ ...input, view: inconsistent }).projectedPoints.status, "unavailable");
  assert.equal(leagueValuationComponents({ ...input, asOf: "2026-11-04T13:00:00Z" }).projectedPoints.status, "unavailable");
});
check("unsupported scoring/invalid weights do not invent values", () => {
  assert.equal(leagueValuationComponents({ ...input, scoring: { mode: "categories", categories: ["GOALS"] } }).projectedPoints.status, "unavailable");
  assert.equal(leagueValuationComponents({ ...input, scoring: { ...input.scoring, weights: { GOALS: NaN } } }).projectedPoints.status, "unavailable");
});
check("raw points never become VOR, combined value or suggestion guard", () => {
  const result = leagueValuationComponents(input);
  for (const key of ["vor", "actualPoints", "actualRank", "adp", "combined", "plausibility"] as const) assert.equal(result[key].status, "unavailable");
});
console.log(`${passed} synthetic adapter checks passed; no real forecast admission asserted.`);
