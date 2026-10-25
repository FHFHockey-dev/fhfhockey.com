import React from "react";
import type { MetricId, PlayerCardSnapshot } from "../../lib/player-cards/contracts";
import { CATEGORIES, CURATED_METRICS, METRICS } from "../../lib/player-cards/registry";
import styles from "./PlayerCard.module.scss";

export function formatMetric(id: MetricId, value: number | null) {
  if (value === null) return "—";
  if (id === "atoi") {
    const seconds = Math.round(value * 60);
    return `${Math.floor(seconds / 60)}:${String(seconds % 60).padStart(2, "0")}`;
  }
  const definition = METRICS.find(metric => metric.id === id)!;
  return `${value.toFixed(definition.precision)}${definition.unit === "%" ? "%" : ""}`;
}

export default function PlayerCard({ snapshot, selected = CURATED_METRICS, svgRef }: {
  snapshot: PlayerCardSnapshot; selected?: readonly MetricId[]; svgRef?: React.Ref<SVGSVGElement>;
}) {
  const groups = CATEGORIES.map(category => ({ category, metrics: METRICS.filter(metric => metric.category === category && selected.includes(metric.id)) }));
  const longName = snapshot.player.name.length > 25;
  const words = snapshot.player.name.split(" ");
  const sample = snapshot.sample;
  const description = `${snapshot.player.name}. Synthetic example only. ${sample.gp} of ${sample.requested} own appearances, All Strengths. ${snapshot.readings.filter(reading => selected.includes(reading.id)).map(reading => `${METRICS.find(metric => metric.id === reading.id)!.label}: ${formatMetric(reading.id, reading.value)}; ${reading.rank ? `${reading.rank.tied ? "tied " : ""}rank ${reading.rank.ordinal} of ${reading.rank.population}; ${reading.rank.percentile.toFixed(1)} percentile` : reading.reason || reading.rankReason || "rank unavailable"}`).join(". ")}`;
  return <svg ref={svgRef} className={styles.card} viewBox="0 0 1080 1080" xmlns="http://www.w3.org/2000/svg" role="img" aria-label={description} data-snapshot-id={snapshot.id}>
    <title>FHFH player card — synthetic example</title>
    <desc>{description}. Numeric percentile is magnitude, not quality or a forecast. Proposed competition ranks and empirical midrank percentiles.</desc>
    <rect width="1080" height="1080" fill="#1A1D21" />
    <rect width="1080" height="9" fill="#07AAE2" />
    <g fontFamily="Arial, sans-serif" fill="#F4F8FB">
      <text x="48" y="65" fontSize="29" fontWeight="800" letterSpacing="3">FHFH <tspan fill="#A7B4C0" fontWeight="400" letterSpacing="1">/ PLAYER CARD</tspan></text>
      <rect x="671" y="32" width="361" height="49" rx="10" fill="#BDEFFF" />
      <text x="851" y="64" textAnchor="middle" fontSize="23" fontWeight="700" fill="#101214">SYNTHETIC EXAMPLE</text>
      {longName ? <text x="48" y="137" fontSize="44" fontWeight="800"><tspan x="48">{words[0]}</tspan><tspan x="48" dy="49">{words.slice(1).join(" ")}</tspan></text> : <text x="48" y="158" fontSize="68" fontWeight="800">{snapshot.player.name}</text>}
      <text x="48" y="225" fill="#A7B4C0" fontSize="27">{snapshot.player.team} · {snapshot.player.position} · Portrait-free example</text>
      {groups.map(({ category, metrics }, index) => {
        const x = index < 2 ? 48 : 566;
        const y = [276, 436, 276, 540][index];
        return <g key={category} transform={`translate(${x} ${y})`}>
          <text fill="#63D2F5" fontSize="25" fontWeight="700">{category.toUpperCase()}</text>
          {metrics.map((metric, row) => {
            const reading = snapshot.readings.find(value => value.id === metric.id)!;
            const rank = reading.rank;
            return <g key={metric.id} transform={`translate(0 ${row * 94 + 20})`}>
              <title>{metric.help}. {metric.unit}</title>
              <text y="28" fontSize="27" fontWeight="600">{metric.label}</text>
              <text x="464" y="28" textAnchor="end" fontSize="38" fontWeight="700">{formatMetric(metric.id, reading.value)}</text>
              <text y="57" fontSize="21" fill="#A7B4C0">{reading.value === null ? reading.reason : metric.id === "atoi" ? "min:sec per appearance" : metric.unit}</text>
              {rank ? <>
                <text y="83" fontSize="23" fill="#D9E2EA">{rank.tied ? "T-" : ""}{rank.ordinal} of {rank.population} <tspan fill="#63D2F5"> · {rank.percentile.toFixed(1)} pct</tspan></text>
                <rect x="0" y="89" width="464" height="3" fill="#2F353D" />
                <rect x="0" y="89" width={464 * rank.percentile / 100} height="3" fill="#35B9EA" />
              </> : <text y="83" fontSize="20" fill="#FFC857">{reading.value === null ? "Value and rank unavailable" : "Rank unavailable · coverage incomplete"}</text>}
            </g>;
          })}
        </g>;
      })}
      <line x1="48" x2="1032" y1="778" y2="778" stroke="#2F353D" strokeWidth="2" />
      <text x="48" y="820" fontSize="31" fontWeight="700">Own L10 appearances · All Strengths</text>
      <text x="48" y="858" fontSize="25" fill="#D9E2EA">{sample.gp} of {sample.requested} GP · {(sample.toiSeconds / 60).toFixed(1)} min TOI · {sample.firstDate} → {sample.lastDate}</text>
      <text x="48" y="894" fontSize="23" fill={sample.warning ? "#FFC857" : "#A7B4C0"}>{sample.warning || "Each player's own appearance dates can differ. Regular season example."}</text>
      <text x="48" y="932" fontSize="22" fill="#A7B4C0">Game cutoff: 23 Oct 2026, 23:59:59 UTC · Snapshot: 24 Oct, 12:00 UTC</text>
      <text x="48" y="969" fontSize="23" fill="#D9E2EA">Example pool: all valid same-definition values; no GP, TOI or position filter.</text>
      <text x="48" y="1003" fontSize="21" fill="#A7B4C0">Fabricated values and cohort · Numeric magnitude, not quality or a forecast.</text>
      <text x="48" y="1042" fontSize="21" fill="#63D2F5">Proposed layout, L10/defaults, competition ties and midrank percentiles · fhfhockey.com</text>
    </g>
  </svg>;
}

