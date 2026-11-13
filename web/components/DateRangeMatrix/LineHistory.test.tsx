import { act, cleanup, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import LineHistory from "./LineHistory";
import type { LineHistoryItem, LineHistoryPage } from "lib/sources/lineHistory";

const request = vi.fn();
const scope = { teamId: 54, teamName: "Vegas Golden Knights", startDate: "2026-11-04", endDate: "2026-11-10" };
function item(overrides: Partial<LineHistoryItem> = {}): LineHistoryItem {
  return { id: "one", reportDate: "2026-11-07", gameId: 2026020278, gameDate: "2026-11-08", gameLink: "verified",
    originalPublishedAt: "2026-11-07T16:00:00Z", storedPublishedAt: "2026-11-07T16:00:00Z", receivedAt: null, interpretedAt: null,
    sourceUrl: "https://x.com/reporter/status/123", text: "Game lineup report", context: "game", version: "v1", recordType: "entry",
    units: [{ situation: "es_forward", number: 1, players: [{ playerId: 1, name: "Player One" }], complete: false }], ...overrides };
}
function response(items: LineHistoryItem[], nextCursor: string | null = null, enabled = true) {
  const body: LineHistoryPage = { enabled, items, nextCursor, coverage: "unknown", correctionHistory: "unverified", skippedRecords: 0, scannedRecords: items.length };
  return { ok: true, json: async () => body };
}
beforeEach(() => { request.mockReset(); vi.stubGlobal("fetch", request); });
afterEach(() => { cleanup(); vi.unstubAllGlobals(); });

describe("reported line history", () => {
  it("hides retained-interpretation diagnostics in production", async () => {
    vi.stubEnv("NODE_ENV", "production");
    vi.resetModules();
    try {
      const { default: ProductionHistory } = await import("./LineHistory");
      request.mockResolvedValueOnce({ ...response([item()]), json: async () => ({ ...(await response([item()]).json()), skippedRecords: 2 }) });
      render(<ProductionHistory {...scope} />);
      fireEvent.click(screen.getByRole("button", { name: "Load game-day lineups" }));
      await screen.findByText("Game lineup report");
      expect(screen.queryByText("Retained interpretation")).toBeNull();
      expect(screen.queryByText(/could not be shown/)).toBeNull();
    } finally {
      vi.unstubAllEnvs();
      vi.resetModules();
    }
  });

  it("loads only on request and keeps game dates separate from publication and uncertain links", async () => {
    request.mockResolvedValueOnce(response([item()])).mockResolvedValueOnce(response([item({ id: "legacy", gameLink: "unverified", gameDate: null,
      originalPublishedAt: null, sourceUrl: null, recordType: "legacy_report", text: "Legacy report" })]));
    render(<LineHistory {...scope} />);
    expect(request).not.toHaveBeenCalled();
    expect((screen.getByLabelText("Group reports by") as HTMLSelectElement).value).toBe("game");
    fireEvent.click(screen.getByRole("button", { name: "Load game-day lineups" }));
    const game = screen.getByRole("region", { name: "Game-day lineups" });
    expect((await within(game).findByText("2026-11-08")).parentElement?.textContent).toBe("Game date: 2026-11-08.");
    expect(within(game).getByText(/Nov 7, 2026/)).toBeTruthy();
    expect(within(game).getByRole("link", { name: "View original report" }).getAttribute("href")).toBe("https://x.com/reporter/status/123");
    expect(request.mock.calls[0][0]).toContain("mode=game");
    fireEvent.click(screen.getByRole("button", { name: "Load other reports" }));
    const publication = screen.getByRole("region", { name: "Other lineup reports" });
    await within(publication).findByText("Legacy report");
    expect(within(publication).getByText(/Not matched to a game/)).toBeTruthy();
    expect(within(publication).queryByText(/Game date:/)).toBeNull();
    expect(within(publication).getByText("Original link unavailable.")).toBeTruthy();
    expect(within(publication).getByRole("heading", { name: "Posting date unconfirmed" })).toBeTruthy();
    fireEvent.change(screen.getByLabelText("Group reports by"), { target: { value: "publication" } });
    expect(screen.queryByRole("region", { name: "Game-day lineups" })).toBeNull();
    expect(screen.getByText("Legacy report")).toBeTruthy();
    expect(request).toHaveBeenCalledTimes(2);
  });

  it("compares complete verified reports only with observed units from the same qualified game", async () => {
    const unit = { situation: "es_forward", number: 1, players: [1, 2, 3].map(playerId => ({ playerId, name: `Player ${playerId}` })), complete: true };
    request.mockResolvedValue(response([
      item({ id: "match", units: [unit] }),
      item({ id: "difference", units: [{ ...unit, players: [1, 2, 4].map(playerId => ({ playerId, name: `Player ${playerId}` })) }] }),
      item({ id: "missing", gameId: 2026020279, units: [unit] }),
      item({ id: "uncertain", gameLink: "unverified", gameDate: null, units: [unit] }),
    ]));
    render(<LineHistory {...scope} qualifiedGameIds={[2026020278]} observedUnits={[{
      teamId: 54, gameIds: [2026020278], strength: "fiveOnFive", kind: "forward_line", playerIds: [3, 1, 2], seconds: 125, skaterCount: 5,
    }]} />);
    fireEvent.click(screen.getByRole("button", { name: "Load game-day lineups" }));
    expect(await screen.findByText("Observed together for 2:05 at 5-on-5 in this game.")).toBeTruthy();
    expect(screen.getAllByText(/This exact unit didn’t play together/)).toHaveLength(1);
    expect(screen.getAllByText(/On-ice comparison isn’t available/)).toHaveLength(1);
  });

  it("keeps retained versions and retries a failed next page without hiding existing evidence", async () => {
    request.mockResolvedValueOnce(response([item()], "next-page"))
      .mockResolvedValueOnce({ ok: false })
      .mockResolvedValueOnce(response([item({ id: "two", text: "Corrected game lineup report", version: "v2", recordType: "entry_correction" })]));
    render(<LineHistory {...scope} />);
    const game = screen.getByRole("region", { name: "Game-day lineups" });
    fireEvent.click(within(game).getByRole("button"));
    await within(game).findByText("Game lineup report");
    fireEvent.click(within(game).getByRole("button", { name: "Load more reports" }));
    await within(game).findByRole("alert");
    expect(within(game).getByText("Game lineup report")).toBeTruthy();
    fireEvent.click(within(game).getByRole("button", { name: "Try again" }));
    await within(game).findByText("Corrected game lineup report");
    expect(within(game).getAllByRole("link", { name: "View original report" })).toHaveLength(2);
    expect(request.mock.calls[1][0]).toContain("cursor=next-page");
    expect(request.mock.calls[2][0]).toBe(request.mock.calls[1][0]);
  });

  it("drops late responses when the selected team/date scope changes", async () => {
    let finish!: (value: unknown) => void;
    request.mockImplementationOnce(() => new Promise(resolve => { finish = resolve; }));
    const { rerender } = render(<LineHistory key="old" {...scope} />);
    fireEvent.click(screen.getByRole("button", { name: "Load game-day lineups" }));
    rerender(<LineHistory key="new" {...scope} startDate="2026-11-09" />);
    expect(request.mock.calls[0][1].signal.aborted).toBe(true);
    await act(async () => { finish(response([item()])); });
    expect(screen.queryByText("Game lineup report")).toBeNull();
    expect((screen.getByRole("button", { name: "Load game-day lineups" }) as HTMLButtonElement).disabled).toBe(false);
  });

  it("distinguishes unavailable, disabled and empty history without implying complete coverage", async () => {
    request.mockResolvedValueOnce({ ok: false }).mockResolvedValueOnce(response([], null, false)).mockResolvedValueOnce(response([]));
    render(<LineHistory {...scope} />);
    const game = screen.getByRole("region", { name: "Game-day lineups" });
    fireEvent.click(within(game).getByRole("button"));
    await within(game).findByRole("alert");
    expect(within(game).queryByText(/No reports found/)).toBeNull();
    fireEvent.click(within(game).getByRole("button", { name: "Try again" }));
    await within(game).findByText("Reported lines aren’t available right now.");
    fireEvent.click(screen.getByRole("button", { name: "Load other reports" }));
    await waitFor(() => expect(screen.getByText("No reports found for this range so far.")).toBeTruthy());
  });

  it("can continue past a scanned page with no publication-date matches", async () => {
    request.mockResolvedValueOnce({ ok: true, json: async () => ({ enabled: true, items: [], nextCursor: "next-bucket", scannedRecords: 50, skippedRecords: 0 }) })
      .mockResolvedValueOnce(response([item({ id: "practice", gameLink: "unverified", gameDate: null, context: "practice", text: "Practice report" })]));
    render(<LineHistory {...scope} />);
    const additional = screen.getByRole("region", { name: "More lineup reports" });
    fireEvent.click(within(additional).getByRole("button", { name: "Browse more reports" }));
    await within(additional).findByText(/50 retained interpretations checked/);
    fireEvent.click(within(additional).getByRole("button", { name: "Load more reports" }));
    await within(additional).findByText("Practice report");
    expect(within(additional).getByText(/51 retained interpretations checked/)).toBeTruthy();
    expect(within(additional).queryByText(/Game date:/)).toBeNull();
    expect(request.mock.calls[0][0]).toContain("mode=claimPublication");
    expect(request.mock.calls[1][0]).toContain("cursor=next-bucket");
  });
});
