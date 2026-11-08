import React, { useId } from "react";
import { teamsInfo } from "../../lib/teamsInfo";
import type { PreparedHero } from "./HeroPlayerCard";
import { isCompositionStyle, PORTRAIT_LABELS } from "../../lib/player-cards/portraitTreatment";
import { outlineRecipe, OUTLINE_SCALE } from "../../lib/player-cards/alphaOutline";

/** Shared 338px artwork header; player and logo geometry are identical in every card. */
export default function PlayerHeroHeader({ identity, hero, context, disclosure }: {
  identity: { name: string; team: string; position: string }; hero?: PreparedHero | null; context: string; disclosure: string;
}) {
  const uid = useId().replace(/:/g, ""), palette = teamsInfo[identity.team] || { name: identity.team, primaryColor: "#1A1D21", secondaryColor: "#07AAE2", jersey: "#07AAE2", darkColor: "#101214" };
  const composition = !!hero && isCompositionStyle(hero.treatment?.style || "original");
  const rings = hero?.outline ? outlineRecipe(hero.outline) : [];
  const logoSize = 480, logoRightOverhang = 120;
  const names = identity.name.split(" "), first = names.shift()!, last = names.join(" ");
  return <g>
    <defs>
      <linearGradient id={`${uid}-team`}><stop stopColor={palette.darkColor || palette.primaryColor} /><stop offset="1" stopColor={palette.primaryColor} /></linearGradient>
      <linearGradient id={`${uid}-shade`}><stop stopColor="#101214" stopOpacity=".9" /><stop offset=".62" stopColor="#101214" stopOpacity=".2" /><stop offset="1" stopColor="#101214" stopOpacity="0" /></linearGradient>
      <clipPath id={`${uid}-crop`}><rect width="1200" height="338" /></clipPath>
      {composition && hero && <>
        <linearGradient id={`${uid}-logo-fade`}><stop offset="0" stopColor="white" stopOpacity="0" /><stop offset=".25" stopColor="white" /><stop offset="1" stopColor="white" /></linearGradient>
        <mask id={`${uid}-logo-mask`} maskUnits="objectBoundingBox" maskContentUnits="objectBoundingBox" x="0" y="0" width="1" height="1"><rect width="1" height="1" fill={`url(#${uid}-logo-fade)`} /></mask>
      </>}
    </defs>
    <g clipPath={`url(#${uid}-crop)`}>
      <rect width="1200" height="338" fill={`url(#${uid}-team)`} />
      <path d="M700 0H850L630 338H480Z" fill={palette.secondaryColor} opacity=".35" />
      <path d="M1040 0H1090L870 338H820Z" fill={palette.jersey} opacity=".6" />
      <rect width="1200" height="338" fill={`url(#${uid}-shade)`} />
      {composition && hero && <image data-team-logo="true" data-logo-anchor="right-edge" href={hero.teamLogo!.dataUrl} x={1200 - logoSize + logoRightOverhang} y="-100" width={logoSize} height={logoSize} preserveAspectRatio="xMidYMid meet" mask={`url(#${uid}-logo-mask)`} />}
      {hero?.outline && <image data-player-outline="true" data-outline-width={hero.outline.thickness} data-outline-band-widths={rings.map(r => r.width).join(">")} data-outline-band-width={rings.every(r => r.width === 5) ? 5 : undefined} data-outline-band-colors={rings.map(r => r.color).join(">")} data-outline-color={hero.outline.bands?.join(">") || hero.outline.color} href={hero.outline.dataUrl} x={600 - hero.outline.padding / OUTLINE_SCALE} y={4 - hero.outline.padding / OUTLINE_SCALE} width={hero.outline.width / OUTLINE_SCALE} height={hero.outline.height / OUTLINE_SCALE} preserveAspectRatio="none" />}
      {hero && <image data-hero-image="true" href={hero.dataUrl} x="600" y="4" width="600" height={600 * hero.sourceHeight / hero.sourceWidth} preserveAspectRatio="xMidYMin meet" style={{ imageRendering: hero.treatment?.style?.startsWith("pixelated") ? "pixelated" : "auto" }} />}
      <rect y="299" width="1200" height="39" fill="#101214" fillOpacity=".93" />
    </g>
    {!hero && <g fill="#BEEFFF" fontFamily="Arial, sans-serif" textAnchor="middle" data-artwork-unavailable="true"><text x="925" y="130" fontSize="24" fontWeight="700">PLAYER IMAGE UNAVAILABLE</text><text x="925" y="166" fontSize="18">No accepted local cutout for this player and team</text></g>}
    <g fill="#F2F1EB" fontFamily="Arial, sans-serif">
      <text x="40" y="42" fontSize="24" fontWeight="900" letterSpacing="2" fill="#07AAE2">FHFH</text>
      <text x="132" y="42" fontSize="16" letterSpacing="2">/ PLAYER REPORT</text>
      <text x="40" y="101" fontSize="44" fontWeight="700">{first.toUpperCase()}</text>
      <text x="36" y="184" fontSize={last.length > 10 ? 66 : 86} fontWeight="900" letterSpacing="-3">{last.toUpperCase()}</text>
      <text x="40" y="225" fontSize="25">{palette.name} · {identity.position}{hero ? ` · #${hero.sweater}` : ""}</text>
      <text x="40" y="268" fontSize="23" fill="#BEEFFF">{context}</text>
      <text x="40" y="325" fontSize="19" fontWeight="700" letterSpacing="1" fill="#80DFFF">{disclosure}</text>
      <text x="1160" y="325" textAnchor="end" fontSize={composition ? 14 : 16}>{hero ? `NHL photo · ${PORTRAIT_LABELS[hero.treatment?.style || "original"]}` : "Player image unavailable"}</text>
    </g>
  </g>;

}
