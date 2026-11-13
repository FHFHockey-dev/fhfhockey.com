import { describe, expect, it } from "vitest";
import { buildGoalieWorkloadContract, type GoalieWorkloadContractInput } from "./workloadContract";

function fixture(): GoalieWorkloadContractInput {
  const games = Array.from({ length: 15 }, (_, i) => ({
    gameId: 100 + i, team: "NJD", seasonId: 20262027, gameType: 2, date: `2026-10-${String(i + 1).padStart(2, "0")}`,
    startsAt: `2026-10-${String(i + 1).padStart(2, "0")}T23:00:00Z`,
    final: true, reported: true, appearancesComplete: true, evidenceIds: [`final:${100 + i}`]
  }));
  games.push(...games.map(g => ({ ...g, gameId: g.gameId + 100, team: "PHI", evidenceIds: [`final:${g.gameId + 100}`] })));
  games.push({ ...games[0], gameId: 300, team: "PHI", date: "2026-10-22", startsAt: "2026-10-22T23:00:00Z", evidenceIds: ["final:300"] });
  return {
    goalieId: 1, scope: { seasonId: 20262027, gameType: 2, fromAt: "2026-10-01T00:00:00Z", throughAt: "2026-10-24T00:00:00Z" },
    observedAt: "2026-10-24T12:00:00Z", scheduleComplete: true, scheduleEvidenceIds: ["schedule:r1"], games,
    appearances: games.map(g => ({ gameId: g.gameId, team: g.team, goalieId: g.gameId < 110 || g.gameId === 300 ? 1 : 2,
      started: true, evidenceIds: [`box:${g.gameId}`] })),
    membership: {
      coverage: { evidenceId: "coverage", sourceRecordId: "register:1", sourceRevision: "r1", goalieId: 1, seasonId: 20262027,
        fromAt: "2026-10-01T00:00:00Z", throughAt: "2026-10-24T00:00:00Z", recordedAt: "2026-10-24T01:00:00Z", complete: true },
      events: [
        { evidenceId: "join", source: "official_eligibility", sourceRecordId: "eligibility:1", sourceRevision: "r1", goalieId: 1,
          fromTeam: null, toTeam: "NJD", effectiveAt: "2026-09-01T00:00:00Z", recordedAt: "2026-09-01T01:00:00Z" },
        { evidenceId: "trade", source: "official_transaction", sourceRecordId: "transaction:2", sourceRevision: "r1", goalieId: 1,
          fromTeam: "NJD", toTeam: "PHI", effectiveAt: "2026-10-20T12:00:00Z", recordedAt: "2026-10-20T13:00:00Z" }
      ],
      stints: [
        { stintId: "njd", team: "NJD", enteredBy: "join", end: { kind: "departed", exitedBy: "trade" } },
        { stintId: "phi", team: "PHI", enteredBy: "trade", end: { kind: "ongoing" } }
      ]
    }
  };
}

