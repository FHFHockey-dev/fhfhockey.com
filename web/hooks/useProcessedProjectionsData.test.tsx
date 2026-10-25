import { cleanup, renderHook, waitFor } from "@testing-library/react";
import { afterEach, expect, it, vi } from "vitest";
import { PROJECTION_SOURCES_CONFIG } from "lib/projectionsConfig/projectionSourcesConfig";
import { useProcessedProjectionsData, type CustomAdditionalProjectionSource } from "./useProcessedProjectionsData";

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
