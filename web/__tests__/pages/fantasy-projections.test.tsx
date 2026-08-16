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
    rosterConfidence: 0.9,
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
});
