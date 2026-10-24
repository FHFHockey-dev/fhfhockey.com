import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";
import { OperationalProgressPanel } from "../../../../web/lib/forge-testing-grounds/preview/TestingGroundsPreview";
import { createPreviewFixture } from "../../../../web/lib/forge-testing-grounds/preview/previewFixtures";
import { projectOperationalProgress } from "../../../../web/lib/forge-testing-grounds/operationalProgress";
afterEach(cleanup);
function frame(eligible: number, counts: { successful: number; skipped: number; failed: number; pending: number }, state: "running" | "failed" | "queued" = "running") {
  const fixture = createPreviewFixture("predicting"), snapshot = fixture.snapshot!;
  const stage = snapshot.stages[2]; if (stage.kind === "fitting") throw new Error("counted fixture");
  stage.denominator.eligible = eligible; stage.counts = counts; stage.status = state; snapshot.state = state;
  stage.finishedAt = state === "failed" ? fixture.now : null;
  if (state === "queued") { stage.startedAt = null; stage.heartbeatAt = null; }
  snapshot.stages = [stage]; return { snapshot, now: fixture.now };
}
function expectJsonUnchanged(input: ReturnType<typeof frame>) {
  const expected = projectOperationalProgress(input.snapshot, { now: input.now, staleAfterMs: 90_000 });
  expect(JSON.parse(screen.getByLabelText("Operational snapshot JSON").textContent!)).toEqual(expected);
}
describe("Independent corrected completion [S04-r1-review]", () => {
  it("uses all terminal work categories for incomplete visible/accessibility wording while retaining exact native and JSON values", () => {
    const input = frame(10_000, { successful: 9_990, skipped: 8, failed: 1, pending: 1 });
    render(<OperationalProgressPanel {...input} />);
    expect(screen.getByText("Less than 100% complete")).toBeTruthy(); expect(screen.queryByText("100.0% complete")).toBeNull();
    const bar = screen.getByRole("progressbar"); expect(bar.getAttribute("value")).toBe("9999"); expect(bar.getAttribute("max")).toBe("10000");
    expect(bar.getAttribute("aria-valuetext")).toBe("9,999 of 10,000 player-games processed; 1 pending. Work is incomplete."); expectJsonUnchanged(input);
  });
  it("describes full processing without labeling failures as successful", () => {
    const input = frame(10_000, { successful: 0, skipped: 1, failed: 9_999, pending: 0 }, "failed");
    const { container } = render(<OperationalProgressPanel {...input} />);
    expect(screen.getByText("100.0% complete")).toBeTruthy();
    const text = screen.getByRole("progressbar").getAttribute("aria-valuetext");
    expect(text).toBe("10,000 of 10,000 player-games processed; 0 pending. All declared work processed."); expect(text).not.toMatch(/success/i);
    expect(Array.from(container.querySelectorAll("dd")).map(n => n.textContent)).toEqual(["0", "1", "9,999", "0"]);
    expect(container.textContent).toContain("results stay sealed"); expectJsonUnchanged(input);
  });
  it("keeps queued zero progress explicitly incomplete with exact pending counts", () => {
    const input = frame(7, { successful: 0, skipped: 0, failed: 0, pending: 7 }, "queued");
    render(<OperationalProgressPanel {...input} />); expect(screen.getByText("0.0% complete")).toBeTruthy();
    const bar = screen.getByRole("progressbar"); expect(bar.getAttribute("value")).toBe("0"); expect(bar.getAttribute("max")).toBe("7");
    expect(bar.getAttribute("aria-valuetext")).toBe("0 of 7 player-games processed; 7 pending. Work is incomplete."); expectJsonUnchanged(input);
  });
});
