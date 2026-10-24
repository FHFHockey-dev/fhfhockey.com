import { useEffect, useMemo, useState } from "react";
import { useCandidateMetrics } from "hooks/useCandidateMetrics";
import { normalizeEligibility } from "lib/rosterScheduleOptimizer/eligibility";
import { candidatePlanForSort, type CandidateComparison, type CandidateDiagnostic, type CandidatePlan } from "lib/rosterScheduleOptimizer/candidatePlanMetrics";
import type { PlanIntent, PlanningPlayer, PlanningResult, PlanningSnapshot, PlanStep } from "lib/rosterScheduleOptimizer/planningTypes";
import styles from "./RosterScheduleOptimizer.module.scss";
import CandidateCard from "./CandidateCard";
import type { CanonicalSchedule } from "./canonicalSchedule";

type Candidate = { player: PlanningPlayer; activeGames: number | null; points: number | null; activePoints: number | null;
  eligibilityKnown?: boolean; availabilityKnown?: boolean;
  plan?: CandidatePlan; comparison?: CandidateComparison; diagnostic?: CandidateDiagnostic; upcomingGames?: number | null };
type Props = {
  /** Follows the lineup goal (most starts → schedule, best projected points → points); the manager can still switch. */
  preferredSort?: "points" | "schedule";
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
const byName = (a: Candidate, b: Candidate) => a.player.name.localeCompare(b.player.name) || a.player.id.localeCompare(b.player.id);
const byFit = (a: Candidate, b: Candidate) => (b.activeGames ?? -Infinity) - (a.activeGames ?? -Infinity) || byName(a, b);
const knownInputs = (row: Candidate) => row.eligibilityKnown === true && row.availabilityKnown === true;
const compareDiscovery = (a: Candidate, b: Candidate) => Number(knownInputs(b)) - Number(knownInputs(a))
  || (b.upcomingGames ?? -Infinity) - (a.upcomingGames ?? -Infinity) || byName(a, b);
export const compareCandidateFits = (a: Candidate, b: Candidate, sort: "points" | "schedule") => sort === "schedule"
  ? byFit(a, b) : (b.activePoints ?? -Infinity) - (a.activePoints ?? -Infinity) || byFit(a, b);

export default function CandidateBrowser({ preferredSort, searchQuery, changeSearch, calendar, players, rosterIds, snapshot, intent, manual, select, add, selectPlan, canSelectPlan, markAvailable }: Props) {
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
  const [sort, setSort] = useState<"points" | "schedule">(preferredSort ?? "points");
  useEffect(() => { if (preferredSort) setSort(preferredSort); }, [preferredSort]);
  const categories = snapshot?.rules?.scoring.mode === "categories";
  // Manager-requested comparisons belong to the snapshot they were requested on.
  const [requested, setRequested] = useState<{ snapshotId: string | null; ids: string[] }>({ snapshotId: null, ids: [] });
  const requestedIds = requested.snapshotId === (snapshot?.id ?? null) ? requested.ids : [];
  const compare = (id: string) => setRequested({ snapshotId: snapshot?.id ?? null, ids: [...new Set([...requestedIds, id])] });
  const { metrics, loading, error } = useCandidateMetrics(snapshot, intent, requestedIds);
  const goalieBoost = metrics?.goalieBoost === true;
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
  const inputsToVerify = filtered.filter(row => !knownInputs(row)).length;
  // Plain-language reasons, shown once in the collapsed panel footer.
  const unrankedReasons: string[] = [];
  if (!snapshot) unrankedReasons.push("Load your roster and this week's schedule to see rankings.");
  else {
    if (inputsToVerify) unrankedReasons.push(`${inputsToVerify} player${inputsToVerify === 1 ? " is" : "s are"} missing league positions or availability, so ${inputsToVerify === 1 ? "it" : "they"} can't be ranked.`);
    if (snapshot.evidence.schedule?.completeness !== "complete") unrankedReasons.push("This week's NHL schedule isn't fully loaded yet.");
    if (snapshot.rules.scoring.mode === "points" && (!Object.keys(snapshot.rules.scoring.weights).length
      || Object.values(snapshot.rules.scoring.weights).some(weight => !Number.isFinite(weight)))) unrankedReasons.push("League scoring settings are missing, so projected points can't be calculated.");
    if (snapshot.rules.acquisitionTiming === "unknown" || snapshot.rules.acquisitionCost === null
      || !snapshot.rules.periods.length || snapshot.rules.periods.some(period => period.remaining === null)) unrankedReasons.push("Your league's add rules (timing or moves left) aren't set yet.");
    const notCompared = filtered.filter(row => !row.plan && row.diagnostic?.status === "not_selected").length;
    if (notCompared) unrankedReasons.push(`${notCompared} player${notCompared === 1 ? " wasn't" : "s weren't"} compared automatically. Use "Compare this player" to check one.`);
    if (metrics && !filtered.some(item => item.comparison?.plans.length)) unrankedReasons.push("No legal add/drop was found for your roster this week.");
  }
  const compareGroups = (a: Candidate, b: Candidate) => a.activeGames !== null || a.activePoints !== null || b.activeGames !== null || b.activePoints !== null
    ? compareCandidateFits(a, b, categories ? "schedule" : sort) : compareDiscovery(a, b);
  const grouped = [...new Set(filtered.map(row => row.player.teamAbbreviation ?? "Team unknown"))]
    .map(name => ({ name, rows: filtered.filter(row => (row.player.teamAbbreviation ?? "Team unknown") === name) }))
    .sort((a, b) => compareGroups([...a.rows].sort(compareGroups)[0], [...b.rows].sort(compareGroups)[0]) || a.name.localeCompare(b.name));
  const nameOf = (id: string) => players.find(player => player.id === id)?.name ?? id;
  const row = ({ player, plan, comparison, diagnostic, upcomingGames }: Candidate, index: number, ranked = true) => <CandidateCard key={player.id}
    player={player} rank={ranked ? index + 1 : null} calendar={calendar} upcomingGames={upcomingGames} plan={plan} comparison={comparison} snapshot={snapshot} categories={categories}
    diagnostic={diagnostic} evaluationState={loading ? "loading" : error ? "error" : !snapshot ? "no_snapshot" : "completed"}
    excluded={intent.excludedPlayerIds.includes(player.id)} nameOf={nameOf} players={players} goalieBoost={goalieBoost}
    select={select} add={add} selectPlan={selectPlan} canSelectPlan={canSelectPlan} manual={manual} markAvailable={markAvailable} compare={compare} />;
  // A goalie minimum at risk lists goalie options that add expected starts first.
  const boosted = (row: Candidate) => Number(goalieBoost && (row.plan?.netGoalieStarts ?? 0) > 0);
  const lists = (rows: Candidate[]) => {
    const pointsFirst = !categories && sort === "points";
    const forecasted = pointsFirst ? rows.filter(item => item.activePoints !== null).sort((a, b) => boosted(b) - boosted(a) || compareCandidateFits(a, b, "points")) : [];
    const schedule = rows.filter(item => item.activeGames !== null && (!pointsFirst || item.activePoints === null)).sort((a, b) => boosted(b) - boosted(a) || byFit(a, b));
    const unranked = rows.filter(item => item.activeGames === null && (!pointsFirst || item.activePoints === null))
      .sort(compareDiscovery);
    const visibleForecasted = forecasted.slice(0, limit);
    const visibleSchedule = schedule.slice(0, limit - visibleForecasted.length);
    const visibleUnranked = unranked.slice(0, limit - visibleForecasted.length - visibleSchedule.length);
    return <>{visibleForecasted.map((item, index) => row(item, index))}
      {visibleSchedule.map((item, index) => row(item, visibleForecasted.length + index))}
      {visibleUnranked.map((item, index) => row(item, index, false))}
      {rows.length > limit && <button onClick={showMore}>{`Show more recommendations (${rows.length - limit})`}</button>}</>;
  };
  return <section aria-label="Candidate browser" aria-busy={loading}>
    {!categories && <div className={styles.candidateViews} role="group" aria-label="Sort recommendations">
      <button aria-pressed={sort === "points"} onClick={() => setSort("points")}>By projected points</button>
      <button aria-pressed={sort === "schedule"} onClick={() => setSort("schedule")}>By more starts</button>
    </div>}
    {categories && <p className={styles.limitation}>Ranked by more starts. Each card shows the category gains and losses for the whole swap.</p>}
    {goalieBoost && <p className={styles.limitation}>Your goalie minimum may be missed, so goalies who add starts are listed first.</p>}
    {loading ? <p role="status" aria-live="polite">Comparing free agents…</p>
      : !hasEvaluatedFit && <p role="status">Rankings appear once projections and schedules load.</p>}
    {error && <p aria-live="polite">{error}</p>}
    <div className={styles.candidateTools}><details className={styles.candidateFilterDetails}><summary>Find & filter</summary><div className={styles.candidateFilters}>
      <label className={styles.field}>Find candidate<input id="rso-candidate-search" type="search" value={query} onChange={event => { setQuery(event.target.value); resetExpansion(); }} /></label>
      <label className={styles.field}>Team<select value={team} onChange={event => { setTeam(event.target.value); resetExpansion(); }}><option value="">All teams</option>{teams.map(value => <option key={value}>{value}</option>)}</select></label>
      <label className={styles.field}>Position<select value={position} onChange={event => { setPosition(event.target.value); resetExpansion(); }}><option value="">All positions</option>{positions.map(value => <option key={value}>{value}</option>)}</select></label>
    </div>
      <div className={styles.candidateViews} role="group" aria-label="Candidate views">
        <button aria-pressed={view === "team"} onClick={() => setView("team")}>By Team</button>
        <button aria-pressed={view === "all"} onClick={() => setView("all")}>All players</button>
      </div>
    </details></div>
    {filtered.length === 0 ? <p>No candidates match these filters.</p> : view === "all" ? lists(filtered) : grouped.map(group => <details key={group.name} className={styles.alternative}><summary>{group.name} · {group.rows.length} players</summary>{lists(group.rows)}</details>)}
    {!loading && unrankedReasons.length > 0 && <details className={styles.unrankedDisclosure}><summary>Why some players aren&apos;t ranked</summary>
      <ul aria-label="Why some players aren't ranked">{unrankedReasons.map(reason => <li key={reason}>{reason}</li>)}</ul>
    </details>}
  </section>;
}
