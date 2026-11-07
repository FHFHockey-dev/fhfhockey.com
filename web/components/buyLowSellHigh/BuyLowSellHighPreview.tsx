import React, { useEffect, useMemo, useRef, useState } from "react";

import { isCurrentResearchSnapshot, currentResearchLists, currentStateLabel, currentWindowAgeText, profileName, savedResearchLists, stateLabel, numberText, type BlshPreviewSnapshot, type BlshResearchSnapshot } from "lib/buyLowSellHigh/researchSnapshot";
import type { DisplaySnapshot } from "lib/buyLowSellHigh/displayProfile";
import styles from "components/skoElement/SkoElement.module.scss";
import detailStyles from "./BlshPlayerDetail.module.scss";
import BlshPlayerDetail, { CurrentBlshPlayerDetail } from "./BlshPlayerDetail";

const PAGE_SIZE = 25;
const DETAIL_ID = "blsh-player-detail";

/** Existing standalone product preview; immutable historical evidence only. */
export default function BuyLowSellHighPreview({ snapshot }: { snapshot: BlshPreviewSnapshot }) {
  return isCurrentResearchSnapshot(snapshot) ? <CurrentPreview snapshot={snapshot} /> : <HistoricalPreview snapshot={snapshot} />;
}

function HistoricalPreview({ snapshot }: { snapshot: BlshResearchSnapshot }) {
  const lists = useMemo(() => savedResearchLists(snapshot), [snapshot]);
  const [side, setSide] = useState<"BL" | "SH" | "withheld">("BL");
  const [limit, setLimit] = useState(PAGE_SIZE);
  const [selected, setSelected] = useState<number | null>(null);
  const toggleRefs = useRef(new Map<number, HTMLButtonElement>());
  const selectorRef = useRef<HTMLSelectElement>(null);
  const selectedProfile = snapshot.profiles.find(p => p.playerId === selected) ?? null;
  const rows = lists[side];
  const chooseList = (next: typeof side) => { setSide(next); setLimit(PAGE_SIZE); };
  const closeDetail = () => {
    const id = selected; setSelected(null);
    if (id && toggleRefs.current.get(id)?.isConnected) toggleRefs.current.get(id)?.focus();
    else selectorRef.current?.focus();
  };

  return (
    <div className={styles.container}>
      <header>
        <h1 className={styles.title}>Buy Low / Sell High</h1>
        <p className={styles.subtitle}>Production versus underlying support · separate hot/cold research states</p>
      </header>
      <p className={styles.fixtureBanner} role="note">
        Historical research snapshot — {snapshot.eventThroughDate}. Real recorded development data, not current player status.
        Candidate lists are not trading recommendations. All trusted flags remain off.
      </p>
      <p className={styles.muted}>
        Positive = buy-low evidence; negative = sell-high evidence. The research index is not a probability, price or ROI.
        Personal-reference process coverage does not mean high confidence. Conflicts, stale windows and unavailable values remain inspectable.
      </p>
      <p className={styles.muted}>{snapshot.scoringProfile}. The three production tracks are FP, G+A and the named FHFH WiGO Game Score variant.</p>

      <label className={styles.control}>Inspect any historical profile ({snapshot.profiles.length})
        <select ref={selectorRef} value={selected ?? ""} onChange={e => setSelected(e.target.value ? Number(e.target.value) : null)}>
          <option value="">Choose a player</option>
          {[...snapshot.profiles].sort((a, b) => profileName(a).localeCompare(profileName(b)) || a.playerId - b.playerId)
            .map(p => <option key={p.playerId} value={p.playerId}>{profileName(p)} · {p.position ?? "position unavailable"}</option>)}
        </select>
      </label>
      <nav className={styles.tabs} aria-label="BLSH candidate lists">
        <button type="button" className={`${styles.tab} ${detailStyles.touchButton}`} aria-pressed={side === "BL"} onClick={() => chooseList("BL")}>Buy-low candidates ({lists.BL.length})</button>
        <button type="button" className={`${styles.tab} ${detailStyles.touchButton}`} aria-pressed={side === "SH"} onClick={() => chooseList("SH")}>Sell-high candidates ({lists.SH.length})</button>
        <button type="button" className={`${styles.tab} ${detailStyles.touchButton}`} aria-pressed={side === "withheld"} onClick={() => chooseList("withheld")}>Withheld / balanced / unavailable ({lists.withheld.length})</button>
      </nav>
      <p className={styles.muted}>Saved ranks retain their reviewed coverage-tier ordering. No score is recalculated here. Freshness uses the frozen seven-day research proxy, not an adopted live refresh policy.</p>

      <div className={`${styles.tableWrap} ${detailStyles.scrollContainer}`}>
        <table className={styles.table} aria-label={side === "BL" ? "Buy-low candidates" : side === "SH" ? "Sell-high candidates" : "Withheld historical profiles"}>
          <thead><tr><th>Player / saved rank</th><th>Production P</th><th>Support-adjusted index</th><th>Evidence / freshness</th><th>Independent streak</th><th>Details</th></tr></thead>
          <tbody>{rows.slice(0, limit).map(p => (
            <tr key={p.playerId}>
              <th scope="row">{profileName(p)}<br /><span className={styles.muted}>{p.team ?? "team unavailable"} · {p.position ?? "position unavailable"}{p.score.rank === null ? "" : ` · #${p.score.rank}`}</span></th>
              <td className={styles.num}>{numberText(p.score.productionP, 2, true)}</td>
              <td className={styles.num}>{numberText(p.score.value, 2, true)}</td>
              <td>{stateLabel(p)}<br /><span className={styles.muted}>Current-window age: {p.reference.currentAgeDays === null ? "unknown" : `${p.reference.currentAgeDays} days`}</span></td>
              <td>{p.streak ? p.streak.saved.tracks.composite.status.replace(/_/g, " ") : "Unavailable: no matching saved streak"}</td>
              <td><button type="button" className={`${styles.rowButton} ${detailStyles.touchButton}`}
                ref={node => { if (node) toggleRefs.current.set(p.playerId, node); else toggleRefs.current.delete(p.playerId); }}
                aria-expanded={selected === p.playerId} aria-controls={selected === p.playerId ? DETAIL_ID : undefined}
                onClick={() => selected === p.playerId ? closeDetail() : setSelected(p.playerId)}>
                {selected === p.playerId ? "Hide details" : "Details"}<span className={styles.visuallyHidden}> for {profileName(p)}</span>
              </button></td>
            </tr>
          ))}</tbody>
        </table>
      </div>
      {rows.length > limit ? <button type="button" className={`${styles.smallButton} ${detailStyles.touchButton}`} onClick={() => setLimit(n => n + PAGE_SIZE)}>Show next {PAGE_SIZE}</button> : null}
      <p className={styles.muted}>Showing {Math.min(rows.length, limit)} of {rows.length}. All {snapshot.profiles.length} historical profiles are available in the selector, including low/zero-shot and insufficient-evidence cases.</p>

      {selectedProfile ? <BlshPlayerDetail id={DETAIL_ID} profile={selectedProfile} snapshot={snapshot} onClose={closeDetail} /> : null}
      <details><summary>Versions, provenance and limitations</summary>
        <ul className={styles.list}>
          <li>Snapshot {snapshot.snapshotId}; contract {snapshot.schemaVersion}; score {snapshot.scoreVersion}.</li>
          <li>Recorded-through {snapshot.eventThroughDate}; packaged {snapshot.packagedAtUTC}. Original source availability, retrieval and live issuance are unknown.</li>
          {snapshot.limits.map(limitText => <li key={limitText}>{limitText}</li>)}
        </ul>
      </details>
    </div>
  );
}

