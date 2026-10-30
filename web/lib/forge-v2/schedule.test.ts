import { describe, expect, it } from "vitest";
import { FIXTURE_CLOCK, FIXTURE_TARGET, fixtureAffiliation, fixtureOpportunity, fixtureSchedule, fixtureSource } from "./fixtures";
import { advanceLock, buildOpportunities, observeHorizonEpisodes, reconcileOpportunities, resolveAffiliations } from "./schedule";

const later = "2026-01-02T12:00:00.000Z";
const sourceAt = (time: string) => fixtureSource({ observedAt: time, publishedAt: time, firstReceivedAt: time });

describe("independent population and schedule", () => {
  it("includes IR/reserve and observed callups independently of performance, with no calendar window", () => {
    const schedule = fixtureSchedule(12).map((game, i) => i === 9 ? { ...game, scheduledStartAt: "2026-08-01T23:00:00.000Z" } : game);
    const affiliations = [fixtureAffiliation(), fixtureAffiliation({ playerId: 9900002, status: "injury_reserve" }), fixtureAffiliation({ playerId: 9900003, status: "reserve" }), fixtureAffiliation({ playerId: 9900004, source: sourceAt(later), effectiveAt: later }), fixtureAffiliation({ playerId: 9900005, position: "G" }), fixtureAffiliation({ playerId: 9900006, teamId: null, status: "unresolved" })];
    const population = buildOpportunities({ affiliations, schedule: schedule.slice(0, 10), asOf: FIXTURE_CLOCK, seasonId: FIXTURE_TARGET.seasonId, scheduleComplete: true });
    expect(population.opportunities).toHaveLength(30);
    expect(population.opportunities.at(-1)?.scheduledStartAt).toBe("2026-08-01T23:00:00.000Z");
    expect(population.unresolved).toEqual([{ playerId: 9900006, reason: "unresolved_affiliation" }]);
    expect(population.opportunities.filter(row => row.playerId === 9900004)).toEqual([]);
    expect(resolveAffiliations(affiliations, later).eligible.some(row => row.playerId === 9900004)).toBe(true);
  });

  it("uses latest known affiliation without retrospective reassignment and retains same-game history on trades", () => {
    const old = fixtureAffiliation();
    const trade = fixtureAffiliation({ teamId: 2, effectiveAt: FIXTURE_CLOCK, source: sourceAt(later), revision: "trade" });
    expect(resolveAffiliations([old, trade], FIXTURE_CLOCK).eligible[0].teamId).toBe(1);
    expect(resolveAffiliations([old, trade], later).eligible[0].teamId).toBe(2);
    const before = fixtureOpportunity(), after = fixtureOpportunity({ teamId: 2, opponentId: 1, home: false, observedAt: later });
    const delta = reconcileOpportunities([before], [after]);
    expect(delta.closed).toEqual([before]); expect(delta.opened).toEqual([after]);
    expect(delta.teamChanges[0]).toMatchObject({ fromTeamId: 1, toTeamId: 2 });
    expect(before.teamId).toBe(1);
  });

  it("excludes unresolved, conflicting, assigned, and unapproved affiliation without fallback", () => {
    expect(resolveAffiliations([fixtureAffiliation(), fixtureAffiliation({ teamId: 3 })], FIXTURE_CLOCK).unresolved[0].reason).toBe("conflicting_affiliation");
    expect(resolveAffiliations([fixtureAffiliation({ status: "assigned" })], FIXTURE_CLOCK).eligible).toEqual([]);
    expect(resolveAffiliations([fixtureAffiliation({ source: fixtureSource({ use: "unknown" }) })], FIXTURE_CLOCK).unresolved[0].reason).toBe("unverified_affiliation");
  });

  it("separates unknown/postponed, cancelled, replaced, begun, nonregular, and incomplete schedules", () => {
    const games = fixtureSchedule(8);
    games[0].scheduledStartAt = null; games[0].status = "postponed";
    games[1].status = "cancelled"; games[2].status = "suspended";
    games[3].replacementGameId = games[7].gameId;
    games[4].gameType = "playoff"; games[5].actualStartAt = FIXTURE_CLOCK;
    const population = buildOpportunities({ affiliations: [fixtureAffiliation()], schedule: games, asOf: FIXTURE_CLOCK, seasonId: FIXTURE_TARGET.seasonId, scheduleComplete: false });
    expect(population.opportunities.map(row => row.gameId)).toEqual([games[6].gameId, games[7].gameId]);
    expect(population.shortfalls[0]).toMatchObject({ count: 2, reason: "schedule_capture_incomplete" });
    expect(population.excludedGames.find(row => row.gameId === games[3].gameId)).toMatchObject({ reason: "replaced_game", replacementGameId: games[7].gameId });
  });
});

