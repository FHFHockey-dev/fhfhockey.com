import React from "react";
import { cleanup, fireEvent, render, screen, within } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import TestingGroundsPreview, { OperationalProgressPanel, RunHistoryPanel } from "./TestingGroundsPreview";
import { createHistoryFixture, createPreviewFixture, previewScenarios, PREVIEW_NOW } from "./previewFixtures";
import { MAX_LISTED_RUNS } from "../runProjection";
import { projectOperationalProgress } from "../operationalProgress";

afterEach(() => { cleanup(); vi.unstubAllGlobals(); });
const select = (value: string) => fireEvent.change(screen.getByRole("combobox", { name: "Preview state" }), { target: { value } });
const stage = (name: string) => within(screen.getByRole("heading", { name }).closest("li")!);

describe("Testing Grounds synthetic monitoring shell", () => {
  it("labels its local scope and shows completed units with separate denominators and counters", () => {
    render(<TestingGroundsPreview />);
    expect(screen.getByRole("heading", { level: 1 }).textContent).toBe("Testing Grounds");
    expect(screen.getByText("Synthetic preview")).toBeTruthy();
    const launch = screen.getByRole("button", { name: "Launch unavailable" }) as HTMLButtonElement;
    expect(launch.disabled).toBe(true);
    expect(document.getElementById(launch.getAttribute("aria-describedby")!)?.textContent).toContain("Nothing continues");
    const prediction = screen.getByRole("progressbar", { name: "Player-game predictions completed work" });
    expect(prediction.getAttribute("value")).toBe("432");
    expect(prediction.getAttribute("max")).toBe("720");
    expect(stage("Player-game predictions").getByText("60.0% complete")).toBeTruthy();
    for (const text of ["420", "12", "0", "288"]) expect(stage("Player-game predictions").getByText(text)).toBeTruthy();
    expect(screen.getByText(/excluded rows do not count as completed work/)).toBeTruthy();
  });

  it("renders every scenario without network, jobs or result controls", () => {
    const fetch = vi.fn(() => { throw new Error("No network in preview"); }); vi.stubGlobal("fetch", fetch);
    render(<TestingGroundsPreview />);
    for (const scenario of previewScenarios) {
      select(scenario.id);
      expect(screen.queryByRole("alert")).toBeNull();
      expect((screen.getByRole("combobox") as HTMLSelectElement).value).toBe(scenario.id);
      expect(screen.getByRole("region", { name: "Sealed results" }).textContent).toContain("Results stay sealed");
      expect(screen.queryByRole("button", { name: /reveal|export|cancel|repair/i })).toBeNull();
      fireEvent.click(screen.getByRole("button", { name: "Launch unavailable" }));
    }
    expect(fetch).not.toHaveBeenCalled();
  });

  it("uses elapsed time and heartbeat for fitting without a fake percentage or progressbar", () => {
    render(<TestingGroundsPreview />); select("fitting");
    const fitting = stage("Model fitting");
    expect(fitting.queryByRole("progressbar")).toBeNull();
    expect(fitting.getByText(/No measured internal percentage/).textContent).toContain("7m 0s");
    expect(fitting.getByText(/Recent heartbeat · 1m 0s ago/)).toBeTruthy();
    expect(fitting.queryByText(/\d+%/)).toBeNull();
  });

  it("reports stale heartbeat separately from the saved running state", () => {
    render(<TestingGroundsPreview />); select("stale");
    expect(screen.getByRole("status").textContent).toContain("does not prove the worker failed");
    expect(stage("Player-game predictions").getByText("Running")).toBeTruthy();
    expect(stage("Player-game predictions").getByText(/Stale heartbeat · 4m 0s ago/)).toBeTruthy();
  });

  it("retains accepted counts through cancellation and never treats completion as reveal", () => {
    render(<TestingGroundsPreview />); select("cancelling");
    expect(screen.getByText(/Waiting for a safe checkpoint/)).toBeTruthy();
    select("cancelled");
    expect(stage("Player-game predictions").getByText("420")).toBeTruthy();
    expect(stage("Player-game predictions").getByText("288")).toBeTruthy();
    expect(stage("Player-game predictions").getByText("Elapsed: 3m 0s")).toBeTruthy();
    select("sealed");
    expect(within(screen.getByRole("region", { name: "Work progress" })).getByText("Completed · results sealed")).toBeTruthy();
    expect(screen.getByText(/Completion alone does not authorize reveal/)).toBeTruthy();
    expect(screen.queryByText(/AUC|Brier|accuracy|log loss/i)).toBeNull();
  });

  it("distinguishes every health category and shows safe copyable IDs, never raw malformed inputs", () => {
    const { container } = render(<TestingGroundsPreview />); select("blocked");
    const health = within(screen.getByRole("region", { name: "Data health" }));
    for (const name of ["Valid zero", "Missing", "Null", "Missing field", "Null value", "Malformed value", "Duplicate identity", "Stale observation", "Invalid identity", "Unit mismatch", "Strength mismatch", "Historically unavailable", "Availability unknown", "Later capture"]) {
      expect(health.getByText(name)).toBeTruthy();
    }
    expect(health.getByText("Reconstructed-history diagnostic")).toBeTruthy();
    expect(health.getByText(/No automatic repairs or exclusions/)).toBeTruthy();
    expect(health.getByText("/db/runner")).toBeTruthy();
    const fields = health.getAllByRole("textbox", { hidden: true }) as HTMLTextAreaElement[];
    expect(fields.every(field => field.readOnly)).toBe(true);
    expect(fields.some(field => field.value.includes("invalid identity withheld"))).toBe(true);
    expect(fields.some(field => field.value.includes("Player 7 / game 9001"))).toBe(true);
    expect(container.textContent).not.toMatch(/unsafe-raw-fixture-value|unsafe-private-identity|unsafe-private-unit/);
    expect(fields.map(field => field.value).join()).not.toContain("unsafe-");
    expect(container.querySelector("a[href]" )).toBeNull(); // Manual path only; no hosted navigation in standalone preview.
  });

  it("rejects poisoned or inconsistent operational envelopes without reflecting values or errors", () => {
    const snapshot = createPreviewFixture("predicting").snapshot!;
    for (const value of [{ ...snapshot, scores: { secret: "sealed-score-marker" } },
      { ...snapshot, stages: [{ ...snapshot.stages[0], log: "private-log-marker" }] },
      { ...snapshot, recordedAt: "not-a-time-private-marker" }]) {
      const { container, unmount } = render(<OperationalProgressPanel snapshot={value} now={PREVIEW_NOW} />);
      expect(screen.getByRole("alert").textContent).toContain("could not be validated");
      expect(container.textContent).not.toMatch(/marker|Zod|issues|stack/);
      expect(container.querySelector("pre")).toBeNull(); unmount();
    }
  });

  it("keeps queued work at zero and gives the empty state no fabricated health report", () => {
    render(<TestingGroundsPreview />); select("queued");
    for (const bar of screen.getAllByRole("progressbar")) expect(bar.getAttribute("value")).toBe("0");
    select("empty");
    expect(screen.getByRole("heading", { name: "No run selected" })).toBeTruthy();
    expect(screen.queryByRole("region", { name: "Data health" })).toBeNull();
    expect(screen.queryByRole("progressbar")).toBeNull();
    expect(screen.getByText(/No experiment or health report has been created/)).toBeTruthy();
  });

  it.each([
    [999, 1_000, "99.9% complete"],
    [9_999, 10_000, "Less than 100% complete"],
    [Number.MAX_SAFE_INTEGER - 1, Number.MAX_SAFE_INTEGER, "Less than 100% complete"],
    [10_000, 10_000, "100.0% complete"],
  ] as const)("completion boundary: %s / %s preserves exact counts and accessible incomplete status", (processed, eligible, label) => {
    const fixture = createPreviewFixture("predicting"), snapshot = fixture.snapshot!;
    const counted = snapshot.stages[2]; if (counted.kind === "fitting") throw new Error("Counted fixture required.");
    counted.denominator.eligible = eligible;
    counted.counts = { successful: processed, skipped: 0, failed: 0, pending: eligible - processed };
    snapshot.stages = [counted];
    const expected = projectOperationalProgress(snapshot, { now: fixture.now, staleAfterMs: 90_000 });
    render(<OperationalProgressPanel snapshot={snapshot} now={fixture.now} />);
    expect(screen.getByText(label)).toBeTruthy();
    const bar = screen.getByRole("progressbar");
    expect(bar.getAttribute("value")).toBe(String(processed));
    expect(bar.getAttribute("max")).toBe(String(eligible));
    expect(bar.getAttribute("aria-valuetext")).toBe(`${processed.toLocaleString("en-US")} of ${eligible.toLocaleString("en-US")} player-games processed; ${(eligible - processed).toLocaleString("en-US")} pending. ${processed === eligible ? "All declared work processed." : "Work is incomplete."}`);
    if (processed < eligible) expect(screen.queryByText("100.0% complete")).toBeNull();
    expect(JSON.parse(screen.getByLabelText("Operational snapshot JSON").textContent!)).toEqual(expected);
  });
});

