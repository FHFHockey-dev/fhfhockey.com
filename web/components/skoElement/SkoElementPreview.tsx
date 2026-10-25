import React, { useMemo } from "react";

import {
  DEFAULT_HORIZON, HORIZON_OPTIONS, RECENT_WINDOW_OPTIONS, SKATER_TARGETS, TARGET_LABELS,
  type HorizonGames, type InterpretationRecord, type ModelClass, type RecentWindowGames, type SkaterTarget,
} from "lib/skoElement/contract";
import { FIXTURE_DISCLAIMER, FIXTURE_CONFIG, fixtureRecords } from "lib/skoElement/fixtures";
import { DIRECTION_TEXT, formatMeasured, percent, reasonText } from "./format";
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
  return (
    <>
      <div className={styles.panel}>
        <h3>Explanation</h3>
        <ul className={styles.list}>{record.explanations.map(item => <li key={item.id}>{item.text}</li>)}</ul>
      </div>
      <div className={styles.tableWrap}>
        <table className={styles.table} aria-label="Observed and expected production by category">
          <thead><tr>
            <th>Category</th><th>Recent per team game</th><th>Recent per appearance</th><th>Expected per scheduled team game</th>
            <th>Expected per appearance (conditional)</th><th>Gap</th><th>Outlook change</th><th>Observed game-to-game SD</th>
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
            <li>Recent block {opportunity.recent.startDate} to {opportunity.recent.endDate}: {opportunity.recent.appearances} appearances in {opportunity.recent.teamGames} team games, TOI {formatMeasured(opportunity.recent.toiPerAppearance)} min, PP TOI {formatMeasured(opportunity.recent.ppToiPerAppearance)} min per appearance.</li>
            <li>Prior block {opportunity.prior.startDate ?? "none"} to {opportunity.prior.endDate ?? "none"}: {opportunity.prior.appearances} appearances, TOI {formatMeasured(opportunity.prior.toiPerAppearance)} min, PP TOI {formatMeasured(opportunity.prior.ppToiPerAppearance)} min.</li>
            <li>Change: TOI {formatMeasured(opportunity.toiChangeMinutes, 2, true)} min, PP TOI {formatMeasured(opportunity.ppToiChangeMinutes, 2, true)} min per appearance.</li>
            <li>PP unit role: {opportunity.powerPlayRole.status === "sourced" ? `${opportunity.powerPlayRole.value} (${opportunity.powerPlayRole.source}, effective ${opportunity.powerPlayRole.effectiveAt?.slice(0, 10)})` : "Unavailable: no dated role source"}.</li>
            <li>Scenarios: {opportunity.scenarios.reason}</li>
            <li>Rule: {opportunity.ruleId ?? "none accepted"} ({opportunity.ruleStatus.replace(/_/g, " ")}). Observed duration describes history only.</li>
          </ul>
        </div>
        <div className={styles.panel}>
          <h3>IPP ({record.identity.modelClass === "F" ? "forward" : "defense"} reference, all situations)</h3>
          <ul className={styles.list}>
            <li>Observed: {formatMeasured(record.ipp.observed, 3)}</li>
            <li>Class reference: {formatMeasured(record.ipp.reference, 3)} {record.ipp.referenceSource ? `(${record.ipp.referenceSource})` : ""}</li>
            <li>Deviation: {formatMeasured(record.ipp.deviation, 3, true)}</li>
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
        <thead><tr><th>Goalie</th><th>Recent SV% (saves / shots)</th><th>Recent GAA (60 × GA / min)</th>
          <th>Expected SV% (ratio of expected totals)</th><th>Expected GAA</th><th>Expected starts</th><th>Gap status</th></tr></thead>
        <tbody>{records.map(record => {
          const goalie = record.goalie!;
          return (
            <tr key={record.identity.playerId}>
              <th scope="row">{record.identity.name} <span className={styles.muted}>{record.identity.team}</span></th>
              <td className={styles.num}>{percent(goalie.observed.savePercentage.value)} <span className={styles.muted}>{goalie.observed.saves ?? "?"}/{goalie.observed.shotsAgainst ?? "?"}</span></td>
              <td className={styles.num}>{formatMeasured(goalie.observed.goalsAgainstAverage)}</td>
              <td className={styles.num}>{percent(goalie.expected.savePercentage.value)}</td>
              <td className={styles.num}>{formatMeasured(goalie.expected.goalsAgainstAverage)}</td>
              <td className={styles.num}>{formatMeasured(goalie.expected.expectedStarts)}</td>
              <td className={styles.warn}>Pending goalie adapter: {goalie.gap.reason}</td>
            </tr>);
        })}</tbody>
      </table>
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
        <p className={styles.subtitle}>Diagnostic sustainability view: recent production, FORGE expected production and the gap between them, kept separate from opportunity and evidence quality. No predictive score is shown.</p>
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
        Scheduled team games are not guaranteed appearances. Order: signed gap, largest first; unavailable gaps last; ties by name.
      </p>

      {state.view === "G" ? <GoalieTable records={visible} /> : (
        <div className={styles.tableWrap}>
          <table className={styles.table} aria-label={`${VIEW_LABEL[state.view]} sustainability scan`}>
            <thead><tr>
              <th>Player</th><th>Recent per team game</th><th>Expected per team game</th><th>Gap (expected − recent)</th>
              <th>Opportunity</th><th className={styles.hideNarrow}>Observed SD</th><th>Evidence</th><th><span className={styles.visuallyHidden}>Details</span></th>
            </tr></thead>
            <tbody>{visible.map(record => {
              const metric = record.metrics.find(item => item.target === state.target)!;
              const open = state.player === record.identity.playerId;
              return (
                <tr key={record.identity.playerId}>
                  <th scope="row">{record.identity.name}<br /><span className={styles.muted}>{record.identity.team} · {record.identity.eligibility.join("/")}</span></th>
                  <td className={styles.num}>{formatMeasured(metric.observedPerTeamGame)}</td>
                  <td className={styles.num}>{formatMeasured(metric.expectedPerTeamGame)}</td>
                  <td className={`${styles.num} ${styles[metric.direction]}`}>
                    {formatMeasured(metric.gapPerTeamGame, 2, true)}<br /><span>{DIRECTION_TEXT[metric.direction]}</span>
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
              <li>Forecast {selected.identity.forecastVersion}, manifest {selected.identity.forecastManifestId ?? "unknown"}, read {selected.identity.forecastReadAsOf}, expires {selected.freshness.forecastExpiresAt ?? "unknown"} ({selected.freshness.forecastStatus}).</li>
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
