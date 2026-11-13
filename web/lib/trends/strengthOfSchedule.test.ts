import { describe, expect, it } from "vitest";
import {
  buildCanonicalSosRankings,
  buildCanonicalSosRankingsV2,
  computeSosRatingsV2,
  formatSosAsOfDate,
  SOS_HEADLINE,
  sosHeadline,
  type SosStandingRow,
  type TeamSosReaderRow,
} from "./strengthOfSchedule";
import { adaptClubSchedules, buildTeamSosSnapshotRows, snapshotCutoff } from "./teamSosSnapshot";
import { computeUnderlyingStatsTeamScheduleStrength } from "../underlying-stats/teamScheduleStrength";
// The event-level version is deliberately separate from legacy pooled snapshots.
import {
  computeDescriptiveSos,
  recordPercentage,
  type SosFixture,
  type SosResult,
} from "./strengthOfScheduleContract";

function standing(
  teamId: number,
  teamName: string,
  gameDate: string,
  pastWins: number,
): SosStandingRow {
  return {
    season_id: 20252026,
    game_date: gameDate,
    team_id: teamId,
    team_name: teamName,
    team_abbrev: teamId === 53 ? "ARI" : "UTA",
    past_opponent_total_wins: pastWins,
    past_opponent_total_losses: 10,
    past_opponent_total_ot_losses: 0,
    future_opponent_total_wins: 5,
    future_opponent_total_losses: 5,
    future_opponent_total_ot_losses: 0,
  };
}

describe("buildCanonicalSosRankings", () => {
  it("keeps only canonical current membership and uses canonical rendering identity", () => {
    const rankings = buildCanonicalSosRankings(
      [
        standing(53, "Arizona Coyotes", "2024-04-17", 30),
        standing(59, "Utah Hockey Club", "2025-04-17", 25),
        standing(68, "stale source name", "2026-01-01", 10),
        standing(68, "another stale source name", "2026-01-02", 20),
      ],
      [{ id: 68, name: "Utah Mammoth", abbreviation: "UTA" }],
    );

    expect(rankings.past).toEqual([
      {
        teamId: 68,
        team: "Utah Mammoth",
        abbreviation: "UTA",
        sos: 0.667,
      },
    ]);
    expect(rankings.future).toEqual([
      {
        teamId: 68,
        team: "Utah Mammoth",
        abbreviation: "UTA",
        sos: 0.5,
      },
    ]);
  });

  it("uses the latest non-empty row rather than a newer empty snapshot", () => {
    const empty = standing(68, "Utah Mammoth", "2026-01-03", 0);
    empty.past_opponent_total_losses = 0;
    empty.future_opponent_total_wins = 0;
    empty.future_opponent_total_losses = 0;

    const rankings = buildCanonicalSosRankings(
      [standing(68, "Utah Mammoth", "2026-01-02", 20), empty],
      [{ id: 68, name: "Utah Mammoth", abbreviation: "UTA" }],
    );

    expect(rankings.past[0]?.sos).toBe(0.667);
  });
});

function v2Row(teamId: number, overrides: Partial<TeamSosReaderRow> = {}): TeamSosReaderRow {
  return {
    season_id: 20252026,
    snapshot_date: "2026-01-14",
    team_id: teamId,
    team_abbrev: "UTA",
    sos_version: "descriptive-sos-v2",
    past_view: "past-retrospective",
    cutoff_at: "2026-01-15T09:12:03.000Z",
    past_fixtures: 40,
    pending_fixtures: 1,
    future_fixtures: 42,
    past_direct_supported: 40,
    future_direct_supported: 42,
    past_direct_win_pct: 0.4567,
    past_indirect_win_pct: 0.5,
    past_direct_points_pct: 0.55,
    past_indirect_points_pct: 0.5,
    future_direct_win_pct: null,
    future_indirect_win_pct: null,
    future_direct_points_pct: null,
    future_indirect_points_pct: null,
    ...overrides,
  };
}

