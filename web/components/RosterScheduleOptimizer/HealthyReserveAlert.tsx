import type { HealthyReserve } from "lib/rosterScheduleOptimizer/healthyReserves";
import styles from "./HealthyReserveAlert.module.scss";

const signed = (value: number) => `${value > 0 ? "+" : ""}${Number.isInteger(value) ? value : value.toFixed(1)}`;

/** The planner's gain from activating him, or why there is none to show. */
function gainText({ projectedPoints, activeGames }: NonNullable<HealthyReserve["activation"]>) {
  // Both null only when a lineup fails the rule check; unknown points with no added games may still gain points.
  if (projectedPoints === null && activeGames === null) return { known: false, text: "Gain unknown until the lineup passes the rule check" };
  if (projectedPoints === null && (activeGames ?? 0) <= 0) return { known: false, text: "No added active games this week" };
  if ((projectedPoints ?? 0) <= 0 && (activeGames ?? 0) <= 0) return { known: false, text: "No projected gain this week" };
  const parts = [...(projectedPoints !== null ? [`${signed(projectedPoints)} projected pts`] : []),
    ...(activeGames !== null ? [`${signed(activeGames)} active game${Math.abs(activeGames) === 1 ? "" : "s"}`] : [])];
  return { known: true, text: `${parts.join(" · ")} this week` };
}

/** "Only k can be activated" when the open spots and swap partners run out before the flagged players do; the helper
 * already ranks them by projected gain, unknown gains last, ties in roster order. */
function contestText(reserves: HealthyReserve[], nameOf: (id: string) => string) {
  const activated = reserves.filter(reserve => reserve.activation);
  if (!activated.length || activated.length === reserves.length) return null;
  const best = activated.map(({ playerId, activation }) => `${nameOf(playerId)}${activation!.projectedPoints !== null ? ` (${signed(activation!.projectedPoints)} pts)`
    : activation!.activeGames !== null ? ` (${signed(activation!.activeGames)} active games)` : ""}`);
  const list = best.length === 1 ? best[0] : `${best.slice(0, -1).join(", ")} and ${best[best.length - 1]}`;
  // An unknown gain can't be called "best" (C7 H3).
  if (activated.some(({ activation }) => activation!.projectedPoints === null && activation!.activeGames === null)) return `Can be activated: ${list}.`;
  return `Only ${best.length === 1 ? "one" : best.length} can be activated: best ${best.length === 1 ? "is" : "are"} ${list}.`;
}

/** Healthy players still in IR/IR+ (Yahoo lists no injury), with the gain from activating each, then a soft note for
 * each DTD player in IR+ whose team plays today. */
export default function HealthyReserveAlert({ reserves, dtd = [], nameOf, onSelect }: {
  reserves: HealthyReserve[]; dtd?: string[]; nameOf: (id: string) => string; onSelect?: (playerId: string) => void;
}) {
  if (!reserves.length && !dtd.length) return null;
  const contest = contestText(reserves, nameOf);
  return <>{reserves.length > 0 && <section className={styles.alert} role="alert" aria-label="Healthy players in IR">
    <h3>{reserves.length === 1 ? "Healthy player in IR" : `${reserves.length} healthy players in IR`}</h3>
    {contest && <p className={styles.action}>{contest}</p>}
    <ul>{reserves.map(reserve => {
      const name = nameOf(reserve.playerId), activation = reserve.activation, gain = activation && gainText(activation);
      return <li key={reserve.playerId}>
        <p>{onSelect ? <button className={styles.name} onClick={() => onSelect(reserve.playerId)}>{name}</button> : <strong className={styles.name}>{name}</strong>} is
          in your {reserve.position} spot, but Yahoo lists no injury.{!reserve.slotEligible && <> Yahoo no longer lists him for {reserve.position}, so the
          lineup is illegal until he moves.</>}</p>
        <p className={styles.action}>{!activation ? "No roster spot is open: drop a player or move an injured one to IR to activate him."
          : activation.swapPlayerId ? <>Swap him with {nameOf(activation.swapPlayerId)} (Yahoo lists {nameOf(activation.swapPlayerId)} for {reserve.position}).</>
            : "Move him to an open bench or active spot."}
          {gain && <> <b className={styles.gain} data-known={gain.known}>{gain.text}</b></>}</p>
      </li>;
    })}</ul>
  </section>}
    {dtd.map(id => <p key={id} className={styles.action} role="note">{nameOf(id)}: DTD in IR+ — may play; consider activating if you have a spot.</p>)}
  </>;
}
