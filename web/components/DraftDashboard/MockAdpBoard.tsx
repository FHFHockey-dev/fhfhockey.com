import { useEffect, useState } from "react";
import { leagueOf, stableJson, type MockLeague } from "lib/mockDraft/contracts";
import styles from "./MockDraftWorkspace.module.scss";

type Row = {
  playerId: string;
  name: string;
  position: string;
  adp: number | null;
  median: number | null;
  low: number | null;
  high: number | null;
  selections: number;
  contributors: number;
  lastObserved: string;
};
type Cohort = { key: string; league: MockLeague };
export default function MockAdpBoard({ league }: { league: MockLeague }) {
  const [season, setSeason] = useState(league.season),
    [cohort, setCohort] = useState(stableJson(leagueOf(league))),
    [tier, setTier] = useState("all"),
    [completed, setCompleted] = useState(false),
    [search, setSearch] = useState(""),
    [position, setPosition] = useState(""),
    [page, setPage] = useState(1);
  const [data, setData] = useState<{
      rows: Row[];
      cohorts: Cohort[];
      total: number;
    } | null>(null),
    [error, setError] = useState<string | null>(null);
  const selectedLeague = (() => {
    try {
      return JSON.parse(cohort) as MockLeague;
    } catch {
      return league;
    }
  })();
  useEffect(() => {
    const controller = new AbortController();
    setData(null);
    setError(null);
    const query = new URLSearchParams({
      season,
      cohort,
      tier,
      completed: String(completed),
      search,
      position,
      page: String(page),
    });
    const timer = setTimeout(() => {
      void fetch(`/api/v1/mock-draft/adp?${query}`, {
        signal: controller.signal,
      })
        .then(async (r) => {
          const body = await r.json();
          if (!r.ok) throw new Error(body.error?.message ?? "ADP unavailable.");
          return body.data;
        })
        .then(setData)
        .catch((e) => {
          if (e.name !== "AbortError") setError(e.message);
        });
    }, 200);
    return () => {
      clearTimeout(timer);
      controller.abort();
    };
  }, [season, cohort, tier, completed, search, position, page]);
  return (
    <section aria-label="Human Mock ADP">
      <h2>Human Mock ADP · Provisional</h2>
      <p>
        Explicit human selections from the last 30 days. Bots influence who
        remains available. Each contributor has equal weight; these are not
        real-league ADP or Community Rankings.
      </p>
      <div className={styles.controls}>
        <label>
          Season{" "}
          <input
            value={season}
            onChange={(e) => {
              setSeason(e.target.value);
              setPage(1);
            }}
          />
        </label>
        <label>
          Configuration{" "}
          <select
            value={cohort}
            onChange={(e) => {
              setCohort(e.target.value);
              setPage(1);
            }}
          >
            <option value={stableJson(leagueOf(league))}>
              Current league · {league.teamCount} teams · {league.leagueType}
            </option>
            {data?.cohorts
              .filter((c) => c.key !== stableJson(leagueOf(league)))
              .map((c, i) => (
                <option key={c.key} value={c.key}>
                  {c.league.teamCount} teams · {c.league.leagueType} ·
                  configuration {i + 1}
                </option>
              ))}
          </select>
        </label>
        <label>
          Engine{" "}
          <select
            value={tier}
            onChange={(e) => {
              setTier(e.target.value);
              setPage(1);
            }}
          >
            <option value="all">All</option>
            <option value="free">Free</option>
            <option value="pro">Pro</option>
          </select>
        </label>
        <label>
          <input
            type="checkbox"
            checked={completed}
            onChange={(e) => {
              setCompleted(e.target.checked);
              setPage(1);
            }}
          />
          Completed mocks only
        </label>
        <label>
          Find player{" "}
          <input
            value={search}
            onChange={(e) => {
              setSearch(e.target.value);
              setPage(1);
            }}
          />
        </label>
        <label>
          Position{" "}
          <select
            value={position}
            onChange={(e) => {
              setPosition(e.target.value);
              setPage(1);
            }}
          >
            {["", "C", "LW", "RW", "D", "G"].map((p) => (
              <option key={p} value={p}>
                {p || "All"}
              </option>
            ))}
          </select>
        </label>
      </div>
      <details>
        <summary>Selected league settings</summary>
        <p>
          {selectedLeague.teamCount} teams · {selectedLeague.leagueType} ·{" "}
          {Object.entries(selectedLeague.roster)
            .filter(([, n]) => n > 0)
            .map(([slot, n]) => `${n} ${slot}`)
            .join(" · ")}
        </p>
        <p>
          Scoring:{" "}
          {Object.entries(selectedLeague.scoring)
            .filter(([, weight]) => weight !== 0)
            .map(
              ([stat, weight]) =>
                `${stat.replaceAll("_", " ").toLowerCase()}: ${weight}`,
            )
            .join(" · ") || "Default categories"}
        </p>
        {selectedLeague.leagueType === "points" && (
          <p>
            Goalie scoring:{" "}
            {Object.entries(selectedLeague.goalieScoring)
              .filter(([, weight]) => weight !== 0)
              .map(
                ([stat, weight]) =>
                  `${stat.replaceAll("_", " ").toLowerCase()}: ${weight}`,
              )
              .join(" · ")}
          </p>
        )}
      </details>
      {error ? (
        <p role="alert">{error}</p>
      ) : !data ? (
        <p role="status">Loading ADP…</p>
      ) : (
        <>
          <div className={styles.scroll}>
            <table className={styles.table}>
              <thead>
                <tr>
                  {[
                    "Player",
                    "ADP",
                    "Median",
                    "25–75% range",
                    "Selections",
                    "Contributors",
                    "Last observed",
                  ].map((h) => (
                    <th key={h}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {data.rows.map((r) => (
                  <tr key={r.playerId}>
                    <td>
                      {r.name} · {r.position}
                    </td>
                    <td>{r.adp?.toFixed(1) ?? "Insufficient sample"}</td>
                    <td>{r.median?.toFixed(1) ?? "—"}</td>
                    <td>{r.low === null ? "—" : `${r.low}–${r.high}`}</td>
                    <td>{r.selections}</td>
                    <td>{r.contributors}</td>
                    <td>{new Date(r.lastObserved).toLocaleDateString()}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          {!data.rows.length && (
            <p>
              No observations for this configuration yet. Try an available
              configuration or contribute a mock.
            </p>
          )}
          <p>
            Numerical results require five distinct contributors. Withdrawals
            appear within one minute.
          </p>
          <div className={styles.controls}>
            <button disabled={page === 1} onClick={() => setPage((p) => p - 1)}>
              Previous
            </button>
            <span>Page {page}</span>
            <button
              disabled={page * 50 >= data.total}
              onClick={() => setPage((p) => p + 1)}
            >
              Next
            </button>
          </div>
        </>
      )}
    </section>
  );
}
