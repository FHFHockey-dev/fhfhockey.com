import { useMemo, useState } from "react";
import { useCandidateMetrics } from "hooks/useCandidateMetrics";
import { normalizeEligibility } from "lib/rosterScheduleOptimizer/eligibility";
import type { PlanIntent, PlanningPlayer, PlanningResult, PlanningSnapshot } from "lib/rosterScheduleOptimizer/planningTypes";
import styles from "./RosterScheduleOptimizer.module.scss";

type Candidate = { player: PlanningPlayer; activeGames: number | null; points: number | null; activePoints: number | null };
type Props = {
  players: PlanningPlayer[];
  rosterIds: Set<string>;
  snapshot: PlanningSnapshot | null;
  intent: PlanIntent;
  fits: PlanningResult["scheduleFits"];
  manual: boolean;
  select: (id: string) => void;
  add: (player: PlanningPlayer) => void;
  markAvailable: (player: PlanningPlayer) => void;
};
const metric = (value: number | null) => value === null ? "unavailable" : Number.isInteger(value) ? String(value) : value.toFixed(1);
const byName = (a: Candidate, b: Candidate) => a.player.name.localeCompare(b.player.name) || a.player.id.localeCompare(b.player.id);
const byFit = (a: Candidate, b: Candidate) => (b.activeGames ?? -Infinity) - (a.activeGames ?? -Infinity) || byName(a, b);
export const compareCandidateFits = (a: Candidate, b: Candidate, sort: "points" | "schedule") => sort === "schedule"
  ? byFit(a, b) : (b.activePoints ?? -Infinity) - (a.activePoints ?? -Infinity) || byFit(a, b);

