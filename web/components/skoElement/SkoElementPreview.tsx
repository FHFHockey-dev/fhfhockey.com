import React, { useMemo } from "react";

import {
  DEFAULT_HORIZON, HORIZON_OPTIONS, RECENT_WINDOW_OPTIONS, SKATER_TARGETS, TARGET_LABELS,
  type HorizonGames, type InterpretationRecord, type ModelClass, type RecentWindowGames, type SkaterTarget,
} from "lib/skoElement/contract";
import { FIXTURE_DISCLAIMER, FIXTURE_CONFIG, fixtureRecords } from "lib/skoElement/fixtures";
import { formatMeasured, perTeamGameUnit, percent, reasonText } from "./format";
import styles from "./SkoElement.module.scss";

export type SkoViewState = {
  view: ModelClass; horizon: HorizonGames; recent: RecentWindowGames; target: SkaterTarget; q: string; player: string | null;
};

export const DEFAULT_SKO_STATE: SkoViewState = {
  view: "F", horizon: DEFAULT_HORIZON, recent: FIXTURE_CONFIG.recentWindowTeamGames, target: "POINTS", q: "", player: null,
};

const first = (value: string | string[] | undefined) => (Array.isArray(value) ? value[0] : value);

/** Reads shareable URL state; invalid values fall back to defaults and are reported, never guessed. */
export function parseSkoState(query: Record<string, string | string[] | undefined>): { state: SkoViewState; invalid: string[] } {
  const invalid: string[] = [];
  const pick = <T,>(key: string, allowed: readonly T[], fallback: T, cast: (raw: string) => T): T => {
    const raw = first(query[key]);
    if (raw === undefined) return fallback;
    const value = cast(raw);
    if (allowed.includes(value)) return value;
    invalid.push(key);
    return fallback;
  };
  return {
    state: {
      view: pick("view", ["F", "D", "G"] as ModelClass[], DEFAULT_SKO_STATE.view, raw => raw as ModelClass),
      horizon: pick("horizon", HORIZON_OPTIONS, DEFAULT_SKO_STATE.horizon, raw => Number(raw) as HorizonGames),
      recent: pick("recent", RECENT_WINDOW_OPTIONS, DEFAULT_SKO_STATE.recent, raw => Number(raw) as RecentWindowGames),
      target: pick("target", SKATER_TARGETS, DEFAULT_SKO_STATE.target, raw => raw as SkaterTarget),
      q: first(query.q) ?? "",
      player: first(query.player) ?? null,
    },
    invalid,
  };
}

/** Explicit, stable order: signed gap descending, unavailable gaps last, then name and id. */
export function orderRows(records: InterpretationRecord[], target: SkaterTarget) {
  const gap = (record: InterpretationRecord) => record.metrics.find(metric => metric.target === target)?.gapPerTeamGame.value ?? null;
  return [...records].sort((a, b) => {
    const ga = gap(a), gb = gap(b);
    if (ga === null && gb !== null) return 1;
    if (gb === null && ga !== null) return -1;
    return (ga !== null && gb !== null ? gb - ga : 0) || a.identity.name.localeCompare(b.identity.name) || a.identity.playerId.localeCompare(b.identity.playerId);
  });
}

const VIEW_LABEL: Record<ModelClass, string> = { F: "Forwards", D: "Defense", G: "VuDu goalies" };

