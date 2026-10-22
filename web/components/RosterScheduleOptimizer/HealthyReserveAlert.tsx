import type { HealthyReserve } from "lib/rosterScheduleOptimizer/healthyReserves";
import styles from "./HealthyReserveAlert.module.scss";

const signed = (value: number) => `${value > 0 ? "+" : ""}${Number.isInteger(value) ? value : value.toFixed(1)}`;

/** The planner's gain from activating him, or why there is none to show. */
function gainText({ projectedPoints, activeGames }: NonNullable<HealthyReserve["activation"]>) {
  if (projectedPoints === null && activeGames === null) return { known: false, text: "Gain unknown until projections cover the lineup" };
  if ((projectedPoints ?? 0) <= 0 && (activeGames ?? 0) <= 0) return { known: false, text: "No projected gain this week" };
  const parts = [...(projectedPoints !== null ? [`${signed(projectedPoints)} projected pts`] : []),
    ...(activeGames !== null ? [`${signed(activeGames)} active game${Math.abs(activeGames) === 1 ? "" : "s"}`] : [])];
  return { known: true, text: `${parts.join(" · ")} this week` };
}

/** Healthy players still in IR/IR+ (Yahoo lists no injury), with the gain from activating each. */
export default function HealthyReserveAlert({ reserves, nameOf, onSelect }: {
  reserves: HealthyReserve[]; nameOf: (id: string) => string; onSelect?: (playerId: string) => void;
}) {
  if (!reserves.length) return null;
  return <section className={styles.alert} role="alert" aria-label="Healthy players in IR">
    <h3>{reserves.length === 1 ? "Healthy player in IR" : `${reserves.length} healthy players in IR`}</h3>
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
  </section>;
}
