import type { ContributionAllowedUses, ContributionSource } from "./contributions";
import { resolvePlanningContributions } from "./planningContributions";
import type { GameForecast, PlanningData, PlanningGame } from "../rosterScheduleOptimizer/planningTypes";

export const GAME_EXPECTATIONS_VERSION = "forge-game-expectations-v1" as const;
export type GameExpectationScope = {
  seasonId: number; startDate: string; endDate: string; timeZone: string;
  mode: "calendar" | "next_n"; games: number; playerIds?: string[];
};
const denied: ContributionAllowedUses = { assignment: false, totals: false, comparison: false, conditionalTieBreak: false };
const skaterTargets = ["GOALS", "ASSISTS", "POINTS", "PP_POINTS", "SHOTS_ON_GOAL", "HITS", "BLOCKED_SHOTS", "PENALTY_MINUTES", "TIME_ON_ICE_PER_GAME"];
const goalieTargets = ["SAVES_GOALIE", "GOALS_AGAINST_GOALIE", "SHOTS_AGAINST_GOALIE", "GOALIE_MINUTES", "WINS_GOALIE", "SHUTOUTS_GOALIE"];
const finite = (value: unknown): value is number => typeof value === "number" && Number.isFinite(value);

export type GameExpectationTarget = {
  expected: number | null; conditional: number | null;
  basis: string | null; unit: "count" | "minutes";
  allowedUses: ContributionAllowedUses; sourceKind: GameForecast["sourceKind"] | null;
  sourceIds: string[]; methodVersions: string[]; sourceWatermarks: string[];
  cutoffAt: string | null; issuedAt: string | null; expiresAt: string | null;
  /** Individual original receipts; the fields above are composite validity clocks. */
  sources: Array<{ sourceId: string; kind: ContributionSource["kind"]; methodVersion: string;
    sourceWatermark: string; cutoffAt: string; issuedAt: string; expiresAt: string }>;
  participation: { revisionId: string; basis: "appearance" | "start"; probability: number | null;
    cutoffAt: string; issuedAt: string; expiresAt: string } | null;
  participationRevisionId: string | null; reasons: string[]; limitations: string[];
};
export type GameExpectation = {
  gameId: string; date: string; scheduledAt: string; team: string; opponent: string;
  homeTeam: string; awayTeam: string;
  scheduleRevision: string; rosterRevision: string | null;
  appearanceProbability: number | null; startProbability: number | null;
  limitations: string[];
  targets: Record<string, GameExpectationTarget>;
};
export type GameExpectationAggregate = {
  expected: number | null; coveredSum: number | null; coveredGames: number; requiredGames: number;
  unit: "count" | "minutes" | null; reason: string | null;
};
export type GameExpectationsResponse = {
  version: typeof GAME_EXPECTATIONS_VERSION; readAsOf: string; scope: GameExpectationScope;
  manifestId: string | null; baselineChecksum: string | null;
  players: Array<{
    playerId: string; nhlPlayerId: number | null; teamId: number | null; name: string;
    team: string | null; playerClass: "skater" | "goalie"; positions: string[];
    scheduledOpportunities: number; requestedGames: number | null; horizonComplete: boolean;
    expectedAppearances: number | null; expectedStarts: number | null;
    games: GameExpectation[]; totals: Record<string, GameExpectationAggregate>;
    ratios: Record<string, { value: number | null; numerator: string; denominator: string;
      interpretation: "ratio_of_expected_totals"; reason: string | null }>;
  }>;
  limitations: string[];
};

function orderedTime(sources: Array<{ cutoffAt: string; issuedAt: string; expiresAt: string }>,
  key: "cutoffAt" | "issuedAt" | "expiresAt"): string | null {
  const times = sources.map(source => source[key]).filter(time => Number.isFinite(Date.parse(time)))
    .sort((a, b) => Date.parse(a) - Date.parse(b));
  return (key === "expiresAt" ? times[0] : times.at(-1)) ?? null;
}

