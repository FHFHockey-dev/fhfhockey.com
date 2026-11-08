import { afterEach, expect, it, vi } from "vitest";
import type { ObservedCardView } from "./observedView";
import { assertObservedCardExport, rasterizeObservedCard } from "./observedExport";

afterEach(() => { vi.restoreAllMocks(); vi.unstubAllGlobals(); });
// Fabricated presentation control; no real source admission or NHL values.
function fixture() {
  const svg = document.createElementNS("http://www.w3.org/2000/svg", "svg");
  Object.assign(svg.dataset, { snapshotId: "synthetic-export-control", source: "local-observed", exportable: "true" });
  const view = { id: "synthetic-export-control", source: "local-observed", evidenceState: "incomplete", exportable: true, sample: { gp: 1, toiSeconds: 0 }, readings: [{ id: "atoi", value: 0, state: "valid", rank: null }] } as ObservedCardView;
  return { svg, view };
}
it("allows a verified zero-exposure control but blocks unknown GP, TOI or all-missing values", () => {
  const { svg, view } = fixture(); expect(() => assertObservedCardExport(svg, view)).not.toThrow();
  expect(() => assertObservedCardExport(svg, { ...view, sample: { ...view.sample, gp: null } })).toThrow("sample context");
  expect(() => assertObservedCardExport(svg, { ...view, sample: { ...view.sample, toiSeconds: null } })).toThrow("sample context");
  expect(() => assertObservedCardExport(svg, { ...view, readings: view.readings.map(row => ({ ...row, value: null, state: "missing" })) })).toThrow("metric values");
});
it("rejects stale displayed snapshots and unverified artwork", () => {
  const { svg, view } = fixture(); svg.dataset.snapshotId = "changed";
  expect(() => assertObservedCardExport(svg, view)).toThrow("changed"); svg.dataset.snapshotId = view.id;
  svg.append(document.createElementNS("http://www.w3.org/2000/svg", "image"));
  expect(() => assertObservedCardExport(svg, view)).toThrow("artwork");
});
it("rechecks the observed snapshot after async image decoding before any canvas output", async () => {
  const { svg, view } = fixture(); let image!: { onload: () => void };
  vi.stubGlobal("URL", { createObjectURL: () => "blob:control", revokeObjectURL: vi.fn() });
  vi.stubGlobal("Image", class { onload = () => {}; set src(_value: string) { image = this; } });
  const promise = rasterizeObservedCard(svg, view);
  view.sample.gp = null; image.onload();
  await expect(promise).rejects.toThrow("sample context");
});
