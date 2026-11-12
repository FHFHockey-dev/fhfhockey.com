import { useMemo, useState } from "react";

import type { ProcessedPlayer } from "hooks/useProcessedProjectionsData";
import {
  calculateSourceAccuracy,
  type SourceAccuracyMode
} from "lib/draftDashboard/sourceAccuracy";
import styles from "./ProjectionSourceAccuracy.module.scss";

const formatError = (value: number | null) => {
  if (value == null) return "—";
  return value === 0 ? "0" : value.toPrecision(3);
};

export default function ProjectionSourceAccuracy({
  players
}: {
  players: ProcessedPlayer[];
}) {
  const [mode, setMode] = useState<SourceAccuracyMode>("perGame");
  const rows = useMemo(() => calculateSourceAccuracy(players, mode), [mode, players]);
  const hasComparisons = rows.some((row) => row.comparedPlayers > 0);

  return (
    <section className={styles.panel} aria-labelledby="source-accuracy-title">
      <div className={styles.header}>
        <div>
          <h2 id="source-accuracy-title">Projection Source Accuracy</h2>
          <p>
            Retrospective analysis only. These results never modify your manual
            source weights or draft-time projections. They compare the currently
            loaded source values and actuals; no preseason-vintage claim is made.
          </p>
        </div>
        <div className={styles.toggle} role="group" aria-label="Accuracy basis">
          <button
            type="button"
            aria-pressed={mode === "perGame"}
            onClick={() => setMode("perGame")}
          >
            Per Game
          </button>
          <button
            type="button"
            aria-pressed={mode === "proratedTotal"}
            onClick={() => setMode("proratedTotal")}
          >
            Pro-rated total
          </button>
        </div>
      </div>
      <p className={styles.definition}>
        {mode === "perGame"
          ? "Per game: each source's counting stats divided by its projected GP, against actuals divided by actual GP. Rate stats compare directly. Games played (workload) is not scored."
          : "Pro-rated total: each source's counting stats pro-rated to actual games played, against season-to-date totals. Rate stats compare directly. Games played (workload) is not scored."}
      </p>
      {!hasComparisons ? (
        <div className={styles.empty} role="status">
          No source/actual comparisons are available yet.
        </div>
      ) : (
        <div className={styles.tableWrap}>
          <table>
            <caption>
              Mean squared error per stat, in that stat&apos;s own units (lower is
              better). Within a stat every source is scored on the same players:
              those all its sources projected. Players a source did not project
              are counted as unmatched, not scored. Stats are not combined.
            </caption>
            <thead>
              <tr>
                <th scope="col">Stat</th>
                <th scope="col">Source</th>
                <th scope="col">Rank</th>
                <th scope="col">Mean sq. error</th>
                <th scope="col">Compared</th>
                <th scope="col">Unmatched</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((row) => (
                <tr key={`${row.statKey}:${row.sourceName}`}>
                  <th scope="row">{row.statLabel}</th>
                  <td>{row.sourceName}</td>
                  <td>{row.rank ?? "—"}</td>
                  <td>{formatError(row.meanSquaredError)}</td>
                  <td>
                    {row.comparedPlayers}/{row.universePlayers}
                  </td>
                  <td>{row.unmatchedPlayers}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </section>
  );
}
