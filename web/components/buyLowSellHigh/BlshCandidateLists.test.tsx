import React from "react";
import { renderToString } from "react-dom/server";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen, waitFor, within } from "@testing-library/react";

import { buildDisplaySnapshot, type DisplayOpportunityComparison } from "lib/buyLowSellHigh/displayProfile";
import { BLSH_STORAGE_KEY, emptyBlshState } from "lib/buyLowSellHigh/storage";
import { syntheticProfile } from "lib/buyLowSellHigh/__fixtures__/syntheticProfiles";
import BlshCandidateLists, { BlshOpportunityDetails, candidateListView } from "./BlshCandidateLists";
import BuyLowSellHighPreview from "./BuyLowSellHighPreview";

const router = vi.hoisted(() => ({ query: {} as Record<string, string | string[] | undefined>, isReady: true,
  pathname: "/buy-low-sell-high/preview", replace: vi.fn().mockResolvedValue(true) }));
vi.mock("next/router", () => ({ useRouter: () => router }));

function fixture() {
  const forwards = Array.from({ length: 27 }, (_, index) => syntheticProfile(900001 + index));
  const sell = syntheticProfile(900101, "SH"), defender = syntheticProfile(900201);
  defender.position = "D";
  const thin = syntheticProfile(900301);
  thin.reference.personalN = 5;
  thin.production.personal_n = 5;
  thin.result.productionAxis.personal_n = 5;
  const unknown = syntheticProfile(900302);
  unknown.reference.personalN = 0;
  unknown.production.personal_n = 0;
  unknown.result.productionAxis.personal_n = 0;
  unknown.reference.sourceIds = [];
  unknown.reference.dates = [];
  unknown.reference.historyStatus = "unknown";
  return buildDisplaySnapshot({ profiles: [...forwards, sell, defender, thin, unknown],
    referencePolicy: { arm: "A_development_reference", inputs: "official_receipt_overlay", provisional: true,
      stale: true, selectedBy: "Synthetic fixture", selectedAtUTC: "2026-10-28T00:00:00Z", label: "Authored synthetic baseline; stale and unqualified" },
    assemblerVersion: "authored-synthetic", seasonId: 20262027, eventThroughDate: "2026-10-28",
    asOfUTC: "2026-10-29T00:00:00Z", packagedAtUTC: "2026-10-30T00:00:00Z",
    sourcePins: { currentRequest: "dcba14c2253d82bc70690d3c21112d926c1cdfc4f361024aa8a02f117e262465" } });
}

beforeEach(() => { localStorage.clear(); router.query = {}; router.replace.mockClear().mockResolvedValue(true); });
afterEach(() => { cleanup(); vi.restoreAllMocks(); });

