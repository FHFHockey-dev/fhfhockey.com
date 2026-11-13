import React, { useEffect, useId, useState } from "react";
import { useGoaliePresentation, useTeams } from "./contexts/GameGridContext";
import { buildGoalieWorkloadView, goalieHistoryWindow, goalieNewYorkDate, type GoalieLookback, type GoalieWorkloadSnapshot } from "./utils/goalieWorkloadView";
import styles from "./GameGrid.module.scss";

const windows: { value: string; label: string; lookback: GoalieLookback }[] = [
  ...([5, 10, 20] as const).map(count => ({ value: `games-${count}`, label: `Last ${count} completed team games`, lookback: { kind: "team_games" as const, count } })),
  ...([7, 14, 30] as const).map(count => ({ value: `days-${count}`, label: `Last ${count} calendar days`, lookback: { kind: "calendar_days" as const, count } })),
  { value: "season", label: "Season to date", lookback: { kind: "season" } },
];
const colors = ["#6ed7e0", "#ffcd75", "#c4a7ff", "#a4d89b"];

export default function GoalieWorkloadPanel() {
  const id = useId();
  const teams = Object.values(useTeams()).sort((a, b) => a.name.localeCompare(b.name));
  const presentation = useGoaliePresentation();
  const [selection, setSelection] = useState("");
  const [window, setWindow] = useState("games-10");
  const team = teams.find(t => t.abbreviation === selection) ?? teams[0];
  const workload = presentation.workload;
  const asOf = new Date().toISOString(), today = goalieNewYorkDate(asOf);
  const through = workload?.seasonId ? goalieHistoryWindow({ kind: "team_games", count: 10 }, {
    today, selectedFrom: workload.selectedFrom, selectedThrough: workload.selectedThrough,
    seasonStartsOn: `${String(workload.seasonId).slice(0, 4)}-07-01`,
  }).through : null;
  const reader = workload?.reader;
  const key = `${team?.id}/${workload?.seasonId}/${through}`;
  const [loaded, setLoaded] = useState<{ key: string; snapshot: GoalieWorkloadSnapshot | null; loading: boolean }>({ key: "", snapshot: null, loading: false });
  useEffect(() => {
    if (!reader || !team || !workload?.seasonId || !through || workload.snapshot) return;
    const controller = new AbortController(); let ignore = false;
    setLoaded({ key, snapshot: null, loading: true });
    const timeout = setTimeout(() => { ignore = true; controller.abort(); setLoaded({ key, snapshot: null, loading: false }); }, 15_000);
    void reader({ teamId: team.id, seasonId: workload.seasonId, through }, controller.signal)
      .then(snapshot => { if (!ignore) setLoaded({ key, snapshot, loading: false }); })
      .catch(() => { if (!ignore) setLoaded({ key, snapshot: null, loading: false }); })
      .finally(() => clearTimeout(timeout));
    return () => { ignore = true; controller.abort(); clearTimeout(timeout); };
    // The key contains all request scope; closing Info unmounts and aborts this read.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key, reader, workload?.snapshot]);
  const snapshot = workload?.snapshot ?? (loaded.key === key ? loaded.snapshot : null);
  const loading = !!reader && !!team && !!workload?.seasonId && !!through && !snapshot && (loaded.key !== key || loaded.loading);
  const view = (() => {
    if (!team || !workload || !snapshot || !today || !workload.seasonId) return null;
    try {
      return buildGoalieWorkloadView(team.abbreviation, windows.find(w => w.value === window)!.lookback, snapshot,
        { today, asOf, selectedFrom: workload.selectedFrom, selectedThrough: workload.selectedThrough, seasonId: workload.seasonId, seasonStartsOn: snapshot.seasonStartsOn });
    } catch { return null; }
  })();
  return <section className={styles.goalieWorkload} aria-label="Historical goalie workload">
    <h2>Historical goalie workload</h2>
    <p>The four-week schedule counts team games. This separate lookback describes past official starts; it does not predict how those future games will be split.</p>
    <div className={styles.goalieWorkloadControls}>
      <div><label htmlFor={`${id}-team`}>Team</label><select id={`${id}-team`} value={team?.abbreviation ?? ""} onChange={e => setSelection(e.target.value)}>
        {teams.map(t => <option key={t.id} value={t.abbreviation}>{t.name}</option>)}
      </select></div>
      <div><label htmlFor={`${id}-window`}>Historical lookback</label><select id={`${id}-window`} value={window} onChange={e => setWindow(e.target.value)}>
        {windows.map(w => <option key={w.value} value={w.value}>{w.label}</option>)}
      </select></div>
    </div>
    {!view || !snapshot ? <p role="status">{loading ? "Loading historical goalie workload…" : "Historical workload unavailable. No verified records are available for this view."}</p> : <div aria-live="polite">
      {snapshot.coverageBasis === "stored_regular_season_schedule" && <p>Regular-season games only, by scheduled game date. Coverage is checked against the stored schedule, not an independent schedule archive. Missing results or final-state evidence that could affect the selected lookback make its coverage incomplete. Exact game completion times are unavailable.</p>}
      <p>Lookback: {view.from ?? `last ${view.requestedGames} completed team games`} through {view.through} · current season only.</p>
      <p>Included game dates: {view.firstGameDate ?? "none"} – {view.lastGameDate ?? "none"}. Data through: {view.dataThrough ?? "unavailable"}.</p>
      <p>{view.observedTeamGames} completed team games observed{view.shortSample ? `; fewer than the requested ${view.requestedGames}` : ""}.
        {view.denominator == null ? " Full denominator unavailable." : ` ${view.resolvedStarts} resolved starts; ${view.unresolvedStarts} unresolved.`}</p>
      {view.denominator != null && view.denominator > 0 && <div className={styles.goalieWorkloadBar} role="img"
        aria-label={`${view.resolvedStarts} resolved official starts and ${view.unresolvedStarts} unresolved out of ${view.denominator} completed team games`}>
        {view.goalies.map((g, i) => <span key={g.playerId} style={{ width: `${(g.knownStartShare ?? 0) * 100}%`, backgroundColor: colors[i % colors.length] }} />)}
        <span style={{ width: `${(view.unresolvedStarts ?? 0) / view.denominator * 100}%`, backgroundColor: "#787d86" }} />
      </div>}
      <ul>{view.goalies.map(g => <li key={g.playerId}><strong>{g.name ?? `Goalie ${g.playerId}`}</strong>: {g.starts} known starts;
        {g.knownStartShare == null ? " start share unavailable" : ` ${(g.knownStartShare * 100).toFixed(1)}% known share of completed team games`}.
        {` ${g.appearances} appearances; ${g.reliefAppearances} relief; ${g.unknownLabels} unknown start labels.`}</li>)}</ul>
      {view.unresolvedStarts ? <p>Unresolved games stay separate. Known shares are lower bounds, not renormalized estimates.</p> : null}
      {view.state === "no_games" && <p>No completed games in this lookback.</p>}
      {view.reasons.map(reason => <p key={reason}>{reason}</p>)}
      <p>Team membership is recorded per game. A traded goalie&rsquo;s starts for another team are excluded from this team&rsquo;s split. Injuries and call-ups do not change past starts or create future start probabilities.</p>
      <p>Source: {snapshot.source} · observed {snapshot.observedAt} · revision {snapshot.revision}.</p>
    </div>}
  </section>;
}
