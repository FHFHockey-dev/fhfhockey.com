import React, { useEffect, useMemo, useRef, useState } from "react";

import { buildWatchlists, compareMarketReference, type MarketReference, type WatchTarget } from "lib/buyLowSellHigh/market";
import { emptyBlshState, loadBlshState, resetBlshState, saveBlshState, type BlshLocalState } from "lib/buyLowSellHigh/storage";
import { compareTrade, playerPointsTotal, type TradeScoring } from "lib/buyLowSellHigh/trade";
import { DEFAULT_HORIZON, HORIZON_OPTIONS, SKATER_TARGETS, TARGET_LABELS, type HorizonGames, type SkaterTarget } from "lib/skoElement/contract";
import { FIXTURE_AS_OF, FIXTURE_DISCLAIMER, fixtureRecords } from "lib/skoElement/fixtures";
import { DIRECTION_TEXT, formatMeasured, reasonText } from "components/skoElement/format";
import styles from "components/skoElement/SkoElement.module.scss";
import BlshPlayerDetail from "./BlshPlayerDetail";
import detailStyles from "./BlshPlayerDetail.module.scss";

/** Illustrative fixture league. PPP is an intentional bonus on top of goals and assists. */
export const FIXTURE_LEAGUE: Extract<TradeScoring, { mode: "points" }> = {
  mode: "points", scoringBasis: "points:fixture-league",
  weights: { GOALS: 3, ASSISTS: 2, PP_POINTS: 1, SHOTS_ON_GOAL: 0.5, HITS: 0.5, BLOCKED_SHOTS: 0.5,
    WINS_GOALIE: 4, SAVES_GOALIE: 0.2, GOALS_AGAINST_GOALIE: -1, SHUTOUTS_GOALIE: 3 },
};
const SKATER_WEIGHTS = Object.fromEntries(Object.entries(FIXTURE_LEAGUE.weights).filter(([key]) => (SKATER_TARGETS as readonly string[]).includes(key))) as Partial<Record<SkaterTarget, number>>;
const CATEGORIES = ["GOALS", "ASSISTS", "POINTS", "PP_POINTS", "SHOTS_ON_GOAL", "HITS", "BLOCKED_SHOTS", "WINS_GOALIE", "SAVE_PERCENTAGE", "GOALS_AGAINST_AVERAGE"];
const MARKET_MAX_AGE_HOURS = 72;

type ListName = "rebound" | "cooling";
const DETAIL_ID = "blsh-player-detail";

function defaultStorage(): Storage | null {
  try { return typeof window === "undefined" ? null : window.localStorage; } catch { return null; }
}