describe("mapper-v3 candidate presentation", () => {
  it("renders separate top-25 F lists with the league gap first, preserving saved data", () => {
    const snapshot = fixture(), before = JSON.stringify(snapshot);
    render(<BlshCandidateLists snapshot={snapshot} />);
    const buy = screen.getByRole("table", { name: "Buy-low forwards candidates" });
    expect(within(buy).getAllByRole("row")).toHaveLength(26);
    expect(within(screen.getByRole("table", { name: "Sell-high forwards candidates" })).getAllByRole("row")).toHaveLength(2);
    expect(within(buy).getAllByRole("columnheader").map(node => node.textContent)).toEqual(["Player / rank", "FHFH Standard points", "Supporting tracks", "Evidence", "Details"]);
    expect(within(buy).getAllByText("Gap +2.00")).toHaveLength(25);
    expect(screen.getByText(/FHFH Standard scoring only/)).toBeTruthy();
    expect(JSON.stringify(snapshot)).toBe(before);
  });
  it("expands only the requested full list and preserves other URL parameters", () => {
    router.query = { source: "saved-link" };
    render(<BlshCandidateLists snapshot={fixture()} />);
    fireEvent.click(screen.getByRole("button", { name: "Show full buy-low list (27 forwards)" }));
    expect(within(screen.getByRole("table", { name: "Buy-low forwards candidates" })).getAllByRole("row")).toHaveLength(28);
    expect(screen.getByRole("button", { name: "Show top 25 buy-low" }).getAttribute("aria-expanded")).toBe("true");
    expect(router.replace).toHaveBeenLastCalledWith({ pathname: router.pathname, query: { source: "saved-link", pos: "F", full: "BL" } }, undefined, { shallow: true, scroll: false });
    fireEvent.click(screen.getByRole("button", { name: "Show top 25 buy-low" }));
    expect(within(screen.getByRole("table", { name: "Buy-low forwards candidates" })).getAllByRole("row")).toHaveLength(26);
  });
  it("loads a linked position and responds to subsequent router navigation", () => {
    const snapshot = fixture();
    router.query = { pos: "D", full: "BL" };
    const view = render(<BlshCandidateLists snapshot={snapshot} />);
    expect((screen.getByLabelText("Position group") as HTMLSelectElement).value).toBe("D");
    expect(within(screen.getByRole("table", { name: "Buy-low defensemen candidates" })).getAllByRole("row")).toHaveLength(2);
    expect(screen.getByText("No eligible candidates in this group. Nothing is forced into the list.")).toBeTruthy();
    router.query = { pos: "F", full: "BL" };
    view.rerender(<BlshCandidateLists snapshot={snapshot} />);
    expect(within(screen.getByRole("table", { name: "Buy-low forwards candidates" })).getAllByRole("row")).toHaveLength(28);
  });
  it("keeps unknown and thin history separately filterable without revealing buy/sell direction", () => {
    const snapshot = fixture();
    render(<BlshCandidateLists snapshot={snapshot} />);
    const table = screen.getByRole("table", { name: "Withheld candidate evidence" });
    expect(within(table).getAllByRole("row")).toHaveLength(3);
    fireEvent.change(screen.getByLabelText("Filter withheld reason"), { target: { value: "insufficient_personal_history_list_withheld" } });
    expect(within(table).getAllByRole("row")).toHaveLength(2);
    expect(table.textContent).toContain("Synthetic 900301");
    expect(table.textContent).not.toContain("Synthetic 900302");
    expect(table.textContent).not.toMatch(/Buy-low evidence|Sell-high evidence/);
    fireEvent.change(screen.getByLabelText("Filter withheld reason"), { target: { value: "personal_history_unavailable_list_withheld" } });
    expect(table.textContent).toContain("Synthetic 900302");
  });
  it("uses saved direction, conflict and age reasons when the primary reason is null", () => {
    const snapshot = fixture();
    for (const id of [900301, 900302]) {
      const profile = snapshot.profiles.find(value => value.playerId === id)!;
      profile.score.reason = null; profile.score.reasonText = null;
    }
    const noHistory = snapshot.profiles[0], conflict = snapshot.profiles[1], stale = snapshot.profiles[2];
    noHistory.score.list = null;
    noHistory.score.directionWithheldReason = "no_personal_history_list_withheld";
    noHistory.score.directionWithheldText = "Withheld from lists: no personal history";
    conflict.score.list = null; conflict.score.status = "conflicting_baseline_and_support";
    conflict.score.statusLabel = "Production and support disagree; withheld from lists";
    stale.score.list = null; stale.evidence.window.fresh = false;
    stale.evidence.window.lastGameDaysBeforeRecordedThrough = 10;
    stale.evidence.window.dates = ["2026-10-10", "2026-10-12", "2026-10-14", "2026-10-16", "2026-10-18"];
    stale.evidence.window.freshnessText = "Outside the saved seven-day window-age limit";
    render(<BlshCandidateLists snapshot={snapshot} />);
    const table = screen.getByRole("table", { name: "Withheld candidate evidence" });
    const choices = [
      ["insufficient_personal_history_list_withheld", "Synthetic 900301"],
      ["personal_history_unavailable_list_withheld", "Synthetic 900302"],
      ["no_personal_history_list_withheld", "Synthetic 900001"],
      ["status:conflicting_baseline_and_support", "Synthetic 900002"],
      ["saved_window_stale_list_withheld", "Synthetic 900003"],
    ];
    for (const [reason, name] of choices) {
      fireEvent.change(screen.getByLabelText("Filter withheld reason"), { target: { value: reason } });
      expect(within(table).getAllByRole("row")).toHaveLength(2);
      expect(table.textContent).toContain(name);
      expect(table.textContent).not.toMatch(/Balanced or other|Buy-low evidence|Sell-high evidence/);
    }
    expect(table.textContent).toContain("outside the saved age limit");
  });
  it("renders a missing supporting track as unavailable, not zero", () => {
    const snapshot = fixture();
    snapshot.profiles[0].tracks = snapshot.profiles[0].tracks.filter(track => track.track !== "wigo_game_score");
    render(<BlshCandidateLists snapshot={snapshot} />);
    const row = within(screen.getByRole("table", { name: "Buy-low forwards candidates" })).getAllByRole("row")[1];
    expect(row.textContent).toContain("Game Score: Unavailable");
    expect(row.textContent).toContain("Gap +2.00");
  });
  it("opens details with keyboard focus and restores focus on Escape", () => {
    render(<BlshCandidateLists snapshot={fixture()} />);
    const button = screen.getByRole("button", { name: "Details for Synthetic 900001" });
    fireEvent.click(button);
    const heading = within(screen.getByRole("region", { name: "Synthetic 900001" })).getByRole("heading", { name: "Synthetic 900001" });
    expect(document.activeElement).toBe(heading);
    expect(screen.getByRole("region", { name: "Opportunity for Synthetic 900001" }).textContent).toContain("Opportunity comparisons unavailable: none is attached");
    fireEvent.keyDown(heading, { key: "Escape" });
    expect(screen.queryByRole("region", { name: "Synthetic 900001" })).toBeNull();
    expect(document.activeElement).toBe(button);
  });
  it("routes v3 through the new view while keeping stale and unqualified warnings visible", () => {
    render(<BuyLowSellHighPreview snapshot={fixture()} />);
    expect(screen.getByRole("table", { name: "Buy-low forwards candidates" })).toBeTruthy();
    expect(screen.getByText(/The development reference is stale/)).toBeTruthy();
    expect(screen.getByText(/Stale saved capture.*more than 24 hours old/)).toBeTruthy();
    expect(screen.queryByText(/Saved research order; no score or list cutoff is added/)).toBeNull();
  });
  it("ignores malformed URL choices instead of treating them as scoring instructions", () => {
    expect(candidateListView({ pos: "G", full: ["BL"] })).toEqual({ position: "F", full: [] });
    expect(candidateListView({ pos: "D", full: "SH,BL,BL,other" })).toEqual({ position: "D", full: ["BL", "SH"] });
  });
  it("preserves the legacy v1 view without presenting v3 list rules", () => {
    const snapshot = fixture();
    Object.assign(snapshot, { mapperVersion: "blsh-display-profile-v1" });
    render(<BuyLowSellHighPreview snapshot={snapshot} />);
    expect(screen.getByRole("navigation", { name: "BLSH candidate lists" })).toBeTruthy();
    expect(screen.getByText(/Saved research order; no score or list cutoff is added/)).toBeTruthy();
    expect(screen.queryByLabelText("Position group")).toBeNull();
  });
});

