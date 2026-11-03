import React, { useId } from "react";
import { teamsInfo } from "../../lib/teamsInfo";
import type { FlowSnapshot } from "../../lib/player-cards/interactionSnapshot";
import { periodLabel, strengthLabel } from "./InteractiveCard";
import EditorialPlayerCard from "./EditorialPlayerCard";
import { portraitKey, compositionKey, PORTRAIT_LABELS, isCompositionStyle, type PortraitTreatment } from "../../lib/player-cards/portraitTreatment";
import { isPreparedTeamLogo, type PreparedTeamLogo } from "../../lib/player-cards/teamLogo";

export type HeroSample = {
  id: number; name: string; team: string; position: string; sweater: number;
  sourceUrl: string; sourceWidth: number; sourceHeight: number; capturedAt: string;
  sourceSha256: string; alphaSha256: string; acceptance: "accepted";
  localPath: string;
};
export type PreparedHero = HeroSample & { dataUrl: string; treatment?: PortraitTreatment; teamLogo?: PreparedTeamLogo };
export type CardShareFormat = "landscape" | "social-square";

export default function HeroPlayerCard({ snapshot, hero, format, svgRef }: {
  snapshot: FlowSnapshot; hero: PreparedHero; format: CardShareFormat; svgRef?: React.Ref<SVGSVGElement>;
}) {
  const uid = useId().replace(/:/g, ""), palette = teamsInfo[hero.team];
  if (String(hero.id) !== snapshot.player.id || !palette || hero.acceptance !== "accepted") throw new Error("Artwork identity is not verified for this card.");
  const composition = isCompositionStyle(hero.treatment?.style || "original");
  if (composition && !isPreparedTeamLogo(hero.teamLogo, hero.team)) throw new Error("A matching reviewed team logo is required.");
  const square = format === "social-square", height = square ? 1200 : 1020;
  const logoSize = 480, logoRightOverhang = 120;
  const names = hero.name.split(" "), first = names.shift()!, last = names.join(" ");
  const header = <g>
    <defs>
      <linearGradient id={`${uid}-team`}><stop stopColor={palette.darkColor || palette.primaryColor} /><stop offset="1" stopColor={palette.primaryColor} /></linearGradient>
      <linearGradient id={`${uid}-shade`}><stop stopColor="#101214" stopOpacity=".9" /><stop offset=".62" stopColor="#101214" stopOpacity=".2" /><stop offset="1" stopColor="#101214" stopOpacity="0" /></linearGradient>
      <clipPath id={`${uid}-crop`}><rect width="1200" height="338" /></clipPath>
      {composition && <>
        <linearGradient id={`${uid}-logo-fade`}><stop offset="0" stopColor="white" stopOpacity="0" /><stop offset=".25" stopColor="white" /><stop offset="1" stopColor="white" /></linearGradient>
        <mask id={`${uid}-logo-mask`} maskUnits="objectBoundingBox" maskContentUnits="objectBoundingBox" x="0" y="0" width="1" height="1"><rect width="1" height="1" fill={`url(#${uid}-logo-fade)`} /></mask>
      </>}
    </defs>
    <g clipPath={`url(#${uid}-crop)`}>
      <rect width="1200" height="338" fill={`url(#${uid}-team)`} />
      <path d="M700 0H850L630 338H480Z" fill={palette.secondaryColor} opacity=".35" />
      <path d="M1040 0H1090L870 338H820Z" fill={palette.jersey} opacity=".6" />
      <rect width="1200" height="338" fill={`url(#${uid}-shade)`} />
      {composition && <image data-team-logo="true" data-logo-anchor="right-edge" href={hero.teamLogo!.dataUrl} x={1200 - logoSize + logoRightOverhang} y="-100" width={logoSize} height={logoSize} preserveAspectRatio="xMidYMid meet" mask={`url(#${uid}-logo-mask)`} />}
      <image data-hero-image="true" href={hero.dataUrl} x="600" y="4" width="600" height={600 * hero.sourceHeight / hero.sourceWidth} preserveAspectRatio="xMidYMin meet" style={{ imageRendering: hero.treatment?.style?.startsWith("pixelated") ? "pixelated" : "auto" }} />
      <rect y="299" width="1200" height="39" fill="#101214" fillOpacity=".93" />
    </g>
    <g fill="#F2F1EB" fontFamily="Arial, sans-serif">
      <text x="40" y="42" fontSize="24" fontWeight="900" letterSpacing="2" fill="#07AAE2">FHFH</text>
      <text x="132" y="42" fontSize="16" letterSpacing="2">/ PLAYER REPORT</text>
      <text x="40" y="101" fontSize="44" fontWeight="700">{first.toUpperCase()}</text>
      <text x="36" y="184" fontSize={last.length > 10 ? 66 : 86} fontWeight="900" letterSpacing="-3">{last.toUpperCase()}</text>
      <text x="40" y="225" fontSize="25">{palette.name} · {hero.position} · #{hero.sweater}</text>
      <text x="40" y="268" fontSize="23" fill="#BEEFFF">{String(snapshot.settings.season).slice(0,4)}–{String(snapshot.settings.season).slice(6)} · {periodLabel(snapshot)} · {strengthLabel(snapshot)}</text>
      <text x="40" y="325" fontSize="19" fontWeight="700" letterSpacing="1" fill="#80DFFF">ILLUSTRATIVE STATS · NOT {hero.name.toUpperCase()}’S RESULTS</text>
      <text x="1160" y="325" textAnchor="end" fontSize={composition ? 14 : 16}>NHL photo · {PORTRAIT_LABELS[hero.treatment?.style || "original"]}</text>
    </g>
  </g>;
  return <svg ref={svgRef} xmlns="http://www.w3.org/2000/svg" viewBox={`0 0 1200 ${height}`} width="1200" height={height} role="img"
    aria-label={`${hero.name}. NHL action photo with locally removed background. Illustrative synthetic statistics, not this player's actual results. ${snapshot.sample.gp === null ? "GP unverified" : `${snapshot.sample.gp} fixture appearances`}. ${snapshot.readings.map(r => r.reason || "").filter(Boolean).join(". ")}`}
    data-snapshot-id={snapshot.id} data-artwork-hash={hero.alphaSha256} data-share-format={format} data-portrait-key={portraitKey(hero)} data-pipeline-key={compositionKey(hero)} data-team-logo-hash={composition ? hero.teamLogo!.sha256 : undefined}>
    <title>{hero.name} · FHFH artwork study · illustrative statistics</title>
    <desc>Source photo: {hero.sourceUrl}. Captured {hero.capturedAt}. Treatment: {PORTRAIT_LABELS[hero.treatment?.style || "original"]}; original silhouette preserved. Team and jersey identity from that captured source. {composition ? `Team logo: ${hero.teamLogo!.localPath}, displayed behind the player with a fade on its leftmost quarter. ` : ""}No live statistics or ranking coverage claimed.</desc>
    <rect width="1200" height={height} fill="#101214" />
    {square && <g fill="#F2F1EB" fontFamily="Arial, sans-serif"><text x="40" y="48" fontSize="22" letterSpacing="2">FHFH / SOCIAL SHARE</text><text x="1160" y="48" textAnchor="end" fontSize="18" fill="#80DFFF">ARTWORK CHECKPOINT</text></g>}
    <svg x="0" y={square ? 76 : 0} width="1200" height="1020" viewBox="0 0 1200 1020" aria-hidden="true">
      <EditorialPlayerCard snapshot={snapshot} header={header} headerHeight={338} artworkDescription={`Photo ${hero.sourceUrl}; reviewed local cutout ${hero.alphaSha256}; statistics are fabricated`} />
    </svg>
    {square && <g fontFamily="Arial, sans-serif"><text x="40" y="1136" fontSize="22" fill="#F2F1EB">Real player photography. Fabricated statistical profile.</text><text x="40" y="1170" fontSize="18" fill="#B6B9BC">Photo source: NHL · reviewed cutout · live data and premium features remain inactive</text><text x="1160" y="1170" textAnchor="end" fontSize="19" fill="#07AAE2">FHFHOCKEY.COM</text></g>}
  </svg>;
}