export default function CandidateBrowser({ players, rosterIds, snapshot, intent, fits, manual, select, add, markAvailable }: Props) {
  const [view, setView] = useState<"team" | "all">("team");
  const [query, setQuery] = useState("");
  const [team, setTeam] = useState("");
  const [position, setPosition] = useState("");
  const [limit, setLimit] = useState(20);
  const [sort, setSort] = useState<"points" | "schedule">("points");
  const categories = snapshot?.rules?.scoring.mode === "categories";
  const { metrics, loading, error } = useCandidateMetrics(snapshot, intent);
  const candidates = useMemo(() => {
    const points = new Map(metrics?.points);
    const activePoints = new Map(metrics?.activePoints);
    const fitScores = new Map(metrics?.activeGames ?? (!snapshot ? (fits ?? []).flatMap(fit => fit.playerIds.map(id => [id, fit.addedGames] as const)) : []));
    return [...new Map(players.map(player => [player.id, player])).values()]
      .filter(player => !rosterIds.has(player.id) && player.availability !== "rostered")
      .map(player => ({ player, activeGames: fitScores.get(player.id) ?? null, points: points.get(player.id) ?? null, activePoints: activePoints.get(player.id) ?? null }));
  }, [players, rosterIds, metrics, snapshot, fits]);
  const teams = [...new Set(candidates.map(row => row.player.teamAbbreviation).filter((value): value is string => Boolean(value)))].sort();
  const positions = [...new Set(candidates.flatMap(row => normalizeEligibility(row.player.eligiblePositions).positions))].sort();
  const filtered = candidates.filter(({ player }) => (!team || player.teamAbbreviation === team)
    && (!position || normalizeEligibility(player.eligiblePositions).positions.includes(position as typeof positions[number]))
    && `${player.name} ${player.teamAbbreviation ?? ""}`.toLocaleLowerCase().includes(query.trim().toLocaleLowerCase()));
  const grouped = [...new Set(filtered.map(row => row.player.teamAbbreviation ?? "Team unknown"))]
    .map(name => ({ name, rows: filtered.filter(row => (row.player.teamAbbreviation ?? "Team unknown") === name) }))
    .sort((a, b) => Math.max(...b.rows.map(row => row.activeGames ?? -Infinity)) - Math.max(...a.rows.map(row => row.activeGames ?? -Infinity)) || a.name.localeCompare(b.name));
  const row = ({ player, activeGames, points, activePoints }: Candidate) => <div key={player.id} className={styles.candidateRow}>
    <button onClick={() => select(player.id)}>{player.name}<small>{player.teamAbbreviation ?? "—"} · {player.eligiblePositions.join("/") || "Eligibility unknown"}</small></button>
    <span>{player.availability.replaceAll("_", " ")}</span>
    <small className={styles.candidateMetrics}>+AGP {metric(activeGames)}{!categories && ` · Horizon points ${metric(points)}`}</small>
    {view === "all" && !categories && <small className={styles.candidateMetrics}>Potential active points gain {metric(activePoints)}</small>}
    {player.form && <small className={styles.formChip}>{player.form.label} · {player.form.points} points / {player.form.games} games · forecast inclusion unknown</small>}
    {["free_agent", "manager_available", "waivers"].includes(player.availability) && <button onClick={() => add(player)}>Select add</button>}
    {manual && player.availability === "unknown" && <button onClick={() => markAvailable(player)}>Mark available</button>}
  </div>;
  const lists = (rows: Candidate[]) => {
    if (categories || view === "all" && sort === "schedule") return <><h4>Schedule first</h4>{[...rows].sort((a, b) => compareCandidateFits(a, b, "schedule")).slice(0, limit).map(row)}{rows.length > limit && <button onClick={() => setLimit(current => current + 20)}>Show more players</button>}</>;
    const usable = (item: Candidate) => view === "team" ? item.points !== null : item.activePoints !== null;
    const forecasted = rows.filter(usable).sort(view === "team"
      ? (a, b) => b.points! - a.points! || byFit(a, b)
      : (a, b) => compareCandidateFits(a, b, "points"));
    const fallback = rows.filter(item => !usable(item)).sort(byFit);
    return <>{forecasted.length > 0 && <><h4>{view === "team" ? "Comparable projected points" : "Projected fit · active points gain"}</h4>{forecasted.slice(0, limit).map(row)}</>}
      {fallback.length > 0 && <><h4>{view === "team" ? "Schedule fit · points unavailable" : "Schedule first · active points unavailable"}</h4>{fallback.slice(0, limit).map(row)}</>}
      {(forecasted.length > limit || fallback.length > limit) && <button onClick={() => setLimit(current => current + 20)}>Show more players</button>}</>;
  };
  return <section aria-label="Candidate browser" aria-busy={loading}>
    <div className={styles.candidateViews} role="group" aria-label="Candidate views">
      <button aria-pressed={view === "team"} onClick={() => setView("team")}>By Team</button>
      <button aria-pressed={view === "all"} onClick={() => setView("all")}>All players</button>
    </div>
    <div className={styles.candidateFilters}>
      <label className={styles.field}>Find candidate<input id="rso-candidate-search" type="search" value={query} onChange={event => { setQuery(event.target.value); setLimit(20); }} /></label>
      <label className={styles.field}>Team<select value={team} onChange={event => { setTeam(event.target.value); setLimit(20); }}><option value="">All teams</option>{teams.map(value => <option key={value}>{value}</option>)}</select></label>
      <label className={styles.field}>Position<select value={position} onChange={event => { setPosition(event.target.value); setLimit(20); }}><option value="">All positions</option>{positions.map(value => <option key={value}>{value}</option>)}</select></label>
      {view === "all" && !categories && <label className={styles.field}>Sort<select value={sort} onChange={event => setSort(event.target.value as "points" | "schedule")}><option value="points">Projected fit</option><option value="schedule">Schedule first</option></select></label>}
    </div>
    <p className={styles.limitation}>{categories ? "Category leagues: candidates sort by potential added active games. Review category gains on the selected plan and alternatives after acquisition timing and roster constraints." : view === "team" ? "Within each team, forecasted players sort by approved horizon points." : sort === "schedule" ? "Schedule first: potential added active games, without comparing player quality." : "Projected fit: approved points gained on potentially active games, including displaced roster points. +AGP breaks ties. Missing or incompatible comparisons use a separate schedule-first fallback."}</p>
    <p className={styles.limitation}>One hypothetical extra roster place, before a drop or acquisition timing. {!categories && "+AGP and horizon points are separate; neither is multiplied into the points gain. "} This is a potential fit, not a verified acquisition or proven optimum. Unknown availability requires verification.</p>
    {loading && <p aria-live="polite">Calculating candidate metrics across all eligible players…</p>}
    {error && <p aria-live="polite">{error}</p>}
    {filtered.length === 0 ? <p>No candidates match these filters.</p> : view === "all" ? lists(filtered) : grouped.map(group => <details key={group.name} className={styles.alternative}><summary>{group.name} · {group.rows.length} players</summary>{lists(group.rows)}</details>)}
  </section>;
}
