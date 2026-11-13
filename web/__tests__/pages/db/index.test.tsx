import React from "react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { cleanup, render, screen } from "@testing-library/react";

const mocks = vi.hoisted(() => ({ from: vi.fn() }));

vi.mock("next/head", () => ({ default: () => null }));
vi.mock("next/router", () => ({ useRouter: () => ({ query: {}, push: vi.fn(), replace: vi.fn(), isReady: true }) }));
vi.mock("contexts/AuthProviderContext", () => {
  const auth = { isLoading: false, isRoleLoading: false, user: { id: "u1", role: "admin" } };
  return { useAuth: () => auth, useUser: () => auth.user };
});
vi.mock("lib/supabase", () => ({
  default: { from: mocks.from, auth: { getSession: vi.fn() } },
  doPOST: vi.fn(),
  createClientWithToken: vi.fn()
}));
vi.mock("hooks/useCurrentSeason", () => ({ default: () => ({ seasonId: 20252026 }) }));
vi.mock("components/Admin/CronRouteRunner", () => ({ default: () => null }));
vi.mock("notistack", () => ({ useSnackbar: () => ({ enqueueSnackbar: vi.fn(), closeSnackbar: vi.fn() }) }));

import DbIndexPage from "pages/db";

// Rule 19 fixtures at 2026-04-03T03:30Z (contract nhl-game-state-v1), date descending.
const STARTED_GAMES = [
  // A 10 pm ET start dated Apr 2: started, still being played.
  { id: 2025021002, date: "2026-04-02", startTime: "2026-04-03T02:00:00.000Z", game_state: "LIVE",
    game_schedule_state: "OK", game_state_observed_at: "2026-04-03T03:20:00.000Z" },
  { id: 2025021001, date: "2026-04-01", startTime: "2026-04-01T23:00:00.000Z", game_state: "FINAL",
    game_schedule_state: "OK", game_state_observed_at: "2026-04-02T02:00:00.000Z" },
  // Postponed: never final.
  { id: 2025021003, date: "2026-04-01", startTime: "2026-04-01T23:00:00.000Z", game_state: "FUT",
    game_schedule_state: "PPD", game_state_observed_at: "2026-04-01T18:00:00.000Z" },
  // Unknown state: the labelled start + 8 h fallback decides.
  { id: 2025021004, date: "2026-03-31", startTime: "2026-03-31T23:00:00.000Z", game_state: null,
    game_schedule_state: null, game_state_observed_at: null }
];

afterEach(() => {
  cleanup();
  vi.useRealTimers();
});

describe("/db finished games (rule 19, contract nhl-game-state-v1)", () => {
  it("lists games the stored state calls final, not every started game", async () => {
    vi.useFakeTimers({ toFake: ["Date"] });
    vi.setSystemTime(new Date("2026-04-03T03:30:00.000Z"));
    mocks.from.mockImplementation((table: string) => {
      let head = false;
      const chain: any = {
        select: (_columns: string, options?: { head?: boolean }) => {
          head = options?.head === true;
          return chain;
        },
        eq: () => chain,
        lte: () => chain,
        order: () => chain,
        returns: () => chain,
        then: (resolve: (value: unknown) => unknown) =>
          resolve(head || table !== "games"
            ? { count: 0, data: null, error: null }
            : { data: STARTED_GAMES, error: null })
      };
      return chain;
    });

    render(<DbIndexPage />);

    expect(await screen.findByText(/Update stats for 2 games between 2026-04-01 ~ 2026-03-31/)).toBeTruthy();
  });
});
