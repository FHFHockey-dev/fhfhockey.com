import Head from "next/head";
import Link from "next/link";
import { useEffect, useRef, useState, type FormEvent } from "react";
import { decodeGameExpectationView, GAME_EXPECTATION_VIEW_VERSION, type GameExpectationDisplayResponse } from "lib/player-forecasts/gameExpectationView";
import styles from "styles/ForgeForecasts.module.scss";

const skaterColumns = [["GOALS", "G"], ["ASSISTS", "A"], ["PP_POINTS", "PPP"], ["SHOTS_ON_GOAL", "SOG"],
  ["HITS", "HIT"], ["BLOCKED_SHOTS", "BLK"], ["PENALTY_MINUTES", "PIM"]];
const goalieColumns = [["SAVES_GOALIE", "SV"], ["GOALS_AGAINST_GOALIE", "GA"], ["SHOTS_AGAINST_GOALIE", "SA"],
  ["GOALIE_MINUTES", "Minutes"], ["WINS_GOALIE", "W"], ["SHUTOUTS_GOALIE", "SO"]];
const show = (value: number | null | undefined) => value == null ? "Unavailable" : value.toLocaleString("en-US", { maximumFractionDigits: 2 });
function addDays(date: string, days: number) {
  const instant = Date.parse(`${date}T12:00:00Z`);
  return Number.isFinite(instant) ? new Date(instant + days * 86400000).toISOString().slice(0, 10) : "";
}