describe("provisional opportunity presentation", () => {
  it("does not invent a role-change explanation for a both-balanced assessment", () => {
    const snapshot = fixture(), profile = snapshot.profiles[0];
    profile.opportunity = { ...profile.opportunity, status: "available", reason: null, reasonText: null,
      version: "blsh-opportunity-split-v1", headline: { direction: "balanced", qualified: false, conflict: false,
        reason: "both_balanced", opportunityEffect: 0, opportunityEffectSource: "split", opportunityShift: "stable",
        text: "Both comparisons are at baseline.", directionLabel: "Balanced", reasonText: "Both comparisons are at baseline" },
      listCheck: { state: "balanced", applied: false, text: "Provisional context: both comparisons are at baseline." } };
    render(<BlshCandidateLists snapshot={snapshot} />);
    expect(screen.getByText("Opportunity (provisional): Balanced")).toBeTruthy();
    expect(screen.queryByText(/Balanced: role change may explain/)).toBeNull();
    expect(screen.getByText("Provisional context: both comparisons are at baseline.")).toBeTruthy();
  });
  it("displays the BLSH sign without mutating the saved observed-minus-reference gap", () => {
    const profile = fixture().profiles[0];
    const comparison: DisplayOpportunityComparison = { kind: "per_game_baseline", label: "Synthetic", available: true,
      reason: null, reasonText: null, observed: 8, expected: 10, gap: -2, scale: 1, z: -2,
      direction: "buy_low_evidence", directionLabel: "Buy-low evidence" };
    const assessment = { direction: "buy_low_evidence" as const, qualified: false, conflict: false, reason: "comparisons_agree" as const,
      opportunityEffect: 0, opportunityEffectSource: "split" as const, opportunityShift: "stable" as const,
      text: "Both comparisons agree; persistence is unknown.", directionLabel: "Buy-low evidence", reasonText: "Both comparisons agree" };
    profile.opportunity = { ...profile.opportunity, status: "available", reason: null, reasonText: null, version: "blsh-opportunity-split-v1",
      tracks: [{ track: "fantasy_points", label: "FHFH Standard points", perGame: comparison,
        adjusted: { ...comparison, kind: "opportunity_adjusted" }, assessment }], headline: assessment };
    render(<BlshOpportunityDetails profile={profile} />);
    expect(screen.getAllByText(/Observed 8.00 · comparison 10.00 · gap \+2.00/)).toHaveLength(2);
    expect(screen.getByText(/does not change list membership or rank/)).toBeTruthy();
    expect(profile.opportunity.tracks[0].perGame.gap).toBe(-2);
  });
  it("shows the reason for an unavailable adjusted comparison instead of a fabricated zero", () => {
    const profile = fixture().profiles[0];
    render(<BlshOpportunityDetails profile={profile} />);
    expect(screen.queryByText(/gap 0.00/)).toBeNull();
    expect(screen.getByText(/Opportunity comparisons unavailable: none is attached/)).toBeTruthy();
  });
});

