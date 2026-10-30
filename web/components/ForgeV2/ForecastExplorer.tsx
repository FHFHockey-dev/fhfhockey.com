import { useMemo, useRef, useState } from "react";
import type { FormEvent } from "react";
import { CATEGORIES, type Categories, type Component, type HistoryEvent, type PublicGameView, type PublicPlayerView, type PublicRevision, type ScoringProfile } from "../../lib/forge-v2/contracts";
import { DEFAULT_SCORING, scoringProfile } from "../../lib/forge-v2/identity";
import styles from "./ForecastExplorer.module.scss";

export interface ForecastExplorerProps {
  initialView: PublicPlayerView | null;
  players: Array<{ id: number; name: string }>;
  onSelectPlayer?: (playerId: number) => Promise<PublicPlayerView>;
  onRescore?: (playerId: number, profile: ScoringProfile) => Promise<PublicPlayerView>;
  /** The returned page must use this exact profile; original scores are preserved separately. */
  onLoadHistory?: (playerId: number, gameId: number, cursor: string, profile: ScoringProfile) => Promise<PublicGameView>;
}
type NumericRevision = { id: string; publishedAt: string; value: number | null; eligiblePregame: boolean };
export function buildRevisionSpans(revisions: NumericRevision[], events: HistoryEvent[]) {
  const changes = new Map<number, number>();
  for (let i = 1; i < revisions.length; i++) {
    const a = revisions[i - 1], b = revisions[i];
    if (!a.eligiblePregame || !b.eligiblePregame || a.value === null || b.value === null || a.value === b.value
      || events.some(event => ["missing_refresh", "unavailable", "failed_attempt"].includes(event.kind)
        && Date.parse(event.at) >= Date.parse(a.publishedAt) && Date.parse(event.at) <= Date.parse(b.publishedAt))) continue;
    const lower = Math.min(a.value, b.value), upper = Math.max(a.value, b.value);
    changes.set(lower, (changes.get(lower) ?? 0) + 1); changes.set(upper, (changes.get(upper) ?? 0) - 1);
  }
  const points = [...changes.keys()].sort((a, b) => a - b), spans = [];
  let traversals = 0;
  for (let i = 0; i < points.length - 1; i++) {
    traversals += changes.get(points[i])!;
    if (traversals > 0) spans.push({ lower: points[i], upper: points[i + 1], traversals, opacity: 1 - 0.75 ** traversals });
  }
  return spans;
}
const number = (value: number) => Number.isFinite(value) ? new Intl.NumberFormat("en-US", { maximumFractionDigits: 3 }).format(value) : "Unavailable";
const words = (value: string) => value.replaceAll("_", " ");
function stamp(value: string) {
  return Number.isFinite(Date.parse(value)) ? new Intl.DateTimeFormat("en-US", { timeZone: "America/New_York", month: "short", day: "numeric", hour: "numeric", minute: "2-digit", timeZoneName: "short" }).format(new Date(value)) : "Time unavailable";
}
function display(value: Component<number>): string { return value.state === "available" ? number(value.value) : `Unavailable — ${words(value.reason)}`; }
function qualified(game: PublicGameView, profile: ScoringProfile, horizon = game.opportunity.horizon) {
  return game.profileId === profile.id && game.qualification.state === "qualified" && game.qualification.supportedHorizons.includes(horizon)
    && CATEGORIES.every(c => profile.weights[c] === 0 || game.qualification.supportedCategories.includes(c));
}
function revisionValue(revision: PublicRevision, game: PublicGameView, profile: ScoringProfile) {
  return game.profileId === profile.id && revision.qualified && revision.value.state === "available" && Number.isFinite(revision.value.value) ? revision.value.value : null;
}
function sorted(revisions: PublicRevision[]) {
  return [...revisions].sort((a, b) => Date.parse(a.publishedAt) - Date.parse(b.publishedAt) || a.sequence - b.sequence || a.id.localeCompare(b.id));
}
const weightInputs = (profile: ScoringProfile) => Object.fromEntries(CATEGORIES.map(c => [c, String(profile.weights[c])])) as Categories<string>;

