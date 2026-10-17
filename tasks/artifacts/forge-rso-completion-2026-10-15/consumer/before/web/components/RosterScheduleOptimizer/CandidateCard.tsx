import type { ReactNode } from "react";
import type { CandidateComparison, CandidateDiagnostic, CandidatePlan } from "lib/rosterScheduleOptimizer/candidatePlanMetrics";
import type { PlanningPlayer, PlanningSnapshot, PlanStep } from "lib/rosterScheduleOptimizer/planningTypes";
import type { CanonicalSchedule } from "./canonicalSchedule";
import styles from "./CandidateCard.module.scss";

const metric = (value: number | null) => value === null ? "unavailable" : `${value > 0 ? "+" : ""}${Number.isInteger(value) ? value : value.toFixed(1)}`;

export default function CandidateCard({ player, rank, plan, comparison, diagnostic, evaluationState = "completed", snapshot, categories, excluded, details,
  select, add, selectPlan, canSelectPlan, manual, markAvailable, calendar, upcomingGames, nameOf = id => snapshot?.players?.find(row => row.id === id)?.name ?? id }: {
  player: PlanningPlayer; rank: number | null; calendar?: CanonicalSchedule; upcomingGames?: number | null; plan?: CandidatePlan; comparison?: CandidateComparison;
  snapshot: PlanningSnapshot | null; categories: boolean; excluded: boolean; details: (plan: CandidatePlan) => ReactNode;
  diagnostic?: CandidateDiagnostic; evaluationState?: "no_snapshot" | "loading" | "error" | "completed";
  select: (id: string) => void; add: (player: PlanningPlayer) => void;
  selectPlan?: (steps: PlanStep[]) => void; canSelectPlan?: boolean; manual: boolean; markAvailable: (player: PlanningPlayer) => void;
  nameOf?: (id: string) => string;
}) {
  const drops = plan?.steps.flatMap(step => step.dropPlayerId ? [step.dropPlayerId] : []) ?? [];
  const conditional = plan?.steps.some(step => step.conditional);
  const reserves = plan?.steps.filter(step => step.type === "reserve") ?? [];
  const missing = plan && (plan.netAGP === null || !categories && plan.netPoints === null);
  const gain = plan && plan.netAGP !== null && (plan.netAGP > 0 || plan.netPoints !== null && plan.netPoints > 0);
  const evaluationMessage = evaluationState === "loading" ? "Evaluating automatic acquisition options…"
    : evaluationState === "error" ? "Automatic candidate evaluation failed. No compared result is available."
      : evaluationState === "no_snapshot" ? "Load a planning roster and schedule to evaluate automatic acquisition options."
        : diagnostic?.status === "filtered" ? "This player does not meet the current acquisition input checks."
          : diagnostic?.status === "not_selected" ? "This player is outside the bounded candidate evaluation set."
            : diagnostic?.status === "no_proposals" ? "No timed acquisition option could be generated from the current inputs."
              : diagnostic?.status === "rejected" ? "Generated options failed roster, rule or budget verification."
                : diagnostic?.status === "partial" ? "Search limit reached before a verified option was retained."
                  : snapshot && !snapshot.players.some(row => row.id === player.id) ? "This player is outside the current planning snapshot."
                    : "No candidate evaluation result is available.";
  const dates: string[] = [];
  if (snapshot?.context?.startDate && Number.isFinite(Date.parse(`${snapshot.context.startDate}T12:00:00Z`))) for (let i = 0; i < 7; i++) {
    const date = new Date(Date.parse(`${snapshot.context.startDate}T12:00:00Z`) + i * 86400000).toISOString().slice(0, 10);
    if (date <= snapshot.context.endDate) dates.push(date);
  }
  return <article className={styles.card} data-rso-candidate-id={player.id} aria-label={`${player.name} compared acquisition`}>
    <div className={styles.top}><div className={styles.heading}>
      {rank !== null && <span className={styles.rank} data-gain={Boolean(gain)} aria-label={`Result ${rank}`}>{rank}</span>}
      <div className={styles.moves}>
        <div><span className={styles.add}>ADD</span><button aria-label={`${player.name}, ${player.teamAbbreviation ?? "Team unknown"}, ${player.eligiblePositions.join("/") || "Eligibility unknown"}`} onClick={() => select(player.id)}>{player.name}</button>
          <small>{player.teamAbbreviation ?? "—"} · {player.eligiblePositions.join("/") || "Eligibility unknown"} · <span>{player.availability.replaceAll("_", " ")}</span></small></div>
        {drops.map(id => {
          const dropped = snapshot?.players?.find(row => row.id === id);
          return <div key={id}><span className={styles.drop}>DROP</span><button onClick={() => select(id)}>{nameOf(id)}</button>
            {dropped && <small>{dropped.teamAbbreviation ?? "—"} · {dropped.eligiblePositions.join("/") || "Eligibility unknown"}</small>}
          </div>;
        })}
        {plan && drops.length === 0 && <small>{reserves.length ? "Reserve move required" : "No drop in this plan"}</small>}
      </div>
    </div>
    <div className={styles.metrics} aria-label="Net plan comparison">
      {!categories && <span>Net points <strong data-positive={plan?.netPoints != null && plan.netPoints > 0}>{metric(plan?.netPoints ?? null)}</strong></span>}
      {!categories && " "}<span>Net AGP <strong data-positive={plan?.netAGP != null && plan.netAGP > 0}>{metric(plan?.netAGP ?? null)}</strong></span>
    </div></div>
    {excluded && <p className={styles.warning}>Excluded from suggestions</p>}
    {conditional && <p className={styles.warning}>Conditional · recheck availability</p>}
    {reserves.map(step => <p key={step.id} className={styles.warning}>Reserve {nameOf(step.playerId)} in {step.reservePosition} first</p>)}
    {missing && <p className={styles.warning}>Missing comparison evidence; no verified points ranking or drop advice.</p>}
    {plan && !gain && <p className={styles.warning}>No measured net gain in this compared plan.</p>}
    {!plan && <><p className={styles.warning}>{evaluationMessage}</p>
      {diagnostic && <ul aria-label={`${player.name} evaluation reasons`}>{diagnostic.reasons.map(reason => <li key={reason}>{reason}</li>)}</ul>}</>}
    {upcomingGames != null && <p className={styles.scheduleLabel}>Upcoming NHL games: {upcomingGames}</p>}
    {dates.length > 0 && <div className={styles.schedule} role="group" aria-label={`${player.name} NHL schedule, not active assignments`}>
      {dates.map(date => {
        const canonicalKnown = calendar?.complete && Number.isSafeInteger(player.nhlTeamId) && upcomingGames != null;
        const games = canonicalKnown ? calendar.games.filter(game => game.gameDate === date && (game.homeTeam.id === player.nhlTeamId || game.awayTeam.id === player.nhlTeamId)).map(game => ({ home: game.homeTeam.id === player.nhlTeamId, opponent: calendar.teams.find(team => team.id === (game.homeTeam.id === player.nhlTeamId ? game.awayTeam.id : game.homeTeam.id))?.abbreviation ?? `Team ${game.homeTeam.id === player.nhlTeamId ? game.awayTeam.id : game.homeTeam.id}` })) : snapshot?.games.filter(game => game.date === date && game.teamAbbreviation === player.teamAbbreviation && !["cancelled", "postponed"].includes(game.status)) ?? [];
        const unknown = !canonicalKnown && (snapshot?.evidence.schedule?.completeness !== "complete" || !player.teamAbbreviation);
        return <span key={date} aria-label={`${date}: ${games.length ? games.map(game => `${game.home ? "vs" : "at"} ${game.opponent}`).join(", ") : unknown ? "Schedule unknown" : "No game"}`}>
          <small>{new Date(`${date}T12:00:00Z`).toLocaleDateString("en-US", { weekday: "short", timeZone: "UTC" })}</small>
          <b>{games.length ? games.map(game => game.home ? "H" : "A").join("/") : unknown ? "?" : "—"}</b>
        </span>;
      })}
    </div>}
    {dates.length > 0 && <small className={styles.scheduleLabel}>NHL schedule{snapshot && dates.at(-1)! < snapshot.context.endDate ? " · first 7 days" : ""}{upcomingGames != null ? " · canonical team context" : snapshot?.evidence.schedule?.completeness !== "complete" ? " · partial/unknown" : ""}</small>}
    <div className={styles.footer}>
      <details className={styles.details}><summary>Plan & tradeoffs{comparison && comparison.plans.length > 1 ? ` (${comparison.plans.length})` : ""}</summary>
        {diagnostic && <p>Generated {diagnostic.generated} options · skipped {diagnostic.skipped} adds without capacity · {diagnostic.evaluated} evaluations · {diagnostic.illegal} failed rule checks · {diagnostic.unverifiedBudget} unverified budgets · {diagnostic.retained} retained options. {diagnostic.stopReason === "exhausted" ? "Generated proposals exhausted." : diagnostic.stopReason === "proposal_limit" ? "Proposal limit reached." : diagnostic.stopReason === "evaluation_limit" ? "Evaluation limit reached." : diagnostic.stopReason === "candidate_limit" ? "Candidate limit reached." : "Acquisition input checks failed."}</p>}
        {plan && <p>{details(plan)}</p>}
        {comparison && <p>{comparison.complete ? "Candidate proposals exhausted." : "Bounded candidate comparison; other times or drops may be unevaluated."}</p>}
        {comparison && comparison.plans.length > 1 && <ul>{comparison.plans.map((option, index) => <li key={index}>
          Net AGP {metric(option.netAGP)}{!categories && ` · Net points ${metric(option.netPoints)}`} · {details(option)}
        </li>)}</ul>}
      </details>
      {plan && selectPlan ? <button className={styles.action} disabled={!canSelectPlan || plan.netAGP === null || plan.dropped.length > 0 && plan.netPoints === null || !gain}
        onClick={() => selectPlan(plan.steps)}>Select compared plan</button>
        : ["free_agent", "manager_available", "waivers"].includes(player.availability) && <button className={styles.action} onClick={() => add(player)}>Select add</button>}
      {manual && player.availability === "unknown" && <button onClick={() => markAvailable(player)}>Mark available</button>}
    </div>
    {player.form && <p className={styles.warning}>{player.form.label} · {player.form.points} points / {player.form.games} games · forecast inclusion unknown</p>}
  </article>;
}
