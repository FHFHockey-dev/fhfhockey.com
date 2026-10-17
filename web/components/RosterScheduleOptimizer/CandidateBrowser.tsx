import { useMemo, useState } from "react";
import { useCandidateMetrics } from "hooks/useCandidateMetrics";
import { normalizeEligibility } from "lib/rosterScheduleOptimizer/eligibility";
import { candidatePlanForSort, type CandidateComparison, type CandidateDiagnostic, type CandidatePlan } from "lib/rosterScheduleOptimizer/candidatePlanMetrics";
import type { PlanIntent, PlanningPlayer, PlanningResult, PlanningSnapshot, PlanStep } from "lib/rosterScheduleOptimizer/planningTypes";
import styles from "./RosterScheduleOptimizer.module.scss";
import CandidateCard from "./CandidateCard";
import InfoTooltip from "./InfoTooltip";
import type { CanonicalSchedule } from "./canonicalSchedule";

type Candidate = { player: PlanningPlayer; activeGames: number | null; points: number | null; activePoints: number | null;
  eligibilityKnown?: boolean; availabilityKnown?: boolean;
  plan?: CandidatePlan; comparison?: CandidateComparison; diagnostic?: CandidateDiagnostic; upcomingGames?: number | null };
type Props = {
  searchQuery?: string;
  changeSearch?: (query: string) => void;
  calendar?: CanonicalSchedule;
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
const knownInputs = (row: Candidate) => row.eligibilityKnown === true && row.availabilityKnown === true;
const compareDiscovery = (a: Candidate, b: Candidate) => Number(knownInputs(b)) - Number(knownInputs(a))
  || (b.upcomingGames ?? -Infinity) - (a.upcomingGames ?? -Infinity) || byName(a, b);
export const compareCandidateFits = (a: Candidate, b: Candidate, sort: "points" | "schedule") => sort === "schedule"
  ? byFit(a, b) : (b.activePoints ?? -Infinity) - (a.activePoints ?? -Infinity) || byFit(a, b);

export default function CandidateBrowser({ searchQuery, changeSearch, calendar, players, rosterIds, snapshot, intent, manual, select, add, selectPlan, canSelectPlan, markAvailable }: Props) {
  const [view, setView] = useState<"team" | "all">("all");
  const [localQuery, setLocalQuery] = useState("");
  const query = searchQuery ?? localQuery;
  const setQuery = changeSearch ?? setLocalQuery;
  const [team, setTeam] = useState("");
  const [position, setPosition] = useState("");
  const [expansion, setExpansion] = useState({ count: intent.alternativeCount, query, extra: 0 });
  if (expansion.count !== intent.alternativeCount || expansion.query !== query) setExpansion({ count: intent.alternativeCount, query, extra: 0 });
  const extra = expansion.count === intent.alternativeCount && expansion.query === query ? expansion.extra : 0;
  const limit = intent.alternativeCount + extra;
  const resetExpansion = () => setExpansion({ count: intent.alternativeCount, query, extra: 0 });
  const showMore = () => setExpansion({ count: intent.alternativeCount, query, extra: extra + intent.alternativeCount });
  const [sort, setSort] = useState<"points" | "schedule">("points");
  const categories = snapshot?.rules?.scoring.mode === "categories";
  const { metrics, loading, error } = useCandidateMetrics(snapshot, intent);
  // Discovery uses this render's clock; saved planning cutoffs remain immutable.
  const discoveryAsOf = Date.now();
  const candidates = useMemo(() => {
    const diagnostics = new Map(metrics?.diagnostics?.map(row => [row.playerId, row]));
    return [...new Map(players.map(player => [player.id, player])).values()]
      .filter(player => !rosterIds.has(player.id) && player.availability !== "rostered")
      .map(player => {
        const eligibility = normalizeEligibility(player.eligiblePositions);
        const eligibilityKnown = player.eligibilityVerified === true && eligibility.valid && eligibility.playerClass === player.playerClass;
        const availabilityKnown = ["free_agent", "manager_available", "waivers"].includes(player.availability);
        const comparison = metrics?.candidates?.find(row => row.playerId === player.id);
        const plan = comparison ? candidatePlanForSort(comparison.plans, categories ? "schedule" : sort) : undefined;
        const teamKnown = Number.isSafeInteger(player.nhlTeamId) && player.nhlTeamId! > 0
          && (calendar?.teams.some(team => team.id === player.nhlTeamId)
            || calendar?.games.some(game => game.homeTeam.id === player.nhlTeamId || game.awayTeam.id === player.nhlTeamId));
        const teamGames = calendar?.games.filter(game => game.homeTeam.id === player.nhlTeamId || game.awayTeam.id === player.nhlTeamId) ?? [];
        const clocksKnown = teamGames.every(game => Number.isFinite(Date.parse(game.startTimeUTC ?? "")));
        const statesKnown = teamGames.every(game => typeof game.gameState === "string" && game.gameState.trim().length > 0);
        const upcomingGames = calendar?.complete && clocksKnown && statesKnown && teamKnown && Number.isFinite(discoveryAsOf)
          ? teamGames.filter(game => Date.parse(game.startTimeUTC ?? "") > discoveryAsOf && !["LIVE", "CRIT", "OFF", "FINAL", "CNCL", "POST"].includes(game.gameState ?? "")).length : null;
        return { player, eligibilityKnown, availabilityKnown, comparison, plan, diagnostic: diagnostics.get(player.id), upcomingGames, activeGames: plan?.netAGP ?? null, points: plan?.netPoints ?? null, activePoints: plan?.netPoints ?? null };
      });
  }, [players, rosterIds, metrics, sort, categories, calendar, discoveryAsOf]);
  const teams = [...new Set(candidates.map(row => row.player.teamAbbreviation).filter((value): value is string => Boolean(value)))].sort();
  const positions = [...new Set(candidates.flatMap(row => normalizeEligibility(row.player.eligiblePositions).positions))].sort();
  const filtered = candidates.filter(({ player }) => (!team || player.teamAbbreviation === team)
    && (!position || normalizeEligibility(player.eligiblePositions).positions.includes(position as typeof positions[number]))
    && `${player.name} ${player.teamAbbreviation ?? ""}`.toLocaleLowerCase().includes(query.trim().toLocaleLowerCase()));
  const hasEvaluatedFit = filtered.some(item => item.activeGames !== null || item.activePoints !== null);
  const bothKnown = filtered.filter(knownInputs).length;
  const eligibilityOnly = filtered.filter(row => row.eligibilityKnown && !row.availabilityKnown).length;
  const availabilityOnly = filtered.filter(row => !row.eligibilityKnown && row.availabilityKnown).length;
  const neitherKnown = filtered.length - bothKnown - eligibilityOnly - availabilityOnly;
  const discoveryReasons: string[] = [];
  if (!snapshot) discoveryReasons.push("Load a planning roster and schedule to evaluate acquisition plans.");
  else {
    if (snapshot.evidence.schedule?.completeness !== "complete") discoveryReasons.push("Planning schedule coverage is incomplete or unknown; team schedule counts do not establish net active games.");
    discoveryReasons.push(...snapshot.rules.unsupported);
    if (snapshot.rules.scoring.mode === "points" && (!Object.keys(snapshot.rules.scoring.weights).length
      || Object.values(snapshot.rules.scoring.weights).some(weight => !Number.isFinite(weight)))) discoveryReasons.push("Supply valid league scoring weights for net points. Points also require complete qualified game forecasts for the original roster and candidate plan.");
    const acquisitionGaps = [snapshot.rules.acquisitionTiming === "unknown" && "effective timing",
      snapshot.rules.acquisitionCost === null && "cost per add",
      (!snapshot.rules.periods.length || snapshot.rules.periods.some(period => period.remaining === null)) && "remaining moves and reset periods"].filter(Boolean);
    if (acquisitionGaps.length) discoveryReasons.push(`Acquisition inputs need review: ${acquisitionGaps.join(", ")}.`);
    const unverifiedEligibility = filtered.filter(row => !row.eligibilityKnown).length;
    const unknownAvailability = filtered.filter(({ player }) => player.availability === "unknown").length;
    if (unverifiedEligibility) discoveryReasons.push(`${unverifiedEligibility} matching candidate(s) lack usable verified league eligibility.`);
    if (unknownAvailability) discoveryReasons.push(`${unknownAvailability} matching candidate(s) have unknown league availability.`);
    if (metrics && !filtered.some(item => item.comparison?.plans.length)) discoveryReasons.push("No legal acquisition plan with a verified move budget was retained. Review availability, waiver clearance, timing, locks, roster capacity and drop restrictions.");
  }
  const compareGroups = (a: Candidate, b: Candidate) => a.activeGames !== null || a.activePoints !== null || b.activeGames !== null || b.activePoints !== null
    ? compareCandidateFits(a, b, categories ? "schedule" : sort) : compareDiscovery(a, b);
  const grouped = [...new Set(filtered.map(row => row.player.teamAbbreviation ?? "Team unknown"))]
    .map(name => ({ name, rows: filtered.filter(row => (row.player.teamAbbreviation ?? "Team unknown") === name) }))
    .sort((a, b) => compareGroups([...a.rows].sort(compareGroups)[0], [...b.rows].sort(compareGroups)[0]) || a.name.localeCompare(b.name));
  const nameOf = (id: string) => players.find(player => player.id === id)?.name ?? id;
  const when = (at: string) => new Date(at).toLocaleString("en-US", { month: "short", day: "numeric", hour: "numeric", minute: "2-digit", timeZone: snapshot?.context?.timeZone ?? "UTC" });
  const planDetail = (plan: CandidatePlan) => <>
    {plan.steps.map(step => <span key={step.id}>{step.type === "reserve" ? `Reserve ${nameOf(step.playerId)} in ${step.reservePosition}`
      : `${step.dropPlayerId ? `Drop ${nameOf(step.dropPlayerId)} / ` : ""}Add ${nameOf(step.playerId)}`} · submit {when(step.at)} · effective {when(step.effectiveAt)}{step.conditional ? " · conditional availability recheck" : ""}. </span>)}
    {plan.dropped.map(row => <span key={row.playerId}>Lost active contribution from {nameOf(row.playerId)}: {metric(row.lostAGP)} AGP{!categories && `, ${metric(row.lostPoints)} points`}. </span>)}
    {plan.displacedPlayerIds.length > 0 && <span>Changed roster assignments: {plan.displacedPlayerIds.map(nameOf).join(", ")}; includes positional reshuffling.</span>}
  </>;
  const row = ({ player, plan, comparison, diagnostic, upcomingGames }: Candidate, index: number, ranked = true) => <CandidateCard key={player.id}
    player={player} rank={ranked ? index + 1 : null} calendar={calendar} upcomingGames={upcomingGames} plan={plan} comparison={comparison} snapshot={snapshot} categories={categories}
    diagnostic={diagnostic} evaluationState={loading ? "loading" : error ? "error" : !snapshot ? "no_snapshot" : "completed"}
    excluded={intent.excludedPlayerIds.includes(player.id)} details={planDetail} nameOf={nameOf}
    select={select} add={add} selectPlan={selectPlan} canSelectPlan={canSelectPlan} manual={manual} markAvailable={markAvailable} />;
  const lists = (rows: Candidate[]) => {
    const pointsFirst = !categories && sort === "points";
    const forecasted = pointsFirst ? rows.filter(item => item.activePoints !== null).sort((a, b) => compareCandidateFits(a, b, "points")) : [];
    const schedule = rows.filter(item => item.activeGames !== null && (!pointsFirst || item.activePoints === null)).sort(byFit);
    const unranked = rows.filter(item => item.activeGames === null && (!pointsFirst || item.activePoints === null))
      .sort(compareDiscovery);
    const visibleForecasted = forecasted.slice(0, limit);
    const visibleSchedule = schedule.slice(0, limit - visibleForecasted.length);
    const visibleUnranked = unranked.slice(0, limit - visibleForecasted.length - visibleSchedule.length);
    return <>{visibleForecasted.length > 0 && <><h4>Net points · gains and tradeoffs</h4>{visibleForecasted.map((item, index) => row(item, index))}</>}
      {visibleSchedule.length > 0 && <><h4>{pointsFirst ? "Net AGP · points unavailable" : "Net active games"}</h4>{visibleSchedule.map((item, index) => row(item, visibleForecasted.length + index))}</>}
      {visibleUnranked.length > 0 && <><details open className={styles.unrankedDisclosure}><summary><h4>Unranked players</h4><span> · Team schedule only</span></summary><p className={styles.limitation}>Known eligibility and availability first. Within each input group: {unranked.some(item => item.upcomingGames !== null)
        ? "Upcoming NHL games first; this is team schedule context, not net roster fit or player participation. Unknown teams follow."
        : "Alphabetical browsing; verified upcoming NHL schedule counts are unavailable."} Net comparisons require verified schedule, eligibility, availability and acquisition rules; changing the sort does not supply missing evidence.</p></details>
        {visibleUnranked.map((item, index) => row(item, index, false))}</>}
      {rows.length > limit && <button onClick={showMore}>Show more players</button>}</>;
  };
  return <section aria-label="Candidate browser" aria-busy={loading}>
    <h3>{hasEvaluatedFit ? "Evaluated fit results" : "Player discovery"}</h3>
    <p className={styles.limitation} aria-label="Candidate input coverage">{`${filtered.length} matching candidate${filtered.length === 1 ? "" : "s"} · ${bothKnown} with known eligibility and availability · ${filtered.length - bothKnown} with inputs to verify.`}</p>
    {!hasEvaluatedFit && <><p role="status">{loading ? "Candidate comparisons are being calculated. Discovery order is not a projection or roster-fit ranking."
      : "No evaluated fit ranking is available. This is a player discovery list; its order is not a projection or roster-fit score."}</p>
      {!loading && discoveryReasons.length > 0 && <ul aria-label="Missing comparison inputs">{discoveryReasons.map((reason, index) => <li key={`${index}:${reason}`}>{reason}</li>)}</ul>}</>}
    <div className={styles.candidateToolbar}>
      <div className={styles.candidateViews} role="group" aria-label="Candidate views">
        <button aria-pressed={view === "team"} onClick={() => setView("team")}>By Team</button>
        <button aria-pressed={view === "all"} onClick={() => setView("all")}>All players</button>
      </div>
      {!categories && <label className={styles.candidateSort}>Sort<select value={sort} onChange={event => setSort(event.target.value as "points" | "schedule")}><option value="points">Net points first</option><option value="schedule">Net AGP first</option></select></label>}

    </div>
    <div className={styles.candidateTools}><details className={styles.candidateFilterDetails}><summary>Find & filter</summary><div className={styles.candidateFilters}>
      <label className={styles.field}>Find candidate<input id="rso-candidate-search" type="search" value={query} onChange={event => { setQuery(event.target.value); resetExpansion(); }} /></label>
      <label className={styles.field}>Team<select value={team} onChange={event => { setTeam(event.target.value); resetExpansion(); }}><option value="">All teams</option>{teams.map(value => <option key={value}>{value}</option>)}</select></label>
      <label className={styles.field}>Position<select value={position} onChange={event => { setPosition(event.target.value); resetExpansion(); }}><option value="">All positions</option>{positions.map(value => <option key={value}>{value}</option>)}</select></label>
    </div><p className={styles.limitation}>{`${filtered.length} matching candidate${filtered.length === 1 ? "" : "s"} from ${candidates.length} in the discovery pool.`}</p>
      <p className={styles.limitation}>{bothKnown} both known · {eligibilityOnly} eligibility only · {availabilityOnly} availability only · {neitherKnown} neither known.</p>
      <p className={styles.limitation}>Known eligibility and availability are player facts. Legal plans also require verified schedule, timing, move budget, locks and roster capacity; waivers require clearance.</p>
      {metrics?.search && <p className={styles.limitation}>Bounded search selected {metrics.search.candidates} of {metrics.search.eligibleCandidates} candidates passing player checks, up to {metrics.search.maxCandidates}. Filters and Show more adjust the displayed list. The search keeps its candidate selection.</p>}
    </details>      <InfoTooltip label="About best-fit comparisons">
        <p>{categories ? "Category leagues: sort by net legal active games. Review category gains on the selected plan and alternatives; no points blend is inferred."
          : "Best Fit Available compares complete timed plans against the optimized original roster. Net AGP and points are separate; choose the ordering and review tradeoffs."}</p>
        <p>Compared plans include lost drop contribution, reserve prerequisites and positional reshuffling. Future availability may require rechecking. No hypothetical extra roster place is credited.</p>
        {metrics?.baseline && <p className={styles.candidateReference}>Reference: {metrics.baseline.activeGames}{snapshot?.evidence.schedule?.completeness === "complete" ? " AGP" : "+ known active games · schedule incomplete"}{!categories && ` · ${metric(metrics.baseline.projectedPoints)} pts`} · {metrics?.search?.complete ? "Single add scope" : "Bounded comparison"}</p>}
        {metrics?.search && <p>{metrics.search.evaluated}/{metrics.search.maxEvaluations} evaluations · {metrics.search.candidates}/{metrics.search.eligibleCandidates} eligible candidates · {metrics.search.complete ? "Candidate proposals exhausted within this single-acquisition scope." : "Bounded search; other candidates, times or drops may be unevaluated."} Best found with the existing lineup/search bounds; not proven optimal.</p>}
      </InfoTooltip></div>
    {categories && <p className={styles.limitation}>Category leagues · net AGP order; review category tradeoffs.</p>}

    {loading && <p aria-live="polite">Calculating candidate metrics within the bounded search…</p>}
    {error && <p aria-live="polite">{error}</p>}
    {filtered.length === 0 ? <p>No candidates match these filters.</p> : view === "all" ? lists(filtered) : grouped.map(group => <details key={group.name} className={styles.alternative}><summary>{group.name} · {group.rows.length} players</summary>{lists(group.rows)}</details>)}
  </section>;
}
