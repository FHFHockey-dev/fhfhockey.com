import { useEffect, useId, useState, type ReactNode } from "react";
import { streamingChainSteps } from "lib/rosterScheduleOptimizer/streamingChain";
import type { PlanStep, StreamingChain, StreamingGoalieMinimum, StreamingLeg, StreamingPlan } from "lib/rosterScheduleOptimizer/planningTypes";
import styles from "./StreamingItinerary.module.scss";

const dateLabel = (date: string) => new Date(`${date}T12:00:00Z`).toLocaleDateString("en-US", { weekday: "short", month: "short", day: "numeric", timeZone: "UTC" });
const number = (value: number | null) => value === null ? "—" : Number.isInteger(value) ? String(value) : value.toFixed(1);
const signed = (value: number | null) => value === null ? "unknown" : `${value > 0 ? "+" : ""}${number(value)}`;

/** Totals after swaps: the certified chain's net plus each swapped option's change (an estimate until re-planned). */
function totals(chain: StreamingChain, overrides: Record<number, string>) {
  let games = chain.netGames, points = chain.netPoints;
  for (const [index, playerId] of Object.entries(overrides)) {
    const leg = chain.legs[Number(index)], option = leg?.options.find(item => item.playerId === playerId);
    if (!leg || !option || option.playerId === leg.playerId) continue;
    games += option.games - leg.games;
    points = points === null || option.points === null || leg.points === null ? null : points + option.points - leg.points;
  }
  return { games, points };
}

/** The section's open state is remembered per browser. */
export const STREAMING_PLAN_OPEN_KEY = "fhfh:rso:streaming-plan-open:v1";

const meets = (chain: StreamingChain) => !chain.evaluation.goalie.risk;
const chainName = (chain: StreamingChain) => `${chain.spots === 1 ? "one-spot" : "two-spot"} plan (${signed(chain.netGames)} AGP)`;
/** Goalie-minimum readout for the shown chain, and what meeting it costs against a chain that misses it (never silent). */
function goalieStatus(minimum: StreamingGoalieMinimum, chain: StreamingChain, chains: StreamingChain[]) {
  const status = `Goalie starts ${number(minimum.baseline)}/${minimum.required} → ${number(chain.evaluation.goalie.projected)}/${minimum.required} with this plan · ${meets(chain) ? "meets the minimum" : minimum.cover ? "misses the minimum" : "misses the minimum (risk accepted)"}`;
  let tradeoff: string | null = null;
  if (!minimum.cover) return { status, tradeoff };
  if (meets(chain)) {
    const other = chains.find(item => !meets(item) && (item.netGames > chain.netGames
      || item.netGames === chain.netGames && item.netPoints !== null && chain.netPoints !== null && item.netPoints > chain.netPoints));
    if (other) tradeoff = `Meeting it costs ${other.netGames > chain.netGames ? `${other.netGames - chain.netGames} AGP` : `${number(other.netPoints! - chain.netPoints!)} proj FPts`} versus the ${chainName(other)}, which misses it.`;
  } else {
    const other = chains.find(meets);
    if (other) tradeoff = `The ${chainName(other)} meets it instead.`;
  }
  return { status, tradeoff };
}

/** Day-by-day streaming plan: ADD or HOLD per day for each stream spot, the ranked options for each add, and totals.
 * Ranked by the average of projected FPts and last-10 FPts/G over the games each player would start; totals show projections.
 * Days from today before `from` (the plan start) or after `through` (the range end) are listed greyed, unplanned.
 * `confirm` is an inline way past `selectDisabled` (the planning-inputs confirmation), shown beside the reason. */
