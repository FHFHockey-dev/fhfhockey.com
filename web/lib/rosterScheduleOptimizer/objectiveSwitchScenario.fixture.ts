// SYNTHETIC objective-switch fixture (no retained roster); helpers adapted from planning.test.ts.
import type * as rsoPolicy from "../player-forecasts/rsoUsePolicy";
import type { GameForecast, PlanIntent, PlanningPlayer, PlanningSnapshot } from "./planningTypes";

// Algorithm fixtures have explicit fictional reviews. Production catalog stays empty;
// the policy-denial cases below remove these bindings and use the real resolver.
const reviewedTargets = ["pts", "made", "attempts", "GOALS", "ASSISTS", "SHOTS", "HITS", "BLOCKS", "PENALTY_MINUTES",
  "SAVES_GOALIE", "SHOTS_AGAINST_GOALIE", "GOALS_AGAINST_GOALIE", "GOALIE_MINUTES", "WINS_GOALIE", "SHUTOUTS_GOALIE",
  "saves", "shotsAgainst", "goalsAgainst", "minutes", "g", "h", "unused"];
const fixtureBindings = Object.fromEntries(reviewedTargets.map(targetKey => [targetKey, {
  component: "fictional-planner", modelMode: "synthetic", codeVersion: "f1".repeat(32),
  configurationHash: "a".repeat(64), artifactHash: "b".repeat(64), targetKey, horizonGames: 1,
  conditioning: "synthetic-unconditional", participationLineage: "synthetic-only", cutoffAt: "2026-10-04T00:00:00Z",
}]));
export const fixturePolicy: rsoPolicy.RsoUsePolicy = { version: "rso-target-use-v1", revision: "fictional-planner-reviews",
  revokedReviewIds: [], reviews: reviewedTargets.map(targetKey => ({ id: `fictional-${targetKey}`,
    binding: fixtureBindings[targetKey], reviewedAt: "2026-09-01T00:00:00Z", expiresAt: "2100-01-01T00:00:00Z",
    inputCutoffFrom: "2026-09-01T00:00:00Z", inputCutoffUntil: "2026-11-01T00:00:00Z",
    allowedUses: { assignment: true, totals: true, comparison: true, conditionalTieBreak: true },
    prospectiveEvidenceRef: "fictional-evidence", ownerApprovalRef: "fictional-approval",
  })) };