describe("buildCanonicalSosRankingsV2", () => {
  const teams = [
    { id: 68, name: "Utah Mammoth", abbreviation: "UTA" },
    { id: 1, name: "New Jersey Devils", abbreviation: "NJD" },
  ];

  it("serves v2 direct points% with canonical identity and keeps unknown unknown, ranked last", () => {
    const rankings = buildCanonicalSosRankingsV2(
      [
        v2Row(68),
        // Win% would rank UTA (0.4567) below NJD (0.6); points% ranks UTA first.
        v2Row(1, { team_abbrev: "NJD", past_direct_win_pct: 0.6, past_direct_points_pct: 0.5, future_direct_points_pct: 0.51 }),
        v2Row(53, { team_abbrev: "ARI", past_direct_points_pct: 0.9 }),
      ],
      teams,
    );
    expect(rankings.past).toEqual([
      { teamId: 68, team: "Utah Mammoth", abbreviation: "UTA", sos: 0.55 },
      { teamId: 1, team: "New Jersey Devils", abbreviation: "NJD", sos: 0.5 },
    ]);
    // v1 turned missing totals into 0; v2 keeps the unknown future as null.
    expect(rankings.future.map((row) => [row.abbreviation, row.sos])).toEqual([
      ["NJD", 0.51],
      ["UTA", null],
    ]);
  });

  it("ignores other versions and uses the latest cutoff per team", () => {
    const rankings = buildCanonicalSosRankingsV2(
      [
        v2Row(68, { cutoff_at: "2026-01-16T09:12:03.000Z", past_direct_points_pct: 0.6 }),
        v2Row(68),
        v2Row(68, { cutoff_at: "2026-01-17T09:12:03.000Z", sos_version: "descriptive-sos-v3" as any, past_direct_points_pct: 0.1 }),
      ],
      teams,
    );
    expect(rankings.past.map((row) => row.sos)).toEqual([0.6]);
  });
});

/**
 * Decision 146 end to end: NHL club schedules -> writer row -> every reader.
 * B beat D in regulation and lost to E in overtime: win% 0.5, points% 0.75.
 */
