import Head from "next/head";
import Link from "next/link";
import { useEffect, useMemo, useState } from "react";

import UnderlyingStatsNavBar from "components/underlying-stats/UnderlyingStatsNavBar";
import type {
  XgExplorerError,
  XgExplorerGoalieRow,
  XgExplorerPlayerRow,
  XgExplorerResponse,
  XgExplorerScope,
  XgExplorerTeamRow,
} from "lib/underlying-stats/xgExplorer";
import styles from "./xg.module.scss";

type LoadState = "idle" | "loading" | "ready" | "error";

const SCOPE_LABELS: Record<XgExplorerScope, string> = {
  players: "Players",
  teams: "Teams",
  goalies: "Goalies",
};

function formatNumber(value: number | null | undefined, digits = 2): string {
  if (value == null || !Number.isFinite(value)) return "-";
  return value.toFixed(digits);
}

function formatInteger(value: number | null | undefined): string {
  if (value == null || !Number.isFinite(value)) return "-";
  return String(Math.round(value));
}

function formatPercent(value: number | null | undefined): string {
  if (value == null || !Number.isFinite(value)) return "-";
  return `${(value * 100).toFixed(1)}%`;
}

function buildXgRequestPath(args: {
  scope: XgExplorerScope;
  seasonId: string;
  windowGames: string;
  limit: string;
  modelVersion: string;
  reboundModelVersion: string;
}): string {
  const params = new URLSearchParams({
    scope: args.scope,
    windowGames: args.windowGames,
    limit: args.limit,
  });
  if (args.seasonId.trim()) params.set("seasonId", args.seasonId.trim());
  if (args.modelVersion.trim()) params.set("modelVersion", args.modelVersion.trim());
  if (args.reboundModelVersion.trim()) {
    params.set("reboundModelVersion", args.reboundModelVersion.trim());
  }
  return `/api/v1/underlying-stats/xg?${params.toString()}`;
}

async function fetchXgExplorer(
  path: string,
  signal: AbortSignal
): Promise<XgExplorerResponse> {
  const response = await fetch(path, { signal });
  const payload = (await response.json()) as XgExplorerResponse | XgExplorerError;

  if (!response.ok || !("success" in payload)) {
    const errorPayload = payload as XgExplorerError;
    const issue = Array.isArray(errorPayload.issues) ? errorPayload.issues[0] : null;
    throw new Error(issue ?? errorPayload.error ?? "Unable to load xG lab data.");
  }

  return payload;
}