function RevisionGraphic({ rows, events, latest, locked, actual }: { rows: NumericRevision[]; events: HistoryEvent[]; latest: number | null; locked: number | null; actual: number | null }) {
  const spans = useMemo(() => buildRevisionSpans(rows, events), [rows, events]);
  const numeric = rows.filter(r => r.eligiblePregame && r.value !== null), values = numeric.map(r => r.value!);
  const allValues = [...values, ...(latest === null ? [] : [latest]), ...(locked === null ? [] : [locked]), ...(actual === null ? [] : [actual])];
  if (!allValues.length) return <p>No eligible numeric revisions to draw.</p>;
  const low = Math.min(...allValues), high = Math.max(...allValues), range = Math.max(high - low, 1);
  const y = (value: number) => 185 - (value - low) / range * 145;
  const x = (index: number) => 60 + index / Math.max(rows.length - 1, 1) * 570;
  return <figure className={styles.figure}>
    <svg viewBox="0 0 700 220" role="img" aria-label="Revision history: numeric ranges traversed, not outcome probability">
      {spans.map(span => <rect key={span.lower} x="48" width="600" y={y(span.upper)} height={y(span.lower) - y(span.upper)} fill="#2b7a88" opacity={span.opacity} />)}
      {[low, high].map((value, i) => <text key={i} x="5" y={y(value) + 4} fontSize="12" fill="currentColor">{number(value)}</text>)}
      {rows.map((row, i) => row.eligiblePregame && row.value !== null ? <g key={row.id}>
        <circle cx={x(i)} cy={y(row.value)} r="4" fill="currentColor" />
        <text x={x(i)} y="208" textAnchor="middle" fontSize="11" fill="currentColor">{rows.length <= 20 || i === 0 || i === rows.length - 1 ? i + 1 : ""}</text>
      </g> : null)}
      {locked !== null ? <line x1="48" x2="648" y1={y(locked)} y2={y(locked)} stroke="#985b00" strokeWidth="3" strokeDasharray="8 5" /> : null}
      {latest !== null ? <line x1="48" x2="648" y1={y(latest)} y2={y(latest)} stroke="#176879" strokeWidth="2" strokeDasharray="2 5" /> : null}
      {actual !== null ? <path d={`M 664 ${y(actual) - 7} l 7 7 l -7 7 l -7 -7 Z`} fill="#7636a0" /> : null}
    </svg>
    <figcaption>Loaded issued revision sequence. Circles: loaded revisions. Dotted line: latest. Dashed line: locked-final. Diamond: actual. Separate latest and final markers do not connect across unloaded history. Shading counts traversed ranges; it is not probability. Unavailable states and missing refreshes break the path.</figcaption>
    <details><summary>Read the shaded ranges</summary><ul>{spans.length ? spans.map(span => <li key={span.lower}>{number(span.lower)}–{number(span.upper)}: {span.traversals} traversals, {span.opacity * 100}% opacity</li>) : <li>No traversed range; isolated or unchanged revisions remain markers.</li>}</ul></details>
  </figure>;
}