describe("device-local research watchlist", () => {
  it("does not write during server rendering or initial hydration", () => {
    const raw = JSON.stringify({ ...emptyBlshState(), watchlist: [{ kind: "research_identity", playerId: "900001", addedAt: "2026-11-07T12:00:00Z" }] });
    localStorage.setItem(BLSH_STORAGE_KEY, raw);
    const writes = vi.spyOn(Storage.prototype, "setItem");
    expect(renderToString(<BlshCandidateLists snapshot={fixture()} />)).toContain("Loading device-local BLSH data");
    render(<BlshCandidateLists snapshot={fixture()} />);
    expect(screen.getByRole("button", { name: /from saved watchlist/ })).toBeTruthy();
    expect(writes).not.toHaveBeenCalled();
    expect(localStorage.getItem(BLSH_STORAGE_KEY)).toBe(raw);
  });
  it("saves identities only, reloads, removes and clears while preserving draft selections", async () => {
    const snapshot = fixture(), name = snapshot.profiles[0].displayName;
    const state = { ...emptyBlshState(), draft: { give: ["missing-id"], receive: ["other-id"] } };
    localStorage.setItem(BLSH_STORAGE_KEY, JSON.stringify(state));
    const view = render(<BlshCandidateLists snapshot={snapshot} />);
    fireEvent.click(screen.getByRole("button", { name: `Watch ${name} locally` }));
    await waitFor(() => expect(screen.getByRole("button", { name: `Remove ${name} from saved watchlist` })).toBeTruthy());
    const saved = JSON.parse(localStorage.getItem(BLSH_STORAGE_KEY)!);
    expect(Object.keys(saved.watchlist[0]).sort()).toEqual(["addedAt", "kind", "playerId"]);
    expect(saved.draft).toEqual(state.draft);
    expect(screen.getByText(/not current recommendations/)).toBeTruthy();
    view.unmount();
    render(<BlshCandidateLists snapshot={snapshot} />);
    fireEvent.click(screen.getByRole("button", { name: `Remove ${name} from saved watchlist` }));
    await waitFor(() => expect(screen.getByText("No watched players yet.")).toBeTruthy());
    fireEvent.click(screen.getByRole("button", { name: `Watch ${name} locally` }));
    await waitFor(() => expect(screen.getByRole("button", { name: "Clear watchlist" }).hasAttribute("disabled")).toBe(false));
    fireEvent.click(screen.getByRole("button", { name: "Clear watchlist" }));
    await waitFor(() => expect(JSON.parse(localStorage.getItem(BLSH_STORAGE_KEY)!).watchlist).toEqual([]));
    expect(JSON.parse(localStorage.getItem(BLSH_STORAGE_KEY)!).draft).toEqual(state.draft);
  });
  it("keeps unavailable legacy IDs removable without showing old gap/horizon as research", async () => {
    localStorage.setItem(BLSH_STORAGE_KEY, JSON.stringify({ ...emptyBlshState(), watchlist: [
      { playerId: "missing-player", addedAt: "2026-10-01T12:00:00Z", target: "POINTS", horizon: 10, gapAtAdd: 9876 },
    ] }));
    render(<BlshCandidateLists snapshot={fixture()} />);
    const panel = screen.getByRole("region", { name: "Device-local watchlist" });
    expect(within(panel).getByText(/Unavailable in this snapshot/)).toBeTruthy();
    expect(panel.textContent).not.toContain("9876");
    expect(panel.textContent).toContain("comparison values are not displayed");
    fireEvent.click(within(panel).getByRole("button", { name: /Remove player missing-player/ }));
    await waitFor(() => expect(within(panel).getByText("No watched players yet.")).toBeTruthy());
  });
  it("reflects storage events and merges additions with latest saved entries", async () => {
    const snapshot = fixture(); render(<BlshCandidateLists snapshot={snapshot} />);
    localStorage.setItem(BLSH_STORAGE_KEY, JSON.stringify({ ...emptyBlshState(), watchlist: [
      { kind: "research_identity", playerId: "elsewhere", addedAt: "2026-11-07T12:00:00Z" },
    ] }));
    fireEvent(window, new StorageEvent("storage", { key: BLSH_STORAGE_KEY }));
    expect(screen.getByText(/Player elsewhere/)).toBeTruthy();
    fireEvent.click(screen.getByRole("button", { name: `Watch ${snapshot.profiles[0].displayName} locally` }));
    await waitFor(() => expect(JSON.parse(localStorage.getItem(BLSH_STORAGE_KEY)!).watchlist).toHaveLength(2));
  });
  it("preserves unreadable data and reports quota failure without a fake watched state", async () => {
    localStorage.setItem(BLSH_STORAGE_KEY, "{");
    const view = render(<BlshCandidateLists snapshot={fixture()} />);
    expect(screen.getByText(/unreadable or from a newer version/)).toBeTruthy();
    expect(screen.getAllByRole("button", { name: /^Watch .* locally$/ }).every(button => button.hasAttribute("disabled"))).toBe(true);
    expect(localStorage.getItem(BLSH_STORAGE_KEY)).toBe("{");
    view.unmount(); localStorage.removeItem(BLSH_STORAGE_KEY);
    vi.spyOn(Storage.prototype, "setItem").mockImplementation(() => { throw new Error("quota"); });
    render(<BlshCandidateLists snapshot={fixture()} />);
    fireEvent.click(screen.getAllByRole("button", { name: /^Watch .* locally$/ })[0]);
    await waitFor(() => expect(screen.getByText(/Could not save locally/)).toBeTruthy());
    expect(screen.getByText("No watched players yet.")).toBeTruthy();
    expect(localStorage.getItem(BLSH_STORAGE_KEY)).toBeNull();
  });
});
