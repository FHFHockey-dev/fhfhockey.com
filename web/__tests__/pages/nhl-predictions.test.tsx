import React from "react";
import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import type { PublicGamePredictionsPayload } from "lib/game-predictions/publicPredictions";
import NhlPredictionsPage from "../../pages/nhl-predictions";

const populatedPayload: PublicGamePredictionsPayload = {
  generatedAt: "2026-04-27T12:00:00.000Z",
  count: 1,
  predictions: [
    {
      gameId: 1,
      snapshotDate: "2026-04-28",
      startTime: "19:00:00",
      homeTeam: { id: 10, abbreviation: "BOS", name: "Boston Bruins" },
      awayTeam: { id: 20, abbreviation: "MTL", name: "Montreal Canadiens" },
      homeWinProbability: 0.61,
      awayWinProbability: 0.39,
      predictedWinnerTeamId: 10,
      confidenceLabel: "medium",
      computedAt: "2026-04-27T10:00:00.000Z",
      modelName: "nhl_game_baseline_logistic",
      modelVersion: "v1",
      featureSetVersion: "game_features_v1",
      freshness: {
        hasStaleSource: false,
        warnings: [],
        staleSources: [],
      },
      market: null,
      factors: [
        {
          featureKey: "homeMinusAwayOffRating",
          label: "Offense rating edge",
          value: 0.4,
          contribution: 0.12,
          direction: "home",
        },
      ],
      matchup: {
        homeOffRating: 0.7,
        awayOffRating: 0.2,
        homeDefRating: 0.3,
        awayDefRating: 0.4,
        homeGoalieRating: 0.1,
        awayGoalieRating: 0.5,
        homeSpecialRating: 0.2,
        awaySpecialRating: 0.1,
        homeRestDays: 2,
        awayRestDays: 1,
        homeGoalieGsaaPer60: 0.14,
        awayGoalieGsaaPer60: -0.04,
        homeGoalieConfirmed: true,
        awayGoalieConfirmed: false,
        homeGoalieSource: "lines_ccc",
        awayGoalieSource: "recent_usage",
        homeGoalieName: "Home Starter",
        awayGoalieName: null,
        homeGoalieId: 35,
        awayGoalieId: 40,
        optionalPlayerImpactAvailable: false,
      },
    },
  ],
  performance: {
    modelName: "nhl_game_baseline_logistic",
    modelVersion: "v1",
    featureSetVersion: "game_features_v1",
    evaluatedGames: 100,
    evaluationStartDate: "2025-10-01",
    evaluationEndDate: "2026-04-20",
    accuracy: 0.58,
    logLoss: 0.67,
    brierScore: 0.23,
    calibrationSummary: "1 populated calibration bins",
    computedAt: "2026-04-27T09:00:00.000Z",
  },
};

