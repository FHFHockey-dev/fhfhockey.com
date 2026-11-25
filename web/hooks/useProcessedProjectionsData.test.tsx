import { act, cleanup, renderHook, waitFor } from "@testing-library/react";
import { afterEach, expect, it, vi } from "vitest";
import { PROJECTION_SOURCES_CONFIG } from "lib/projectionsConfig/projectionSourcesConfig";
import {
  useProcessedProjectionsData,
  type CustomAdditionalProjectionSource,
  type UseProcessedProjectionsDataProps,
  type UseProcessedProjectionsDataReturn,
} from "./useProcessedProjectionsData";

const noop = () => {};
const styles = {};
const sourceControls = { custom_csv_1: { isSelected: true, weight: 1 } };
const fantasyPointSettings = { GOALS: 1 };
function source(goals: number): CustomAdditionalProjectionSource {
  return { id: "custom_csv_1", displayName: "Custom", playerType: "skater", rows: [{ player_id: 8478427, Player_Name: "Test Player", Position: "C", Goals: goals, Alternate_Goals: 42 }], primaryPlayerIdKey: "player_id", originalPlayerNameKey: "Player_Name", positionKey: "Position", statMappings: [{ key: "GOALS", dbColumnName: "Goals" }] };
}
function mockSupabase() {
  return { from: vi.fn(() => {
    const query: any = {};
    for (const name of ["select", "eq", "in", "like", "order"]) query[name] = vi.fn(() => query);
    query.range = vi.fn().mockResolvedValue({ data: [], error: null });
    return query;
  }) } as any;
}
afterEach(() => { cleanup(); vi.restoreAllMocks(); });

it("invalidates cached custom rows and mappings when row count and source identity stay unchanged", async () => {
  vi.spyOn(console, "log").mockImplementation(noop);
  vi.spyOn(console, "table").mockImplementation(noop);
  const supabaseClient = mockSupabase();
  const { result, rerender } = renderHook(({ customAdditionalSources }) => useProcessedProjectionsData({ activePlayerType: "skater", sourceControls, yahooDraftMode: "ALL", fantasyPointSettings, supabaseClient, currentSeasonId: "20262027", styles, showPerGameFantasyPoints: false, togglePerGameFantasyPoints: noop, customAdditionalSources }), { initialProps: { customAdditionalSources: [source(30)] } });
  await waitFor(() => expect(result.current.processedPlayers).toHaveLength(1));
  expect(result.current.processedPlayers[0].combinedStats.GOALS.projected).toBe(30);
  rerender({ customAdditionalSources: [source(31)] });
  await waitFor(() => expect(result.current.processedPlayers[0].combinedStats.GOALS.projected).toBe(31));
  rerender({ customAdditionalSources: [{ ...source(31), statMappings: [{ key: "GOALS", dbColumnName: "Alternate_Goals" }] }] });
  await waitFor(() => expect(result.current.processedPlayers[0].combinedStats.GOALS.projected).toBe(42));
});

function shSource(statMappings: CustomAdditionalProjectionSource["statMappings"]): CustomAdditionalProjectionSource {
  return { ...source(30), rows: [{ player_id: 8478427, Player_Name: "Test Player", Position: "C", Goals: 30, SH_Goals: 1, SH_Points: 3, SH_Assists: 0 }], statMappings: [{ key: "GOALS", dbColumnName: "Goals" }, ...statMappings] };
}
function renderSkaters(customAdditionalSources: CustomAdditionalProjectionSource[]) {
  vi.spyOn(console, "log").mockImplementation(noop);
  vi.spyOn(console, "table").mockImplementation(noop);
  const supabaseClient = mockSupabase();
  return renderHook(() => useProcessedProjectionsData({ activePlayerType: "skater", sourceControls, yahooDraftMode: "ALL", fantasyPointSettings, supabaseClient, currentSeasonId: "20262027", styles, showPerGameFantasyPoints: false, togglePerGameFantasyPoints: noop, customAdditionalSources }));
}

it("keeps a directly mapped projected SHA, including zero, instead of SHP - SHG", async () => {
  const { result } = renderSkaters([shSource([{ key: "SH_GOALS", dbColumnName: "SH_Goals" }, { key: "SH_POINTS", dbColumnName: "SH_Points" }, { key: "SH_ASSISTS", dbColumnName: "SH_Assists" }])]);
  await waitFor(() => expect(result.current.processedPlayers).toHaveLength(1));
  expect(result.current.processedPlayers[0].combinedStats.SH_ASSISTS.projected).toBe(0);
});

