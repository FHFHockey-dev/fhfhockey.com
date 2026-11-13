import { describe, expect, it } from "vitest";
import { analyzeDeploymentGame, selectMainDeploymentUnits, type DeploymentShiftRow, type ObservedDeploymentUnit } from "./observedDeployment";

type State = "es" | "pp" | "pk";
type Block = { period?: number; start: number; end: number; home: number[]; away: number[]; state?: State };
const roles = new Map<number, "F" | "D" | "G">([
  [1, "F"], [2, "F"], [3, "F"], [4, "D"], [5, "D"], [6, "G"], [7, "F"], [8, "F"],
  [11, "F"], [12, "F"], [13, "F"], [14, "D"], [15, "D"], [16, "G"], [17, "F"],
]);
const home = [1, 2, 3, 4, 5, 6];
const away = [11, 12, 13, 14, 15, 16];
const clock = (seconds: number) => `${Math.floor(seconds / 60)}:${String(seconds % 60).padStart(2, "0")}`;
const read = (value: string) => Number(value.split(":")[0]) * 60 + Number(value.split(":")[1]);
function fixture(blocks: Block[], gameLength = 3600, gameId = 1001): DeploymentShiftRow[] {
  const rows = new Map<number, DeploymentShiftRow>();
  for (const block of blocks) for (const [teamId, playerIds, state] of [
    [10, block.home, block.state ?? "es"],
    [20, block.away, block.state === "pp" ? "pk" : block.state === "pk" ? "pp" : "es"],
  ] as const) for (const playerId of playerIds) {
    const row = rows.get(playerId) ?? { game_id: gameId, player_id: playerId, team_id: teamId,
      player_type: roles.get(playerId)!, game_toi: "0:00", game_length: clock(gameLength),
      total_es_toi: "0:00", total_pp_toi: "0:00", total_pk_toi: "0:00", shifts: [], pp_shifts: [], es_shifts: [] };
    const segment = { period: block.period ?? 1, start_time: clock(block.start), end_time: clock(block.end), duration: clock(block.end - block.start), playerId };
    (row.shifts as unknown[]).push(segment);
    (state === "pp" ? row.pp_shifts as unknown[] : row.es_shifts as unknown[]).push({ ...segment, strength: state });
    const duration = block.end - block.start;
    row.game_toi = clock(read(row.game_toi) + duration);
    const field = state === "es" ? "total_es_toi" : state === "pp" ? "total_pp_toi" : "total_pk_toi";
    row[field] = clock(read(row[field]) + duration);
    rows.set(playerId, row);
  }
  return [...rows.values()];
}
const analyze = (rows: DeploymentShiftRow[], gameType: 2 | 3 = 2) => analyzeDeploymentGame({ gameId: rows[0]?.game_id ?? 1001, gameType, homeTeamId: 10, awayTeamId: 20, rows });
function pair(result: ReturnType<typeof analyze>, state: "all" | "fiveOnFive" | "otherEs" | "pp" | "pk", first: number, second: number) {
  return result.pairsByStrength[state].find(row => row.firstPlayerId === first && row.secondPlayerId === second)?.seconds ?? 0;
}