describe("decision 146: shared points% SOS base", () => {
  const seasonId = 20252026;
  const nhlGame = (id: number, home: string, away: string, day: number,
    score?: { home: number; away: number; period: "REG" | "OT" | "SO" }) => ({
    id, season: seasonId, gameType: 2,
    startTimeUTC: `2026-01-${String(day).padStart(2, "0")}T00:00:00Z`,
    gameState: score ? "OFF" : "FUT", gameScheduleState: "OK",
    homeTeam: { abbrev: home, ...(score ? { score: score.home } : {}) },
    awayTeam: { abbrev: away, ...(score ? { score: score.away } : {}) },
    ...(score ? { gameOutcome: { lastPeriodType: score.period } } : {}),
  });
  const teams = ["A", "B", "C", "D", "E"].map((abbrev, index) => ({ abbrev, id: index + 1 }));
  const snapshot = (games: ReturnType<typeof nhlGame>[]) => {
    const observedAt = "2026-01-10T08:00:00.000Z";
    const adapted = adaptClubSchedules({
      seasonId,
      schedules: teams.map(({ abbrev }) => ({ team: abbrev, observedAt,
        games: games.filter((game) => game.homeTeam.abbrev === abbrev || game.awayTeam.abbrev === abbrev) })),
    });
    const rows = buildTeamSosSnapshotRows({ seasonId, snapshotDate: "2026-01-10",
      cutoff: snapshotCutoff(adapted, Date.parse("2026-01-10T09:12:00.000Z")),
      teams, adapted, schedulesFetched: teams.length });
    return { rows, focal: rows.find((row) => row.team_abbrev === "A")! };
  };
  const completed = [
    nhlGame(1, "B", "D", 2, { home: 3, away: 1, period: "REG" }),
    nhlGame(2, "E", "B", 3, { home: 3, away: 2, period: "OT" }),
    nhlGame(3, "C", "D", 4, { home: 2, away: 0, period: "REG" }),
    nhlGame(4, "E", "C", 5, { home: 4, away: 1, period: "REG" }),
  ];
  const focalPast = nhlGame(5, "A", "B", 6, { home: 2, away: 1, period: "REG" });
  const focalFuture = nhlGame(6, "C", "A", 20);
  const canonicalTeams = teams.map(({ abbrev, id }) => ({ id, name: abbrev, abbreviation: abbrev }));

  it("an overtime loss separates points% from win%, and every surface reads points%", () => {
    const { rows, focal } = snapshot([...completed, focalPast, focalFuture]);
    // Writer stores both; no migration or writer change was needed.
    expect(focal.past_direct_win_pct).toBe(0.5);
    expect(focal.past_direct_points_pct).toBe(0.75);
    expect(focal.future_direct_points_pct).toBe(0.5);
    expect(focal.past_indirect_points_pct).toBe(0.5);

    // API (and the dashboard type): headline score is points%, win% secondary.
    const api = computeSosRatingsV2(rows).find((rating) => rating.team === "A")!;
    expect(api.combinedPointsPct).toBeCloseTo(0.625, 12);
    expect(api.sosScore).toBe(62.5);
    expect(api.combinedWinPct).toBeCloseTo(0.5, 12);
    // Trends: the power-ladder column reads the headline from the API bucket.
    expect(sosHeadline(api.past)).toBe(0.75);
    expect(sosHeadline(api.future)).toBe(0.5);
    // Stats placeholder.
    const placeholder = buildCanonicalSosRankingsV2(rows, canonicalTeams);
    expect(placeholder.past.find((row) => row.abbreviation === "A")?.sos).toBe(0.75);
    expect(placeholder.future.find((row) => row.abbreviation === "A")?.sos).toBe(0.5);
    // Team landing (/underlying-stats): same base, its own 2:1 weighting.
    const landing = computeUnderlyingStatsTeamScheduleStrength({ date: "2026-01-10", scheduleRows: rows }).get("A")!;
    expect(landing.past.directOpponentPointPct).toBe(sosHeadline(api.past));
    expect(landing.past.indirectOpponentPointPct).toBe(0.5);
    expect(landing.past.sos).toBeCloseTo((2 * 0.75 + 0.5) / 3, 12);
    expect(landing.future.directOpponentPointPct).toBe(sosHeadline(api.future));
    expect(SOS_HEADLINE.metric).toBe("points-pct");
  });

  it("with no completed games every surface is unavailable, never 0%", () => {
    const unplayed = (game: ReturnType<typeof nhlGame>) =>
      nhlGame(game.id, game.homeTeam.abbrev, game.awayTeam.abbrev, Number(game.startTimeUTC.slice(8, 10)));
    const { rows, focal } = snapshot([...completed, focalPast, focalFuture].map(unplayed));
    expect(focal).toMatchObject({ past_fixtures: 0, pending_fixtures: 1, future_fixtures: 1,
      past_direct_points_pct: null, future_direct_points_pct: null });
    const api = computeSosRatingsV2(rows).find((rating) => rating.team === "A")!;
    expect([api.combinedPointsPct, api.sosScore, sosHeadline(api.past), sosHeadline(api.future)])
      .toEqual([null, null, null, null]);
    const placeholder = buildCanonicalSosRankingsV2(rows, canonicalTeams);
    expect(placeholder.past.every((row) => row.sos === null)).toBe(true);
    expect(placeholder.future.every((row) => row.sos === null)).toBe(true);
    const landing = computeUnderlyingStatsTeamScheduleStrength({ date: "2026-01-10", scheduleRows: rows }).get("A")!;
    expect([landing.sos, landing.past.sos, landing.future.sos]).toEqual([null, null, null]);
  });

  it("labels the snapshot date as an as-of date, never as known before each game", () => {
    expect(formatSosAsOfDate("2026-11-13")).toBe("Nov 13, 2026");
    expect(formatSosAsOfDate(null)).toBeNull();
    expect(formatSosAsOfDate("not-a-date")).toBeNull();
    expect(SOS_HEADLINE.asOfNote).toContain("not as known before each game");
  });
});

const at = (day: number, hour = 0) =>
  `2026-01-${String(day).padStart(2, "0")}T${String(hour).padStart(2, "0")}:00:00.000Z`;
