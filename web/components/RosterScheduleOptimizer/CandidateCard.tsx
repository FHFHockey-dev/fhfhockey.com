import type { ReactNode } from "react";
import type { CandidateComparison, CandidateDiagnostic, CandidatePlan } from "lib/rosterScheduleOptimizer/candidatePlanMetrics";
import type { PlanningPlayer, PlanningSnapshot, PlanStep } from "lib/rosterScheduleOptimizer/planningTypes";
import type { CanonicalSchedule } from "./canonicalSchedule";
import Image from "next/image";
import styles from "./CandidateCard.module.scss";

const signed = (value: number) => `${value > 0 ? "+" : ""}${Number.isInteger(value) ? value : value.toFixed(1)}`;
const games = (value: number) => `${signed(value)} active game${Math.abs(value) === 1 ? "" : "s"}`;
const ACQUIRABLE = ["free_agent", "manager_available", "waivers"];

/** One plain-language reason built only from the compared numbers. */
function reasonFor(plan: CandidatePlan, categories: boolean, drops: number): string {
  const agp = plan.netAGP, pts = categories ? null : plan.netPoints;
  if (agp === null) return pts !== null && pts > 0 ? `${signed(pts)} projected points` : "Not enough projection data yet";
  if (agp <= 0 && (pts === null || pts <= 0)) return "No gain this week";
  if (agp === 0 && pts !== null && pts > 0) return "Same games, more points";
  const parts = [games(agp)];
  if (pts !== null) parts.push(`${signed(pts)} projected points`);
  return drops === 0 && agp > 0 && pts === null ? `Fills empty days · ${parts[0]}` : parts.join(", ");
}

