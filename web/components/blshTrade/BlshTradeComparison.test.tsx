import React from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { act, cleanup, fireEvent, render, screen, waitFor, within } from "@testing-library/react";

import { BLSH_FIXTURE_STORAGE_KEY, BLSH_STORAGE_KEY, emptyBlshState } from "lib/buyLowSellHigh/storage";
import { HORIZON_OPTIONS, type HorizonGames, type InterpretationRecord } from "lib/skoElement/contract";
import { FIXTURE_AS_OF, FIXTURE_CONFIG, FIXTURE_PLAYERS, fixtureRecords } from "lib/skoElement/fixtures";
import { interpretPlayer } from "lib/skoElement/interpret";
import BlshTradeComparison from "./BlshTradeComparison";
import { FIXTURE_BLSH_EVIDENCE } from "./fixtureEvidence";

beforeEach(() => localStorage.clear());
afterEach(() => { cleanup(); vi.restoreAllMocks(); vi.unstubAllGlobals(); });

const recordsByHorizon = Object.fromEntries(HORIZON_OPTIONS.map(horizon => [horizon, fixtureRecords(horizon)])) as Record<HorizonGames, InterpretationRecord[]>;
const renderView = (give: string[], receive: string[]) => render(
  <BlshTradeComparison recordsByHorizon={recordsByHorizon} evidence={FIXTURE_BLSH_EVIDENCE} fixtureBanner="FIXTURE DATA" initialGive={give} initialReceive={receive} />);
const card = (name: string) => screen.getByRole("article", { name });
const result = () => screen.getByRole("region", { name: /Forecast comparison/ });

