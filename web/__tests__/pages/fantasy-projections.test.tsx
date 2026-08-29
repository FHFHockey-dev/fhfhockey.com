import {
  cleanup,
  fireEvent,
  render,
  screen,
  waitFor,
} from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

import type {
  FantasyProjectionPlayer,
  FantasyProjectionRelease,
  FantasyProjectionTeam,
} from "lib/fantasy-projections/contracts";
import { FANTASY_PROJECTION_SCORING_V2_KEY } from "lib/fantasy-projections/scoringSettings";
import type { EspnLeagueSettingsV1 } from "lib/integrations/espn/contracts";
import { saveEspnScoringOverride } from "lib/integrations/espn/sessionOverride";

vi.mock("next/head", () => ({
  default: ({ children }: { children: React.ReactNode }) => <>{children}</>,
}));
vi.mock("contexts/AuthProviderContext", () => ({
  useAuth: () => ({ user: null, isLoading: false, signOut: vi.fn() }),
}));

import FantasyProjectionsPage from "../../pages/fantasy-projections";

const release: FantasyProjectionRelease = {
  id: "release-1",
  seasonId: 20262027,
  view: "current",
  releaseNumber: 1,
  label: "Test release",
  beta: true,
  issuedAt: "2026-08-14T12:00:00.000Z",
  cutoffAt: "2026-08-14T11:00:00.000Z",
  artifactChecksum: "artifact",
  contractVersion: "contract",
  contractChecksum: "checksum",
  rosterRevisionHash: "roster",
  scheduleRevisionHash: "schedule",
  sourceHighWatermark: "watermark",
  releaseHash: "release",
  active: true,
  metricSetVersion: "core-v3",
  rosterObservedAt: "2026-08-14T11:00:00.000Z",
  transactionCutoffAt: null,
  healthStatus: "healthy",
  healthSummary: {},
};

const espnSettings: EspnLeagueSettingsV1 = {
  version: 1,
  mappingVersion: "espn-fhl-v1",
  externalLeagueKey: "fhl:2026:123456",
  espnLeagueId: "123456",
  leagueName: "Session league",
  seasonKey: "2026",
  leagueType: "points",
  scoringType: "H2H_POINTS",
  teamCount: 2,
  teams: [],
  skaterScoringCategories: { GOALS: 5 },
  goalieScoringCategories: { WINS_GOALIE: 7 },
  categoryWeights: {},
  rosterConfig: { C: 1, G: 1 },
  draftOrderType: "snake",
  draftOrder: ["1", "2"],
  draftType: "SNAKE",
  liveDraftSupported: true,
  sourceHash: "a".repeat(64),
  fetchedAt: "2026-08-14T12:00:00.000Z",
  diagnostics: { status: "supported", warnings: [], unsupported: [] },
};

function player(
  id: string,
  playerName: string,
  population: FantasyProjectionPlayer["population"],
  publishedValues: Record<string, number>,
): FantasyProjectionPlayer {
  return {
    id,
    releaseId: release.id,
    fhfhPlayerId: Number(id.replace(/\D/g, "")),
    teamId: 1,
    teamAbbreviation: "TST",
    playerName,
    position: population === "goalie" ? "G" : "C",
    population,
    poolStatus: "verified_active",
    rosterStatus: "active_nhl",
    rosterConfidence: 0.9,
    sourceFreshAt: "2026-08-14T11:00:00.000Z",
    rookieProfile: {
      rookie: false,
      rosterProbability: null,
      sourceCoverage: [],
      nhleMethod: null,
    },
    expectedGames: 82,
    expectedStarts: population === "goalie" ? 50 : null,
    expectedToi: {},
    ratings: { offense: 80, goaltending: 80 },
    deployment: { confidence: 0.9, mostLikelyRole: { role: "Starter" } },
    modelValues: publishedValues,
    publishedValues,
    p10: publishedValues,
    p50: publishedValues,
    p90: publishedValues,
    adjustmentDelta: {},
    adjusted: false,
    fallbackFlags: [],
    provenance: {},
  };
}

