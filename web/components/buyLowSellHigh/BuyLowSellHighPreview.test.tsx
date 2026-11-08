import React from "react";
import { renderToString } from "react-dom/server";
import { afterEach, describe, expect, it, vi } from "vitest";
import { act, cleanup, fireEvent, render, screen, within } from "@testing-library/react";
import { readFileSync } from "node:fs";
import { join } from "node:path";

import { parseHistoricalResearchSnapshot, parseCurrentResearchSnapshot, profileName, currentWindowAgeText } from "lib/buyLowSellHigh/researchSnapshot";
import BuyLowSellHighPreview, { captureAgeState } from "./BuyLowSellHighPreview";
import { CURRENT_SNAPSHOT_PATH } from "lib/buyLowSellHigh/researchSnapshot.server";
import { ProductionTrackComparison } from "./BlshPlayerDetail";

afterEach(() => { cleanup(); vi.useRealTimers(); }); // React DOM teardown only; no file cleanup.
const snapshot = parseHistoricalResearchSnapshot(JSON.parse(readFileSync(join(process.cwd(), "lib/buyLowSellHigh/research-snapshots/2024-04-18.v1.json"), "utf8")));
const inspect = (id: number) => fireEvent.change(screen.getByLabelText(/Inspect any historical profile/), { target: { value: String(id) } });

describe("standalone historical BLSH preview", () => {
  it("shows real historical scope, approved scoring and saved BL/SH counts", () => {
    render(<BuyLowSellHighPreview snapshot={snapshot} />);
    expect(screen.getByRole("note").textContent).toMatch(/Historical research snapshot.*2024-04-18/);
    expect(screen.getByRole("button", { name: "Buy-low candidates (364)" })).toBeTruthy();
    expect(screen.getByRole("button", { name: "Sell-high candidates (265)" })).toBeTruthy();
    expect(screen.getByText(/FHFH Standard: 3G/)).toBeTruthy();
    expect(screen.queryByText(/Raw projected production|Fixture league|Trade comparison/)).toBeNull();
    expect(screen.getAllByRole("option")).toHaveLength(925);
  });
  it("shows retained P and support values for the reviewed low-shot Perbix case", () => {
    render(<BuyLowSellHighPreview snapshot={snapshot} />); inspect(8480246);
    const detail = screen.getByRole("region", { name: "NICK PERBIX" });
    expect(within(detail).getByText(/production P: \+54.87/)).toBeTruthy();
    expect(within(detail).getByText(/research index: \+61.59/)).toBeTruthy();
    expect(within(detail).getByText(/SOG: 3 total; 0.60 per appearance. No whole-profile shooting gate/)).toBeTruthy();
    expect(within(detail).getByRole("table", { name: "Three-track production breakdown" })).toBeTruthy();
    expect(within(detail).getByText(/estimator weights, not confidence percentages/)).toBeTruthy();
  });
  it("keeps zero-shot numeric profiles inspectable", () => {
    const p = snapshot.profiles.find(p => p.coverage.shots === 0 && p.score.value !== null)!;
    render(<BuyLowSellHighPreview snapshot={snapshot} />); inspect(p.playerId);
    const detail = screen.getByRole("region", { name: profileName(p) });
    expect(within(detail).getByText(/SOG: 0 total/)).toBeTruthy();
    expect(within(detail).getByText(/Support-adjusted research index:/).textContent).not.toMatch(/Unavailable/);
  });
  it("shows conflicts separately from balanced or missing evidence", () => {
    const p = snapshot.profiles.find(p => p.score.status === "conflicting_baseline_and_support")!;
    render(<BuyLowSellHighPreview snapshot={snapshot} />); inspect(p.playerId);
    const detail = screen.getByRole("region", { name: profileName(p) });
    expect(within(detail).getByText(/Conflicting production\/support evidence/)).toBeTruthy();
    expect(within(detail).getByText(/List: Withheld; inspect evidence/)).toBeTruthy();
    expect(p.score.value).not.toBeNull();
  });
  it("shows insufficient evidence as unavailable, never zero", () => {
    const p = snapshot.profiles.find(p => p.score.value === null)!;
    render(<BuyLowSellHighPreview snapshot={snapshot} />); inspect(p.playerId);
    const detail = screen.getByRole("region", { name: profileName(p) });
    expect(within(detail).getByText(/Support-adjusted research index: Unavailable/)).toBeTruthy();
    expect(within(detail).getByText(/List: Withheld/)).toBeTruthy();
  });
  it("does not fabricate a streak for a directional BLSH candidate", () => {
    const p = snapshot.profiles.find(p => p.score.list === "BL" && p.streak === null)!;
    render(<BuyLowSellHighPreview snapshot={snapshot} />); inspect(p.playerId);
    expect(screen.getByText(/No matching saved player\/date\/detector-version record/)).toBeTruthy();
  });
  it("labels a matched saved streak with separate version and unissued chronology", () => {
    render(<BuyLowSellHighPreview snapshot={snapshot} />); inspect(8480246);
    expect(screen.getByText(/blsh-overnight-three-track-v2 \/ block5; not adopted for production/)).toBeTruthy();
    expect(screen.getByText(/No retrospective phase is presented as an issued alert/)).toBeTruthy();
  });
  it("switches separate lists and keeps initial DOM bounded", () => {
    render(<BuyLowSellHighPreview snapshot={snapshot} />);
    expect(within(screen.getByRole("table", { name: "Buy-low candidates" })).getAllByRole("row")).toHaveLength(26);
    fireEvent.click(screen.getByRole("button", { name: "Sell-high candidates (265)" }));
    expect(screen.getByRole("table", { name: "Sell-high candidates" })).toBeTruthy();
    fireEvent.click(screen.getByRole("button", { name: "Withheld / balanced / unavailable (295)" }));
    expect(screen.getByRole("table", { name: "Withheld historical profiles" })).toBeTruthy();
  });
  it("opens details, closes with Escape and restores focus", () => {
    render(<BuyLowSellHighPreview snapshot={snapshot} />);
    const toggle = screen.getByRole("button", { name: "Details for NICK PERBIX" });
    fireEvent.click(toggle);
    const heading = within(screen.getByRole("region", { name: "NICK PERBIX" })).getByRole("heading", { name: "NICK PERBIX" });
    expect(document.activeElement).toBe(heading);
    fireEvent.keyDown(heading, { key: "Escape" });
    expect(screen.queryByRole("region", { name: "NICK PERBIX" })).toBeNull();
    expect(document.activeElement).toBe(toggle);
  });
});

