import { describe, expect, it } from "vitest";
import {
  buildCanonicalSosRankings,
  type SosStandingRow,
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

const at = (day: number, hour = 0) =>
  `2026-01-${String(day).padStart(2, "0")}T${String(hour).padStart(2, "0")}:00:00.000Z`;
const fixture = (id: string, teamA: string, teamB: string, day: number): SosFixture =>
  ({ id, teamA, teamB, startsAt: at(day), scheduleKnownAt: at(1) });
const result = (id: string, winner: string, loser: string, day: number, overtime = false): SosResult =>
  ({ ...fixture(id, winner, loser, day), winner, overtime, completedAt: at(day, 2), resultKnownAt: at(day, 3) });
const descriptive = (fixtures: SosFixture[], results: SosResult[], overrides: Partial<Parameters<typeof computeDescriptiveSos>[0]> = {}) =>
  computeDescriptiveSos({ team: "A", fixtures, results, cutoff: at(10), view: "past-retrospective", metric: "win-pct", ...overrides });

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
    expect(score.version).toBe("descriptive-sos-v1");
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