function PlayerTable({ rows }: { rows: XgExplorerPlayerRow[] }) {
  return (
    <table className={styles.table}>
      <thead>
        <tr>
          <th>Player</th>
          <th>Team</th>
          <th>Pos</th>
          <th>GP</th>
          <th>ixG</th>
          <th>G</th>
          <th>Shots</th>
          <th>Created xG</th>
          <th>Shot-Assist xG</th>
          <th>xPrimary A</th>
          <th>SA Events</th>
          <th>Entries</th>
          <th>Exits</th>
          <th>Entry A</th>
          <th>Trans Shots</th>
          <th>Trans xG</th>
          <th>xReb Created</th>
          <th>Reb Created</th>
        </tr>
      </thead>
      <tbody>
        {rows.map((row) => (
          <tr key={row.id}>
            <td className={styles.entityName}>{row.name}</td>
            <td>{row.teamAbbreviation ?? "-"}</td>
            <td>{row.position ?? "-"}</td>
            <td>{formatInteger(row.gamesCount)}</td>
            <td>{formatNumber(row.ixg)}</td>
            <td>{formatInteger(row.goals)}</td>
            <td>{formatInteger(row.shotAttempts)}</td>
            <td>{formatNumber(row.createdXg)}</td>
            <td>{formatNumber(row.shotAssistCreatedXg)}</td>
            <td>{formatNumber(row.expectedPrimaryAssists)}</td>
            <td>{formatInteger(row.shotAssistEvents)}</td>
            <td>{formatInteger(row.controlledEntries)}</td>
            <td>{formatInteger(row.controlledExits)}</td>
            <td>{formatInteger(row.entryAssists)}</td>
            <td>{formatInteger(row.transitionCreatedShots)}</td>
            <td>{formatNumber(row.transitionCreatedXg)}</td>
            <td>{formatNumber(row.expectedReboundsCreated)}</td>
            <td>{formatInteger(row.actualReboundsCreated)}</td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}

function TeamTable({ rows }: { rows: XgExplorerTeamRow[] }) {
  return (
    <table className={styles.table}>
      <thead>
        <tr>
          <th>Team</th>
          <th>GP</th>
          <th>xGF</th>
          <th>xGA</th>
          <th>xG%</th>
          <th>GF</th>
          <th>GA</th>
          <th>Entries</th>
          <th>Exits</th>
          <th>Failed Exits Against</th>
          <th>Trans xG</th>
          <th>xReb For</th>
          <th>xReb Against</th>
        </tr>
      </thead>
      <tbody>
        {rows.map((row) => (
          <tr key={row.id}>
            <td className={styles.entityName}>{row.abbreviation ?? row.name}</td>
            <td>{formatInteger(row.gamesCount)}</td>
            <td>{formatNumber(row.xgFor)}</td>
            <td>{formatNumber(row.xgAgainst)}</td>
            <td>{formatPercent(row.xgPct)}</td>
            <td>{formatInteger(row.goalsFor)}</td>
            <td>{formatInteger(row.goalsAgainst)}</td>
            <td>{formatInteger(row.controlledEntries)}</td>
            <td>{formatInteger(row.controlledExits)}</td>
            <td>{formatInteger(row.failedExitsAgainst)}</td>
            <td>{formatNumber(row.transitionCreatedXg)}</td>
            <td>{formatNumber(row.expectedReboundsFor)}</td>
            <td>{formatNumber(row.expectedReboundsAgainst)}</td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}

function GoalieTable({ rows }: { rows: XgExplorerGoalieRow[] }) {
  return (
    <table className={styles.table}>
      <thead>
        <tr>
          <th>Goalie</th>
          <th>Team</th>
          <th>GP</th>
          <th>xGA</th>
          <th>GA</th>
          <th>GSAx</th>
          <th>SA</th>
          <th>xReb Allowed</th>
          <th>Reb Allowed</th>
          <th>Reb Saved</th>
          <th>Freezes</th>
          <th>Covered</th>
        </tr>
      </thead>
      <tbody>
        {rows.map((row) => (
          <tr key={row.id}>
            <td className={styles.entityName}>{row.name}</td>
            <td>{row.teamAbbreviation ?? "-"}</td>
            <td>{formatInteger(row.gamesCount)}</td>
            <td>{formatNumber(row.xgAgainst)}</td>
            <td>{formatInteger(row.goalsAgainst)}</td>
            <td>{formatNumber(row.goalsSavedAboveExpected)}</td>
            <td>{formatInteger(row.shotsAgainst)}</td>
            <td>{formatNumber(row.expectedReboundsAllowed)}</td>
            <td>{formatInteger(row.actualReboundsAllowed)}</td>
            <td>{formatNumber(row.reboundControlSavedAboveExpected)}</td>
            <td>{formatInteger(row.goalieFreezes)}</td>
            <td>{formatInteger(row.coveredPucks)}</td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}

export default function XgUnderlyingStatsLabRoute() {
  const [scope, setScope] = useState<XgExplorerScope>("players");
  const [seasonId, setSeasonId] = useState("20252026");
  const [windowGames, setWindowGames] = useState("10");
  const [limit, setLimit] = useState("50");
  const [modelVersion, setModelVersion] = useState("");
  const [reboundModelVersion, setReboundModelVersion] = useState("");
  const [refreshKey, setRefreshKey] = useState(0);
  const [data, setData] = useState<XgExplorerResponse | null>(null);
  const [status, setStatus] = useState<LoadState>("idle");
  const [error, setError] = useState<string | null>(null);

  const requestPath = useMemo(
    () =>
      buildXgRequestPath({
        scope,
        seasonId,
        windowGames,
        limit,
        modelVersion,
        reboundModelVersion,
      }),
    [limit, modelVersion, reboundModelVersion, scope, seasonId, windowGames]
  );

  useEffect(() => {
    const controller = new AbortController();
    setStatus("loading");
    setError(null);

    fetchXgExplorer(requestPath, controller.signal)
      .then((payload) => {
        setData(payload);
        setStatus("ready");
      })
      .catch((loadError) => {
        if (controller.signal.aborted) return;
        setStatus("error");
        setData(null);
        setError(loadError instanceof Error ? loadError.message : "Unable to load xG lab data.");
      });

    return () => controller.abort();
  }, [requestPath, refreshKey]);

  const activeRows = data?.rows ?? [];

  return (
    <>
      <Head>
        <title>xG Model Lab | Underlying Stats</title>
      </Head>
      <main className={styles.page}>
        <div className={styles.pageInner}>
          <div className={styles.toolbar}>
            <UnderlyingStatsNavBar />
            <div className={styles.toolbarActions}>
              <Link href="/underlying-stats/xg/operations" className={styles.refreshButton}>Operations</Link>
              <button
                type="button"
                className={styles.refreshButton}
                onClick={() => setRefreshKey((current) => current + 1)}
              >
                Refresh
              </button>
            </div>
          </div>

          <section className={styles.header}>
            <div className={styles.headerText}>
              <p className={styles.eyebrow}>Underlying Stats</p>
              <h1 className={styles.title}>xG Model Lab</h1>
              <p className={styles.description}>
                Isolated read-only surface for in-house shot xG, created xG,
                transition proxies, and rebound-control aggregates before those
                outputs are promoted into the production player, goalie, and
                team pages.
              </p>
            </div>

            <div className={styles.controls}>
              <div className={styles.controlGroup}>
                <span className={styles.label}>Entity</span>
                <div className={styles.scopeTabs}>
                  {(["players", "teams", "goalies"] as const).map((nextScope) => (
                    <button
                      key={nextScope}
                      type="button"
                      className={styles.scopeButton}
                      data-active={scope === nextScope}
                      onClick={() => setScope(nextScope)}
                    >
                      {SCOPE_LABELS[nextScope]}
                    </button>
                  ))}
                </div>
              </div>
              <label className={styles.controlGroup}>
                <span className={styles.label}>Season</span>
                <input
                  className={styles.input}
                  value={seasonId}
                  onChange={(event) => setSeasonId(event.target.value)}
                  inputMode="numeric"
                />
              </label>
              <label className={styles.controlGroup}>
                <span className={styles.label}>Window</span>
                <select
                  className={styles.select}
                  value={windowGames}
                  onChange={(event) => setWindowGames(event.target.value)}
                >
                  <option value="5">5 games</option>
                  <option value="10">10 games</option>
                  <option value="20">20 games</option>
                </select>
              </label>
              <label className={styles.controlGroup}>
                <span className={styles.label}>Limit</span>
                <input
                  className={styles.input}
                  value={limit}
                  onChange={(event) => setLimit(event.target.value)}
                  inputMode="numeric"
                />
              </label>
            </div>

            <div className={styles.controls}>
              <label className={styles.controlGroup}>
                <span className={styles.label}>Shot xG model version</span>
                <input
                  className={styles.input}
                  value={modelVersion}
                  onChange={(event) => setModelVersion(event.target.value)}
                  placeholder="latest available"
                />
              </label>
              <label className={styles.controlGroup}>
                <span className={styles.label}>Rebound model version</span>
                <input
                  className={styles.input}
                  value={reboundModelVersion}
                  onChange={(event) => setReboundModelVersion(event.target.value)}
                  placeholder="latest available"
                />
              </label>
            </div>

            <div className={styles.metaGrid}>
              <div className={styles.metaItem}>
                <p className={styles.metaLabel}>Rows</p>
                <p className={styles.metaValue}>{data?.counts.rows ?? 0}</p>
              </div>
              <div className={styles.metaItem}>
                <p className={styles.metaLabel}>Source Rows</p>
                <p className={styles.metaValue}>{data?.counts.sourceRows ?? 0}</p>
              </div>
              <div className={styles.metaItem}>
                <p className={styles.metaLabel}>Supplemental</p>
                <p className={styles.metaValue}>{data?.counts.supplementalRows ?? 0}</p>
              </div>
              <div className={styles.metaItem}>
                <p className={styles.metaLabel}>Shot Model</p>
                <p className={styles.metaValue}>{data?.modelVersion ?? "-"}</p>
              </div>
              <div className={styles.metaItem}>
                <p className={styles.metaLabel}>Rebound Model</p>
                <p className={styles.metaValue}>{data?.reboundModelVersion ?? "-"}</p>
              </div>
              <div className={styles.metaItem}>
                <p className={styles.metaLabel}>Coverage</p>
                <p className={styles.metaValue}>{data?.coverage.status ?? "-"}</p>
              </div>
            </div>
          </section>

          <section className={styles.panel}>
            <div className={styles.panelHeader}>
              <h2 className={styles.panelTitle}>{SCOPE_LABELS[scope]} xG Outputs</h2>
              <p className={styles.statusText}>
                {status === "loading"
                  ? "Loading"
                  : data?.generatedAt
                    ? `Generated ${new Date(data.generatedAt).toLocaleString()}`
                    : "Waiting for model output"}
              </p>
            </div>

            {status === "error" ? (
              <div className={styles.errorBox}>{error}</div>
            ) : activeRows.length === 0 && status !== "loading" ? (
              <div className={styles.emptyBox}>
                No rows returned for this scope, season, window, and model version.
              </div>
            ) : (
              <div className={styles.tableWrap}>
                {scope === "players" && (
                  <PlayerTable rows={activeRows as XgExplorerPlayerRow[]} />
                )}
                {scope === "teams" && (
                  <TeamTable rows={activeRows as XgExplorerTeamRow[]} />
                )}
                {scope === "goalies" && (
                  <GoalieTable rows={activeRows as XgExplorerGoalieRow[]} />
                )}
              </div>
            )}

            {data?.coverage.status === "warning" ? (
              <div className={styles.coverageBox}>
                {data.coverage.warnings.map((warning) => (
                  <p key={warning}>{warning}</p>
                ))}
              </div>
            ) : null}

            {data?.notes?.length ? (
              <ul className={styles.notes}>
                {data.notes.map((note) => (
                  <li key={note}>{note}</li>
                ))}
              </ul>
            ) : null}
          </section>
        </div>
      </main>
    </>
  );
}
