import { useMemo, useState } from "react";
import { useCandidateMetrics } from "hooks/useCandidateMetrics";
import { normalizeEligibility } from "lib/rosterScheduleOptimizer/eligibility";
import { candidatePlanForSort, type CandidateComparison, type CandidatePlan } from "lib/rosterScheduleOptimizer/candidatePlanMetrics";
import type { PlanIntent, PlanningPlayer, PlanningResult, PlanningSnapshot, PlanStep } from "lib/rosterScheduleOptimizer/planningTypes";
import styles from "./RosterScheduleOptimizer.module.scss";
import CandidateCard from "./CandidateCard";
import InfoTooltip from "./InfoTooltip";

type Candidate = { player: PlanningPlayer; activeGames: number | null; points: number | null; activePoints: number | null;
  plan?: CandidatePlan; comparison?: CandidateComparison };
type Props = {
  players: PlanningPlayer[];
  rosterIds: Set<string>;
  snapshot: PlanningSnapshot | null;
  intent: PlanIntent;
  fits: PlanningResult["scheduleFits"];
  manual: boolean;
  select: (id: string) => void;
  add: (player: PlanningPlayer) => void;
  selectPlan?: (steps: PlanStep[]) => void;
  canSelectPlan?: boolean;
  markAvailable: (player: PlanningPlayer) => void;
};
const metric = (value: number | null) => value === null ? "unavailable" : Number.isInteger(value) ? String(value) : value.toFixed(1);
const byName = (a: Candidate, b: Candidate) => a.player.name.localeCompare(b.player.name) || a.player.id.localeCompare(b.player.id);
const byFit = (a: Candidate, b: Candidate) => (b.activeGames ?? -Infinity) - (a.activeGames ?? -Infinity) || byName(a, b);
export const compareCandidateFits = (a: Candidate, b: Candidate, sort: "points" | "schedule") => sort === "schedule"
  ? byFit(a, b) : (b.activePoints ?? -Infinity) - (a.activePoints ?? -Infinity) || byFit(a, b);

