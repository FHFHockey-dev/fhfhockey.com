import React from "react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import PlayerAnalysisStudio from "./PlayerAnalysisStudio";
import { captureFixture, goalieFixture, sharedGoalieFixture } from "../../lib/player-cards/analysisFixtures";
import { sharedGoalieOutlook } from "../../lib/player-cards/sharedGoalieOutlook";
import { assertAnalysisExport, analysisManifest } from "../../lib/player-cards/analysisExport";
import { buildAnalysisSnapshot } from "../../lib/player-cards/analysisSnapshot";
import { cardBlshEvidence, cardTradeContext } from "../../lib/player-cards/analysisEvidence";
import PlayerAnalysisCard, { type AnalysisPresentation } from "./PlayerAnalysisCard";
afterEach(cleanup);
const skater = () => ({ id: "skater", label: "Fixture skater · TBL · 2026–27", capture: captureFixture() });
const goalie = { id: "goalie", label: "Fixture goalie · TBL · 2026–27", goalie: { id: 8476883, name: "Fixture goalie", team: "TBL", season: 20262027 }, inventory: null };
describe("analysis studio", () => {
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
