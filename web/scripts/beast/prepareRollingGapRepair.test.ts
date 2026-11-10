import { describe, expect, it, vi } from "vitest";
import { prepareRollingGapRepair, validateManifest, type GapManifest, type RepairPreparationDependencies } from "./prepareRollingGapRepair";

const manifest: GapManifest = { version: 1, season: 20262027, date: "2026-11-07", strength: "5v5", players: [{ playerId: 1, gameId: 2026020001 }] };
const inputs = () => ({
  wgo: [{ player_id: 1, game_id: 2026020001, date: "2026-11-07", season_id: 20262027, games_played: 1 }],
  counts: [{ player_id: 1, date_scraped: "2026-11-07", season: 20262027, toi: 600, goals: 0, first_assists: 0, total_points: 0, shots: 3, hits: 1, shots_blocked: 1 }],
});
const ranking = () => ({
  player_id: 1, game_id: 2026020001, game_date: "2026-11-07", season: 20262027, strength_state: "5v5",
  goals_per_60_goals_season: 0, goals_per_60_toi_seconds_season: 600,
  primary_assists_per_60_primary_assists_season: 0, primary_assists_per_60_toi_seconds_season: 600,
  points_avg_season: 0, toi_seconds_avg_season: 600,
  sog_per_60_shots_season: 3, sog_per_60_toi_seconds_season: 600,
  hits_per_60_hits_season: 1, hits_per_60_toi_seconds_season: 600,
  blocks_per_60_blocks_season: 1, blocks_per_60_toi_seconds_season: 600,
});
const summary = { processedPlayers: 1, rowsUpserted: 0, freshnessBlockers: 0, unknownGameIds: 0, suspiciousOutputWarnings: 0, stoppedReason: "complete" };
function dependencies(): RepairPreparationDependencies {
  return {
    now: () => Date.parse("2026-11-09T12:00:00Z"),
    readInputs: vi.fn(async () => inputs()),
    readExisting: vi.fn(async () => ({ ranking: [], support: [] })),
    recompute: vi.fn(async (options) => {
      options.dryRunBatchObserver({ rankingRows: [ranking()], supportRows: [ranking()] });
      return summary;
    }),
  };
}
const prepare = (deps: RepairPreparationDependencies) => prepareRollingGapRepair({ manifest, offset: 0, count: 1 }, deps);