const fixture = (id: string, teamA: string, teamB: string, day: number): SosFixture =>
  ({ id, teamA, teamB, startsAt: at(day), scheduleKnownAt: at(1) });
const result = (id: string, winner: string, loser: string, day: number, overtime = false): SosResult =>
  ({ ...fixture(id, winner, loser, day), winner, overtime, completedAt: at(day, 2), resultKnownAt: at(day, 3) });
/**
 * Past fixtures need their own final result (decision 21); these fixtures get
 * one (focal results never enter opposition quality) unless one is supplied.
 */
const withFinals = (fixtures: SosFixture[], results: SosResult[]) => {
  const ids = new Set(results.map((game) => game.id));
  return [...results, ...fixtures.filter((game) => !ids.has(game.id) && game.startsAt < at(10))
    .map((game) => ({ ...game, winner: game.teamA, overtime: false,
      completedAt: game.startsAt.replace("T00:", "T02:"), resultKnownAt: game.startsAt.replace("T00:", "T03:") }))];
};
const descriptive = (fixtures: SosFixture[], results: SosResult[], overrides: Partial<Parameters<typeof computeDescriptiveSos>[0]> = {}) =>
  computeDescriptiveSos({ team: "A", fixtures, results: withFinals(fixtures, results), cutoff: at(10), view: "past-retrospective", metric: "win-pct", ...overrides });