// Only this saved request has a verified 24-hour capture-age policy. This display
// check does not requalify source data, recompute scores or change list membership.
const CAPTURE_POLICY_REQUEST = "dcba14c2253d82bc70690d3c21112d926c1cdfc4f361024aa8a02f117e262465";
export function captureAgeState(snapshot: DisplaySnapshot, nowMs: number | null): "unknown" | "within_budget" | "stale" {
  const capturedMs = Date.parse(snapshot.asOfUTC);
  if (snapshot.sourcePins.currentRequest !== CAPTURE_POLICY_REQUEST || snapshot.eventThroughDate !== "2026-10-28"
    || nowMs === null || !Number.isFinite(nowMs) || !Number.isFinite(capturedMs) || nowMs < capturedMs) return "unknown";
  return nowMs - capturedMs > 24 * 60 * 60 * 1000 ? "stale" : "within_budget";
}

function CaptureAgeNotice({ snapshot }: { snapshot: DisplaySnapshot }) {
  // Start unknown on both server and client to avoid a clock-dependent hydration mismatch.
  const [nowMs, setNowMs] = useState<number | null>(null);
  useEffect(() => {
    const update = () => setNowMs(Date.now());
    update();
    const timer = window.setInterval(update, 60_000);
    window.addEventListener("focus", update);
    return () => { window.clearInterval(timer); window.removeEventListener("focus", update); };
  }, []);
  const state = captureAgeState(snapshot, nowMs);
  return <p className={styles.fixtureBanner} role="status" aria-label="Snapshot capture freshness">
    {state === "stale"
      ? "Stale saved capture — more than 24 hours old. Research display only; current recommendations unavailable."
      : state === "within_budget"
        ? "Saved capture is within its 24-hour age budget. Research only; live freshness remains unverified."
        : "Capture age or policy unavailable. Saved research only; live freshness remains unverified."}
  </p>;
}

