import { cleanup, fireEvent, render, screen, within } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import TestingGroundsPreview, { OperationalProgressPanel } from "../../../../web/lib/forge-testing-grounds/preview/TestingGroundsPreview";
import * as fixtures from "../../../../web/lib/forge-testing-grounds/preview/previewFixtures";

const stage = (name: string) => screen.getByRole("heading", { name }).closest("li")!;
const change = (value: string) => fireEvent.change(screen.getByRole("combobox", { name: "Preview state" }), { target: { value } });
function oneStage(eligible: number, counts: { successful: number; skipped: number; failed: number; pending: number }, kind = "player_game_predictions", status = "running") {
  const base = fixtures.createPreviewFixture("predicting").snapshot!;
  return { ...base, state: status === "failed" ? "failed" : "running", stages: [{
    stageId: "77777777-7777-4777-8777-777777777777", kind, status,
    startedAt: "2026-09-02T12:04:00Z", heartbeatAt: "2026-09-02T12:07:00Z", finishedAt: status === "failed" ? "2026-09-02T12:08:00Z" : null,
    denominator: { manifestHash: "a".repeat(64), eligibilityRuleHash: "b".repeat(64), eligible, excludedBeforeStage: 3 }, counts,
  }] };
}
afterEach(() => { cleanup(); vi.restoreAllMocks(); vi.unstubAllGlobals(); });