export default function StreamingItinerary({ plan, dates, from, through, today, nameOf, teamOf, selectDisabled, confirm, onSelect }: {
  plan: StreamingPlan | undefined; dates: string[]; from?: string; through?: string; today: string; nameOf: (id: string) => string;
  teamOf: (id: string) => string | null; selectDisabled: string | null; confirm?: ReactNode; onSelect: (steps: PlanStep[]) => void;
}) {
  const [choice, setChoice] = useState<{ key: string; chain: number; overrides: Record<number, string> }>({ key: "", chain: 0, overrides: {} });
  const [open, setOpen] = useState(true);
  const bodyId = useId();
  useEffect(() => {
    try { if (window.localStorage.getItem(STREAMING_PLAN_OPEN_KEY) === "0") setOpen(false); } catch { /* storage unavailable */ }
  }, []);
  if (!plan) return null;
  const toggle = () => {
    setOpen(!open);
    try { window.localStorage.setItem(STREAMING_PLAN_OPEN_KEY, open ? "0" : "1"); } catch { /* storage unavailable */ }
  };
  const section = (body: ReactNode) => <section className={styles.itinerary} aria-label="Streaming plan">
    <h3><button type="button" className={styles.toggle} aria-expanded={open} aria-controls={bodyId} onClick={toggle}>Streaming plan</button></h3>
    <div id={bodyId} className={styles.body} hidden={!open}>{open && body}</div>
  </section>;
  const key = plan.chains.map(chain => chain.steps.map(step => step.id).join("|")).join("/");
  const state = choice.key === key ? choice : { key, chain: 0, overrides: {} };
  const chain = plan.chains[state.chain];
  if (!chain) return section(<p className={styles.note}>{plan.limitations[0] ?? "No streaming chain adds active games this week."}</p>);
  const playerFor = (index: number) => state.overrides[index] ?? chain.legs[index].playerId;
  const ordered = chain.legs.map((leg, index) => ({ leg, index })).sort((a, b) => a.leg.startDate.localeCompare(b.leg.startDate) || a.leg.spot - b.leg.spot);
  const optionFor = (index: number) => chain.legs[index].options.find(option => option.playerId === playerFor(index));
  const legGames = (index: number) => optionFor(index)?.games ?? chain.legs[index].games;
  const gameDates = (index: number) => optionFor(index)?.gameDates ?? chain.legs[index].gameDates;
  const cumulative = new Map<number, { adds: number; games: number }>();
  ordered.reduce((sum, { index }) => { const next = { adds: sum.adds + 1, games: sum.games + legGames(index) }; cumulative.set(index, next); return next; }, { adds: 0, games: 0 });
  const total = totals(chain, state.overrides), estimated = Object.entries(state.overrides).some(([index, id]) => chain.legs[Number(index)].playerId !== id);
  const spots = [...new Set(chain.legs.map(leg => leg.spot))];
  const describe = (id: string) => `${nameOf(id)}${teamOf(id) ? ` (${teamOf(id)})` : ""}`;
  const update = (patch: Partial<typeof state>) => setChoice({ ...state, ...patch });
  const goalie = plan.goalieMinimum ? goalieStatus(plan.goalieMinimum, chain, plan.chains) : null;
  const legOn = (spot: number, date: string): { leg: StreamingLeg; index: number } | null => {
    const index = chain.legs.findIndex(leg => leg.spot === spot && leg.startDate <= date && date <= leg.endDate);
    return index < 0 ? null : { leg: chain.legs[index], index };
  };
  const unplanned = (date: string) => Boolean((from && date < from) || (through && date > through));
  return section(<>
    {plan.chains.length > 1 && <div className={styles.spots} role="group" aria-label="Stream spots">{plan.chains.map((option, index) =>
      <button key={index} aria-pressed={state.chain === index} onClick={() => update({ chain: index, overrides: {} })}>
        {option.spots === 1 ? "One spot" : "Two spots"} · {signed(option.netGames)} AGP{plan.goalieMinimum ? ` · ${meets(option) ? "meets" : "misses"} G min` : ""}{index === 0 ? " · suggested" : ""}</button>)}</div>}
    <p className={styles.totals} aria-label="Streaming totals">Adds {chain.addsUsed}/{chain.addsAvailable} · {signed(total.games)} AGP · {signed(total.points)} proj FPts{estimated ? " (estimate after swaps)" : chain.netScore != null ? ` · ${signed(chain.netScore)} blended FPts` : ""}</p>
    {goalie && <p className={styles.totals} aria-label="Goalie minimum">{goalie.status}{estimated ? " (before swaps)" : ""}</p>}
    {goalie?.tradeoff && <p className={styles.note}>{goalie.tradeoff}</p>}
    <ol className={styles.days}>{dates.filter(date => date >= today).map(date => unplanned(date) ? <li key={date} className={`${styles.day} ${styles.greyedDay}`}>
      <strong className={styles.date}>{dateLabel(date)}</strong>
      <p className={styles.hold}>Not planned · {from && date < from ? "before the plan start" : "after the planning range"}</p>
    </li> : <li key={date} className={styles.day}>
      <strong className={styles.date}>{dateLabel(date)}</strong>
      <div className={styles.moves}>{spots.map(spot => {
        const found = legOn(spot, date), label = spots.length > 1 ? `Spot ${spot + 1}: ` : "";
        if (!found) return <p key={spot} className={styles.hold}>{label}No move</p>;
        const { leg, index } = found, playerId = playerFor(index);
        if (leg.startDate !== date) return <p key={spot} className={styles.hold}>{label}HOLD {describe(playerId)} · {gameDates(index).includes(date) ? "plays" : "no game"}</p>;
        const prior = chain.legs.slice(0, index).filter(item => item.spot === spot).at(-1), drop = prior ? playerFor(chain.legs.indexOf(prior)) : leg.dropPlayerId;
        const step = cumulative.get(index)!;
        return <div key={spot} className={styles.add}>
          <p><span className={styles.verb}>{label}ADD</span> {describe(playerId)} · DROP {describe(drop)}{leg.actionDate !== leg.startDate ? ` · claim ${dateLabel(leg.actionDate)}` : ""}{optionFor(index)?.waiverClearsOn ? ` · waiver claim, clears ${dateLabel(optionFor(index)!.waiverClearsOn!)}` : ""}</p>
          <small>{step.adds}/{chain.addsAvailable} adds · {signed(step.games)} AGP · {number(optionFor(index)?.points ?? leg.points)} proj FPts over {legGames(index)} game{legGames(index) === 1 ? "" : "s"}{optionFor(index)?.waiverClearsOn ? " · the claim may fail" : leg.step.conditional ? " · recheck availability" : ""}</small>
          {leg.options.length > 1 && <ol className={styles.options} aria-label={`Options for ${dateLabel(leg.startDate)}`}>{leg.options.map(option =>
            <li key={option.playerId}><button aria-pressed={option.playerId === playerId} onClick={() => update({ overrides: { ...state.overrides, [index]: option.playerId } })}>
              <span>{describe(option.playerId)}</span>
              <small>{option.waiverClearsOn ? "Waivers · " : ""}{option.games} GP · {number(option.points)} proj FPts{option.recentPointsPerGame !== null ? ` · ${number(option.recentPointsPerGame)} FPts/G (last ${option.recentGames ?? 10})` : ""}</small>
            </button></li>)}</ol>}
        </div>;
      })}</div>
    </li>)}</ol>
    {selectDisabled && <p className={styles.gate}><small id="rso-streaming-reason">{selectDisabled}</small>{confirm}</p>}
    <button className={styles.use} disabled={Boolean(selectDisabled)} aria-describedby={selectDisabled ? "rso-streaming-reason" : undefined}
      onClick={() => onSelect(streamingChainSteps(chain, state.overrides))}>Use this streaming plan</button>
    <p className={styles.note}>Ranked by the average of projected fantasy points and fantasy points per game over the last 10 played games (the projection alone when there is no last 10), over the games each player would start.</p>
  </>);
}
