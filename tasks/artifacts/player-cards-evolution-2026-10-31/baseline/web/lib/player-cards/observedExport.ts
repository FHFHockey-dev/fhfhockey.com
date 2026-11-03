import type { ObservedCardView } from "./observedView";
import { rasterizeCardSvg } from "./shareExport";

export function assertObservedCardExport(svg: SVGSVGElement, view: ObservedCardView) {
  if (view.source !== "local-observed" || !["eligible", "incomplete"].includes(view.evidenceState) || !view.exportable || view.sample.gp === null || view.sample.toiSeconds === null || !view.readings.some(row => row.state === "valid")) throw new Error("Verified sample context and metric values are required to export");
  if (svg.dataset.snapshotId !== view.id || svg.dataset.source !== view.source || svg.dataset.exportable !== "true") throw new Error("The displayed observed card changed. Retry this snapshot");
  if (svg.querySelector("image")) throw new Error("Observed artwork must be separately verified before export");
}

/** Text/SVG observed card; unverified sample context never reaches rasterization. */
export function rasterizeObservedCard(svg: SVGSVGElement, view: ObservedCardView): Promise<Blob> {
  return rasterizeCardSvg(svg, () => assertObservedCardExport(svg, view), 1200, 1020);
}