describe("contemporaneous episodes and locks", () => {
  it("preserves first observed episodes, gaps, skipped horizons, same ordinal revisions, and reentry", () => {
    const first = observeHorizonEpisodes([], [fixtureOpportunity()], FIXTURE_CLOCK);
    const second = observeHorizonEpisodes(first, [fixtureOpportunity({ observedAt: later, affiliationRevision: "trade", scheduleRevision: "reschedule" })], later);
    expect(second).toEqual(first);
    const third = observeHorizonEpisodes(second, [fixtureOpportunity({ horizon: 8, observedAt: "2026-01-03T12:00:00.000Z" })], "2026-01-03T12:00:00.000Z");
    const fourth = observeHorizonEpisodes(third, [], "2026-01-04T12:00:00.000Z");
    const fifth = observeHorizonEpisodes(fourth, [fixtureOpportunity({ observedAt: "2026-01-05T12:00:00.000Z" })], "2026-01-05T12:00:00.000Z");
    expect(fifth.map(row => [row.horizon, row.episode])).toEqual([[10, 1], [8, 1], [10, 2]]);
    expect(first[0].exitedAt).toBeNull();
    expect(fifth[0].enteredAt).toBe(FIXTURE_CLOCK);
    expect(() => observeHorizonEpisodes(fifth, [], FIXTURE_CLOCK)).toThrow("chronological");
  });

  it("accepts pre-lock changes but late delay does not extend and affirmative no-play opens a new epoch", () => {
    const game = fixtureSchedule(1)[0];
    const initial = advanceLock(null, game, FIXTURE_CLOCK).epoch!;
    const moved = { ...game, revision: "moved", scheduledStartAt: "2026-01-03T23:00:00.000Z", source: sourceAt(later) };
    const before = advanceLock(initial, moved, later);
    expect(before.epoch).toMatchObject({ lockAt: moved.scheduledStartAt, predecessorId: initial.id, reopened: false });
    const late = "2026-01-03T00:00:00.000Z";
    const lateGame = { ...moved, source: sourceAt(late) };
    expect(advanceLock(initial, lateGame, late)).toMatchObject({ epoch: initial, issuanceOpen: false });
    expect(advanceLock(initial, { ...lateGame, noPlayConfirmed: true }, late).epoch).toMatchObject({ reopened: true, adoptedAt: late });
    expect(initial.lockAt).toBe(game.scheduledStartAt);
  });

  it("persists observed play without inventing an actual-start timestamp and never reopens", () => {
    const game = fixtureSchedule(1)[0], initial = advanceLock(null, game, FIXTURE_CLOCK).epoch!;
    for (const status of ["in_progress", "suspended", "final"] as const) {
      const started = advanceLock(initial, { ...game, status, actualStartAt: null, revision: status, source: sourceAt(later) }, later);
      expect(started.epoch).toMatchObject({ playBegun: true, actualStartAt: null, timingStatus: "provisional" });
      expect(started.epoch?.id).not.toBe(initial.id);
      const reopened = advanceLock(started.epoch, { ...game, status: "scheduled", noPlayConfirmed: true, revision: "false-no-play", scheduledStartAt: "2026-01-05T23:00:00.000Z", source: sourceAt("2026-01-04T12:00:00.000Z") }, "2026-01-04T12:00:00.000Z");
      expect(reopened).toMatchObject({ issuanceOpen: false, reason: "play_begun", epoch: { playBegun: true } });
    }
    const unknown = advanceLock(null, { ...game, status: "in_progress", scheduledStartAt: null }, FIXTURE_CLOCK);
    expect(unknown.epoch).toMatchObject({ playBegun: true, actualStartAt: null, lockAt: FIXTURE_CLOCK });
  });

  it("never reopens suspended play; earlier actual starts append timing evidence; unknown/cancelled/replaced stay closed", () => {
    const game = fixtureSchedule(1)[0], initial = advanceLock(null, game, FIXTURE_CLOCK).epoch!;
    const at = "2026-01-03T00:00:00.000Z";
    const resumed = { ...game, status: "suspended" as const, actualStartAt: "2026-01-02T22:50:00.000Z", scheduledStartAt: "2026-01-04T23:00:00.000Z", noPlayConfirmed: true, revision: "suspend", source: sourceAt(at) };
    const transition = advanceLock(initial, resumed, at);
    expect(transition.issuanceOpen).toBe(false); expect(transition.epoch?.actualStartAt).toBe(resumed.actualStartAt);
    expect(transition.epoch?.lockAt).toBe(initial.lockAt);
    for (const changed of [{ ...game, scheduledStartAt: null }, { ...game, status: "cancelled" as const }, { ...game, replacementGameId: 2099029999 }]) expect(advanceLock(initial, changed, FIXTURE_CLOCK).issuanceOpen).toBe(false);
  });
});
