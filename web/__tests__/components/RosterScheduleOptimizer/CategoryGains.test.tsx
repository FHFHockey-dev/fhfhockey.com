import { cleanup, render, screen, within } from "@testing-library/react";
import { afterEach, expect, it } from "vitest";
import CategoryGains from "components/RosterScheduleOptimizer/CategoryGains";
import { evaluatePlan } from "lib/rosterScheduleOptimizer/planning";
import type { GameForecast, PlanIntent, PlanningPlayer, PlanningSnapshot } from "lib/rosterScheduleOptimizer/planningTypes";

afterEach(cleanup);
const intent: PlanIntent = { revision: 1, steps: [{ id: "chosen", type: "add", playerId: "3", dropPlayerId: "2",
  at: "2026-10-05T22:00:00Z", effectiveAt: "2026-10-06T00:00:00Z", conditional: true, dependsOn: [] }],
  protectedPlayerIds: ["1"], excludedPlayerIds: [], goalieCoverage: "accept_risk", goalieWindow: "any", goalieSplit: "mon_thu", alternativeCount: 5 };

function fixture(): PlanningSnapshot {
  const players: PlanningPlayer[] = ["A", "B", "C"].map((team, index) => ({ id: String(index + 1), nhlId: index + 1,
    nhlTeamId: index + 1, rosterRevision: `fixture-roster-${index}`, name: team, teamAbbreviation: team,
    eligiblePositions: ["C"], eligibilityVerified: true, playerClass: "skater", availability: index === 2 ? "manager_available" : "rostered",
    canDrop: true, holdValue: null, ownership: null, reserveEligibility: [] }));
  const games = [["A", 6], ["A", 7], ["C", 5], ["C", 6], ["C", 7]].map(([team, day], index) => ({
    id: String(index + 1), scheduleRevision: `fixture-schedule-${index}`, date: `2026-10-0${day}`, startsAt: `2026-10-0${day}T20:00:00Z`,
    teamAbbreviation: String(team), opponent: "X", home: true, status: "scheduled" as const }));
  const forecasts: GameForecast[] = games.map(game => {
    const member = players.find(player => player.teamAbbreviation === game.teamAbbreviation)!;
    const stats = game.teamAbbreviation === "A" ? { GOALS: 1, SHOTS: 6 }
      : game.date.endsWith("05") ? { GOALS: 99, SHOTS: 99 } : { GOALS: 3, SHOTS: 2 };
    return { playerId: member.id, gameId: game.id, stats, conditioning: "unconditional", sourceKind: "detailed",
      revisionId: `fixture-forge-${game.id}`, sourceWatermark: "fixture-only", modelVersion: "fixture-v1",
      cutoffAt: "2026-10-05T00:00:00Z", issuedAt: "2026-10-05T00:00:00Z", expiresAt: game.startsAt,
      allowedUses: { assignment: true, totals: true, comparison: true, conditionalTieBreak: false },
      startProbability: null, confirmedStart: false, limitations: [],
      issuedContext: { version: "forge-issued-context-v1", playerId: member.id, gameId: game.id, nhlPlayerId: member.nhlId!,
        seasonId: 20262027, teamId: member.nhlTeamId!, scheduledAt: game.startsAt, scheduleRevision: game.scheduleRevision,
        rosterRevision: member.rosterRevision!, observedAt: "2026-10-05T00:00:00Z", scheduleSourceUpdatedAt: null,
        scheduleFetchedAt: null, identityUpdatedAt: null, membershipCreatedAt: [] } };
  });
  return { id: "fixture-only-manifest", context: { provider: "manual", seasonId: 20262027, leagueId: "manual", teamId: "manual",
    startDate: "2026-10-05", endDate: "2026-10-07", timeZone: "UTC", asOf: "2026-10-05T00:00:00Z" }, players, games, forecasts,
    roster: [{ playerId: "1", position: "active" }, { playerId: "2", position: "bench" }],
    lockedAssignments: [{ date: "2026-10-06", playerId: "1", slotId: "C#1" }], realized: { GOALS: 0, SHOTS: 0 },
    opponent: { roster: [], realized: { GOALS: 2.5, SHOTS: 10 }, remaining: { GOALS: 0, SHOTS: 0 } }, evidence: {},
    rules: { lineupMode: "daily", rosterSlots: { C: 1, BN: 1 }, acquisitionTiming: "next_day", acquisitionCost: 1,
      periods: [{ id: "Before reset", start: "2026-10-05T00:00:00Z", end: "2026-10-06T00:00:00Z", remaining: 1, source: "manager" },
        { id: "After reset", start: "2026-10-06T00:00:00Z", end: "2026-10-08T00:00:00Z", remaining: 0, source: "manager" }],
      scoring: { mode: "categories", weights: {}, categories: [{ key: "GOALS", direction: "higher" }, { key: "SHOTS", direction: "higher" }] },
      goalieMinimum: { required: null, credited: null, counts: "starts", penalty: "none" }, unsupported: [] } };
}
function evaluated(data: PlanningSnapshot, selected = intent) {
  return { baseline: evaluatePlan(data, selected, "outcome", [], false), plan: evaluatePlan(data, selected, "outcome", selected.steps, false) };
}
function show(data: PlanningSnapshot, evaluations = evaluated(data), reviewed = true) {
  render(<CategoryGains {...evaluations} scoring={data.rules.scoring} label="Selected plan" reviewed={reviewed} />);
}