it("derives projected SHA from SHP - SHG only when no source maps SHA", async () => {
  const { result } = renderSkaters([shSource([{ key: "SH_GOALS", dbColumnName: "SH_Goals" }, { key: "SH_POINTS", dbColumnName: "SH_Points" }])]);
  await waitFor(() => expect(result.current.processedPlayers).toHaveLength(1));
  expect(result.current.processedPlayers[0].combinedStats.SH_ASSISTS.projected).toBe(2);
});

it("maps provider SHA for every official skater source, so the direct branch applies", () => {
  const skaterSources = PROJECTION_SOURCES_CONFIG.filter((config) => config.playerType === "skater");
  expect(skaterSources.length).toBeGreaterThan(0);
  for (const config of skaterSources) expect(config.statMappings.map((mapping) => mapping.key)).toContain("SH_ASSISTS");
});

function mockSupabaseWithActuals(actualRows: Record<string, unknown>[]) {
  return { from: vi.fn((table: string) => {
    const query: any = {};
    for (const name of ["select", "eq", "in", "like", "order"]) query[name] = vi.fn(() => query);
    query.range = vi.fn().mockResolvedValue({ data: table === "wgo_skater_stats_totals" ? actualRows : [], error: null });
    return query;
  }) } as any;
}
function gpSource(): CustomAdditionalProjectionSource {
  return { ...source(41), rows: [{ player_id: 8478427, Player_Name: "Test Player", Position: "C", Goals: 41, GP: 82 }], statMappings: [{ key: "GOALS", dbColumnName: "Goals" }, { key: "GAMES_PLAYED", dbColumnName: "GP" }] };
}
function renderWithActuals(actualRows: Record<string, unknown>[]) {
  vi.spyOn(console, "log").mockImplementation(noop);
  vi.spyOn(console, "table").mockImplementation(noop);
  const supabaseClient = mockSupabaseWithActuals(actualRows);
  const customAdditionalSources = [gpSource()];
  return renderHook(() => useProcessedProjectionsData({ activePlayerType: "skater", sourceControls, yahooDraftMode: "ALL", fantasyPointSettings, supabaseClient, currentSeasonId: "20262027", styles, showPerGameFantasyPoints: false, togglePerGameFantasyPoints: noop, customAdditionalSources }));
}

it("serves like-for-like diffs: season-to-date actuals against the projection pro-rated to games played (M-DRF-010)", async () => {
  const { result } = renderWithActuals([{ player_id: 8478427, games_played: 20, goals: 10 }]);
  await waitFor(() => expect(result.current.processedPlayers).toHaveLength(1));
  const player = result.current.processedPlayers[0] as any;
  expect(player.combinedStats.GOALS.actual).toBe(10);
  expect(player.combinedStats.GOALS.diffPercentage).toBe(0);
  expect(player.combinedStats.GAMES_PLAYED.diffPercentage).toBeNull();
  expect(player.fantasyPoints.diffPercentage).toBe(0);
});

it("keeps actual fantasy points unknown, not zero, when the player has no actual stats row", async () => {
  const { result } = renderWithActuals([]);
  await waitFor(() => expect(result.current.processedPlayers).toHaveLength(1));
  const player = result.current.processedPlayers[0] as any;
  expect(player.fantasyPoints.projected).toBe(41);
  expect(player.fantasyPoints.actual).toBeNull();
  expect(player.fantasyPoints.diffPercentage).toBeNull();
});

const cacheInputs = {
  activePlayerType: "skater",
  sourceControls,
  yahooDraftMode: "ALL",
  fantasyPointSettings,
  currentSeasonId: "20262027",
  styles,
  showPerGameFantasyPoints: false,
  togglePerGameFantasyPoints: noop,
} as const;

function captureProcessingPasses() {
  const log = vi.spyOn(console, "log").mockImplementation(noop);
  vi.spyOn(console, "table").mockImplementation(noop);
  return () => log.mock.calls.filter(([message]) => message === "[ProjectionsPhase] start").length;
}

