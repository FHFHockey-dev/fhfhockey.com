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
      vi.fn(() =>
        Promise.resolve({
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
        }),
      ),
    );
  });

  afterEach(() => {
    cleanup();
    vi.restoreAllMocks();
  });

  it("renders probability cards, stored factors, and performance metrics", () => {
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
    expect(screen.queryByText(/bet|wager|sportsbook|odds/i)).toBeNull();
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
