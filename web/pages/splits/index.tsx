import Head from "next/head";
import Image from "next/image";
import { useRouter } from "next/router";
import useSWR from "swr";
import SurfaceWorkflowLinks from "components/SurfaceWorkflowLinks";
import { SPLITS_SURFACE_LINKS } from "lib/navigation/siteSurfaceLinks";
import type { SplitsApiResponse } from "lib/splits/splitsSurface";

import styles from "./splits.module.scss";

const fetcher = async (url: string) => {
  const response = await fetch(url);
  const payload = await response.json();

  if (!response.ok) {
    const message =
      payload != null &&
      typeof payload === "object" &&
      typeof payload.error === "string"
        ? payload.error
        : "Unable to load splits.";
    throw new Error(message);
  }

  return payload as SplitsApiResponse;
};

function normalizeQueryValue(value: string | string[] | undefined): string | null {
  if (typeof value === "string" && value.trim().length > 0) {
    return value.trim();
  }

  if (Array.isArray(value) && typeof value[0] === "string") {
    return value[0].trim();
  }

  return null;
}

function formatRate(value: number | null | undefined, digits = 2) {
  if (value == null) {
    return "—";
  }

  return value.toFixed(digits);
}

function formatPercent(value: number | null | undefined, digits = 1) {
  if (value == null) {
    return "—";
  }

  return `${(value * 100).toFixed(digits)}%`;
}

function formatToi(value: number | null | undefined) {
  if (value == null || value < 0) {
    return "—";
  }

  const totalSeconds = Math.round(value);
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;
  return `${minutes}:${String(seconds).padStart(2, "0")}`;
}

