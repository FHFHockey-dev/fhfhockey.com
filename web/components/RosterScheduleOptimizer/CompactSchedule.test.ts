import { describe, expect, it } from "vitest";
import { compactGroups, recordedPastLineup } from "./CompactSchedule";
import type { LeagueRules, PlanIntent, PlanningPlayer, PlanningSnapshot } from "lib/rosterScheduleOptimizer/planningTypes";

const player = (id: string, teamAbbreviation: string): PlanningPlayer => ({ id, nhlId: null, name: `Player ${id}`, teamAbbreviation,
  eligiblePositions: ["C", "LW"], eligibilityVerified: true, playerClass: "skater", availability: "rostered", ownership: null, canDrop: true,
  holdValue: null, reserveEligibility: ["IR+"] });
const players = [player("p1", "DET"), player("p2", "TOR"), player("p3", "PHI")];
const rules = { lineupMode: "daily", rosterSlots: { C: 1, LW: 1, BN: 2, "IR+": 1 } } as unknown as LeagueRules;
const snapshot = {
  context: { asOf: "2026-10-21T14:00:00Z", timeZone: "America/Chicago", startDate: "2026-10-19", endDate: "2026-10-25" },
  players, roster: players.map(row => ({ playerId: row.id, position: "bench" as const })), lockedAssignments: [],
  games: [
    { id: "g1", date: "2026-10-20", startsAt: "2026-10-20T23:00:00Z", teamAbbreviation: "DET", opponent: "BUF", home: true, status: "final" },
    { id: "g2", date: "2026-10-20", startsAt: "2026-10-20T23:00:00Z", teamAbbreviation: "TOR", opponent: "MTL", home: false, status: "final" },
  ],
  pastLineups: [{ date: "2026-10-20", source: "yahoo", entries: [
    { playerId: "p1", name: "Player p1", position: "C", slotId: "C#1" },
    { playerId: "p2", name: "Player p2", position: "BN", slotId: null },
    { playerId: null, name: "Gone Player", position: "BN", slotId: null },
    { playerId: "p3", name: "Player p3", position: "IR+", slotId: null },
  ] }],
  evidence: {},
} as unknown as PlanningSnapshot;
const groups = (date: string) => compactGroups({ snapshot, roster: snapshot.roster, rules, players, assignments: [], intent: {} as PlanIntent, date, ready: true });

describe("compactGroups on elapsed days", () => {
  it("shows the lineup Yahoo recorded, not planner assignments", () => {
    expect(groups("2026-10-20").map(group => [group.position, group.rows.map(row => [row.playerId ?? null, row.assigned, row.status])])).toEqual([
      ["C", [["p1", true, "Fantasy assigned"]]],
      ["LW", [[null, false, "Open LW"]]],
      ["BN", [["p2", false, "Yahoo bench · had a game"], [null, false, "Gone Player · identity unmatched"]]],
      ["IR+", [["p3", false, "Reserve"]]],
    ]);
  });

  it("uses a recorded lineup only for elapsed days", () => {
    expect(recordedPastLineup(snapshot, "2026-10-20")?.date).toBe("2026-10-20");
    expect(recordedPastLineup(snapshot, "2026-10-19")).toBeUndefined();
    const today = { ...snapshot, pastLineups: [{ ...snapshot.pastLineups![0], date: "2026-10-21" }] };
    expect(recordedPastLineup(today, "2026-10-21")).toBeUndefined();
  });
});