const fixtureId = (value: string) => [...value].reduce((id, char) => (id * 31 + char.charCodeAt(0)) % 100000000, 1) + 1;
export const player = (id: string, team: string, availability: PlanningPlayer["availability"] = "rostered"): PlanningPlayer => ({
  id, nhlId: fixtureId(id), nhlTeamId: fixtureId(team), rosterRevision: `roster-${id}-${team}`,
  name: id, teamAbbreviation: team, eligiblePositions: ["C"], playerClass: "skater",
  availability, eligibilityVerified: true, ownership: null, canDrop: true, holdValue: null, reserveEligibility: [],
});
export const intent: PlanIntent = { revision: 3, steps: [], protectedPlayerIds: [], excludedPlayerIds: [], goalieCoverage: "accept_risk", goalieWindow: "any", goalieSplit: "mon_thu", alternativeCount: 5 };
export function issuedForecast(data: PlanningSnapshot, playerId: string, gameId: string, overrides: Partial<GameForecast> = {}): GameForecast {
  const member = data.players.find(row => row.id === playerId)!;
  const game = data.games.find(row => row.id === gameId && row.teamAbbreviation === member.teamAbbreviation)!;
  return { playerId, gameId, rsoTargetBindings: structuredClone(fixtureBindings), stats: { pts: playerId === "a" ? 1 : 2 }, conditioning: "unconditional",
    sourceKind: "detailed", sourceWatermark: "fixture-inputs", cutoffAt: "2026-10-04T00:00:00Z",
    issuedAt: "2026-10-04T00:00:00Z", expiresAt: game.startsAt!, modelVersion: "fixture-v1", producerCodeVersion: "f1".repeat(32), revisionId: "r",
    issuedContext: { version: "forge-issued-context-v1", playerId, gameId, nhlPlayerId: member.nhlId!,
      teamId: member.nhlTeamId!, seasonId: data.context.seasonId, scheduledAt: game.startsAt!,
      scheduleRevision: game.scheduleRevision!, rosterRevision: member.rosterRevision!, observedAt: "2026-10-04T00:00:00Z",
      scheduleSourceUpdatedAt: "2026-10-04T00:00:00Z", scheduleFetchedAt: "2026-10-04T00:00:00Z",
      identityUpdatedAt: "2026-10-04T00:00:00Z", membershipCreatedAt: ["2026-09-01T00:00:00Z"] },
    allowedUses: { assignment: true, totals: true, comparison: true, conditionalTieBreak: true },
    startProbability: null, confirmedStart: false, limitations: [], ...overrides };
}
export function snapshot(): PlanningSnapshot {
  const players = [player("a", "A"), player("b", "B"), player("c", "C", "free_agent")];
  const games = ["2026-10-05", "2026-10-06"].flatMap((date, index) => ["A", "B", "C"].map(team => ({
    id: `${team}${index}`, scheduleRevision: `schedule-${team}${index}`, date, startsAt: `${date}T20:00:00Z`, teamAbbreviation: team, opponent: "X", home: true, status: "scheduled" as const,
  })));
  const data: PlanningSnapshot = {
    id: "snap", context: { provider: "manual", seasonId: 20262027, leagueId: "l", teamId: "t", startDate: "2026-10-05", endDate: "2026-10-06", timeZone: "UTC", asOf: "2026-10-04T00:00:00Z" },
    players, roster: [{ playerId: "a", position: "active" }, { playerId: "b", position: "bench" }], games,
    forecasts: [],
    rules: { lineupMode: "daily", rosterSlots: { C: 1, BN: 1 }, acquisitionTiming: "same_day", acquisitionCost: 1,
      periods: [{ id: "p", start: "2026-10-04T00:00:00Z", end: "2026-10-12T00:00:00Z", remaining: 2, source: "manager" }],
      scoring: { mode: "points", weights: { pts: 1 }, categories: [] }, goalieMinimum: { required: null, credited: null, counts: "unknown", penalty: "none" }, unsupported: [] },
    lockedAssignments: [], realized: { pts: 0 }, opponent: null, evidence: { schedule: {
      source: "synthetic complete schedule", asOf: "2026-10-04T00:00:00Z", seasonId: 20262027,
      completeness: "complete", limitations: [],
    } },
  };
  data.forecasts = games.flatMap(game => players.filter(item => item.teamAbbreviation === game.teamAbbreviation)
    .map(item => issuedForecast(data, item.id, game.id)));
  return data;
}

// SYNTHETIC week: 2 days. Skater a (locked C on day 1), skater b bench-capable C, goalie g (G slot), backup goalie h.
export function scenario(): PlanningSnapshot {
  const data = snapshot();
  const g = { ...player("g", "A"), eligiblePositions: ["G"], playerClass: "goalie" as const };
  const h = { ...player("h", "B"), eligiblePositions: ["G"], playerClass: "goalie" as const };
  data.players = [player("a", "A"), player("b", "B"), g];
  data.roster = [{ playerId: "a", position: "active" }, { playerId: "b", position: "bench" }, { playerId: "g", position: "active" }];
  data.rules.rosterSlots = { C: 1, G: 1, BN: 2 };
  data.lockedAssignments = [{ date: "2026-10-05", playerId: "a", slotId: "C#1" }];
  data.forecasts = data.games.flatMap(game => data.players.filter(item => item.teamAbbreviation === game.teamAbbreviation)
    .map(item => issuedForecast(data, item.id, game.id, item.playerClass === "goalie"
      ? { stats: { pts: item.id === "g" ? -3 : 1 }, startProbability: 0.9 } : {})));
  data.rules.goalieMinimum = { required: 1, credited: 0, counts: "starts", penalty: "none", periodStart: "2026-10-05", periodEnd: "2026-10-07" };
  return data;
}