describe("Testing Grounds saved-run listing", () => {
  const panel = () => within(screen.getByRole("region", { name: "Saved runs" }));
  it("shows validated saved runs with states, events, counts and sealing", () => {
    render(<TestingGroundsPreview />);
    const runs = panel().getAllByRole("listitem");
    expect(runs.map(run => within(run).getByRole("heading").textContent)).toEqual(["Run 0023", "Run 0022", "Run 0021"]);
    expect(within(runs[0]).getByText("Running")).toBeTruthy();
    expect(within(runs[0]).getByText(/Step started · revision 4/)).toBeTruthy();
    expect(within(runs[0]).getByText("1 / 2")).toBeTruthy();
    expect(within(runs[1]).getByText("Completed · results sealed")).toBeTruthy();
    expect(within(runs[2]).getByText(/Cancelled · revision 3/)).toBeTruthy();
    for (const run of runs) expect(within(run).getByText(/not durable.*Results sealed\./)).toBeTruthy();
    expect(panel().queryByRole("button")).toBeNull();
  });
  it("shows an empty state", () => {
    render(<RunHistoryPanel listing={{ runs: [] }} />);
    expect(screen.getByText("No saved runs yet.")).toBeTruthy();
  });
  it.each<[string, (listing: ReturnType<typeof createHistoryFixture>) => unknown]>([
    ["an unknown run field", listing => ({ runs: [{ ...listing.runs[0], unsafeMarker: "SYNTHETIC_OUTCOME" }] })],
    ["an unknown listing field", listing => ({ ...listing, unsafeMarker: "SYNTHETIC_OUTCOME" })],
    ["free-form event text", listing => ({ runs: [{ ...listing.runs[0], lastEvent: "SYNTHETIC_OUTCOME" }] })],
    ["unreconciled counts", listing => ({ runs: [{ ...listing.runs[0], stages: listing.runs[0].stages.map(stage => ({ ...stage, successful: stage.total })) }] })],
    ["more runs than the listing cap", listing => ({ runs: Array.from({ length: MAX_LISTED_RUNS + 1 }, () => listing.runs[2]) })],
    ["a non-object", () => "SYNTHETIC_OUTCOME"],
  ])("refuses a listing with %s without reflecting it", (_label, poison) => {
    render(<RunHistoryPanel listing={poison(createHistoryFixture())} />);
    expect(screen.getByRole("alert").textContent).toBe("Saved runs are unavailable. The listing could not be validated.");
    expect(document.body.textContent).not.toContain("SYNTHETIC_OUTCOME");
    expect(screen.queryByRole("listitem")).toBeNull();
  });
});