function SkaterDetail({ record, target }: { record: InterpretationRecord; target: SkaterTarget }) {
  const opportunity = record.opportunity!;
  const reference = record.personalReferenceWindow;
  const selected = record.metrics.find(metric => metric.target === target)!;
  const unit = perTeamGameUnit(selected.label).toLowerCase();
  const ipp = record.ipp;
  return (
    <>
      <div className={styles.panel}>
        <h3>Current production versus this player’s prior block</h3>
        <p>Personal reference: {reference.startDate ?? "unavailable"} to {reference.endDate ?? "unavailable"}; {reference.appearances} appearances in {reference.teamGames} team games, {reference.unknownGames} unknown. These games precede the current window.</p>
        <ul className={styles.list}>{record.metrics.map(metric => <li key={metric.target}>
          {metric.label}: current {formatMeasured(metric.observedPerTeamGame)} versus prior {formatMeasured(metric.personalReference.perTeamGame)} per team game
          (change {formatMeasured(metric.personalReference.changePerTeamGame, 2, true)}); per appearance {formatMeasured(metric.observedPerAppearance)} versus {formatMeasured(metric.personalReference.perAppearance)}.
        </li>)}</ul>
        <p className={styles.muted}>A short prior block is an observed comparison, not an established talent estimate. A supported breakout is not an automatic sell; a persistent downturn is not an automatic buy.</p>
      </div>
      <div className={styles.panel}>
        <h3>Forecast comparison and current support</h3>
        <ul className={styles.list} aria-label={`Separate comparisons for ${selected.label}`}>
          <li>Forecast minus recent: {formatMeasured(selected.comparisons.forecastVsRecent, 2, true)}{selected.comparisons.forecastVsRecent.value !== null ? ` ${unit}` : ""}</li>
          <li>Recent minus earlier block: {formatMeasured(selected.comparisons.recentVsPersonalReference, 2, true)}{selected.comparisons.recentVsPersonalReference.value !== null ? ` ${unit}` : ""}</li>
          <li>Recent versus same-window support: {formatMeasured(selected.comparisons.observedVsSameWindowSupport)}</li>
        </ul>
        <p className={styles.muted}>These answer different questions and are not combined into one score.</p>
        <ul className={styles.list}>{record.explanations.map(item => <li key={item.id}>{item.text}</li>)}</ul>
      </div>
      <div className={styles.tableWrap}>
        <table className={styles.table} aria-label="Observed and expected production by category">
          <thead><tr>
            <th>Category</th><th>Recent per team game</th><th>Recent per appearance</th><th>Expected per scheduled team game</th>
            <th>Expected per appearance (conditional)</th><th>Forecast − recent</th><th>Outlook change</th><th>Observed game-to-game SD</th>
          </tr></thead>
          <tbody>{record.metrics.map(metric => (
            <tr key={metric.target} aria-current={metric.target === target ? "true" : undefined}>
              <th scope="row">{metric.label}</th>
              <td className={styles.num}>{formatMeasured(metric.observedPerTeamGame)}</td>
              <td className={styles.num}>{formatMeasured(metric.observedPerAppearance)}</td>
              <td className={styles.num}>{formatMeasured(metric.expectedPerTeamGame)}</td>
              <td className={styles.num}>{formatMeasured(metric.expectedPerAppearanceConditional)}</td>
              <td className={styles.num}>{formatMeasured(metric.gapPerTeamGame, 2, true)}</td>
              <td className={styles.num}>{formatMeasured(metric.outlookChangePerTeamGame, 2, true)}</td>
              <td className={styles.num}>{formatMeasured(metric.observedVariability)}</td>
            </tr>))}
          </tbody>
        </table>
      </div>
      <div className={styles.grid}>
        <div className={styles.panel}>
          <h3>Opportunity</h3>
          <p>{opportunity.label}</p>
          <ul className={styles.list}>
            <li>Recent block {opportunity.recent.startDate} to {opportunity.recent.endDate}: {opportunity.recent.appearances} appearances in {opportunity.recent.teamGames} team games, TOI {formatMeasured(opportunity.recent.toiPerAppearance)} min, PP TOI {formatMeasured(opportunity.recent.ppToiPerAppearance)} min per appearance; {formatMeasured(opportunity.recent.toiPerTeamGame, 1)} min per team game.</li>
            <li>Prior block {opportunity.prior.startDate ?? "none"} to {opportunity.prior.endDate ?? "none"}: {opportunity.prior.appearances} appearances in {opportunity.prior.teamGames} team games, TOI {formatMeasured(opportunity.prior.toiPerAppearance)} min, PP TOI {formatMeasured(opportunity.prior.ppToiPerAppearance)} min per appearance; {formatMeasured(opportunity.prior.toiPerTeamGame, 1)} min per team game.</li>
            <li>Change: TOI {formatMeasured(opportunity.toiChangeMinutes, 2, true)} min, PP TOI {formatMeasured(opportunity.ppToiChangeMinutes, 2, true)} min per appearance; appearance share {percent(opportunity.prior.appearanceShare.value, 0)} to {percent(opportunity.recent.appearanceShare.value, 0)}.</li>
            <li>PP unit role: {opportunity.powerPlayRole.status === "sourced" ? `${opportunity.powerPlayRole.value} (${opportunity.powerPlayRole.source}, effective ${opportunity.powerPlayRole.effectiveAt?.slice(0, 10)}, known ${opportunity.powerPlayRole.knownAt?.slice(0, 10)})` : "Unavailable: no dated role source known by as-of"}.</li>
            <li>Role changes in the recent block: {opportunity.roleChanges.length ? opportunity.roleChanges.map(item => `${item.label} (effective ${item.effectiveAt.slice(0, 10)})`).join("; ") : "none reported"}{opportunity.roleEvidenceExcluded ? `; ${opportunity.roleEvidenceExcluded} report(s) excluded as not known by as-of` : ""}.</li>
            <li>Scenarios: {opportunity.scenarios.reason}</li>
            <li>Rule: {opportunity.ruleId ?? "none accepted"} ({opportunity.ruleStatus.replace(/_/g, " ")}). Blocks show comparison coverage, not how long a change has lasted.</li>
          </ul>
        </div>
        <div className={styles.panel}>
          <h3>IPP ({record.identity.modelClass === "F" ? "forward" : "defense"} reference, all situations)</h3>
          <ul className={styles.list}>
            <li>Observed: {formatMeasured(ipp.observed, 3)}{ipp.exposure.onIceGoalsFor !== null ? ` (${ipp.exposure.points} points on ${ipp.exposure.onIceGoalsFor} on-ice goals over ${ipp.exposure.appearances} appearances)` : ""}</li>
            <li>Own earlier block: {formatMeasured(ipp.personalReference, 3)}</li>
            <li>Class reference: {formatMeasured(ipp.reference, 3)} {ipp.referenceSource ? `(${ipp.referenceSource}${ipp.referenceMeta ? `, version ${ipp.referenceMeta.version}, cutoff ${ipp.referenceMeta.cutoffAt?.slice(0, 10) ?? "unknown"}` : ""})` : ""}</li>
            <li>Deviation: {formatMeasured(ipp.deviation, 3, true)}</li>
          </ul>
        </div>
      </div>
    </>
  );
}

