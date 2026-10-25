import { describe, expect, it } from "vitest";
import { createAlignedCountSupportBuilder, readAlignedCountSupport } from "./rollingPlayerCountSupport";

const games = Array.from({ length: 7 }, (_, index) => ({ id: index + 1, date: `2026-10-0${index + 1}`, seasonId: 20262027 }));
const counts = games.map(game => ({ id: game.id + 100, player_id: 7, date_scraped: game.date, season: game.seasonId, goals: 1, shots: 4, total_assists: 2 }));
const identity = (game: typeof games[number]) => ({ player_id: 7, game_id: game.id, date: game.date, season_id: game.seasonId });
const options = { playerId: 7, strengthState: "pp" as const, sourceTable: "nst_gamelog_pp_counts", startDate: games[0].date, canonicalGames: games, countsRows: counts };
const scope = { playerId: 7, strengthState: "pp" as const, anchor: { gameId: 7, gameDate: games[6].date, seasonId: 20262027 } };
function replay(rows = counts) {
  const builder = createAlignedCountSupportBuilder({ ...options, countsRows: rows });
  return games.map(game => builder.push(identity(game))).at(-1)!;
}

describe("aligned conversion count support", () => {
  it("retains common all-history and recent pair frames without mutating older snapshots", () => {
    const builder = createAlignedCountSupportBuilder(options);
    const first = builder.push(identity(games[0]))!;
    for (const game of games.slice(1)) builder.push(identity(game));
    expect(first.pairs.goalPerShot?.all).toMatchObject({ observations: 1, numerator: 1, denominator: 4 });
    const latest = replay();
    expect(latest.pairs.goalPerShot?.all).toMatchObject({ observations: 7, numerator: 7, denominator: 28 });
    expect(latest.pairs.goalPerShot?.last5).toMatchObject({ observations: 5, numerator: 5, denominator: 20, firstDate: games[2].date });
    expect(latest.pairs.assistPerGoal?.last5).toMatchObject({ numerator: 10, denominator: 5 });
    expect(readAlignedCountSupport(latest, scope)).toEqual(latest);
  });
  it("selects each pair independently and reports missing values without zero imputation", () => {
    const rows = counts.map((row, index) => ({ ...row, ...(index === 6 ? { total_assists: null } : {}) }));
    const latest = replay(rows as typeof counts);
    expect(latest.pairs.goalPerShot?.all.observations).toBe(7);
    expect(latest.pairs.assistPerGoal?.all.observations).toBe(6);
    expect(latest.pairs.assistPerGoal?.last5.lastDate).toBe(games[5].date);
    expect(latest.coverage.missingPair).toEqual({ goalPerShot: 0, assistPerGoal: 1 });
    expect(readAlignedCountSupport(latest, scope)).toEqual(latest);
    expect(replay([]).pairs).toEqual({ goalPerShot: null, assistPerGoal: null });
  });
  it("rejects ambiguous dates and missing/mismatched canonical events", () => {
    const ambiguous = replay([...counts, counts[6]]);
    expect(ambiguous.coverage.excluded.ambiguous_source_date).toBe(1);
    expect(ambiguous.pairs.goalPerShot?.all.observations).toBe(6);
    const builder = createAlignedCountSupportBuilder(options);
    expect(builder.push({ ...identity(games[0]), season_id: 20252026 })).toBeNull();
    expect(builder.push({ ...identity(games[1]), game_id: null })).toBeNull();
    const changed = replay(counts.map(row => ({ ...row, season: 20252026 })));
    expect(changed.pairs.goalPerShot).toBeNull();
  });
  it("rejects old scalars, wrong anchors, malformed or changed frame contents", () => {
    const value = replay();
    expect(readAlignedCountSupport({ goals_total_all: 331, shots_total_all: 510 }, scope)).toBeNull();
    expect(readAlignedCountSupport(value, { ...scope, anchor: { ...scope.anchor, gameId: 8 } })).toBeNull();
    expect(readAlignedCountSupport(value, { ...scope, strengthState: "ev" })).toBeNull();
    for (const change of [null, { ...value.pairs.goalPerShot!.last5.frames[0], numerator: 2 }]) {
      const corrupted = structuredClone(value);
      (corrupted.pairs.goalPerShot!.last5.frames as unknown[])[0] = change;
      expect(readAlignedCountSupport(corrupted, scope)).toBeNull();
    }
  });
  it("retains observed zero counts and refuses duplicate or reversed event order", () => {
    const zero = replay(counts.map(row => ({ ...row, goals: 0, shots: 0, total_assists: 0 })));
    expect(zero.pairs.goalPerShot?.all.denominator).toBe(0);
    expect(readAlignedCountSupport(zero, scope)).toEqual(zero);
    const builder = createAlignedCountSupportBuilder(options);
    builder.push(identity(games[1]));
    expect(() => builder.push(identity(games[1]))).toThrow("Duplicate");
    expect(() => builder.push(identity(games[0]))).toThrow("order/window");
  });
});
