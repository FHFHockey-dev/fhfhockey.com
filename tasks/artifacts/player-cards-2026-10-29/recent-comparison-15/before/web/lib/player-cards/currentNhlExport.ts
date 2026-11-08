import type { PreparedHero } from "../../components/player-cards/HeroPlayerCard";
import { assertCurrentArtwork, currentArtworkManifest } from "./currentArtwork";
import { rasterizeCardSvg } from "./shareExport";
import { currentCardKey } from "../../components/player-cards/CurrentPlayerCard";
import { CURRENT_NHL_DEFINITIONS, currentNhlRows, type CurrentNhlCard, type CurrentNhlFormat } from "./currentNhl";

export function assertCurrentNhlExport(svg: SVGSVGElement, card: CurrentNhlCard, format: CurrentNhlFormat, hero?: PreparedHero | null) {
  if (!svg.isConnected || card.state !== "ready" || card.sample.gp === null || card.sample.toiSeconds === null || svg.dataset.currentKey !== currentCardKey(card, format, hero) || svg.dataset.source !== card.source || svg.dataset.cardFormat !== format) throw new Error("The qualified displayed snapshot changed or is unavailable. Retry this card.");
  assertCurrentArtwork(svg, card, hero);
}
export const rasterizeCurrentNhlCard = (svg: SVGSVGElement, card: CurrentNhlCard, format: CurrentNhlFormat, hero?: PreparedHero | null): Promise<Blob> => rasterizeCardSvg(svg, () => assertCurrentNhlExport(svg, card, format, hero), 1200, 1020);

/** Selected snapshot only; alternate cached windows never leak into its reproducibility manifest. */
export function currentNhlManifest(card: CurrentNhlCard, format: CurrentNhlFormat, hero?: PreparedHero | null) {
  const { windows: _windows, ...selected } = card;
  return { renderVersion: "fhfh-current-card-v2", card: selected, format, artwork: currentArtworkManifest(card, hero), selectedMetrics: currentNhlRows(format), definitions: CURRENT_NHL_DEFINITIONS, inputHashScope: "Source paths and selected normalized game inputs; no raw-response hash or exact end-time claim" };
}
