import React from "react";
import { CURRENT_NHL_DEFINITIONS, currentNhlRows, formatCurrentNhl, type CurrentNhlCard, type CurrentNhlFormat } from "../../lib/player-cards/currentNhl";

export const currentCardKey = (card: CurrentNhlCard, format: CurrentNhlFormat) => JSON.stringify([card, format]);
export default function CurrentPlayerCard({ card, format, svgRef }: { card: CurrentNhlCard; format: CurrentNhlFormat; svgRef?: React.Ref<SVGSVGElement> }) {
  const title = format === "results-milestones" ? "Results & Milestones" : "Rates & Opportunity";
  const retained = card.source === "nhl-retained", fixture = card.source === "contract-fixture", source = fixture ? "SYNTHETIC CONTRACT FIXTURE" : retained ? "RETAINED NHL CAPTURE · NOT CURRENT" : "NHL OBSERVED RESULTS";
  const rows = currentNhlRows(format);
  const description = `${card.player.name}. ${title}. ${source}. ${card.sample.gp === null ? "GP unverified" : `${card.sample.gp} appearances`}. ${rows.map(id => `${CURRENT_NHL_DEFINITIONS[id].label}: ${formatCurrentNhl(id, card.values[id])}`).join(". ")}. ${card.issues.join(". ")}. ${card.rankReason}`;
  const providerDates = [...card.sample.sourceDates].sort(), utcDates = [...card.sample.utcDates].sort();
  return <svg ref={svgRef} xmlns="http://www.w3.org/2000/svg" width="1200" height="1020" viewBox="0 0 1200 1020" role="img" aria-label={description} data-current-key={currentCardKey(card, format)} data-source={card.source} data-card-format={format}>
    <title>{card.player.name} · FHFH · {title}</title><desc>{description}. {card.finalityStatement} {card.historyStatement}</desc>
    <rect width="1200" height="1020" fill="#F2F1EB" /><rect width="1200" height="238" fill="#1A1D21" /><rect width="9" height="238" fill="#07AAE2" />
    <g fontFamily="Arial, sans-serif" style={{ fontVariantNumeric: "tabular-nums" }}>
      <g fill="#F2F1EB"><text x="40" y="44" fontSize="27" fontWeight="900" fill="#07AAE2">FHFH</text><text x="135" y="43" fontSize="18" letterSpacing="2">/ PLAYER REPORT</text>
        <text x="40" y="123" fontSize="62" fontWeight="900">{card.player.name}</text><text x="40" y="163" fontSize="27">{card.player.team} · {card.player.position} · {title}</text>
        <text x="40" y="205" fontSize="24" fill="#80DFFF">{String(card.request.season).slice(0, 4)}–{String(card.request.season).slice(6)} · Own last {card.request.count} · All Strengths · Regular season</text>
        <text x="1160" y="43" textAnchor="end" fontSize="17" fill="#80DFFF">{source}</text></g>
      <text x="40" y="282" fontSize="20" fontWeight="700" fill="#555D60">{format === "results-milestones" ? "REPORTED PRODUCTION" : "DEPLOYMENT & INDIVIDUAL PRODUCTION"}</text><text x="755" y="282" textAnchor="end" fontSize="20" fontWeight="700">ACTUAL</text><text x="1160" y="282" textAnchor="end" fontSize="20" fontWeight="700">RANK / N · PERCENTILE</text>
      {rows.map((id, i) => <g key={id} transform={`translate(0 ${330 + i * 73})`} fill="#1A1D21" data-metric={id}>
        <line x1="40" x2="1160" y1="-30" y2="-30" stroke="#D0D3CE" /><text x="40" y="13" fontSize="31">{CURRENT_NHL_DEFINITIONS[id].label}</text>
        <text x="755" y="16" textAnchor="end" fontSize="42" fontWeight="700">{formatCurrentNhl(id, card.values[id])}</text>
        <text x="1160" textAnchor="end" fontSize="19" fill="#744512"><tspan x="1160">Unavailable</tspan><tspan x="1160" dy="23">League pool unverified</tspan></text>
      </g>)}
      <rect y="690" width="1200" height="96" fill="#1A1D21" /><text x="40" y="727" fontSize="26" fontWeight="700" fill="#F2F1EB">{card.sample.gp === null ? "GP unverified" : `${card.sample.gp}/${card.request.count} GP`} · {card.sample.toiSeconds === null ? "TOI unverified" : `${(card.sample.toiSeconds / 60).toFixed(1)} min TOI`}</text>
      <text x="40" y="763" fontSize="20" fill="#80DFFF">{format === "results-milestones" ? "Milestone baselines unavailable · no career or pace claim" : "Chance quality, on-ice results and PP role need separate qualified sources"}</text>
      <g fill="#555D60" fontSize="19">
        <text x="40" y="822">{fixture ? "Source: synthetic contract fixture · not a real player’s results" : "Source: NHL player landing, game log & team schedule"} · {card.observedAt.slice(0, 16).replace("T", " ")} UTC</text>
        <text x="40" y="853">Provider game dates: {providerDates.length ? `${providerDates[0]} → ${providerDates[providerDates.length - 1]}` : "Unverified"} · UTC start dates: {utcDates.length ? `${utcDates[0]} → ${utcDates[utcDates.length - 1]}` : "Unverified"}</text>
        <text x="40" y="884">Final status at observation · exact end time unavailable · no historical cutoff claim</text>
        <text x="40" y="915">Ranks require all NHL same-definition values · no GP, TOI or position threshold</text>
        <text x="40" y="949" fill="#744512">{card.state === "unavailable" ? "Inputs unverified · see source explanation below · PNG disabled" : card.issues.length ? card.issues.join(" ") : "Season appearance count reconciled · current window · no career-history claim"}</text>
        <text x="40" y="985" fontSize="17">Shooting% is an actual percentage. Numeric magnitude does not imply player quality.</text><text x="1160" y="985" textAnchor="end" fontWeight="700">FHFHOCKEY.COM</text>
      </g>
    </g>
  </svg>;
}
