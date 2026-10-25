import type { GameForecastPoints } from "lib/rosterScheduleOptimizer/planning";
import styles from "./SlotWeekGrid.module.scss";

type Props = { points: GameForecastPoints; goalie: boolean; tier?: "high" | "mid" | "low" };
const formatted = (value: number | null) => typeof value === "number" && Number.isFinite(value) ? value.toFixed(1) : "—";

export default function ForecastPoints({ points, goalie, tier }: Props) {
  const expected = formatted(points.expected);
  const ifStarts = formatted(points.ifStarts);
  return <span className={styles.forecastPoints} data-goalie={goalie ? "" : undefined}>
    <span className={styles.points} data-tier={expected === "—" ? undefined : tier}
      title={expected === "—" ? "Expected fantasy points unavailable: an applicable weighted stat or its approved use is missing."
        : goalie ? "Expected fantasy points for this game, including participation probability."
          : "Projected fantasy points for this game, using your league's scoring."}
      aria-label={`Expected fantasy points: ${expected === "—" ? "unavailable" : expected}`}>
      {expected}{goalie && <small> expected</small>}
    </span>
    {goalie && <span className={styles.conditionalPoints}
      title={ifStarts === "—" ? "Fantasy points if starts unavailable: complete approved per-start estimates are required."
        : "Fantasy points conditional on starting. Assumes a start; not a second expected contribution to add."}
      aria-label={`Fantasy points if starts: ${ifStarts === "—" ? "unavailable" : ifStarts}`}>
      {ifStarts}<small> if starts</small>
    </span>}
  </span>;
}
