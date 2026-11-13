import { describe, expect, it } from "vitest";
import { buildGoalieStintWorkload, type GoalieStintWorkloadInput } from "./stintWorkload";

function fixture(): GoalieStintWorkloadInput {
  const games = Array.from({ length: 15 }, (_, i) => ({ gameId: 100 + i, team: "NJD", seasonId: 20262027, gameType: 2 as const,
    date: `2026-10-${String(i + 1).padStart(2, "0")}`, startsAt: `2026-10-${String(i + 1).padStart(2, "0")}T23:00:00Z`,
    final: true, reported: true, appearancesComplete: true, evidenceIds: [`game-${i}`] }));
  // PHI already played 17 games: none belongs in John's opportunity denominator.
  games.push(...Array.from({ length: 17 }, (_, i) => ({ ...games[0], gameId: 200 + i, team: "PHI", date: `2026-10-${String(i + 1).padStart(2, "0")}`, startsAt: `2026-10-${String(i + 1).padStart(2, "0")}T23:00:00Z` })));
  games.push({ ...games[0], gameId: 300, team: "PHI", date: "2026-10-22", startsAt: "2026-10-22T23:00:00Z" });
  return { goalieId: 1, scope: { seasonId: 20262027, gameType: 2, fromAt: "2026-10-01T00:00:00Z", throughAt: "2026-10-24T00:00:00Z" },
    observedAt: "2026-10-24T12:00:00Z", scheduleComplete: true, membershipComplete: true,
    scheduleEvidenceIds: ["schedule-v1"], membershipEvidenceIds: ["membership-v1"],
    stints: [
      { stintId: "john-njd", team: "NJD", fromAt: "2026-09-01T00:00:00Z", untilAt: "2026-10-20T12:00:00Z", boundaryStatus: "verified", evidenceIds: ["trade-oct20"] },
      { stintId: "john-phi", team: "PHI", fromAt: "2026-10-20T12:00:00Z", untilAt: null, boundaryStatus: "verified", evidenceIds: ["trade-oct20"] }
    ], games,
    appearances: games.map((g, i) => ({ gameId: g.gameId, team: g.team, goalieId: i < 10 || g.gameId === 300 ? 1 : 2, started: true, evidenceIds: ["official-box"] })) };
}