const current = parseCurrentResearchSnapshot(JSON.parse(readFileSync(join(process.cwd(), "lib/buyLowSellHigh/research-snapshots/2026-10-26.arm-a-official-overlay.v2.json"), "utf8")));
const inspectCurrent = (id: number) => fireEvent.change(screen.getByLabelText(/Inspect any profile/), { target: { value: String(id) } });
describe("current retrospective BLSH preview", () => {
  it("shows the chosen provisional stale reference and all saved lists/profiles", () => {
    render(<BuyLowSellHighPreview snapshot={current} />);
    expect(screen.getByRole("note").textContent).toMatch(/2026-10-26.*provisional.*stale/);
    expect(screen.getByText(/historical personal\/cohort reference, adjusted for current underlying support/)).toBeTruthy();
    expect(screen.getByRole("button", { name: "Buy-low candidates (360)" })).toBeTruthy();
    expect(screen.getByRole("button", { name: "Sell-high candidates (223)" })).toBeTruthy();
    expect(screen.getAllByRole("option")).toHaveLength(726);
    expect(within(screen.getByRole("table", { name: "Buy-low candidates" })).getAllByRole("row")).toHaveLength(26);
    fireEvent.click(screen.getByRole("button", { name: "Show next 25" }));
    expect(within(screen.getByRole("table", { name: "Buy-low candidates" })).getAllByRole("row")).toHaveLength(51);
    fireEvent.click(screen.getByRole("button", { name: "Withheld / balanced / unavailable (142)" }));
    expect(screen.getByRole("table", { name: "Withheld profiles" })).toBeTruthy();
  });
  it("retains numeric zero-shot eligibility and unavailable current streaks", () => {
    const p = current.profiles.find(p => p.score.list !== null && p.context.signals.some(c => c.metric === "shots_per_60" && c.current === 0))!;
    render(<BuyLowSellHighPreview snapshot={current} />); inspectCurrent(p.playerId);
    const detail = screen.getByRole("region", { name: p.displayName });
    expect(within(detail).getByText(/Support-adjusted research index:/).textContent).not.toContain("Unavailable");
    expect(within(detail).getByText(/Current 0.00, reference/)).toBeTruthy();
    expect(within(detail).getByText(/No current-season streak is saved; streak unavailable/)).toBeTruthy();
  });
  it("shows null evidence tier and specific reasons as unavailable", () => {
    const p = current.profiles.find(p => p.score.value === null)!;
    render(<BuyLowSellHighPreview snapshot={current} />); inspectCurrent(p.playerId);
    const detail = screen.getByRole("region", { name: p.displayName });
    expect(within(detail).getByText(/Support-adjusted research index: Unavailable/)).toBeTruthy();
    expect(within(detail).getByText(/Unavailable: no score/, { selector: "li" })).toBeTruthy();
    expect(within(detail).getAllByText(p.score.reasonText!, { exact: false }).length).toBeGreaterThan(0);
    expect(within(detail).queryByText(/Provisional: estimated or extrapolated/)).toBeNull();
  });
  it("separates absent reference context from mismatched identity and note counts from games", () => {
    const p = current.profiles.find(p => p.displayName.toLowerCase() === "garrett wilson")!;
    render(<BuyLowSellHighPreview snapshot={current} />); inspectCurrent(p.playerId);
    const detail = screen.getByRole("region", { name: p.displayName });
    expect(within(detail).getAllByText(/No personal reference window supplied; context comparison unavailable/).length).toBeGreaterThan(0);
    expect(within(detail).queryByText(/could not be matched/)).toBeNull();
    expect(within(detail).queryByText(/personal reference.*1 games/i)).toBeNull();
    expect(within(detail).getByText(/Personal estimator weight: 0.0000; cohort estimator weight: 1.0000/)).toBeTruthy();
  });
  it("shows actual old reference ages, the correct freshness anchor and additive normalization labels", () => {
    const p = current.profiles.find(p => p.evidence.reference.ageDays === 1451)!;
    render(<BuyLowSellHighPreview snapshot={current} />); inspectCurrent(p.playerId);
    const detail = screen.getByRole("region", { name: p.displayName });
    expect(within(detail).getByText(/Reference ends 1451 days before the window/, { selector: "li" })).toBeTruthy();
    expect(within(detail).getByText(/Last game .* before the recorded-through date \(2026-10-26\)/, { selector: "li" })).toBeTruthy();
    expect(within(detail).queryByRole("table", { name: "Three-track production breakdown" })).toBeNull();
    const numeric = current.profiles.find(p => p.tracks.length)!; inspectCurrent(numeric.playerId);
    const scored = screen.getByRole("region", { name: numeric.displayName });
    expect(within(scored).getAllByText(/Normalization multiplier: .*Contribution to normalized gap:/)).toHaveLength(3);
    expect(within(scored).getByText(/separate bounded transform/)).toBeTruthy();
    expect(scored.textContent).not.toMatch(/weight: \d+\.\d+%|~900|Share of the index/);
  });
  it("retains conflicting nonzero evidence and restores focus when closing", () => {
    const p = current.profiles.find(p => p.score.status === "conflicting_baseline_and_support")!;
    render(<BuyLowSellHighPreview snapshot={current} />); inspectCurrent(p.playerId);
    const detail = screen.getByRole("region", { name: p.displayName });
    expect(within(detail).getByText(/Production and support disagree; withheld from lists/)).toBeTruthy();
    expect(p.score.value).not.toBeNull(); expect(p.score.value).not.toBe(0);
    fireEvent.keyDown(within(detail).getByRole("heading", { name: p.displayName }), { key: "Escape" });
    expect(screen.queryByRole("region", { name: p.displayName })).toBeNull();
    expect(document.activeElement).toBe(screen.getByLabelText(/Inspect any profile/));
  });
});