function GoalieTable({ records }: { records: InterpretationRecord[] }) {
  return (
    <div className={styles.tableWrap}>
      <table className={styles.table} aria-label="VuDu goalie context">
        <thead><tr><th>Goalie and evidence window</th><th>Recent SV% (saves / shots)</th><th>Recent GAA (60 × GA / min)</th><th>Personal prior block</th><th>Observed job share</th>
          <th>Expected SV% (ratio of expected totals)</th><th>Expected GAA</th><th>Expected starts</th><th>Gap status</th></tr></thead>
        <tbody>{records.map(record => {
          const goalie = record.goalie!;
          return (
            <tr key={record.identity.playerId}>
              <th scope="row">{record.identity.name} <span className={styles.muted}>{record.identity.team}</span>
                <span className={styles.muted}>{record.recentWindow.startDate} to {record.recentWindow.endDate}; {goalie.observed.appearances} appearances, {goalie.observed.minutes ?? "unknown"} minutes. Evidence: {record.freshness.evidenceStatus}. Forecast: {record.freshness.forecastStatus}.</span></th>
              <td className={styles.num}>{percent(goalie.observed.savePercentage.value)} <span className={styles.muted}>{goalie.observed.saves ?? "?"}/{goalie.observed.shotsAgainst ?? "?"}</span></td>
              <td className={styles.num}>{formatMeasured(goalie.observed.goalsAgainstAverage)}</td>
              <td>{record.personalReferenceWindow.startDate ?? "Unavailable"} to {record.personalReferenceWindow.endDate ?? "unavailable"}; {goalie.personalReference.appearances} appearances.
                SV% {percent(goalie.personalReference.savePercentage.value)}; GAA {formatMeasured(goalie.personalReference.goalsAgainstAverage)}.</td>
              <td>Starts {formatMeasured(goalie.observed.starts, 0)}; relief {formatMeasured(goalie.observed.reliefAppearances, 0)}.
                Start share {percent(goalie.observed.startShare.value)} versus prior {percent(goalie.personalReference.startShare.value)}.</td>
              <td className={styles.num}>{percent(goalie.expected.savePercentage.value)}</td>
              <td className={styles.num}>{formatMeasured(goalie.expected.goalsAgainstAverage)}</td>
              <td className={styles.num}>{formatMeasured(goalie.expected.expectedStarts)}</td>
              <td className={styles.warn}>Pending goalie adapter: {goalie.gap.reason}</td>
            </tr>);
        })}</tbody>
      </table>
      <p className={styles.muted}>Results and job share are separate observations. Appearances do not establish starts. Small samples limit the comparison; quality-adjusted shot-stopping, team environment and timestamped starter announcements are unavailable here. A change in starts can alter fantasy volume without a change in save percentage. No hot-hand boost or workload penalty is applied.</p>
    </div>
  );
}