describe("Independent preview DOM boundaries", () => {
  it("does not round unresolved work into a displayed 100 percent completion [S04-R1]", () => {
    const snapshot = oneStage(10_000, { successful: 9_999, skipped: 0, failed: 0, pending: 1 });
    render(<OperationalProgressPanel snapshot={snapshot} now={fixtures.PREVIEW_NOW} />);
    const bar = screen.getByRole("progressbar"); expect(bar.getAttribute("value")).toBe("9999"); expect(bar.getAttribute("max")).toBe("10000");
    expect(within(stage("Player-game predictions")).queryByText("100.0% complete")).toBeNull();
  });
  it("keeps zero totals, pending outcomes and all-failed processing distinct from successful completion", () => {
    const zero = render(<OperationalProgressPanel snapshot={oneStage(0, { successful: 0, skipped: 0, failed: 0, pending: 0 })} now={fixtures.PREVIEW_NOW} />);
    expect(screen.getByText("No eligible units")).toBeTruthy(); expect(screen.queryByRole("progressbar")).toBeNull(); zero.unmount();
    const pending = render(<OperationalProgressPanel snapshot={oneStage(2, { successful: 0, skipped: 0, failed: 0, pending: 2 }, "evaluation_tasks")} now={fixtures.PREVIEW_NOW} />);
    expect(screen.getByText("0.0% complete")).toBeTruthy();
    const pendingItem = stage("Evaluation tasks"); expect(pendingItem.querySelector("dt")?.textContent).toBe("Successful");
    expect(Array.from(pendingItem.querySelectorAll("dd")).map(n => n.textContent)).toEqual(["0", "0", "0", "2"]); pending.unmount();
    render(<OperationalProgressPanel snapshot={oneStage(2, { successful: 0, skipped: 0, failed: 2, pending: 0 }, "evaluation_tasks", "failed")} now={fixtures.PREVIEW_NOW} />);
    expect(screen.getByText("100.0% complete")).toBeTruthy(); expect(screen.queryByText("Completed")).toBeNull();
    expect(Array.from(stage("Evaluation tasks").querySelectorAll("dd")).map(n => n.textContent)).toEqual(["0", "0", "2", "0"]);
  });
  it("fails closed on HTML/score poison at every operational envelope level without reflecting JSON or markup", () => {
    const base = fixtures.createPreviewFixture("predicting").snapshot!;
    const marker = '<img src="https://private.invalid/x" onerror="STEAL()"></pre><script>SEALED_ATTACK</script>';
    const counted = base.stages[0]; if (counted.kind === "fitting") throw new Error("counted fixture");
    for (const snapshot of [
      { ...base, scores: marker }, { ...base, stages: [{ ...counted, output: marker }] },
      { ...base, stages: [{ ...counted, denominator: { ...counted.denominator, privateScore: marker } }] },
      { ...base, stages: [{ ...counted, counts: { ...counted.counts, probability: marker } }] },
      { ...base, recordedAt: marker },
    ]) {
      const result = render(<OperationalProgressPanel snapshot={snapshot} now={fixtures.PREVIEW_NOW} />);
      expect(screen.getByRole("alert").textContent).toContain("could not be validated");
      expect(result.container.textContent).not.toMatch(/SEALED_ATTACK|STEAL|private\.invalid/);
      expect(result.container.querySelector("script, img, pre, iframe")).toBeNull(); result.unmount();
    }
  });
  it("renders health guidance as text even when a report string contains markup", () => {
    const original = fixtures.createPreviewFixture;
    const blocked = original("blocked"); if (!blocked.health) throw new Error("health fixture");
    const marker = '<svg onload="STEAL()">SYNTHETIC_MARKUP</svg>';
    blocked.health.issues[0].expected = marker; blocked.health.issues[0].guidance = marker;
    vi.spyOn(fixtures, "createPreviewFixture").mockReturnValue(blocked);
    const { container } = render(<TestingGroundsPreview />);
    expect(container.textContent).toContain(marker); expect(container.querySelector("svg, script, [onload], [onerror]")).toBeNull();
    expect(container.innerHTML).toContain("&lt;svg");
  });
  it("keeps no-report, blocked report, failed work and pending evaluation meanings separate", () => {
    render(<TestingGroundsPreview />); change("empty");
    expect(screen.queryByRole("region", { name: "Data health" })).toBeNull(); expect(screen.getByText(/No experiment or health report has been created/)).toBeTruthy();
    change("blocked"); const blocked = within(screen.getByRole("region", { name: "Data health" }));
    expect(blocked.getByText("Blocked")).toBeTruthy(); expect(blocked.getByText("Valid zero")).toBeTruthy(); expect(blocked.getByText("Missing")).toBeTruthy(); expect(blocked.getByText("Null")).toBeTruthy();
    change("failed"); const health = within(screen.getByRole("region", { name: "Data health" }));
    expect(health.getByText("Checked with warnings")).toBeTruthy(); expect(health.queryByText("Blocked")).toBeNull();
    const evaluation = stage("Evaluation tasks"); expect(Array.from(evaluation.querySelectorAll("dd")).map(n => n.textContent)).toEqual(["0", "0", "0", "12"]);
    expect(screen.getByRole("region", { name: "Sealed results" }).textContent).toContain("Results stay sealed");
  });
  it("performs no network, navigation or storage mutation across every labeled fixture and exposes only operational JSON", () => {
    const fetcher = vi.fn(), xhr = vi.fn(), socket = vi.fn(), beacon = vi.fn(), open = vi.fn();
    vi.stubGlobal("fetch", fetcher); vi.stubGlobal("XMLHttpRequest", xhr); vi.stubGlobal("WebSocket", socket); vi.stubGlobal("open", open);
    Object.defineProperty(navigator, "sendBeacon", { configurable: true, value: beacon });
    const set = vi.spyOn(Storage.prototype, "setItem"), remove = vi.spyOn(Storage.prototype, "removeItem");
    const { container } = render(<TestingGroundsPreview />);
    for (const scenario of fixtures.previewScenarios) {
      change(scenario.id); expect(screen.getByText("Synthetic preview")).toBeTruthy();
      const launch = screen.getByRole("button", { name: "Launch unavailable" }) as HTMLButtonElement; expect(launch.disabled).toBe(true); fireEvent.click(launch);
      expect(container.querySelector("a[href], form, iframe, script[src], img[src]")).toBeNull();
      for (const pre of Array.from(container.querySelectorAll("pre"))) {
        const projection = JSON.parse(pre.textContent!); expect(projection.overallPercent).toBeNull();
        expect(projection).not.toHaveProperty("scores"); expect(projection).not.toHaveProperty("results"); expect(projection).not.toHaveProperty("payload");
      }
      expect(container.querySelector("details[open]")).toBeNull();
    }
    for (const call of [fetcher, xhr, socket, beacon, open, set, remove]) expect(call).not.toHaveBeenCalled();
  });
});
