import React from "react";
import type { MetricId, MetricReading } from "../../lib/player-cards/contracts";
import type { FlowSnapshot } from "../../lib/player-cards/interactionSnapshot";
import { METRICS } from "../../lib/player-cards/registry";
import { formatMetric } from "./PlayerCard";
import { periodLabel, strengthLabel } from "./InteractiveCard";

export const EDITORIAL_SIZE = { width: 1200, height: 900 } as const;
export const EDITORIAL_METRICS: readonly MetricId[] = ["atoi", "sog60", "iscf60", "ixg60", "xgf60", "xgPct", "ipp", "shPct", "oiShPct"];
const PROFILE_ROWS: { id: MetricId; label: string; y: number }[] = [
  { id: "atoi", label: "Ice time / game", y: 313 },
  { id: "sog60", label: "Shots /60", y: 394 },
  { id: "iscf60", label: "Chances /60", y: 456 },
  { id: "ixg60", label: "Expected goals /60", y: 518 },
  { id: "xgf60", label: "Expected goals for /60", y: 599 },
];
const RATIO_ROWS: { id: MetricId; label: string }[] = [
  { id: "xgPct", label: "ON-ICE xG%" }, { id: "ipp", label: "IPP" },
  { id: "shPct", label: "SHOOTING%" }, { id: "oiShPct", label: "ON-ICE SHOOTING%" },
];

function unavailableLabel(reading: MetricReading) {
  if (reading.state === "valid") return "Rank unavailable · incomplete pool";
  if (reading.state === "undefined") {
    if (reading.reason?.includes("Zero denominator")) return "Undefined · zero denominator";
    if (reading.reason?.includes("full-N policy")) return "Undefined · full-N policy";
    if (reading.reason?.includes("No completed appearances")) return "Undefined · no appearances";
    return "Undefined · selected period policy";
  }
  if (reading.reason?.includes("Game events") || reading.reason?.includes("Game ratio")) return "Invalid source · inconsistent inputs";
  return reading.reason?.includes("Required component") ? "Missing source · incomplete inputs" : "Missing source · unverified inputs";
}

function rawRank(reading: MetricReading) {
  return reading.rank ? `${reading.rank.tied ? "T-" : ""}${reading.rank.ordinal}/${reading.rank.population}` : "—";
}

