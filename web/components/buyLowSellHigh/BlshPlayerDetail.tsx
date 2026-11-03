import React, { useEffect, useRef } from "react";
import type { DisplayProfile, DisplaySnapshot, DisplayTrack } from "lib/buyLowSellHigh/displayProfile";

import { currentWindowAgeText, numberText, profileName, stateLabel, type BlshResearchProfile, type BlshResearchSnapshot } from "lib/buyLowSellHigh/researchSnapshot";
import shared from "components/skoElement/SkoElement.module.scss";
import styles from "./BlshPlayerDetail.module.scss";

const label = (value: string) => value.replace(/_/g, " ");
const dateSpan = (dates: string[]) => dates.length ? `${dates[0]} to ${dates[dates.length - 1]}` : "Unavailable";
const percent = (weight: number | null) => weight === null ? "Unavailable" : `${(100 * weight).toFixed(1)}%`;
const tracks = ["FP", "G+A", "FHFH WiGO Game Score"];

/** Passed-through evidence. Finishing never vetoes the broad profile. */
export default function BlshPlayerDetail({ id, profile: p, snapshot, onClose }: {
  id: string; profile: BlshResearchProfile; snapshot: BlshResearchSnapshot; onClose: () => void;
}) {
  const heading = useRef<HTMLHeadingElement>(null);
  useEffect(() => { heading.current?.focus(); }, [p.playerId]);
  return (
    <section id={id} className={`${shared.detail} ${styles.detail}`} aria-labelledby={`${id}-heading`}
      onKeyDown={e => { if (e.key === "Escape") { e.stopPropagation(); onClose(); } }}>
      <div className={styles.detailHeader}>
        <div><h2 id={`${id}-heading`} ref={heading} tabIndex={-1} className={styles.heading}>{profileName(p)}</h2>
          <p className={shared.muted}>{p.team ?? "Team unavailable"} · {p.position ?? "Position unavailable"} · historical {p.snapshotDate}</p></div>
        <button type="button" className={`${shared.smallButton} ${styles.touchButton}`} onClick={onClose}>Close<span className={shared.visuallyHidden}> details for {profileName(p)}</span></button>
      </div>
      <div className={shared.grid}>
        <div className={shared.panel}><h3>Production and underlying support</h3>
          <ul className={shared.list}>
            <li>Original TOI-adjusted production P: {numberText(p.score.productionP, 2, true)}.</li>
            <li>Support-adjusted research index: {numberText(p.score.value, 2, true)}. {stateLabel(p)}.</li>
            <li>List: {p.score.list === "BL" ? "Buy-low research candidate" : p.score.list === "SH" ? "Sell-high research candidate" : "Withheld; inspect evidence"}. Trusted: false.</li>
            <li>Personal history: {p.reference.personalGames ?? "unknown"} appearances; personal weight {percent(p.reference.personalWeight)}, cohort weight {percent(p.reference.cohortWeight)}. These are estimator weights, not confidence percentages.</li>
            <li>Confidence: unavailable; no calibrated probability, causal-luck or market-value claim.</li>
          </ul>
        </div>
        <div className={shared.panel}><h3>Window membership and freshness</h3>
          <ul className={shared.list}>
            <li>Current: {p.reference.currentSourceIds.length} recorded slots, {dateSpan(p.reference.currentDates)}.</li>
            <li>Reference: {p.reference.referenceSourceIds.length} recorded slots, {dateSpan(p.reference.referenceDates)}.</li>
            <li>Reference age diagnostic: {p.reference.referenceAgeDays ?? "unknown"} days. Current-window age: {p.reference.currentAgeDays ?? "unknown"} days.</li>
            <li>SOG: {numberText(p.coverage.shots, 0)} total; {numberText(p.coverage.shotsPerAppearance)} per appearance. No whole-profile shooting gate.</li>
            <li>Estimated process indices: {p.coverage.process?.imputed_indices?.join(", ") || "none or unavailable"}; process dimensions are individual xG/60, shared on-ice xGF/60, shared on-ice xGA/60.</li>
            <li>Prior-range extrapolation: {p.coverage.process?.outside_prior_span || p.coverage.process?.outside_prior_component_range ? "present" : "not flagged or unavailable"}. Coverage tier: {label(p.score.evidenceTier)}.</li>
          </ul>
        </div>
      </div>
      <div className={shared.tableWrap}><table className={shared.table} aria-label="Three-track production breakdown">
        <thead><tr><th>Track</th><th>Observed current total</th><th>Baseline at recorded TOI</th><th>Support-conditioned total</th><th>Support adjustment</th></tr></thead>
        <tbody>{tracks.map((track, i) => <tr key={track}><th scope="row">{track}</th>
          <td className={shared.num}>{numberText(p.score.actual?.[i])}</td><td className={shared.num}>{numberText(p.score.baseline?.[i])}</td>
          <td className={shared.num}>{numberText(p.score.support?.[i])}</td><td className={shared.num}>{numberText(p.score.adjustment?.[i], 2, true)}</td></tr>)}</tbody>
      </table></div>
      <p className={shared.muted}>Totals cover the exact recorded current window. These tracks share scoring ingredients. The support adjustment is a retrospective fitted research comparison, not a future forecast.</p>

      <div className={shared.grid}>{Object.entries(p.families).map(([key, family]) => (
        <div key={key} className={shared.panel}><h3>{label(key)}</h3>
          <p className={shared.muted}>{label(family.status)} · {family.source_scope ?? "See metric units and source limitations"}</p>
          <ul className={shared.list}>{Object.entries(family.metrics).map(([metric, value]) => (
            <li key={metric}>{label(metric)}: current {numberText(value.current)}, reference {numberText(value.reference)}, delta {numberText(value.delta, 2, true)} {value.units}.
              {value.current_status !== "measured" || value.personal_comparison_status !== "available" ? ` ${label(value.current_status)} / ${label(value.personal_comparison_status)}.` : ""}
              {value.comparison_limitation ? ` ${value.comparison_limitation}` : ""}</li>
          ))}</ul>
        </div>
      ))}</div>
      <p className={shared.muted}>Deployment, finishing and peripheral activity are context, not extra independent votes. On-ice chance rates describe shared opportunity, not individual playmaking. Low and zero shots remain observations; missing values stay unavailable.</p>

      <div className={shared.panel}><h3>Independent hot/cold research state</h3>
        {p.streak ? <>
          <p className={shared.muted}>{p.streak.detectorVersion} / {p.streak.researchOption}; not adopted for production. Reference: previous regular-season 50 slots, ±2 entry, fresh five-slot confirmation, two clearing blocks at ±1 exit. Its personal reference and scale differ from BLSH.</p>
          <ul className={shared.list}>{Object.entries(p.streak.saved.tracks).map(([key, track]) => <li key={key}>{label(key)}: {label(track.status)}; {track.availability}; last recorded game {track.observation?.gameDate ?? "unavailable"}{track.reason ? `; ${label(track.reason)}` : ""}.</li>)}</ul>
          <p className={shared.muted}>First crossing, confirmation and exit are distinct saved events. No retrospective phase is presented as an issued alert; historical issuance is unavailable.</p>
        </> : <p>No matching saved player/date/detector-version record is included. Streak unavailable; no join, score-sign inference or detector rerun is substituted.</p>}
      </div>
      <details><summary>Exact source and diagnostic record</summary>
        <p className={shared.muted}>Snapshot {snapshot.snapshotId}; profile source line {p.sourceLine}; SHA256 {p.sourceProfileSHA256}. Identity: {p.nameKind ?? "unavailable"}. Live issuance and original source availability are unknown.</p>
        <pre style={{ whiteSpace: "pre-wrap", overflowWrap: "anywhere" }}>{JSON.stringify({ reference: p.reference, coverage: p.coverage, context: p.context, streak: p.streak }, null, 2)}</pre>
      </details>
    </section>
  );
}

