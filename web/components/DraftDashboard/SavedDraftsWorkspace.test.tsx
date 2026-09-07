import { act, cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const access = vi.hoisted(() => ({ access: { capabilities: ["saved_drafts"] } }));
const saved = vi.hoisted(() => ({
  drafts: [{ id: "draft-1", name: "Saved draft", status: "active" as const, lockVersion: 1, updatedAt: "2026-01-01T00:00:00.000Z" }],
  status: "idle" as const, error: null as string | null, conflict: null as null | { current: unknown }, opened: null as any,
  refresh: vi.fn(), saveNow: vi.fn(), autosave: vi.fn(), cancelAutosave: vi.fn(), open: vi.fn(), openPreview: vi.fn(), adopt: vi.fn(), rename: vi.fn(), duplicate: vi.fn(), remove: vi.fn(), reloadConflict: vi.fn(), saveAsAnother: vi.fn(),
}));
vi.mock("hooks/useDraftProAccess", () => ({ useDraftProAccess: () => access }));
vi.mock("hooks/useSavedDrafts", () => ({ useSavedDrafts: () => saved }));

import SavedDraftsWorkspace from "./SavedDraftsWorkspace";
import { serializeSavedDraft, toNormalizedPrivateImports } from "lib/draft-pro/savedDrafts";

const browser = (goaliePoints = 1) => ({
  v: 2 as const, draftSettings: { teamCount: 2, rosterConfig: { C: 1, bench: 0, utility: 0 }, scoringCategories: { G: 1 }, draftOrder: ["Team 1", "Team 2"] }, draftedPlayers: [{ playerId: "1", teamId: "Team 1", pickNumber: 1, round: 1, pickInRound: 1 }], keepers: [], pickOwnerOverrides: {}, pickTrades: [], positionOverrides: { "1": "C" }, customTeamNames: { "Team 1": "Home" }, currentPick: 2, isSnakeDraft: true, myTeamId: "Team 1", baselineMode: "remaining" as const, needWeightEnabled: true, needAlpha: .5, forwardGrouping: "split" as const, personalizeReplacement: true, goaliePointValues: { SAVES_GOALIE: goaliePoints }, sourceControls: { custom_csv_1: { isSelected: true, weight: 1 } }, goalieSourceControls: { custom_csv_1: { isSelected: true, weight: 1 } }, customCsvList: [{ id: "custom_csv_1", label: "My CSV", headers: [{ original: "Player", standardized: "name", selected: true }], rows: [{ Player: "A" }], resolution: {} }], favorites: ["1"], notes: [{ id: "1", text: "watch" }], tiers: { "1": "one" }, configured: true,
});

function detail(snapshot = browser()) {
  const imports = toNormalizedPrivateImports(snapshot.customCsvList);
  return { id: "draft-1", name: "Saved draft", status: "active" as const, lockVersion: 1, updatedAt: "2026-01-01T00:00:00.000Z", snapshot: serializeSavedDraft(snapshot), privateImports: imports };
}

describe("SavedDraftsWorkspace", () => {
  beforeEach(() => {
    vi.useFakeTimers(); vi.stubGlobal("confirm", vi.fn(() => true)); window.confirm = vi.fn(() => true);
    Object.assign(saved, { status: "idle", error: null, conflict: null, opened: null });
    for (const value of [saved.refresh, saved.saveNow, saved.autosave, saved.openPreview, saved.adopt, saved.rename, saved.duplicate, saved.remove, saved.reloadConflict, saved.saveAsAnother]) value.mockReset();
    saved.openPreview.mockResolvedValue({ detail: detail(), generation: 1 }); saved.adopt.mockImplementation((preview: any, apply?: () => boolean) => (!apply || apply()) && (saved.opened = preview.detail, true)); saved.autosave.mockResolvedValue({ id: "draft-1" }); saved.saveNow.mockResolvedValue({ id: "draft-1" });
  });
  afterEach(() => { cleanup(); vi.useRealTimers(); vi.unstubAllGlobals(); });

  const renderWorkspace = (snapshot = browser(), apply = vi.fn((next) => next)) => render(<SavedDraftsWorkspace getBrowserSnapshot={() => snapshot} applyBrowserSnapshot={apply} players={[{ id: "1", name: "Player One" }]} annotations={{ selectedPlayerId: null, notes: [], tiers: {} }} onAnnotationsChange={vi.fn()} />);

  it("previews once and leaves local work untouched when replacement is declined", async () => {
    const apply = vi.fn((next) => next); window.confirm = vi.fn(() => false); renderWorkspace(browser(2), apply);
    await act(async () => { fireEvent.click(screen.getByRole("button", { name: "Saved draft" })); });
    expect(saved.openPreview).toHaveBeenCalledTimes(1); expect(saved.adopt).not.toHaveBeenCalled(); expect(apply).not.toHaveBeenCalled();
  });

  it("adopts the same preview only after a successful apply", async () => {
    const apply = vi.fn((next) => next); renderWorkspace(browser(2), apply);
    await act(async () => { fireEvent.click(screen.getByRole("button", { name: "Saved draft" })); });
    expect(saved.openPreview).toHaveBeenCalledTimes(1); expect(saved.adopt).toHaveBeenCalledTimes(1); expect(apply).toHaveBeenCalledTimes(1);
  });

  it("autosaves one genuine post-hydration edit without looping", async () => {
    const initial = browser(); const view = renderWorkspace(initial);
    await act(async () => { fireEvent.click(screen.getByRole("button", { name: "Saved draft" })); });
    view.rerender(<SavedDraftsWorkspace getBrowserSnapshot={() => initial} applyBrowserSnapshot={(next) => next} players={[]} annotations={{ selectedPlayerId: null, notes: [], tiers: {} }} onAnnotationsChange={vi.fn()} />);
    view.rerender(<SavedDraftsWorkspace getBrowserSnapshot={() => browser(2)} applyBrowserSnapshot={(next) => next} players={[]} annotations={{ selectedPlayerId: null, notes: [], tiers: {} }} onAnnotationsChange={vi.fn()} />);
    await act(async () => { vi.advanceTimersByTime(2_000); await Promise.resolve(); });
    expect(saved.autosave).toHaveBeenCalledTimes(1);
    view.rerender(<SavedDraftsWorkspace getBrowserSnapshot={() => browser(2)} applyBrowserSnapshot={(next) => next} players={[]} annotations={{ selectedPlayerId: null, notes: [], tiers: {} }} onAnnotationsChange={vi.fn()} />);
    await act(async () => { vi.advanceTimersByTime(4_000); await Promise.resolve(); });
    expect(saved.autosave).toHaveBeenCalledTimes(1);
  });

  it("stops automatic retries after a failed save and retries the latest local snapshot", async () => {
    const initial = browser(); const view = renderWorkspace(initial);
    await act(async () => { fireEvent.click(screen.getByRole("button", { name: "Saved draft" })); });
    saved.autosave.mockImplementationOnce(async () => { saved.error = "offline"; throw new Error("offline"); });
    view.rerender(<SavedDraftsWorkspace getBrowserSnapshot={() => initial} applyBrowserSnapshot={(next) => next} players={[]} annotations={{ selectedPlayerId: null, notes: [], tiers: {} }} onAnnotationsChange={vi.fn()} />);
    view.rerender(<SavedDraftsWorkspace getBrowserSnapshot={() => browser(2)} applyBrowserSnapshot={(next) => next} players={[]} annotations={{ selectedPlayerId: null, notes: [], tiers: {} }} onAnnotationsChange={vi.fn()} />);
    await act(async () => { await Promise.resolve(); });
    view.rerender(<SavedDraftsWorkspace getBrowserSnapshot={() => browser(2)} applyBrowserSnapshot={(next) => next} players={[]} annotations={{ selectedPlayerId: null, notes: [], tiers: {} }} onAnnotationsChange={vi.fn()} />);
    await act(async () => { vi.advanceTimersByTime(4_000); await Promise.resolve(); });
    expect(saved.autosave).toHaveBeenCalledTimes(1);
    view.rerender(<SavedDraftsWorkspace getBrowserSnapshot={() => browser(3)} applyBrowserSnapshot={(next) => next} players={[]} annotations={{ selectedPlayerId: null, notes: [], tiers: {} }} onAnnotationsChange={vi.fn()} />);
    await act(async () => { fireEvent.click(screen.getByRole("button", { name: "Retry" })); await Promise.resolve(); });
    expect(saved.saveNow).toHaveBeenCalledWith("draft-1", expect.objectContaining({ snapshot: expect.objectContaining({ sourceWeights: expect.objectContaining({ goaliePointValues: { SAVES_GOALIE: 3 } }) }) }));
  });

  it("requires an explicit save for changed private CSV rows", async () => {
    const initial = browser(); const changed = browser(); changed.customCsvList[0].rows = [{ Player: "Changed" }];
    const view = renderWorkspace(initial);
    await act(async () => { fireEvent.click(screen.getByRole("button", { name: "Saved draft" })); });
    view.rerender(<SavedDraftsWorkspace getBrowserSnapshot={() => initial} applyBrowserSnapshot={(next) => next} players={[]} annotations={{ selectedPlayerId: null, notes: [], tiers: {} }} onAnnotationsChange={vi.fn()} />);
    view.rerender(<SavedDraftsWorkspace getBrowserSnapshot={() => changed} applyBrowserSnapshot={(next) => next} players={[]} annotations={{ selectedPlayerId: null, notes: [], tiers: {} }} onAnnotationsChange={vi.fn()} />);
    expect(screen.getByRole("button", { name: "Save changes to account" })).toBeTruthy();
    expect(saved.autosave).not.toHaveBeenCalled();
    await act(async () => { fireEvent.click(screen.getByRole("button", { name: "Save changes to account" })); await Promise.resolve(); });
    expect(saved.saveNow).toHaveBeenCalledWith("draft-1", expect.objectContaining({ accountSaveConsent: true, privateImports: [expect.objectContaining({ rows: [{ Player: "Changed" }] })] }));
  });

  it("shows a persistent CSV restoration error without attempting a save", () => {
    const incomplete = browser(); delete (incomplete.customCsvList[0] as { rows?: unknown }).rows;
    renderWorkspace(incomplete);
    expect(screen.getByRole("alert").textContent).toContain("Private import rows are missing for My CSV");
    expect(saved.autosave).not.toHaveBeenCalled();
    expect(saved.saveNow).not.toHaveBeenCalled();
  });

  it("autosaves a favorite-only edit while the workspace remains mounted", async () => {
    const initial = browser(); const favoriteChanged = browser(); favoriteChanged.favorites = [];
    const view = renderWorkspace(initial);
    await act(async () => { fireEvent.click(screen.getByRole("button", { name: "Saved draft" })); });
    view.rerender(<SavedDraftsWorkspace getBrowserSnapshot={() => initial} applyBrowserSnapshot={(next) => next} players={[]} annotations={{ selectedPlayerId: null, notes: [], tiers: {} }} onAnnotationsChange={vi.fn()} />);
    view.rerender(<SavedDraftsWorkspace getBrowserSnapshot={() => favoriteChanged} applyBrowserSnapshot={(next) => next} players={[]} annotations={{ selectedPlayerId: null, notes: [], tiers: {} }} onAnnotationsChange={vi.fn()} />);
    await act(async () => { await Promise.resolve(); });
    expect(saved.autosave).toHaveBeenCalledTimes(1);
  });
});