it("shows per-category gains and losses from startable days, preserving manager moves and reset accounting", () => {
  const data = fixture();
  const original = JSON.stringify(intent);
  const evaluations = evaluated(data);
  expect(evaluations.plan).toMatchObject({ legal: true, budgetVerified: true, comparisonEligible: true,
    projectedValue: 0, acquisitions: { "Before reset": 1 }, steps: intent.steps });
  expect(evaluations.baseline.projectedValue).toBe(0);
  expect(evaluations.plan.assignments.map(row => [row.date, row.playerId])).toEqual([["2026-10-06", "1"], ["2026-10-07", "3"]]);
  expect(evaluations.plan.forecastInputs?.find(row => row.playerId === "3")?.revisionId).toBe("fixture-forge-5");
  expect(JSON.stringify(intent)).toBe(original);
  show(data, evaluations);
  expect(within(screen.getByRole("article", { name: "Selected plan GOALS gain" })).getByText("No move 2 → plan 4 · Δ +2")).toBeTruthy();
  expect(within(screen.getByRole("article", { name: "Selected plan SHOTS gain" })).getByText("No move 12 → plan 8 · Δ -4")).toBeTruthy();
  expect(screen.getByText("Opponent 2.5 · loss → win")).toBeTruthy();
  expect(screen.getByText("Opponent 10 · win → loss")).toBeTruthy();
  expect(screen.getByText(/not win probabilities/)).toBeTruthy();
});

it.each(["postponed", "cancelled", "final"] as const)("excludes a %s candidate game from gains", status => {
  const data = fixture(); data.games.at(-1)!.status = status;
  const evaluations = evaluated(data);
  expect(evaluations.plan.assignments.some(row => row.playerId === "3")).toBe(false);
  show(data, evaluations);
  expect(screen.getAllByText(/Δ 0/)).toHaveLength(2);
});

it.each(["expired", "missing", "comparison denied", "eligibility unknown", "schedule changed", "roster changed", "opponent missing", "allowance unknown", "allowance exhausted", "too early"])("keeps %s gains unavailable", reason => {
  const data = fixture();
  const selected = structuredClone(intent);
  const forecast = data.forecasts.at(-1)!;
  if (reason === "expired") forecast.expiresAt = data.context.asOf;
  if (reason === "missing") data.forecasts.pop();
  if (reason === "comparison denied") forecast.allowedUses!.comparison = false;
  if (reason === "eligibility unknown") data.players[2].eligibilityVerified = false;
  if (reason === "schedule changed") data.games.at(-1)!.scheduleRevision = "new-schedule";
  if (reason === "roster changed") data.players[2].rosterRevision = "new-roster";
  if (reason === "opponent missing") data.opponent = null;
  if (reason === "allowance unknown") data.rules.periods[0].remaining = null;
  if (reason === "allowance exhausted") data.rules.periods[0].remaining = 0;
  if (reason === "too early") selected.steps[0].effectiveAt = selected.steps[0].at;
  show(data, evaluated(data, selected));
  expect(screen.getByText(/Category gains unavailable/)).toBeTruthy();
  expect(screen.queryByText(/Δ/)).toBeNull();
  expect(screen.getAllByText("Change unavailable")).toHaveLength(2);
});

