import React, { useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/router";

import type { DisplayOpportunityComparison, DisplayProfile, DisplaySnapshot } from "lib/buyLowSellHigh/displayProfile";
import { currentWindowAgeText, numberText } from "lib/buyLowSellHigh/researchSnapshot";
import { useBlshLocalState } from "lib/buyLowSellHigh/useBlshLocalState";
import shared from "components/skoElement/SkoElement.module.scss";
import { CurrentBlshPlayerDetail } from "./BlshPlayerDetail";
import styles from "./BlshCandidateLists.module.scss";

type Position = "F" | "D";
type Side = "BL" | "SH";
type View = { position: Position; full: Side[] };
const SIDE_LABELS = { BL: "Buy-low", SH: "Sell-high" };
const POSITION_LABELS = { F: "Forwards", D: "Defensemen" };
const DETAIL_ID = "blsh-v3-player-detail";
const OPPORTUNITY_LABELS = { agrees: "Agrees", qualified: "Qualified", balanced: "Balanced", contradicts: "Contradicts", withheld: "Withheld", unavailable: "Unavailable" };

function withheldReasonFor(profile: DisplayProfile) {
  const score = profile.score;
  if (score.reason) return { key: score.reason, label: score.reasonText ?? "Withheld: reason unavailable" };
  if (score.directionWithheldReason) return { key: score.directionWithheldReason, label: score.directionWithheldText ?? "Direction withheld: reason unavailable" };
  if (score.status !== "concordant_research_candidate") return { key: `status:${score.status}`, label: score.statusLabel };
  if (!profile.evidence.window.fresh) return { key: "saved_window_stale_list_withheld", label: "Withheld: the recorded window is outside the saved age limit" };
  return { key: "other", label: "Other withheld evidence" };
}

/** Query state changes presentation only. It cannot change saved scores or membership. */
export function candidateListView(query: Record<string, string | string[] | undefined>): View {
  const full = typeof query.full === "string" ? query.full.split(",") : [];
  return { position: query.pos === "D" ? "D" : "F", full: (["BL", "SH"] as Side[]).filter(side => full.includes(side)) };
}

function TrackValue({ profile, track }: { profile: DisplayProfile; track: string }) {
  const value = profile.tracks.find(item => item.track === track);
  return <span className={shared.num}>{value ? `${numberText(value.observed)} / ${numberText(value.supportConditioned)}` : "Unavailable"}</span>;
}

function Comparison({ value }: { value: DisplayOpportunityComparison }) {
  if (!value.available) return <p>{value.reasonText ?? "Comparison unavailable"}</p>;
  return <div>
    <p className={shared.num}>Observed {numberText(value.observed)} · comparison {numberText(value.expected)} · gap {numberText(value.gap === null ? null : value.gap === 0 ? 0 : -value.gap, 2, true)}</p>
    <p>{value.directionLabel ?? "Direction unavailable"}</p>
  </div>;
}

/** Passes through the saved module's comparisons; does not adjust a score or list. */
export function BlshOpportunityDetails({ profile }: { profile: DisplayProfile }) {
  const opportunity = profile.opportunity;
  return <section className={shared.panel} aria-label={`Opportunity for ${profile.displayName}`}>
    <h3>Opportunity: per-game and opportunity-adjusted comparisons</h3>
    <p className={shared.warn}>Provisional context. This does not change list membership or rank.</p>
    {opportunity.status === "unavailable" ? <p>{opportunity.reasonText ?? "Opportunity comparison unavailable"}</p> : <>
      <p className={shared.muted}>Both comparisons show totals over the same {profile.evidence.window.games} recorded games. The per-game baseline is scaled to that window; these are not forecasts. Positive gaps mean comparison above observed production.</p>
      {opportunity.tracks.map(track => <div key={track.track} className={styles.opportunityTrack}>
        <h4>{track.label}</h4>
        <div className={styles.comparisons}>
          <div><h5>Personal per-game baseline</h5><Comparison value={track.perGame} /></div>
          <div><h5>Opportunity-adjusted comparison</h5><Comparison value={track.adjusted} /></div>
        </div>
        <p>{track.assessment.text}</p>
      </div>)}
      {opportunity.changes ? <ul className={shared.list}>
        <li>{opportunity.changes.toi.text}</li><li>{opportunity.changes.pp.text}</li>
      </ul> : null}
      {opportunity.listCheck ? <p>{opportunity.listCheck.text}</p> : null}
    </>}
    <p className={shared.muted}>{opportunity.persistenceNote}</p>
  </section>;
}

/** Mapper-v3 presentation only. The caller supplies a validated, immutable snapshot. */
export default function BlshCandidateLists({ snapshot }: { snapshot: DisplaySnapshot }) {
  const router = useRouter();
  const local = useBlshLocalState();
  const watched = new Set(local.state.watchlist.map(entry => entry.playerId));
  const removeWatch = (id: string) => void local.mutate(current => ({ ...current, watchlist: current.watchlist.filter(entry => entry.playerId !== id) }));
  const watchButton = (profile: DisplayProfile) => {
    const id = String(profile.playerId), saved = watched.has(id);
    return <button type="button" className={`${shared.smallButton} ${styles.touch}`} disabled={!local.canSave}
      aria-label={`${saved ? "Remove" : "Watch"} ${profile.displayName}${saved ? " from watchlist" : " locally"}`} aria-pressed={saved}
      onClick={() => saved ? removeWatch(id) : void local.mutate(current => ({ ...current,
        watchlist: current.watchlist.some(entry => entry.playerId === id) ? current.watchlist
          : [...current.watchlist, { kind: "research_identity", playerId: id, addedAt: new Date().toISOString() }],
      }))}>{saved ? "Watching · remove" : "Watch locally"}</button>;
  };
  const [view, setView] = useState<View>(() => candidateListView(router.query));
  const [selected, setSelected] = useState<number | null>(null);
  const [withheldReason, setWithheldReason] = useState("");
  const [withheldLimit, setWithheldLimit] = useState(25);
  const selector = useRef<HTMLSelectElement>(null);
  const toggles = useRef(new Map<number, HTMLButtonElement>());
  const positionQuery = router.query.pos, fullQuery = router.query.full;
  useEffect(() => {
    if (router.isReady) setView(candidateListView({ pos: positionQuery, full: fullQuery }));
  }, [router.isReady, positionQuery, fullQuery]);
  const changeView = (next: View) => {
    setView(next);
    const query: Record<string, string | string[] | undefined> = { ...router.query, pos: next.position };
    if (next.full.length) query.full = next.full.join(","); else delete query.full;
    void router.replace({ pathname: router.pathname, query }, undefined, { shallow: true, scroll: false }).catch(() => {
      // The visible selection remains usable if only URL synchronization fails.
    });
  };
  const listed = useMemo(() => {
    const rows = snapshot.profiles.filter(profile => profile.position === view.position);
    return Object.fromEntries((["BL", "SH"] as Side[]).map(side => [side, rows.filter(profile => profile.score.list === side)
      .sort((a, b) => (a.score.positionRank ?? Infinity) - (b.score.positionRank ?? Infinity) || a.playerId - b.playerId)])) as Record<Side, DisplayProfile[]>;
  }, [snapshot, view.position]);
  const withheld = useMemo(() => snapshot.profiles.filter(profile => profile.score.list === null), [snapshot]);
  const reasons = useMemo(() => [...new Map(withheld.map(profile => { const reason = withheldReasonFor(profile); return [reason.key, reason.label]; })).entries()]
    .sort((a, b) => a[1].localeCompare(b[1])), [withheld]);
  const withheldRows = withheld.filter(profile => !withheldReason || withheldReasonFor(profile).key === withheldReason);
  const selectedProfile = snapshot.profiles.find(profile => profile.playerId === selected);
  const close = () => {
    const button = selected === null ? null : toggles.current.get(selected);
    setSelected(null);
    if (button?.isConnected) button.focus(); else selector.current?.focus();
  };
  const detailButton = (profile: DisplayProfile) => <button type="button" className={`${shared.rowButton} ${styles.touch}`}
    ref={node => { if (node) toggles.current.set(profile.playerId, node); else toggles.current.delete(profile.playerId); }}
    aria-expanded={selected === profile.playerId} aria-controls={selected === profile.playerId ? DETAIL_ID : undefined}
    onClick={() => selected === profile.playerId ? close() : setSelected(profile.playerId)}>
    {selected === profile.playerId ? "Hide details" : "Details"}<span className={shared.visuallyHidden}> for {profile.displayName}</span>
  </button>;

  return <>
    <section className={`${shared.panel} ${styles.watchlist}`} aria-label="Device-local watchlist">
      <h2>Watchlist on this device</h2>
      <p className={shared.muted}>Saved only in this browser on this device, with no account sync. These are player bookmarks, not current recommendations. No research gap, score or forecast is saved; inspect the dated snapshot for evidence.</p>
      {local.message && <p role="status">{local.message}</p>}
      {local.hydrated && local.status === "ready" && <>
        {!local.state.watchlist.length ? <p>No watched players yet.</p> : <ul className={styles.watchEntries}>
          {[...new Map(local.state.watchlist.map(entry => [entry.playerId, entry])).values()].map(entry => {
            const profile = snapshot.profiles.find(item => String(item.playerId) === entry.playerId);
            return <li key={entry.playerId}>
              <span>{profile?.displayName ?? `Player ${entry.playerId}`} · saved {entry.addedAt.slice(0, 10)}
                {!profile && <strong> · Unavailable in this snapshot</strong>}
                {"target" in entry && <span> · Older saved entry; its comparison values are not displayed</span>}
              </span>
              <button type="button" className={`${shared.smallButton} ${styles.touch}`} disabled={!local.canSave}
                onClick={() => removeWatch(entry.playerId)} aria-label={`Remove ${profile?.displayName ?? `player ${entry.playerId}`} from saved watchlist`}>Remove</button>
            </li>;
          })}
        </ul>}
        <button type="button" className={`${shared.smallButton} ${styles.touch}`} disabled={!local.canSave || !local.state.watchlist.length}
          onClick={() => void local.mutate(current => ({ ...current, watchlist: [] }))}>Clear watchlist</button>
      </>}
    </section>
    <div className={shared.controls}>
      <label className={`${shared.control} ${styles.control}`}>Position group
        <select value={view.position} onChange={event => { changeView({ position: event.target.value as Position, full: [] }); setSelected(null); }}>
          <option value="F">Forwards</option><option value="D">Defensemen</option>
        </select>
      </label>
      <label className={`${shared.control} ${styles.control}`}>Inspect any profile ({snapshot.profiles.length})
        <select ref={selector} value={selected ?? ""} onChange={event => setSelected(event.target.value ? Number(event.target.value) : null)}>
          <option value="">Choose a player</option>
          {[...snapshot.profiles].sort((a, b) => a.displayName.localeCompare(b.displayName) || a.playerId - b.playerId)
            .map(profile => <option key={profile.playerId} value={profile.playerId}>{profile.displayName} · {profile.position ?? "position unavailable"}</option>)}
        </select>
      </label>
    </div>
    <p className={shared.muted}>At least {snapshot.lists.minPersonalGames} personal games (provisional), a {snapshot.lists.windowGames}-game window, and an FHFH Standard gap in the list’s direction. {snapshot.headline.listOrder}. A support comparison is retrospective, not a forecast.</p>
    <p className={shared.muted}>FHFH Standard scoring only. {snapshot.headline.combinedIndexNote} Missing tracks are unavailable, never zero. Values below are totals over each player’s recorded window.</p>
    <div className={styles.lists}>
      {(["BL", "SH"] as Side[]).map(side => {
        const rows = listed[side], full = view.full.includes(side);
        const visible = full ? rows : rows.filter(profile => profile.score.positionTopN);
        const tableId = `blsh-${side}-${view.position}`;
        return <section key={side} className={styles.list} aria-label={`${SIDE_LABELS[side]} ${POSITION_LABELS[view.position].toLowerCase()}`}>
          <h2>{SIDE_LABELS[side]} research candidates · {POSITION_LABELS[view.position]}</h2>
          <p className={shared.muted}>Ordered by FHFH Standard points gap. Showing {visible.length} of {rows.length}.</p>
          <div className={`${shared.tableWrap} ${styles.scroller}`}>
            <table id={tableId} className={`${shared.table} ${styles.stickyIdentity}`} aria-label={`${SIDE_LABELS[side]} ${POSITION_LABELS[view.position].toLowerCase()} candidates`}>
              <thead><tr><th>Player / rank</th><th>FHFH Standard points</th><th>Supporting tracks</th><th>Evidence</th><th>Details</th></tr></thead>
              <tbody>{visible.map(profile => <tr key={profile.playerId}>
                <th scope="row">#{profile.score.positionRank} {profile.displayName}<br /><span className={shared.muted}>{profile.team ?? "Team unavailable"} · overall #{profile.score.rank}</span></th>
                <td>{profile.score.headline ? <><strong className={shared.num}>Gap {numberText(profile.score.headline.gap, 2, true)}</strong><br /><span className={shared.num}>{numberText(profile.score.headline.observed)} observed<br />{numberText(profile.score.headline.expected)} support comparison</span></> : "Unavailable"}</td>
                <td><span>NHL points: <TrackValue profile={profile} track="goals_plus_assists" /></span><br /><span>Game Score: <TrackValue profile={profile} track="wigo_game_score" /></span><br /><span className={shared.muted}>Observed / support comparison</span></td>
                <td>{profile.evidence.tierLabel}<br /><span className={shared.muted}>{profile.evidence.window.games} window games · {profile.evidence.reference.personalGames} personal games<br />{currentWindowAgeText(profile.evidence.window)}</span>
                  <details className={styles.chip}><summary>Opportunity (provisional): {OPPORTUNITY_LABELS[profile.opportunity.listCheck?.state ?? "unavailable"]}</summary>
                    <p>{profile.opportunity.listCheck?.text ?? profile.opportunity.reasonText ?? "Opportunity context unavailable"}</p>
                  </details>
                </td>
                <td><div className={styles.rowActions}>{detailButton(profile)}{watchButton(profile)}</div></td>
              </tr>)}</tbody>
            </table>
          </div>
          {!rows.length ? <p>No eligible candidates in this group. Nothing is forced into the list.</p> : null}
          {rows.length > snapshot.lists.topN ? <button type="button" className={`${shared.smallButton} ${styles.touch}`} aria-expanded={full} aria-controls={tableId}
            onClick={() => changeView({ ...view, full: full ? view.full.filter(value => value !== side) : [...view.full, side] })}>
            {full ? `Show top ${snapshot.lists.topN} ${SIDE_LABELS[side].toLowerCase()}` : `Show full ${SIDE_LABELS[side].toLowerCase()} list (${rows.length} ${POSITION_LABELS[view.position].toLowerCase()})`}
          </button> : <p className={shared.muted}>All {rows.length} shown.</p>}
        </section>;
      })}
    </div>
    <section className={`${shared.panel} ${styles.withheld}`} aria-label="Withheld profiles">
      <h2>Withheld / balanced / unavailable ({withheld.length})</h2>
      <label className={`${shared.control} ${styles.control}`}>Filter withheld reason
        <select value={withheldReason} onChange={event => { setWithheldReason(event.target.value); setWithheldLimit(25); }}>
          <option value="">All reasons</option>{reasons.map(([key, text]) => <option key={key} value={key}>{text}</option>)}
        </select>
      </label>
      <div className={`${shared.tableWrap} ${styles.scroller}`}><table className={`${shared.table} ${styles.stickyIdentity}`} aria-label="Withheld candidate evidence">
        <thead><tr><th>Player</th><th>Why withheld</th><th>Details</th></tr></thead>
        <tbody>{withheldRows.slice(0, withheldLimit).map(profile => <tr key={profile.playerId}>
          <th scope="row">{profile.displayName} · {profile.position ?? "Position unavailable"}</th>
          <td>{withheldReasonFor(profile).label}</td>
          <td><div className={styles.rowActions}>{detailButton(profile)}{watchButton(profile)}</div></td>
        </tr>)}</tbody>
      </table></div>
      <p className={shared.muted}>Showing {Math.min(withheldLimit, withheldRows.length)} of {withheldRows.length}. All captured profiles remain in the player selector, including zero-shot cases.</p>
      {withheldRows.length > withheldLimit ? <button type="button" className={`${shared.smallButton} ${styles.touch}`} onClick={() => setWithheldLimit(value => value + 25)}>Show next 25 withheld profiles</button> : null}
    </section>
    {selectedProfile ? <>
      <div>{watchButton(selectedProfile)}</div>
      <CurrentBlshPlayerDetail id={DETAIL_ID} profile={selectedProfile} snapshot={snapshot} onClose={close} />
      <BlshOpportunityDetails profile={selectedProfile} />
    </> : null}
  </>;
}