const refreshed = parseCurrentResearchSnapshot(JSON.parse(readFileSync(CURRENT_SNAPSHOT_PATH, "utf8")));
describe("saved window age independent of production and capture age", () => {
  it("shows Benn's recent missing-production window correctly in both table and detail", () => {
    vi.useFakeTimers(); vi.setSystemTime(new Date("2026-11-01T12:00:00Z"));
    const p = refreshed.profiles.find(profile => profile.playerId === 8473994)!;
    const before = JSON.stringify(p);
    expect(p.evidence.window.fresh).toBe(false);
    expect(p.evidence.window.freshnessText).toContain("stale window"); // Preserve the frozen DTO.
    render(<BuyLowSellHighPreview snapshot={refreshed} />);
    fireEvent.click(screen.getByRole("button", { name: "Withheld / balanced / unavailable (281)" }));
    const row = within(screen.getByRole("table", { name: "Withheld profiles" })).getByRole("row", { name: /Jamie Benn/ });
    expect(row.textContent).toMatch(/Last game 1 day before.*within the saved seven-day window-age limit/);
    expect(row.textContent).toContain("Score unavailable: a current-window game is missing");
    expect(row.textContent).not.toContain("stale window");
    inspectCurrent(p.playerId);
    const detail = screen.getByRole("region", { name: "Jamie Benn" });
    expect(within(detail).getByText(/Last game 1 day before.*within the saved seven-day window-age limit/)).toBeTruthy();
    expect(within(detail).queryByText(/stale window/, { selector: "li" })).toBeNull();
    expect(within(detail).getByText(/Support-adjusted research index: Unavailable/)).toBeTruthy();
    expect(within(detail).getByText(/List: Withheld/)).toBeTruthy();
    expect(within(detail).queryByRole("figure")).toBeNull();
    expect(screen.getByRole("status", { name: "Snapshot capture freshness" }).textContent).toMatch(/Stale saved capture/);
    expect(JSON.stringify(p)).toBe(before);
  });

  it("keeps an actually old numeric window outside the age limit and withheld", () => {
    const p = refreshed.profiles.find(profile => profile.playerId === 8475253)!;
    const before = JSON.stringify(p);
    expect(p.score.value).not.toBeNull(); expect(p.score.list).toBeNull();
    render(<BuyLowSellHighPreview snapshot={refreshed} />); inspectCurrent(p.playerId);
    const detail = screen.getByRole("region", { name: "Garrett Wilson" });
    expect(within(detail).getByText(/Last game 11 days before.*outside the saved seven-day window-age limit/)).toBeTruthy();
    expect(within(detail).getByText(/Support-adjusted research index: \+43.87/)).toBeTruthy();
    expect(within(detail).getByText(/List: Withheld/)).toBeTruthy();
    expect(JSON.stringify(p)).toBe(before);
  });

  it("uses the inclusive seven-day age boundary independently of the combined fresh flag", () => {
    const w = refreshed.profiles[0].evidence.window;
    for (const fresh of [false, true]) {
      for (const age of [0, 7]) expect(currentWindowAgeText({ ...w, fresh, lastGameDaysBeforeRecordedThrough: age })).toContain("within the saved seven-day window-age limit");
      expect(currentWindowAgeText({ ...w, fresh, lastGameDaysBeforeRecordedThrough: 8 })).toContain("outside the saved seven-day window-age limit");
    }
  });

  it("keeps unknown or invalid ages unknown rather than treating them as zero or old", () => {
    const w = refreshed.profiles[0].evidence.window;
    for (const age of [null, -1, 1.5, NaN, Infinity]) {
      const text = currentWindowAgeText({ ...w, fresh: false, lastGameDaysBeforeRecordedThrough: age });
      expect(text).toContain("Last game age unknown");
      expect(text).toContain("window-age eligibility unknown");
      expect(text).not.toMatch(/stale|outside|0 days/);
    }
  });
});