describe("NhlPredictionsPage", () => {
  beforeEach(() => {
    vi.stubGlobal(
      "fetch",
      vi.fn((input: RequestInfo | URL) => {
        const url = String(input);
        if (url.includes("/api/v1/game-predictions/espn-odds")) {
          return Promise.resolve({
            ok: true,
            json: () =>
              Promise.resolve({
                success: true,
                generatedAt: "2026-04-27T12:00:00.000Z",
                count: 1,
                odds: [
                  {
                    gameId: "espn-1",
                    requestedDate: "2026-04-28",
                    localDate: "2026-04-28",
                    name: "Montreal Canadiens at Boston Bruins",
                    date: "2026-04-28T23:00Z",
                    status: "Scheduled",
                    homeTeam: "BOS",
                    awayTeam: "MTL",
                    provider: "DraftKings",
                    moneyline: { home: "-130", away: "+110" },
                    spread: {
                      home: { line: "-1.5", odds: "+180" },
                      away: { line: "+1.5", odds: "-220" },
                    },
                    total: {
                      over: { line: "o5.5", odds: "-105" },
                      under: { line: "u5.5", odds: "-115" },
                    },
                  },
                ],
              }),
          });
        }

        return Promise.resolve({
          ok: true,
          json: () =>
            Promise.resolve({
              success: true,
              generatedAt: "2026-04-27T12:00:00.000Z",
              modelName: "nhl_game_baseline_logistic",
              modelVersion: "v1",
              featureSetVersion: "game_features_v1",
              summary: {
                evaluatedGames: 0,
                correctGames: 0,
                wrongGames: 0,
                accuracy: null,
                rolling10Accuracy: null,
                rolling25Accuracy: null,
                rolling50Accuracy: null,
                brierScore: null,
                logLoss: null,
              },
              daily: [],
              candles: [],
            }),
        });
      }),
    );
  });

  afterEach(() => {
    cleanup();
    vi.restoreAllMocks();
  });

  it("renders probability cards, stored factors, performance metrics, and market status", () => {
    render(<NhlPredictionsPage initialPayload={populatedPayload} />);

    expect(
      screen.getByRole("heading", { name: "NHL Game Predictions" }),
    ).toBeTruthy();
    expect(screen.getByText("MTL at BOS")).toBeTruthy();
    expect(screen.getByText("Model winner: BOS")).toBeTruthy();
    expect(screen.getByText("Offense rating edge")).toBeTruthy();
    expect(screen.getByText(/Confirmed via CCC: Home Starter/)).toBeTruthy();
    expect(screen.getByText(/Inferred from recent usage: #40/)).toBeTruthy();
    expect(screen.getByText("Evaluated games")).toBeTruthy();
    expect(screen.getByText("Accountability Index")).toBeTruthy();
    expect(screen.getByText("100")).toBeTruthy();
    expect(screen.getByText("Stored market snapshot unavailable")).toBeTruthy();
  });

  it("renders persisted market snapshots from the public payload", () => {
    render(
      <NhlPredictionsPage
        initialPayload={{
          ...populatedPayload,
          predictions: [
            {
              ...populatedPayload.predictions[0],
              market: {
                source: "feature_snapshot",
                sourceName: "historical_market_odds_import",
                provider: "BetMGM",
                capturedAt: "2026-04-27T14:00:00.000Z",
                sourceUrl: "https://site.api.espn.com/apis/site/v2/sports/hockey/nhl/scoreboard",
                homeMoneyline: -145,
                awayMoneyline: 125,
                homeNoVigProbability: 0.573529,
                awayNoVigProbability: 0.426471,
                overround: 0.036281,
                homeSpreadLine: -1.5,
                homeSpreadOdds: 170,
                awaySpreadLine: 1.5,
                awaySpreadOdds: -205,
                totalLine: 5.5,
                overOdds: -110,
                underOdds: -110,
              },
            },
          ],
        }}
      />,
    );

    expect(screen.getByText("Snapshot / BetMGM")).toBeTruthy();
    expect(screen.getByText("-145")).toBeTruthy();
    expect(screen.getByText("+125")).toBeTruthy();
    expect(screen.queryByText("ESPN / DraftKings")).toBeNull();
  });

  it("renders stale-data warnings from the API payload", () => {
    render(
      <NhlPredictionsPage
        initialPayload={{
          ...populatedPayload,
          predictions: [
            {
              ...populatedPayload.predictions[0],
              freshness: {
                ...populatedPayload.predictions[0].freshness,
                hasStaleSource: true,
              },
            },
          ],
        }}
      />,
    );

    expect(screen.getByText("Stale source flagged")).toBeTruthy();
  });

  it("renders a loading state while fetching predictions", () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(() => new Promise(() => {})),
    );
    render(<NhlPredictionsPage />);

    expect(screen.getByText("Loading predictions...")).toBeTruthy();
  });

  it("renders an empty prediction state", () => {
    render(
      <NhlPredictionsPage
        initialPayload={{
          generatedAt: "2026-04-27T12:00:00.000Z",
          count: 0,
          predictions: [],
          performance: null,
        }}
      />,
    );

    expect(
      screen.getByText("No model-ready game predictions are available yet."),
    ).toBeTruthy();
    expect(
      screen.getByText(
        "Completed-game evaluation metrics are not available yet.",
      ),
    ).toBeTruthy();
  });
});
