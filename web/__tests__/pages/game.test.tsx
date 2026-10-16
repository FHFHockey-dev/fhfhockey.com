import React from "react";
import { act, cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const { router, fetchMock, boxscoreMock, landingMock } = vi.hoisted(() => ({
  router: { query: { gameId: "2026020001" } },
  fetchMock: vi.fn(),
  boxscoreMock: vi.fn(),
  landingMock: vi.fn(),
}));

vi.mock("next/router", () => ({ useRouter: () => router }));
vi.mock("lib/cors-fetch", () => ({ default: fetchMock }));
vi.mock("next/image", () => ({
  default: ({ alt }: { alt: string }) => <span role="img" aria-label={alt} />,
}));
vi.mock("components/PoissonDistributionChart", () => ({ default: () => null }));
vi.mock("components/GamePreview/GamePreview", () => ({
  default: ({ gameId, gameContext }: { gameId: string; gameContext: { homeTeam: { abbrev: string } } }) => (
    <div data-testid="game-preview">{gameId}: {gameContext.homeTeam.abbrev}</div>
  ),
}));

import GamePage from "pages/game/[gameId]";

function response(payload: unknown, ok = true) {
  return {
    ok,
    status: ok ? 200 : 503,
    json: vi.fn().mockResolvedValue(payload),
  } as unknown as Response;
}

function boxscore(homeName = "Rangers", homeAbbrev = "NYR") {
  return {
    id: Number(router.query.gameId),
    season: 20262027,
    gameDate: "2026-10-15",
    homeTeam: { abbrev: homeAbbrev, commonName: { default: homeName }, logo: "/home.svg", score: 2, sog: 20 },
    awayTeam: { abbrev: "BOS", commonName: { default: "Bruins" }, logo: "/away.svg", score: 1, sog: 18 },
  };
}

function deferredResponse() {
  let resolve!: (value: Response) => void;
  let reject!: (error: Error) => void;
  const promise = new Promise<Response>((resolvePromise, rejectPromise) => {
    resolve = resolvePromise;
    reject = rejectPromise;
  });
  return { promise, resolve, reject };
}

describe("game page request states", () => {
  beforeEach(() => {
    router.query.gameId = "2026020001";
    boxscoreMock.mockReset().mockResolvedValue(response(boxscore()));
    landingMock.mockReset().mockResolvedValue(response({ gameState: "FUT" }));
    fetchMock.mockReset().mockImplementation((url: string) => {
      if (url.endsWith("/boxscore")) return boxscoreMock(url);
      if (url.endsWith("/landing")) return landingMock(url);
      if (url.startsWith("https://api.nhle.com/stats/rest/en/team/")) {
        return Promise.resolve(response({ data: [{}] }));
      }
      throw new Error(`Unexpected fixture request: ${url}`);
    });
    vi.stubGlobal("fetch", vi.fn().mockRejectedValue(new Error("Real network requests are forbidden")));
    vi.spyOn(console, "error").mockImplementation(() => {});
  });

  afterEach(() => {
    cleanup();
    expect(globalThis.fetch).not.toHaveBeenCalled();
    vi.unstubAllGlobals();
    vi.restoreAllMocks();
  });

  it.each(["FUT", "PRE", "OFF", "OVER", "FINAL"])(
    "replaces settled loading with a retryable boxscore error for %s games",
    async (gameState) => {
      boxscoreMock.mockRejectedValue(new Error("Boxscore unavailable"));
      landingMock.mockResolvedValue(response({ gameState }));

      render(<GamePage />);

      expect(await screen.findByRole("alert")).toBeTruthy();
      expect(screen.queryByText("Loading game details...")).toBeNull();
      expect((screen.getByRole("button", { name: "Retry" }) as HTMLButtonElement).disabled).toBe(false);
      expect(boxscoreMock).toHaveBeenCalledTimes(1);
      expect(landingMock).toHaveBeenCalledTimes(1);
    },
  );

  it("preserves the available boxscore when the landing request fails", async () => {
    landingMock.mockRejectedValue(new Error("Landing unavailable"));

    render(<GamePage />);

    expect(await screen.findByRole("alert")).toBeTruthy();
    expect(screen.getByText("Rangers")).toBeTruthy();
    expect(screen.queryByText("Loading game details...")).toBeNull();
    expect(screen.getByRole("button", { name: "Retry" })).toBeTruthy();
  });

  it("ends loading and offers recovery when both requests fail", async () => {
    boxscoreMock.mockRejectedValue(new Error("Boxscore unavailable"));
    landingMock.mockRejectedValue(new Error("Landing unavailable"));

    render(<GamePage />);

    expect(await screen.findByRole("alert")).toBeTruthy();
    expect(screen.queryByText("Loading game details...")).toBeNull();
    expect(screen.getByRole("button", { name: "Retry" })).toBeTruthy();
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });

  it("does not claim to be retrying while the initial landing request is pending", async () => {
    const landing = deferredResponse();
    boxscoreMock.mockRejectedValue(new Error("Boxscore unavailable"));
    landingMock.mockReturnValue(landing.promise);

    render(<GamePage />);
    await screen.findByRole("alert");

    expect(screen.getByText("Loading game details...")).toBeTruthy();
    const retryButton = screen.getByRole("button", { name: "Retry" }) as HTMLButtonElement;
    expect(retryButton.disabled).toBe(true);
    fireEvent.click(retryButton);
    expect(boxscoreMock).toHaveBeenCalledTimes(1);
    expect(landingMock).toHaveBeenCalledTimes(1);

    await act(async () => landing.resolve(response({ gameState: "FUT" })));

    expect(screen.queryByText("Loading game details...")).toBeNull();
    expect((screen.getByRole("button", { name: "Retry" }) as HTMLButtonElement).disabled).toBe(false);
  });

  it.each([null, {}])("shows unavailable data instead of loading for an empty successful response: %j", async (payload) => {
    boxscoreMock.mockResolvedValue(response(payload));
    landingMock.mockResolvedValue(response(payload));

    render(<GamePage />);

    await waitFor(() => expect(screen.queryByText("Loading game details...")).toBeNull());
    expect(screen.getByText("Game details are not available.")).toBeTruthy();
    expect(screen.queryByRole("alert")).toBeNull();
    expect(screen.getByRole("button", { name: "Retry" })).toBeTruthy();
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });

  it("treats non-success HTTP responses as failures even if they contain game data", async () => {
    boxscoreMock.mockResolvedValue(response(boxscore(), false));
    landingMock.mockResolvedValue(response({ gameState: "FINAL" }, false));

    render(<GamePage />);

    expect(await screen.findByRole("alert")).toBeTruthy();
    expect(screen.queryByText("Rangers")).toBeNull();
    expect(screen.queryByText("Loading game details...")).toBeNull();
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });

  it("allows one pending retry and clears its failure after successful recovery", async () => {
    boxscoreMock.mockRejectedValueOnce(new Error("Boxscore unavailable"));

    render(<GamePage />);
    await screen.findByRole("alert");

    const retry = deferredResponse();
    boxscoreMock.mockReturnValueOnce(retry.promise);
    fireEvent.click(screen.getByRole("button", { name: "Retry" }));

    expect(screen.queryByRole("alert")).toBeNull();
    expect(screen.getByText("Loading game details...")).toBeTruthy();
    const retryButton = screen.getByRole("button", { name: "Retrying..." }) as HTMLButtonElement;
    expect(retryButton.disabled).toBe(true);
    fireEvent.click(retryButton);
    expect(boxscoreMock).toHaveBeenCalledTimes(2);
    expect(landingMock).toHaveBeenCalledTimes(2);

    await act(async () => retry.resolve(response(boxscore())));

    expect(screen.getByTestId("game-preview").textContent).toBe("2026020001: NYR");
    expect(screen.queryByText("Loading game details...")).toBeNull();
    expect(screen.queryByRole("alert")).toBeNull();
    expect(screen.queryByRole("button", { name: /retry/i })).toBeNull();
  });

  it("keeps the last valid boxscore through pending, failed, and empty retries", async () => {
    landingMock.mockRejectedValueOnce(new Error("Landing unavailable"));

    render(<GamePage />);
    await screen.findByRole("alert");
    expect(screen.getByText("Rangers")).toBeTruthy();

    const retry = deferredResponse();
    boxscoreMock.mockReturnValueOnce(retry.promise);
    landingMock.mockRejectedValueOnce(new Error("Landing still unavailable"));
    fireEvent.click(screen.getByRole("button", { name: "Retry" }));
    expect(screen.getByText("Rangers")).toBeTruthy();

    await act(async () => retry.reject(new Error("Boxscore unavailable")));
    expect(screen.getByText("Rangers")).toBeTruthy();
    expect(screen.queryByText("Loading game details...")).toBeNull();
    expect(screen.getByRole("alert")).toBeTruthy();

    boxscoreMock.mockResolvedValueOnce(response(null));
    fireEvent.click(screen.getByRole("button", { name: "Retry" }));
    await waitFor(() => expect(screen.queryByText("Loading game details...")).toBeNull());

    expect(screen.getByText("Rangers")).toBeTruthy();
    expect(screen.getByText("Some game details are not available. Showing available details.")).toBeTruthy();
    expect(screen.queryByRole("alert")).toBeNull();
    expect(screen.getByTestId("game-preview").textContent).toBe("2026020001: NYR");
    expect(screen.getByRole("button", { name: "Retry" })).toBeTruthy();
  });

  it.each(["failure", "empty"])("retains the last valid landing data after a retry returns %s", async (outcome) => {
    boxscoreMock.mockRejectedValueOnce(new Error("Boxscore unavailable"));
    render(<GamePage />);
    await screen.findByRole("alert");

    if (outcome === "failure") {
      landingMock.mockRejectedValueOnce(new Error("Landing unavailable"));
    } else {
      landingMock.mockResolvedValueOnce(response(null));
    }
    fireEvent.click(screen.getByRole("button", { name: "Retry" }));

    await waitFor(() => expect(screen.queryByText("Loading game details...")).toBeNull());
    expect(screen.getByTestId("game-preview").textContent).toBe("2026020001: NYR");
    expect(screen.getByRole("button", { name: "Retry" })).toBeTruthy();
    expect(screen.queryByRole("alert") !== null).toBe(outcome === "failure");
  });

  it("clears the prior game's data while a different game is pending", async () => {
    const { rerender } = render(<GamePage />);
    await screen.findByTestId("game-preview");

    const nextBoxscore = deferredResponse();
    const nextLanding = deferredResponse();
    boxscoreMock.mockReturnValueOnce(nextBoxscore.promise);
    landingMock.mockReturnValueOnce(nextLanding.promise);
    router.query.gameId = "2026020002";
    rerender(<GamePage />);

    expect(screen.queryByText("Rangers")).toBeNull();
    expect(screen.queryByTestId("game-preview")).toBeNull();
    expect(screen.getByText("Loading game details...")).toBeTruthy();

    await act(async () => {
      nextBoxscore.resolve(response(boxscore("Maple Leafs", "TOR")));
      nextLanding.resolve(response({ gameState: "FUT" }));
    });
    expect(screen.getByTestId("game-preview").textContent).toBe("2026020002: TOR");
  });

  it.each(["success", "failure"])("ignores a previous game's late %s after switching IDs", async (outcome) => {
    const oldBoxscore = deferredResponse();
    const oldLanding = deferredResponse();
    const previousBoxscore = boxscore("Old Rangers");
    boxscoreMock.mockReturnValueOnce(oldBoxscore.promise);
    landingMock.mockReturnValueOnce(oldLanding.promise);
    const { rerender } = render(<GamePage />);

    router.query.gameId = "2026020002";
    boxscoreMock.mockResolvedValueOnce(response(boxscore("Maple Leafs", "TOR")));
    rerender(<GamePage />);
    await screen.findByTestId("game-preview");
    const requestCount = fetchMock.mock.calls.length;

    await act(async () => {
      if (outcome === "success") {
        oldBoxscore.resolve(response(previousBoxscore));
        oldLanding.resolve(response({ gameState: "FINAL" }));
      } else {
        oldBoxscore.reject(new Error("Old boxscore failure"));
        oldLanding.reject(new Error("Old landing failure"));
      }
    });

    expect(screen.getByTestId("game-preview").textContent).toBe("2026020002: TOR");
    expect(screen.queryByText("Old Rangers")).toBeNull();
    expect(screen.queryByRole("alert")).toBeNull();
    expect(fetchMock).toHaveBeenCalledTimes(requestCount);
  });
});