export default function CandidateBrowser({ players, rosterIds, snapshot, intent, manual, select, add, selectPlan, canSelectPlan, markAvailable }: Props) {
  const [view, setView] = useState<"team" | "all">("all");
  const [query, setQuery] = useState("");
  const [team, setTeam] = useState("");
  const [position, setPosition] = useState("");
  const [extra, setExtra] = useState(0);
  const limit = intent.alternativeCount + extra;
  const [sort, setSort] = useState<"points" | "schedule">("points");
  const categories = snapshot?.rules?.scoring.mode === "categories";
  const { metrics, loading, error } = useCandidateMetrics(snapshot, intent);
  const candidates = useMemo(() => {
    return [...new Map(players.map(player => [player.id, player])).values()]
      .filter(player => !rosterIds.has(player.id) && player.availability !== "rostered")
      .map(player => {
        const comparison = metrics?.candidates?.find(row => row.playerId === player.id);
        const plan = comparison ? candidatePlanForSort(comparison.plans, categories ? "schedule" : sort) : undefined;
        return { player, comparison, plan, activeGames: plan?.netAGP ?? null, points: plan?.netPoints ?? null, activePoints: plan?.netPoints ?? null };
      });
  }, [players, rosterIds, metrics, sort, categories]);
  const teams = [...new Set(candidates.map(row => row.player.teamAbbreviation).filter((value): value is string => Boolean(value)))].sort();
  const positions = [...new Set(candidates.flatMap(row => normalizeEligibility(row.player.eligiblePositions).positions))].sort();
  const filtered = candidates.filter(({ player }) => (!team || player.teamAbbreviation === team)
    && (!position || normalizeEligibility(player.eligiblePositions).positions.includes(position as typeof positions[number]))
    && `${player.name} ${player.teamAbbreviation ?? ""}`.toLocaleLowerCase().includes(query.trim().toLocaleLowerCase()));
  const grouped = [...new Set(filtered.map(row => row.player.teamAbbreviation ?? "Team unknown"))]
    .map(name => ({ name, rows: filtered.filter(row => (row.player.teamAbbreviation ?? "Team unknown") === name) }))
    .sort((a, b) => compareCandidateFits([...a.rows].sort((x, y) => compareCandidateFits(x, y, categories ? "schedule" : sort))[0],
      [...b.rows].sort((x, y) => compareCandidateFits(x, y, categories ? "schedule" : sort))[0], categories ? "schedule" : sort) || a.name.localeCompare(b.name));
  const nameOf = (id: string) => players.find(player => player.id === id)?.name ?? id;
  const when = (at: string) => new Date(at).toLocaleString("en-US", { month: "short", day: "numeric", hour: "numeric", minute: "2-digit", timeZone: snapshot?.context?.timeZone ?? "UTC" });
  const planDetail = (plan: CandidatePlan) => <>
    {plan.steps.map(step => <span key={step.id}>{step.type === "reserve" ? `Reserve ${nameOf(step.playerId)} in ${step.reservePosition}`
      : `${step.dropPlayerId ? `Drop ${nameOf(step.dropPlayerId)} / ` : ""}Add ${nameOf(step.playerId)}`} · submit {when(step.at)} · effective {when(step.effectiveAt)}{step.conditional ? " · conditional availability recheck" : ""}. </span>)}
    {plan.dropped.map(row => <span key={row.playerId}>Lost active contribution from {nameOf(row.playerId)}: {metric(row.lostAGP)} AGP{!categories && `, ${metric(row.lostPoints)} points`}. </span>)}
    {plan.displacedPlayerIds.length > 0 && <span>Changed roster assignments: {plan.displacedPlayerIds.map(nameOf).join(", ")}; includes positional reshuffling.</span>}
  </>;
  const row = ({ player, plan, comparison }: Candidate, index: number) => <CandidateCard key={player.id}
    player={player} rank={index + 1} plan={plan} comparison={comparison} snapshot={snapshot} categories={categories}
    excluded={intent.excludedPlayerIds.includes(player.id)} details={planDetail} nameOf={nameOf}
    select={select} add={add} selectPlan={selectPlan} canSelectPlan={canSelectPlan} manual={manual} markAvailable={markAvailable} />;
  const lists = (rows: Candidate[]) => {
    if (categories || sort === "schedule") return <><h4>Net active games</h4>{[...rows].sort((a, b) => compareCandidateFits(a, b, "schedule")).slice(0, limit).map(row)}{rows.length > limit && <button onClick={() => setExtra(current => current + intent.alternativeCount)}>Show more players</button>}</>;
    const usable = (item: Candidate) => item.activePoints !== null;
    const forecasted = rows.filter(usable).sort((a, b) => compareCandidateFits(a, b, "points"));
    const fallback = rows.filter(item => !usable(item)).sort(byFit);
    return <>{forecasted.length > 0 && <><h4>Net points · gains and tradeoffs</h4>{forecasted.slice(0, limit).map(row)}</>}
      {fallback.length > 0 && <><h4>Net AGP · points unavailable</h4>{fallback.slice(0, limit).map(row)}</>}
      {(forecasted.length > limit || fallback.length > limit) && <button onClick={() => setExtra(current => current + intent.alternativeCount)}>Show more players</button>}</>;
  };
  return <section aria-label="Candidate browser" aria-busy={loading}>
    <div className={styles.candidateToolbar}>
      <div className={styles.candidateViews} role="group" aria-label="Candidate views">
        <button aria-pressed={view === "team"} onClick={() => setView("team")}>By Team</button>
        <button aria-pressed={view === "all"} onClick={() => setView("all")}>All players</button>
      </div>
      {!categories && <label className={styles.candidateSort}>Sort<select value={sort} onChange={event => setSort(event.target.value as "points" | "schedule")}><option value="points">Net points first</option><option value="schedule">Net AGP first</option></select></label>}

    </div>
    <div className={styles.candidateTools}><details className={styles.candidateFilterDetails}><summary>Find & filter</summary><div className={styles.candidateFilters}>
      <label className={styles.field}>Find candidate<input id="rso-candidate-search" type="search" value={query} onChange={event => { setQuery(event.target.value); setExtra(0); }} /></label>
      <label className={styles.field}>Team<select value={team} onChange={event => { setTeam(event.target.value); setExtra(0); }}><option value="">All teams</option>{teams.map(value => <option key={value}>{value}</option>)}</select></label>
      <label className={styles.field}>Position<select value={position} onChange={event => { setPosition(event.target.value); setExtra(0); }}><option value="">All positions</option>{positions.map(value => <option key={value}>{value}</option>)}</select></label>
    </div></details>      <InfoTooltip label="About best-fit comparisons">
        <p>{categories ? "Category leagues: sort by net legal active games. Review category gains on the selected plan and alternatives; no points blend is inferred."
          : "Best Fit Available compares complete timed plans against the optimized original roster. Net AGP and points are separate; choose the ordering and review tradeoffs."}</p>
        <p>Compared plans include lost drop contribution, reserve prerequisites and positional reshuffling. Future availability may require rechecking. No hypothetical extra roster place is credited.</p>
        {metrics?.search && <p>{metrics.search.evaluated}/{metrics.search.maxEvaluations} evaluations · {metrics.search.candidates}/{metrics.search.eligibleCandidates} eligible candidates · {metrics.search.complete ? "Candidate proposals exhausted within this single-acquisition scope." : "Bounded search; other candidates, times or drops may be unevaluated."} Best found with the existing lineup/search bounds; not proven optimal.</p>}
      </InfoTooltip></div>
    {categories && <p className={styles.limitation}>Category leagues · net AGP order; review category tradeoffs.</p>}
    {metrics?.baseline && <p className={styles.candidateReference}>Reference: {metrics.baseline.activeGames} AGP{!categories && ` · ${metric(metrics.baseline.projectedPoints)} pts`} · {metrics?.search?.complete ? "Single add scope" : "Bounded comparison"}</p>}
    {loading && <p aria-live="polite">Calculating candidate metrics across all eligible players…</p>}
    {error && <p aria-live="polite">{error}</p>}
    {filtered.length === 0 ? <p>No candidates match these filters.</p> : view === "all" ? lists(filtered) : grouped.map(group => <details key={group.name} className={styles.alternative}><summary>{group.name} · {group.rows.length} players</summary>{lists(group.rows)}</details>)}
  </section>;
}
