import { useMemo } from "react";
import { selectMainDeploymentUnits, type MatrixStrength, type ObservedDeploymentUnit } from "lib/drm/observedDeployment";
import type { AggregatedMatrixPlayers } from "./fetchAggregatedData";
import styles from "./drm.module.scss";

export function sharedClock(seconds: number) {
  return `${Math.floor(seconds / 60)}:${String(seconds % 60).padStart(2, "0")}`;
}

export default function ObservedUnits({ units, strength, players, seasonType }: {
  units: ObservedDeploymentUnit[];
  strength: MatrixStrength;
  players: AggregatedMatrixPlayers;
  seasonType: "regularSeason" | "playoffs";
}) {
  const selected = useMemo(() => selectMainDeploymentUnits(units.filter(unit =>
    strength === "all" ? unit.strength === "fiveOnFive" || unit.strength === "pp" : unit.strength === strength)), [units, strength]);
  const groups = [
    { kind: "forward_line", count: 5, label: "5-on-5 forward lines" },
    { kind: "defense_pair", count: 5, label: "5-on-5 defense pairs" },
    { kind: "power_play", count: 5, label: "Power play · 5 skaters" },
    { kind: "power_play", count: 4, label: "Power play · 4 skaters" },
    { kind: "penalty_kill", count: 4, label: "Penalty kill · 4 skaters" },
    { kind: "penalty_kill", count: 3, label: "Penalty kill · 3 skaters" },
  ];
  // The bar scales each unit's time together to the longest unit in its group.
  const renderUnit = (unit: ObservedDeploymentUnit, maxSeconds: number) => <li key={unit.playerIds.join("-")}
    style={{ ["--unit-share" as string]: maxSeconds > 0 ? unit.seconds / maxSeconds : 0 }}>
    <span className={styles.unitPlayers}>{unit.playerIds.map(id => players[id]?.playerName ?? `Player ${id}`).join(" · ")}</span>
    <strong className={styles.unitTime}>{sharedClock(unit.seconds)} together</strong>
    <span className={styles.unitGames}>{unit.gameIds.length} game{unit.gameIds.length === 1 ? "" : "s"}</span>
    <span className={styles.unitBar} aria-hidden="true" />
  </li>;
  const gameCount = new Set(Object.values(players).flatMap(player => player[seasonType === "playoffs" ? "playoffData" : "regularSeasonData"].gameIds)).size;
  return <section aria-label="Observed combinations" className={styles.observedUnits}>
    <h2>Observed combinations</h2>
    <p>Ranked by minutes together in {gameCount} game{gameCount === 1 ? "" : "s"} with full shift data. Each player is listed once per main unit; other combinations are listed under Other combinations. Ranks show usage, not official line numbers or positions.</p>
    {selected.main.length === 0 && <p>No full units were found at this strength. Switch the layout to Full Roster to see each player’s time.</p>}
    {groups.map(group => {
      const matches = (unit: ObservedDeploymentUnit) => unit.kind === group.kind && unit.skaterCount === group.count;
      const main = selected.main.filter(matches), alternatives = selected.alternatives.filter(matches);
      if (!main.length && !alternatives.length) return null;
      const maxSeconds = Math.max(0, ...main.map(unit => unit.seconds), ...alternatives.map(unit => unit.seconds));
      return <section key={`${group.kind}-${group.count}`} data-kind={group.kind}>
        <h3>{group.label}</h3>
        <ol role="list">{main.map(unit => renderUnit(unit, maxSeconds))}</ol>
        {alternatives.length > 0 && <details><summary>Other combinations ({alternatives.length})</summary><ol role="list">{alternatives.map(unit => renderUnit(unit, maxSeconds))}</ol></details>}
      </section>;
    })}
    {(strength === "all" || strength === "fiveOnFive") && <p>The matrix uses ice time at the selected strength. Player-card stats cover all strengths in the same games.</p>}
  </section>;
}