function CurrentPreview({ snapshot }: { snapshot: DisplaySnapshot }) {
  const lists = useMemo(() => currentResearchLists(snapshot), [snapshot]);
  const [side, setSide] = useState<"BL" | "SH" | "withheld">("BL");
  const [limit, setLimit] = useState(PAGE_SIZE);
  const [selected, setSelected] = useState<number | null>(null);
  const toggleRefs = useRef(new Map<number, HTMLButtonElement>());
  const selectorRef = useRef<HTMLSelectElement>(null);
  const selectedProfile = snapshot.profiles.find(p => p.playerId === selected) ?? null;
  const rows = lists[side];
  const chooseList = (next: typeof side) => { setSide(next); setLimit(PAGE_SIZE); };
  const closeDetail = () => {
    const id = selected; setSelected(null);
    if (id && toggleRefs.current.get(id)?.isConnected) toggleRefs.current.get(id)?.focus();
    else selectorRef.current?.focus();
  };

  return <div className={styles.container}>
    <header>
      <h1 className={styles.title}>Buy Low / Sell High</h1>
      <p className={styles.subtitle}>Recent production relative to a historical personal/cohort reference, adjusted for current underlying support.</p>
    </header>
    <p className={styles.fixtureBanner} role="note">{snapshot.banner} {snapshot.referencePolicy.label}</p>
    <CaptureAgeNotice snapshot={snapshot} />
    <p className={styles.muted}>Positive = buy-low evidence; negative = sell-high evidence. These are retrospective research comparisons, not measured market discounts or future returns. All trusted flags remain off.</p>
    <p className={styles.muted}>Recorded through {snapshot.eventThroughDate}; captured as of {snapshot.asOfUTC}. The development reference is stale. Player game ages below are relative to this saved cutoff, not today. Coverage tiers describe available evidence, not calibrated confidence.</p>
    <label className={styles.control}>Inspect any profile ({snapshot.profiles.length})
      <select ref={selectorRef} value={selected ?? ""} onChange={e => setSelected(e.target.value ? Number(e.target.value) : null)}>
        <option value="">Choose a player</option>
        {[...snapshot.profiles].sort((a, b) => a.displayName.localeCompare(b.displayName) || a.playerId - b.playerId)
          .map(p => <option key={p.playerId} value={p.playerId}>{p.displayName} · {p.position ?? "position unavailable"}</option>)}
      </select>
    </label>
    <nav className={styles.tabs} aria-label="BLSH candidate lists">
      <button type="button" className={`${styles.tab} ${detailStyles.touchButton}`} aria-pressed={side === "BL"} onClick={() => chooseList("BL")}>Buy-low candidates ({lists.BL.length})</button>
      <button type="button" className={`${styles.tab} ${detailStyles.touchButton}`} aria-pressed={side === "SH"} onClick={() => chooseList("SH")}>Sell-high candidates ({lists.SH.length})</button>
      <button type="button" className={`${styles.tab} ${detailStyles.touchButton}`} aria-pressed={side === "withheld"} onClick={() => chooseList("withheld")}>Withheld / balanced / unavailable ({lists.withheld.length})</button>
    </nav>
    <p className={styles.muted}>Saved research order; no score or list cutoff is added. These index values are not fantasy points or per-game averages. Open a player’s details for totals across their selected games. Production gap compares the historical reference with recorded production; the support-adjusted index also considers changes in scoring chances.</p>
    <div className={`${styles.tableWrap} ${detailStyles.scrollContainer}`}>
      <table className={styles.table} aria-label={side === "BL" ? "Buy-low candidates" : side === "SH" ? "Sell-high candidates" : "Withheld profiles"}>
        <thead><tr><th>Player / saved rank</th><th>Production gap (normalized)</th><th>Support-adjusted index</th><th>Evidence / age at saved cutoff</th><th>Details</th></tr></thead>
        <tbody>{rows.slice(0, limit).map(p => <tr key={p.playerId}>
          <th scope="row">{p.displayName}<br /><span className={styles.muted}>{p.team ?? "team unavailable"} · {p.position ?? "position unavailable"}{p.score.rank === null ? "" : ` · #${p.score.rank}`}</span></th>
          <td className={styles.num}>{numberText(p.score.baselineNormalizedGap, 2, true)}</td>
          <td className={styles.num}>{numberText(p.score.value, 2, true)}</td>
          <td>{currentStateLabel(p)}<br /><span className={styles.muted}>{currentWindowAgeText(p.evidence.window)}</span></td>
          <td><button type="button" className={`${styles.rowButton} ${detailStyles.touchButton}`}
            ref={node => { if (node) toggleRefs.current.set(p.playerId, node); else toggleRefs.current.delete(p.playerId); }}
            aria-expanded={selected === p.playerId} aria-controls={selected === p.playerId ? DETAIL_ID : undefined}
            onClick={() => selected === p.playerId ? closeDetail() : setSelected(p.playerId)}>
            {selected === p.playerId ? "Hide details" : "Details"}<span className={styles.visuallyHidden}> for {p.displayName}</span>
          </button></td>
        </tr>)}</tbody>
      </table>
    </div>
    {rows.length > limit ? <button type="button" className={`${styles.smallButton} ${detailStyles.touchButton}`} onClick={() => setLimit(n => n + PAGE_SIZE)}>Show next {PAGE_SIZE}</button> : null}
    <p className={styles.muted}>Showing {Math.min(rows.length, limit)} of {rows.length}. All {snapshot.profiles.length} captured profiles are available in the selector, including low/zero-shot, conflicting and unavailable cases.</p>
    {selectedProfile ? <CurrentBlshPlayerDetail id={DETAIL_ID} profile={selectedProfile} snapshot={snapshot} onClose={closeDetail} /> : null}
    <details><summary>Versions, provenance and limitations</summary>
      <ul className={styles.list}>
        <li>Contract {snapshot.schemaVersion}; score {snapshot.scoreVersion}; explanation {snapshot.explanationVersion}; assembler {snapshot.assemblerVersion}.</li>
        <li>Recorded-through {snapshot.eventThroughDate}; as of {snapshot.asOfUTC}; packaged {snapshot.packagedAtUTC}. Issued alert: unavailable.</li>
        <li>Reference selected by {snapshot.referencePolicy.selectedBy} at {snapshot.referencePolicy.selectedAtUTC} for this provisional local research snapshot.</li>
        <li>{snapshot.overlay}</li>
        {snapshot.limits.map(text => <li key={text}>{text}</li>)}
        <li>{snapshot.predictiveResearch.note} Report: {snapshot.predictiveResearch.report}</li>
      </ul>
    </details>
  </div>;
}