/** First visual checkpoint only; consumes the accepted synthetic snapshot unchanged. */
export default function EditorialPlayerCard({ snapshot, svgRef, header, headerHeight = 218, artworkDescription }: { snapshot: FlowSnapshot; svgRef?: React.Ref<SVGSVGElement>; header?: React.ReactNode; headerHeight?: number; artworkDescription?: string }) {
  const extraHeight = header ? headerHeight - 218 : 0;
  const reading = (id: MetricId) => snapshot.readings.find(row => row.id === id)!;
  const sample = snapshot.sample, period = snapshot.settings.period;
  const season = String(snapshot.settings.season);
  const gp = sample.gp === null ? "GP unverified" : period.mode === "appearances" ? `${sample.gp}/${sample.requested} GP` : `${sample.gp} GP`;
  const warnings = [sample.warning, EDITORIAL_METRICS.some(id => reading(id).state === "missing") ? "Missing source" : "", EDITORIAL_METRICS.some(id => reading(id).state === "undefined") ? "Some metrics undefined" : ""].filter(Boolean);
  const description = `${snapshot.player.name}. Synthetic fixture. ${snapshot.player.team}, ${snapshot.player.position}. ${periodLabel(snapshot)}. ${strengthLabel(snapshot)}. ${sample.gp === null ? "GP unverified" : `${sample.gp} actual appearances`}. ${EDITORIAL_METRICS.map(id => {
    const value = reading(id), metric = METRICS.find(row => row.id === id)!;
    return `${metric.help}: actual value ${formatMetric(id, value.value)}; ${value.rank ? `${value.rank.tied ? "tied " : ""}rank ${value.rank.ordinal} of ${value.rank.population}; percentile ${value.rank.percentile.toFixed(1)}` : unavailableLabel(value)}${value.reason ? ` (${value.reason})` : ""}`;
  }).join(". ")}`;
  const names = snapshot.player.name.split(" ");
  const longName = snapshot.player.name.length > 24;
  return <svg ref={svgRef} viewBox={`0 0 1200 ${900 + extraHeight}`} width="1200" height={900 + extraHeight} xmlns="http://www.w3.org/2000/svg" role="img" aria-label={description} data-snapshot-id={snapshot.id} data-renderer="fhfh-editorial-checkpoint-01">
    <title>FHFH player report · {snapshot.player.name} · synthetic fixture</title>
    <desc>{artworkDescription ? `${artworkDescription}. ` : ""}{description}. Bars and percentile numbers describe numeric magnitude, not quality or a forecast. Proposed competition ranks and midrank percentiles.</desc>
    <rect width="1200" height={900 + extraHeight} fill="#F2F1EB" />
    <rect width="1200" height="218" fill="#1A1D21" />
    <rect width="9" height="218" fill="#07AAE2" />
    <g fontFamily="Arial, sans-serif" style={{ fontVariantNumeric: "tabular-nums" }}>
      {header ?? <>
      <text x="40" y="45" fontSize="27" fontWeight="900" letterSpacing="2" fill="#07AAE2">FHFH</text>
      <text x="134" y="44" fontSize="17" letterSpacing="3" fill="#C6C9CA">/ PLAYER REPORT</text>
      <text x="1160" y="44" textAnchor="end" fontSize="18" fontWeight="700" letterSpacing="1.5" fill="#80DFFF">SYNTHETIC FIXTURE</text>
      {longName ? <text x="40" y="112" fontFamily="Georgia, serif" fontSize="44" fontWeight="700" fill="#F2F1EB"><tspan x="40">{names[0]}</tspan><tspan x="40" dy="47">{names.slice(1).join(" ")}</tspan></text> : <text x="36" y="149" fontFamily="Georgia, serif" fontSize="94" fontWeight="700" letterSpacing="-4" fill="#F2F1EB">{snapshot.player.name}</text>}
      <rect x="40" y="181" width="26" height="4" fill="#A87753" />
      <text x="78" y="192" fontSize="24" fill="#D1D2CE">{snapshot.player.team} · {snapshot.player.position}</text>
      <text x="1160" y="105" textAnchor="end" fontSize="38" fontWeight="700" fill="#F2F1EB">{season.slice(0, 4)}–{season.slice(6)}</text>
      {period.mode === "appearances" ? <text x="1160" y="149" textAnchor="end" fontSize="24" fontWeight="700" letterSpacing="1" fill="#F2F1EB">OWN LAST {period.count}</text> : <text x="1160" y="136" textAnchor="end" fontSize="19" fontWeight="700" fill="#F2F1EB"><tspan x="1160">{period.start} →</tspan><tspan x="1160" dy="25">{period.end} · UTC</tspan></text>}
      <text x="1160" y="190" textAnchor="end" fontSize="23" fill="#C6C9CA">{strengthLabel(snapshot)}</text>

      </>}
      <g transform={extraHeight ? `translate(0 ${extraHeight})` : undefined}>
      <g fill="#1A1D21">
        <text x="40" y="258" fontSize="18" fontWeight="700" letterSpacing="1.6">STATISTICAL PROFILE</text>
        <text x="620" y="258" textAnchor="end" fontSize="18" fontWeight="700">ACTUAL</text>
        <text x="758" y="258" textAnchor="end" fontSize="18" fontWeight="700">RANK / N</text>
        <text x="1160" y="258" textAnchor="end" fontSize="18" fontWeight="700">PERCENTILE</text>
        <line x1="40" x2="1160" y1="275" y2="275" stroke="#C7C9C5" />
        <g fontSize="20" fontWeight="700" letterSpacing=".5" fill="#555D60">
          <text x="40" y="308">DEPLOYMENT</text>
          <text x="40" y="390"><tspan x="40">INDIVIDUAL</tspan><tspan x="40" dy="25">CHANCE</tspan><tspan x="40" dy="25">CREATION</tspan></text>
          <text x="40" y="594"><tspan x="40">ON-ICE</tspan><tspan x="40" dy="25">RESULTS</tspan></text>
        </g>
        {PROFILE_ROWS.map(row => {
          const value = reading(row.id), rank = value.rank;
          return <g key={row.id} data-metric-id={row.id} transform={`translate(0 ${row.y})`}>
            <title>{METRICS.find(metric => metric.id === row.id)!.help}. {value.reason || "Actual value and same-pool rank/percentile."}</title>
            <text x="234" fontSize={row.id === "xgf60" ? 25 : 28}>{row.label}</text>
            <text x="620" textAnchor="end" fontSize="37" fontWeight="700" data-actual-value="true">{formatMetric(row.id, value.value)}</text>
            {rank ? <>
              <text x="758" textAnchor="end" fontSize="26" fill="#555D60" data-raw-rank="true">{rawRank(value)}</text>
              <rect x="800" y="-22" width="274" height="17" fill="#D9DDDA" />
              <rect x="800" y="-22" width={274 * rank.percentile / 100} height="17" fill="#07AAE2" data-percentile-bar="true" />
              <line x1="937" x2="937" y1="-25" y2="-2" stroke="#1A1D21" strokeOpacity=".22" />
              <text x="1160" textAnchor="end" fontSize="28" fontWeight="700" data-percentile="true">{rank.percentile.toFixed(1)}</text>
            </> : <text x="800" y="-5" fontSize="18" fill="#744512" data-unavailable="true"><tspan x="800">{unavailableLabel(value).split(" · ")[0]}</tspan><tspan x="800" dy="21">{unavailableLabel(value).split(" · ")[1]}</tspan></text>}
            {row.id === "atoi" && <text x="234" y="24" fontSize="17" fill="#555D60">minutes:seconds per appearance</text>}
          </g>;
        })}
        {[352, 558].map(y => <line key={y} x1="40" x2="1160" y1={y} y2={y} stroke="#C7C9C5" />)}
      </g>

      <rect x="0" y="642" width="1200" height="140" fill="#1A1D21" />
      <text x="40" y="669" fontSize="17" fontWeight="700" letterSpacing="1.5" fill="#80DFFF">ACTUAL PERCENTAGES</text>
      <text x="1160" y="669" textAnchor="end" fontSize="16" fill="#C6C9CA">Actual ratio first · rank and percentile below</text>
      {RATIO_ROWS.map((row, index) => {
        const value = reading(row.id), x = 40 + index * 286;
        return <g key={row.id} data-metric-id={row.id} transform={`translate(${x} 0)`}>
          <title>{METRICS.find(metric => metric.id === row.id)!.help}. {value.reason || "Actual percentage, not a percentile."}</title>
          <text y="701" fontSize="19" fontWeight="700" fill="#C6C9CA">{row.label}</text>
          <text y="741" fontSize="40" fontWeight="700" fill="#F2F1EB" data-actual-value="true">{formatMetric(row.id, value.value)}</text>
          {value.rank ? <text y="768" fontSize="19" fill="#80DFFF"><tspan data-raw-rank="true">Rank {rawRank(value)}</tspan><tspan data-percentile="true"> · {value.rank.percentile.toFixed(1)} pct</tspan></text> : <text y="765" fontSize="14" fill="#FFD28D" data-unavailable="true">{unavailableLabel(value)}</text>}
        </g>;
      })}

      <g fill="#555D60" fontSize="18">
        <text x="40" y="813" fontSize="20" fontWeight="700" fill="#1A1D21">{gp} · {sample.toiSeconds === null ? "TOI unavailable" : `${(sample.toiSeconds / 60).toFixed(1)} min TOI`} · {sample.firstDate} → {sample.lastDate}</text>
        <text x="1160" y="813" textAnchor="end" fontSize="17" fill="#744512">{warnings.length ? warnings.join(" · ") : "Regular season · own spans may differ"}</text>
        <text x="40" y="838">Fabricated 18-player cohort · all valid same-definition values · no GP, TOI or position filter · N varies by metric</text>
        <text x="40" y="861" fontSize="17">Source: synthetic fixture · Updated {snapshot.capturedAt.slice(0, 16).replace("T", " ")} UTC · Cutoff {snapshot.settings.cutoff.slice(0, 16).replace("T", " ")} UTC</text>
        <text x="40" y="885" fontSize="16">Proposed: season-only, {snapshot.settings.shortSamplePolicy === "allow-known-short-proposed" ? "known-short allowed" : "full-N required"}, competition ties, midrank percentile · Numeric magnitude ≠ quality · fhfhockey.com</text>
      </g>
      </g>
    </g>
  </svg>;
}