function response(body: unknown) {
  return {
    ok: true,
    json: async () => body,
  } as Response;
}

describe("Fantasy Projections scoring modes", () => {
  afterEach(() => {
    cleanup();
    window.localStorage.clear();
    window.sessionStorage.clear();
    vi.unstubAllGlobals();
  });

  it("loads an exact session-only ESPN override when no browser preset exists", async () => {
    saveEspnScoringOverride(window.sessionStorage, "fantasy-projections", {
      version: 1,
      namespace: "espn:league-row-1",
      externalLeagueId: "league-row-1",
      externalTeamId: null,
      leagueName: "Session league",
      settings: espnSettings,
    });
    vi.stubGlobal(
      "fetch",
      vi.fn(async (input: RequestInfo | URL) => {
        const url = String(input);
        if (url.includes("/releases")) {
          return response({ success: true, releases: [release] });
        }
        if (url.includes("/players")) {
          return response({
            success: true,
            release,
            players: [player("player-1", "ESPN Skater", "forward", { GOALS: 2 })],
          });
        }
        if (url.includes("/teams")) {
          return response({ success: true, release, teams: [] });
        }
        throw new Error(`Unexpected request: ${url}`);
      }),
    );

    render(<FantasyProjectionsPage />);

    const row = await screen.findByRole("row", { name: /ESPN Skater/ });
    await waitFor(() => {
      expect(row.querySelectorAll("td")[2]?.textContent).toBe("10.0");
    });
  });

  it("uses role-specific point maps and switches to the category-score presentation", async () => {
    window.localStorage.setItem(
      FANTASY_PROJECTION_SCORING_V2_KEY,
      JSON.stringify({
        version: 2,
        leagueType: "points",
        skaterPoints: { GOALS: 2 },
        goaliePoints: { WINS_GOALIE: 10 },
        categoryWeights: { GOALS: 1, WINS_GOALIE: 1 },
      }),
    );
    const players = [
      player("player-1", "Skater One", "forward", { GOALS: 2 }),
      player("player-2", "Goalie One", "goalie", { WINS_GOALIE: 3 }),
    ];
    vi.stubGlobal(
      "fetch",
      vi.fn(async (input: RequestInfo | URL) => {
        const url = String(input);
        if (url.includes("/releases")) {
          return response({ success: true, releases: [release] });
        }
        if (url.includes("/players")) {
          return response({ success: true, release, players });
        }
        if (url.includes("/teams")) {
          return response({ success: true, release, teams: [] });
        }
        throw new Error(`Unexpected request: ${url}`);
      }),
    );

    render(<FantasyProjectionsPage />);

    await screen.findByText("Skater One");
    await waitFor(() => {
      const skaterRow = screen.getByRole("row", { name: /Skater One/ });
      const goalieRow = screen.getByRole("row", { name: /Goalie One/ });
      expect(skaterRow.querySelectorAll("td")[2]?.textContent).toBe("4.0");
      expect(goalieRow.querySelectorAll("td")[2]?.textContent).toBe("30.0");
    });
    expect(
      screen.getByRole("button", { name: "Fantasy total" }),
    ).toBeTruthy();

    fireEvent.click(screen.getByText("Customize fantasy scoring"));
    fireEvent.click(screen.getByRole("button", { name: "Categories" }));

    expect(screen.getByRole("button", { name: "Category score" })).toBeTruthy();
    expect(
      screen.getAllByTitle("FHFH projected category-value composite").length,
    ).toBe(2);
  });

  it("shows role-appropriate advanced columns in the combined player view", async () => {
    const advancedRelease = { ...release, metricSetVersion: "advanced-v5" };
    const players = [
      player("player-1", "Advanced Skater", "forward", {
        EXPECTED_GOALS: 37.9,
        EXPECTED_ASSISTS: 82,
        SHOT_ATTEMPTS: 560,
        ON_ICE_XGF_PERCENTAGE: 0.618,
      }),
      player("player-2", "Advanced Goalie", "goalie", {
        EXPECTED_GOALS_AGAINST_GOALIE: 163,
        GOALS_SAVED_ABOVE_EXPECTED: 24.5,
        HIGH_DANGER_SHOTS_AGAINST_GOALIE: 453,
        HIGH_DANGER_SAVE_PERCENTAGE_GOALIE: 0.843,
      }),
    ];
    vi.stubGlobal(
      "fetch",
      vi.fn(async (input: RequestInfo | URL) => {
        const url = String(input);
        if (url.includes("/releases")) {
          return response({ success: true, releases: [advancedRelease] });
        }
        if (url.includes("/players")) {
          return response({ success: true, release: advancedRelease, players });
        }
        if (url.includes("/teams")) {
          return response({ success: true, release: advancedRelease, teams: [] });
        }
        throw new Error(`Unexpected request: ${url}`);
      }),
    );

    render(<FantasyProjectionsPage />);
    await screen.findByText("Advanced Skater");
    fireEvent.change(screen.getByLabelText("Columns"), {
      target: { value: "advanced" },
    });

    expect(screen.getByRole("button", { name: "ixG / xGA" })).toBeTruthy();
    expect(screen.getByRole("button", { name: "ixA / GSAx" })).toBeTruthy();
    expect(screen.getByRole("button", { name: "iCF / HD SA" })).toBeTruthy();
    expect(screen.getByRole("button", { name: "xGF% / HD SV%" })).toBeTruthy();
    expect(screen.getByRole("row", { name: /Advanced Skater/ }).textContent).toContain("560");
    expect(screen.getByRole("row", { name: /Advanced Goalie/ }).textContent).toContain("453");
  });

  it("shows deployment, adjustment, history, fallback, and provenance details on demand", async () => {
    const summaryPlayer = player("player-1", "Detail Skater", "forward", {
      POINTS: 12,
    });
    const detailPlayer: FantasyProjectionPlayer = {
      ...summaryPlayer,
      expectedToi: {
        total: 1200,
        evenStrength: 900,
        powerPlay: 240,
        penaltyKill: 60,
      },
      deployment: {
        confidence: 0.8,
        mostLikelyRole: { role: "L1 · PP1" },
        roleProbabilities: { forwardLine: { F1: 0.7, F2: 0.3 } },
      },
      modelValues: { POINTS: 10 },
      publishedValues: { POINTS: 12 },
      p10: { POINTS: 8 },
      p50: { POINTS: 12 },
      p90: { POINTS: 16 },
      adjustmentDelta: { POINTS: 2 },
      adjusted: true,
      fallbackFlags: ["advanced_v5_expected_primary_assists_fallback"],
      provenance: {
        artifactVersion: "advanced-v5-empirical-bayes-v1",
        advancedV5: {
          edgeContext: {
            snapshotDate: "2026-04-16",
            sourceUrl: "https://www.nhl.com/edge",
            metrics: { top_shot_speed_mph: 99.5 },
          },
        },
      },
    };
    vi.stubGlobal(
      "fetch",
      vi.fn(async (input: RequestInfo | URL) => {
        const url = String(input);
        if (url.includes("/players/1?")) {
          return response({
            success: true,
            betaLabel: "beta",
            release: { ...release, metricSetVersion: "advanced-v5" },
            player: detailPlayer,
            releaseHistory: [
              {
                view: "opening",
                releaseNumber: 1,
                issuedAt: release.issuedAt,
                publishedValues: { POINTS: 11 },
                teamAbbreviation: "OLD",
              },
              {
                view: "current",
                releaseNumber: 2,
                issuedAt: "2026-08-15T12:00:00.000Z",
                publishedValues: { POINTS: 12 },
                teamAbbreviation: "TST",
              },
            ],
          });
        }
        if (url.includes("/releases")) {
          return response({ success: true, releases: [release] });
        }
        if (url.includes("/players")) {
          return response({ success: true, release, players: [summaryPlayer] });
        }
        if (url.includes("/teams")) {
          return response({ success: true, release, teams: [] });
        }
        throw new Error(`Unexpected request: ${url}`);
      }),
    );

    render(<FantasyProjectionsPage />);
    fireEvent.click(await screen.findByRole("button", { name: "Detail Skater" }));

    const detailDialog = await screen.findByRole("dialog", { name: "Player projection details" });
    expect(detailDialog).toBeTruthy();
    expect(detailDialog.textContent).toContain("20.0");
    expect(detailDialog.textContent).not.toContain("1200");
    expect(screen.getByText("Deployment and opportunity")).toBeTruthy();
    expect(screen.getByText(/F1 70% · F2 30%/)).toBeTruthy();
    expect(screen.getByText("Model and editorial comparison")).toBeTruthy();
    expect(screen.getByText(/Model 10\.0 → published 12\.0 \(\+2\.0\)/)).toBeTruthy();
    expect(screen.getByText(/opening #1/).textContent).toContain("OLD");
    expect(screen.getByText("Sources and model provenance")).toBeTruthy();
    expect(screen.getByText("NHL EDGE context")).toBeTruthy();
    expect(screen.getByText("Top shot speed mph")).toBeTruthy();
    expect(screen.getByText("99.5")).toBeTruthy();
    expect(screen.getByText(/not projected season totals/)).toBeTruthy();
    expect(screen.getByText("advanced_v5_expected_primary_assists_fallback")).toBeTruthy();
  });

  it("renders team advanced totals separately from unblocked totals", async () => {
    const team: FantasyProjectionTeam = {
      id: "team-release-1",
      releaseId: release.id,
      teamId: 1,
      teamName: "Test Club",
      abbreviation: "TST",
      modelRatings: {},
      publishedRatings: {
        overall: 60,
        offense: 61,
        defense: 59,
        goaltending: 58,
        powerPlay: 62,
        penaltyKill: 57,
        pace: 63,
      },
      deployment: {},
      rosterCounts: { forwards: 12, defense: 6, goalies: 2 },
      modelValues: {},
      publishedValues: {
        TEAM_SHOT_ATTEMPTS_FOR: 5701,
        TEAM_UNBLOCKED_ATTEMPTS_FOR: 4141,
        TEAM_EXPECTED_GOALS_FOR: 264,
      },
      p10: { TEAM_SHOT_ATTEMPTS_FOR: 5500 },
      p50: { TEAM_SHOT_ATTEMPTS_FOR: 5701 },
      p90: { TEAM_SHOT_ATTEMPTS_FOR: 5900 },
      adjustmentDelta: {},
      adjusted: false,
      confidence: 0.8,
      provenance: {},
    };
    vi.stubGlobal(
      "fetch",
      vi.fn(async (input: RequestInfo | URL) => {
        const url = String(input);
        if (url.includes("/releases")) return response({ success: true, releases: [release] });
        if (url.includes("/players")) return response({ success: true, release, players: [] });
        if (url.includes("/teams")) return response({ success: true, release, teams: [team] });
        throw new Error(`Unexpected request: ${url}`);
      }),
    );

    render(<FantasyProjectionsPage />);
    await screen.findByText("0 players");
    fireEvent.click(screen.getByRole("button", { name: "Team Ratings & Lines" }));

    expect(await screen.findByText("Advanced season forecast")).toBeTruthy();
    expect(screen.getByText("CF").nextElementSibling?.textContent).toBe("5701");
    expect(screen.getByText("FF").nextElementSibling?.textContent).toBe("4141");
  });
});
