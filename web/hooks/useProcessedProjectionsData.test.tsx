import { renderHook, waitFor } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import {
  useProcessedProjectionsData,
  type CustomAdditionalProjectionSource,
} from "./useProcessedProjectionsData";

const noop = () => {};
const styles = {};

function customSource(
  goals: number,
  resolutionUpdated = 1,
): CustomAdditionalProjectionSource {
  return {
    id: "custom_csv_1",
    displayName: "Custom",
    playerType: "skater",
    rows: [{ player_id: 8478427, Player_Name: "Test Player", Position: "C", Goals: goals }],
    primaryPlayerIdKey: "player_id",
    originalPlayerNameKey: "Player_Name",
    positionKey: "Position",
    statMappings: [{ key: "GOALS", dbColumnName: "Goals" }],
    resolution: {
      totalRows: 1,
      idMatched: 1,
      nameMatched: 0,
      unresolved: 0,
      coverage: 100,
      lastUpdated: resolutionUpdated,
      unresolvedNames: [],
    },
  };
}

function mockSupabase() {
  const from = vi.fn(() => {
    const query = {
      select: vi.fn(),
      eq: vi.fn(),
      in: vi.fn(),
      order: vi.fn(),
      range: vi.fn().mockResolvedValue({ data: [], error: null }),
    };
    Object.values(query).forEach((method) => {
      if (typeof method === "function") method.mockReturnValue(query);
    });
    query.range.mockResolvedValue({ data: [], error: null });
    return query;
  });
  return { from } as any;
}

describe("useProcessedProjectionsData custom sources", () => {
  it("retains settled custom results for UI-only updates and invalidates every data input", async () => {
    const supabaseClient = mockSupabase();
    const phaseLog = vi.spyOn(console, "log").mockImplementation(() => {});
    const props = {
      goals: 30,
      unrelated: 0,
      weight: 1,
      scoring: 1,
      season: "20252026",
      refreshKey: 0,
      allowNameFallback: true,
      showPerGameFantasyPoints: false,
      resolutionUpdated: 1,
      selected: true,
    };
    const { result, rerender } = renderHook(
      ({ goals, unrelated, weight, scoring, season, refreshKey, allowNameFallback, showPerGameFantasyPoints, resolutionUpdated, selected }) => {
        void unrelated;
        return useProcessedProjectionsData({
          activePlayerType: "skater",
          sourceControls: { custom_csv_1: { isSelected: selected, weight } },
          yahooDraftMode: "ALL",
          fantasyPointSettings: { GOALS: scoring },
          supabaseClient,
          currentSeasonId: season,
          styles,
          showPerGameFantasyPoints,
          togglePerGameFantasyPoints: noop,
          customAdditionalSources: [customSource(goals, resolutionUpdated)],
          refreshKey,
          allowCustomNameFallback: allowNameFallback,
        });
      },
      { initialProps: props },
    );

    await waitFor(() => expect(result.current.isLoading).toBe(false));
    await waitFor(() => expect(result.current.processedPlayers).toHaveLength(1));
    expect((result.current.processedPlayers[0] as any).combinedStats.GOALS.projected).toBe(30);
    const settledFetchCount = supabaseClient.from.mock.calls.length;
    const processingPasses = () =>
      phaseLog.mock.calls.filter(([message]) => message === "[ProjectionsPhase] start").length;
    const settledProcessingPasses = processingPasses();

    rerender({ ...props, unrelated: 1 });
    await waitFor(() => expect(result.current.isLoading).toBe(false));
    expect(supabaseClient.from).toHaveBeenCalledTimes(settledFetchCount);
    expect(processingPasses()).toBe(settledProcessingPasses);

    rerender({ ...props, unrelated: 2, showPerGameFantasyPoints: true });
    await waitFor(() => expect(result.current.isLoading).toBe(false));
    expect(processingPasses()).toBe(settledProcessingPasses);

    rerender({ ...props, scoring: 2 });
    await waitFor(() => expect((result.current.processedPlayers[0] as any).fantasyPoints.projected).toBe(60));
    expect(processingPasses()).toBe(settledProcessingPasses);

    rerender({ ...props, weight: 0.5 });
    await waitFor(() => expect(processingPasses()).toBeGreaterThan(settledProcessingPasses));
    const afterWeightProcessingPasses = processingPasses();

    rerender({ ...props, allowNameFallback: false });
    await waitFor(() => expect(processingPasses()).toBeGreaterThan(afterWeightProcessingPasses));
    const afterFallbackProcessingPasses = processingPasses();

    rerender({ ...props, season: "20262027" });
    await waitFor(() => expect(processingPasses()).toBeGreaterThan(afterFallbackProcessingPasses));
    const afterSeasonProcessingPasses = processingPasses();

    rerender({ ...props, refreshKey: 1 });
    await waitFor(() => expect(processingPasses()).toBeGreaterThan(afterSeasonProcessingPasses));
    const afterRefreshProcessingPasses = processingPasses();

    rerender({ ...props, resolutionUpdated: 2 });
    await waitFor(() => expect(result.current.customSourceResolutions?.custom_csv_1?.lastUpdated).toBe(2));
    await waitFor(() => expect(processingPasses()).toBeGreaterThan(afterRefreshProcessingPasses));
    const afterResolutionProcessingPasses = processingPasses();

    rerender({ ...props, goals: 31 });
    await waitFor(() => expect((result.current.processedPlayers[0] as any).combinedStats.GOALS.projected).toBe(31));
    expect(supabaseClient.from.mock.calls.length).toBeGreaterThan(settledFetchCount);
    expect(processingPasses()).toBeGreaterThan(afterResolutionProcessingPasses);

    rerender({ ...props, selected: false });
    await waitFor(() => expect(result.current.processedPlayers).toEqual([]));

    phaseLog.mockRestore();
  });
});
