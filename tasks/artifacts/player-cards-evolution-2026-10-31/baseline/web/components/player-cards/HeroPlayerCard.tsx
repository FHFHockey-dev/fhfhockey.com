import React from "react";
import { teamsInfo } from "../../lib/teamsInfo";
import type { FlowSnapshot } from "../../lib/player-cards/interactionSnapshot";
import { periodLabel, strengthLabel } from "./InteractiveCard";
import PlayerHeroHeader from "./PlayerHeroHeader";
import EditorialPlayerCard from "./EditorialPlayerCard";
import { portraitKey, compositionKey, PORTRAIT_LABELS, isCompositionStyle, type PortraitTreatment } from "../../lib/player-cards/portraitTreatment";
import { isPreparedTeamLogo, type PreparedTeamLogo } from "../../lib/player-cards/teamLogo";
import { outlineStackKey, type OutlineRing } from "../../lib/player-cards/outlineStack";
import { outlineKey, outlineRecipe, validOutlineSettings, validPlayerOutline, type PreparedPlayerOutline } from "../../lib/player-cards/alphaOutline";

export type HeroSample = {
  id: number; name: string; team: string; position: string; sweater: number;
  sourceUrl: string; sourceWidth: number; sourceHeight: number; capturedAt: string;
  sourceSha256: string; alphaSha256: string; acceptance: "accepted";
  localPath: string;
};
export type PreparedHero = HeroSample & { dataUrl: string; treatment?: PortraitTreatment; teamLogo?: PreparedTeamLogo; outline?: PreparedPlayerOutline; outlineSettings?: OutlineRing[] };
export type CardShareFormat = "landscape" | "social-square";

export default function HeroPlayerCard({ snapshot, hero, format, svgRef }: {
  snapshot: FlowSnapshot; hero: PreparedHero; format: CardShareFormat; svgRef?: React.Ref<SVGSVGElement>;
}) {
  const palette = teamsInfo[hero.team];
  if (String(hero.id) !== snapshot.player.id || !palette || hero.acceptance !== "accepted") throw new Error("Artwork identity is not verified for this card.");
  const composition = isCompositionStyle(hero.treatment?.style || "original");
  if (composition && !isPreparedTeamLogo(hero.teamLogo, hero.team)) throw new Error("A matching reviewed team logo is required.");
  if (!validOutlineSettings(hero)) throw new Error("Outline settings do not match the rendered asset.");
  const rings = hero.outline ? outlineRecipe(hero.outline) : [];
  if (hero.outline && !validPlayerOutline(hero.outline, hero)) throw new Error("A matching original-alpha player outline is required.");
  const square = format === "social-square", height = square ? 1200 : 1020;
  const header = <PlayerHeroHeader identity={hero} hero={hero} context={`${String(snapshot.settings.season).slice(0,4)}–${String(snapshot.settings.season).slice(6)} · ${periodLabel(snapshot)} · ${strengthLabel(snapshot)}`} disclosure={`ILLUSTRATIVE STATS · NOT ${hero.name.toUpperCase()}’S RESULTS`} />;
  return <svg ref={svgRef} xmlns="http://www.w3.org/2000/svg" viewBox={`0 0 1200 ${height}`} width="1200" height={height} role="img"
    aria-label={`${hero.name}. NHL action photo with locally removed background. Illustrative synthetic statistics, not this player's actual results. ${snapshot.sample.gp === null ? "GP unverified" : `${snapshot.sample.gp} fixture appearances`}. ${snapshot.readings.map(r => r.reason || "").filter(Boolean).join(". ")}`}
    data-snapshot-id={snapshot.id} data-artwork-hash={hero.alphaSha256} data-share-format={format} data-portrait-key={portraitKey(hero)} data-pipeline-key={compositionKey(hero)} data-team-logo-hash={composition ? hero.teamLogo!.sha256 : undefined} data-outline-key={outlineKey(hero.outline)} data-outline-settings={hero.outlineSettings ? outlineStackKey(hero.outlineSettings) : undefined}>
    <title>{hero.name} · FHFH artwork study · illustrative statistics</title>
    <desc>Source photo: {hero.sourceUrl}. Captured {hero.capturedAt}. Treatment: {PORTRAIT_LABELS[hero.treatment?.style || "original"]}; original silhouette preserved. Team and jersey identity from that captured source. {hero.outline ? `Non-overlapping outward contour bands, inner to outer ${rings.map(r => `${r.color} ${r.width} px`).join(" → ")}, ${hero.outline.thickness} design pixels total, behind the unchanged player. ` : ""}{composition ? `Team logo: ${hero.teamLogo!.localPath}, displayed behind the player with a fade on its leftmost quarter. ` : ""}No live statistics or ranking coverage claimed.</desc>
    <rect width="1200" height={height} fill="#101214" />
    {square && <g fill="#F2F1EB" fontFamily="Arial, sans-serif"><text x="40" y="48" fontSize="22" letterSpacing="2">FHFH / SOCIAL SHARE</text><text x="1160" y="48" textAnchor="end" fontSize="18" fill="#80DFFF">ARTWORK CHECKPOINT</text></g>}
    <svg x="0" y={square ? 76 : 0} width="1200" height="1020" viewBox="0 0 1200 1020" aria-hidden="true">
      <EditorialPlayerCard snapshot={snapshot} header={header} headerHeight={338} artworkDescription={`Photo ${hero.sourceUrl}; reviewed local cutout ${hero.alphaSha256}; statistics are fabricated`} />
    </svg>
    {square && <g fontFamily="Arial, sans-serif"><text x="40" y="1136" fontSize="22" fill="#F2F1EB">Real player photography. Fabricated statistical profile.</text><text x="40" y="1170" fontSize="18" fill="#B6B9BC">Photo source: NHL · reviewed cutout · live data and premium features remain inactive</text><text x="1160" y="1170" textAnchor="end" fontSize="19" fill="#07AAE2">FHFHOCKEY.COM</text></g>}
  </svg>;
}
