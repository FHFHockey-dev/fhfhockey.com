import React from "react";
import PlayerHeroHeader from "./PlayerHeroHeader";
import type { PreparedHero } from "./HeroPlayerCard";
import { currentArtworkKey, assertCurrentHero, CURRENT_IMAGE_UNAVAILABLE } from "../../lib/player-cards/currentArtwork";
import { portraitKey, compositionKey, isCompositionStyle } from "../../lib/player-cards/portraitTreatment";
import { outlineKey } from "../../lib/player-cards/alphaOutline";
import { outlineStackKey } from "../../lib/player-cards/outlineStack";
import { CURRENT_NHL_DEFINITIONS, CURRENT_NHL_FORMAT_LABELS, currentNhlRows, formatCurrentNhl, type CurrentNhlCard, type CurrentNhlFormat, type CurrentNhlMetric } from "../../lib/player-cards/currentNhl";

function difference(id: CurrentNhlMetric, recent: number | null, previous: number | null) {
  if (recent === null || previous === null) return "—";
  const delta = recent - previous, magnitude = Math.abs(delta);
  const value = id === "shootingPct" ? `${magnitude.toFixed(1)} pp` : formatCurrentNhl(id, magnitude);
  return `${delta < 0 ? "−" : delta > 0 ? "+" : ""}${value}`;
}