describe("native production comparison visual", () => {
  it("uses the saved totals and keeps the numerical explanation and restrictions", () => {
    const p = refreshed.profiles.find(profile => profile.tracks.length === 3)!;
    const before = JSON.stringify(p);
    render(<BuyLowSellHighPreview snapshot={refreshed} />); inspectCurrent(p.playerId);
    const detail = screen.getByRole("region", { name: p.displayName });
    const disclosure = within(detail).getByText("Compare these totals visually").closest("details")!;
    fireEvent.click(within(disclosure).getByText("Compare these totals visually"));
    for (const track of p.tracks) {
      const figure = within(disclosure).getByRole("figure", { name: `${track.label}: saved window totals` });
      for (const value of [track.observed, track.referenceAtCurrentTOI, track.supportConditioned])
        expect(figure.textContent).toContain(value.toFixed(4));
    }
    const table = within(detail).getByRole("table", { name: "Three-track production breakdown" });
    expect(table.querySelector("caption")!.textContent).toBe(`${p.evidence.window.games} recorded appearances · ${p.evidence.window.minutes!.toFixed(2)} total minutes. All values are totals in each row’s units.`);
    for (const name of ["Track", "Actual total", "Historical comparison total", "Support comparison total", "Gap (support − actual)"])
      expect(within(table).getByRole("columnheader", { name }).getAttribute("scope")).toBe("col");
    for (const track of p.tracks) {
      const row = within(table).getByRole("rowheader", { name: track.label }).closest("tr")!;
      const cells = within(row).getAllByRole("cell");
      expect(cells.map(cell => cell.textContent)).toEqual([track.observed.toFixed(2), track.referenceAtCurrentTOI.toFixed(2), track.supportConditioned.toFixed(2), `${track.gap > 0 ? "+" : ""}${track.gap.toFixed(4)}`]);
    }
    expect(within(detail).getByText(/Each number below covers all/).textContent).toContain("not per-game averages");
    expect(within(detail).getByText(/the historical production rate applied to the same ice time/).textContent).toContain("not the player’s historical per-game average");
    expect(within(detail).getByText(/adjusts the historical comparison using changes/).textContent).toContain("not a forecast or proof of good or bad luck");
    expect(within(detail).getByText(/The figures below are rates or ratios/).textContent).toContain("Per appearance means per recorded game");
    expect(within(detail).getByText(/A low or high total across five games/)).toBeTruthy();
    expect(within(disclosure).getByText(/Each track uses its own native-unit scale/)).toBeTruthy();
    expect(within(detail).getByText(/Missing measurements remain unavailable/)).toBeTruthy();
    expect(within(detail).getAllByText(/Normalization multiplier:/)).toHaveLength(3);
    expect(JSON.stringify(p)).toBe(before);
  });

  it("shows negative totals to the left of zero without clipping", () => {
    render(<ProductionTrackComparison track={{ label: "Fixture Game Score", observed: -2, referenceAtCurrentTOI: 1, supportConditioned: 3 }} />);
    const figure = screen.getByRole("figure", { name: "Fixture Game Score: saved window totals" });
    expect(figure.textContent).toContain("Actual total: -2.0000");
    expect(figure.textContent).toContain("Scale: -2.0000 to 3.0000");
    const plot = figure.querySelector("svg")!;
    expect(plot.querySelector("rect")!.getAttribute("x")).toBe("5");
    expect(plot.querySelector("rect")!.getAttribute("width")).toBe("36");
    expect(plot.querySelectorAll("line")[1].getAttribute("x1")).toBe("41");
    expect(plot.getAttribute("aria-hidden")).toBe("true");
    expect(plot.getAttribute("focusable")).toBe("false");
  });

  it("retains observed zero and does not invent a nonzero all-zero scale", () => {
    render(<ProductionTrackComparison track={{ label: "Fixture FP", observed: 0, referenceAtCurrentTOI: 0, supportConditioned: 0 }} />);
    const figure = screen.getByRole("figure", { name: "Fixture FP: saved window totals" });
    expect(figure.textContent).toContain("Actual total: 0.0000");
    expect(figure.textContent).toContain("All three recorded totals are zero");
    expect(figure.textContent).toContain("Scale: 0.0000 to 0.0000");
    for (const bar of figure.querySelectorAll("rect")) expect(bar.getAttribute("width")).toBe("0");
    expect(figure.querySelectorAll("svg")).toHaveLength(3);
  });

  it("withholds a malformed visual instead of making missing values zero", () => {
    for (const observed of [null, NaN, Infinity, -Infinity]) {
      const view = render(<ProductionTrackComparison track={{ label: "Fixture FP", observed: observed as number, referenceAtCurrentTOI: 1, supportConditioned: 2 }} />);
      expect(screen.getByText(/comparison unavailable; a saved total is missing or invalid/)).toBeTruthy();
      expect(view.container.querySelector("svg")).toBeNull();
      view.unmount();
    }
  });

  it("does not draw a chart for an unavailable scored profile", () => {
    const p = refreshed.profiles.find(profile => profile.score.value === null)!;
    render(<BuyLowSellHighPreview snapshot={refreshed} />); inspectCurrent(p.playerId);
    const detail = screen.getByRole("region", { name: p.displayName });
    expect(within(detail).queryByText("Compare these totals visually")).toBeNull();
    expect(within(detail).queryByRole("figure")).toBeNull();
    expect(within(detail).getByText(/Support-adjusted research index: Unavailable/)).toBeTruthy();
  });
});