export default function CandidateCard({ player, rank, plan, comparison, diagnostic, evaluationState = "completed", snapshot, categories, excluded,
  select, add, selectPlan, canSelectPlan, manual, markAvailable, compare, calendar, upcomingGames, goalieBoost, players,
  nameOf = id => (players ?? snapshot?.players)?.find(row => row.id === id)?.name ?? id }: {
  player: PlanningPlayer; rank: number | null; calendar?: CanonicalSchedule; upcomingGames?: number | null; plan?: CandidatePlan; comparison?: CandidateComparison;
  snapshot: PlanningSnapshot | null; categories: boolean; excluded: boolean;
  /** Retained for callers; per-card plan detail is no longer rendered. */
  details?: (plan: CandidatePlan) => ReactNode;
  diagnostic?: CandidateDiagnostic; evaluationState?: "no_snapshot" | "loading" | "error" | "completed";
  select: (id: string) => void; add: (player: PlanningPlayer) => void;
  selectPlan?: (steps: PlanStep[]) => void; canSelectPlan?: boolean; manual: boolean; markAvailable: (player: PlanningPlayer) => void;
  compare?: (id: string) => void; nameOf?: (id: string) => string; goalieBoost?: boolean;
  /** Player pool used to describe dropped players; falls back to the snapshot. */
  players?: PlanningPlayer[];
}) {
  void comparison;
  const drops = plan?.steps.flatMap(step => step.dropPlayerId ? [step.dropPlayerId] : []) ?? [];
  const conditional = plan?.steps.some(step => step.conditional);
  const reserves = plan?.steps.filter(step => step.type === "reserve") ?? [];
  const gain = plan && plan.netAGP !== null && (plan.netAGP > 0 || plan.netPoints !== null && plan.netPoints > 0);
  const selectionAvailable = plan && plan.netAGP !== null && (categories ? plan.categoryComparisonVerified === true
    : (plan.dropped.length === 0 || plan.netPoints !== null) && gain);
  const dates: string[] = [];
  if (snapshot?.context?.startDate && Number.isFinite(Date.parse(`${snapshot.context.startDate}T12:00:00Z`))) for (let i = 0; i < 7; i++) {
    const date = new Date(Date.parse(`${snapshot.context.startDate}T12:00:00Z`) + i * 86400000).toISOString().slice(0, 10);
    if (date <= snapshot.context.endDate) dates.push(date);
  }
  const positions = (row: PlanningPlayer) => row.eligiblePositions.join("/") || "—";
  const badge = player.availability === "waivers" ? "Waivers" : ["free_agent", "manager_available"].includes(player.availability) ? "FA" : null;
  const form = player.form?.label.toLowerCase();
  const formChip = form?.includes("hot") ? "Hot" : form?.includes("cold") ? "Cold" : null;
  const number = (label: string, value: number | null | undefined) => <span>
    <strong data-sign={value == null ? undefined : value > 0 ? "positive" : value < 0 ? "negative" : "zero"}
      title={value == null ? "Not enough projection data yet" : undefined}>{value == null ? "—" : signed(value)}</strong>
    <small>{label}</small>
  </span>;
  return <article className={styles.card} data-ranked={rank !== null} data-gain={Boolean(gain)} data-injured={Boolean(player.injury)} data-rso-candidate-id={player.id} aria-label={`${player.name} compared acquisition`}>
    {rank !== null && <span className={styles.rank} aria-label={`Result ${rank}`}>{rank}</span>}
    <div className={styles.body}>
      <div className={styles.top}>
        <div className={styles.moves}>
          <div className={styles.move}><span className={styles.add}>ADD</span>
            <button className={styles.name} aria-label={`${player.name}, ${player.teamAbbreviation ?? "Team unknown"}, ${player.eligiblePositions.join("/") || "Eligibility unknown"}`} onClick={() => select(player.id)}>{player.name}</button>
            <small>{player.teamAbbreviation ?? "—"} · {positions(player)}</small>
            {player.injury && <Image className={styles.injury} src="/pictures/injured.png" width={12} height={12}
              alt={`${player.injury.label}${player.injury.note ? ` · ${player.injury.note}` : ""}`} title={`${player.injury.label}${player.injury.note ? ` · ${player.injury.note}` : ""}`} />}
            {badge && <span className={styles.badge}>{badge}</span>}
            {formChip && <span className={styles.form} data-form={formChip.toLowerCase()}>{formChip}</span>}
          </div>
          {drops.map(id => {
            const dropped = (players ?? snapshot?.players)?.find(row => row.id === id);
            return <div key={id} className={styles.move}><span className={styles.drop}>DROP</span>
              <button className={styles.name} onClick={() => select(id)}>{nameOf(id)}</button>
              {dropped && <small>{dropped.teamAbbreviation ?? "—"} · {positions(dropped)}</small>}
            </div>;
          })}
        </div>
        {plan && <div className={styles.metrics} aria-label="Net plan comparison">
          {!categories && number("Net Pts", plan.netPoints)}
          {number("Net AGP", plan.netAGP)}
        </div>}
      </div>
      {dates.length > 0 && <div className={styles.schedule} role="group" aria-label={`${player.name} NHL schedule`}>
        {dates.map(date => {
          const canonicalKnown = calendar?.complete && Number.isSafeInteger(player.nhlTeamId) && upcomingGames != null;
          const dayGames = canonicalKnown ? calendar.games.filter(game => game.gameDate === date && (game.homeTeam.id === player.nhlTeamId || game.awayTeam.id === player.nhlTeamId)).map(game => ({ home: game.homeTeam.id === player.nhlTeamId, opponent: calendar.teams.find(team => team.id === (game.homeTeam.id === player.nhlTeamId ? game.awayTeam.id : game.homeTeam.id))?.abbreviation ?? `Team ${game.homeTeam.id === player.nhlTeamId ? game.awayTeam.id : game.homeTeam.id}` })) : snapshot?.games.filter(game => game.date === date && game.teamAbbreviation === player.teamAbbreviation && !["cancelled", "postponed"].includes(game.status)) ?? [];
          const unknown = !canonicalKnown && (snapshot?.evidence.schedule?.completeness !== "complete" || !player.teamAbbreviation);
          return <span key={date} aria-label={`${date}: ${dayGames.length ? dayGames.map(game => `${game.home ? "vs" : "at"} ${game.opponent}`).join(", ") : unknown ? "Schedule unknown" : "No game"}`}>
            <small>{new Date(`${date}T12:00:00Z`).toLocaleDateString("en-US", { weekday: "short", timeZone: "UTC" })}</small>
            {dayGames.length ? <b><i className={styles.dot} />{dayGames.map(game => game.home ? "H" : "A").join("/")}</b> : <b className={styles.off}>—</b>}
          </span>;
        })}
      </div>}
      {plan && <p className={styles.reason}>{reasonFor(plan, categories, drops.length)}</p>}
      {!plan && upcomingGames != null && <p className={styles.reason}>{upcomingGames} upcoming game{upcomingGames === 1 ? "" : "s"}</p>}
      {goalieBoost && plan?.netGoalieStarts != null && plan.netGoalieStarts > 0
        && <p className={styles.reason}>Helps your goalie minimum: {signed(plan.netGoalieStarts)} starts</p>}
      {excluded && <p className={styles.warning}>Excluded from suggestions</p>}
      {conditional && <p className={styles.warning}>Recheck availability before claiming</p>}
      {reserves.map(step => <p key={step.id} className={styles.warning}>Move {nameOf(step.playerId)} to {step.reservePosition} first</p>)}
      <div className={styles.footer}>
        {plan && selectPlan ? <button className={styles.action} disabled={!canSelectPlan || !selectionAvailable}
          aria-label={`Preview swap: add ${player.name}${drops.length ? `, drop ${drops.map(nameOf).join(", ")}` : ""}`}
          onClick={() => selectPlan(plan.steps)}>Preview swap</button>
          : ACQUIRABLE.includes(player.availability) && <button className={styles.textButton} onClick={() => add(player)}>Select add</button>}
        {!plan && evaluationState === "completed" && diagnostic?.status === "not_selected" && compare
          && <button className={styles.textButton} onClick={() => compare(player.id)}>Compare this player</button>}
        {manual && player.availability === "unknown" && <button className={styles.textButton} onClick={() => markAvailable(player)}>Mark available</button>}
      </div>
    </div>
  </article>;
}
