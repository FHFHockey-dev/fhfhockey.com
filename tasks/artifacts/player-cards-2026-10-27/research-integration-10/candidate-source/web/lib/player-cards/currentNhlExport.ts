import { rasterizeCardSvg } from "./shareExport";
import { currentCardKey } from "../../components/player-cards/CurrentPlayerCard";
import type { CurrentNhlCard, CurrentNhlFormat } from "./currentNhl";

export function assertCurrentNhlExport(svg: SVGSVGElement, card: CurrentNhlCard, format: CurrentNhlFormat) {
  if (card.playerResearchSnapshot) throw new Error("Historical research must use its separately dated research card, not current NHL results.");
  if (card.state !== "ready" || card.sample.gp === null || card.sample.toiSeconds === null || svg.dataset.currentKey !== currentCardKey(card, format) || svg.dataset.source !== card.source || svg.dataset.cardFormat !== format || svg.querySelector("image")) throw new Error("The qualified displayed snapshot changed or is unavailable. Retry this card.");
}
export const rasterizeCurrentNhlCard = (svg: SVGSVGElement, card: CurrentNhlCard, format: CurrentNhlFormat): Promise<Blob> => rasterizeCardSvg(svg, () => assertCurrentNhlExport(svg, card, format), 1200, 1020);
