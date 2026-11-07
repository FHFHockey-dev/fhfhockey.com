import React from "react";
import { blshDiagnostics, RESEARCH_TRACKS, TRACK_LABELS, researchBinding, researchCardKey, researchNumber, streakTrackView, words, type ResearchHost } from "../../lib/player-cards/researchSnapshot";
function wrap(text: string, width = 100) { const lines: string[] = []; for (const word of text.split(/\s+/)) { if (!lines.length || lines[lines.length - 1].length + word.length + 1 > width) lines.push(word); else lines[lines.length - 1] += " " + word; } return lines; }
export default function ResearchPlayerCard({ card, svgRef }: { card: ResearchHost; svgRef?: React.Ref<SVGSVGElement> }) {
  const s = card.playerResearchSnapshot, binding = researchBinding(card); if (!s || !binding) return null;
  const b = s.blshResearch, diagnostics = blshDiagnostics(s).flatMap(line => wrap(line));
  const title = `${card.player.name || card.player.id} · ${s.asOf.eventThroughDate} · offline research only`;
  return <svg ref={svgRef} xmlns="http://www.w3.org/2000/svg" width="1200" height="1200" viewBox="0 0 1200 1200" role="img" aria-label={title} data-research-key={researchCardKey(card)} data-research-manifest={binding.manifestSha256} data-research-fixture={binding.fixtureSha256}>
    <title>{title}</title><desc>Historical game-date example. Unknown source availability, retrieval and issuance time. Research only, production detector unselected, trusted false. Streak and BLSH are independent. Last recorded game value is not a rolling average. {s.limits.join(". ")}</desc>
    <rect width="1200" height="1200" fill="#F2F1EB" /><rect width="1200" height="180" fill="#1A1D21" /><rect width="9" height="180" fill="#07AAE2" />
    <g fontFamily="Arial, sans-serif" style={{ fontVariantNumeric: "tabular-nums" }} fill="#1A1D21">
      <g fill="#F2F1EB"><text x="40" y="42" fontSize="26" fontWeight="900" fill="#07AAE2">FHFH</text><text x="136" y="41" fontSize="18" letterSpacing="2">/ PLAYER RESEARCH</text><text x="1160" y="41" textAnchor="end" fontSize="17" fill="#80DFFF">{s.fixtureKind === "synthetic_contract" ? "SYNTHETIC CONTRACT EXAMPLE" : "HISTORICAL DEVELOPMENT EXAMPLE"}</text><text x="40" y="107" fontSize="50" fontWeight="900">{card.player.name || `Player ${card.player.id}`}</text><text x="40" y="149" fontSize="23">{s.asOf.eventThroughDate} · Game-date cutoff · Research only · Trusted: false</text></g>
      <text x="40" y="215" fontSize="22" fontWeight="700">STREAK RESEARCH · {words(s.streak.availability).toUpperCase()}</text><text x="1160" y="215" textAnchor="end" fontSize="17">Last game value / saved block5 z · prior 2022–23 reference</text>
      {RESEARCH_TRACKS.map((id, i) => { const r = streakTrackView(s.streak.tracks[id], s.asOf.eventThroughDate); return <g key={id} transform={`translate(0 ${249 + i * 95})`} data-research-track={id}>
        <line x1="40" x2="1160" y1="-17" y2="-17" stroke="#D0D3CE" /><text x="40" y="10" fontSize="24" fontWeight="700">{TRACK_LABELS[id]}</text><text x="1160" y="10" textAnchor="end" fontSize="23">{r.state} · last {r.lastValue} / z {r.z}</text>
        <text x="40" y="37" fontSize="18">{r.reference} · reason: {r.reason}</text><text x="40" y="62" fontSize="17" fill="#555D60">{r.transition} · last known flag: {r.lastKnownFlag}</text>
      </g>; })}
      <rect y="640" width="1200" height="110" fill="#1A1D21" /><g fill="#F2F1EB"><text x="40" y="674" fontSize="22" fontWeight="700">BLSH RESEARCH · {words(b.status).toUpperCase()}</text><text x="40" y="714" fontSize="27">Production P {researchNumber(b.productionP)} · support discrepancy {researchNumber(b.supportDiscrepancy)}</text><text x="1160" y="674" textAnchor="end" fontSize="18" fill="#80DFFF">Saved direction: {b.direction || "withheld"} · list: {b.includedInSavedResearchList ? "included" : "not included"}</text></g>
      <text x="40" y="778" fontSize="18" fill="#744512">{b.reason ? `BLSH unavailable reason: ${words(b.reason)}` : "Saved production discrepancy, independent of hot/cold streak state; no recommendation."}</text>
      {diagnostics.map((line, i) => <text key={i} x="40" y={806 + i * 22} fontSize="17" fill="#555D60">{line}</text>)}
      <line x1="40" x2="1160" y1="1040" y2="1040" stroke="#D0D3CE" />
      <g fontSize="17" fill="#555D60"><text x="40" y="1067">Source availability / retrieval / issuance: unknown. Packaging time is not issuance.</text><text x="40" y="1093">Last game value is not a rolling mean. Missing outcome can reflect ineligible reference, not a current-feed fault.</text><text x="40" y="1119">No live alert, calibrated confidence, forecast or causal-luck claim. Zero/low shots do not veto broad-profile visibility.</text><text x="40" y="1145">Manifest {binding.manifestSha256.slice(0, 16)}… · fixture {binding.fixtureSha256.slice(0, 16)}… · exact IDs/dates in manifest</text><text x="40" y="1171" fontSize="15">{s.streak.version} · {b.version}</text><text x="1160" y="1171" textAnchor="end" fontWeight="700">FHFHOCKEY.COM</text></g>
    </g>
  </svg>;
}