export const currentCardKey = (card: CurrentNhlCard, format: CurrentNhlFormat, hero?: PreparedHero | null) => JSON.stringify([card, format, currentArtworkKey(hero)]);
export default function CurrentPlayerCard({ card, format, hero, svgRef }: { card: CurrentNhlCard; format: CurrentNhlFormat; hero?: PreparedHero | null; svgRef?: React.Ref<SVGSVGElement> }) {
  if (hero) assertCurrentHero(card, hero);
  const composition = !!hero && isCompositionStyle(hero.treatment?.style || "original");
  const title = CURRENT_NHL_FORMAT_LABELS[format], comparison = format === "recent-previous";
  const previous = card.previous?.state === "ready" ? card.previous : null;
  const previousReason = card.previous?.state === "unavailable" ? card.previous.reason : "Previous-window evidence was not captured.";
  const retained = card.source === "nhl-retained", fixture = card.source === "contract-fixture", source = fixture ? "SYNTHETIC CONTRACT FIXTURE" : retained ? "RETAINED NHL CAPTURE · NOT CURRENT" : "NHL OBSERVED RESULTS";
  const rows = currentNhlRows(format);
  const description = `${card.player.name}. ${title}. ${source}. ${card.sample.gp === null ? "GP unverified" : `${card.sample.gp} appearances`}. ${rows.map(id => `${CURRENT_NHL_DEFINITIONS[id].label}: ${formatCurrentNhl(id, card.values[id])}${comparison ? `; preceding ${card.request.count}: ${previous ? formatCurrentNhl(id, previous.values[id]) : "unavailable"}; change: ${previous ? difference(id, card.values[id], previous.values[id]) : "unavailable"}` : ""}`).join(". ")}. ${comparison && !previous ? previousReason : ""} ${card.issues.join(". ")}. ${card.rankReason}. ${hero ? `Reviewed local NHL photo, captured ${hero.capturedAt}` : CURRENT_IMAGE_UNAVAILABLE}`;
  const providerDates = [...card.sample.sourceDates].sort(), utcDates = [...card.sample.utcDates].sort();
  return <svg ref={svgRef} xmlns="http://www.w3.org/2000/svg" width="1200" height="1020" viewBox="0 0 1200 1020" role="img" aria-label={description} data-current-key={currentCardKey(card, format, hero)} data-current-artwork-key={currentArtworkKey(hero)} data-portrait-key={hero ? portraitKey(hero) : undefined} data-pipeline-key={hero ? compositionKey(hero) : undefined} data-team-logo-hash={composition ? hero!.teamLogo?.sha256 : undefined} data-outline-key={outlineKey(hero?.outline)} data-outline-settings={hero?.outlineSettings ? outlineStackKey(hero.outlineSettings) : undefined} data-source={card.source} data-card-format={format}>
    <title>{card.player.name} · FHFH · {title}</title><desc>{description}. {card.finalityStatement} {card.historyStatement}</desc>
    <rect width="1200" height="1020" fill="#F2F1EB" />
    <PlayerHeroHeader identity={card.player} hero={hero} context={`${String(card.request.season).slice(0, 4)}–${String(card.request.season).slice(6)} · Own last ${card.request.count} · All Strengths`} disclosure={source} />
    <g fontFamily="Arial, sans-serif" style={{ fontVariantNumeric: "tabular-nums" }}>
      <text x="40" y="375" fontSize="18" fontWeight="700" fill="#555D60">{comparison ? "RECENT vs PREVIOUS · ACTUAL VALUES" : format === "results-milestones" ? "REPORTED PRODUCTION · REGULAR SEASON" : "RATES & OPPORTUNITY · REGULAR SEASON"}</text>
      {comparison ? <><text x="710" y="375" textAnchor="end" fontSize="20" fontWeight="700">LAST {card.request.count}</text><text x="940" y="375" textAnchor="end" fontSize="20" fontWeight="700">PREVIOUS {card.request.count}</text><text x="1160" y="375" textAnchor="end" fontSize="20" fontWeight="700">CHANGE</text></> : <><text x="755" y="375" textAnchor="end" fontSize="20" fontWeight="700">ACTUAL</text><text x="1160" y="375" textAnchor="end" fontSize="20" fontWeight="700">RANK / N · PERCENTILE</text></>}
      {rows.map((id, i) => <g key={id} transform={`translate(0 ${423 + i * 53})`} fill="#1A1D21" data-metric={id}>
        <line x1="40" x2="1160" y1="-27" y2="-27" stroke="#D0D3CE" /><text x="40" y="13" fontSize="31">{CURRENT_NHL_DEFINITIONS[id].label}</text>
        <text x={comparison ? 710 : 755} y="16" textAnchor="end" fontSize="42" fontWeight="700">{formatCurrentNhl(id, card.values[id])}</text>
        {comparison ? <><text x="940" y="16" textAnchor="end" fontSize="36" fill="#555D60">{previous ? formatCurrentNhl(id, previous.values[id]) : "—"}</text><text x="1160" y="16" textAnchor="end" fontSize="30">{previous ? difference(id, card.values[id], previous.values[id]) : "—"}</text></> : <text x="1160" textAnchor="end" fontSize="19" fill="#744512"><tspan x="1160">Unavailable</tspan><tspan x="1160" dy="23">League pool unverified</tspan></text>}
      </g>)}
      <rect y="690" width="1200" height="96" fill="#1A1D21" /><text x="40" y="727" fontSize="26" fontWeight="700" fill="#F2F1EB">{card.sample.gp === null ? "GP unverified" : `${card.sample.gp}/${card.request.count} GP`} · {card.sample.toiSeconds === null ? "TOI unverified" : `${(card.sample.toiSeconds / 60).toFixed(1)} min TOI`}</text>
      <text x="40" y="763" fontSize="20" fill="#80DFFF">{comparison ? previous ? `Previous ${previous.games.length} GP · ${(previous.toiSeconds / 60).toFixed(1)} min TOI · provider dates ${previous.games[previous.games.length - 1].providerDate} → ${previous.games[0].providerDate}` : previousReason : format === "results-milestones" ? "Milestone baselines unavailable · no career or pace claim" : "Chance quality, on-ice results and PP role need separate qualified sources"}</text>
      <g fill="#555D60" fontSize="19">
        <text x="40" y="822">{fixture ? "Source: synthetic contract fixture · not a real player’s results" : "Source: NHL player landing, game log & team schedule"} · {card.observedAt.slice(0, 16).replace("T", " ")} UTC</text>
        <text x="40" y="853">Provider game dates: {providerDates.length ? `${providerDates[0]} → ${providerDates[providerDates.length - 1]}` : "Unverified"} · UTC start dates: {utcDates.length ? `${utcDates[0]} → ${utcDates[utcDates.length - 1]}` : "Unverified"}</text>
        <text x="40" y="884">Final status at observation · exact end time unavailable · no historical cutoff claim</text>
        <text x="40" y="915">Ranks require all NHL same-definition values · no GP, TOI or position threshold</text>
        <text x="40" y="949" fill="#744512">{card.state === "unavailable" ? "Inputs unverified · see source explanation below · PNG disabled" : card.issues.length ? card.issues.join(" ") : "Season appearance count reconciled · current window · no career-history claim"}</text>
        <text x="40" y="985" fontSize="17">{comparison ? "Change = recent − previous; shooting% change in percentage points. No forecast or quality score." : "Shooting% is an actual percentage. Numeric magnitude does not imply player quality."}</text><text x="1160" y="985" textAnchor="end" fontWeight="700">FHFHOCKEY.COM</text>
        <text x="40" y="1010" fontSize="13">Definitions: {card.evidence.version} · selected game inputs and source paths in snapshot manifest</text>
      </g>
    </g>
  </svg>;
}
