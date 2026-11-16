import { readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { gunzipSync } from "node:zlib";
import { afterEach, describe, expect, it, vi } from "vitest";

vi.mock("lib/supabase/server", () => ({ default: {} }));

import { TREND_BAND_METRIC_PRIORITY, TREND_BAND_WINDOW_PRIORITY } from "../constants/projection-weights";
import { installProjectionReadOnlyProbe } from "../queryCaptureHook";
import type { SustainabilityTrendBandRow } from "../types/run-forge-projections.types";
import { compareTrendBandRowsForSelection, computeSkaterTrendAdjustment, resolveTrendBandReaderMode } from "../utils/trend-adjustments";
import { fetchLatestSkaterTrendAdjustments } from "./skater-queries";
import {
  expectedLatestTrendBandKeys,
  latestTrendBandCoverageProblem,
  type LatestTrendBandKeyRow
} from "./trendBandLatest";

type Packed = [number, string | null, string, string, number | null, number | null, number | null, number | null];
type Team = { playerIds: number[]; boundary: string | null; old_as_sent: Packed[]; old_tie_asc?: Packed[]; old_tie_desc?: Packed[]; new: Packed[] };
type Fixture = { asOf: string; readerMetrics: string[]; readerWindows: string[]; teams: Record<string, Team> };

// Produced by tasks/artifacts/forge-pregame-capture-2026-11-14/trend-band-reader/bench (disposable PG15,
// about 11M production-shaped rows): each team's rows from the old history GET's SQL (as executed, and under both
// explicit tie orders it permits) and from forge_latest_trend_bands, over the same table.
const fixturePath = join(__dirname, "__fixtures__", "trend-band-latest", "bench-rows.json.gz");
const fixture = JSON.parse(gunzipSync(readFileSync(fixturePath) as unknown as Uint8Array).toString()) as Fixture;
const unpack = (rows: Packed[]): LatestTrendBandKeyRow[] => rows.map(([player_id, snapshot_date, metric_key, window_code, value, ci_lower, ci_upper, n_eff]) =>
  ({ player_id, snapshot_date, metric_key, window_code, value, ci_lower, ci_upper, n_eff }));

/** A client that answers the RPC as given and the history GET with the given rows, recording every call. */
function client(options: { rpc?: () => unknown; historyRows?: unknown[] }) {
  const calls: Array<[string, unknown[]]> = [];
  return {
    calls,
    db: {
      rpc: (...args: unknown[]) => {
        calls.push(["rpc", args]);
        return Promise.resolve(options.rpc ? options.rpc() : { data: null, error: { code: "PGRST202", message: "not deployed" } });
      },
      from: (table: string) => {
        calls.push(["from", [table]]);
        const query: Record<string, unknown> = { then(resolve: (value: unknown) => void) {
          resolve({ data: options.historyRows ?? [], error: null });
        } };
        for (const name of ["select", "in", "lte", "order", "limit"]) {
          query[name] = (...args: unknown[]) => { calls.push([name, args]); return query; };
        }
        return query;
      },
    } as any,
  };
}
const viaRpc = (rows: Packed[], playerIds: number[], asOf: string) =>
  fetchLatestSkaterTrendAdjustments(playerIds, asOf, client({ rpc: () => ({ data: unpack(rows), error: null }) }).db);
const viaHistory = (rows: Packed[], playerIds: number[], asOf: string) =>
  fetchLatestSkaterTrendAdjustments(playerIds, asOf, client({ historyRows: unpack(rows) }).db);

/** The pre-2026-11-15 selection, verbatim in effect: the best of every returned row per player. */
function oldSelection(rows: Packed[], asOf: string) {
  const byPlayer = new Map<number, SustainabilityTrendBandRow[]>();
  for (const row of unpack(rows) as SustainabilityTrendBandRow[]) byPlayer.set(row.player_id, [...(byPlayer.get(row.player_id) ?? []), row]);
  return new Map([...byPlayer].map(([id, list]) => [id, computeSkaterTrendAdjustment({
    row: list.slice().sort((a, b) => compareTrendBandRowsForSelection(a, b, asOf))[0], asOfDate: asOf })]));
}

function newestDateByPlayer(rows: LatestTrendBandKeyRow[]) {
  const newest = new Map<number, string>();
  for (const row of rows) {
    if (row.snapshot_date && (newest.get(row.player_id) ?? "") < row.snapshot_date) newest.set(row.player_id, row.snapshot_date);
  }
  return newest;
}

describe("latest trend-band read vs the capped history GET (same benchmark rows)", () => {
  it("uses the reader's exact lists, and the history fallback sends the old request", async () => {
    expect(resolveTrendBandReaderMode()).toEqual({ mode: "inert" });
    expect(fixture.readerMetrics).toEqual([...TREND_BAND_METRIC_PRIORITY]);
    expect(fixture.readerWindows).toEqual([...TREND_BAND_WINDOW_PRIORITY]);
    const team = fixture.teams.typical_a;
    const { db, calls } = client({ historyRows: unpack(team.old_as_sent) });
    await fetchLatestSkaterTrendAdjustments(team.playerIds, fixture.asOf, db);
    expect(calls.slice(1)).toEqual([
      ["from", ["sustainability_trend_bands"]],
      ["select", ["player_id,snapshot_date,metric_key,window_code,value,ci_lower,ci_upper,n_eff"]],
      ["in", ["player_id", team.playerIds]],
      ["in", ["metric_key", [...TREND_BAND_METRIC_PRIORITY]]],
      ["in", ["window_code", [...TREND_BAND_WINDOW_PRIORITY]]],
      ["lte", ["snapshot_date", fixture.asOf]],
      ["order", ["snapshot_date", { ascending: false }]],
      ["limit", [12000]]
    ]);
  });

  const comparisons: Record<string, unknown> = {};
  for (const [name, team] of Object.entries(fixture.teams)) {
    it(`${name}: identical selection for every player whose newest row the cap kept; stale rows no longer read as missing`, async () => {
      const latest = unpack(team.new);
      expect(latestTrendBandCoverageProblem(latest, expectedLatestTrendBandKeys(team.playerIds), fixture.asOf)).toBeNull();
      const fresh = await viaRpc(team.new, team.playerIds, fixture.asOf);
      const history = await viaHistory(team.old_as_sent, team.playerIds, fixture.asOf);
      // The history fallback keeps the old reader's selection exactly.
      expect(history.adjustments).toEqual(oldSelection(team.old_as_sent, fixture.asOf));
      const capped = team.old_as_sent.length === 1000;
      const newest = newestDateByPlayer(latest);
      const classes: Record<string, number[]> = { in_cap: [], boundary: [], beyond_cap: [], no_rows: [] };
      for (const playerId of team.playerIds) {
        const date = newest.get(playerId);
        const kind = !date ? "no_rows" : !capped || date > team.boundary! ? "in_cap" : date === team.boundary ? "boundary" : "beyond_cap";
        classes[kind].push(playerId);
        if (kind === "in_cap" || kind === "no_rows") expect(history.adjustments.get(playerId), `${name}/${playerId}`).toEqual(fresh.adjustments.get(playerId));
        if (kind === "beyond_cap") {
          expect(history.adjustments.has(playerId)).toBe(false);
          expect(fresh.adjustments.get(playerId)?.snapshotDate).toBe(date);
        }
        // While the reader is inert (Decision 26), a changed selection moves no rate and no uncertainty.
        if (kind === "beyond_cap" || kind === "boundary") {
          const adjustment = fresh.adjustments.get(playerId);
          expect([adjustment?.shotRateMultiplier, adjustment?.goalRateMultiplier, adjustment?.assistRateMultiplier,
            adjustment?.uncertaintyVolatilityMultiplier].every((m) => m === undefined || m === 1)).toBe(true);
        }
      }
      // The statement as executed and the two explicit tie orders are all valid results of the old GET.
      let boundaryUnstable: number[] = [];
      if (team.old_tie_asc && team.old_tie_desc) {
        const variants = [history, await viaHistory(team.old_tie_asc, team.playerIds, fixture.asOf),
          await viaHistory(team.old_tie_desc, team.playerIds, fixture.asOf)];
        boundaryUnstable = classes.boundary.filter((id) => new Set(variants.map((v) => JSON.stringify(v.adjustments.get(id) ?? null))).size > 1);
      }
      comparisons[name] = {
        oldRows: team.old_as_sent.length, boundary: team.boundary, classes: Object.fromEntries(Object.entries(classes).map(([k, v]) => [k, v.length])),
        boundaryUnstable: boundaryUnstable.length,
        diagnostics: { history: history.diagnostics, rpc: fresh.diagnostics },
        selectionChanged: team.playerIds.filter((id) => JSON.stringify(history.adjustments.get(id)) !== JSON.stringify(fresh.adjustments.get(id))).length
      };
      if (name === "edge") {
        expect(classes.boundary.length).toBeGreaterThan(0);
        expect(boundaryUnstable.length).toBeGreaterThan(0);
      }
    });
  }

  it("records the comparison for the evidence note when asked", () => {
    if (process.env.TREND_BAND_COMPARE_OUT) writeFileSync(process.env.TREND_BAND_COMPARE_OUT, `${JSON.stringify(comparisons, null, 1)}\n`);
    expect(Object.keys(comparisons)).toEqual(Object.keys(fixture.teams));
  });
});

describe("latest trend-band read contract", () => {
  const asOf = "2026-11-14";
  const keyRow = (player_id: number, metric_key: string, window_code: string, snapshot_date: string | null, value: number | null = 5): LatestTrendBandKeyRow =>
    ({ player_id, metric_key, window_code, snapshot_date, value: snapshot_date ? value : null,
      ci_lower: snapshot_date ? 4 : null, ci_upper: snapshot_date ? 6 : null, n_eff: snapshot_date ? 6 : null });
  const full = (playerIds: number[], date: (key: { playerId: number; metricKey: string; windowCode: string }) => string | null) =>
    expectedLatestTrendBandKeys(playerIds).map((key) => keyRow(key.playerId, key.metricKey, key.windowCode, date(key)));
  afterEach(() => installProjectionReadOnlyProbe(() => false));

  it("expects keys in the function's byte order", () => {
    expect(expectedLatestTrendBandKeys([9, 3, 9]).slice(0, 3)).toEqual([
      { playerId: 3, metricKey: "fantasy_score", windowCode: "l10" },
      { playerId: 3, metricKey: "fantasy_score", windowCode: "l5" },
      { playerId: 3, metricKey: "ixg_per_60", windowCode: "l10" }
    ]);
    expect(expectedLatestTrendBandKeys([9, 3, 9])).toHaveLength(16);
  });

  it("refuses short, reordered, orphaned or future responses", () => {
    const keys = expectedLatestTrendBandKeys([3]);
    const rows = full([3], () => "2026-11-13");
    expect(latestTrendBandCoverageProblem(rows, keys, asOf)).toBeNull();
    expect(latestTrendBandCoverageProblem(rows.slice(1), keys, asOf)).toBe("row_count:7!=8");
    expect(latestTrendBandCoverageProblem([rows[1], rows[0], ...rows.slice(2)], keys, asOf)).toBe("key_mismatch:0");
    expect(latestTrendBandCoverageProblem([{ ...rows[0], snapshot_date: null }, ...rows.slice(1)], keys, asOf)).toBe("orphan_values:0");
    expect(latestTrendBandCoverageProblem([{ ...rows[0], snapshot_date: "2026-11-15" }, ...rows.slice(1)], keys, asOf)).toBe("after_as_of:0");
    expect(latestTrendBandCoverageProblem({ rows }, keys, asOf)).toBe("response_not_array");
  });

  it("selects newest date, then metric priority, then window priority; hard-stale is not missing", async () => {
    const rows = [
      ...full([1], (k) => (k.metricKey === "fantasy_score" && k.windowCode === "l5" ? "2026-11-10" : "2026-11-13")),
      ...full([2], () => "2026-10-01"),
      ...full([4], () => null)
    ];
    const { adjustments, diagnostics } = await fetchLatestSkaterTrendAdjustments([1, 2, 4], asOf, client({ rpc: () => ({ data: rows, error: null }) }).db);
    expect(adjustments.get(1)).toMatchObject({ metricKey: "fantasy_score", windowCode: "l10", snapshotDate: "2026-11-13" });
    expect(adjustments.get(2)).toMatchObject({ recencyClass: "hard_stale", snapshotDate: "2026-10-01" });
    expect(adjustments.has(4)).toBe(false);
    expect(diagnostics).toMatchObject({ requestedPlayers: 3, candidateRows: 16, playersWithRows: 2, playersMissingRows: 1, selectedHardStaleRows: 1 });
  });

  it("makes one GET call; a failed or incomplete read reports fetchFailed and never throws", async () => {
    const ok = client({ rpc: () => ({ data: full([5, 7], () => "2026-11-12"), error: null }) });
    const result = await fetchLatestSkaterTrendAdjustments([7, 5, 7], asOf, ok.db);
    expect(ok.calls).toEqual([["rpc", ["forge_latest_trend_bands", { p_player_ids: [7, 5], p_metric_keys: [...TREND_BAND_METRIC_PRIORITY],
      p_window_codes: [...TREND_BAND_WINDOW_PRIORITY], p_as_of: asOf }, { get: true }]]]);
    expect(result.diagnostics).toMatchObject({ fetchFailed: false, playersWithRows: 2, candidateRows: 16 });

    const timeout = client({ rpc: () => ({ data: null, error: { code: "57014", message: "canceling statement due to statement timeout" } }) });
    expect((await fetchLatestSkaterTrendAdjustments([7], asOf, timeout.db)).diagnostics).toMatchObject({
      fetchFailed: true, fetchErrorMessage: "canceling statement due to statement timeout", playersMissingRows: 1 });
    expect(timeout.calls.map(([kind]) => kind)).toEqual(["rpc"]);
    const short = client({ rpc: () => ({ data: full([7], () => "2026-11-12").slice(1), error: null }) });
    expect((await fetchLatestSkaterTrendAdjustments([7], asOf, short.db)).diagnostics.fetchErrorMessage).toBe("trend_band_coverage:row_count:7!=8");

    const never = client({ rpc: () => ({ data: [], error: null }) });
    const tooMany = Array.from({ length: 126 }, (_, i) => i + 1);
    expect((await fetchLatestSkaterTrendAdjustments(tooMany, asOf, never.db)).diagnostics.fetchErrorMessage).toBe("trend_band_keys_exceed_limit:1008");
    expect(never.calls).toEqual([]);
  });

  it("reads by the history GET before the function is deployed, in read-only reconstruction and when replaying a legacy snapshot", async () => {
    const history = [keyRow(3, "shots_per_60", "l10", "2026-11-12"), keyRow(3, "fantasy_score", "l5", "2026-11-11")];
    const missing = client({ historyRows: history });
    const result = await fetchLatestSkaterTrendAdjustments([3], asOf, missing.db);
    expect(missing.calls.map(([kind]) => kind).filter((kind) => kind === "rpc" || kind === "from")).toEqual(["rpc", "from"]);
    expect(result.adjustments.get(3)).toMatchObject({ metricKey: "shots_per_60", snapshotDate: "2026-11-12" });
    expect(result.diagnostics).toMatchObject({ candidateRows: 2, playersWithRows: 1 });

    installProjectionReadOnlyProbe(() => true);
    const readOnly = client({ rpc: () => { throw new Error("must not be called"); }, historyRows: history });
    await fetchLatestSkaterTrendAdjustments([3], asOf, readOnly.db);
    expect(readOnly.calls.map(([kind]) => kind).filter((kind) => kind === "rpc" || kind === "from")).toEqual(["from"]);
    installProjectionReadOnlyProbe(() => false);

    const replay = client({ rpc: () => { throw new Error("Unrecorded projection input: rpc forge_latest_trend_bands"); }, historyRows: history });
    expect((await fetchLatestSkaterTrendAdjustments([3], asOf, replay.db)).diagnostics.fetchFailed).toBe(false);
    const broken = client({ rpc: () => { throw new Error("FORGE native input collection passed its deadline."); } });
    await expect(fetchLatestSkaterTrendAdjustments([3], asOf, broken.db)).rejects.toThrow("passed its deadline");
  });
});
