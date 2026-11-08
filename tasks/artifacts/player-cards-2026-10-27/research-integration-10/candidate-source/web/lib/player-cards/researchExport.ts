import { researchBinding, researchCardKey, type ResearchHost } from "./researchSnapshot";
import { rasterizeCardSvg } from "./shareExport";
export function assertResearchExport(svg: SVGSVGElement, card: ResearchHost) {
  const binding = researchBinding(card);
  if (!binding || svg.dataset.researchKey !== researchCardKey(card) || svg.dataset.researchManifest !== binding.manifestSha256 || svg.dataset.researchFixture !== binding.fixtureSha256 || svg.querySelector("image")) throw new Error("The manifest-bound historical research card changed. Retry this example.");
}
export const rasterizeResearchCard = (svg: SVGSVGElement, card: ResearchHost): Promise<Blob> => rasterizeCardSvg(svg, () => assertResearchExport(svg, card), 1200, 1200);