/** Native totals only: each track has its own scale and an explicit zero origin. */
export function ProductionTrackComparison({ track }: {
  track: Pick<DisplayTrack, "label" | "observed" | "referenceAtCurrentTOI" | "supportConditioned">;
}) {
  const rows = [
    { label: "Actual total", value: track.observed },
    { label: "Historical comparison total", value: track.referenceAtCurrentTOI },
    { label: "Support comparison total", value: track.supportConditioned },
  ];
  const values = rows.map(row => row.value);
  const minimum = Math.min(0, ...values), maximum = Math.max(0, ...values);
  if (!values.every(value => typeof value === "number" && Number.isFinite(value)) || !Number.isFinite(maximum - minimum)) {
    return <p>{track.label}: comparison unavailable; a saved total is missing or invalid.</p>;
  }
  const position = (value: number) => 5 + 90 * ((value - minimum) / (maximum - minimum || 1));
  const zero = position(0);
  return <figure className={shared.panel} style={{ margin: 0, minWidth: 0 }} aria-label={`${track.label}: saved window totals`}>
    <figcaption><strong>{track.label}</strong></figcaption>
    {rows.map(row => {
      const end = position(row.value);
      return <div key={row.label}>
        <div>{row.label}: <strong>{numberText(row.value, 4)}</strong></div>
        <svg width="100%" height="20" viewBox="0 0 100 20" preserveAspectRatio="none" aria-hidden="true" focusable="false">
          <line x1="5" x2="95" y1="10" y2="10" stroke="currentColor" strokeWidth="1" vectorEffect="non-scaling-stroke" opacity="0.3" />
          <line x1={zero} x2={zero} y1="2" y2="18" stroke="currentColor" strokeWidth="1" vectorEffect="non-scaling-stroke" />
          <rect x={Math.min(zero, end)} y="7" width={Math.abs(end - zero)} height="6" fill="currentColor" opacity="0.7" />
          <line x1={end} x2={end} y1="5" y2="15" stroke="currentColor" strokeWidth="2" vectorEffect="non-scaling-stroke" />
        </svg>
      </div>;
    })}
    <p className={shared.muted}>Scale: {numberText(minimum, 4)} to {numberText(maximum, 4)} in this track’s units. {minimum === 0 && maximum === 0 ? "All three recorded totals are zero." : "The tall tick marks zero."}</p>
  </figure>;
}