describe("descriptive-sos-v1", () => {
  it("distinguishes win%, points%, true zero, and unknown record fields", () => {
    expect(recordPercentage(0, 1, 1, "win-pct")).toBe(0);
    expect(recordPercentage(0, 1, 1, "points-pct")).toBe(0.25);
    expect(recordPercentage(0, 0, 0, "points-pct")).toBeNull();
    expect(recordPercentage(1, null, 0, "points-pct")).toBeNull();
    expect(recordPercentage(-1, 2, 0, "win-pct")).toBeNull();
    expect(recordPercentage(1.5, 1, 0, "win-pct")).toBeNull();
  });

  it("weights repeated fixtures, not pooled opponent-history denominators", () => {
    const score = descriptive([
      fixture("ab1", "A", "B", 7), fixture("ab2", "A", "B", 8), fixture("ac", "A", "C", 9),
    ], [result("bd", "B", "D", 2), result("eb", "E", "B", 3),
      result("cd", "C", "D", 2), result("ce", "C", "E", 3), result("cf", "C", "F", 4)]);
    expect(score.direct).toBeCloseTo((0.5 + 0.5 + 1) / 3, 12);
    expect(score.observations.map((item) => item.opponentRecordGames)).toEqual([2, 2, 3]);
    expect(score.fixtures).toBe(3);
    expect(score.version).toBe("descriptive-sos-v2");
    expect(score.kind).toBe("descriptive-schedule");
  });

  it("excludes all focal-team results from both direct and indirect quality", () => {
    const fixtures = [fixture("ab", "A", "B", 8)];
    const base = [result("bc", "B", "C", 2), result("cd", "C", "D", 3)];
    const score = descriptive(fixtures, base);
    const changed = descriptive(fixtures, [...base, result("ab-result", "A", "B", 4), result("ac-result", "A", "C", 5)]);
    expect(score.direct).toBe(1);
    expect(score.indirect).toBe(1);
    expect(changed.direct).toBe(score.direct);
    expect(changed.indirect).toBe(score.indirect);
  });

  it("separates pre-fixture knowledge from retrospective and future views", () => {
    const fixtures = [fixture("ab", "A", "B", 5), fixture("future", "A", "B", 12)];
    const history = [result("bc", "B", "C", 2), result("db", "D", "B", 6)];
    expect(descriptive(fixtures, history, { view: "past-as-known-then" }).direct).toBe(1);
    expect(descriptive(fixtures, history).direct).toBe(0.5);
    const future = descriptive(fixtures, history, { view: "future" });
    expect(future.direct).toBe(0.5);
    expect(future.observations[0].fixtureId).toBe("future");
    expect(future.observations[0].recordCutoff).toBe(at(10));
  });

  it("requires result availability strictly before the record cutoff", () => {
    const history = result("bc", "B", "C", 9);
    history.resultKnownAt = at(10);
    const fixtures = [fixture("ab", "A", "B", 8)];
    expect(descriptive(fixtures, [history]).direct).toBeNull();
    history.resultKnownAt = at(9, 23);
    expect(descriptive(fixtures, [history]).direct).toBe(1);
    expect(descriptive(fixtures, [history], { view: "past-as-known-then" }).direct).toBeNull();
  });

  it("requires the fixture itself to have been known strictly before cutoff", () => {
    const future = fixture("ab", "A", "B", 12);
    future.scheduleKnownAt = at(10);
    expect(descriptive([future], [], { view: "future" }).fixtures).toBe(0);
    future.scheduleKnownAt = at(9);
    expect(descriptive([future], [], { view: "future" }).fixtures).toBe(1);
    const backfilled = fixture("past", "A", "B", 5);
    backfilled.scheduleKnownAt = at(6);
    expect(descriptive([backfilled], []).fixtures).toBe(1);
    expect(descriptive([backfilled], [], { view: "past-as-known-then" }).fixtures).toBe(0);
  });

  it("keeps unsupported and disconnected observations explicit without zero or prior imputation", () => {
    const score = descriptive([fixture("ab", "A", "B", 8), fixture("ac", "A", "C", 9)],
      [result("db", "D", "B", 2), result("ef", "E", "F", 3)]);
    expect(score.directSupportedFixtures).toBe(1);
    expect(score.direct).toBeNull();
    expect(score.observations[0].direct).toBe(0);
    expect(score.observations[1].direct).toBeNull();
    expect(score.indirect).toBeNull();
    expect(descriptive([], []).direct).toBeNull();
    expect(descriptive([], []).fixtures).toBe(0);
  });

  it("counts only final fixtures as past; started or postponed ones are pending (decision 21)", () => {
    const final = fixture("final", "A", "B", 5);
    const started = { ...fixture("live", "A", "C", 9), startsAt: at(9, 23) };
    const postponed = fixture("ppd", "A", "D", 7);
    const score = computeDescriptiveSos({
      team: "A", fixtures: [final, started, postponed],
      results: [result("final", "A", "B", 5), result("bc", "B", "C", 2), result("cd", "C", "D", 3), result("db", "D", "B", 4)],
      cutoff: at(10), view: "past-retrospective", metric: "win-pct",
    });
    expect(score.fixtures).toBe(1);
    expect(score.observations.map((item) => item.fixtureId)).toEqual(["final"]);
    expect(score.pendingFixtureIds).toEqual(["live", "ppd"]);
    expect(score.pendingFixtures).toBe(2);
  });

  it("rejects invalid calendars, conflicting identities, duplicates and impossible chronology", () => {
    const game = fixture("ab", "A", "B", 8);
    expect(() => descriptive([game, game], [])).toThrow("Duplicate");
    expect(() => descriptive([], [], { cutoff: "2026-01-10" })).toThrow("timestamp");
    expect(() => descriptive([], [], { cutoff: "2026-01-10T00:00:00" })).toThrow("timestamp");
    expect(() => descriptive([], [], { cutoff: "2026-02-30T00:00:00Z" })).toThrow("timestamp");
    expect(() => descriptive([], [], { cutoff: "2025-02-29T00:00:00Z" })).toThrow("timestamp");
    expect(() => descriptive([], [], { cutoff: "2026-01-10T24:00:00Z" })).toThrow("timestamp");
    expect(() => descriptive([], [], { cutoff: "2024-02-29T00:00:00Z" })).not.toThrow();
    expect(() => descriptive([game], [result("ab", "A", "C", 8)])).toThrow("identity mismatch");
    expect(() => descriptive([game], [result("ab", "A", "B", 9)])).toThrow("identity mismatch");
    expect(() => descriptive([game], [result("ab", "B", "A", 8)])).not.toThrow();
    const history = result("bc", "B", "C", 2);
    expect(() => descriptive([], [history, history])).toThrow("duplicate");
    history.resultKnownAt = at(1);
    expect(() => descriptive([], [history])).toThrow("chronology");
  });
});
