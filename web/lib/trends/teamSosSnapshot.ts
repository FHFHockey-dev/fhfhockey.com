import {
  computeDescriptiveSos,
  DESCRIPTIVE_SOS_VERSION,
  type SosFixture,
  type SosResult,
} from "./strengthOfScheduleContract";

/**
 * descriptive-sos-v2 writer adapter: NHL club schedules -> contract inputs ->
 * one stored row per team per snapshot. v1 rows in `sos_standings` stay as
 * issued history (rule 21); v2 rows go to their own versioned table.
 */
export const TEAM_SOS_TABLE = "team_sos_daily";
export const TEAM_SOS_PAST_VIEW = "past-retrospective" as const;

const FINAL_STATES = new Set(["OFF", "FINAL"]);
const PERIOD_TYPES = new Set(["REG", "OT", "SO"]);

export type ObservedClubSchedule = {
  /** Team whose schedule this is. */
  team: string;
  /** When this response was received; the only knowledge-time evidence we have. */
  observedAt: string;
  games: unknown;
};

type ScheduleState = { gameState: string | null; scheduleState: string | null };

type AdaptedGame = {
  gameId: number;
  home: string;
  away: string;
  startsAt: string;
  scheduleKnownAt: number;
  /** State at the latest observation (labels pending games). */
  stateObservedAt: number;
  state: ScheduleState;
  final: { winner: string; overtime: boolean; knownAt: number } | null;
};

export type SosAdapterIssues = {
  cancelledFixturesExcluded: number;
  postponedFixtures: number;
  finalsWithoutCompleteResult: number;
  conflictingFinals: number;
};

export type AdaptedClubSchedules = {
  fixtures: SosFixture[];
  results: SosResult[];
  games: Map<string, AdaptedGame>;
  issues: SosAdapterIssues;
  observedFrom: string;
  observedTo: string;
};

const obj = (value: unknown): Record<string, unknown> =>
  value && typeof value === "object" ? (value as Record<string, unknown>) : {};
const text = (value: unknown): string | null =>
  typeof value === "string" && value.trim() ? value.trim() : null;
const count = (value: unknown): number | null =>
  typeof value === "number" && Number.isInteger(value) && value >= 0 ? value : null;
const iso = (ms: number) => new Date(ms).toISOString();

/**
 * Regular-season games only (as v1). Finality is NHL FINAL/OFF at observation:
 * actual game-end and result-known times are not supplied, so a result counts
 * as known (and completed) from the first fetch that showed it final. That is
 * an upper bound, so the current cutoff is the only honest snapshot; there is
 * no historical as-of reconstruction. A final with missing or conflicting
 * scores or period type is not a known result and stays pending.
 */