/** Current saved display DTO. Keep explanation amounts separate from the bounded index. */
export function CurrentBlshPlayerDetail({ id, profile: p, snapshot, onClose }: {
  id: string; profile: DisplayProfile; snapshot: DisplaySnapshot; onClose: () => void;
}) {
  const heading = useRef<HTMLHeadingElement>(null);
  useEffect(() => { heading.current?.focus(); }, [p.playerId]);
  const w = p.evidence.window, ref = p.evidence.reference;
  return <section id={id} className={`${shared.detail} ${styles.detail}`} aria-labelledby={`${id}-heading`}
    onKeyDown={e => { if (e.key === "Escape") { e.stopPropagation(); onClose(); } }}>
    <div className={styles.detailHeader}>
      <div><h2 id={`${id}-heading`} ref={heading} tabIndex={-1} className={styles.heading}>{p.displayName}</h2>
        <p className={shared.muted}>{p.team ?? "Team unavailable"} · {p.position ?? "Position unavailable"} · recorded through {snapshot.eventThroughDate}</p></div>
      <button type="button" className={`${shared.smallButton} ${styles.touchButton}`} onClick={onClose}>Close<span className={shared.visuallyHidden}> details for {p.displayName}</span></button>
    </div>
    <div className={shared.panel}><h3>Production reference and underlying support</h3>
      <p className={shared.muted}>The index combines the production tracks below. Index values are not fantasy points or per-game averages.</p>
      <ul className={shared.list}>
        <li>Support-adjusted research index: {numberText(p.score.value, 2, true)}. {p.score.statusLabel}.</li>
        <li>Production gap (normalized): {numberText(p.score.baselineNormalizedGap, 4, true)}. Support-adjusted normalized gap: {numberText(p.score.normalizedGap, 4, true)}.</li>
        <li>List: {p.score.listLabel}. Trusted: false.</li>
        {p.score.reasonText ? <li>{p.score.reasonText}</li> : null}
        <li>{p.evidence.tierLabel}. {p.evidence.tierNote}. The reference is stale; this snapshot remains provisional.</li>
      </ul>
    </div>
    <div className={shared.grid}>
      <div className={shared.panel}><h3>Evidence quantity</h3>
        <ul className={shared.list}>
          <li>Current window: {w.games} recorded appearances across {w.spanDays} days; {numberText(w.minutes)} minutes. {dateSpan(w.dates)}.</li>
          <li>{currentWindowAgeText(w)}.</li>
          <li>Personal reference: {ref.personalGames} appearances; {dateSpan(ref.dates)}. {ref.ageText}.</li>
          <li>Personal estimator weight: {numberText(ref.estimatorWeight, 4)}; cohort estimator weight: {numberText(ref.cohortEstimatorWeight, 4)}. {ref.estimatorWeightNote}.</li>
          <li>Prior donor players: {p.evidence.donorPlayers ?? "Unavailable"}.</li>
          <li>Calibrated probability: {p.evidence.calibratedProbabilityText}.</li>
          {p.evidence.extrapolationText ? <li>{p.evidence.extrapolationText}.</li> : null}
        </ul>
      </div>
      <div className={shared.panel}><h3>Missing, estimated and restricted evidence</h3>
        <ul className={shared.list}>
          {p.coverage.notes.map((n, i) => <li key={`${n.source}-${n.component}-${i}`}>{label(n.component)}{n.state ? ` (${n.state})` : ""}: {n.games === null ? "" : `${n.games} games: `}{n.text}.</li>)}
          {p.coverage.imputedProcesses.length ? <li>Estimated from the other processes: {p.coverage.imputedProcesses.join(", ")}.</li> : null}
          {p.coverage.physicalFloors.map(track => <li key={track}>Expected {track} raised to zero.</li>)}
          {(["current", "reference"] as const).filter(side => !p.coverage.context[side].verified).map(side => <li key={side}>{label(side)} context: {p.coverage.context[side].text}.</li>)}
        </ul>
        <p className={shared.muted}>Missing measurements remain unavailable; they are not observed zeros. These restrictions are separate from evidence quantity and estimator weights.</p>
      </div>
    </div>
    {p.tracks.length ? <>
      <div className={shared.panel}>
        <h3>Production totals across the selected games</h3>
        <p>Each number below covers all {w.games} recorded {w.games === 1 ? "appearance" : "appearances"} ({dateSpan(w.dates)}) and {numberText(w.minutes)} total minutes of ice time. These are totals across those games, not per-game averages.</p>
        <ul className={shared.list}>
          <li><strong>Actual total:</strong> what the player recorded across those games.</li>
          <li><strong>Historical comparison total:</strong> the historical production rate applied to the same ice time. The weights above show how much comes from the player’s history and how much comes from a position-group estimate; reference age is shown separately. This is not the player’s historical per-game average.</li>
          <li><strong>Support comparison total:</strong> adjusts the historical comparison using changes in the player’s own scoring chances and team chances for and against while they are on the ice. These chance measures use expected goals (xG), which estimate scoring opportunity. Missing or estimated inputs remain flagged above. This is a retrospective model comparison, not a forecast or proof of good or bad luck.</li>
          <li><strong>Gap:</strong> support comparison minus actual total. Positive means recorded production was lower; negative means it was higher.</li>
        </ul>
      </div>
      <div className={shared.tableWrap}><table className={shared.table} aria-label="Three-track production breakdown">
        <caption style={{ textAlign: "left", padding: "8px" }}>{w.games} recorded {w.games === 1 ? "appearance" : "appearances"} · {numberText(w.minutes)} total minutes. All values are totals in each row’s units.</caption>
        <thead><tr><th scope="col">Track</th><th scope="col">Actual total</th><th scope="col">Historical comparison total</th><th scope="col">Support comparison total</th><th scope="col">Gap (support − actual)</th></tr></thead>
        <tbody>{p.tracks.map(t => <tr key={t.track}><th scope="row">{t.label}</th><td className={shared.num}>{numberText(t.observed)}</td><td className={shared.num}>{numberText(t.referenceAtCurrentTOI)}</td><td className={shared.num}>{numberText(t.supportConditioned)}</td><td className={shared.num}>{numberText(t.gap, 4, true)}</td></tr>)}</tbody>
      </table></div>
      <p className={shared.muted}>FP, G+A and the named FHFH WiGO Game Score share scoring ingredients. Their covariance is accounted for; these are not three independent votes.</p>
      <details>
        <summary>Compare these totals visually</summary>
        <p className={shared.muted}>Each track uses its own native-unit scale; compare lengths within a track. These are the same saved window totals shown above, with the same evidence restrictions. The support comparison uses the same total ice time as actual production; it is not a forecast.</p>
        <div className={shared.grid}>{p.tracks.map(track => <ProductionTrackComparison key={track.track} track={track} />)}</div>
      </details>
      {p.tracks.map(t => <details key={t.track}>
        <summary>{t.label}: additive gap components</summary>
        <div className={shared.tableWrap}><table className={shared.table} aria-label={`${t.label} gap components`}>
          <thead><tr><th>Component</th><th>Amount in track units</th><th>Explanation</th></tr></thead>
          <tbody>{t.components.map(c => <tr key={c.id}><th scope="row">{c.kindLabel}</th><td className={shared.num}>{numberText(c.value, 4, true)}</td><td>{c.note}</td></tr>)}</tbody>
        </table></div>
        <p>Component sum / track gap: {numberText(t.componentSum, 4, true)}. Normalization multiplier: {numberText(t.normalizationMultiplier, 6)}. Contribution to normalized gap: {numberText(t.normalizedGapContribution, 6, true)}.</p>
      </details>)}
      <p className={shared.muted}>Track contributions sum to the normalized gap. The displayed index is its separate bounded transform: {p.score.indexTransform}. Neither the multiplier nor a contribution is a percentage share of the index.</p>
    </> : <p>No complete scored production breakdown is available. The recorded reasons remain above.</p>}
    <div className={shared.panel}><h3>{p.context.heading}</h3>
      <p className={shared.muted}>The figures below are rates or ratios, with their units stated on each line. Per appearance means per recorded game; per 60 means per 60 minutes of the stated game situation. Deployment, finishing and own shot volume are explanatory context. Low and zero shots remain observations; there is no whole-profile shooting gate.</p>
      <ul className={shared.list}>{p.context.opportunity.map(c => <li key={c.metric}>{c.label}: current {numberText(c.current)}, reference {numberText(c.reference)}, change {numberText(c.delta, 4, true)} {c.units}.{c.reasonText ? ` ${c.reasonText}.` : ""}{c.referenceReasonText ? ` ${c.referenceReasonText}.` : ""}{c.deltaReasonText ? ` ${c.deltaReasonText}.` : ""}{c.revisionText ? ` ${c.revisionText}.` : ""}</li>)}</ul>
      {p.context.signals.map(c => <div key={c.metric}>
        <h4>{c.label}</h4>
        <p>Current {numberText(c.current)}, reference {numberText(c.reference)}, change {numberText(c.delta, 4, true)} {c.units}.{c.reasonText ? ` ${c.reasonText}.` : ""}{c.referenceReasonText ? ` ${c.referenceReasonText}.` : ""}{c.deltaReasonText ? ` ${c.deltaReasonText}.` : ""}{c.revisionText ? ` ${c.revisionText}.` : ""}</p>
        {c.scale ? <p className={shared.muted}>Spread: {numberText(c.scale.value)} {c.scale.units}. {c.scale.assumption}</p> : null}
        {c.hypotheses.length ? <><p>{c.hypothesesHeading}</p><ul className={shared.list}>{c.hypotheses.map(text => <li key={text}>{text}</li>)}</ul></> : null}
      </div>)}
    </div>
    <div className={shared.panel}><h3>Independent hot/cold research state</h3><p>{p.streakText}. A low or high total across five games does not establish five consecutive cold or hot games. A streak label requires separate game-by-game evidence.</p></div>
    <p className={shared.muted}>{p.claimsText}</p>
    <details><summary>Exact source and diagnostic record</summary>
      <p className={shared.muted}>Contract {snapshot.schemaVersion}; player {p.playerId}; recorded-through {snapshot.eventThroughDate}; as of {snapshot.asOfUTC}. Reference policy: {snapshot.referencePolicy.label}</p>
      <pre style={{ whiteSpace: "pre-wrap", overflowWrap: "anywhere" }}>{JSON.stringify({ evidence: p.evidence, coverage: p.coverage, claims: p.claims, sourcePins: snapshot.sourcePins }, null, 2)}</pre>
    </details>
  </section>;
}