it("reuses settled CSV processing for equal inputs and calculates scores without fetching again", async () => {
  const passes = captureProcessingPasses();
  const supabaseClient = mockSupabase();
  const inputs = { ...cacheInputs, supabaseClient, customAdditionalSources: [source(30)] };
  const { result, rerender } = renderHook<UseProcessedProjectionsDataReturn, UseProcessedProjectionsDataProps>(useProcessedProjectionsData, { initialProps: inputs });
  await waitFor(() => expect(result.current.processedPlayers[0]?.combinedStats.GOALS.projected).toBe(30));
  const players = result.current.processedPlayers;
  const columns = result.current.tableColumns;
  const initialPasses = passes();
  const initialQueries = supabaseClient.from.mock.calls.length;

  const identical = {
    ...inputs,
    styles: {},
    togglePerGameFantasyPoints: () => {},
    customAdditionalSources: [source(30)],
    sourceControls: { custom_csv_1: { weight: 1, isSelected: true } },
    fantasyPointSettings: { GOALS: 1 },
  };
  rerender({ ...identical, showPerGameFantasyPoints: true });
  await waitFor(() => expect(result.current.tableColumns).not.toBe(columns));
  await waitFor(() => expect(result.current.isLoading).toBe(false));
  expect(result.current.processedPlayers).toBe(players);
  expect(passes()).toBe(initialPasses);
  expect(supabaseClient.from).toHaveBeenCalledTimes(initialQueries);

  rerender({ ...identical, fantasyPointSettings: { GOALS: 2 }, teamCountForRoundSummaries: 10 });
  await waitFor(() => expect(result.current.processedPlayers[0].fantasyPoints?.projected).toBe(60));
  expect(passes()).toBe(initialPasses);
  expect(supabaseClient.from).toHaveBeenCalledTimes(initialQueries);
});

it("invalidates the relevant cache for either CSV input, weights, resolution metadata, refresh, season and client", async () => {
  const passes = captureProcessingPasses();
  const supabaseClient = mockSupabaseWithActuals([{ player_id: 8478427, goals: 4 }]);
  const otherClient = mockSupabaseWithActuals([{ player_id: 8478427, goals: 8 }]);
  const singleton = (goals: number, lastUpdated = 1): CustomAdditionalProjectionSource => ({
    ...source(goals),
    id: "custom_csv_2",
    resolution: { totalRows: 1, idMatched: 1, nameMatched: 0, unresolved: 0, coverage: 100, lastUpdated, unresolvedNames: [] },
  });
  const controls = {
    custom_csv_1: { isSelected: true, weight: 1 },
    custom_csv_2: { isSelected: true, weight: 1 },
  };
  const inputs = {
    ...cacheInputs, sourceControls: controls, supabaseClient,
    customAdditionalSources: [source(30)], customAdditionalSource: singleton(40),
  };
  const { result, rerender } = renderHook<UseProcessedProjectionsDataReturn, UseProcessedProjectionsDataProps>(useProcessedProjectionsData, { initialProps: inputs });
  const projected = () => result.current.processedPlayers[0]?.combinedStats.GOALS.projected;
  await waitFor(() => expect(projected()).toBe(35));
  expect(result.current.processedPlayers[0].combinedStats.GOALS.actual).toBe(4);

  const updated = { ...inputs, customAdditionalSource: singleton(50) };
  rerender(updated);
  await waitFor(() => expect(projected()).toBe(40));
  const settledQueries = supabaseClient.from.mock.calls.length;
  const settledPasses = passes();

  const weighted = {
    ...updated, sourceControls: { ...controls, custom_csv_2: { isSelected: true, weight: 3 } },
  };
  rerender(weighted);
  await waitFor(() => expect(projected()).toBe(45));
  expect(passes()).toBeGreaterThan(settledPasses);
  expect(supabaseClient.from).toHaveBeenCalledTimes(settledQueries);

  const resolution = { ...weighted, customAdditionalSource: singleton(50, 2) };
  rerender(resolution);
  await waitFor(() => expect(result.current.isLoading).toBe(false));
  expect(result.current.customSourceResolutions?.custom_csv_2?.lastUpdated).toBe(2);
  expect(supabaseClient.from.mock.calls.length).toBeGreaterThan(settledQueries);

  let previousQueries = supabaseClient.from.mock.calls.length;
  const refreshed = { ...resolution, refreshKey: 1 };
  rerender(refreshed);
  await waitFor(() => expect(result.current.isLoading).toBe(false));
  expect(supabaseClient.from.mock.calls.length).toBeGreaterThan(previousQueries);

  previousQueries = supabaseClient.from.mock.calls.length;
  const season = { ...refreshed, currentSeasonId: "20252026" };
  rerender(season);
  await waitFor(() => expect(result.current.isLoading).toBe(false));
  expect(supabaseClient.from.mock.calls.length).toBeGreaterThan(previousQueries);

  rerender({ ...season, supabaseClient: otherClient });
  await waitFor(() => expect(result.current.processedPlayers[0].combinedStats.GOALS.actual).toBe(8));
  expect(otherClient.from.mock.calls.length).toBeGreaterThan(0);
});