export function adaptClubSchedules({
  seasonId,
  schedules,
}: {
  seasonId: number;
  schedules: ObservedClubSchedule[];
}): AdaptedClubSchedules {
  const games = new Map<string, AdaptedGame>();
  const finals = new Map<string, Array<{ winner: string; overtime: boolean; knownAt: number }>>();
  const incomplete = new Set<string>();
  const cancelledIds = new Set<string>();
  const observedTimes: number[] = [];

  for (const schedule of schedules) {
    const observed = Date.parse(schedule.observedAt);
    if (!Number.isFinite(observed)) throw new Error(`SOS schedule for ${schedule.team} has no observation time`);
    observedTimes.push(observed);
    if (!Array.isArray(schedule.games)) throw new Error(`SOS schedule for ${schedule.team} is not a game list`);
    for (const raw of schedule.games) {
      const game = obj(raw);
      if (game.gameType !== 2) continue;
      const gameId = game.id;
      const home = text(obj(game.homeTeam).abbrev);
      const away = text(obj(game.awayTeam).abbrev);
      const startsAt = text(game.startTimeUTC);
      const startMs = startsAt ? Date.parse(startsAt) : NaN;
      if (typeof gameId !== "number" || !Number.isInteger(gameId) || game.season !== seasonId ||
          !home || !away || home === away || !startsAt ||
          !/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d+)?Z$/.test(startsAt) || !Number.isFinite(startMs) ||
          (home !== schedule.team && away !== schedule.team)) {
        throw new Error(`SOS schedule for ${schedule.team} has an unverifiable regular-season game`);
      }
      const id = String(gameId);
      const state = { gameState: text(game.gameState), scheduleState: text(game.gameScheduleState) };
      if (state.scheduleState === "CNCL") {
        cancelledIds.add(id);
        continue;
      }
      const existing = games.get(id);
      if (existing && (existing.home !== home || existing.away !== away ||
          Date.parse(existing.startsAt) !== startMs)) {
        throw new Error(`SOS game ${id} differs between club schedules; resolve the schedule revision first`);
      }
      if (!existing) {
        games.set(id, { gameId, home, away, startsAt: iso(startMs), scheduleKnownAt: observed,
          stateObservedAt: observed, state, final: null });
      } else {
        existing.scheduleKnownAt = Math.min(existing.scheduleKnownAt, observed);
        if (observed >= existing.stateObservedAt) {
          existing.stateObservedAt = observed;
          existing.state = state;
        }
      }
      if (!state.gameState || !FINAL_STATES.has(state.gameState)) continue;
      const homeScore = count(obj(game.homeTeam).score);
      const awayScore = count(obj(game.awayTeam).score);
      const period = text(obj(game.gameOutcome).lastPeriodType);
      if (homeScore === null || awayScore === null || homeScore === awayScore ||
          !period || !PERIOD_TYPES.has(period) || observed < startMs) {
        incomplete.add(id);
        continue;
      }
      const list = finals.get(id) ?? [];
      list.push({ winner: homeScore > awayScore ? home : away, overtime: period !== "REG", knownAt: observed });
      finals.set(id, list);
    }
  }
  if (!observedTimes.length) throw new Error("No SOS club schedules were observed");

  cancelledIds.forEach((id) => games.delete(id));
  let conflicting = 0;
  let withoutResult = 0;
  let postponed = 0;
  games.forEach((game, id) => {
    if (game.state.scheduleState === "PPD") postponed += 1;
    const copies = finals.get(id) ?? [];
    if (!copies.length) {
      if (incomplete.has(id)) withoutResult += 1;
      return;
    }
    const agree = copies.every((copy) => copy.winner === copies[0].winner && copy.overtime === copies[0].overtime);
    if (!agree || incomplete.has(id)) {
      conflicting += 1;
      return;
    }
    game.final = { ...copies[0], knownAt: Math.min(...copies.map((copy) => copy.knownAt)) };
  });

  const fixtures: SosFixture[] = [];
  const results: SosResult[] = [];
  [...games.values()]
    .sort((a, b) => a.gameId - b.gameId)
    .forEach((game) => {
      const fixture: SosFixture = {
        id: String(game.gameId),
        teamA: game.home,
        teamB: game.away,
        startsAt: game.startsAt,
        scheduleKnownAt: iso(game.scheduleKnownAt),
      };
      fixtures.push(fixture);
      if (game.final) {
        results.push({
          ...fixture,
          winner: game.final.winner,
          overtime: game.final.overtime,
          completedAt: iso(game.final.knownAt),
          resultKnownAt: iso(game.final.knownAt),
        });
      }
    });

  return {
    fixtures,
    results,
    games,
    issues: {
      cancelledFixturesExcluded: cancelledIds.size,
      postponedFixtures: postponed,
      finalsWithoutCompleteResult: withoutResult,
      conflictingFinals: conflicting,
    },
    observedFrom: iso(Math.min(...observedTimes)),
    observedTo: iso(Math.max(...observedTimes)),
  };
}

/** The cutoff follows every observation, so each observed final is known before it. */
export function snapshotCutoff(adapted: AdaptedClubSchedules, nowMs: number): string {
  return iso(Math.max(nowMs, Date.parse(adapted.observedTo) + 1));
}

type OpponentEntry = { game_id: number; opponent: string; starts_at: string };
type PendingEntry = OpponentEntry & { game_state: string | null; schedule_state: string | null };

