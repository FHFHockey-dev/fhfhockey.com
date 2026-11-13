import React from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { cleanup, render, screen } from "@testing-library/react";
import { TEAM_TREND_CATEGORIES } from "lib/trends/teamMetricConfig";
import styles from "../../../pages/trends/index.module.scss";

vi.mock("next/router", () => ({
  useRouter: () => ({ push: vi.fn(), query: {} })
}));

vi.mock("next/image", () => ({
  default: ({ alt }: { alt: string }) => <img alt={alt} />
}));

vi.mock("recharts", () => {
  const Pass = ({ children }: { children?: React.ReactNode }) => <div>{children}</div>;
  const Nothing = () => null;
  return {
    ResponsiveContainer: Pass,
    LineChart: Pass,
    Line: Nothing,
    XAxis: Nothing,
    YAxis: Nothing,
    CartesianGrid: Nothing,
    Brush: Nothing,
    Tooltip: Nothing
  };
});

vi.mock("lib/supabase", () => ({ default: {} }));
vi.mock("components/TopMovers/TopMovers", () => ({ default: () => null }));

import TrendsIndexPage from "../../../pages/trends/placeholder";

const series = [
  { gp: 10, percentile: 60 },
  { gp: 15, percentile: 70 }
];
const teamPower = {
  seasonId: 20252026,
  generatedAt: "2026-11-13T09:00:00.000Z",
  categories: Object.fromEntries(
    TEAM_TREND_CATEGORIES.map((category) => [
      category.id,
      { series: { TOR: series }, rankings: [] }
    ])
  )
};
const teamCtpi = {
  teams: [
    {
      team: "TOR",
      offense: 2.1,
      defense: 0.1,
      goaltending: 0,
      specialTeams: 0,
      luck: -1.8,
      ctpi_raw: 0.4,
      ctpi_0_to_100: 64,
      z: {},
      sparkSeries: []
    }
  ]
};
// Opponents' points% of 0.62 / 0.55 would read as a "good" tone on the old
// rating thresholds (>= 0.5).
const teamSos = {
  dateUsed: "2026-11-13",
  teams: [
    {
      team: "TOR",
      past: { winPct: 0.5, pointsPct: 0.62, fixtures: 15, pendingFixtures: 0 },
      future: { winPct: 0.5, pointsPct: 0.55, fixtures: 67 }
    }
  ]
};

const toneClasses = [
  styles.tierElite,
  styles.tierGood,
  styles.tierCaution,
  styles.tierPoor
];

describe("Trends power ladder SOS pills", () => {
  beforeEach(() => {
    vi.spyOn(console, "error").mockImplementation(() => {});
    vi.stubGlobal(
      "fetch",
      vi.fn(async (url: string) => {
        const body = url.startsWith("/api/v1/trends/team-power")
          ? teamPower
          : url.startsWith("/api/v1/trends/team-ctpi")
            ? teamCtpi
            : url.startsWith("/api/v1/trends/team-sos")
              ? teamSos
              : null;
        return body
          ? { ok: true, status: 200, json: async () => body }
          : { ok: false, status: 404, statusText: "Not mocked", json: async () => ({}) };
      })
    );
  });

  afterEach(() => {
    cleanup();
    vi.unstubAllGlobals();
    vi.restoreAllMocks();
  });

  it("renders SOS values in the neutral pill with no good or bad tone; ratings keep theirs", async () => {
    render(<TrendsIndexPage />);

    const pastSos = await screen.findByText("62.0%");
    const futureSos = screen.getByText("55.0%");
    for (const pill of [pastSos, futureSos]) {
      expect(pill.classList.contains(styles.valuePill)).toBe(true);
      expect(pill.classList.contains(styles.tierNeutral)).toBe(true);
      toneClasses.forEach((tone) => expect(pill.classList.contains(tone)).toBe(false));
    }
    expect(pastSos.getAttribute("title")).toContain("as of Nov 13, 2026");
    expect(screen.getByText(/SOS = opp\. points %, as of Nov 13, 2026/)).toBeTruthy();

    // Other rating pills keep their tones.
    expect(screen.getByText("+2.10").classList.contains(styles.tierElite)).toBe(true);
    expect(screen.getByText("-1.80").classList.contains(styles.tierPoor)).toBe(true);
  });
});