it("reprocesses name fallback and scoring together with the settled raw data", async () => {
  captureProcessingPasses();
  const supabaseClient = mockSupabase();
  const singleton = { ...source(50), id: "custom_csv_2",
    rows: [{ ...source(50).rows[0], player_id: 999 }] };
  const inputs = { ...cacheInputs, supabaseClient,
    sourceControls: { ...sourceControls, custom_csv_2: { isSelected: true, weight: 1 } },
    customAdditionalSources: [source(30)], customAdditionalSource: singleton,
  };
  const { result, rerender } = renderHook<UseProcessedProjectionsDataReturn, UseProcessedProjectionsDataProps>(useProcessedProjectionsData, { initialProps: inputs });
  const chosen = () => result.current.processedPlayers.find((row) => row.playerId === 8478427);
  await waitFor(() => expect(chosen()?.combinedStats.GOALS.projected).toBe(40));
  expect(result.current.customFallbackUsage?.total).toBeGreaterThan(0);
  const reads = supabaseClient.from.mock.calls.length;

  rerender({ ...inputs, allowCustomNameFallback: false, fantasyPointSettings: { GOALS: 2 } });
  await waitFor(() => expect(chosen()?.combinedStats.GOALS.projected).toBe(30));
  expect(chosen()?.fantasyPoints?.projected).toBe(60);
  expect(result.current.customFallbackUsage?.total).toBe(0);
  expect(supabaseClient.from).toHaveBeenCalledTimes(reads);
});

it("aligns a legacy row without mutating its caller's ID", async () => {
  captureProcessingPasses();
  const unresolved = { ...source(50).rows[0], player_id: null };
  const client = mockSupabase();
  const primary = source(30);
  const legacy = { ...source(50), id: "custom_csv_2", rows: [unresolved] };
  const controls = { ...sourceControls, custom_csv_2: { isSelected: true, weight: 1 } };
  const sources = [primary, legacy];
  const { result } = renderHook(() => useProcessedProjectionsData({
    ...cacheInputs, supabaseClient: client,
    allowCustomNameFallback: false,
    sourceControls: controls, customAdditionalSources: sources,
  }));
  await waitFor(() => expect(result.current.processedPlayers[0]?.combinedStats.GOALS.projected).toBe(40));
  expect(unresolved.player_id).toBeNull();
});

it.each(["resolves", "rejects"] as const)("ignores a stale read that %s after the current CSV result settles", async (oldOutcome) => {
  captureProcessingPasses();
  let finish!: (data: { data: []; error: null }) => void;
  let fail!: (error: Error) => void;
  const delayed = new Promise<{ data: []; error: null }>((resolve, reject) => {
    finish = resolve;
    fail = reject;
  });
  const supabaseClient = mockSupabase();
  const defaultFrom = supabaseClient.from.getMockImplementation();
  supabaseClient.from.mockImplementation((table: string) => {
    const query = defaultFrom(table);
    if (table === "yahoo_nhl_player_map_read") query.range.mockReturnValue(delayed);
    return query;
  });
  const initial = { ...cacheInputs, supabaseClient, customAdditionalSources: [source(30)] };
  const { result, rerender } = renderHook<UseProcessedProjectionsDataReturn, UseProcessedProjectionsDataProps>(useProcessedProjectionsData, { initialProps: initial });
  await waitFor(() => expect(supabaseClient.from).toHaveBeenCalledWith("yahoo_nhl_player_map_read"));

  const nextClient = mockSupabase();
  const next = { ...initial, supabaseClient: nextClient, customAdditionalSources: [source(31)] };
  rerender(next);
  await waitFor(() => expect(result.current.processedPlayers[0]?.combinedStats.GOALS.projected).toBe(31));
  const nextReads = nextClient.from.mock.calls.length;
  await act(async () => {
    if (oldOutcome === "resolves") finish({ data: [], error: null });
    else fail(new Error("stale DB error"));
  });
  expect(result.current.error).toBeNull();
  expect(result.current.processedPlayers[0].combinedStats.GOALS.projected).toBe(31);

  rerender({ ...next, allowCustomNameFallback: false });
  await waitFor(() => expect(result.current.isLoading).toBe(false));
  expect(nextClient.from).toHaveBeenCalledTimes(nextReads);
  expect(result.current.processedPlayers[0].combinedStats.GOALS.projected).toBe(31);
});