export default function SkoElementPreview({ state, onStateChange, invalid = [] }: {
  state: SkoViewState; onStateChange: (next: SkoViewState) => void; invalid?: string[];
}) {
  const records = useMemo(() => fixtureRecords(state.horizon, state.recent), [state.horizon, state.recent]);
  const set = (patch: Partial<SkoViewState>) => onStateChange({ ...state, ...patch });
  const inView = records.filter(record => record.identity.modelClass === state.view);
  const query = state.q.trim().toLowerCase();
  const visible = orderRows(inView.filter(record => !query || record.identity.name.toLowerCase().includes(query)), state.target);
  const selected = state.player ? records.find(record => record.identity.playerId === state.player) ?? null : null;
  const selectedHidden = !!selected && !visible.includes(selected);
  const horizonSpan = inView.find(record => record.horizon.startDate);

  return (
    <div className={styles.container}>
      <header>
        <h1 className={styles.title}>The Sko Element</h1>
        <p className={styles.subtitle}>Current production versus the player’s own prior block, with opportunity and evidence quality shown separately. FORGE provides an additional forecast comparison. No predictive score is shown.</p>
      </header>
      <p className={styles.fixtureBanner} role="note">{FIXTURE_DISCLAIMER}</p>
      {invalid.length ? <p className={styles.warn} role="alert">Ignored invalid link settings: {invalid.join(", ")}.</p> : null}

      <nav className={styles.tabs} aria-label="Player class">
        {(["F", "D", "G"] as ModelClass[]).map(view => (
          <button key={view} type="button" className={styles.tab} aria-pressed={state.view === view} onClick={() => set({ view })}>{VIEW_LABEL[view]}</button>
        ))}
      </nav>

      <div className={styles.controls}>
        <label className={styles.control}>Future horizon (scheduled team games)
          <select value={state.horizon} onChange={event => set({ horizon: Number(event.target.value) as HorizonGames })}>
            {HORIZON_OPTIONS.map(option => <option key={option} value={option}>{`Next ${option}${option === DEFAULT_HORIZON ? " (default)" : ""}`}</option>)}
          </select>
        </label>
        <label className={styles.control}>Recent window (completed team games, provisional)
          <select value={state.recent} onChange={event => set({ recent: Number(event.target.value) as RecentWindowGames })}>
            {RECENT_WINDOW_OPTIONS.map(option => <option key={option} value={option}>{`Last ${option}`}</option>)}
          </select>
        </label>
        {state.view !== "G" ? (
          <label className={styles.control}>Category
            <select value={state.target} onChange={event => set({ target: event.target.value as SkaterTarget })}>
              {SKATER_TARGETS.map(target => <option key={target} value={target}>{TARGET_LABELS[target]}</option>)}
            </select>
          </label>) : null}
        <label className={styles.control}>Search
          <input type="search" value={state.q} onChange={event => set({ q: event.target.value })} placeholder="Player name" />
        </label>
      </div>
      <p className={styles.muted}>
        {horizonSpan ? `Horizon: next ${state.horizon} scheduled team games from ${horizonSpan.horizon.startDate} (spans differ by team). ` : ""}
        Scheduled team games are not guaranteed appearances. Order: forecast minus recent, largest first; unavailable gaps last; ties by name. The signed difference is not an alert or advice.
      </p>

      {state.view === "G" ? <GoalieTable records={visible} /> : (
        <div className={styles.tableWrap}>
          <table className={styles.table} aria-label={`${VIEW_LABEL[state.view]} sustainability scan`}>
            <thead><tr>
              <th>Player</th><th>Recent per team game</th><th>Personal prior per team game</th><th>Expected per team game</th><th>Forecast − recent</th>
              <th>Opportunity</th><th className={styles.hideNarrow}>Observed SD</th><th>Evidence</th><th><span className={styles.visuallyHidden}>Details</span></th>
            </tr></thead>
            <tbody>{visible.map(record => {
              const metric = record.metrics.find(item => item.target === state.target)!;
              const open = state.player === record.identity.playerId;
              return (
                <tr key={record.identity.playerId}>
                  <th scope="row">{record.identity.name}<br /><span className={styles.muted}>{record.identity.team} · {record.identity.eligibility.join("/")}</span></th>
                  <td className={styles.num}>{formatMeasured(metric.observedPerTeamGame)}</td>
                  <td className={styles.num}>{formatMeasured(metric.personalReference.perTeamGame)}</td>
                  <td className={styles.num}>{formatMeasured(metric.expectedPerTeamGame)}</td>
                  <td className={styles.num}>
                    <span>{formatMeasured(metric.gapPerTeamGame, 2, true)}</span>
                    {metric.gapPerTeamGame.value !== null ? <><br /><span className={styles.muted}>{perTeamGameUnit(metric.label)}</span></> : null}
                  </td>
                  <td>{record.opportunity?.label}<br /><span className={styles.muted}>TOI {formatMeasured(record.opportunity!.toiChangeMinutes, 1, true)} min</span></td>
                  <td className={`${styles.num} ${styles.hideNarrow}`}>{formatMeasured(metric.observedVariability)}</td>
                  <td>
                    <span className={record.freshness.evidenceStatus === "fresh" ? undefined : styles.warn}>Evidence {record.freshness.evidenceStatus}</span><br />
                    <span className={styles.muted}>{record.recentWindow.appearances} app. / {record.recentWindow.teamGames} team games{metric.sparse ? " · sparse sample" : ""}{record.recentWindow.unknownGames ? ` · ${record.recentWindow.unknownGames} unknown` : ""}</span>
                  </td>
                  <td><button type="button" className={styles.rowButton} aria-expanded={open}
                    onClick={() => set({ player: open ? null : record.identity.playerId })}>{open ? "Hide" : "Details"}<span className={styles.visuallyHidden}> for {record.identity.name}</span></button></td>
                </tr>);
            })}</tbody>
          </table>
        </div>)}
      {!visible.length ? <p className={styles.muted}>No players match these filters.</p> : null}

      {state.player && !selected ? <p className={styles.warn} role="alert">The linked player is not in this bundle.</p> : null}
      {selected && selected.identity.modelClass !== "G" ? (
        <section className={styles.detail} aria-label={`Details for ${selected.identity.name}`}>
          <h2>{selected.identity.name}</h2>
          {selectedHidden ? <p className={styles.warn}>This selected player is hidden by the current filters.</p> : null}
          <SkaterDetail record={selected} target={state.target} />
          <div className={styles.panel}>
            <h3>Sources and clocks</h3>
            <ul className={styles.list}>
              <li>Evidence {selected.identity.evidenceSnapshotId}: cutoff {selected.freshness.evidenceCutoffAt}, age {selected.freshness.evidenceAgeHours?.toFixed(0) ?? "unknown"} h ({selected.freshness.evidenceStatus}).</li>
              <li>Forecast {selected.identity.forecastVersion}, manifest {selected.identity.forecastManifestId ?? "unknown"}, read {selected.identity.forecastReadAsOf}, expires {selected.freshness.forecastExpiresAt ?? "unknown"} ({selected.freshness.forecastStatus.replace(/_/g, " ")}).</li>
              <li>Forecast admission: {selected.forecastAdmission.status.replace(/_/g, " ")}{selected.forecastAdmission.reasons.length ? ` (${reasonText(selected.forecastAdmission.reasons.join(", "))})` : ""}. {TARGET_LABELS[state.target]}: {(() => {
                const item = selected.forecastAdmission.targets[state.target];
                return !item ? "not supplied" : item.status === "admitted" ? `admitted; issued ${item.issuedAt ?? "unknown"}, cutoff ${item.cutoffAt ?? "unknown"}, ${item.coveredGames} of ${item.requiredGames} games` : `withheld (${reasonText(item.reasons.join(", "))})`;
              })()}.</li>
              <li>Recent window games: {selected.recentWindow.gameIds.join(", ") || "none"}{selected.recentWindow.membership === "incomplete" ? ` (membership incomplete: ${selected.recentWindow.unplacedRows} unplaced row(s))` : ""}.</li>
              <li>Horizon {selected.horizon.requestedGames} requested, {selected.horizon.scheduledGames} scheduled ({selected.horizon.startDate} to {selected.horizon.endDate}){selected.horizon.reason ? `: ${reasonText(selected.horizon.reason)}` : ""}. Expected appearances {selected.horizon.expectedAppearances?.toFixed(1) ?? "unavailable"}.</li>
              <li>Recent window: {selected.recentWindow.rule}.</li>
              <li>Predictive spread: {formatMeasured(selected.uncertainty.predictiveSpread)}. Mean uncertainty: {formatMeasured(selected.uncertainty.meanUncertainty)}.</li>
              <li>Config {selected.config.configId} v{selected.config.version} ({selected.config.status.replace(/_/g, " ")}); contract {selected.contractVersion}.</li>
            </ul>
            <h3>Limitations</h3>
            <ul className={styles.list}>{selected.limitations.map(item => <li key={item}>{item}</li>)}</ul>
          </div>
        </section>) : null}
    </div>
  );
}