export default function SplitsPage() {
  const router = useRouter();
  const team = normalizeQueryValue(router.query.team);
  const opponent = normalizeQueryValue(router.query.opponent);
  const showLanding = team == null;

  const updateQuery = (partial: Record<string, string | null>) => {
    const nextQuery = {
      ...router.query,
      ...partial,
    } as Record<string, string | string[] | undefined | null>;

    Object.keys(nextQuery).forEach((key) => {
      const value = nextQuery[key];
      if (value == null || value === "") {
        delete nextQuery[key];
      }
    });

    void router.replace(
      {
        pathname: router.pathname,
        query: nextQuery,
      },
      undefined,
      { shallow: true }
    );
  };

  const {
    data: landingData,
    error: landingError,
    isLoading: isLandingLoading,
  } = useSWR<SplitsApiResponse>("/api/v1/splits", fetcher);

  const rosterRequestPath = (() => {
    if (!team) {
      return null;
    }

    const query = new URLSearchParams({
      team,
      mode: "roster",
    });
    if (opponent) {
      query.set("opponent", opponent);
    }

    return `/api/v1/splits?${query.toString()}`;
  })();

  const {
    data: rosterData,
    error: rosterError,
    isLoading: isRosterLoading,
  } = useSWR<SplitsApiResponse>(rosterRequestPath, fetcher);

  const effectiveOpponent =
    rosterData?.selection.effectiveOpponentAbbreviation ?? opponent ?? null;

  const teamOptions = landingData?.teamOptions ?? rosterData?.teamOptions ?? [];

  return (
    <>
      <Head>
        <title>Splits | FHFHockey</title>
        <meta
          name="description"
          content="Roster-versus-opponent splits for skaters and goalies, plus top matchup leaders across the league."
        />
      </Head>

      <div className={styles.page}>
        <header className={styles.hero}>
          <div>
            <p className={styles.eyebrow}>Matchup Splits</p>
            <h1 className={styles.title}>Team Roster vs Opponent</h1>
            <p className={styles.description}>
              Audit the roster against one opponent at a time, then sort skaters by
              points per game and goalies by save percentage.
            </p>
          </div>
        </header>

        <SurfaceWorkflowLinks
          title="Related Surfaces"
          description="Move between related decision surfaces."
          links={SPLITS_SURFACE_LINKS}
        />

        <section className={styles.controls}>
          <label className={styles.control}>
            <span className={styles.controlLabel}>Team</span>
            <select
              className={styles.select}
              value={team ?? ""}
              onChange={(event) =>
                updateQuery({
                  team: event.target.value || null,
                  opponent: null,
                })
              }
            >
              <option value="">Select team</option>
              {teamOptions.map((option) => (
                <option key={option.abbreviation} value={option.abbreviation}>
                  {option.abbreviation} · {option.name}
                </option>
              ))}
            </select>
          </label>

          <label className={styles.control}>
            <span className={styles.controlLabel}>Opponent</span>
            <select
              className={styles.select}
              value={effectiveOpponent ?? ""}
              onChange={(event) =>
                updateQuery({
                  opponent: event.target.value || null,
                })
              }
              disabled={!team}
            >
              <option value="">Select opponent</option>
              {teamOptions
                .filter((option) => option.abbreviation !== team)
                .map((option) => (
                  <option key={option.abbreviation} value={option.abbreviation}>
                    {option.abbreviation} · {option.name}
                  </option>
                ))}
            </select>
          </label>
        </section>

        {isLandingLoading ? <div className={styles.status}>Loading landing splits...</div> : null}
        {landingError ? <div className={styles.error}>{landingError.message}</div> : null}
        {team && isRosterLoading ? <div className={styles.status}>Loading roster splits...</div> : null}
        {rosterError ? <div className={styles.error}>{rosterError.message}</div> : null}

        {landingData && showLanding ? (
          <>
            <section className={styles.section}>
              <div className={styles.sectionHeader}>
                <h2>Top Skaters vs Any Team</h2>
                <p>Highest current-season points per game against a specific opponent.</p>
              </div>

              <div className={styles.tableWrap}>
                <table className={styles.table}>
                  <thead>
                    <tr>
                      <th>Player</th>
                      <th>Team</th>
                      <th>Opponent</th>
                      <th>GP</th>
                      <th>G</th>
                      <th>A</th>
                      <th>P</th>
                      <th>P/GP</th>
                    </tr>
                  </thead>
                  <tbody>
                    {landingData.landing.topSkaters.map((row) => (
                      <tr key={`${row.playerId}-${row.opponentAbbreviation}`}>
                        <td>
                          {row.playerName}
                          {row.positionCode ? (
                            <span className={styles.inlineMeta}>{row.positionCode}</span>
                          ) : null}
                        </td>
                        <td>{row.teamAbbreviation}</td>
                        <td>{row.opponentAbbreviation}</td>
                        <td>{row.gamesPlayed}</td>
                        <td>{row.goals}</td>
                        <td>{row.assists}</td>
                        <td>{row.points}</td>
                        <td>{formatRate(row.pointsPerGame)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </section>

            <section className={styles.section}>
              <div className={styles.sectionHeader}>
                <h2>Top Goalies vs Any Team</h2>
                <p>Best current-season save percentages against a specific opponent.</p>
              </div>

              <div className={styles.tableWrap}>
                <table className={styles.table}>
                  <thead>
                    <tr>
                      <th>Goalie</th>
                      <th>Team</th>
                      <th>Opponent</th>
                      <th>GP</th>
                      <th>SA</th>
                      <th>GA</th>
                      <th>SV%</th>
                    </tr>
                  </thead>
                  <tbody>
                    {landingData.landing.topGoalies.map((row) => (
                      <tr key={`${row.playerId}-${row.opponentAbbreviation}`}>
                        <td>{row.playerName}</td>
                        <td>{row.teamAbbreviation}</td>
                        <td>{row.opponentAbbreviation}</td>
                        <td>{row.gamesPlayed}</td>
                        <td>{row.shotsAgainst}</td>
                        <td>{row.goalsAgainst}</td>
                        <td>{formatPercent(row.savePct, 2)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </section>

          </>
        ) : null}

        {team && rosterData?.roster ? (
          <section className={styles.section}>
            <div className={styles.sectionHeader}>
              <h2>
                {rosterData.selection.teamAbbreviation} vs {effectiveOpponent}
              </h2>
              <p>Roster splits stay fixed to one opponent at a time.</p>
            </div>

            <div className={styles.opponentTabs}>
              {teamOptions.map((option) => {
                const isSelectedTeam =
                  option.abbreviation === rosterData.selection.teamAbbreviation;
                const isActive = option.abbreviation === effectiveOpponent;

                return (
                  <button
                    key={option.abbreviation}
                    type="button"
                    className={[
                      styles.opponentTab,
                      isSelectedTeam ? styles.opponentTabDisabled : "",
                      isActive ? styles.opponentTabActive : "",
                    ]
                      .filter(Boolean)
                      .join(" ")}
                    disabled={isSelectedTeam}
                    onClick={() =>
                      updateQuery({
                        opponent: option.abbreviation,
                      })
                    }
                    aria-label={`Show ${rosterData.selection.teamAbbreviation} splits versus ${option.abbreviation}`}
                    title={option.name}
                  >
                    <Image
                      src={`/teamLogos/${option.abbreviation}.png`}
                      alt={option.abbreviation}
                      width={30}
                      height={30}
                    />
                  </button>
                );
              })}
            </div>

            <div className={styles.subsection}>
              <div className={styles.sectionHeader}>
                <h3>Skaters</h3>
              </div>

              <div className={styles.tableWrap}>
                <table className={styles.table}>
                  <thead>
                    <tr>
                      <th>Name</th>
                      <th>Position</th>
                      <th>Avg TOI</th>
                      <th>G</th>
                      <th>A</th>
                      <th>P</th>
                      <th>P/GP</th>
                      <th>SOG</th>
                      <th>Sh%</th>
                      <th>PP TOI</th>
                      <th>PP%</th>
                      <th>PP G</th>
                      <th>PP A</th>
                      <th>PP P</th>
                      <th>+/-</th>
                      <th>PIM</th>
                      <th>FO%</th>
                      <th>Hits</th>
                      <th>Blocks</th>
                    </tr>
                  </thead>
                  <tbody>
                    {rosterData.roster.skaters.map((row) => (
                      <tr key={row.playerId}>
                        <td>{row.playerName}</td>
                        <td>{row.positionCode ?? "—"}</td>
                        <td>{formatToi(row.averageToiSeconds)}</td>
                        <td>{row.goals}</td>
                        <td>{row.assists}</td>
                        <td>{row.points}</td>
                        <td>{formatRate(row.pointsPerGame)}</td>
                        <td>{row.shotsOnGoal}</td>
                        <td>{formatPercent(row.shootingPct, 2)}</td>
                        <td>{formatToi(row.powerPlayToiSecondsPerGame)}</td>
                        <td>{formatPercent(row.powerPlayPct, 1)}</td>
                        <td>{row.powerPlayGoals}</td>
                        <td>{row.powerPlayAssists}</td>
                        <td>{row.powerPlayPoints}</td>
                        <td>{row.plusMinus}</td>
                        <td>{row.pim}</td>
                        <td>{formatPercent(row.faceoffWinPct, 1)}</td>
                        <td>{row.hits}</td>
                        <td>{row.blocks}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>

            <div className={styles.subsection}>
              <div className={styles.sectionHeader}>
                <h3>Goalies</h3>
              </div>

              <div className={styles.tableWrap}>
                <table className={styles.table}>
                  <thead>
                    <tr>
                      <th>Name</th>
                      <th>GP</th>
                      <th>GS</th>
                      <th>W</th>
                      <th>L</th>
                      <th>OTL</th>
                      <th>GA</th>
                      <th>SA</th>
                      <th>SV%</th>
                      <th>GAA</th>
                      <th>SO</th>
                      <th>QS</th>
                      <th>QS%</th>
                    </tr>
                  </thead>
                  <tbody>
                    {rosterData.roster.goalies.map((row) => (
                      <tr key={row.playerId}>
                        <td>{row.playerName}</td>
                        <td>{row.gamesPlayed}</td>
                        <td>{row.gamesStarted}</td>
                        <td>{row.wins}</td>
                        <td>{row.losses}</td>
                        <td>{row.otl}</td>
                        <td>{row.goalsAllowed}</td>
                        <td>{row.shotsAgainst}</td>
                        <td>{formatPercent(row.savePct, 2)}</td>
                        <td>{formatRate(row.goalsAllowedAverage)}</td>
                        <td>{row.shutouts}</td>
                        <td>{row.qualityStarts}</td>
                        <td>{formatPercent(row.qualityStartsPct, 1)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          </section>
        ) : team && !isRosterLoading ? (
          <div className={styles.status}>No roster splits found for the selected team.</div>
        ) : null}
      </div>
    </>
  );
}
