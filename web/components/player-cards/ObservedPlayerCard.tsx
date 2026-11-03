import React from "react";
import type { ObservedCardView } from "../../lib/player-cards/observedView";
import { formatMetric } from "./PlayerCard";
import type { MetricId } from "../../lib/player-cards/contracts";

const rows: { id: MetricId; label: string; y: number }[] = [
  { id: "atoi", label: "Ice time / game", y: 310 }, { id: "sog60", label: "Shots /60", y: 390 },
  { id: "iscf60", label: "Chances /60", y: 455 }, { id: "ixg60", label: "Expected goals /60", y: 520 },
  { id: "xgf60", label: "Expected goals for /60", y: 600 },
];
const ratios: { id: MetricId; label: string }[] = [{ id: "xgPct", label: "ON-ICE xG%" }, { id: "ipp", label: "IPP" }, { id: "shPct", label: "SHOOTING%" }, { id: "oiShPct", label: "ON-ICE SHOOTING%" }];

/** Observed presentation only; it never qualifies evidence, replaces missing data or activates a live feed. */
export default function ObservedPlayerCard({ view }: { view: ObservedCardView }) {
  const reading = (id: MetricId) => view.readings.find(row => row.id === id)!;
  const period = view.settings.period;
  const context = period.mode === "appearances" ? `Own last ${period.count} appearances` : `${period.start} → ${period.end} · UTC`;
  const strength = view.settings.strength === "all" ? "All Strengths" : view.settings.strength === "5v5" ? "5-on-5" : "Power play";
  const gp = view.sample.gp === null ? "GP unverified" : `${view.sample.gp} GP`;
  const description = `${view.player.name}. Observed inputs. Evidence ${view.evidenceState}. ${gp}. ${view.readings.map(row => `${row.id}: ${formatMetric(row.id, row.value)}; ${row.reason || row.rankReason || "qualified value and rank"}`).join(". ")}`;
  return <svg xmlns="http://www.w3.org/2000/svg" width="1200" height="1020" viewBox="0 0 1200 1020" role="img" aria-label={description} data-snapshot-id={view.id} data-source="local-observed" data-exportable={view.exportable}>
    <title>{`FHFH observed player report · ${view.player.name}`}</title><desc>{description}. No live or premium activation. Source dates and UTC calendar dates are distinct.</desc>
    <rect width="1200" height="1020" fill="#F2F1EB" /><rect width="1200" height="210" fill="#1A1D21" /><rect width="9" height="210" fill="#07AAE2" />
    <g fontFamily="Arial, sans-serif" style={{ fontVariantNumeric: "tabular-nums" }}>
      <text x="40" y="44" fontSize="27" fontWeight="900" fill="#07AAE2">FHFH</text><text x="135" y="43" fontSize="18" letterSpacing="2" fill="#C6C9CA">/ PLAYER REPORT</text>
      <text x="40" y="118" fontSize="66" fontWeight="900" fill="#F2F1EB">{view.player.name}</text>
      <text x="40" y="156" fontSize="23" fill="#C6C9CA">{view.player.team}{view.player.position ? ` · ${view.player.position}` : ""} · {String(view.settings.season).slice(0, 4)}–{String(view.settings.season).slice(6)}</text>
      <text x="40" y="190" fontSize="22" fill="#80DFFF">{context} · {strength}</text>
      <text x="1160" y="43" textAnchor="end" fontSize="18" fill="#80DFFF">OBSERVED INPUTS</text>
      <g fill="#1A1D21">
        <text x="40" y="251" fontSize="18" fontWeight="700">STATISTICAL PROFILE</text><text x="620" y="251" textAnchor="end" fontSize="18" fontWeight="700">ACTUAL</text><text x="758" y="251" textAnchor="end" fontSize="18" fontWeight="700">RANK / N</text><text x="1160" y="251" textAnchor="end" fontSize="18" fontWeight="700">PERCENTILE</text>
        <g fontSize="20" fontWeight="700" fill="#555D60"><text x="40" y="305">DEPLOYMENT</text><text x="40" y="385"><tspan x="40">INDIVIDUAL</tspan><tspan x="40" dy="25">CHANCE</tspan><tspan x="40" dy="25">CREATION</tspan></text><text x="40" y="595"><tspan x="40">ON-ICE</tspan><tspan x="40" dy="25">RESULTS</tspan></text></g>
        {[267, 350, 560].map(y => <line key={y} x1="40" x2="1160" y1={y} y2={y} stroke="#C7C9C5" />)}
        {rows.map(row => {
          const value = reading(row.id), rank = value.rank;
          return <g key={row.id} transform={`translate(0 ${row.y})`} data-metric-id={row.id}>
            <text x="234" fontSize={row.id === "xgf60" ? 25 : 28}>{row.label}</text><text x="620" textAnchor="end" fontSize="37" fontWeight="700" data-actual-value="true">{formatMetric(row.id, value.value)}</text>
            {rank ? <><text x="758" textAnchor="end" fontSize="26">{rank.tied ? "T-" : ""}{rank.ordinal}/{rank.population}</text><rect x="800" y="-22" width="274" height="17" fill="#D9DDDA" /><rect x="800" y="-22" width={274 * rank.percentile / 100} height="17" fill="#07AAE2" /><text x="1160" textAnchor="end" fontSize="28" fontWeight="700">{rank.percentile.toFixed(1)}</text></> : <text x="800" y="-8" fontSize="18" fill="#744512" data-unavailable="true"><tspan x="800">{value.state === "undefined" ? "Undefined" : value.state === "missing" ? "Source unverified" : "Rank unavailable"}</tspan><tspan x="800" dy="22">{value.state === "undefined" ? (value.reason?.includes("zero denominator") ? "Zero denominator" : "Selected period") : "Evidence incomplete"}</tspan></text>}
          </g>;
        })}
      </g>
      <rect y="642" width="1200" height="140" fill="#1A1D21" /><text x="40" y="669" fontSize="18" fontWeight="700" fill="#80DFFF">ACTUAL PERCENTAGES</text><text x="1160" y="669" textAnchor="end" fontSize="17" fill="#C6C9CA">Actual ratios · percentiles shown separately</text>
      {ratios.map((row, i) => { const value = reading(row.id); return <g key={row.id} transform={`translate(${40 + i * 286} 0)`} data-metric-id={row.id}><text y="701" fontSize="19" fontWeight="700" fill="#C6C9CA">{row.label}</text><text y="741" fontSize="40" fontWeight="700" fill="#F2F1EB">{formatMetric(row.id, value.value)}</text><text y="768" fontSize="17" fill="#80DFFF">{value.rank ? `${value.rank.tied ? "T-" : ""}${value.rank.ordinal}/${value.rank.population} · ${value.rank.percentile.toFixed(1)} pct` : value.state === "undefined" ? (value.reason?.includes("zero denominator") ? "Undefined · zero denominator" : "Undefined · selected period") : value.state === "valid" ? "Rank unavailable · incomplete pool" : "Source unverified"}</text></g>; })}
      <g fill="#555D60" fontSize="18">
        <text x="40" y="820" fontSize="22" fontWeight="700" fill="#1A1D21">{gp} · {view.sample.toiSeconds === null ? "TOI unavailable" : `${(view.sample.toiSeconds / 60).toFixed(1)} min TOI`} · {view.sample.firstDate && view.sample.lastDate ? `${view.sample.firstDate} → ${view.sample.lastDate}` : "Window unverified"}</text>
        <text x="40" y="852">Source: local observed inputs · Evidence {view.evidenceState}</text>
        <text x="40" y="880">All NHL same-definition values · no GP, TOI or position threshold · {view.poolComplete ? "N varies by metric" : "pools unverified"}</text>
        <text x="40" y="908">Captured {view.capturedAt.slice(0, 16).replace("T", " ")} UTC · Cutoff {view.settings.cutoff.slice(0, 16).replace("T", " ")} UTC</text>
        <text x="40" y="939" fill="#744512">{view.exportable ? "Observed values and context · selected snapshot" : "Export blocked until sample context and metric inputs are verified"}</text>
        <text x="40" y="969" fontSize="16">Proposed season-only / short-sample / competition-midrank policies · Numeric magnitude ≠ quality</text><text x="1160" y="1000" textAnchor="end" fontSize="18" fontWeight="700">FHFHOCKEY.COM</text>
      </g>
    </g>
  </svg>;
}