/** Data enters through reviewed public DTOs. This component never starts network work itself. */
export default function ForecastExplorer({ initialView, players, onSelectPlayer, onRescore, onLoadHistory }: ForecastExplorerProps) {
  const [view, setView] = useState(initialView);
  const [query, setQuery] = useState(""), [playerId, setPlayerId] = useState(initialView?.player.id ?? players[0]?.id ?? 0);
  const [gameId, setGameId] = useState(initialView?.games[0]?.opportunity.gameId ?? 0), [vintageId, setVintageId] = useState("");
  const [weights, setWeights] = useState(() => weightInputs(initialView?.profile ?? DEFAULT_SCORING));
  const [visibleRows, setVisibleRows] = useState(50), [busy, setBusy] = useState(false), [error, setError] = useState("");
  const request = useRef(0);
  const game = view?.games.find(g => g.opportunity.gameId === gameId) ?? view?.games[0];
  const revisions = useMemo(() => sorted(game?.revisions ?? []), [game?.revisions]);
  const latest = game?.latestRevision ?? null;
  const finalRevision = game?.lockedFinalRevision?.id === game?.lockedFinal.vintageId ? game?.lockedFinalRevision : null;
  const revisionChoices = useMemo(() => sorted([...new Map([...revisions, ...(latest ? [latest] : []), ...(finalRevision ? [finalRevision] : [])].map(r => [r.id, r])).values()]), [revisions, latest, finalRevision]);
  const selectedRevision = revisionChoices.find(r => r.id === vintageId) ?? (game?.lockedFinal.state === "pending" ? latest : finalRevision);
  const graphRows = useMemo(() => game && view ? revisions.map(r => ({ id: r.id, publishedAt: r.publishedAt, eligiblePregame: r.eligiblePregame, value: revisionValue(r, game, view.profile) })) : [], [revisions, game, view]);
  const numeric = graphRows.filter(r => r.eligiblePregame && r.value !== null).map(r => r.value!);
  const canShow = !!game && !!view && qualified(game, view.profile);
  const lockedValue = game && view && game.lockedFinal.state === "selected" && finalRevision ? revisionValue(finalRevision, game, view.profile) : null;
  const actualValue = game?.actual.appearance === "official_appearance" && game.actual.value.state === "available" ? game.actual.value.value : null;
  function accept(next: PublicPlayerView, preserveOriginal: boolean) {
    setView(next); setWeights(weightInputs(next.profile)); setVintageId(""); setVisibleRows(50);
    if (!preserveOriginal) setGameId(next.games[0]?.opportunity.gameId ?? 0);
  }
  async function selectPlayer(event: FormEvent) {
    event.preventDefault(); if (!onSelectPlayer) return;
    const token = ++request.current; setBusy(true); setError("");
    try { const next = await onSelectPlayer(playerId); if (next.player.id !== playerId) throw new Error("Player response did not match the selection."); if (token === request.current) accept(next, false); }
    catch (err) { if (token === request.current) setError(err instanceof Error ? err.message : "Player could not be loaded."); }
    finally { if (token === request.current) setBusy(false); }
  }
  async function rescore(event: FormEvent) {
    event.preventDefault(); if (!view || !onRescore) return;
    let profile: ScoringProfile;
    try {
      if (CATEGORIES.some(c => !weights[c].trim())) throw new Error("Enter all seven scoring weights.");
      profile = scoringProfile(Object.fromEntries(CATEGORIES.map(c => [c, Number(weights[c])])) as Categories<number>);
    } catch { setError("Enter a finite number for every category. Positive, zero and negative weights are supported."); return; }
    const token = ++request.current; setBusy(true); setError("");
    try {
      const next = await onRescore(view.player.id, profile);
      if (next.player.id !== view.player.id || next.profile.id !== profile.id || next.scoringLabel !== "re-scored under selected profile"
        || next.games.some(g => g.profileId !== profile.id)) throw new Error("Scoring response did not match the selected profile.");
      if (token === request.current) accept(next, true);
    } catch (err) { if (token === request.current) setError(err instanceof Error ? err.message : "Scoring could not be applied."); }
    finally { if (token === request.current) setBusy(false); }
  }
  async function moreHistory() {
    if (!view || !game) return;
    if (visibleRows < revisions.length) { setVisibleRows(n => n + 50); return; }
    if (!onLoadHistory || !game.nextCursor) return;
    const token = ++request.current; setBusy(true); setError("");
    try {
      const page = await onLoadHistory(view.player.id, game.opportunity.gameId, game.nextCursor, view.profile);
      if (page.opportunity.gameId !== game.opportunity.gameId || page.opportunity.playerId !== view.player.id
        || page.profileId !== view.profile.id || page.nextCursor === game.nextCursor) throw new Error("History page did not advance the selected game and scoring profile.");
      const byId = new Map(game.revisions.map(r => [r.id, r]));
      for (const revision of page.revisions) {
        const prior = byId.get(revision.id);
        if (prior && JSON.stringify(prior) !== JSON.stringify(revision)) throw new Error("A preserved revision changed. History was not replaced.");
        byId.set(revision.id, revision);
      }
      const merged = { ...page, revisions: sorted([...byId.values()]), events: [...new Map([...game.events, ...page.events].map(e => [e.id, e])).values()] };
      if (token === request.current) {
        setView({ ...view, games: view.games.map(g => g.opportunity.gameId === merged.opportunity.gameId ? merged : g) });
        setVisibleRows(n => n + 50);
      }
    } catch (err) { if (token === request.current) setError(err instanceof Error ? err.message : "History could not be loaded."); }
    finally { if (token === request.current) setBusy(false); }
  }
  return <main className={styles.explorer} aria-busy={busy}>
    <header className={styles.header}><p className={styles.eyebrow}>FHFH · FORGE v2</p><h1>One skater. Ten games.</h1><p>Expected performance if the player officially appears. Participation and outcome uncertainty are shown separately.</p></header>
    <form className={styles.search} onSubmit={selectPlayer} aria-label="Find a skater">
      <label>Search players<input type="search" value={query} onChange={e => setQuery(e.target.value)} placeholder="Player name" /></label>
      <label>Player<select value={playerId} onChange={e => setPlayerId(Number(e.target.value))}>{players.filter(p => p.name.toLowerCase().includes(query.toLowerCase()) || p.id === playerId).map(p => <option key={p.id} value={p.id}>{p.name}</option>)}</select></label>
      <button type="submit" disabled={busy || !onSelectPlayer || !playerId}>View player</button>
    </form>
    {error ? <p role="alert" className={styles.notice}>{error}</p> : null}
    <p role="status" className={styles.status}>{busy ? "Updating selected view…" : view ? `${view.player.name} · ${view.games.length} scheduled games available` : "Choose a player when qualified forecasts are available."}</p>
    {!view ? <section className={styles.panel}><h2>Forecasts unavailable</h2><p>No qualified player view has been supplied. Public release is not active.</p></section> : <>
      <section aria-labelledby="games-heading"><h2 id="games-heading">{view.player.name} · Next scheduled games</h2><p>H1–H10 count team games, not days or player appearances. {view.games.length < 10 ? "The verified scope currently contains fewer than ten games." : "Select a game to inspect its history."}</p>
        <div className={styles.games} role="group" aria-label="Choose a scheduled game">{view.games.map(g => {
          const current = g.latestRevision, value = current && qualified(g, view.profile) ? revisionValue(current, g, view.profile) : null;
          return <button key={g.opportunity.gameId} type="button" aria-pressed={g.opportunity.gameId === game?.opportunity.gameId} onClick={() => { setGameId(g.opportunity.gameId); setVintageId(""); setVisibleRows(50); }}>
            <strong>H{g.opportunity.horizon}</strong><span>{g.opportunity.home ? "Home vs" : "Away at"} team {g.opportunity.opponentId}</span><time dateTime={g.opportunity.scheduledStartAt}>{stamp(g.opportunity.scheduledStartAt)}</time><span>{value === null ? "Forecast unavailable" : `${number(value)} FP if playing`}</span><span>{qualified(g, view.profile) ? "Qualified scope" : "Unavailable · unqualified"}</span>
          </button>;
        })}</div>
        {view.excluded.length ? <details><summary>Unavailable or excluded opportunities ({view.excluded.length})</summary><ul>{view.excluded.map((e, i) => <li key={i}>{e.gameId ? `Game ${e.gameId}: ` : "Unresolved game: "}{words(e.reason)}</li>)}</ul></details> : null}
      </section>
      <form className={styles.panel} onSubmit={rescore} aria-labelledby="scoring-heading"><h2 id="scoring-heading">Your scoring</h2><p>Use positive, zero or negative weights. Missing zero-weight categories do not block scoring.</p>
        <div className={styles.weights}>{CATEGORIES.map(c => <label key={c}>{c}<input aria-label={`${c} weight`} type="number" step="any" value={weights[c]} onChange={e => setWeights(current => ({ ...current, [c]: e.target.value }))} /></label>)}</div>
        <div className={styles.actions}><button disabled={busy || !onRescore} type="submit">Apply scoring</button><button type="button" onClick={() => setWeights(weightInputs(DEFAULT_SCORING))}>Use default weights</button></div>
        <p className={styles.caption}>{view.scoringLabel === "as issued" ? "Showing original issued scoring." : "Re-scored under selected profile. Original issued values and grades remain unchanged."} Uncertainty requires validation for every contributing category and this profile.</p>
      </form>
      {game ? <section aria-labelledby="detail-heading" className={styles.panel}>
        <h2 id="detail-heading">H{game.opportunity.horizon} · Game {game.opportunity.gameId}</h2>
        <p><strong>{words(game.freshness.state)}</strong> · As of <time dateTime={game.freshness.asOf}>{stamp(game.freshness.asOf)}</time>{game.freshness.reason ? ` · ${words(game.freshness.reason)}` : ""}</p>
        <p className={styles.notice}>{canShow ? "Qualified for the displayed scope." : "Forecast values unavailable for this scope."} {words(game.qualification.reason)} Supported horizons: {game.qualification.supportedHorizons.map(h => `H${h}`).join(", ") || "none"}. Categories: {game.qualification.supportedCategories.join(", ") || "none"}.</p>
        <dl className={styles.marks}>
          <div><dt>Latest eligible revision</dt><dd>{latest && revisionValue(latest, game, view.profile) !== null ? number(revisionValue(latest, game, view.profile)!) : "Unavailable"}</dd></div>
          <div><dt>{game.nextCursor ? "Loaded history" : "Historical"} low / high</dt><dd>{numeric.length ? `${number(Math.min(...numeric))} / ${number(Math.max(...numeric))}` : "Unavailable"}</dd></div>
          <div><dt>Locked-final forecast · dashed line</dt><dd>{game.lockedFinal.state === "pending" ? "Pending" : lockedValue === null ? "Unavailable" : number(lockedValue)}</dd><dd>{words(game.lockedFinal.timingStatus)} lock · {stamp(game.lockedFinal.lockAt)}{game.lockedFinal.reason ? ` · ${words(game.lockedFinal.reason)}` : ""}</dd></div>
          <div><dt>Actual result · diamond</dt><dd>{game.actual.appearance === "official_appearance" ? actualValue === null ? display(game.actual.value) : number(actualValue) : words(game.actual.appearance)}</dd><dd>{words(game.actual.status)}{game.actual.appearance === "nonappearance" || game.actual.appearance === "dressed_unused" ? " · Not a zero-performance appearance" : ""}</dd></div>
        </dl>
        <RevisionGraphic rows={graphRows} events={game.events} latest={latest ? revisionValue(latest, game, view.profile) : null} locked={lockedValue} actual={actualValue} />
        <div className={styles.detailGrid}><section aria-labelledby="uncertainty-heading"><h3 id="uncertainty-heading">Outcome uncertainty</h3>
          <label>Uncertainty vintage<select value={selectedRevision?.id ?? ""} onChange={e => setVintageId(e.target.value)}>{!selectedRevision ? <option value="">Final vintage unavailable</option> : null}{revisionChoices.map(r => <option key={r.id} value={r.id}>#{r.sequence} · {stamp(r.publishedAt)}{r.id === finalRevision?.id ? " · locked-final" : ""}{r.id === latest?.id ? " · latest" : ""}</option>)}</select></label>
          {selectedRevision ? <><p>Vintage <strong>{selectedRevision.id}</strong> · Artifact {words(selectedRevision.artifactState)}</p>
            {game.profileId === view.profile.id && selectedRevision.qualified && selectedRevision.intervals.state === "available" && selectedRevision.intervalVintageId === selectedRevision.id && ["online", "archived"].includes(selectedRevision.artifactState)
              ? <ul>{selectedRevision.intervals.value.map(interval => <li key={interval.level}>{interval.level * 100}% outcome interval: {number(interval.lower)}–{number(interval.upper)} fantasy points</li>)}</ul>
              : <p>Intervals unavailable{selectedRevision.intervals.state === "unavailable" ? ` — ${words(selectedRevision.intervals.reason)}` : ": vintage, artifact or qualification support is missing."}</p>}
            <p>Participation: {selectedRevision.qualified && selectedRevision.participation.state === "available" ? `${number(selectedRevision.participation.value * 100)}% official appearance probability` : "probability unavailable"}.</p>
          </> : <p>No vintage is available.</p>}</section>
          <section aria-labelledby="categories-heading"><h3 id="categories-heading">If-playing category means</h3><table className={styles.categories}><caption>Conditional category means · {selectedRevision?.id ?? "no vintage"}</caption><thead><tr><th scope="col">Category</th><th scope="col">Mean per official appearance</th></tr></thead><tbody>{CATEGORIES.map(c => <tr key={c}><th scope="row">{c}</th><td>{selectedRevision?.qualified ? display(selectedRevision.means[c]) : "Unavailable — vintage not qualified"}</td></tr>)}</tbody></table><p>Counts per official appearance; PIM is penalty minutes. A credited zero-minute appearance still counts.</p></section></div>
        <h3>Revision table</h3><p>{revisions.length} revisions loaded. {game.nextCursor ? "More history remains; extrema describe loaded history only." : "All supplied history is loaded."} Values follow the selected scoring profile.</p>
        <div className={styles.tableScroll} role="region" aria-label="Revision history table; scroll horizontally for all columns" tabIndex={0}><table><caption>Comparable revisions, publication times and original issued values</caption><thead><tr><th scope="col">Revision / time</th><th scope="col">Selected score</th><th scope="col">Original score</th><th scope="col">Horizon / trigger</th><th scope="col">Model / team</th><th scope="col">Status</th></tr></thead><tbody>{revisions.slice(0, visibleRows).map(r => {
          const value = revisionValue(r, game, view.profile);
          return <tr key={r.id}><th scope="row">#{r.sequence}<br /><time dateTime={r.publishedAt}>{stamp(r.publishedAt)}</time></th><td>{value === null ? "Unavailable" : number(value)}</td><td>{r.qualified ? display(r.issuedValue) : "Unavailable"}</td><td>H{r.horizon} · {r.trigger}</td><td>{r.modelVersion}<br />Team {r.teamId}</td><td>{r.eligiblePregame ? "Eligible pregame" : "Audit only · ineligible pregame"}<br />{words(r.artifactState)}{r.limitations.length ? <ul>{r.limitations.map((reason, i) => <li key={i}>{words(reason)}</li>)}</ul> : null}</td></tr>;
        })}</tbody></table></div>
        {visibleRows < revisions.length || game.nextCursor ? <button type="button" onClick={moreHistory} disabled={busy || visibleRows >= revisions.length && !onLoadHistory}>Load more history</button> : null}
        {game.events.length ? <details><summary>History events and gaps ({game.events.length})</summary><ul>{game.events.map(event => <li key={event.id}><time dateTime={event.at}>{stamp(event.at)}</time> · {words(event.kind)}: {words(event.reason)}</li>)}</ul></details> : null}
      </section> : <p>No game detail is available in this scope.</p>}
      <section className={styles.panel} aria-labelledby="accountability-heading"><h2 id="accountability-heading">Coverage and accountability</h2><p>{view.accountability.forecastCount} forecasts / {view.accountability.requested} requested opportunities · {view.accountability.outcomeCount} outcomes · {view.accountability.abstentions} abstentions.</p><p>Evidence: {words(view.accountability.evidenceClass)}. {view.scoringLabel}.</p><dl className={styles.marks}>{(["mae", "rmse", "bias"] as const).map(key => <div key={key}><dt>{key.toUpperCase()}</dt><dd>{display(view.accountability[key])}</dd></div>)}</dl><ul>{view.accountability.limitations.map((reason, i) => <li key={i}>{words(reason)}</li>)}</ul><p>{view.methodology}</p></section>
    </>}
  </main>;
}
