import React from "react";
import { cleanup, render } from "@testing-library/react";
import { afterEach, expect, it } from "vitest";
import { adaptLocalSnapshot, type AdaptedCard } from "../../lib/player-cards/adapter";
import { buildInteractionFixture } from "../../lib/player-cards/interactionFixtures";
import { flowSettings, INITIAL_FLOW } from "../../lib/player-cards/interactionSnapshot";
import { projectObservedCard } from "../../lib/player-cards/observedView";
import ObservedPlayerCard from "./ObservedPlayerCard";

afterEach(cleanup);
// Presentation controls use fabricated fixture counts. No real NHL value or admission is asserted.
function card(missing = true): AdaptedCard {
  const input = buildInteractionFixture(flowSettings(INITIAL_FLOW), "complete", 1001);
  const result = adaptLocalSnapshot(input, 1001);
  if (result.state === "rejected") throw new Error(result.reason);
  const copy = structuredClone(result); copy.origin = "local-observed";
  if (missing) {
    copy.state = "unavailable"; copy.selection.state = "missing";
    copy.readings = copy.readings.map(row => ({ ...row, value: null, rank: null, state: "missing", reason: "internal/receipt-path#private", rankReason: "internal/pool" }));
    for (const pool of Object.values(copy.coverage)) pool.fullEligiblePopulationVerified = false;
  }
  return copy;
}
const identity = { id: 1001, name: "Example observed player", team: "Example team" };
it("renders observed unknowns without a synthetic label, fictional values, null GP or an export claim", () => {
  const input = card(); input.snapshotId = "private/capture-id"; input.source.version = "private/source-ref";
  const view = projectObservedCard(input, identity, "incomplete", "public-snapshot")!;
  const { container } = render(<ObservedPlayerCard view={view} />);
  expect(view.exportable).toBe(false); expect(view.sample.gp).toBeNull();
  expect(container.textContent).toContain("GP unverified"); expect(container.textContent).toContain("Source unverified");
  expect(container.textContent).toContain("Export blocked");
  expect(container.textContent).not.toMatch(/synthetic|fabricated|null actual appearances/i);
  expect(JSON.stringify(view)).not.toContain("private/"); expect(JSON.stringify(view)).not.toContain("internal/");
  expect(container.querySelectorAll('[data-actual-value="true"]').length).toBe(5);
  expect(container.querySelectorAll('[data-actual-value="true"]')[0].textContent).toBe("—");
});
it("preserves qualified presentation values/ranks and labels actual percentages distinctly", () => {
  const input = card(false), view = projectObservedCard(input, identity, "eligible", "qualified-control")!;
  expect(view.exportable).toBe(true); expect(view.readings).toEqual(input.readings);
  const { container } = render(<ObservedPlayerCard view={view} />);
  expect(container.textContent).toContain("ACTUAL PERCENTAGES"); expect(container.textContent).toContain("RANK / N");
  expect(container.textContent).not.toContain("pools unverified");
  expect(container.querySelector('svg')!.getAttribute("data-source")).toBe("local-observed");
});
it("keeps legitimate undefined ratios distinct from source gaps and rejects identity mismatches", () => {
  const input = card(false), reading = input.readings.find(row => row.id === "shPct")!;
  Object.assign(reading, { value: null, rank: null, state: "undefined", reason: "Zero denominator: metric undefined" });
  const view = projectObservedCard(input, identity, "incomplete", "undefined-control")!;
  const { container } = render(<ObservedPlayerCard view={view} />);
  expect(container.querySelector('[data-metric-id="shPct"]')!.textContent).toContain("Undefined · zero denominator");
  expect(() => projectObservedCard(input, { ...identity, id: 1002 }, "incomplete", "bad")).toThrow("identity mismatch");
  expect(projectObservedCard(input, identity, "rejected", "rejected")).toBeNull();
});
