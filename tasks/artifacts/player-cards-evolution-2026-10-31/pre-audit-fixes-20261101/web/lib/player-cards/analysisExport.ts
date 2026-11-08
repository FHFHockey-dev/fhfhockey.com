import { assertReviewedArtwork, rasterizeCardSvg } from "./shareExport";
import { analysisPresentationKey, type AnalysisPresentation } from "../../components/player-cards/PlayerAnalysisCard";
import type { PreparedHero } from "../../components/player-cards/HeroPlayerCard";
import { currentArtworkKey } from "./currentArtwork";
import { analysisDifference } from "./analysisSnapshot";

export function analysisManifest(presentation: AnalysisPresentation, hero?: PreparedHero | null) {
  const artwork = hero ? { ...hero, dataUrl: undefined, teamLogo: hero.teamLogo ? { ...hero.teamLogo, dataUrl: undefined } : undefined, outline: hero.outline ? { ...hero.outline, dataUrl: undefined } : undefined } : { state: "unavailable", reason: "No qualified matching artwork supplied." };
  return JSON.parse(JSON.stringify({ version: "fhfh-analysis-export-v1", dimensions: { width: 1200, height: 1020 }, presentation, comparison: "snapshot" in presentation ? presentation.snapshot.recent.readings.map(r => ({ metric: r.metric, ...analysisDifference(presentation.snapshot, r.metric) })) : null, artwork, artworkKey: currentArtworkKey(hero), key: analysisPresentationKey(presentation, hero), disclosure: "Local consumer presentation; qualification and unavailable reasons are retained per field. No source refresh or deployment implied." }));
}
/** A separately qualified research card does not certify the unrelated NHL capture. */
export function canExportAnalysis(p: AnalysisPresentation): boolean {
  if ("goalie" in p) return p.goalie.state === "fixture";
  const research = p.blsh.retained;
  if (p.view === "evidence" && research) return p.blsh.status === "exploratory" && research.profile.playerId === p.snapshot.capture.player.id && research.profile.team === p.snapshot.capture.player.team;
  return !p.snapshot.recent.reason;
}
export function assertAnalysisExport(svg: SVGSVGElement, p: AnalysisPresentation, hero?: PreparedHero | null) {
  if (!svg.isConnected || svg.dataset.analysisKey !== analysisPresentationKey(p, hero)) throw new Error("Displayed analysis changed; prepare the current snapshot again.");
  if (svg.querySelector('[data-evidence-truncated="true"]')) throw new Error("Full evidence will not fit in this card. Narrow the supplied evidence before exporting.");
  if (hero) assertReviewedArtwork(svg, hero);
  else if (svg.querySelector("image") || !svg.querySelector('[data-artwork-unavailable="true"]')) throw new Error("Unavailable artwork cannot contain a substitute image.");
  if (!canExportAnalysis(p)) throw new Error("snapshot" in p ? "Unqualified capture cannot be exported as analysis." : "Qualified goalie inventory is unavailable.");
}
export const rasterizeAnalysis = (svg: SVGSVGElement, p: AnalysisPresentation, hero?: PreparedHero | null) => rasterizeCardSvg(svg, () => assertAnalysisExport(svg, p, hero), 1200, 1020);
