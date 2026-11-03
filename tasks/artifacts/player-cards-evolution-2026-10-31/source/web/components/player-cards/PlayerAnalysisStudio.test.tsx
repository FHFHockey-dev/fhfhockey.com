import React from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import PlayerAnalysisStudio from "./PlayerAnalysisStudio";
import { captureFixture, goalieFixture, sharedGoalieFixture } from "../../lib/player-cards/analysisFixtures";
import { sharedGoalieOutlook } from "../../lib/player-cards/sharedGoalieOutlook";
import { assertAnalysisExport, analysisManifest, canExportAnalysis } from "../../lib/player-cards/analysisExport";
import { buildAnalysisSnapshot } from "../../lib/player-cards/analysisSnapshot";
import { cardBlshEvidence, cardTradeContext, type CardEvidence } from "../../lib/player-cards/analysisEvidence";
import PlayerAnalysisCard, { type AnalysisPresentation } from "./PlayerAnalysisCard";
const originalBBox = Object.getOwnPropertyDescriptor(SVGElement.prototype, "getBBox");
// jsdom has no layout engine; real text widths are exercised by the offline browser check.
beforeEach(() => Object.defineProperty(SVGElement.prototype, "getBBox", { configurable: true, value: () => ({ x: 40, y: 400, width: 900, height: 29 }) }));
afterEach(() => { cleanup(); if (originalBBox) Object.defineProperty(SVGElement.prototype, "getBBox", originalBBox); else Reflect.deleteProperty(SVGElement.prototype, "getBBox"); });
const skater = () => ({ id: "skater", label: "Fixture skater · TBL · 2026–27", capture: captureFixture() });
const goalie = { id: "goalie", label: "Fixture goalie · TBL · 2026–27", goalie: { id: 8476883, name: "Fixture goalie", team: "TBL", season: 20262027 }, inventory: null };
describe("analysis studio", () => {
  it("prints the approved known-short GP warning and preserves it in the exported snapshot", () => {
    const snapshot = buildAnalysisSnapshot(captureFixture(3), { period: { mode: "appearances", count: 5 }, baseline: "season", basis: "per-game", visual: "bars" });
    const p: AnalysisPresentation = { snapshot, view: "comparison", blsh: cardBlshEvidence(snapshot, null, null), trades: cardTradeContext(snapshot.capture.player.id, [], { fixture: true, ownerReceipt: null, asOf: snapshot.capture.observedAt }) };
    const { rerender } = render(<PlayerAnalysisCard presentation={p} />);
    const svg = screen.getByRole("img") as unknown as SVGSVGElement;
    expect(svg.textContent).toContain("3 of 5 appearances"); expect(svg.getAttribute("aria-label")).toContain("verified complete season history");
    expect(() => assertAnalysisExport(svg, p)).not.toThrow();
    const manifest = analysisManifest(p);
    expect(manifest.presentation.snapshot.rankPolicy).toMatchObject({ status: "approved", ties: "competition", percentile: "midrank" });
    expect(manifest.presentation.snapshot.recent).toMatchObject({ gp: 3, requestedAppearances: 5, knownShort: true });
    const incomplete = captureFixture(3); incomplete.games.pop(); p.snapshot = buildAnalysisSnapshot(incomplete, snapshot.settings);
    rerender(<PlayerAnalysisCard presentation={p} />);
    expect(svg.textContent).not.toContain("verified complete season history"); expect(() => assertAnalysisExport(svg, p)).toThrow(/Unqualified capture/);
  });
  it("exports separate retained research while keeping unsupported NHL analysis blocked", () => {
    const capture = captureFixture(); capture.history.complete = false;
    const snapshot = buildAnalysisSnapshot(capture, { period: { mode: "appearances", count: 5 }, baseline: "previous", basis: "per-game", visual: "bars" });
    const p: AnalysisPresentation = { snapshot, view: "categories", blsh: cardBlshEvidence(snapshot, null, null), trades: cardTradeContext(capture.player.id, [], { fixture: true, ownerReceipt: null, asOf: capture.observedAt }) };
    expect(canExportAnalysis(p)).toBe(false);
    p.view = "evidence";
    expect(canExportAnalysis(p)).toBe(false);
    p.blsh = { status: "exploratory", heading: "Synthetic retained-research export fixture", lines: ["Separate dated research; source comparisons do not change saved values."], direction: "unknown", receipt: null, market: "Market reference unavailable", retained: { snapshotSHA256: "unit-test-only", reviewReference: "Synthetic unit receipt", asOfUTC: capture.observedAt, eventThroughDate: "2026-10-24", dates: ["2026-10-24"], methodVersion: "test-only", profile: { playerId: capture.player.id, team: capture.player.team }, limits: [] } as unknown as NonNullable<CardEvidence["retained"]> };
    const { rerender } = render(<PlayerAnalysisCard presentation={p} />);
    const svg = screen.getByRole("img") as unknown as SVGSVGElement;
    expect(canExportAnalysis(p)).toBe(true); expect(() => assertAnalysisExport(svg, p)).not.toThrow();
    expect(analysisManifest(p).presentation.snapshot.recent.reason).toBeTruthy();
    p.view = "comparison"; rerender(<PlayerAnalysisCard presentation={p} />);
    expect(canExportAnalysis(p)).toBe(false); expect(() => assertAnalysisExport(svg, p)).toThrow(/Unqualified capture/);
    p.view = "evidence"; p.blsh.retained!.profile.playerId = 1;
    expect(canExportAnalysis(p)).toBe(false);
    p.blsh.retained!.profile.playerId = capture.player.id; p.blsh.status = "unavailable";
    expect(canExportAnalysis(p)).toBe(false);
  });
  it("prints confirmation gaps on the card and refuses an export that omits long warnings", () => {
    const input = sharedGoalieFixture();
    const warnings = ["Reports aren't separated by reporter, so conflicts between sources can't be detected.", "No source link or expiry exists for these reports."];
    input.sources[0].reasons = warnings;
    const p: AnalysisPresentation = { goalie: sharedGoalieOutlook(input, goalieFixture().player, "fixture"), gameIndex: 0 };
    const { rerender } = render(<PlayerAnalysisCard presentation={p} />);
    const svg = screen.getByRole("img") as unknown as SVGSVGElement;
    expect(svg.querySelector('[data-confirmation-warnings="true"]')?.textContent).toContain("conflicts between sources can't be detected");
    expect(svg.getAttribute("aria-label")).toContain(warnings[1]);
    expect(() => assertAnalysisExport(svg, p)).not.toThrow();
    expect(analysisManifest(p).presentation.goalie.sharedProvenance.confirmationWarnings).toEqual(warnings);
    p.goalie.sharedProvenance!.confirmationWarnings = ["Unresolved source limitation. ".repeat(30)];
    rerender(<PlayerAnalysisCard presentation={p} />);
    expect(() => assertAnalysisExport(svg, p)).toThrow(/Full evidence/);
  });
  it("rejects the audited unbroken warning URL while preserving full evidence outside the PNG", () => {
    const input = sharedGoalieFixture(), warning = "https://example.test/" + "w".repeat(300);
    input.sources[0].reasons = [warning];
    const p: AnalysisPresentation = { goalie: sharedGoalieOutlook(input, goalieFixture().player, "fixture"), gameIndex: 0 };
    render(<PlayerAnalysisCard presentation={p} />);
    const svg = screen.getByRole("img") as unknown as SVGSVGElement;
    const text = svg.querySelector('[data-confirmation-warnings="true"]')!;
    expect(text.getAttribute("data-evidence-truncated")).toBe("true");
    expect(text.textContent).toContain("PNG export is unavailable");
    expect([...text.querySelectorAll("tspan")].every(line => !!line.textContent)).toBe(true);
    expect(svg.getAttribute("aria-label")).toContain(warning);
    expect(analysisManifest(p).presentation.goalie.sharedProvenance.confirmationWarnings).toEqual([warning]);
    expect(() => assertAnalysisExport(svg, p)).toThrow(/Full evidence/);
  });
  it("checks rendered evidence width even when character wrapping does not flag truncation", () => {
    const input = sharedGoalieFixture(); input.sources[0].reasons = ["W".repeat(120)];
    const p: AnalysisPresentation = { goalie: sharedGoalieOutlook(input, goalieFixture().player, "fixture"), gameIndex: 0 };
    render(<PlayerAnalysisCard presentation={p} />);
    const svg = screen.getByRole("img") as unknown as SVGSVGElement, text = svg.querySelector('[data-confirmation-warnings="true"]')!;
    expect(svg.querySelector('[data-evidence-truncated="true"]')).toBeNull();
    for (const width of [1120, 1121, NaN, 0]) {
      Object.defineProperty(text, "getBBox", { configurable: true, value: () => ({ width }) });
      if (width === 1120) expect(() => assertAnalysisExport(svg, p)).not.toThrow();
      else expect(() => assertAnalysisExport(svg, p)).toThrow(/Full evidence/);
    }
    Object.defineProperty(text, "getBBox", { configurable: true, value: undefined });
    expect(() => assertAnalysisExport(svg, p)).toThrow(/bounds are unavailable/);
  });
  it("offers explicit optional season comparison, preserves baseline default and makes no requests", () => {
    const network = vi.spyOn(globalThis, "fetch"); render(<PlayerAnalysisStudio selections={[skater(), goalie]} />);
    fireEvent.change(screen.getByLabelText("Analysis view"), { target: { value: "comparison" } });
    expect((screen.getByLabelText("Comparison baseline") as HTMLSelectElement).value).toBe("previous");
    fireEvent.change(screen.getByLabelText("Comparison baseline"), { target: { value: "season" } });
    expect(screen.getAllByText(/Season includes recent games/).length).toBeGreaterThan(0);
    fireEvent.change(screen.getByLabelText("Window"), { target: { value: "20" } });
    expect((screen.getByLabelText("Comparison baseline") as HTMLSelectElement).value).toBe("previous");
    expect(network).not.toHaveBeenCalled(); network.mockRestore();
  });
  it("clears skater values when searching or choosing an unsupported goalie", () => {
    render(<PlayerAnalysisStudio selections={[skater(), goalie]} />);
    fireEvent.change(screen.getByLabelText("Search supplied players"), { target: { value: "goalie" } });
    expect(screen.queryByRole("img")).toBeNull();
    fireEvent.change(screen.getByLabelText("Player"), { target: { value: "goalie" } });
    expect(screen.getByRole("img").getAttribute("aria-label")).toContain("Goalie outlook");
    expect((screen.getByText("Download analysis PNG") as HTMLButtonElement).disabled).toBe(true);
  });
  it("rejects a prepared share after a control change, including an in-flight export", async () => {
    let resolve!: (b: Blob) => void; const rasterize = vi.fn(() => new Promise<Blob>(r => { resolve = r; }));
    render(<PlayerAnalysisStudio selections={[skater()]} rasterize={rasterize} />);
    fireEvent.click(screen.getByText("Prepare analysis share"));
    fireEvent.change(screen.getByLabelText("Value basis"), { target: { value: "total" } });
    resolve(new Blob(["png"], { type: "image/png" }));
    await waitFor(() => expect((screen.getByText("Prepare analysis share") as HTMLButtonElement).disabled).toBe(false));
    expect((screen.getByText("Share prepared image") as HTMLButtonElement).disabled).toBe(true);
  });
  it("exports the same snapshot and rejects stale or altered selection", () => {
    const snapshot = buildAnalysisSnapshot(captureFixture(), { period: { mode: "appearances", count: 5 }, baseline: "season", basis: "per-game", visual: "bars" });
    const p: AnalysisPresentation = { snapshot, view: "comparison", blsh: cardBlshEvidence(snapshot, null, null), trades: cardTradeContext(8476453, [], { fixture: true, ownerReceipt: null, asOf: snapshot.capture.observedAt }) };
    render(<PlayerAnalysisCard presentation={p} />); const svg = screen.getByRole("img") as unknown as SVGSVGElement;
    expect(() => assertAnalysisExport(svg, p)).not.toThrow();
    const manifest = analysisManifest(p); expect(manifest.presentation.snapshot.overlap).toBe(5);
    const overflow = document.createElementNS("http://www.w3.org/2000/svg", "text"); overflow.setAttribute("data-evidence-truncated", "true"); svg.appendChild(overflow);
    expect(() => assertAnalysisExport(svg, p)).toThrow(/Full evidence/); overflow.remove();
    p.snapshot.settings.baseline = "previous"; expect(() => assertAnalysisExport(svg, p)).toThrow(/changed/); expect(manifest.presentation.snapshot.settings.baseline).toBe("season");
  });
});