describe("fixture-backed goalie workload consumer boundary", () => {
  it("serves NJD 10/15, PHI 1/1 and combined 11/16 with the full lineage", () => {
    const r = buildGoalieWorkloadContract(fixture());
    expect(r.membership.complete).toBe(true);
    expect(r.history.stints.map(s => [s.team, s.starts, s.eligibleTeamGames])).toEqual([["NJD", 10, 15], ["PHI", 1, 1]]);
    expect(r.history.total).toMatchObject({ starts: 11, appearances: 11, eligibleTeamGames: 16, startShare: 0.6875 });
    expect(r.history.total.selectedGameIds).toEqual([...Array.from({ length: 15 }, (_, i) => 100 + i), 300]);
    expect(r.history.evidenceIds).toEqual(expect.arrayContaining(["join", "trade", "coverage", "schedule:r1", "final:300", "box:300"]));
    expect(r.future).toEqual({ sourceContract: "forge_goalie_candidates_v1", startProbability: null, status: "not_provided_by_historical_workload" });
  });

  it("keeps injury and scratch games before the first PHI appearance in his denominator", () => {
    const f = fixture();
    for (const [gameId, startsAt, status] of [[301, "2026-10-20T23:00:00Z", "injured"], [302, "2026-10-21T23:00:00Z", "scratched"]] as const) {
      f.games.push({ ...f.games.at(-1)!, gameId, startsAt, date: startsAt.slice(0, 10), evidenceIds: [`final:${gameId}`] });
      f.appearances.push({ gameId, team: "PHI", goalieId: 2, started: true, evidenceIds: [`box:${gameId}`] });
      (f.availability ??= []).push({ gameId, team: "PHI", goalieId: 1, status, evidenceIds: [`status:${gameId}`] });
    }
    const r = buildGoalieWorkloadContract(f);
    expect(r.history.total).toMatchObject({ starts: 11, appearances: 11, eligibleTeamGames: 18, startShare: 11 / 18 });
    expect(r.history.stints[1]).toMatchObject({ starts: 1, eligibleTeamGames: 3 });
    expect(r.availability.map(row => row.status)).toEqual(["injured", "scratched"]);
  });

  it("keeps a pulled official starter and relief appearances distinct", () => {
    const f = fixture();
    f.appearances.push({ gameId: 100, team: "NJD", goalieId: 2, started: false, evidenceIds: ["relief:100"] });
    f.appearances.push({ gameId: 110, team: "NJD", goalieId: 1, started: false, evidenceIds: ["relief:110"] });
    const r = buildGoalieWorkloadContract(f);
    expect(r.history.total).toMatchObject({ starts: 11, appearances: 12, reliefAppearances: 1, eligibleTeamGames: 16, startShare: 11 / 16, appearanceShare: 12 / 16 });
    expect(r.future.startProbability).toBeNull();
  });

  it("withholds full shares for ambiguous trade-day membership instead of using the first appearance", () => {
    const f = fixture(); f.membership.events[1].effectiveAt = null;
    const r = buildGoalieWorkloadContract(f);
    expect(r.membership.reasons).toContain("membership_effective_time_unknown");
    expect(r.history.total.eligibleTeamGames).toBeNull();
    expect(r.history.total.startShare).toBeNull();
    expect(r.history.total.appearanceShare).toBeNull();
  });

  it("counts a game at the exact half-open trade boundary only for the new club", () => {
    const f = fixture(); f.games.at(-1)!.startsAt = "2026-10-20T12:00:00Z";
    f.games.push({ ...f.games[0], gameId: 400, startsAt: "2026-10-20T12:00:00Z" });
    const r = buildGoalieWorkloadContract(f);
    expect(r.history.total.eligibleTeamGames).toBe(16);
    expect(r.history.total.selectedGameIds).not.toContain(400);
    expect(r.history.total.selectedGameIds).toContain(300);
  });

  it("keeps a second trade back to NJD separate while summing raw counts", () => {
    const f = fixture();
    f.membership.events.push({ ...f.membership.events[1], evidenceId: "return", sourceRecordId: "transaction:3",
      fromTeam: "PHI", toTeam: "NJD", effectiveAt: "2026-10-23T12:00:00Z", recordedAt: "2026-10-23T13:00:00Z" });
    f.membership.stints[1].end = { kind: "departed", exitedBy: "return" };
    f.membership.stints.push({ stintId: "njd-return", team: "NJD", enteredBy: "return", end: { kind: "ongoing" } });
    f.games.push({ ...f.games[0], gameId: 400, date: "2026-10-23", startsAt: "2026-10-23T23:00:00Z" });
    f.appearances.push({ gameId: 400, team: "NJD", goalieId: 1, started: true, evidenceIds: ["box:400"] });
    const r = buildGoalieWorkloadContract(f);
    expect(r.history.stints.map(s => [s.stintId, s.starts, s.eligibleTeamGames])).toEqual([["njd", 10, 15], ["phi", 1, 1], ["njd-return", 1, 1]]);
    expect(r.history.total).toMatchObject({ starts: 12, eligibleTeamGames: 17, startShare: 12 / 17 });
  });

  it("separates missing start labels, appearance coverage, schedule coverage and observed zero", () => {
    const labels = fixture(); labels.appearances[0].started = null;
    expect(buildGoalieWorkloadContract(labels).history.total).toMatchObject({ eligibleTeamGames: 16, startShare: null, appearanceShare: 11 / 16 });
    const report = fixture(); report.games[0].appearancesComplete = false;
    expect(buildGoalieWorkloadContract(report).history.total).toMatchObject({ eligibleTeamGames: 16, startShare: null, appearanceShare: null });
    const schedule = fixture(); schedule.scheduleComplete = false;
    expect(buildGoalieWorkloadContract(schedule).history.total.eligibleTeamGames).toBeNull();
    const zero = fixture(); zero.appearances.forEach(a => { a.goalieId = 2; });
    expect(buildGoalieWorkloadContract(zero).history.total).toMatchObject({ starts: 0, appearances: 0, eligibleTeamGames: 16, startShare: 0, appearanceShare: 0 });
  });

  it("rejects conflicting availability identities and never turns unsupported status into injury", () => {
    const f = fixture(); f.availability = [{ goalieId: 1, gameId: 300, team: "PHI", status: "injured", evidenceIds: [] }];
    expect(buildGoalieWorkloadContract(f).availability[0].status).toBe("unknown");
    f.availability[0].team = "NJD";
    expect(() => buildGoalieWorkloadContract(f)).toThrow(/identity/);
    f.availability[0].team = "PHI"; f.availability.push({ ...f.availability[0], status: "available" });
    expect(() => buildGoalieWorkloadContract(f)).toThrow(/duplicate/);
  });

  it("preserves input records and produces stable output after permutation", () => {
    const f = fixture(); const copy = structuredClone(f); const r = buildGoalieWorkloadContract(f);
    expect(f).toEqual(copy);
    f.games.reverse(); f.appearances.reverse(); f.membership.events.reverse(); f.membership.stints.reverse();
    expect(buildGoalieWorkloadContract(f)).toEqual(r);
  });
});
