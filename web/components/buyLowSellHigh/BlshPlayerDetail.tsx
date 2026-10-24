import React, { useEffect, useRef } from "react";

import type { WatchRow, WatchTarget } from "lib/buyLowSellHigh/market";
import { TARGET_LABELS, type InterpretationRecord, type SkaterTarget } from "lib/skoElement/contract";
import { DIRECTION_TEXT, formatMeasured, reasonText } from "components/skoElement/format";
import shared from "components/skoElement/SkoElement.module.scss";
import styles from "./BlshPlayerDetail.module.scss";

const status = (value: string) => value.replace(/_/g, " ");

/**
 * Read-only detail for one watchlist candidate. Every value is passed through from the shared
 * interpretation record; nothing here derives volatility, confidence or duration.
 */
export default function BlshPlayerDetail({ id, record, row, target, inCurrentList, onClose }: {
  id: string; record: InterpretationRecord; row: WatchRow | null; target: WatchTarget; inCurrentList: boolean; onClose: () => void;
}) {
  const headingRef = useRef<HTMLHeadingElement>(null);
  useEffect(() => { headingRef.current?.focus(); }, [record.identity.playerId]);

  const opportunity = record.opportunity;
  const metric = target === "LEAGUE_POINTS" ? null : record.metrics.find(item => item.target === target) ?? null;
  const targetLabel = target === "LEAGUE_POINTS" ? "fixture league points" : TARGET_LABELS[target as SkaterTarget];
  const headingId = `${id}-heading`;

  return (
    <section id={id} className={`${shared.detail} ${styles.detail}`} aria-labelledby={headingId}
      onKeyDown={event => { if (event.key === "Escape") { event.stopPropagation(); onClose(); } }}>
      <div className={styles.detailHeader}>
        <div>
          <h2 id={headingId} ref={headingRef} tabIndex={-1} className={styles.heading}>{record.identity.name}</h2>
          <p className={shared.muted}>{record.identity.team ?? "Team unavailable"} · {record.identity.modelClass} · {record.identity.eligibility.join("/") || "eligibility unavailable"}</p>
        </div>
        <button type="button" className={`${shared.smallButton} ${styles.touchButton}`} onClick={onClose}>
          Close<span className={shared.visuallyHidden}> details for {record.identity.name}</span>
        </button>
      </div>
      {!inCurrentList ? <p className={shared.warn}>Not in the current list for these settings; details still reflect the selected horizon.</p> : null}

      <div className={shared.grid}>
        <div className={shared.panel}>
          <h3>Gap ({targetLabel}, next {record.horizon.requestedGames})</h3>
          {row ? (
            <ul className={shared.list}>
              <li>Recent per team game: {formatMeasured(row.observed)}</li>
              <li>Expected per team game: {formatMeasured(row.expected)}</li>
              <li>Gap: <span className={shared[row.direction]}>{formatMeasured(row.gap, 2, true)} · {DIRECTION_TEXT[row.direction]}</span></li>
            </ul>) : <p className={shared.muted}>Gap unavailable for this player.</p>}
          <p className={shared.muted}>Included by the sign of the shared gap only; not a buy or sell recommendation.</p>
        </div>

        <div className={shared.panel}>
          <h3>Opportunity and observed duration</h3>
          {opportunity ? (
            <ul className={shared.list}>
              <li>{opportunity.label}</li>
              <li>Recent block {opportunity.recent.startDate ?? "unknown"} to {opportunity.recent.endDate ?? "unknown"}: {opportunity.recent.appearances} appearances in {opportunity.recent.teamGames} team games, TOI {formatMeasured(opportunity.recent.toiPerAppearance)} min per appearance.</li>
              <li>Change versus prior block: TOI {formatMeasured(opportunity.toiChangeMinutes, 2, true)} min, PP TOI {formatMeasured(opportunity.ppToiChangeMinutes, 2, true)} min per appearance.</li>
              <li>PP role: {opportunity.powerPlayRole.status === "sourced" ? `${opportunity.powerPlayRole.value} (${opportunity.powerPlayRole.source})` : "Unavailable: no dated role source"}.</li>
              <li>Observed duration: {opportunity.observedDuration.appearances} appearances ({opportunity.observedDuration.startDate ?? "unknown"} to {opportunity.observedDuration.endDate ?? "unknown"}). History only; not a forecast of how long it lasts.</li>
              <li>Rule: {opportunity.ruleId ?? "none accepted"} ({status(opportunity.ruleStatus)}).</li>
            </ul>) : <p className={shared.muted}>Opportunity unavailable for this record.</p>}
        </div>

        <div className={shared.panel}>
          <h3>Variability and confidence</h3>
          <ul className={shared.list}>
            {metric || record.metrics.length ? (
              <li>Observed game-to-game SD ({metric ? metric.label : "per category"}): {metric
                ? `${formatMeasured(metric.observedVariability)}${metric.sparse ? " · sparse sample" : ""}`
                : record.metrics.map(item => `${item.label} ${formatMeasured(item.observedVariability)}`).join("; ")}. Recent history, not forecast volatility.</li>
            ) : <li>Observed game-to-game SD: unavailable for this record.</li>}
            <li>Predictive spread: {formatMeasured(record.uncertainty.predictiveSpread)}.</li>
            <li>Mean uncertainty: {formatMeasured(record.uncertainty.meanUncertainty)}.</li>
            <li>Confidence: not supplied. No confidence rating is derived on this page.</li>
          </ul>
        </div>
      </div>

      <div className={shared.panel}>
        <h3>Source, as-of and coverage</h3>
        <ul className={shared.list}>
          <li>{record.fixture ? "Fixture record (synthetic)" : "Supplied record"} as of {record.asOf}; contract {record.contractVersion}; config {record.config.configId} v{record.config.version} ({status(record.config.status)}).</li>
          <li>Evidence {record.identity.evidenceSnapshotId}: cutoff {record.freshness.evidenceCutoffAt}, age {record.freshness.evidenceAgeHours?.toFixed(0) ?? "unknown"} h ({record.freshness.evidenceStatus}){record.diagnostics.retrospective ? ", retrospective availability" : ""}.</li>
          <li>Forecast {record.identity.forecastVersion}, manifest {record.identity.forecastManifestId ?? "unknown"}, read {record.identity.forecastReadAsOf}, expires {record.freshness.forecastExpiresAt ?? "unknown"} ({record.freshness.forecastStatus}).</li>
          <li>Horizon: {record.horizon.scheduledGames} of {record.horizon.requestedGames} requested team games scheduled ({record.horizon.startDate ?? "unknown"} to {record.horizon.endDate ?? "unknown"}){record.horizon.reason ? `: ${reasonText(record.horizon.reason)}` : ""}.</li>
          <li>Recent window: {record.recentWindow.appearances} appearances, {record.recentWindow.confirmedAbsences} confirmed absences and {record.recentWindow.unknownGames} unknown of {record.recentWindow.teamGames} team games.</li>
          {record.diagnostics.duplicateRows || record.diagnostics.conflictingGameIds.length || record.diagnostics.invalidRows ? (
            <li className={shared.warn}>Source rows: {record.diagnostics.duplicateRows} duplicate, {record.diagnostics.invalidRows} invalid, {record.diagnostics.conflictingGameIds.length} conflicting games.</li>) : null}
        </ul>
        <h3>Limitations</h3>
        <ul className={shared.list}>{record.limitations.map(item => <li key={item}>{item}</li>)}</ul>
      </div>
    </section>
  );
}
