import { act, renderHook, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { clearClientFetchCache } from "lib/dashboard/clientFetchCache";
import { useDashboardData } from "./useDashboardData";

const jsonResponse = (value: unknown, status = 200) =>
  new Response(JSON.stringify(value), {
    status,
    headers: { "Content-Type": "application/json" },
  });

describe("useDashboardData", () => {
  let failTeamTrends = false;
  let teamVersion = 1;
  let releaseSchedule: () => void;
  let scheduleGate: Promise<void>;

  beforeEach(() => {
    clearClientFetchCache();
    failTeamTrends = false;
    teamVersion = 1;
    scheduleGate = new Promise((resolve) => {
      releaseSchedule = resolve;
    });
    vi.stubGlobal(
      "fetch",
      vi.fn(async (input: RequestInfo | URL) => {
        const url = new URL(String(input), "http://localhost");
        if (url.pathname === "/api/team-ratings") return jsonResponse([]);
        if (url.pathname === "/api/v1/trends/team-power") {
          if (failTeamTrends) return jsonResponse({}, 503);
          return jsonResponse({
            seasonId: 20252026,
            generatedAt: `fresh-${teamVersion}`,
            categories: {},
          });
        }
        if (url.pathname === "/api/v1/trends/team-ctpi") {
          return jsonResponse({
            seasonId: 20252026,
            generatedAt: "now",
            teams: [],
          });
        }
        if (url.pathname === "/api/v1/trends/team-sos") {
          return jsonResponse({
            seasonId: 20252026,
            generatedAt: "now",
            teams: [],
          });
        }
        if (url.pathname === "/api/v1/trends/skater-power") {
          return jsonResponse({
            seasonId: 20252026,
            generatedAt: "now",
            positionGroup: "forward",
            limit: 25,
            seriesGames: 40,
            windowSize: Number(url.searchParams.get("window")),
            categories: {},
            playerMetadata: {},
          });
        }
        if (url.pathname === "/api/v1/trends/goalie-power") {
          return jsonResponse({
            seasonId: 20252026,
            generatedAt: "now",
            requestedDate: "2026-04-08",
            dateUsed: "2026-04-08",
            fallbackApplied: false,
            serving: {},
            limit: 25,
            windowSize: 3,
            categories: {},
            playerMetadata: {},
          });
        }
        if (url.pathname === "/api/v1/forge/players") {
          return jsonResponse({
            durationMs: "1",
            runId: 1,
            asOfDate: "2026-04-08",
            requestedDate: "2026-04-08",
            fallbackApplied: false,
            serving: {},
            data: [],
          });
        }
        if (url.pathname === "/api/v1/forge/goalies") {
          return jsonResponse({
            durationMs: "1",
            runId: "1",
            asOfDate: "2026-04-08",
            horizonGames: 1,
            requestedDate: "2026-04-08",
            fallbackApplied: false,
            serving: {},
            data: [],
          });
        }
        if (url.pathname === "/api/v1/start-chart") {
          await scheduleGate;
          return jsonResponse({
            dateUsed: "2026-04-08",
            requestedDate: "2026-04-08",
            fallbackApplied: false,
            serving: {},
            projections: 0,
            players: [],
            ctpi: [],
            games: [],
          });
        }
        if (url.pathname === "/api/v1/sustainability/trends") {
          const direction = url.searchParams.get("direction");
          return jsonResponse({
            success: true,
            snapshot_date: "2026-04-08",
            window_code: "l10",
            pos: "F",
            direction,
            limit: 15,
            rows: [],
          });
        }
        return jsonResponse({}, 404);
      }),
    );
  });

  afterEach(() => {
    clearClientFetchCache();
    vi.unstubAllGlobals();
  });

  it("retains failed section data and retries only that section", async () => {
    const { result, rerender } = renderHook(
      ({ window }) =>
        useDashboardData({
          date: "2026-04-08",
          skaterPosition: "forward",
          skaterWindow: window,
        }),
      { initialProps: { window: 3 as 3 | 5 } },
    );

    await waitFor(() => {
      expect(result.current.data?.teamTrends.generatedAt).toBe("fresh-1");
      expect(result.current.loadingSections).toContain("schedule");
      expect(result.current.isLoading).toBe(true);
    });

    act(() => releaseSchedule());
    await waitFor(() => {
      expect(result.current.isLoading).toBe(false);
    });

    failTeamTrends = true;
    clearClientFetchCache();
    rerender({ window: 5 });

    await waitFor(() => {
      expect(result.current.sectionErrors.team).toBeTruthy();
      expect(result.current.data?.teamTrends.generatedAt).toBe("fresh-1");
      expect(result.current.data?.skaterTrends.windowSize).toBe(5);
      expect(result.current.isLoading).toBe(false);
    });

    failTeamTrends = false;
    teamVersion = 2;
    clearClientFetchCache();
    const fetchMock = vi.mocked(fetch);
    const callsBeforeRetry = fetchMock.mock.calls.length;
    act(() => result.current.retrySection("team"));

    await waitFor(() => {
      expect(result.current.sectionErrors.team).toBeUndefined();
      expect(result.current.data?.teamTrends.generatedAt).toBe("fresh-2");
    });
    expect(
      fetchMock.mock.calls.slice(callsBeforeRetry).map(([input]) =>
        new URL(String(input), "http://localhost").pathname
      )
    ).toEqual([
      "/api/team-ratings",
      "/api/v1/trends/team-power",
      "/api/v1/trends/team-ctpi",
      "/api/v1/trends/team-sos"
    ]);
  });
});
