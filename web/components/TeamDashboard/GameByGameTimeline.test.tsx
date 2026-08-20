import {
  cleanup,
  fireEvent,
  render,
  screen,
  waitFor,
} from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const { fromMock } = vi.hoisted(() => ({
  fromMock: vi.fn(),
}));

vi.mock("lib/supabase", () => ({
  default: { from: fromMock },
}));

import { GameByGameTimeline } from "./GameByGameTimeline";

function queryResult(data: unknown) {
  const query: any = {};
  query.select = vi.fn(() => query);
  query.eq = vi.fn(() => query);
  query.order = vi.fn(() => query);
  query.limit = vi.fn(() => query);
  query.in = vi.fn(() => query);
  query.then = (resolve: (value: unknown) => unknown, reject: unknown) =>
    Promise.resolve({ data, error: null }).then(
      resolve,
      reject as (reason: unknown) => unknown,
    );
  return query;
}

beforeEach(() => {
  vi.spyOn(console, "log").mockImplementation(() => undefined);
  vi.spyOn(console, "error").mockImplementation(() => undefined);

  fromMock.mockImplementation((table: string) => {
    switch (table) {
      case "wgo_team_stats":
        return queryResult([
          {
            date: "2026-01-02",
            game_id: 77,
            goals_for: 4,
            goals_against: 2,
            wins: 1,
            losses: 0,
            ot_losses: 0,
            shots_for_per_game: 31,
            shots_against_per_game: 26,
            power_play_pct: 0.25,
            penalty_kill_pct: 0.82,
            faceoff_win_pct: 0.51,
            games_played: 1,
          },
        ]);
      case "games":
        return queryResult([
          {
            id: 77,
            homeTeamId: 22,
            awayTeamId: 7,
            date: "2026-01-02",
          },
        ]);
      case "teams":
        return queryResult([{ id: 7, abbreviation: "CGY" }]);
      default:
        throw new Error(`Unexpected table: ${table}`);
    }
  });
});

afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
});

describe("GameByGameTimeline", () => {
  it("uses named native view and game-detail controls with exposed state", async () => {
    render(
      <GameByGameTimeline
        maxGames={10}
        seasonId="20252026"
        teamAbbrev="EDM"
        teamId="22"
      />,
    );

    const overview = await screen.findByRole("button", { name: "Overview" });
    const trends = screen.getByRole("button", { name: "Trends" });

    expect(overview.tagName).toBe("BUTTON");
    expect(overview.getAttribute("aria-pressed")).toBe("true");
    expect(trends.getAttribute("aria-pressed")).toBe("false");

    fireEvent.click(trends);
    expect(overview.getAttribute("aria-pressed")).toBe("false");
    expect(trends.getAttribute("aria-pressed")).toBe("true");

    const game = screen.getByRole("button", {
      name: /Show details for January 2, 2026, versus CGY, final score 4 to 2/,
    });
    expect(game.tagName).toBe("BUTTON");
    expect(game.getAttribute("aria-expanded")).toBe("false");

    fireEvent.click(game);
    expect(game.getAttribute("aria-expanded")).toBe("true");
    expect(
      screen.getByRole("region", { name: "Game details for CGY" }),
    ).toBeTruthy();

    fireEvent.click(
      screen.getByRole("button", { name: "Close game details" }),
    );
    await waitFor(() => {
      expect(game.getAttribute("aria-expanded")).toBe("false");
    });
    expect(
      screen.queryByRole("region", { name: "Game details for CGY" }),
    ).toBeNull();
  });
});