it("shows no category gain for a candidate without a compatible starting position", () => {
  const data = fixture(); data.players[2].eligiblePositions = ["G"];
  const evaluations = evaluated(data);
  expect(evaluations.plan.assignments.some(row => row.playerId === "3")).toBe(false);
  show(data, evaluations);
  expect(screen.getAllByText(/Δ 0/)).toHaveLength(2);
});

it("does not compare different manifests or unapproved legacy evaluations", () => {
  const data = fixture(); const evaluations = evaluated(data);
  evaluations.plan.forecastManifestId = "new-revision";
  show(data, evaluations);
  expect(screen.queryByText(/Δ/)).toBeNull();
  cleanup();
  delete evaluations.plan.comparisonEligible;
  evaluations.plan.forecastManifestId = evaluations.baseline.forecastManifestId;
  show(data, evaluations, false);
  expect(screen.queryByText(/Δ/)).toBeNull();
  expect(screen.getByText(/Review planning inputs before acting/)).toBeTruthy();
});

it("uses whole-lineup goalie ratios and keeps projected starts separate from credited minimum progress", () => {
  const data = fixture();
  data.players.forEach(player => { player.playerClass = "goalie"; player.eligiblePositions = ["G"]; });
  data.rules.rosterSlots = { G: 1, BN: 1 };
  data.lockedAssignments[0].slotId = "G#1";
  data.rules.scoring.categories = [{ key: "SV%", direction: "higher", numerator: "SAVES_GOALIE", denominator: "SHOTS_AGAINST_GOALIE" },
    { key: "GAA", direction: "lower", numerator: "GOALS_AGAINST_GOALIE", denominator: "GOALIE_MINUTES", multiplier: 60 }];
  data.realized = { SAVES_GOALIE: 0, SHOTS_AGAINST_GOALIE: 0, GOALS_AGAINST_GOALIE: 0, GOALIE_MINUTES: 0 };
  data.opponent = { roster: [], realized: { SAVES_GOALIE: 90, SHOTS_AGAINST_GOALIE: 100, GOALS_AGAINST_GOALIE: 3, GOALIE_MINUTES: 60 }, remaining: {} };
  data.forecasts.forEach(row => { row.startProbability = 0.5;
    row.stats = row.playerId === "1" ? { SAVES_GOALIE: 18, SHOTS_AGAINST_GOALIE: 20, GOALS_AGAINST_GOALIE: 2, GOALIE_MINUTES: 30 }
      : { SAVES_GOALIE: 9.5, SHOTS_AGAINST_GOALIE: 10, GOALS_AGAINST_GOALIE: 0.5, GOALIE_MINUTES: 30 }; });
  data.rules.goalieMinimum = { required: 2, credited: 2, counts: "starts", penalty: "lose_goalie_categories",
    periodStart: "2026-10-05T00:00:00Z", periodEnd: "2026-10-08T00:00:00Z" };
  const evaluations = evaluated(data);
  expect(evaluations.plan.goalie).toMatchObject({ credited: 2, projected: 3, minimumSatisfied: true });
  expect(evaluations.plan.categoryResults.find(row => row.key === "SV%")?.own).toBeCloseTo(27.5 / 30);
  show(data, evaluations);
  expect(screen.getByText("No move 0.9 → plan 0.91667 · Δ +0.016667")).toBeTruthy();
  expect(screen.getByText("No move 4 → plan 2.5 · Δ -1.5")).toBeTruthy();
  cleanup();
  data.rules.goalieMinimum.credited = 0;
  const risky = evaluated(data);
  expect(risky.plan.goalie).toMatchObject({ credited: 0, projected: 1, minimumSatisfied: false, risk: true });
  show(data, risky);
  expect(screen.queryByText(/Δ/)).toBeNull();
});

it("omits category UI for a points league", () => {
  const data = fixture(); data.rules.scoring.mode = "points";
  show(data);
  expect(screen.queryByText(/category gains/)).toBeNull();
});