function targetView(forecast: GameForecast | undefined, target: string): GameExpectationTarget {
  const row = forecast?.contributions?.[target];
  if (forecast?.contributions && !row) return { ...targetView(undefined, target), reasons: ["missing_target"] };
  const uses = row?.allowedUses ?? forecast?.allowedUses ?? denied;
  const selected = row ? [row.inputs?.detailed, row.inputs?.baseline]
    .filter((source): source is ContributionSource => !!source && row.sourceIds.includes(source.sourceId)) : [];
  const participation = row?.inputs?.participation;
  const clocks = [...selected, ...(participation && participation.revisionId === row?.participationRevisionId ? [participation] : [])];
  const expected = row ? row.unconditionalMean : forecast?.stats[target];
  const conditional = row?.conditionalMean ?? forecast?.conditionalStats?.[target];
  return {
    expected: uses.totals && finite(expected) ? expected : null,
    conditional: uses.conditionalTieBreak && finite(conditional) ? conditional : null,
    basis: row?.basis ?? (forecast ? "unconditional_game" : null),
    unit: row?.unit ?? (target === "GOALIE_MINUTES" || target === "TIME_ON_ICE_PER_GAME" ? "minutes" : "count"),
    allowedUses: { ...uses }, sourceKind: row ? row.sourceKind : forecast?.sourceKind ?? null,
    sourceIds: row?.sourceIds ?? (forecast ? [forecast.revisionId] : []),
    methodVersions: row ? [...new Set(selected.map(source => source.policyVersion))].sort() : forecast?.modelVersion ? [forecast.modelVersion] : [],
    sourceWatermarks: row ? [...new Set(selected.map(source => source.sourceWatermark))].sort() : forecast?.sourceWatermark ? [forecast.sourceWatermark] : [],
    cutoffAt: row ? orderedTime(clocks, "cutoffAt") : forecast?.cutoffAt ?? null,
    issuedAt: row ? orderedTime(clocks, "issuedAt") : forecast?.issuedAt ?? null,
    expiresAt: row ? orderedTime(clocks, "expiresAt") : forecast?.expiresAt ?? null,
    sources: selected.length ? selected.map(source => ({ sourceId: source.sourceId, kind: source.kind,
      methodVersion: source.policyVersion, sourceWatermark: source.sourceWatermark,
      cutoffAt: source.cutoffAt, issuedAt: source.issuedAt, expiresAt: source.expiresAt }))
      : !row && forecast?.cutoffAt && forecast.expiresAt && forecast.modelVersion && forecast.sourceWatermark
        ? [{ sourceId: forecast.revisionId, kind: "detailed", methodVersion: forecast.modelVersion,
          sourceWatermark: forecast.sourceWatermark, cutoffAt: forecast.cutoffAt, issuedAt: forecast.issuedAt,
          expiresAt: forecast.expiresAt }] : [],
    participation: participation && participation.revisionId === row?.participationRevisionId
      ? { revisionId: participation.revisionId, basis: participation.basis,
        probability: participation.allowedUses?.totals && row?.allowedUses.totals ? participation.probability : null,
        cutoffAt: participation.cutoffAt, issuedAt: participation.issuedAt, expiresAt: participation.expiresAt } : null,
    participationRevisionId: row?.participationRevisionId ?? null,
    limitations: [...(row?.limitations ?? forecast?.limitations ?? [])],
    reasons: [...new Set([...(row?.exclusionReasons ?? []),
      ...(!finite(expected) && !finite(conditional) ? [forecast ? "missing_target" : "no_issued_revision"] : []),
      ...(!uses.totals && !uses.conditionalTieBreak && forecast ? ["use_not_approved"] : [])])],
  };
}

function participation(forecast: GameForecast | undefined, basis: "appearance" | "start"): number | null {
  if (!forecast) return null;
  if (!forecast.contributions) {
    const value = basis === "appearance" ? forecast.appearanceProbability : forecast.startProbability;
    return forecast.allowedUses?.totals && finite(value) && value >= 0 && value <= 1 ? value : null;
  }
  const evidence = Object.values(forecast.contributions).flatMap(row => {
    const value = row.inputs?.participation;
    return value?.basis === basis && value.revisionId === row.participationRevisionId
      && value.allowedUses?.totals && row.allowedUses.totals ? [value.probability] : [];
  });
  return evidence.length && evidence.every(value => finite(value) && value >= 0 && value <= 1 && value === evidence[0])
    ? evidence[0] : null;
}

