import { describe, expect, it } from "vitest";
import {
  buildCanonicalSosRankings,
  buildCanonicalSosRankingsV2,
  type SosStandingRow,
  type TeamSosReaderRow,
} from "./strengthOfSchedule";
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

  it("serves v2 direct win% with canonical identity and keeps unknown unknown, ranked last", () => {
    const rankings = buildCanonicalSosRankingsV2(
      [
        v2Row(68),
        v2Row(1, { team_abbrev: "NJD", past_direct_win_pct: 0.5, future_direct_win_pct: 0.51 }),
        v2Row(53, { team_abbrev: "ARI", past_direct_win_pct: 0.9 }),
      ],
      teams,
    );
    expect(rankings.past).toEqual([
      { teamId: 1, team: "New Jersey Devils", abbreviation: "NJD", sos: 0.5 },
      { teamId: 68, team: "Utah Mammoth", abbreviation: "UTA", sos: 0.457 },
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
        v2Row(68, { cutoff_at: "2026-01-16T09:12:03.000Z", past_direct_win_pct: 0.6 }),
        v2Row(68),
        v2Row(68, { cutoff_at: "2026-01-17T09:12:03.000Z", sos_version: "descriptive-sos-v3" as any, past_direct_win_pct: 0.1 }),
      ],
      teams,
    );
    expect(rankings.past.map((row) => row.sos)).toEqual([0.6]);
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