describe("BlshTradeComparison", () => {
  it("defaults to FHFH Standard over the next 10 team games and labels the fixture forecast experimental", () => {
    renderView(["fx-f5"], ["fx-f3"]);
    expect(screen.getByRole("button", { name: "FHFH Standard (default)" }).getAttribute("aria-pressed")).toBe("true");
    expect(screen.getByRole("button", { name: "Next 10 team games (default)" }).getAttribute("aria-pressed")).toBe("true");
    expect(screen.getAllByRole("button", { name: /^Next \d+ team games/ }).map(button => button.textContent)).toEqual(
      ["Next 5 team games", "Next 10 team games (default)", "Next 20 team games"]);
    expect(within(result()).getByText("Experimental forecast")).toBeTruthy();
    expect(within(result()).getByText(/^Experimental forecast\. Raw projected production/)).toBeTruthy();
    expect(within(card("Fixture Forward Five")).getByText(/Uncertainty/).nextSibling?.textContent).toMatch(/Not supplied by FORGE v1/);
    expect(within(card("Fixture Forward Five")).getByText(/uncalibrated/)).toBeTruthy();
  });

  it("keeps BLSH evidence in its own retrospective block, separate from the forecast", () => {
    renderView(["fx-f5"], ["fx-f3"]);
    const f5 = card("Fixture Forward Five");
    const forecast = within(f5).getByRole("region", { name: "Forecast for Fixture Forward Five" });
    const evidence = within(f5).getByRole("region", { name: "Buy Low / Sell High evidence for Fixture Forward Five" });
    expect(within(evidence).getByText(/recorded games, not a forecast/)).toBeTruthy();
    expect(within(evidence).getByText(/Sell-high research candidate #2 among forwards/)).toBeTruthy();
    expect(within(forecast).queryByText(/Sell-high/)).toBeNull();
    expect(within(evidence).queryByText(/League points/)).toBeNull();
  });

  it("shows the signed gap with units, separate support comparisons and opportunity coverage", () => {
    const local = structuredClone(recordsByHorizon);
    const record = local[10].find(item => item.identity.playerId === "fx-f5")!;
    const metric = record.metrics.find(item => item.target === "POINTS")!;
    metric.gapSign = "negative";
    metric.gapPerTeamGame = { value: -0.15, reason: null };
    metric.comparisons.forecastVsRecent.value = -0.15;
    render(<BlshTradeComparison recordsByHorizon={local} evidence={{}} fixtureBanner="FIXTURE DATA"
      initialGive={["fx-f5"]} initialReceive={["fx-f1"]} />);
    fireEvent.click(screen.getByRole("button", { name: "Categories" }));
    fireEvent.click(screen.getByRole("checkbox", { name: "Points" }));
    fireEvent.click(within(card("Fixture Forward Five")).getByText("Forecast and recent context"));
    const context = within(card("Fixture Forward Five")).getByRole("group", { name: "Points comparisons" });
    expect(context.textContent).toContain("Forecast − recent: −0.15 points per team game");
    expect(context.textContent).toContain("Recent − personal reference");
    expect(context.textContent).toContain("Observed − same-window support");
    expect(card("Fixture Forward Five").textContent).toContain("Comparison block coverage");
    expect(card("Fixture Forward Five").textContent).not.toMatch(/rebound|cooling|watch/i);
  });

  it("names a refused forecast target on the card and trade result", () => {
    const player = FIXTURE_PLAYERS.find(item => item.key === "f1")!;
    const forecast = structuredClone(player.forecasts[10]);
    forecast.player.games.forEach(game => { game.targets.GOALS.allowedUses.comparison = false; });
    const record = interpretPlayer({ evidence: player.evidence, forecast, config: FIXTURE_CONFIG,
      asOf: FIXTURE_AS_OF, horizon: 10, fixture: true });
    render(<BlshTradeComparison recordsByHorizon={{ ...recordsByHorizon,
      10: recordsByHorizon[10].map(item => item.identity.playerId === "fx-f1" ? record : item) }}
      evidence={{}} fixtureBanner="FIXTURE DATA" initialGive={["fx-f5"]} initialReceive={["fx-f1"]} />);
    expect(card("Fixture Forward One").textContent).toContain("comparison not permitted");
    expect(result().textContent).toContain("comparison not permitted");
  });

  it("withholds an unavailable 20-game forecast, never shows zero, and offers a labelled retrospective comparison", () => {
    renderView(["fx-f5"], ["fx-f3"]);
    fireEvent.click(screen.getByRole("button", { name: "Next 20 team games" }));
    const f3 = card("Fixture Forward Three");
    expect(within(f3).getByText("Forecast unavailable")).toBeTruthy();
    expect(within(f3).getByText(/No forecast number is shown/)).toBeTruthy();
    expect(within(result()).getByText(/Fixture Forward Three has 14 of 20 scheduled games/)).toBeTruthy();
    expect(within(result()).getAllByText(/^Withheld/).length).toBe(3);
    fireEvent.click(screen.getByRole("button", { name: /Show a retrospective comparison instead/ }));
    const retro = screen.getByRole("region", { name: "Recorded FHFH Standard points per game" });
    expect(within(retro).getByText(/Retrospective · not a forecast/)).toBeTruthy();
    expect(within(retro).getByText("Receive − give, recorded per game").nextSibling?.textContent).toBe(String((4.6 / 5 - 26.2 / 5).toFixed(2)));
  });

  it("blocks a goalie under skater-only scoring and supports categories and custom weights", () => {
    renderView(["fx-g1"], ["fx-f1"]);
    expect(within(result()).getByText(/Fixture Goalie One has no scored statistic/)).toBeTruthy();
    expect(within(card("Fixture Goalie One")).getByText(/covers skaters only/)).toBeTruthy();
    fireEvent.click(screen.getByRole("button", { name: "Categories" }));
    fireEvent.click(screen.getByRole("checkbox", { name: "SV%" }));
    expect(within(result()).getByRole("rowheader", { name: "SV%" })).toBeTruthy();
    expect(within(result()).getByText(/No overall winner/)).toBeTruthy();
    fireEvent.click(screen.getByRole("button", { name: "Points weights" }));
    fireEvent.change(screen.getByLabelText("Saves"), { target: { value: "0.2" } });
    expect(within(result()).queryByText(/no scored statistic/)).toBeNull();
  });

  it("renders the merged observation-only goalie seam without presenting history as a forecast", () => {
    const goalie = FIXTURE_PLAYERS.find(player => player.key === "g1")!;
    const evidence = structuredClone(goalie.evidence);
    evidence.playerName = "Observed Fixture Goalie";
    evidence.teamGames.at(-1)!.status = "unknown";
    evidence.teamGames.at(-1)!.goalie = undefined;
    const observedByHorizon = Object.fromEntries(HORIZON_OPTIONS.map(horizon => {
      const record = interpretPlayer({ evidence, config: FIXTURE_CONFIG, asOf: FIXTURE_AS_OF, horizon, fixture: true });
      expect(record.recentWindow.unknownGames).toBe(1);
      expect(record.goalie!.observed.savePercentage.value).toBeNull();
      expect(record.goalie!.gap.status).toBe("pending_goalie_adapter");
      return [horizon, [...recordsByHorizon[horizon].filter(item => item.identity.playerId !== evidence.playerId), record]];
    })) as Record<HorizonGames, InterpretationRecord[]>;
    render(<BlshTradeComparison recordsByHorizon={observedByHorizon} evidence={FIXTURE_BLSH_EVIDENCE}
      fixtureBanner="FIXTURE DATA" initialGive={[evidence.playerId]} initialReceive={["fx-f1"]} />);
    const player = card("Observed Fixture Goalie");
    expect(within(player).getByText("Forecast unavailable")).toBeTruthy();
    expect(within(player).getByText("No forecast number is shown for this player.")).toBeTruthy();
    expect(within(player).getByText("Buy Low / Sell High covers skaters only; no evidence for goalies.")).toBeTruthy();
    fireEvent.click(screen.getByRole("button", { name: "Categories" }));
    fireEvent.click(screen.getByRole("checkbox", { name: "SV%" }));
    const savePercentage = within(result()).getByRole("rowheader", { name: "SV%" }).closest("tr")!;
    expect(within(savePercentage).getAllByText(/^Withheld/).length).toBeGreaterThan(0);
    expect(within(player).queryByText("Experimental forecast")).toBeNull();
  });

  it("shows a withheld direction from v3 history gating as text, not as buy or sell evidence", () => {
    renderView(["fx-f5"], ["fx-d1"]);
    const evidence = within(card("Fixture Defense One")).getByRole("region", { name: /Buy Low \/ Sell High evidence/ });
    expect(within(evidence).getByText("Direction withheld: insufficient personal history")).toBeTruthy();
    expect(within(evidence).queryByText(/Buy-low evidence/)).toBeNull();
    expect(within(evidence).getAllByText(/no personal history/).length).toBe(1);
  });

  it("adds and removes players on either side", () => {
    renderView(["fx-f5"], []);
    expect(within(result()).getByText(/Add at least one player you receive/)).toBeTruthy();
    fireEvent.change(screen.getByLabelText("Add a player you receive"), { target: { value: "fx-f6" } });
    expect(card("Fixture Forward Six")).toBeTruthy();
    fireEvent.click(screen.getByRole("button", { name: "Remove Fixture Forward Six" }));
    expect(screen.queryByRole("article", { name: "Fixture Forward Six" })).toBeNull();
  });

  it("selects, saves and reloads evidence-only identities for a retrospective comparison with no forecasts", async () => {
    const props = {
      recordsByHorizon: { 5: [], 10: [], 20: [] },
      evidence: { "captured-a": FIXTURE_BLSH_EVIDENCE["fx-f5"], "captured-b": FIXTURE_BLSH_EVIDENCE["fx-f3"] },
      fixtureBanner: "FIXTURE DATA",
    };
    let view = render(<BlshTradeComparison {...props} />);
    fireEvent.change(screen.getByLabelText("Add a player you give"), { target: { value: "captured-a" } });
    fireEvent.change(screen.getByLabelText("Add a player you receive"), { target: { value: "captured-b" } });
    expect(within(card("Fixture Forward Five")).getByText("Forecast unavailable")).toBeTruthy();
    expect(within(card("Fixture Forward Three")).getByText("No forecast number is shown for this player.")).toBeTruthy();
    expect(within(result()).getAllByText(/^Withheld/).length).toBe(3);
    fireEvent.click(screen.getByRole("button", { name: /Show a retrospective comparison instead/ }));
    const retro = screen.getByRole("region", { name: "Recorded FHFH Standard points per game" });
    expect(within(retro).getByText("Receive − give, recorded per game").nextSibling?.textContent).toBe(String((4.6 / 5 - 26.2 / 5).toFixed(2)));
    fireEvent.click(screen.getByRole("button", { name: "Save draft selections" }));
    await waitFor(() => expect(screen.getByText("Draft selections saved on this device.")).toBeTruthy());
    expect(JSON.parse(localStorage.getItem(BLSH_FIXTURE_STORAGE_KEY)!).draft).toEqual({ give: ["captured-a"], receive: ["captured-b"] });
    expect(localStorage.getItem(BLSH_STORAGE_KEY)).toBeNull();
    view.unmount(); view = render(<BlshTradeComparison {...props} />);
    expect(card("Fixture Forward Five")).toBeTruthy();
    expect(card("Fixture Forward Three")).toBeTruthy();
    expect(within(screen.getByLabelText("Add a player you receive")).getAllByRole("option")).toHaveLength(1);
    fireEvent.click(screen.getByRole("button", { name: "Remove Fixture Forward Five" }));
    expect(within(screen.getByLabelText("Add a player you receive")).getByRole("option", { name: /Fixture Forward Five.*forecast unavailable/ }).getAttribute("value")).toBe("captured-a");
  });

  it("keeps evidence identities selectable across forecast horizon gaps without duplicate or inherited options", () => {
    const evidence = Object.assign(Object.create({ "inherited-player": FIXTURE_BLSH_EVIDENCE["fx-f3"] }), {
      "fx-f5": FIXTURE_BLSH_EVIDENCE["fx-f5"], "missing-evidence": undefined,
    });
    const forecasts = { ...recordsByHorizon, 20: recordsByHorizon[20].filter(record => record.identity.playerId !== "fx-f5") };
    render(<BlshTradeComparison recordsByHorizon={forecasts} evidence={evidence} fixtureBanner="FIXTURE DATA" />);
    const selector = screen.getByLabelText("Add a player you give");
    expect(within(selector).getAllByRole("option", { name: /Fixture Forward Five/ })).toHaveLength(1);
    expect([...selector.querySelectorAll("option")].map(option => option.value)).not.toContain("inherited-player");
    expect([...selector.querySelectorAll("option")].map(option => option.value)).not.toContain("missing-evidence");
    fireEvent.click(screen.getByRole("button", { name: "Next 20 team games" }));
    expect(within(selector).getByRole("option", { name: /Fixture Forward Five.*forecast unavailable/ }).getAttribute("value")).toBe("fx-f5");
    fireEvent.change(selector, { target: { value: "fx-f5" } });
    expect(within(card("Fixture Forward Five")).getByText("Forecast unavailable")).toBeTruthy();
    fireEvent.click(screen.getByRole("button", { name: "Next 10 team games (default)" }));
    expect(within(card("Fixture Forward Five")).queryByText("Forecast unavailable")).toBeNull();
    expect(within(selector).queryByRole("option", { name: /Fixture Forward Five/ })).toBeNull();
  });
});

describe("device-local trade selections", () => {
  it("saves/reloads synthetic selections separately from real data and resets only the fixture draft", async () => {
    const real = { ...emptyBlshState(), draft: { give: ["real-player"], receive: ["other-real"] } };
    localStorage.setItem(BLSH_STORAGE_KEY, JSON.stringify(real));
    let view = renderView(["fx-f5"], ["fx-f3"]);
    expect(screen.getByText(/Synthetic fixture drafts use separate storage/)).toBeTruthy();
    expect(localStorage.getItem(BLSH_FIXTURE_STORAGE_KEY)).toBeNull();
    fireEvent.click(screen.getByRole("button", { name: "Save draft selections" }));
    await waitFor(() => expect(screen.getByText("Draft selections saved on this device.")).toBeTruthy());
    view.unmount(); view = renderView([], []);
    expect(card("Fixture Forward Five")).toBeTruthy(); expect(card("Fixture Forward Three")).toBeTruthy();
    fireEvent.click(screen.getByRole("button", { name: "Reset draft selections" }));
    await waitFor(() => expect(screen.queryByRole("article")).toBeNull());
    expect(JSON.parse(localStorage.getItem(BLSH_FIXTURE_STORAGE_KEY)!).draft).toEqual({ give: [], receive: [] });
    expect(JSON.parse(localStorage.getItem(BLSH_STORAGE_KEY)!)).toEqual(real);
    view.unmount(); renderView(["fx-f5"], ["fx-f3"]);
    expect(screen.queryByRole("article")).toBeNull();
  });
  it("keeps unavailable IDs visible and removable, preserving watchlist/references on save/reset", async () => {
    const watchlist = [{ kind: "research_identity", playerId: "watched", addedAt: "2026-11-07T12:00:00Z" }];
    const marketReferences = { watched: { source: "Manager", kind: "manager_entered", capturedAt: "2026-11-07T12:00:00Z",
      horizonGames: 10, scoringBasis: "points:test", unit: "fantasy_points", value: 20 } };
    localStorage.setItem(BLSH_FIXTURE_STORAGE_KEY, JSON.stringify({ ...emptyBlshState(), watchlist, marketReferences, draft: { give: ["missing-player"], receive: ["fx-f3"] } }));
    renderView([], []);
    expect(within(card("missing-player")).getByText("Forecast unavailable")).toBeTruthy();
    expect(within(result()).getAllByText(/^Withheld/).length).toBe(3);
    fireEvent.click(screen.getByRole("button", { name: "Remove missing-player" }));
    expect(screen.getByText(/Selections changed/)).toBeTruthy();
    fireEvent.click(screen.getByRole("button", { name: "Save draft selections" }));
    await waitFor(() => expect(screen.getByText("Draft selections saved on this device.")).toBeTruthy());
    expect(JSON.parse(localStorage.getItem(BLSH_FIXTURE_STORAGE_KEY)!)).toMatchObject({ watchlist, marketReferences, draft: { give: [], receive: ["fx-f3"] } });
    fireEvent.click(screen.getByRole("button", { name: "Reset draft selections" }));
    await waitFor(() => expect(JSON.parse(localStorage.getItem(BLSH_FIXTURE_STORAGE_KEY)!).draft.receive).toEqual([]));
    expect(JSON.parse(localStorage.getItem(BLSH_FIXTURE_STORAGE_KEY)!)).toMatchObject({ watchlist, marketReferences });
  });
  it.each(["constructor", "toString", "__proto__"])("treats persisted %s as an unavailable identity, not an inherited evidence object", async id => {
    const prototypeBefore = Object.getOwnPropertyDescriptors(Object.prototype);
    localStorage.setItem(BLSH_FIXTURE_STORAGE_KEY, JSON.stringify({ ...emptyBlshState(), draft: { give: [id], receive: ["fx-f3"] } }));
    renderView([], []);
    expect(within(card(id)).getByText("Forecast unavailable")).toBeTruthy();
    expect(within(card(id)).getByText("No Buy Low / Sell High evidence for this player.")).toBeTruthy();
    fireEvent.click(screen.getByRole("button", { name: `Remove ${id}` }));
    fireEvent.click(screen.getByRole("button", { name: "Save draft selections" }));
    await waitFor(() => expect(screen.getByText("Draft selections saved on this device.")).toBeTruthy());
    expect(JSON.parse(localStorage.getItem(BLSH_FIXTURE_STORAGE_KEY)!).draft.give).toEqual([]);
    expect(Object.getOwnPropertyDescriptors(Object.prototype)).toEqual(prototypeBefore);
  });
  it("rejects newer-tab draft conflicts and explicitly loads them without silently losing edits", async () => {
    renderView(["fx-f5"], ["fx-f3"]);
    const elsewhere = { ...emptyBlshState(), draft: { give: ["fx-f1"], receive: ["missing-elsewhere"] } };
    localStorage.setItem(BLSH_FIXTURE_STORAGE_KEY, JSON.stringify(elsewhere));
    fireEvent(window, new StorageEvent("storage", { key: BLSH_FIXTURE_STORAGE_KEY }));
    expect(card("Fixture Forward Five")).toBeTruthy();
    fireEvent.click(screen.getByRole("button", { name: "Save draft selections" }));
    await waitFor(() => expect(screen.getByText(/changed in another tab/)).toBeTruthy());
    expect(JSON.parse(localStorage.getItem(BLSH_FIXTURE_STORAGE_KEY)!)).toEqual(elsewhere);
    fireEvent.click(screen.getByRole("button", { name: "Load saved draft" }));
    expect(card("Fixture Forward One")).toBeTruthy(); expect(card("missing-elsewhere")).toBeTruthy();
    expect(screen.queryByText(/changed in another tab/)).toBeNull();
    expect(screen.queryByRole("article", { name: "Fixture Forward Five" })).toBeNull();
  });
  it("recovers explicitly from another tab deleting the draft without discarding in-memory selections", async () => {
    localStorage.setItem(BLSH_FIXTURE_STORAGE_KEY, JSON.stringify({ ...emptyBlshState(), draft: { give: ["fx-f5"], receive: ["fx-f3"] } }));
    renderView([], []);
    localStorage.removeItem(BLSH_FIXTURE_STORAGE_KEY);
    fireEvent(window, new StorageEvent("storage", { key: null }));
    expect(card("Fixture Forward Five")).toBeTruthy();
    fireEvent.click(screen.getByRole("button", { name: "Reset draft selections" }));
    await waitFor(() => expect(screen.getByText(/changed in another tab/)).toBeTruthy());
    expect(card("Fixture Forward Five")).toBeTruthy();
    expect(screen.getByRole("button", { name: "Load saved draft" }).hasAttribute("disabled")).toBe(false);
    fireEvent.click(screen.getByRole("button", { name: "Load saved draft" }));
    expect(screen.queryByRole("article")).toBeNull();
    fireEvent.click(screen.getByRole("button", { name: "Reset draft selections" }));
    await waitFor(() => expect(screen.getByText("Draft selections saved on this device.")).toBeTruthy());
    expect(JSON.parse(localStorage.getItem(BLSH_FIXTURE_STORAGE_KEY)!).draft).toEqual({ give: [], receive: [] });
  });
  it("preserves corrupt data and keeps in-memory comparison usable with blocked storage", () => {
    localStorage.setItem(BLSH_FIXTURE_STORAGE_KEY, "{");
    const view = renderView(["fx-f5"], ["fx-f3"]);
    expect(screen.getByText(/unreadable or from a newer version/)).toBeTruthy();
    expect(screen.getByRole("button", { name: "Save draft selections" }).hasAttribute("disabled")).toBe(true);
    expect(localStorage.getItem(BLSH_FIXTURE_STORAGE_KEY)).toBe("{");
    view.unmount();
    vi.spyOn(Storage.prototype, "getItem").mockImplementation(() => { throw new Error("blocked"); });
    renderView(["fx-f5"], []);
    expect(screen.getByText(/browser blocked local storage/)).toBeTruthy();
    fireEvent.change(screen.getByLabelText("Add a player you receive"), { target: { value: "fx-f3" } });
    expect(card("Fixture Forward Three")).toBeTruthy();
    expect(screen.getByRole("button", { name: "Save draft selections" }).hasAttribute("disabled")).toBe(true);
  });
  it("never carries a pending fixture save into a real-source editor", async () => {
    let finish = () => {};
    vi.stubGlobal("navigator", { locks: { request: (_key: string, write: () => unknown) => new Promise(resolve => { finish = () => resolve(write()); }) } });
    localStorage.setItem(BLSH_STORAGE_KEY, JSON.stringify({ ...emptyBlshState(), draft: { give: ["real-unavailable"], receive: [] } }));
    const view = renderView(["fx-f5"], ["fx-f3"]);
    fireEvent.click(screen.getByRole("button", { name: "Save draft selections" }));
    const realRecords = Object.fromEntries(HORIZON_OPTIONS.map(horizon => [horizon, recordsByHorizon[horizon].map(record => ({ ...record, fixture: false }))])) as Record<HorizonGames, InterpretationRecord[]>;
    view.rerender(<BlshTradeComparison recordsByHorizon={realRecords} evidence={{}} />);
    expect(card("real-unavailable")).toBeTruthy();
    await act(async () => { finish(); });
    expect(card("real-unavailable")).toBeTruthy();
    expect(screen.queryByRole("article", { name: "Fixture Forward Five" })).toBeNull();
    expect(screen.queryByText("Draft selections saved on this device.")).toBeNull();
    expect(JSON.parse(localStorage.getItem(BLSH_STORAGE_KEY)!).draft.give).toEqual(["real-unavailable"]);
    expect(JSON.parse(localStorage.getItem(BLSH_FIXTURE_STORAGE_KEY)!).draft.give).toEqual(["fx-f5"]);
  });
  it("does not claim saving success on quota failure", async () => {
    renderView(["fx-f5"], ["fx-f3"]);
    vi.spyOn(Storage.prototype, "setItem").mockImplementation(() => { throw new Error("quota"); });
    fireEvent.click(screen.getByRole("button", { name: "Save draft selections" }));
    await waitFor(() => expect(screen.getByText("These selections have not been saved.")).toBeTruthy());
    expect(screen.getByText(/Could not save locally/)).toBeTruthy();
    expect(localStorage.getItem(BLSH_FIXTURE_STORAGE_KEY)).toBeNull(); expect(card("Fixture Forward Five")).toBeTruthy();
  });
  it.each(["fx-d1", "fx-d3"])("withholds signed gap/index for %s history gating", id => {
    const profile = FIXTURE_BLSH_EVIDENCE[id];
    renderView([id], ["fx-f3"]);
    const block = within(card(profile.displayName)).getByRole("region", { name: `Buy Low / Sell High evidence for ${profile.displayName}` });
    expect(within(block).getByText("Direction withheld: insufficient personal history")).toBeTruthy();
    expect(within(block).queryByText(/Supporting research index/)).toBeNull();
    expect(within(block).queryByText(/FHFH Standard recorded-window gap/)).toBeNull();
  });
  it("leads with the unchanged retrospective league gap, dates it, and keeps index secondary across scoring changes", () => {
    renderView(["fx-f5"], ["fx-f3"]);
    const block = within(card("Fixture Forward Five")).getByRole("region", { name: /Buy Low \/ Sell High evidence/ });
    expect(within(block).getByText(/FHFH Standard recorded-window gap/).textContent).toContain("-12.10");
    expect(within(block).getByText(/Supporting research index/).textContent).toContain("-38");
    expect(within(block).getByText(/recorded games through/).textContent).toContain(FIXTURE_BLSH_EVIDENCE["fx-f5"].evidence.window.recordedThroughDate);
    const before = block.textContent;
    fireEvent.click(screen.getByRole("button", { name: "Points weights" }));
    fireEvent.change(screen.getByLabelText("Goals"), { target: { value: "9" } });
    expect(block.textContent).toBe(before);
  });
});