describe("fresh repaired canonical BLSH preview", () => {
  it("shows the fresh cutoff, all729players and honest new missingness", () => {
    render(<BuyLowSellHighPreview snapshot={refreshed} />);
    expect(screen.getByRole("note").textContent).toContain("2026-10-28");
    expect(screen.getByRole("button", { name: "Buy-low candidates (264)" })).toBeTruthy();
    expect(screen.getByRole("button", { name: "Sell-high candidates (184)" })).toBeTruthy();
    expect(screen.getByRole("button", { name: "Withheld / balanced / unavailable (281)" })).toBeTruthy();
    expect(screen.getAllByRole("option")).toHaveLength(730);
    expect(screen.getAllByText(/138 newer rows retain missing Game Score inputs/).length).toBeGreaterThan(0);
  });
  it("retains missing production as unavailable", () => {
    const p = refreshed.profiles.find(p => p.score.reason === "no_measured_current_production_or_exposure")!;
    render(<BuyLowSellHighPreview snapshot={refreshed} />); inspectCurrent(p.playerId);
    const detail = screen.getByRole("region", { name: p.displayName });
    expect(p.score.value).toBeNull(); expect(p.evidence.tier).toBeNull();
    expect(within(detail).getByText(/Support-adjusted research index: Unavailable/)).toBeTruthy();
    expect(within(detail).getAllByText(p.score.reasonText!, { exact: false }).length).toBeGreaterThan(0);
  });
  it("preserves the fresh conflicting Burns case and its two signed axes", () => {
    const p = refreshed.profiles.find(p => p.playerId === 8470613)!;
    expect(p.score.value!).toBeLessThan(0); expect(p.score.baselineNormalizedGap!).toBeGreaterThan(0);
    expect(p.score.list).toBeNull();
    render(<BuyLowSellHighPreview snapshot={refreshed} />); inspectCurrent(p.playerId);
    expect(within(screen.getByRole("region", { name: p.displayName })).getByText(/Production and support disagree; withheld from lists/)).toBeTruthy();
  });
  it("keeps zero-shot eligibility in the expanded capture", () => {
    expect(refreshed.counts.zeroShotWindows).toBe(19); expect(refreshed.counts.zeroShotListed).toBe(7);
    const p = refreshed.profiles.find(p => p.playerId === 8475413)!;
    expect(p.score.list).toBe("BL");
    render(<BuyLowSellHighPreview snapshot={refreshed} />); inspectCurrent(p.playerId);
    expect(within(screen.getByRole("region", { name: p.displayName })).getByText(/Current 0.00, reference/)).toBeTruthy();
  });
});


