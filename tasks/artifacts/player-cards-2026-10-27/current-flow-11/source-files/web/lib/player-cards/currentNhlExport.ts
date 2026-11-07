import { rasterizeCardSvg } from "./shareExport";
import { currentCardKey } from "../../components/player-cards/CurrentPlayerCard";
import { CURRENT_NHL_DEFINITIONS, currentNhlRows, type CurrentNhlCard, type CurrentNhlFormat } from "./currentNhl";

export function assertCurrentNhlExport(svg: SVGSVGElement, card: CurrentNhlCard, format: CurrentNhlFormat) {
  if (!svg.isConnected || card.state !== "ready" || card.sample.gp === null || card.sample.toiSeconds === null || svg.dataset.currentKey !== currentCardKey(card, format) || svg.dataset.source !== card.source || svg.dataset.cardFormat !== format || svg.querySelector("image")) throw new Error("The qualified displayed snapshot changed or is unavailable. Retry this card.");
}
export const rasterizeCurrentNhlCard = (svg: SVGSVGElement, card: CurrentNhlCard, format: CurrentNhlFormat): Promise<Blob> => rasterizeCardSvg(svg, () => assertCurrentNhlExport(svg, card, format), 1200, 1020);

/** Selected snapshot only; alternate cached windows never leak into its reproducibility manifest. */
export function currentNhlManifest(card: CurrentNhlCard, format: CurrentNhlFormat) {
  const { windows: _windows, ...selected } = card;
  return { renderVersion: "fhfh-current-card-v1", card: selected, format, selectedMetrics: currentNhlRows(format), definitions: CURRENT_NHL_DEFINITIONS, inputHashScope: "Source paths and selected normalized game inputs; no raw-response hash or exact end-time claim" };
}
