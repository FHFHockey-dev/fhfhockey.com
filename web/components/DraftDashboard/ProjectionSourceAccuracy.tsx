import { useMemo, useState } from "react";

import type { ProcessedPlayer } from "hooks/useProcessedProjectionsData";
import {
  calculateSourceAccuracy,
  type SourceAccuracyMode
} from "lib/draftDashboard/sourceAccuracy";
import styles from "./ProjectionSourceAccuracy.module.scss";

export default function ProjectionSourceAccuracy({
  players
}: {
  players: ProcessedPlayer[];
}) {
  const [mode, setMode] = useState<SourceAccuracyMode>("total");
  const rows = useMemo(() => calculateSourceAccuracy(players, mode), [mode, players]);

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
            aria-pressed={mode === "total"}
            onClick={() => setMode("total")}
          >
            Total
          </button>
          <button
            type="button"
            aria-pressed={mode === "perGame"}
            onClick={() => setMode("perGame")}
          >
            Per Game
          </button>
        </div>
      </div>
      <p className={styles.definition}>
        {mode === "total"
          ? "Total compares each source's season-total projection directly with observed totals."
          : "Per Game divides counting stats by that source's projected GP and observed stats by actual GP; existing rate stats remain rates."}
      </p>
      {rows.length === 0 ? (
        <div className={styles.empty} role="status">
          No source/actual comparisons are available yet.
        </div>
      ) : (
        <div className={styles.tableWrap}>
          <table>
            <caption>
              Accuracy is 100 minus mean normalized absolute error; coverage is
              matched actual comparisons divided by source projections.
            </caption>
            <thead>
              <tr>
                <th scope="col">Source</th>
                <th scope="col">Accuracy</th>
                <th scope="col">Coverage</th>
                <th scope="col">Compared</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((row) => (
                <tr key={row.sourceName}>
                  <th scope="row">{row.sourceName}</th>
                  <td>
                    {row.accuracyScorePercent == null
                      ? "—"
                      : `${row.accuracyScorePercent.toFixed(1)}%`}
                  </td>
                  <td>{row.coveragePercent.toFixed(1)}%</td>
                  <td>
                    {row.matchedActualObservations}/{row.projectionObservations}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </section>
  );
}
