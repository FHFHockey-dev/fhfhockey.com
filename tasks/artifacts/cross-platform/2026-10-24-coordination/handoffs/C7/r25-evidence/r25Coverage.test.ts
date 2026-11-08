// @vitest-environment node
// C7 R25: coverage threshold edges and "missing is never zero" for both team-driver aggregators.
import { describe, expect, it } from "vitest";
import { writeFileSync } from "node:fs";
import { aggregateTeamFiveOnFive, aggregateTeamSpecialTeams, TEAM_DRIVER_MIN_COVERAGE } from "components/WiGO/teamPerformanceDriverModel";
const day = (i: number) => new Date(Date.UTC(2025, 9, 1) + i * 86400000).toISOString().slice(0, 10);
function fiveOnFive(expectedGames: number, covered: number) {
  const dates = new Map<string, number>(); for (let i = 0; i < expectedGames; i++) dates.set(day(i), 1);
  const rows = Array.from({ length: covered }, (_, i) => ({ team_abbreviation: "VAN", date: day(i), gp: 1, xgf: 2 + (i % 3), xga: 2, gf: 1 }));
  return aggregateTeamFiveOnFive(rows, new Map([["VAN", dates]]));
}
function special(expectedGames: number, covered: number) {
  const rows = Array.from({ length: covered }, (_, i) => ({ team_id: 23, game_id: 1000 + i, date: day(i), pp_opportunities: 3, power_play_goals_for: i % 2, times_shorthanded: 2, pp_goals_against: 0 }));
  return aggregateTeamSpecialTeams(rows, new Map([[23, expectedGames]]));
}
describe("C7 R25 coverage edges", () => {
  it("E1 exact 90% shows for every M in 10..820 that has an integer 90%; one game fewer is hidden; M=0 hidden; 100% complete", () => {
    const bad: string[] = [];
    for (let m = 10; m <= 820; m += 10) {
      const k = (m * 9) / 10;
      if (fiveOnFive(m, k).length !== 1) bad.push(`5v5 ${k}/${m} hidden`);
      if (special(m, k).length !== 1) bad.push(`ST ${k}/${m} hidden`);
      if (fiveOnFive(m, k - 1).length !== 0) bad.push(`5v5 ${k - 1}/${m} shown`);
      if (special(m, k - 1).length !== 0) bad.push(`ST ${k - 1}/${m} shown`);
    }
    const e = { at899of1000: [fiveOnFive(1000, 899).length, special(1000, 899).length], at900of1000: [fiveOnFive(1000, 900).length, special(1000, 900).length],
      at100: [fiveOnFive(82, 82)[0]?.coveredGames, special(82, 82)[0]?.expectedGames], m0: [fiveOnFive(0, 0).length, special(0, 0).length], threshold: TEAM_DRIVER_MIN_COVERAGE };
    if (process.env.C7_R25_OUT) writeFileSync(process.env.C7_R25_OUT, JSON.stringify({ bad, ...e }, null, 2));
    expect(bad).toEqual([]); expect(e.at899of1000).toEqual([0, 0]); expect(e.at900of1000).toEqual([1, 1]); expect(e.m0).toEqual([0, 0]);
  });
  it("E2 rates use covered games only: 5v5 gp = covered count; PP% over covered opportunities; a bad row counts as missing, not zero", () => {
    const f = fiveOnFive(20, 18)[0]!; expect(f.gp).toBe(18); expect(f.xgf! / f.gp!).toBeCloseTo(Array.from({ length: 18 }, (_, i) => 2 + (i % 3)).reduce((a, b) => a + b) / 18, 12);
    const s = special(20, 18)[0]!; expect(s.power_play_pct).toBeCloseTo(100 * 9 / 54, 12); expect(s.coveredGames).toBe(18);
    const dates = new Map<string, number>(); for (let i = 0; i < 10; i++) dates.set(day(i), 1);
    const rows = Array.from({ length: 10 }, (_, i) => ({ team_abbreviation: "VAN", date: day(i), gp: 1, xgf: i === 0 ? null : 3, xga: 2, gf: 1 }));
    const g = aggregateTeamFiveOnFive(rows as any, new Map([["VAN", dates]]))[0]!; expect(g.gp).toBe(9); expect(g.xgf).toBe(27);
  });
});
