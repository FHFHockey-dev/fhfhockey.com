import { act, cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const getSession = vi.hoisted(() => vi.fn());
const onAuthStateChange = vi.hoisted(() => vi.fn());
vi.mock("lib/supabase/client", () => ({ default: { auth: { getSession, onAuthStateChange } } }));
vi.mock("hooks/useDraftProAccess", () => ({ useDraftProAccess: () => ({ access: { capabilities: ["saved_drafts"] } }) }));

import SavedDraftsWorkspace from "./SavedDraftsWorkspace";
import { serializeSavedDraft, type BrowserDraftSnapshot } from "lib/draft-pro/savedDrafts";

const browser = (goaliePoints = 1) => ({
  v: 2 as const,
  draftSettings: { teamCount: 2, rosterConfig: { C: 1, bench: 0, utility: 0 }, scoringCategories: { G: 1 }, draftOrder: ["Team 1", "Team 2"], isKeeper: true },
  draftedPlayers: [],
  keepers: [{ version: 2 as const, status: "valid" as const, cost: "pick" as const, playerId: "1", teamId: "Team 1", round: 1, pickInRound: 1, pickNumber: 1 }],
  pickOwnerOverrides: {},
  pickTrades: [{ version: 1 as const, status: "valid" as const, round: 1, pickInRound: 2, pickNumber: 2, originalTeamId: "Team 2", currentTeamId: "Team 1" }],
  positionOverrides: {}, customTeamNames: {}, currentPick: 2, isSnakeDraft: true, myTeamId: "Team 1", baselineMode: "remaining" as const, needWeightEnabled: true, needAlpha: .5, forwardGrouping: "split" as const, personalizeReplacement: true,
  goaliePointValues: { SAVES_GOALIE: goaliePoints }, sourceControls: { ag_skaters: { isSelected: true, weight: 1 } }, goalieSourceControls: { cullen_goalies: { isSelected: true, weight: 1 } }, customCsvList: [], favorites: [], notes: [], tiers: {}, configured: true,
});

const summary = { id: "draft-1", name: "Saved draft", status: "active" as const, lockVersion: 1, updatedAt: "2026-01-01T00:00:00.000Z" };
const json = (data: unknown) => ({ ok: true, status: 200, headers: new Headers(), json: async () => ({ data }) });

describe("SavedDraftsWorkspace with the real Saved Drafts hook", () => {
  beforeEach(() => {
    vi.useFakeTimers();
    getSession.mockResolvedValue({ data: { session: { access_token: "token", user: { id: "user-1" } } } });
    onAuthStateChange.mockReturnValue({ data: { subscription: { unsubscribe: vi.fn() } } });
  });
  afterEach(() => { cleanup(); vi.useRealTimers(); vi.unstubAllGlobals(); vi.clearAllMocks(); });

  it("hydrates keeper/trade content, then debounces rapid edits into one latest autosave", async () => {
    const base: BrowserDraftSnapshot = browser(); const detail = { ...summary, snapshot: serializeSavedDraft(base), privateImports: [] };
    const saves: RequestInit[] = [];
    vi.stubGlobal("fetch", vi.fn((url: string, init?: RequestInit) => {
      if (url === "/api/v1/account/draft-pro/drafts" && !init?.method) return Promise.resolve(json([summary]));
      if (url === "/api/v1/account/draft-pro/drafts/draft-1" && init?.method === "PUT") { saves.push(init); return Promise.resolve(json(summary)); }
      if (url === "/api/v1/account/draft-pro/drafts/draft-1") return Promise.resolve(json(detail));
      throw new Error(`Unexpected ${url}`);
    }));
    let current: BrowserDraftSnapshot = base;
    const view = render(<SavedDraftsWorkspace getBrowserSnapshot={() => current} applyBrowserSnapshot={(next) => { current = next; return next; }} players={[]} annotations={{ selectedPlayerId: null, notes: [], tiers: {} }} onAnnotationsChange={vi.fn()} />);
    await act(async () => { await Promise.resolve(); });
    await act(async () => { fireEvent.click(screen.getByRole("button", { name: "Saved draft" })); await Promise.resolve(); });
    view.rerender(<SavedDraftsWorkspace getBrowserSnapshot={() => current} applyBrowserSnapshot={(next) => { current = next; return next; }} players={[]} annotations={{ selectedPlayerId: null, notes: [], tiers: {} }} onAnnotationsChange={vi.fn()} />);
    await act(async () => { await vi.advanceTimersByTimeAsync(2_500); });
    expect(saves).toHaveLength(0);
    expect(current.keepers).toHaveLength(1);
    expect(current.pickTrades).toHaveLength(1);

    current = browser(2);
    view.rerender(<SavedDraftsWorkspace getBrowserSnapshot={() => current} applyBrowserSnapshot={(next) => next} players={[]} annotations={{ selectedPlayerId: null, notes: [], tiers: {} }} onAnnotationsChange={vi.fn()} />);
    await act(async () => { await vi.advanceTimersByTimeAsync(1_999); });
    expect(saves).toHaveLength(0);
    current = browser(3);
    view.rerender(<SavedDraftsWorkspace getBrowserSnapshot={() => current} applyBrowserSnapshot={(next) => next} players={[]} annotations={{ selectedPlayerId: null, notes: [], tiers: {} }} onAnnotationsChange={vi.fn()} />);
    await act(async () => { await vi.advanceTimersByTimeAsync(2_000); });
    expect(saves).toHaveLength(1);
    expect(JSON.parse(String(saves[0].body)).snapshot.sourceWeights.goaliePointValues).toEqual({ SAVES_GOALIE: 3 });

    current = browser(4);
    view.rerender(<SavedDraftsWorkspace getBrowserSnapshot={() => current} applyBrowserSnapshot={(next) => next} players={[]} annotations={{ selectedPlayerId: null, notes: [], tiers: {} }} onAnnotationsChange={vi.fn()} />);
    await act(async () => { await vi.advanceTimersByTimeAsync(1_000); });
    current = browser(3);
    view.rerender(<SavedDraftsWorkspace getBrowserSnapshot={() => current} applyBrowserSnapshot={(next) => next} players={[]} annotations={{ selectedPlayerId: null, notes: [], tiers: {} }} onAnnotationsChange={vi.fn()} />);
    await act(async () => { await vi.advanceTimersByTimeAsync(2_000); });
    expect(saves).toHaveLength(1);
  });
});
