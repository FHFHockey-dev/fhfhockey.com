import React from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { cleanup, render, screen } from "@testing-library/react";

vi.mock("recharts", () => ({
  ResponsiveContainer: ({ children }: { children: React.ReactNode }) => (
    <div>{children}</div>
  ),
  LineChart: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
  Line: () => <div />,
  XAxis: () => <div />,
  YAxis: () => <div />,
  Tooltip: () => <div />,
  Legend: () => <div />,
  CartesianGrid: () => <div />,
  Brush: () => <div />
}));

const routerReplace = vi.fn();
const testMocks = vi.hoisted(() => ({
  rollingMetricsSelect: vi.fn(),
  supportPayloadSelect: vi.fn(),
  rows: {
    rolling_player_game_metrics: [] as Array<Record<string, unknown>>,
    rolling_player_metric_support_payloads: [] as Array<Record<string, unknown>>
  }
}));

vi.mock("next/router", () => ({
  useRouter: () => ({
    isReady: true,
    query: {
      playerId: "88",
      date: "2026-03-14",
      origin: "forge-dashboard",
      returnTo: "/forge/dashboard?date=2026-03-14&team=NJD&position=f",
      baseline: "career",
      window: "last10",
      view: "l30",
      metricGroup: "finishing",
      metrics: "shooting_pct,pdo"
    },
    pathname: "/trends/player/[playerId]",
    replace: routerReplace
  })
}));

vi.mock("lib/supabase", () => {
  const playersQuery = {
    eq: vi.fn(() => ({
      maybeSingle: vi.fn(() =>
        Promise.resolve({
          data: { fullName: "Top Add" },
          error: null
        })
      )
    }))
  };

  function playerRowsQuery(table: keyof typeof testMocks.rows) {
    const query = {
      eq: vi.fn(() => query),
      order: vi.fn(() => query),
      range: vi.fn((from: number, to: number) =>
        Promise.resolve({
          data: testMocks.rows[table].slice(from, to + 1),
          error: null
        })
      )
    };
    return query;
  }

  testMocks.rollingMetricsSelect.mockImplementation(() =>
    playerRowsQuery("rolling_player_game_metrics")
  );
  testMocks.supportPayloadSelect.mockImplementation(() =>
    playerRowsQuery("rolling_player_metric_support_payloads")
  );

  return {
    default: {
      from: vi.fn((table: string) => {
        if (table === "players") {
          return {
            select: vi.fn(() => playersQuery)
          };
        }

        if (table === "rolling_player_game_metrics") {
          return {
            select: testMocks.rollingMetricsSelect
          };
        }

        if (table === "rolling_player_metric_support_payloads") {
          return {
            select: testMocks.supportPayloadSelect
          };
        }

        throw new Error(`Unexpected table: ${table}`);
      })
    }
  };
});

const FULL_WIDE_ROWS = [
  {
    game_date: "2026-03-01",
    goals: 1,
    assists: 1,
    points: 2,
    shots: 4,
    shooting_pct: 8,
    pdo: 99,
    goals_avg_career: 0.5,
    assists_avg_career: 0.6,
    points_avg_career: 1.1,
    shots_avg_career: 3.0,
    goals_avg_last10: 0.7,
    assists_avg_last10: 0.8,
    points_avg_last10: 1.5,
    shots_avg_last10: 3.8,
    shooting_pct_career: 10,
    shooting_pct_last10: 9,
    pdo_career: 100,
    pdo_last10: 99
  },
  {
    game_date: "2026-03-14",
    goals: 2,
    assists: 1,
    points: 3,
    shots: 5,
    shooting_pct: 12,
    pdo: 102,
    goals_avg_career: 0.5,
    assists_avg_career: 0.6,
    points_avg_career: 1.1,
    shots_avg_career: 3.0,
    goals_avg_last10: 0.9,
    assists_avg_last10: 0.9,
    points_avg_last10: 1.8,
    shots_avg_last10: 4.1,
    shooting_pct_career: 10,
    shooting_pct_last10: 11,
    pdo_career: 100,
    pdo_last10: 101
  }
];

