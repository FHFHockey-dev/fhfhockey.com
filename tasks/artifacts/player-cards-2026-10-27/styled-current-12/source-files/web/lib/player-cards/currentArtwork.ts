import type { HeroSample, PreparedHero } from "../../components/player-cards/HeroPlayerCard";
import type { CurrentNhlCard } from "./currentNhl";
import { REVIEWED_HERO_SAMPLES } from "./reviewedHeroSamples";
import { portraitKey } from "./portraitTreatment";
import { assertReviewedArtwork } from "./shareExport";

export const CURRENT_IMAGE_UNAVAILABLE = "A verified matching player image is unavailable.";
export function reviewedHeroFor(player: CurrentNhlCard["player"]): HeroSample | undefined {
  return REVIEWED_HERO_SAMPLES.find(sample => sample.id === player.id && sample.team === player.team && sample.acceptance === "accepted");
}
export function assertCurrentHero(card: CurrentNhlCard, hero: PreparedHero) {
  const sample = reviewedHeroFor(card.player);
  if (!sample || Object.entries(sample).some(([key, value]) => hero[key as keyof HeroSample] !== value)) throw new Error("Artwork does not match the selected player, team and reviewed source.");
}
export function currentArtworkKey(hero?: PreparedHero | null) {
  return hero ? `${hero.id}:${hero.team}:${hero.alphaSha256}:${portraitKey(hero)}` : "image-unavailable";
}
export function assertCurrentArtwork(svg: SVGSVGElement, card: CurrentNhlCard, hero?: PreparedHero | null) {
  if (svg.dataset.currentArtworkKey !== currentArtworkKey(hero)) throw new Error("The displayed artwork changed. Retry this snapshot.");
  if (hero) { assertCurrentHero(card, hero); assertReviewedArtwork(svg, hero); }
  else if (svg.querySelector("image") || !svg.querySelector('[data-artwork-unavailable="true"]')) throw new Error("Unavailable artwork must not contain a substitute image.");
}
export function currentArtworkManifest(card: CurrentNhlCard, hero?: PreparedHero | null) {
  if (!hero) return { state: "unavailable", reason: CURRENT_IMAGE_UNAVAILABLE, playerId: card.player.id, team: card.player.team };
  assertCurrentHero(card, hero);
  const { dataUrl: _dataUrl, teamLogo, outline, ...source } = hero;
  return { state: "reviewed-local", ...source, teamLogo: teamLogo ? { ...teamLogo, dataUrl: undefined } : undefined, outline: outline ? { ...outline, dataUrl: undefined } : undefined,
    geometry: { playerX: 600, playerY: 4, playerWidth: 600, headerHeight: 338, logoX: 840, logoY: -100, logoSize: 480 }, outlineAlignment: "outward; final export pixels; inner to outer", logoMask: "alpha 0 at left edge, 1 at 25%, 1 through right edge; logo only" };
}
