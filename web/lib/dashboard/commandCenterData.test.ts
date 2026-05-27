import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { clearClientFetchCache } from "./clientFetchCache";
import { loadCommandCenterData } from "./commandCenterData";

function jsonResponse(data: unknown, ok = true, status = ok ? 200 : 500): Response {
  return {
    ok,
    status,
    json: async () => data
  } as Response;
}

const routeState = {
  date: "2026-03-14",
  resolvedDate: null,
  team: "CAR",
  position: "f" as const,
  slateMode: "main" as const,
  addMode: "tonight" as const
};

describe("commandCenterData", () => {
  beforeEach(() => {
    clearClientFetchCache();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("normalizes module payloads and aggregates fallback dates", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async (input: RequestInfo | URL) => {
        const url = String(input);
        if (url.startsWith("/api/team-ratings")) {
          return jsonResponse([
            {
              teamAbbr: "CAR",
              date: "2026-03-14",
              offRating: 82,
              defRating: 78,
              paceRating: 75,
              ppTier: 1,
              pkTier: 2,
              trend10: 2.1
            }
          ]);
        }
        if (url === "/api/v1/trends/team-ctpi") {
          return jsonResponse({
            generatedAt: "2026-03-14T12:00:00.000Z",
            teams: [{ team: "CAR", ctpi_0_to_100: 71, offense: 70, defense: 72, luck: 50 }]
          });
        }
        if (url.startsWith("/api/v1/start-chart")) {
          return jsonResponse({
            requestedDate: "2026-03-14",
            dateUsed: "2026-03-13",
            fallbackApplied: true,
            games: [
              {
                id: 1,
                date: "2026-03-13",
                homeTeamId: 12,
                awayTeamId: 1,
                homeGoalies: [],
                awayGoalies: []
              }
            ]
          });
        }
        if (url.startsWith("/api/v1/forge/players")) {
          return jsonResponse({
            requestedDate: "2026-03-14",
            asOfDate: "2026-03-14",
            fallbackApplied: false,
            data: []
          });
        }
        if (url.startsWith("/api/v1/forge/goalies")) {
          return jsonResponse({
            requestedDate: "2026-03-14",
            asOfDate: "2026-03-14",
            fallbackApplied: false,
            data: [
              {
                goalie_id: 1,
                goalie_name: "Starter One",
                starter_probability: 0.72
              }
            ]
          });
        }
        if (url.startsWith("/api/v1/transactions/ownership-trends")) {
          return jsonResponse({
            success: true,
            risers: [{ playerId: 1, name: "Top Add", latest: 44, delta: 6 }],
            fallers: []
          });
        }
        if (url.startsWith("/api/v1/transactions/ownership-snapshots")) {
          return jsonResponse({ success: true, rows: [] });
        }
        if (url.startsWith("/api/v1/sustainability/trends")) {
          return jsonResponse({
            snapshot_date: "2026-03-14",
            rows: [
              {
                player_id: 1,
                player_name: "Trend Skater",
                position_group: "F",
                window_code: "l10",
                s_100: 82,
                luck_pressure: 0.3
              }
            ]
          });
        }
        if (url.startsWith("/api/v1/trends/skater-power")) {
          return jsonResponse({
            requestedDate: "2026-03-14",
            dateUsed: "2026-03-14",
            categories: {
              all: {
                rankings: [
                  { playerId: 1, percentile: 88, gp: 10, rank: 1, delta: 4 }
                ],
                series: {}
              }
            },
            playerMetadata: {}
          });
        }
        if (url === "/api/v1/runs/latest") {
          return jsonResponse({ success: true, latestRun: { runId: "run-1" } });
        }
        return jsonResponse({}, false, 404);
      })
    );

    const data = await loadCommandCenterData(routeState);

    expect(data.modules.teamPower.status).toBe("ready");
    expect(data.modules.focusedSlate.status).toBe("stale");
    expect(data.modules.topAdds.status).toBe("ready");
    expect(data.modules.goalieContext.status).toBe("ready");
    expect(data.mixedState.hasMixedDates).toBe(true);
    expect(data.mixedState.fallbackModuleIds).toContain("focused_slate");
  });

  it("keeps partial module state when one dependency fails", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async (input: RequestInfo | URL) => {
        const url = String(input);
        if (url === "/api/v1/trends/team-ctpi") {
          return jsonResponse({}, false, 500);
        }
        if (url.startsWith("/api/team-ratings")) {
          return jsonResponse([]);
        }
        return jsonResponse({ success: true, rows: [], data: [], games: [] });
      })
    );

    const data = await loadCommandCenterData(routeState);

    expect(data.modules.teamPower.status).toBe("error");
    expect(data.modules.teamPower.error).toMatch(/Request failed/);
    expect(data.modules.playerInsight.status).toBe("empty");
  });
});