describe("saved capture age disclosure", () => {
  const captureMs = Date.parse(refreshed.asOfUTC);
  const dayMs = 24 * 60 * 60 * 1000;
  it("uses the pinned capture policy with its exact inclusive 24-hour boundary", () => {
    expect(captureAgeState(refreshed, captureMs)).toBe("within_budget");
    expect(captureAgeState(refreshed, captureMs + dayMs)).toBe("within_budget");
    expect(captureAgeState(refreshed, captureMs + dayMs + 1)).toBe("stale");
  });
  it("keeps missing clocks, invalid timestamps and clock reversal unknown", () => {
    for (const now of [null, NaN, Infinity, captureMs - 1]) expect(captureAgeState(refreshed, now)).toBe("unknown");
    expect(captureAgeState({ ...refreshed, asOfUTC: "invalid" }, captureMs)).toBe("unknown");
  });
  it("does not invent an age policy for another request or cutoff", () => {
    expect(captureAgeState(current, captureMs + dayMs)).toBe("unknown");
    expect(captureAgeState({ ...refreshed, sourcePins: { ...refreshed.sourcePins, currentRequest: "unknown" } }, captureMs)).toBe("unknown");
    expect(captureAgeState({ ...refreshed, eventThroughDate: "2026-10-29" }, captureMs)).toBe("unknown");
  });
  it("labels today's stale research while preserving the saved lists and cutoff", () => {
    vi.useFakeTimers(); vi.setSystemTime(new Date("2026-11-01T12:00:00Z"));
    render(<BuyLowSellHighPreview snapshot={refreshed} />);
    expect(screen.getByRole("status", { name: "Snapshot capture freshness" }).textContent).toMatch(/Stale saved capture.*current recommendations unavailable/);
    for (const label of ["Buy-low candidates (264)", "Sell-high candidates (184)", "Withheld / balanced / unavailable (281)"])
      expect(screen.getByRole("button", { name: label })).toBeTruthy();
    expect(screen.getByText(/Player game ages below are relative to this saved cutoff, not today/).textContent).toContain(refreshed.asOfUTC);
    expect(screen.getByRole("columnheader", { name: "Evidence / age at saved cutoff" })).toBeTruthy();
  });
  it("ages an open tab without promoting within-budget data to live freshness", () => {
    vi.useFakeTimers(); vi.setSystemTime(captureMs + dayMs - 1);
    const view = render(<BuyLowSellHighPreview snapshot={refreshed} />);
    expect(screen.getByRole("status").textContent).toMatch(/within its 24-hour age budget.*live freshness remains unverified/);
    act(() => { vi.advanceTimersByTime(60_000); });
    expect(screen.getByRole("status").textContent).toMatch(/Stale saved capture/);
    view.unmount(); expect(vi.getTimerCount()).toBe(0);
  });
  it("rechecks on focus after the browser has suspended a tab", () => {
    vi.useFakeTimers(); vi.setSystemTime(captureMs);
    render(<BuyLowSellHighPreview snapshot={refreshed} />);
    vi.setSystemTime(captureMs + dayMs + 1); fireEvent.focus(window);
    expect(screen.getByRole("status").textContent).toMatch(/Stale saved capture/);
  });
  it("renders a clock-independent unknown notice before client effects run", () => {
    vi.useFakeTimers(); vi.setSystemTime(new Date("2026-11-01T12:00:00Z"));
    const html = renderToString(<BuyLowSellHighPreview snapshot={refreshed} />);
    expect(html).toContain("Capture age or policy unavailable. Saved research only");
    expect(html).not.toContain("Stale saved capture");
  });
  it("leaves historical v1 outside the current-capture policy", () => {
    render(<BuyLowSellHighPreview snapshot={snapshot} />);
    expect(screen.queryByRole("status", { name: "Snapshot capture freshness" })).toBeNull();
  });
});