export type TeamSosSnapshotRow = {
  season_id: number;
  snapshot_date: string;
  team_id: number;
  team_abbrev: string;
  sos_version: typeof DESCRIPTIVE_SOS_VERSION;
  past_view: typeof TEAM_SOS_PAST_VIEW;
  cutoff_at: string;
  past_fixtures: number;
  pending_fixtures: number;
  future_fixtures: number;
  past_direct_supported: number;
  past_indirect_supported: number;
  future_direct_supported: number;
  future_indirect_supported: number;
  past_direct_win_pct: number | null;
  past_indirect_win_pct: number | null;
  past_direct_points_pct: number | null;
  past_indirect_points_pct: number | null;
  future_direct_win_pct: number | null;
  future_indirect_win_pct: number | null;
  future_direct_points_pct: number | null;
  future_indirect_points_pct: number | null;
  past_opponents: OpponentEntry[];
  future_opponents: OpponentEntry[];
  pending_games: PendingEntry[];
  evidence: Record<string, unknown>;
};

export const TEAM_SOS_FINALITY_STATEMENT =
  "NHL FINAL/OFF at observation. Actual game-end and result-known times are not supplied, so a result counts as known from the first schedule fetch that showed it final. Current cutoff only; no historical as-of claim.";

export function buildTeamSosSnapshotRows({
  seasonId,
  snapshotDate,
  cutoff,
  teams,
  adapted,
  schedulesFetched,
}: {
  seasonId: number;
  snapshotDate: string;
  cutoff: string;
  teams: Array<{ abbrev: string; id: number }>;
  adapted: AdaptedClubSchedules;
  schedulesFetched: number;
}): TeamSosSnapshotRow[] {
  const evidence = {
    source: "NHL club-schedule-season, regular season",
    schedulesFetched,
    observedFrom: adapted.observedFrom,
    observedTo: adapted.observedTo,
    finality: TEAM_SOS_FINALITY_STATEMENT,
    actualEndTimesSupplied: false,
    ...adapted.issues,
  };
  const entry = (gameId: string, opponent: string): OpponentEntry => {
    const game = adapted.games.get(gameId)!;
    return { game_id: game.gameId, opponent, starts_at: game.startsAt };
  };
  return teams.map(({ abbrev, id }) => {
    const fixtures = adapted.fixtures.filter((game) => game.teamA === abbrev || game.teamB === abbrev);
    const run = (view: "past-retrospective" | "future", metric: "win-pct" | "points-pct") =>
      computeDescriptiveSos({ team: abbrev, fixtures, results: adapted.results, cutoff, view, metric });
    const pastWin = run(TEAM_SOS_PAST_VIEW, "win-pct");
    const pastPoints = run(TEAM_SOS_PAST_VIEW, "points-pct");
    const futureWin = run("future", "win-pct");
    const futurePoints = run("future", "points-pct");
    return {
      season_id: seasonId,
      snapshot_date: snapshotDate,
      team_id: id,
      team_abbrev: abbrev,
      sos_version: DESCRIPTIVE_SOS_VERSION,
      past_view: TEAM_SOS_PAST_VIEW,
      cutoff_at: cutoff,
      past_fixtures: pastWin.fixtures,
      pending_fixtures: pastWin.pendingFixtures,
      future_fixtures: futureWin.fixtures,
      past_direct_supported: pastWin.directSupportedFixtures,
      past_indirect_supported: pastWin.indirectSupportedFixtures,
      future_direct_supported: futureWin.directSupportedFixtures,
      future_indirect_supported: futureWin.indirectSupportedFixtures,
      past_direct_win_pct: pastWin.direct,
      past_indirect_win_pct: pastWin.indirect,
      past_direct_points_pct: pastPoints.direct,
      past_indirect_points_pct: pastPoints.indirect,
      future_direct_win_pct: futureWin.direct,
      future_indirect_win_pct: futureWin.indirect,
      future_direct_points_pct: futurePoints.direct,
      future_indirect_points_pct: futurePoints.indirect,
      past_opponents: pastWin.observations.map((item) => entry(item.fixtureId, item.opponent)),
      future_opponents: futureWin.observations.map((item) => entry(item.fixtureId, item.opponent)),
      pending_games: pastWin.pendingFixtureIds.map((gameId) => {
        const game = adapted.games.get(gameId)!;
        return {
          ...entry(gameId, game.home === abbrev ? game.away : game.home),
          game_state: game.state.gameState,
          schedule_state: game.state.scheduleState,
        };
      }),
      evidence,
    };
  });
}
