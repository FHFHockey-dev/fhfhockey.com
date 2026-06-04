import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import XgUnderlyingStatsLabRoute from "../../../../pages/underlying-stats/xg";

vi.mock("next/head", () => ({
  default: ({ children }: { children: React.ReactNode }) => children,
}));

vi.mock("components/underlying-stats/UnderlyingStatsNavBar", () => ({
  default: () => <nav aria-label="Underlying stats navigation" />,
}));

function createXgPayload(scope: "players" | "teams" | "goalies") {
  return {
    success: true,
    generatedAt: "2026-05-30T12:00:00.000Z",
    scope,
    modelVersion: "shot-model-v1",
    reboundModelVersion: null,
    featureVersion: 1,
    windowGames: 10,
    seasonId: 20252026,
    counts: {
      rows: 1,
      sourceRows: 42,
      supplementalRows: 3,
    },
    coverage: {
      status: "ok",
      sourceRows: 42,
      supplementalRows: 3,
      ratios: {
        supplementalToSource: 0.071429,
        createdToSource: null,
        transitionToSource: null,
        reboundToSource: null,
      },
      warnings: [],
    },
    notes: ["test note"],
    rows:
      scope === "teams"
        ? [
            {
              id: 1,
              name: "Boston Bruins",
              abbreviation: "BOS",
              asOfGameDate: "2026-04-01",
              gamesCount: 10,
              xgFor: 30,
              xgAgainst: 20,
              xgPct: 0.6,
              goalsFor: 28,
              goalsAgainst: 18,
              controlledEntries: 40,
              controlledExits: 35,
              failedExitsAgainst: 12,
              transitionCreatedXg: 5,
              expectedReboundsFor: 7,
              expectedReboundsAgainst: 4,
            },
          ]
        : [
            {
              id: 10,
              name: "Shot Creator",
              teamId: 1,
              teamAbbreviation: "BOS",
              position: "C",
              asOfGameDate: "2026-04-01",
              gamesCount: 10,
              ixg: 4.25,
              goals: 5,
              shotAttempts: 41,
              createdXg: 3.5,
              shotAssistCreatedXg: 2.25,
              shotAssistEvents: 6,
              transitionCreatedXg: 1.25,
              transitionEvents: 3,
              transitionCreatedShots: 3,
              expectedPrimaryAssists: 2.25,
              controlledEntries: 8,
              controlledExits: 7,
              entryAssists: 4,
              expectedReboundsCreated: 1.75,
              actualReboundsCreated: 2,
            },
          ],
  };
}

function getXgFetchUrls() {
  return vi.mocked(fetch).mock.calls.map(([input]) =>
    typeof input === "string"
      ? input
      : input instanceof URL
        ? input.toString()
        : input.url
  );
}

describe("XgUnderlyingStatsLabRoute", () => {
  beforeEach(() => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockImplementation(async (input: string | URL | Request) => {
        const url =
          typeof input === "string"
            ? input
            : input instanceof URL
              ? input.toString()
              : input.url;
        const params = new URL(url, "http://localhost").searchParams;
        const scope = params.get("scope") === "teams" ? "teams" : "players";

        return {
          ok: true,
          json: async () => createXgPayload(scope),
        };
      })
    );
  });

  afterEach(() => {
    cleanup();
    vi.unstubAllGlobals();
  });

  it("loads the read-only xG API with default player query params", async () => {
    render(<XgUnderlyingStatsLabRoute />);

    await waitFor(() => {
      expect(screen.getByText("Shot Creator")).toBeTruthy();
    });

    expect(getXgFetchUrls()[0]).toBe(
      "/api/v1/underlying-stats/xg?scope=players&windowGames=10&limit=50&seasonId=20252026"
    );
    expect(screen.getByText("xG Model Lab")).toBeTruthy();
    expect(screen.getByText("Source Rows")).toBeTruthy();
    expect(screen.getByText("42")).toBeTruthy();
  });

  it("switches scopes without leaving the read-only xG API family", async () => {
    render(<XgUnderlyingStatsLabRoute />);

    await waitFor(() => {
      expect(screen.getByText("Shot Creator")).toBeTruthy();
    });

    fireEvent.click(screen.getByRole("button", { name: "Teams" }));

    await waitFor(() => {
      expect(screen.getByText("BOS")).toBeTruthy();
    });

    const urls = getXgFetchUrls();
    expect(urls.at(-1)).toBe(
      "/api/v1/underlying-stats/xg?scope=teams&windowGames=10&limit=50&seasonId=20252026"
    );
    expect(urls.every((url) => url.startsWith("/api/v1/underlying-stats/xg?"))).toBe(true);
    expect(urls.some((url) => url.includes("/api/v1/db/"))).toBe(false);
  });
});