export default function ForgeForecastsPage() {
  const [startDate, setStartDate] = useState(() => new Date().toISOString().slice(0, 10));
  const [endDate, setEndDate] = useState(() => addDays(new Date().toISOString().slice(0, 10), 6));
  const [mode, setMode] = useState("next_n"), [games, setGames] = useState("1");
  const [playerClass, setPlayerClass] = useState("skater"), [search, setSearch] = useState("");
  const [data, setData] = useState<GameExpectationDisplayResponse | null>(null);
  const [expandedPlayers, setExpandedPlayers] = useState<Set<string>>(() => new Set());
  const [loading, setLoading] = useState(false), [error, setError] = useState<string | null>(null);
  const controller = useRef<AbortController | null>(null);
  useEffect(() => () => controller.current?.abort(), []);

  const [expiryClock, setExpiryClock] = useState(() => Date.now());
  const expiries = data?.players.flatMap(player => player.games.flatMap(game => [...Object.values(game.targets)
    .filter(target => target.expected !== null || target.conditional !== null || target.participation?.probability != null)
    .flatMap(target => [target.expiresAt, target.participation?.expiresAt, ...target.sources.map(source => source.expiresAt)]),
    ...(game.startParticipation ? [game.startParticipation.expiresAt] : [])]))
    .map(value => Date.parse(value ?? "")).filter(Number.isFinite) ?? [];
  const expiresAt = expiries.reduce<number | null>((earliest, value) => earliest === null || value < earliest ? value : earliest, null);
  const expired = expiresAt !== null && expiresAt <= Date.now();
  useEffect(() => {
    if (expiresAt === null || expiresAt <= Date.now()) return;
    const timer = window.setTimeout(() => setExpiryClock(Date.now()), Math.min(expiresAt - Date.now(), 2_147_483_647));
    return () => window.clearTimeout(timer);
  }, [expiresAt, expiryClock]);
  useEffect(() => {
    const check = () => setExpiryClock(Date.now());
    window.addEventListener("focus", check);
    document.addEventListener("visibilitychange", check);
    return () => { window.removeEventListener("focus", check); document.removeEventListener("visibilitychange", check); };
  }, []);

  async function load(event: FormEvent) {
    event.preventDefault(); controller.current?.abort();
    const pending = new AbortController(); controller.current = pending;
    setLoading(true); setError(null); setData(null); setExpandedPlayers(new Set());
    const year = Number(startDate.slice(0, 4)) - (Number(startDate.slice(5, 7)) < 7 ? 1 : 0);
    const query = new URLSearchParams({ seasonId: `${year}${year + 1}`, startDate,
      endDate: mode === "next_n" ? addDays(startDate, 59) : endDate, mode, games, timeZone: "UTC" });
    try {
      const response = await fetch(`/api/v1/forge/forecasts?${query}`, { signal: pending.signal, cache: "no-store" });
      const payload = await response.json();
      if (!response.ok || !payload.success || payload.data?.version !== GAME_EXPECTATION_VIEW_VERSION) {
        throw new Error(payload.error ?? "Released forecasts could not be loaded.");
      }
      if (!pending.signal.aborted) setData(decodeGameExpectationView(payload.data));
    } catch (failure) {
      if (!pending.signal.aborted) setError(failure instanceof Error ? failure.message : "Released forecasts could not be loaded.");
    } finally { if (!pending.signal.aborted) setLoading(false); }
  }

  const columns = playerClass === "goalie" ? goalieColumns : skaterColumns;
  const players = data?.players.filter(player => player.playerClass === playerClass
    && `${player.name} ${player.team ?? ""}`.toLowerCase().includes(search.toLowerCase())) ?? [];
  const anyValue = players.some(player => player.games.some(game => Object.values(game.targets)
    .some(target => target.expected !== null || target.conditional !== null)));
  const conditionalRows = players.flatMap(player => player.games.flatMap(game => Object.entries(game.targets)
    .filter(([, target]) => target.allowedUses.conditionalTieBreak && target.expected === null && target.conditional !== null
      && ["per_appearance", "per_start"].includes(target.basis ?? ""))
    .map(([key, target]) => ({ player, game, key, target }))));
  return <main className={styles.page}>
    <Head><title>FORGE game forecasts | FHFH</title></Head>
    <nav aria-label="FORGE navigation"><Link href="/forge/command-center">Command Center</Link>{" · "}
      <Link href="/start-chart">Start Chart</Link>{" · "}<Link href="/roster-schedule-optimizer">Roster Schedule Optimizer</Link></nav>
    <h1>Game forecasts</h1>
    <p>Next-game, next-N and selected-date expectations use the same released game-level forecasts.</p>
    <form onSubmit={load} className={styles.controls}>
      <label>Window<select value={mode} onChange={event => setMode(event.target.value)}>
        <option value="next_n">Next scheduled team games</option><option value="calendar">Selected dates / week</option>
      </select></label>
      <label>From (UTC)<input required type="date" value={startDate} onChange={event => setStartDate(event.target.value)} /></label>
      {mode === "calendar" ? <label>Through (UTC)<input required type="date" value={endDate} min={startDate}
        max={addDays(startDate, 20)} onChange={event => setEndDate(event.target.value)} /></label>
        : <label>Team games<select value={games} onChange={event => setGames(event.target.value)}>
          {Array.from({ length: 20 }, (_, index) => <option key={index + 1}>{index + 1}</option>)}
        </select></label>}
      <button type="submit" disabled={loading}>{loading ? "Loading…" : "Load released forecasts"}</button>
    </form>
    <p>Scheduled games describe opportunities. Actual appearances and starts depend on participation evidence.
      Missing categories and incomplete totals remain unavailable.</p>
    {error && <p role="alert">{error}</p>}
    {loading && <p role="status">Loading released forecast coverage…</p>}
    {!data && !loading && !error && <p>Select a window to read released forecasts.</p>}
    {expired && <p role="alert">Forecast values expired. Load released forecasts to read the latest revision.</p>}
    {data && !expired && <>
      <p>Read as of <time dateTime={data.readAsOf}>{data.readAsOf}</time>. Forecast issuance times appear with each game.</p>
      <div className={styles.controls}>
        <label>Players<select value={playerClass} onChange={event => setPlayerClass(event.target.value)}>
          <option value="skater">Skaters</option><option value="goalie">Goalies</option></select></label>
        <label>Find player or team<input type="search" value={search} onChange={event => setSearch(event.target.value)} /></label>
      </div>
      {!anyValue && <p role="status">No released category values are available for this selection. Schedule opportunities are shown below.</p>}
      {!players.length && <p>No players match this selection.</p>}
      {conditionalRows.length > 0 && <section aria-labelledby="conditional-values-heading">
        <h2 id="conditional-values-heading">Conditional category values</h2>
        <p>These values apply if the player appears or starts. They are not expected game totals or a participation estimate,
          and are not multiplied across the selected window. Missing categories remain unavailable.</p>
        <div className={styles.tableScroll} tabIndex={0} role="region" aria-label="Conditional forecast values">
          <table><caption>Conditional category values for admitted games</caption>
            <thead><tr><th scope="col">Player</th><th scope="col">Game</th><th scope="col">Category</th>
              <th scope="col">Conditional value</th><th scope="col">Basis</th></tr></thead>
            <tbody>{conditionalRows.map(({ player, game, key, target }) => <tr key={`${player.playerId}:${game.gameId}:${key}`}>
              <th scope="row">{player.name}</th><td>{game.awayTeam} at {game.homeTeam} · {game.date} · Game {game.gameId}</td>
              <td>{columns.find(([targetKey]) => targetKey === key)?.[1] ?? key}</td><td>{show(target.conditional)}</td>
              <td>{target.basis === "per_start" ? "Per start" : target.methodVersions.includes("current-season-sog-appearance-mean-v1")
                ? "Per positive-minute appearance" : "Per appearance"}</td>
            </tr>)}</tbody>
          </table>
        </div>
        <p>Original source clocks and available sample coverage and limitations appear in each player’s game values and sources below.</p>
      </section>}
      <div className={styles.tableScroll} tabIndex={0} role="region" aria-label="Forecast totals">
        <table><caption>Expected totals for {data.scope.mode === "next_n" ? `the next ${data.scope.games} scheduled team games` : `${data.scope.startDate} through ${data.scope.endDate}`}</caption>
          <thead><tr><th scope="col">Player</th><th scope="col">Schedule opportunities</th><th scope="col">Expected appearances</th>
            {columns.map(([key, label]) => <th key={key} scope="col">{label}</th>)}</tr></thead>
          <tbody>{players.map(player => <tr key={player.playerId}>
            <th scope="row"><a href={`#player-${player.playerId}`}>{player.name}</a><small>{player.team ?? "Team unknown"}</small></th>
            <td>{player.scheduledOpportunities}{!player.horizonComplete && " · incomplete"}</td><td>{show(player.expectedAppearances)}</td>
            {columns.map(([key]) => <td key={key} title={`${player.totals[key]?.coveredGames ?? 0}/${player.scheduledOpportunities} games covered`}>{show(player.totals[key]?.expected)}</td>)}
          </tr>)}</tbody>
        </table>
      </div>
      {players.filter(player => player.games.length).map(player => <details key={player.playerId} id={`player-${player.playerId}`} className={styles.player}
        onToggle={event => {
          const open = event.currentTarget.open;
          setExpandedPlayers(current => {
            if (current.has(player.playerId) === open) return current;
            const next = new Set(current);
            if (open) next.add(player.playerId); else next.delete(player.playerId);
            return next;
          });
        }}>
        <summary>{player.name} · game values and sources</summary>
        {expandedPlayers.has(player.playerId) && player.games.map(game => <section key={game.gameId}>
          <h2>{game.awayTeam} at {game.homeTeam} · <time dateTime={game.scheduledAt}>{game.scheduledAt}</time></h2>
          <p>Game {game.gameId} · Appearance probability: {show(game.appearanceProbability)} · Start probability: {show(game.startProbability)}</p>
          <p>Power-play role: {game.powerPlayRole?.status === "not_applicable"
            ? "Not applicable (goalie)." : "Unavailable. Current role evidence is unavailable."}</p>
          {game.startParticipation && <p>Start model estimate · calibration unavailable
            {game.startParticipation.model?.sampleSize != null && ` · ${game.startParticipation.model.sampleSize} eligible games`}
            {` · Issued: ${game.startParticipation.issuedAt} · Expires: ${game.startParticipation.expiresAt}`}</p>}
          {game.limitations.length > 0 && <ul>{game.limitations.map(text => <li key={text}>{text}</li>)}</ul>}
          <div className={styles.tableScroll}><table><caption>{player.name}: per-game category coverage</caption>
            <thead><tr><th scope="col">Category</th><th scope="col">Expected contribution</th><th scope="col">Conditional value</th><th scope="col">Method / original issue</th></tr></thead>
            <tbody>{Object.entries(game.targets).map(([key, target]) => <tr key={key}>
              <th scope="row">{key}</th><td>{show(target.expected)}</td>
              <td>{show(target.conditional)}{target.conditional !== null && ` (${target.basis === "per_start" ? "per start" : "per appearance"}; conditional ability only)`}</td>
              <td>{target.methodVersions.join(", ") || "Unavailable"}
                {target.sources.map(source => <small key={source.sourceId}>{source.methodVersion === "current-season-sog-appearance-mean-v1" ? "Contribution issued" : "Issued"}: {source.issuedAt}
                  {` · Input cutoff: ${source.cutoffAt} · Expires: ${source.expiresAt}`}</small>)}
                {target.participation && <small>Participation issued: {target.participation.issuedAt}</small>}
                {target.participation?.model && <small>Participation model estimate · calibration unavailable
                  {target.participation.model.sampleSize !== null && ` · ${target.participation.model.sampleSize} eligible games`}</small>}
                <small>Sources: {target.sourceIds.join(", ") || "Unavailable"}</small>
                {target.reasons.length > 0 && <small>{target.reasons.join(", ")}</small>}</td>
            </tr>)}</tbody>
          </table></div>
        </section>)}
        {expandedPlayers.has(player.playerId) && player.playerClass === "goalie" && <p>Ratio of expected totals: SV% {show(player.ratios.SAVE_PERCENTAGE.value)};
          GAA {show(player.ratios.GOALS_AGAINST_AVERAGE.value)}. These are not expected realized ratios.</p>}
      </details>)}
      <details><summary>Coverage and method limitations</summary><ul>{data.limitations.map(text => <li key={text}>{text}</li>)}</ul></details>
    </>}
  </main>;
}
