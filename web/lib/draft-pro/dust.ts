import {
  calculateCandidateDust,
  classifyDustRisk,
  evaluateRosterSchedule,
  prepareTeamSchedule,
  rankAlternativeRecommendations,
  type CandidateDustEvaluation,
  type OptimizerPlayer,
  type TeamScheduleGame,
} from "lib/rosterScheduleOptimizer";

export const DRAFT_PRO_DUST_STALE_AFTER_MS = 36 * 60 * 60 * 1000;

export type DraftProDustPlayer = OptimizerPlayer & { projectionSeason: string };

export type DraftProDustInput = {
  season: string;
  lineupMode: "daily" | "weekly";
  roster: readonly DraftProDustPlayer[];
  candidates: readonly DraftProDustPlayer[];
  rosterSlots: Readonly<Record<string, number>>;
  schedule: {
    season: string;
    fetchedAt: string | null;
    games: readonly (TeamScheduleGame & { season: string })[];
  };
};

export type DraftProDustState =
  | "ready"
  | "empty_roster"
  | "weekly_lock_unsupported"
  | "stale_schedule"
  | "season_mismatch"
  | "unknown_team";

export type DraftProDustInsight = {
  playerId: string;
  playerName: string | null;
  marginalBenchGames: number;
  activeGamesAdded: number;
  candidateScheduledGames: number;
  dustRate: number;
  risk: ReturnType<typeof classifyDustRisk>["label"];
  alternatives: readonly {
    playerId: string;
    playerName: string | null;
    marginalBenchGames: number;
    activeGamesAdded: number;
    dustReduction: number;
    valueDifference: number;
  }[];
};

export type DraftProDustResult = {
  state: DraftProDustState;
  freshness: string | null;
  baseline: ReturnType<typeof evaluateRosterSchedule> | null;
  insights: readonly DraftProDustInsight[];
  diagnostics: readonly string[];
};

/** A static illustration for free accounts; it never calls premium calculation. */
export const DRAFT_PRO_DUST_FREE_EXAMPLE = Object.freeze({
  playerName: "Illustrative winger",
  marginalBenchGames: 3,
  activeGamesAdded: 5,
  candidateScheduledGames: 8,
  risk: "moderate" as const,
});

function scheduleIsFresh(fetchedAt: string | null, now: Date) {
  const timestamp = fetchedAt ? Date.parse(fetchedAt) : Number.NaN;
  return Number.isFinite(timestamp) && timestamp <= now.getTime() && now.getTime() - timestamp <= DRAFT_PRO_DUST_STALE_AFTER_MS;
}

function seasonMatches(input: DraftProDustInput) {
  return input.season === input.schedule.season &&
    input.roster.every((player) => player.projectionSeason === input.season) &&
    input.candidates.every((player) => player.projectionSeason === input.season) &&
    input.schedule.games.every((game) => game.season === input.season);
}

function emptyResult(
  state: Exclude<DraftProDustState, "ready">,
  freshness: string | null,
  diagnostics: readonly string[],
): DraftProDustResult {
  return { state, freshness, baseline: null, insights: [], diagnostics };
}

export function evaluateDraftProDust(
  input: DraftProDustInput,
  now = new Date(),
): DraftProDustResult {
  if (input.lineupMode !== "daily") {
    return emptyResult("weekly_lock_unsupported", input.schedule.fetchedAt, ["DUST uses exact daily lineup assignment; weekly-lock leagues are not supported."]);
  }
  if (input.roster.length === 0) {
    return emptyResult("empty_roster", input.schedule.fetchedAt, ["Add roster players to calculate DUST."]);
  }
  if (!seasonMatches(input)) {
    return emptyResult("season_mismatch", input.schedule.fetchedAt, ["Projection and schedule seasons must match exactly."]);
  }
  if (!scheduleIsFresh(input.schedule.fetchedAt, now)) {
    return emptyResult("stale_schedule", input.schedule.fetchedAt, ["Schedule data is stale; refresh it before relying on DUST."]);
  }

  const schedule = prepareTeamSchedule(input.schedule.games);
  const baseline = evaluateRosterSchedule({
    roster: input.roster,
    rosterSlots: input.rosterSlots,
    schedule,
    lineupMode: "daily",
  });
  if (baseline.diagnostics.some((diagnostic) => diagnostic.code === "UNKNOWN_TEAM" || diagnostic.code === "MISSING_TEAM")) {
    return { state: "unknown_team", freshness: input.schedule.fetchedAt, baseline, insights: [], diagnostics: baseline.diagnostics.map((diagnostic) => diagnostic.message) };
  }

  const rosterIds = new Set(input.roster.map((player) => player.id));
  const calculated = input.candidates
    .filter((player) => !rosterIds.has(player.id))
    .map((player) => calculateCandidateDust({ roster: input.roster, rosterSlots: input.rosterSlots, schedule, lineupMode: "daily" }, player, baseline));
  if (calculated.some((candidate) => candidate.diagnostics.some((diagnostic) => diagnostic.code === "UNKNOWN_TEAM" || diagnostic.code === "MISSING_TEAM"))) {
    return { state: "unknown_team", freshness: input.schedule.fetchedAt, baseline, insights: [], diagnostics: calculated.flatMap((candidate) => candidate.diagnostics.map((diagnostic) => diagnostic.message)) };
  }
  const evaluated = calculated
    .filter((candidate) => !candidate.diagnostics.some((diagnostic) => diagnostic.severity === "error"));
  const insights = evaluated.map((candidate) => toInsight(candidate, evaluated, input.rosterSlots));
  insights.sort((left, right) =>
    right.activeGamesAdded - left.activeGamesAdded ||
    candidateValue(input.candidates, right.playerId) - candidateValue(input.candidates, left.playerId) ||
    left.playerId.localeCompare(right.playerId),
  );
  return {
    state: "ready",
    freshness: input.schedule.fetchedAt,
    baseline,
    insights,
    diagnostics: baseline.diagnostics.map((diagnostic) => diagnostic.message),
  };
}

function candidateValue(candidates: readonly DraftProDustPlayer[], id: string) {
  return candidates.find((candidate) => candidate.id === id)?.value ?? 0;
}

function toInsight(
  candidate: CandidateDustEvaluation,
  alternatives: readonly CandidateDustEvaluation[],
  rosterSlots: Readonly<Record<string, number>>,
): DraftProDustInsight {
  const risk = classifyDustRisk(candidate.marginalDustGames, candidate.candidateScheduledGames);
  const rankedAlternatives = rankAlternativeRecommendations(candidate, alternatives, rosterSlots)
    .slice(0, 3)
    .map((alternative) => ({
      playerId: alternative.player.id,
      playerName: alternative.player.name ?? null,
      marginalBenchGames: alternative.dust.marginalDustGames,
      activeGamesAdded: alternative.dust.activeGamesAdded,
      dustReduction: alternative.dustImprovement,
      valueDifference: alternative.valueDifference,
    }));
  return {
    playerId: candidate.player.id,
    playerName: candidate.player.name ?? null,
    marginalBenchGames: candidate.marginalDustGames,
    activeGamesAdded: candidate.activeGamesAdded,
    candidateScheduledGames: candidate.candidateScheduledGames,
    dustRate: candidate.dustRate,
    risk: risk.label,
    alternatives: rankedAlternatives,
  };
}
