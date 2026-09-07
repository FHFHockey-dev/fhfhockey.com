import { describe, expect, it } from "vitest";

import { calculateCandidateDust, evaluateRosterSchedule, prepareTeamSchedule } from "lib/rosterScheduleOptimizer";
import { DRAFT_PRO_DUST_STALE_AFTER_MS, evaluateDraftProDust, type DraftProDustInput } from "./dust";

const now = new Date("2026-09-07T12:00:00.000Z");
const season = "2026";
const roster = [{ id: "roster-rw", name: "Roster RW", teamAbbreviation: "AAA", eligiblePositions: "RW", value: 50, projectionSeason: season }];
const candidates = [
  { id: "candidate-b", name: "Candidate B", teamAbbreviation: "BBB", eligiblePositions: "RW", value: 20, projectionSeason: season },
  { id: "candidate-a", name: "Candidate A", teamAbbreviation: "CCC", eligiblePositions: "RW", value: 10, projectionSeason: season },
];
const games = [
  { date: "2026-10-06", teamAbbreviation: "AAA", yahooWeek: 1, season },
  { date: "2026-10-06", teamAbbreviation: "BBB", yahooWeek: 1, season },
  { date: "2026-10-06", teamAbbreviation: "CCC", yahooWeek: 1, season },
  { date: "2026-10-07", teamAbbreviation: "CCC", yahooWeek: 1, season },
];
function input(overrides: Partial<DraftProDustInput> = {}): DraftProDustInput {
  return {
    season,
    lineupMode: "daily",
    inputOrigin: "draft",
    roster,
    candidates,
    rosterSlots: { RW: 1, BN: 3 },
    schedule: { season, freshness: { oldestFetchedAt: now.toISOString(), latestFetchedAt: now.toISOString() }, games },
    ...overrides,
  };
}

describe("Draft Pro DUST", () => {
  it("uses the existing daily optimizer result directly", () => {
    const result = evaluateDraftProDust(input(), now);
    const schedule = prepareTeamSchedule(games);
    const baseline = evaluateRosterSchedule({ roster, rosterSlots: { RW: 1, BN: 3 }, schedule, lineupMode: "daily" });
    const direct = calculateCandidateDust({ roster, rosterSlots: { RW: 1, BN: 3 }, schedule, lineupMode: "daily" }, candidates[0], baseline);
    const insight = result.insights.find((item) => item.playerId === candidates[0].id)!;
    expect(result.state).toBe("ready");
    expect(insight).toMatchObject({ marginalBenchGames: direct.marginalDustGames, activeGamesAdded: direct.activeGamesAdded, candidateScheduledGames: direct.candidateScheduledGames });
  });

  it("defaults to ordinary value ranking and makes schedule-fit sorting explicit", () => {
    expect(evaluateDraftProDust(input(), now).insights.map((item) => item.playerId)).toEqual(["candidate-b", "candidate-a"]);
    expect(evaluateDraftProDust(input({ sort: "schedule_fit" }), now).insights.map((item) => item.playerId)).toEqual(["candidate-a", "candidate-b"]);
  });

  it("rejects projection or schedule season boundaries instead of mixing them", () => {
    expect(evaluateDraftProDust(input({ candidates: [{ ...candidates[0], projectionSeason: "2025" }] }), now).state).toBe("season_mismatch");
    expect(evaluateDraftProDust(input({ schedule: { season, freshness: { oldestFetchedAt: now.toISOString(), latestFetchedAt: now.toISOString() }, games: [{ ...games[0], season: "2025" }] } }), now).state).toBe("season_mismatch");
  });

  it("fails closed for stale schedules and weekly-lock leagues", () => {
    expect(evaluateDraftProDust(input({ schedule: { season, freshness: { oldestFetchedAt: new Date(now.getTime() - DRAFT_PRO_DUST_STALE_AFTER_MS - 1).toISOString(), latestFetchedAt: now.toISOString() }, games } }), now).state).toBe("stale_schedule");
    expect(evaluateDraftProDust(input({ lineupMode: "weekly" }), now).state).toBe("weekly_lock_unsupported");
  });

  it("reports unknown teams and empty rosters without calculating a misleading insight", () => {
    expect(evaluateDraftProDust(input({ roster: [] }), now).state).toBe("empty_roster");
    expect(evaluateDraftProDust(input({ candidates: [{ ...candidates[0], teamAbbreviation: "ZZZ" }] }), now)).toMatchObject({ state: "unknown_team", insights: [] });
  });

  it("requires an explicit account save before private-import data can reach DUST", () => {
    expect(evaluateDraftProDust(input({ inputOrigin: "private_import" }), now).state).toBe("private_import_not_saved");
    expect(evaluateDraftProDust(input({ inputOrigin: "private_import", privateImportAccountSaved: true }), now).state).toBe("ready");
  });
});
