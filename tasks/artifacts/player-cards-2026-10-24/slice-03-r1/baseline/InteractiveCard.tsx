import React from "react";
import type { MetricId } from "../../lib/player-cards/contracts";
import type { FlowSnapshot } from "../../lib/player-cards/interactionSnapshot";
import { CATEGORIES, METRICS } from "../../lib/player-cards/registry";
import { formatMetric } from "./PlayerCard";
import styles from "./PlayerCardFlow.module.scss";

export function periodLabel(snapshot: FlowSnapshot) { const period = snapshot.settings.period; return period.mode === "appearances" ? `Own L${period.count} appearances` : `${period.start} to ${period.end} · UTC`; }
export function strengthLabel(snapshot: FlowSnapshot) { return snapshot.settings.strength === "all" ? "All Strengths" : snapshot.settings.strength === "pp" ? "Power play" : "5v5"; }
export default function InteractiveCard({ snapshot, selected, svgRef }: { snapshot: FlowSnapshot; selected: readonly MetricId[]; svgRef: React.Ref<SVGSVGElement> }) {
  const sample = snapshot.sample, long = snapshot.player.name.length > 25, names = snapshot.player.name.split(" ");
  return <svg ref={svgRef} className={styles.flowCard} viewBox="0 0 1080 1080" xmlns="http://www.w3.org/2000/svg" role="img" aria-label={`${snapshot.player.name}. Synthetic fixture. ${periodLabel(snapshot)}. ${strengthLabel(snapshot)}. ${sample.gp} actual appearances.`} data-snapshot-id={snapshot.id}>
    <title>Synthetic player card · {snapshot.player.name}</title>
    <rect width="1080" height="1080" fill="#1A1D21" /><rect width="1080" height="9" fill="#07AAE2" />
    <g fontFamily="Arial, sans-serif" fill="#F4F8FB">
      <text x="48" y="65" fontSize="29" fontWeight="800">FHFH / PLAYER CARD</text><rect x="671" y="32" width="361" height="49" rx="10" fill="#BDEFFF" /><text x="851" y="64" textAnchor="middle" fontSize="23" fontWeight="700" fill="#101214">SYNTHETIC FIXTURE</text>
      {long ? <text x="48" y="137" fontSize="44" fontWeight="800"><tspan x="48">{names[0]}</tspan><tspan x="48" dy="49">{names.slice(1).join(" ")}</tspan></text> : <text x="48" y="158" fontSize="68" fontWeight="800">{snapshot.player.name}</text>}
      <text x="48" y="225" fontSize="27" fill="#A7B4C0">{snapshot.player.team} · {snapshot.player.position} · Example ID {snapshot.player.id}</text>
      {CATEGORIES.map((category, index) => <g key={category} transform={`translate(${index < 2 ? 48 : 566} ${[276,436,276,540][index]})`}>
        <text fill="#63D2F5" fontSize="25" fontWeight="700">{category.toUpperCase()}</text>
        {METRICS.filter(metric => metric.category === category && selected.includes(metric.id)).map((metric, row) => {
          const value = snapshot.readings.find(reading => reading.id === metric.id)!;
          return <g key={metric.id} transform={`translate(0 ${row * 94 + 20})`}><title>{metric.help}</title><text y="28" fontSize="27">{metric.label}</text><text x="464" y="28" textAnchor="end" fontSize="38" fontWeight="700">{formatMetric(metric.id,value.value)}</text><text y="57" fontSize="21" fill="#A7B4C0">{metric.id === "atoi" ? "min:sec per appearance" : metric.unit}</text><text y="83" fontSize="22" fill={value.rank ? "#63D2F5" : "#FFC857"}>{value.rank ? `${value.rank.tied ? "T-" : ""}${value.rank.ordinal} of ${value.rank.population} · ${value.rank.percentile.toFixed(1)} pct` : value.state === "valid" ? "Rank unavailable · incomplete pool" : "Unavailable · see sample/source state"}</text></g>;
        })}
      </g>)}
      <line x1="48" x2="1032" y1="778" y2="778" stroke="#2F353D" strokeWidth="2" />
      <text x="48" y="819" fontSize={snapshot.settings.period.mode === "calendar" ? 28 : 31} fontWeight="700">{periodLabel(snapshot)} · {strengthLabel(snapshot)}</text>
      <text x="48" y="858" fontSize="25">{sample.gp === null ? "GP unverified" : snapshot.settings.period.mode === "appearances" ? `${sample.gp} of ${sample.requested} GP` : `${sample.gp} GP`} · {sample.toiSeconds === null ? "TOI unavailable" : `${(sample.toiSeconds/60).toFixed(1)} min TOI`} · {sample.firstDate} → {sample.lastDate}</text>
      <text x="48" y="894" fontSize="23" fill="#FFC857">{sample.warning || (snapshot.readings.some(row => row.state === "missing") ? "Source incomplete · affected values and ranks withheld" : snapshot.settings.period.mode === "calendar" ? "Shared calendar dates · actual GP can differ · no hidden sample filter" : "Own appearance spans may differ across players · no hidden sample filter")}</text>
      <text x="48" y="932" fontSize="22" fill="#A7B4C0">Cutoff: {snapshot.settings.cutoff.replace("T"," ")} · Capture: {snapshot.capturedAt.slice(5,16).replace("T"," ")} UTC</text>
      <text x="48" y="969" fontSize="23">Fabricated 18-player cohort · per-metric valid N · no GP, TOI or position filter</text>
      <text x="48" y="1003" fontSize="21" fill="#A7B4C0">Source/identities/games are synthetic · numeric magnitude is not quality or a forecast</text>
      <text x="48" y="1042" fontSize="21" fill="#63D2F5">Proposed season/short-N policy, competition ties and midrank percentiles · fhfhockey.com</text>
    </g>
  </svg>;
}