describe("player workload across club-membership stints", () => {
  it("carries 10/15 NJD + 1/1 PHI as 11/16, never 11/33 or the average of percentages", () => {
    const r = buildGoalieStintWorkload(fixture());
    expect(r.stints.map(s => [s.team, s.starts, s.eligibleTeamGames, s.startShare])).toEqual([["NJD", 10, 15, 10 / 15], ["PHI", 1, 1, 1]]);
    expect(r.total).toMatchObject({ starts: 11, appearances: 11, reliefAppearances: 0, eligibleTeamGames: 16, startShare: 11 / 16, appearanceShare: 11 / 16 });
    expect(r.forecast).toEqual({ startProbability: null, status: "not_a_forecast" });
  });
  it("counts games after the trade before his first appearance, including injury or scratch absences", () => {
    const f = fixture();
    f.games.push({ ...f.games.at(-1)!, gameId: 301, date: "2026-10-21", startsAt: "2026-10-21T23:00:00Z" });
    f.appearances.push({ gameId: 301, team: "PHI", goalieId: 2, started: true, evidenceIds: ["official-box"] });
    expect(buildGoalieStintWorkload(f).total).toMatchObject({ starts: 11, eligibleTeamGames: 17, startShare: 11 / 17 });
  });
  it("retains relief as a separate appearance and never as a second start", () => {
    const f = fixture();
    f.appearances.push({ gameId: 110, team: "NJD", goalieId: 1, started: false, evidenceIds: ["official-box"] });
    expect(buildGoalieStintWorkload(f).total).toMatchObject({ starts: 11, appearances: 12, reliefAppearances: 1, startShare: 11 / 16, appearanceShare: 12 / 16 });
  });
  it("does not infer the trade boundary from his first PHI appearance", () => {
    const f = fixture(); f.stints[1].fromAt = null; f.stints[1].boundaryStatus = "unknown";
    const r = buildGoalieStintWorkload(f);
    expect(r.total.eligibleTeamGames).toBeNull(); expect(r.total.startShare).toBeNull();
    expect(r.stints.find(s => s.stintId === "john-phi")?.reasons).toContain("membership_boundary_unknown");
  });
  it("requires complete membership and schedule evidence for a season workload", () => {
    for (const field of ["membershipComplete", "scheduleComplete"] as const) {
      const f = fixture(); f[field] = false;
      expect(buildGoalieStintWorkload(f).total.startShare).toBeNull();
    }
  });
  it("keeps the denominator but withholds start share when a label is unresolved", () => {
    const f = fixture(); f.appearances[0].started = null;
    const r = buildGoalieStintWorkload(f);
    expect(r.total).toMatchObject({ eligibleTeamGames: 16, starts: 10, startShare: null, appearanceShare: 11 / 16 });
    expect(r.total.unresolvedStartGameIds).toEqual([100]);
  });
  it("does not assign zero appearances from incomplete reports or unproven finality", () => {
    const f = fixture(); f.games[0].appearancesComplete = false;
    expect(buildGoalieStintWorkload(f).total.appearanceShare).toBeNull();
    expect(buildGoalieStintWorkload(f).total.startShare).toBeNull();
    f.games[0].final = false;
    expect(buildGoalieStintWorkload(f).total.eligibleTeamGames).toBeNull();
  });
  it("filters season and game type, uses half-open stint boundaries and excludes earlier destination games", () => {
    const f = fixture();
    f.games.push({ ...f.games.at(-1)!, gameId: 400, seasonId: 20252026 });
    expect(buildGoalieStintWorkload(f).total.eligibleTeamGames).toBe(16);
    f.games.at(-1)!.seasonId = 20262027; f.games.at(-1)!.gameType = 3;
    expect(buildGoalieStintWorkload(f).total.eligibleTeamGames).toBe(16);
  });
  it("rejects overlap and duplicate game identities rather than double counting", () => {
    const f = fixture(); f.stints[1].fromAt = "2026-10-19T12:00:00Z";
    expect(() => buildGoalieStintWorkload(f)).toThrow(/overlap/i);
    const d = fixture(); d.games.push(d.games[0]);
    expect(() => buildGoalieStintWorkload(d)).toThrow(/duplicate/i);
  });
  it("provides stable provenance and order-independent arithmetic", () => {
    const f = fixture(); const first = buildGoalieStintWorkload(f);
    f.games.reverse(); f.appearances.reverse(); f.stints.reverse();
    expect(buildGoalieStintWorkload(f)).toEqual(first);
    expect(first.evidenceIds).toContain("trade-oct20");
    expect(first.basis).toBe("current_recorded_history");
  });
  it("keeps a returning second stint separate and sums raw counts", () => {
    const f = fixture(); f.stints[1].untilAt = "2026-10-23T00:00:00Z";
    f.stints.push({ ...f.stints[0], stintId: "john-njd-return", fromAt: "2026-10-23T00:00:00Z", untilAt: null });
    f.games.push({ ...f.games[0], gameId: 401, date: "2026-10-23", startsAt: "2026-10-23T23:00:00Z" });
    f.appearances.push({ gameId: 401, team: "NJD", goalieId: 1, started: true, evidenceIds: ["official-box"] });
    const r = buildGoalieStintWorkload(f);
    expect(r.stints).toHaveLength(3);
    expect(r.total).toMatchObject({ starts: 12, eligibleTeamGames: 17, startShare: 12 / 17 });
  });
  it("rejects date-only trade times and future reporting windows", () => {
    const f = fixture(); f.stints[1].fromAt = "2026-10-20";
    expect(() => buildGoalieStintWorkload(f)).toThrow(/timestamp/);
    const future = fixture(); future.observedAt = "2026-10-23T00:00:00Z";
    expect(() => buildGoalieStintWorkload(future)).toThrow(/scope/);
  });
  it("does not discard contradictory membership or treat an empty final appearance feed as zero", () => {
    const f = fixture(); f.appearances.find(a => a.gameId === 200)!.goalieId = 1;
    const r = buildGoalieStintWorkload(f);
    expect(r.total.eligibleTeamGames).toBeNull();
    expect(r.total.reasons).toContain("appearance_outside_verified_membership");
    const missing = fixture(); missing.appearances = missing.appearances.filter(a => a.gameId !== 300);
    expect(buildGoalieStintWorkload(missing).total.appearanceShare).toBeNull();
  });
  it("orders consecutive trade stints by instant, not lexical offset timestamp", () => {
    const f = fixture();
    f.stints[0].fromAt = "2026-10-20T00:30:00+02:00";
    f.stints[0].untilAt = "2026-10-20T00:00:00Z";
    f.stints[1].fromAt = "2026-10-19T20:00:00-04:00";
    f.games = [
      { ...f.games[0], gameId: 500, date: "2026-10-19", startsAt: "2026-10-19T23:00:00Z" },
      { ...f.games.at(-1)!, gameId: 501, date: "2026-10-19", startsAt: "2026-10-20T01:00:00Z" }
    ];
    f.appearances = f.games.map(g => ({ gameId: g.gameId, team: g.team, goalieId: 1, started: true, evidenceIds: ["official-box"] }));
    const utc = structuredClone(f);
    utc.stints[0].fromAt = "2026-10-19T22:30:00Z";
    utc.stints[1].fromAt = "2026-10-20T00:00:00Z";
    const offsetResult = buildGoalieStintWorkload(f);
    expect(offsetResult.total).toEqual(buildGoalieStintWorkload(utc).total);
    expect(offsetResult.stints.map(s => [s.team, s.starts, s.eligibleTeamGames])).toEqual([["NJD", 1, 1], ["PHI", 1, 1]]);
  });
});