describe("bounded BEAST rolling-gap preparation", () => {
  it("captures exactly the allowlisted day/strength and never calls a write path", async () => {
    const deps = dependencies();
    const result = await prepare(deps);
    expect(result).toMatchObject({ readyForReview: true, productionWrites: 0, blockers: [], mode: "prepare_only" });
    expect(result.rankingRows).toHaveLength(1);
    expect(result.supportRows).toHaveLength(1);
    expect(result.payloadHash).toMatch(/^[a-f0-9]{64}$/);
    expect(deps.recompute).toHaveBeenCalledWith(expect.objectContaining({
      playerId: 1, season: 20262027, startDate: "2026-11-07", endDate: "2026-11-07",
      strengths: ["5v5"], maxPlayers: 1, playerConcurrency: 1, upsertConcurrency: 1,
      dryRunUpsert: true, skipDiagnostics: false,
    }));
  });

  it.each(["ranking", "support"] as const)("stops before recompute if the %s key already exists", async (table) => {
    const deps = dependencies();
    deps.readExisting = vi.fn(async () => ({ ranking: [], support: [], [table]: [ranking()] }));
    expect((await prepare(deps)).blockers.join()).toContain("already exists");
    expect(deps.recompute).not.toHaveBeenCalled();
  });

  it("detects keys inserted by another writer during preparation", async () => {
    const deps = dependencies();
    deps.readExisting = vi.fn().mockResolvedValueOnce({ ranking: [], support: [] }).mockResolvedValueOnce({ ranking: [ranking()], support: [] });
    const result = await prepare(deps);
    expect(result.readyForReview).toBe(false);
    expect(result.blockers.join()).toContain("appeared during preparation");
  });

  it.each(["missing", "duplicate", "game", "date", "toi", "count"])("rejects %s input defects before recompute", async (fault) => {
    const deps = dependencies();
    const value = inputs();
    if (fault === "missing") value.counts = [];
    if (fault === "duplicate") value.counts.push(value.counts[0]);
    if (fault === "game") value.wgo[0].game_id++;
    if (fault === "date") value.wgo[0].date = "2026-11-06";
    if (fault === "toi") value.counts[0].toi = 0;
    if (fault === "count") value.counts[0].hits = null as unknown as number;
    deps.readInputs = vi.fn(async () => value);
    expect((await prepare(deps)).readyForReview).toBe(false);
    expect(deps.recompute).not.toHaveBeenCalled();
  });

  it("detects source mutation without attempting a retry", async () => {
    const deps = dependencies();
    const changed = inputs();
    changed.counts[0].hits++;
    deps.readInputs = vi.fn().mockResolvedValueOnce(inputs()).mockResolvedValueOnce(changed);
    const result = await prepare(deps);
    expect(result.blockers.join()).toContain("inputs changed");
    expect(deps.recompute).toHaveBeenCalledTimes(1);
  });

  it.each(["scope", "duplicate", "missing_support", "component", "denominator"])("rejects %s output defects", async (fault) => {
    const deps = dependencies();
    deps.recompute = vi.fn(async (options) => {
      const row = ranking();
      if (fault === "scope") row.game_date = "2026-11-06";
      if (fault === "component") row.hits_per_60_hits_season = null as unknown as number;
      if (fault === "denominator") row.hits_per_60_toi_seconds_season = 0;
      options.dryRunBatchObserver({ rankingRows: fault === "duplicate" ? [row, row] : [row], supportRows: fault === "missing_support" ? [] : [ranking()] });
      return summary;
    });
    expect((await prepare(deps)).readyForReview).toBe(false);
  });

  it.each(["freshnessBlockers", "unknownGameIds", "suspiciousOutputWarnings", "rowsUpserted"] as const)("requires a clean %s receipt", async (field) => {
    const deps = dependencies();
    deps.recompute = vi.fn(async () => ({ ...summary, [field]: 1 }));
    expect((await prepare(deps)).blockers.join()).toContain("receipt is not clean");
  });

  it("bounds batch size and rejects malformed manifest identities", async () => {
    const deps = dependencies();
    await expect(prepareRollingGapRepair({ manifest, offset: 0, count: 26 }, deps)).rejects.toThrow("count 1–25");
    await expect(prepareRollingGapRepair({ manifest, offset: 0, count: 1, maxRuntimeMs: 220001 }, deps)).rejects.toThrow("220000");
    expect(() => validateManifest({ ...manifest, players: [manifest.players[0], manifest.players[0]] })).toThrow("duplicate");
    expect(() => validateManifest({ ...manifest, players: [{ playerId: 1, gameId: 2026010001 }] })).toThrow("non-regular");
    expect(() => validateManifest({ ...manifest, date: "2026-02-30" })).toThrow();
    expect(() => validateManifest({ ...manifest, season: 20262028 })).toThrow("season disagree");
  });

  it("ends on read errors and budget exhaustion without recompute", async () => {
    const deps = dependencies();
    deps.readInputs = vi.fn(async () => { throw new Error("fixture timeout"); });
    expect((await prepare(deps)).blockers).toEqual(["fixture timeout"]);
    expect(deps.recompute).not.toHaveBeenCalled();
    const clocked = dependencies();
    clocked.now = vi.fn().mockReturnValueOnce(0).mockReturnValue(220001);
    expect((await prepare(clocked)).blockers.join()).toContain("runtime budget exhausted");
    expect(clocked.recompute).not.toHaveBeenCalled();
  });
});