describe("observed deployment", () => {
  it("measures actual changing trios, half-open substitutions and asymmetric shares without rewarding short usage", () => {
    const result = analyze(fixture([
      { start: 0, end: 90, home, away },
      { start: 90, end: 120, home: [1, 2, 7, 4, 5, 6], away },
      { start: 120, end: 121, home: [1, 3, 8, 4, 5, 6], away },
    ]));
    expect(result.units.filter(unit => unit.teamId === 10 && unit.kind === "forward_line").map(unit => [unit.playerIds, unit.seconds])).toEqual([
      [[1, 2, 3], 90], [[1, 2, 7], 30], [[1, 3, 8], 1],
    ]);
    expect(pair(result, "all", 3, 7)).toBe(0);
    expect(pair(result, "all", 1, 3)).toBe(91);
    expect(result.totalsByStrength.all[1]).toBe(121);
    expect(result.totalsByStrength.all[3]).toBe(91);
    expect(100 * pair(result, "all", 1, 3) / result.totalsByStrength.all[3]).toBe(100);
    expect(100 * pair(result, "all", 1, 3) / result.totalsByStrength.all[1]).toBeCloseTo(75.2066);
    expect(pair(result, "all", 1, 6)).toBe(121);
    expect(pair(result, "all", 1, 11)).toBe(0);
    expect(result.pairsByStrength.pp).toEqual([]);
    expect(result.totalsByStrength.pp[1]).toBe(0);
    const selected = selectMainDeploymentUnits(result.units);
    expect(selected.main.find(unit => unit.kind === "forward_line" && unit.teamId === 10)?.playerIds).toEqual([1, 2, 3]);
    expect(selected.alternatives.filter(unit => unit.kind === "forward_line" && unit.teamId === 10)).toHaveLength(2);
  });

  it("partitions a continuous physical shift across ES and PP, preserving true input totals", () => {
    const rows = fixture([
      { start: 0, end: 10, home, away },
      { start: 10, end: 40, home, away: [11, 12, 14, 15, 16], state: "pp" },
      { start: 40, end: 50, home, away },
    ]);
    rows[0].shifts = [{ period: 1, start_time: "0:00", end_time: "0:50", duration: "0:50" }];
    const result = analyze(rows);
    expect(result.totalsByStrength.fiveOnFive[1]).toBe(20);
    expect(result.totalsByStrength.pp[1]).toBe(30);
    expect(result.totalsByStrength.pk[11]).toBe(30);
    expect(result.units.find(unit => unit.kind === "power_play")).toMatchObject({ playerIds: [1, 2, 3, 4, 5], seconds: 30, gameIds: [1001] });
    expect(result.units.find(unit => unit.kind === "penalty_kill")?.playerIds).toEqual([11, 12, 14, 15]);
  });

  it("separates other ES and records unsupported PP and nonstandard 5v5 role formations", () => {
    const result = analyze(fixture([
      { start: 0, end: 10, home: [1, 2, 4, 5, 6], away: [11, 12, 14, 15, 16] },
      { start: 10, end: 20, home: [1, 2, 3, 7, 4, 6], away },
      { start: 20, end: 30, home: [1, 2, 3, 7, 4, 5], away: [11, 12, 14, 15, 16], state: "pp" },
    ]));
    expect(result.formationCoverage).toEqual({ fiveOnFiveSeconds: 10, otherEsSecondsByTeam: { 10: 10, 20: 10 },
      excludedSpecialTeamsSecondsByTeam: { 10: 10, 20: 10 }, unrepresentedFiveOnFiveSecondsByTeam: { 10: 10, 20: 0 } });
    expect(result.units.some(unit => unit.teamId === 10)).toBe(false);
    expect(result.totalsByStrength.pp[1]).toBe(10);
    expect(result.totalsByStrength.otherEs[1]).toBe(10);
  });

  it.each([2, 3] as const)("supports shortened OT and observed 4v3 for game type %s", gameType => {
    const result = analyze(fixture([{ period: 4, start: 0, end: 30, home: [1, 2, 4, 5, 6], away: [11, 14, 15, 16], state: "pp" }], 3630), gameType);
    expect(result.units.find(unit => unit.kind === "power_play")).toMatchObject({ skaterCount: 4, seconds: 30 });
    expect(result.units.find(unit => unit.kind === "penalty_kill")).toMatchObject({ skaterCount: 3 });
    const beyond = fixture([{ period: 4, start: 299, end: 301, home, away }], 3901);
    if (gameType === 2) expect(() => analyze(beyond, gameType)).toThrow(/game length/);
    else expect(analyze(beyond, gameType).formationCoverage.fiveOnFiveSeconds).toBe(2);
  });

  const corruptions: Array<[string, (rows: DeploymentShiftRow[]) => void]> = [
    ["duplicate player", rows => rows.push(structuredClone(rows[0]))],
    ["duplicate interval", rows => (rows[0].shifts as unknown[]).push(structuredClone((rows[0].shifts as unknown[])[0]))],
    ["untagged segment", rows => { delete (rows[0].es_shifts as Record<string, unknown>[])[0].strength; }],
    ["partition gap", rows => { rows[0].es_shifts = []; }],
    ["overlapping strengths", rows => { rows[0].pp_shifts = [{ ...(rows[0].es_shifts as object[])[0], strength: "pp" }]; }],
    ["wrong total", rows => { rows[0].total_es_toi = "0:59"; }],
    ["wrong player", rows => { (rows[0].shifts as Record<string, unknown>[])[0].playerId = 99; }],
    ["fractional period", rows => { (rows[0].shifts as Record<string, unknown>[])[0].period = 1.5; }],
    ["invalid clock", rows => { rows[0].game_toi = "0:60"; }],
    ["period overflow", rows => { rows[0].shifts = [{ period: 1, start_time: "20:00", end_time: "20:01", duration: "0:01" }]; }],
    ["conflicting strength", rows => { rows[0].pp_shifts = [{ ...(rows[0].es_shifts as object[])[0], strength: "pp" }]; rows[0].es_shifts = []; rows[0].total_pp_toi = "1:00"; rows[0].total_es_toi = "0:00"; }],
    ["missing team", rows => { rows.splice(6); }],
    ["unknown role", rows => { (rows[0] as unknown as Record<string, unknown>).player_type = "U"; }],
  ];
  it.each(corruptions)("rejects the whole game for %s", (_name, mutate) => {
    const rows = fixture([{ start: 0, end: 60, home, away }]); mutate(rows);
    expect(() => analyze(rows)).toThrow(/Invalid deployment evidence/);
  });

  it("matches an independent per-second occupancy oracle", () => {
    const blocks: Block[] = [
      { start: 0, end: 8, home, away }, { start: 8, end: 11, home: [1, 2, 7, 4, 5, 6], away },
      { start: 11, end: 17, home, away: [11, 12, 14, 15, 16], state: "pp" },
      { start: 17, end: 20, home: [1, 4, 5, 6], away, state: "pk" },
      { start: 20, end: 22, home: [1, 4, 5, 6], away: [11, 14, 15, 16] },
    ];
    const rows = fixture(blocks); const result = analyze(rows);
    const totals = Object.fromEntries(["all", "fiveOnFive", "otherEs", "pp", "pk"].map(state => [state, Object.fromEntries(rows.map(row => [row.player_id, 0]))])) as Record<string, Record<number, number>>;
    const pairs: Record<string, Record<string, number>> = Object.fromEntries(Object.keys(totals).map(state => [state, {}]));
    for (let second = 0; second < 22; second += 1) {
      const block = blocks.find(candidate => candidate.start <= second && candidate.end > second)!;
      const five = (block.state ?? "es") === "es" && block.home.length === 6 && block.away.length === 6;
      for (const [players, state] of [[block.home, block.state ?? "es"], [block.away, block.state === "pp" ? "pk" : block.state === "pk" ? "pp" : "es"]] as const) {
        const bucket = state === "es" ? five ? "fiveOnFive" : "otherEs" : state;
        for (const strength of ["all", bucket]) {
          for (const player of players) totals[strength][player] += 1;
          for (const first of players) for (const next of players) if (first < next) {
            const key = `${first}:${next}`; pairs[strength][key] = (pairs[strength][key] ?? 0) + 1;
          }
        }
      }
    }
    expect(result.totalsByStrength).toEqual(totals);
    for (const strength of Object.keys(pairs)) expect(Object.fromEntries(result.pairsByStrength[strength as keyof typeof result.pairsByStrength].map(fact => [`${fact.firstPlayerId}:${fact.secondPlayerId}`, fact.seconds]))).toEqual(pairs[strength]);
  });

  it("aggregates actual changing-game trios without synthesizing a line and unions game coverage", () => {
    const first = analyze(fixture([{ start: 0, end: 40, home, away }]));
    const second = analyze(fixture([{ start: 0, end: 60, home: [1, 2, 7, 4, 5, 6], away }], 3600, 1002));
    const third = analyze(fixture([{ start: 0, end: 30, home, away }], 3600, 1003));
    const input = [...first.units, ...second.units, ...third.units]; const snapshot = structuredClone(input);
    const selected = selectMainDeploymentUnits(input);
    expect(selected.main.find(unit => unit.teamId === 10 && unit.kind === "forward_line")).toMatchObject({ playerIds: [1, 2, 3], seconds: 70, gameIds: [1001, 1003] });
    expect(selected.alternatives.find(unit => unit.teamId === 10 && unit.kind === "forward_line")).toMatchObject({ playerIds: [1, 2, 7], seconds: 60, gameIds: [1002] });
    expect(selectMainDeploymentUnits([...input].reverse())).toEqual(selected);
    expect(input).toEqual(snapshot);
  });

  it("assigns a player whose historical role changes only once in the main 5v5 lineup", () => {
    const forward: ObservedDeploymentUnit = { teamId: 10, gameIds: [1001], strength: "fiveOnFive", kind: "forward_line", skaterCount: 5, playerIds: [1, 2, 3], seconds: 100 };
    const defense: ObservedDeploymentUnit = { ...forward, gameIds: [1002], kind: "defense_pair", playerIds: [1, 4], seconds: 50 };
    const result = selectMainDeploymentUnits([defense, forward]);
    expect(result.main).toEqual([forward]);
    expect(result.alternatives).toEqual([defense]);
  });

  it("breaks equal-duration ties by numeric player identity and caps only observed disjoint groups", () => {
    const unit = (playerIds: number[]): ObservedDeploymentUnit => ({ teamId: 10, gameIds: [1001],
      strength: "fiveOnFive", kind: "forward_line", skaterCount: 5, playerIds, seconds: 10 });
    const tied = [unit([1, 20, 30]), unit([1, 3, 40])];
    expect(selectMainDeploymentUnits(tied).main[0].playerIds).toEqual([1, 3, 40]);
    expect(selectMainDeploymentUnits([...tied].reverse())).toEqual(selectMainDeploymentUnits(tied));
    const disjoint = Array.from({ length: 5 }, (_, index) => unit([index * 3 + 1, index * 3 + 2, index * 3 + 3]));
    const capped = selectMainDeploymentUnits(disjoint);
    expect(capped.main).toHaveLength(4);
    expect(capped.alternatives).toHaveLength(1);
    expect(() => selectMainDeploymentUnits([unit([1, 1, 2])])).toThrow(/selection input/);
  });
});