// Rolling writer storage since a8e1f5495d: `*_avg_*`, `*_last3`, `*_all`, `*_3ya`
// and `*_career` fields are nulled on the wide row and kept in the sidecar's
// historicalCompatibility payload.
function isWriterPrunedField(field: string) {
  return (
    field.endsWith("_all") ||
    field.includes("_last3") ||
    field.includes("_3ya") ||
    field.includes("_career") ||
    field.includes("_avg_")
  );
}

function splitLikeRollingWriter(rows: Array<Record<string, unknown>>) {
  return {
    wideRows: rows.map((row) =>
      Object.fromEntries(
        Object.entries(row).map(([field, value]) => [
          field,
          isWriterPrunedField(field) ? null : value
        ])
      )
    ),
    supportRows: rows.map((row) => ({
      game_date: row.game_date,
      historicalCompatibility: Object.fromEntries(
        Object.entries(row).filter(([field]) => isWriterPrunedField(field))
      )
    }))
  };
}

import PlayerTrendPage from "../../../../pages/trends/player/[playerId]";

describe("Trends player detail page", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    routerReplace.mockReset();
    testMocks.rollingMetricsSelect.mockClear();
    testMocks.supportPayloadSelect.mockClear();
    testMocks.rows.rolling_player_game_metrics = FULL_WIDE_ROWS;
    testMocks.rows.rolling_player_metric_support_payloads = [];
  });

  afterEach(() => {
    cleanup();
  });

  it("preserves FORGE dashboard return context when opened from player insight cards", async () => {
    render(<PlayerTrendPage />);

    expect(await screen.findByText("Top Add")).toBeTruthy();
    expect(screen.getByText("FORGE Dashboard Handoff")).toBeTruthy();
    expect(
      screen.getByText("Context date 2026-03-14 preserved for dashboard return.")
    ).toBeTruthy();
    expect(
      screen.getByRole("link", { name: "Back to FORGE Dashboard" }).getAttribute("href")
    ).toBe("/forge/dashboard?date=2026-03-14&team=NJD&position=f");
    expect(screen.getByText("Recent comparison toolkit")).toBeTruthy();
    expect(
      screen.getByText(
        /Strong v1 baselines: Season, 3-Year, Career, Cumulative/i
      )
    ).toBeTruthy();
    expect(screen.getByRole("button", { name: "L30" })).toBeTruthy();
    expect(
      screen
        .getByRole("button", { name: "Finishing" })
        .getAttribute("aria-pressed")
    ).toBe("true");
    expect(
      screen
        .getByRole("button", { name: "Shooting %" })
        .getAttribute("aria-pressed")
    ).toBe("true");
    expect(
      screen.getByRole("button", { name: "PDO" }).getAttribute("aria-pressed")
    ).toBe("true");
    expect(screen.queryByRole("button", { name: "Goals" })).toBeNull();
    expect(screen.getByText(/Baseline 10\.0%/)).toBeTruthy();
    expect(routerReplace).not.toHaveBeenCalled();

    const selectedFields = String(
      testMocks.rollingMetricsSelect.mock.calls[0]?.[0] ?? ""
    )
      .split(",")
      .map((field) => field.trim());
    expect(selectedFields).not.toContain("goals");
    expect(selectedFields).toContain("goals_avg_career");
  });

  it("restores writer-pruned career and average windows from the support sidecar", async () => {
    const { wideRows, supportRows } = splitLikeRollingWriter(FULL_WIDE_ROWS);
    expect(wideRows[1]).toMatchObject({
      shooting_pct_career: null,
      goals_avg_last10: null,
      shooting_pct_last10: 11
    });
    testMocks.rows.rolling_player_game_metrics = wideRows;
    testMocks.rows.rolling_player_metric_support_payloads = supportRows;

    render(<PlayerTrendPage />);

    expect(await screen.findByText("Top Add")).toBeTruthy();
    expect(await screen.findByText(/Baseline 10\.0%/)).toBeTruthy();
    expect(testMocks.supportPayloadSelect).toHaveBeenCalledWith(
      "game_date, historicalCompatibility:support_payload->historicalCompatibility"
    );
  });
});