/** A view of admitted shared inputs; this function never issues, releases or generates a forecast. */
export function buildGameExpectations(data: PlanningData, scope: GameExpectationScope, now: Date): GameExpectationsResponse {
  if (!Number.isFinite(now.getTime()) || !Number.isInteger(scope.games) || scope.games < 1 || scope.games > 10
    || !["calendar", "next_n"].includes(scope.mode) || new Set(data.players.map(player => player.id)).size !== data.players.length) {
    throw new Error("Invalid game expectation scope or duplicate player identities.");
  }
  const snapshot = resolvePlanningContributions({ ...data, context: { ...scope, asOf: now.toISOString() } });
  const byForecast = new Map<string, GameForecast>();
  for (const forecast of snapshot.forecasts) {
    const key = `${forecast.playerId}:${forecast.gameId}`;
    if (byForecast.has(key)) throw new Error("Conflicting player/game forecast revisions.");
    byForecast.set(key, forecast);
  }
  const seen = new Set<string>();
  const schedule = new Map<string, PlanningGame[]>();
  const incompleteTeams = new Set<string>();
  let invalidStarts = 0;
  for (const game of data.games) {
    if (game.date < scope.startDate || game.date > scope.endDate || game.status !== "scheduled") continue;
    const key = `${game.teamAbbreviation}:${game.id}`;
    if (seen.has(key)) throw new Error("Duplicate scheduled team/game identities.");
    seen.add(key);
    if (!game.startsAt || !Number.isFinite(Date.parse(game.startsAt)) || !game.scheduleRevision) {
      invalidStarts++; incompleteTeams.add(game.teamAbbreviation); continue;
    }
    if (Date.parse(game.startsAt) <= now.getTime()) continue;
    schedule.set(game.teamAbbreviation, [...(schedule.get(game.teamAbbreviation) ?? []), game]);
  }
  for (const games of schedule.values()) games.sort((a, b) => Date.parse(a.startsAt!) - Date.parse(b.startsAt!) || a.id.localeCompare(b.id));
  const players = snapshot.players.filter(player => !scope.playerIds || scope.playerIds.includes(player.id)).map(player => {
    const selected = schedule.get(player.teamAbbreviation ?? "") ?? [];
    const opportunities = scope.mode === "next_n" ? selected.slice(0, scope.games) : selected;
    const targets = player.playerClass === "goalie" ? goalieTargets : skaterTargets;
    const games: GameExpectation[] = opportunities.map(game => {
      const forecast = byForecast.get(`${player.id}:${game.id}`);
      return { gameId: game.id, date: game.date, scheduledAt: game.startsAt!, team: game.teamAbbreviation,
        opponent: game.opponent, homeTeam: game.home ? game.teamAbbreviation : game.opponent,
        awayTeam: game.home ? game.opponent : game.teamAbbreviation,
        scheduleRevision: game.scheduleRevision!, rosterRevision: player.rosterRevision ?? null,
        appearanceProbability: participation(forecast, "appearance"), startProbability: participation(forecast, "start"),
        limitations: [...(forecast?.limitations ?? [])],
        targets: Object.fromEntries(targets.map(target => [target, targetView(forecast, target)])) };
    });
    const horizonComplete = data.evidence.schedule?.completeness === "complete"
      && !incompleteTeams.has(player.teamAbbreviation ?? "") && (scope.mode === "calendar" || games.length === scope.games);
    const totals = Object.fromEntries(targets.map(target => {
      const values = games.flatMap(game => finite(game.targets[target].expected) ? [game.targets[target].expected!] : []);
      const units = new Set(games.filter(game => finite(game.targets[target].expected)).map(game => game.targets[target].unit));
      const compatible = units.size <= 1;
      const coveredSum = compatible && values.length ? values.reduce((sum, value) => sum + value, 0) : null;
      return [target, { expected: horizonComplete && games.length > 0 && values.length === games.length ? coveredSum : null,
        coveredSum, coveredGames: values.length, requiredGames: games.length,
        unit: !compatible ? null : [...units][0] ?? (target === "GOALIE_MINUTES" || target === "TIME_ON_ICE_PER_GAME" ? "minutes" as const : "count" as const),
        reason: !compatible ? "incompatible_units" : !horizonComplete ? "incomplete_horizon"
          : !games.length ? "no_scheduled_opportunity" : values.length !== games.length ? "incomplete_target" : null }];
    }));
    const probabilitySum = (key: "appearanceProbability" | "startProbability") => horizonComplete && games.length
      && games.every(game => finite(game[key])) ? games.reduce((sum, game) => sum + game[key]!, 0) : null;
    const ratios: GameExpectationsResponse["players"][number]["ratios"] = {};
    if (player.playerClass === "goalie") for (const [key, numerator, denominator, multiplier] of [
      ["SAVE_PERCENTAGE", "SAVES_GOALIE", "SHOTS_AGAINST_GOALIE", 1],
      ["GOALS_AGAINST_AVERAGE", "GOALS_AGAINST_GOALIE", "GOALIE_MINUTES", 60],
    ] as const) {
      const n = totals[numerator].expected, d = totals[denominator].expected;
      const compatible = totals[numerator].unit === "count"
        && totals[denominator].unit === (denominator === "GOALIE_MINUTES" ? "minutes" : "count");
      ratios[key] = { value: compatible && n !== null && d !== null && d > 0 ? multiplier * n / d : null,
        numerator, denominator, interpretation: "ratio_of_expected_totals",
        reason: !compatible ? "incompatible_units" : n === null || d === null ? "incomplete_primitives" : d <= 0 ? "zero_denominator" : null };
    }
    return { playerId: player.id, nhlPlayerId: player.nhlId, teamId: player.nhlTeamId ?? null,
      name: player.name, team: player.teamAbbreviation, playerClass: player.playerClass, positions: player.eligiblePositions,
      scheduledOpportunities: games.length, requestedGames: scope.mode === "next_n" ? scope.games : null,
      horizonComplete, expectedAppearances: probabilitySum("appearanceProbability"), expectedStarts: probabilitySum("startProbability"),
      games, totals, ratios };
  });
  return { version: GAME_EXPECTATIONS_VERSION, readAsOf: now.toISOString(), scope,
    manifestId: data.forecastManifest?.id ?? null, baselineChecksum: data.forecastManifest?.baselineChecksum ?? null,
    players, limitations: [...new Set([
      "Scheduled opportunities are not expected appearances. Unknown participation remains unavailable.",
      "Conditional values are per appearance/start and permitted only for the stated conditional use; they are not horizon totals.",
      "Totals sum distinct admitted game-level expectations; incomplete heads or horizons remain unavailable.",
      "Ratios use summed expected primitives, not the expected value of a realized ratio. No calibrated uncertainty is implied.",
      ...(invalidStarts ? ["Some scheduled games have no verified start/revision; the schedule horizon is incomplete."] : []),
      ...Object.values(data.evidence).flatMap(source => source.limitations),
    ])] };
}