export default function BuyLowSellHighPreview({ storage }: { storage?: Storage | null }) {
  const [horizon, setHorizon] = useState<HorizonGames>(DEFAULT_HORIZON);
  const [target, setTarget] = useState<WatchTarget>("POINTS");
  const [list, setList] = useState<ListName>("rebound");
  const [scoringMode, setScoringMode] = useState<"points" | "categories">("points");
  const [local, setLocal] = useState<BlshLocalState>(emptyBlshState);
  const [loaded, setLoaded] = useState<{ ready: boolean; recovered: boolean }>({ ready: false, recovered: false });
  const [giveChoice, setGiveChoice] = useState("");
  const [receiveChoice, setReceiveChoice] = useState("");
  const [detailId, setDetailId] = useState<string | null>(null);
  const toggles = useRef(new Map<string, HTMLButtonElement>());
  const [refDraft, setRefDraft] = useState({ playerId: "", source: "", value: "", capturedAt: "", horizon: String(DEFAULT_HORIZON) });
  const store = storage === undefined ? defaultStorage() : storage;

  useEffect(() => {
    const result = loadBlshState(store);
    setLocal(result.state);
    setLoaded({ ready: true, recovered: result.recovered });
  }, [store]);
  useEffect(() => { if (loaded.ready) saveBlshState(store, local); }, [store, local, loaded.ready]);

  const records = useMemo(() => fixtureRecords(horizon), [horizon]);
  const lists = useMemo(() => buildWatchlists(records, target, SKATER_WEIGHTS), [records, target]);
  const byId = new Map(records.map(record => [record.identity.playerId, record]));
  const rows = lists[list];
  const scoring: TradeScoring = scoringMode === "points" ? FIXTURE_LEAGUE : { mode: "categories", categories: CATEGORIES };
  const tradeResult = compareTrade({ ...local.draft, scoring }, records);
  const allRows = [...lists.rebound, ...lists.cooling, ...lists.level, ...lists.unranked];

  const detailRecord = detailId ? byId.get(detailId) ?? null : null;
  const closeDetail = () => {
    const id = detailId;
    setDetailId(null);
    if (id) toggles.current.get(id)?.focus();
  };

  const detailToggle = (row: { playerId: string; name: string }) => (
    <button type="button" ref={node => { if (node) toggles.current.set(row.playerId, node); else toggles.current.delete(row.playerId); }}
      className={`${styles.rowButton} ${detailStyles.touchButton}`} aria-expanded={detailId === row.playerId} aria-controls={detailId === row.playerId ? DETAIL_ID : undefined}
      onClick={() => (detailId === row.playerId ? closeDetail() : setDetailId(row.playerId))}>
      {detailId === row.playerId ? "Hide details" : "Details"}<span className={styles.visuallyHidden}> for {row.name}</span></button>);

  const update = (patch: Partial<BlshLocalState>) => setLocal(current => ({ ...current, ...patch }));
  const watched = (playerId: string) => local.watchlist.some(entry => entry.playerId === playerId && entry.target === target && entry.horizon === horizon);
  const toggleWatch = (playerId: string, gap: number | null) => update({ watchlist: watched(playerId)
    ? local.watchlist.filter(entry => !(entry.playerId === playerId && entry.target === target && entry.horizon === horizon))
    : [...local.watchlist, { playerId, target, horizon, addedAt: FIXTURE_AS_OF, gapAtAdd: gap }] });
  const addTo = (side: "give" | "receive", playerId: string) => { if (playerId) update({ draft: { ...local.draft, [side]: [...local.draft[side], playerId] } }); };
  const removeFrom = (side: "give" | "receive", index: number) => update({ draft: { ...local.draft, [side]: local.draft[side].filter((_, i) => i !== index) } });
  const saveReference = () => {
    if (!refDraft.playerId) return;
    const parsed = Date.parse(refDraft.capturedAt);
    const reference: MarketReference = { source: refDraft.source, kind: "manager_entered", capturedAt: Number.isFinite(parsed) ? new Date(parsed).toISOString() : refDraft.capturedAt,
      horizonGames: Number(refDraft.horizon), scoringBasis: FIXTURE_LEAGUE.scoringBasis, unit: "fantasy_points", value: refDraft.value === "" ? Number.NaN : Number(refDraft.value) };
    update({ marketReferences: { ...local.marketReferences, [refDraft.playerId]: reference } });
  };

  return (
    <div className={styles.container}>
      <header>
        <h1 className={styles.title}>Buy Low / Sell High</h1>
        <p className={styles.subtitle}>Rebound and cooling watchlists from the shared Sko Element interpretation, plus manager-entered trade comparisons. Advisory only: nothing here submits a transaction.</p>
      </header>
      <p className={styles.fixtureBanner} role="note">{FIXTURE_DISCLAIMER}</p>
      {loaded.recovered ? <p className={styles.warn} role="alert">Saved local data was unreadable and has been reset on this device.</p> : null}

      <div className={styles.controls}>
        <label className={styles.control}>Horizon (scheduled team games)
          <select value={horizon} onChange={event => setHorizon(Number(event.target.value) as HorizonGames)}>
            {HORIZON_OPTIONS.map(option => <option key={option} value={option}>{`Next ${option}${option === DEFAULT_HORIZON ? " (default)" : ""}`}</option>)}
          </select>
        </label>
        <label className={styles.control}>Ranked by
          <select value={target} onChange={event => setTarget(event.target.value as WatchTarget)}>
            <option value="LEAGUE_POINTS">Fixture league points (skaters)</option>
            {SKATER_TARGETS.map(item => <option key={item} value={item}>{TARGET_LABELS[item]}</option>)}
          </select>
        </label>
      </div>

      <nav className={styles.tabs} aria-label="Watchlist">
        <button type="button" className={styles.tab} aria-pressed={list === "rebound"} onClick={() => setList("rebound")}>Rebound watch ({lists.rebound.length})</button>
        <button type="button" className={styles.tab} aria-pressed={list === "cooling"} onClick={() => setList("cooling")}>Cooling watch ({lists.cooling.length})</button>
      </nav>
      <p className={styles.muted}>Included by the sign of the shared gap only; alert magnitude, duration and hysteresis are undecided. A watchlist row is not a buy or sell recommendation.</p>

      <div className={`${styles.tableWrap} ${detailStyles.scrollContainer}`}>
        <table className={styles.table} aria-label={list === "rebound" ? "Rebound watch" : "Cooling watch"}>
          <thead><tr><th>Player</th><th>Recent per team game</th><th>Expected per team game</th><th>Gap</th><th>Opportunity</th><th>Evidence</th><th>Market reference</th><th>Watch</th></tr></thead>
          <tbody>{rows.map(row => {
            const record = byId.get(row.playerId)!;
            const expectedTotal = playerPointsTotal(record, FIXTURE_LEAGUE);
            const market = compareMarketReference({ value: expectedTotal.value, unit: "fantasy_points", horizonGames: horizon, scoringBasis: FIXTURE_LEAGUE.scoringBasis },
              local.marketReferences[row.playerId], { asOf: FIXTURE_AS_OF, maxAgeHours: MARKET_MAX_AGE_HOURS });
            return (
              <tr key={row.playerId}>
                <th scope="row">{row.name}<br /><span className={styles.muted}>{row.team} · {row.modelClass}</span><br />{detailToggle(row)}</th>
                <td className={styles.num}>{formatMeasured(row.observed)}</td>
                <td className={styles.num}>{formatMeasured(row.expected)}</td>
                <td className={`${styles.num} ${styles[row.direction]}`}>{formatMeasured(row.gap, 2, true)}<br /><span>{DIRECTION_TEXT[row.direction]}</span></td>
                <td>{row.opportunityLabel}</td>
                <td><span className={row.evidenceStatus === "fresh" ? undefined : styles.warn}>Evidence {row.evidenceStatus}</span>{row.sparse ? <><br /><span className={styles.muted}>sparse sample</span></> : null}</td>
                <td>{market.status === "comparable" ? market.label : <>{market.label}<br /><span className={styles.muted}>{reasonText(market.reason)}</span></>}</td>
                <td><button type="button" className={styles.smallButton} aria-pressed={watched(row.playerId)} onClick={() => toggleWatch(row.playerId, row.gap.value)}>
                  {watched(row.playerId) ? "Watching" : "Watch"}<span className={styles.visuallyHidden}> {row.name}</span></button></td>
              </tr>);
          })}</tbody>
        </table>
      </div>
      {!rows.length ? <p className={styles.muted}>No players in this list for these settings.</p> : null}
      {detailRecord ? (
        <BlshPlayerDetail id={DETAIL_ID} record={detailRecord} row={allRows.find(row => row.playerId === detailRecord.identity.playerId) ?? null}
          target={target} inCurrentList={rows.some(row => row.playerId === detailRecord.identity.playerId)} onClose={closeDetail} />) : null}
      <details>
        <summary>Unranked ({lists.unranked.length}) and level ({lists.level.length}) players</summary>
        <ul className={styles.list}>
          {lists.unranked.map(row => <li key={row.playerId}>{row.name}: gap unavailable ({reasonText(row.reason)}) {detailToggle(row)}</li>)}
          {lists.level.map(row => <li key={row.playerId}>{row.name}: {DIRECTION_TEXT.level} {detailToggle(row)}</li>)}
        </ul>
      </details>

      <section className={styles.panel} aria-label="Local watchlist">
        <h2>Your watchlist (this device only)</h2>
        {local.watchlist.length ? (
          <ul className={styles.list}>{local.watchlist.map(entry => {
            const now = allRows.find(row => row.playerId === entry.playerId);
            const current = entry.target === target && entry.horizon === horizon ? now?.gap.value ?? null : null;
            return (
              <li key={`${entry.playerId}:${entry.target}:${entry.horizon}`}>
                {byId.get(entry.playerId)?.identity.name ?? entry.playerId} · {entry.target === "LEAGUE_POINTS" ? "league points" : TARGET_LABELS[entry.target as SkaterTarget] ?? entry.target} · next {entry.horizon}: gap when added {entry.gapAtAdd === null ? "unavailable" : entry.gapAtAdd.toFixed(2)}
                {current !== null && entry.gapAtAdd !== null ? `, change since added ${(current - entry.gapAtAdd).toFixed(2)}` : ", change shown when the same category and horizon are selected"}
                {" "}<button type="button" className={styles.smallButton} onClick={() => update({ watchlist: local.watchlist.filter(item => item !== entry) })}>Remove</button>
              </li>);
          })}</ul>) : <p className={styles.muted}>No watched players.</p>}
        <div><button type="button" className={styles.smallButton} onClick={() => { resetBlshState(store); setLocal(emptyBlshState()); }}>Reset all local Buy Low/Sell High data</button></div>
      </section>

      <section className={styles.panel} aria-label="Trade comparison">
        <h2>Trade comparison (offer scenario)</h2>
        <div className={styles.controls}>
          {(["give", "receive"] as const).map(side => (
            <div key={side} className={styles.control}>
              <label className={styles.control}>{side === "give" ? "You give" : "You receive"}
                <select value={side === "give" ? giveChoice : receiveChoice} onChange={event => (side === "give" ? setGiveChoice : setReceiveChoice)(event.target.value)}>
                  <option value="">Choose a player</option>
                  {records.map(record => <option key={record.identity.playerId} value={record.identity.playerId}>{record.identity.name}</option>)}
                </select>
              </label>
              <button type="button" className={styles.smallButton} onClick={() => addTo(side, side === "give" ? giveChoice : receiveChoice)}>Add to {side}</button>
              <ul className={styles.list} aria-label={`${side} side`}>{local.draft[side].map((id, index) => (
                <li key={`${id}:${index}`}>{byId.get(id)?.identity.name ?? id} <button type="button" className={styles.smallButton} onClick={() => removeFrom(side, index)}>Remove<span className={styles.visuallyHidden}> {byId.get(id)?.identity.name ?? id}</span></button></li>
              ))}</ul>
            </div>))}
          <label className={styles.control}>Scoring
            <select value={scoringMode} onChange={event => setScoringMode(event.target.value as "points" | "categories")}>
              <option value="points">Fixture league points</option>
              <option value="categories">Category vectors</option>
            </select>
          </label>
        </div>
        {tradeResult.issues.length ? <ul className={styles.issues}>{tradeResult.issues.map(issue => <li key={issue.code}>{issue.message}</li>)}</ul> : null}
        <p>{tradeResult.summary}</p>
        {tradeResult.complete ? (
          <div className={styles.tableWrap}>
            <table className={styles.table} aria-label="Trade totals">
              <thead><tr><th>{scoringMode === "points" ? "Total" : "Category"}</th><th>Give</th><th>Receive</th><th>Net (receive − give)</th></tr></thead>
              <tbody>{tradeResult.rows.map(row => (
                <tr key={row.key}>
                  <th scope="row">{row.label}{row.lowerIsBetter ? " (lower is better)" : ""}</th>
                  <td className={styles.num}>{row.give.value === null ? `Unavailable (${reasonText(row.give.reason)})` : row.give.value.toFixed(3)}</td>
                  <td className={styles.num}>{row.receive.value === null ? `Unavailable (${reasonText(row.receive.reason)})` : row.receive.value.toFixed(3)}</td>
                  <td className={styles.num}>{row.net === null ? "Unavailable" : `${row.net > 0 ? "+" : ""}${row.net.toFixed(3)}${row.favorableForReceiver === null ? "" : row.favorableForReceiver ? " (favors receiving)" : " (favors giving)"}`}</td>
                </tr>))}</tbody>
            </table>
          </div>) : null}
        {tradeResult.players.length ? <p className={styles.muted}>Each player keeps their own team&apos;s scheduled dates: {tradeResult.players.map(player => `${player.name} ${player.startDate} to ${player.endDate}`).join("; ")}.</p> : null}
      </section>

      <section className={styles.panel} aria-label="Market reference">
        <h2>Market reference (optional, manager-entered)</h2>
        <p className={styles.muted}>A market gap appears only for a sourced, dated reference in fixture league points over the same horizon. Ownership or popularity is not a price.</p>
        <div className={styles.controls}>
          <label className={styles.control}>Player
            <select value={refDraft.playerId} onChange={event => setRefDraft({ ...refDraft, playerId: event.target.value })}>
              <option value="">Choose a player</option>
              {records.map(record => <option key={record.identity.playerId} value={record.identity.playerId}>{record.identity.name}</option>)}
            </select>
          </label>
          <label className={styles.control}>Source<input value={refDraft.source} onChange={event => setRefDraft({ ...refDraft, source: event.target.value })} /></label>
          <label className={styles.control}>Value (fantasy points)<input inputMode="decimal" value={refDraft.value} onChange={event => setRefDraft({ ...refDraft, value: event.target.value })} /></label>
          <label className={styles.control}>Captured at<input type="datetime-local" value={refDraft.capturedAt} onChange={event => setRefDraft({ ...refDraft, capturedAt: event.target.value })} /></label>
          <label className={styles.control}>Horizon
            <select value={refDraft.horizon} onChange={event => setRefDraft({ ...refDraft, horizon: event.target.value })}>
              {HORIZON_OPTIONS.map(option => <option key={option} value={option}>{`Next ${option}`}</option>)}
            </select>
          </label>
          <button type="button" className={styles.smallButton} onClick={saveReference}>Save reference</button>
        </div>
      </section>
    </div>
  );
}
