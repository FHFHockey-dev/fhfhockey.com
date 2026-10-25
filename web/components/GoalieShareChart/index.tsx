import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Doughnut } from "react-chartjs-2";
import { Chart as ChartJS, ArcElement, Tooltip, Legend, Title } from "chart.js";
import { teamsInfo } from "../../lib/teamsInfo";
import Fetch from "../../lib/cors-fetch";
import styles from "./GoalieShareChart.module.scss";
import { assertUniqueGoalieGameRows, buildGoalieShareByTeam, type GoalieGameRow, type SpanType } from "../../lib/goalieWorkload";

// Register Chart.js components
ChartJS.register(ArcElement, Tooltip, Legend, Title);

// Preserve the component's existing helper/type import surface.
export { buildGoalieShareByTeam, type GoalieGameRow } from "../../lib/goalieWorkload";

// The CORS proxy accepts at most 100 rows per stats request.
const GOALIE_GAME_PAGE_SIZE = 100;
const GOALIE_GAME_PAGE_CONCURRENCY = 8;

function inferCurrentSeasonId(): number {
  const now = new Date();
  const year = now.getUTCFullYear();
  const month = now.getUTCMonth() + 1;
  const startYear = month >= 9 ? year : year - 1;
  return Number(`${startYear}${startYear + 1}`);
}

function unwrapProxyPayload(payload: any, context: string): any {
  if (payload?.success === false) {
    throw new Error(`${context}: ${payload.message || "Unknown proxy error"}`);
  }
  return payload;
}

const sleep = (ms: number) =>
  new Promise((resolve) => {
    setTimeout(resolve, ms);
  });

function isRateLimitError(error: unknown): boolean {
  return (
    error instanceof Error &&
    (error.message.includes("429") || error.message.includes("rate limited"))
  );
}

const GoalieShareChart: React.FC = () => {
  const [goalieGames, setGoalieGames] = useState<GoalieGameRow[]>([]);
  const [selectedSpan, setSelectedSpan] = useState<SpanType>("Season");
  const [loading, setLoading] = useState<boolean>(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [selectedTeam, setSelectedTeam] = useState<string>(() => {
    // Default to first team alphabetically
    const sortedTeamAbbrevs = Object.keys(teamsInfo).sort();
    return sortedTeamAbbrevs[0];
  });
  const [isMobile, setIsMobile] = useState<boolean>(false);
  const hasInitialized = useRef(false);
  const hasLoggedRateLimit = useRef(false);

  const logRateLimitOnce = useCallback(() => {
    if (hasLoggedRateLimit.current) return;
    hasLoggedRateLimit.current = true;
    console.warn(
      "NHL API rate-limited some requests (429). Goalie data is unavailable."
    );
  }, []);

  const fetchJsonWithRetry = useCallback(async (
    url: string,
    context: string,
    maxAttempts = 2
  ): Promise<any> => {
    let lastError: unknown = null;

    for (let attempt = 1; attempt <= maxAttempts; attempt++) {
      try {
        const response = await Fetch(url);
        const payload = await response.json().catch(() => {
          throw new Error(`${context}: response was not valid JSON`);
        });

        if (response.status === 429) {
          throw new Error(`${context}: rate limited (429)`);
        }
        if (!response.ok) {
          throw new Error(`${context}: HTTP ${response.status}`);
        }

        unwrapProxyPayload(payload, context);
        return payload;
      } catch (error) {
        lastError = error;
        const canRetry = attempt < maxAttempts;
        if (!canRetry) break;

        // Exponential backoff with small jitter to smooth retries.
        const delayMs = 500 * 2 ** (attempt - 1) + Math.floor(Math.random() * 250);
        await sleep(delayMs);
      }
    }

    if (isRateLimitError(lastError)) {
      logRateLimitOnce();
    }
    throw lastError;
  }, [logRateLimitOnce]);

  // Check if mobile on mount and window resize
  useEffect(() => {
    const checkMobile = () => {
      setIsMobile(window.innerWidth < 768);
    };

    checkMobile();
    window.addEventListener("resize", checkMobile);

    return () => window.removeEventListener("resize", checkMobile);
  }, []);

  // One league-wide read of every goalie appearance this season; the span
  // buttons only re-slice it, so they make no further requests. The proxy
  // caps pages at 100 rows: the first page gives the total, the rest run in
  // parallel batches.
  const fetchGoalieGames = useCallback(async (seasonId: number): Promise<void> => {
    const context = "Goalie game request failed";
    const pageUrl = (start: number) => {
      const params = new URLSearchParams({
        isAggregate: "false",
        isGame: "true",
        start: String(start),
        limit: String(GOALIE_GAME_PAGE_SIZE),
        sort: '[{"property":"gameDate","direction":"ASC"},{"property":"gameId","direction":"ASC"},{"property":"playerId","direction":"ASC"}]',
        cayenneExp: `seasonId=${seasonId} and gameTypeId=2`
      });
      return `https://api.nhle.com/stats/rest/en/goalie/summary?${params.toString()}`;
    };
    const readPage = async (start: number): Promise<{ rows: GoalieGameRow[]; total: number }> => {
      const response = await fetchJsonWithRetry(pageUrl(start), context);
      const payload = unwrapProxyPayload(response, context);
      if (!Array.isArray(payload?.data) || !Number.isInteger(payload.total) || payload.total < 0) {
        throw new Error(`${context}: invalid page metadata`);
      }
      const expectedRows = Math.min(GOALIE_GAME_PAGE_SIZE, Math.max(0, payload.total - start));
      if (payload.data.length !== expectedRows) {
        throw new Error(`${context}: incomplete page at ${start}`);
      }
      return {
        rows: payload.data,
        total: payload.total
      };
    };

    const firstPage = await readPage(0);
    const starts: number[] = [];
    for (let start = GOALIE_GAME_PAGE_SIZE; start < firstPage.total; start += GOALIE_GAME_PAGE_SIZE) {
      starts.push(start);
    }
    const rows = [...firstPage.rows];
    for (let index = 0; index < starts.length; index += GOALIE_GAME_PAGE_CONCURRENCY) {
      const pages = await Promise.all(
        starts.slice(index, index + GOALIE_GAME_PAGE_CONCURRENCY).map(readPage)
      );
      pages.forEach((page) => {
        if (page.total !== firstPage.total) {
          throw new Error(`${context}: total changed between pages`);
        }
        rows.push(...page.rows);
      });
    }
    assertUniqueGoalieGameRows(rows);
    setGoalieGames(rows);
  }, [fetchJsonWithRetry]);

  const handleSpanButtonClick = (span: SpanType): void => {
    setSelectedSpan(span);
  };

  // Each run (initial or "Try again") keeps the same bounded per-request
  // attempts and withholds every window unless the season is complete.
  const loadGoalieGames = useCallback(async () => {
      setLoading(true);
      setLoadError(null);
      let seasonId = inferCurrentSeasonId();
      try {
        const seasonParams = new URLSearchParams({
          sort: '[{"property":"id","direction":"DESC"}]'
        });
        const response = await fetchJsonWithRetry(
          `https://api.nhle.com/stats/rest/en/season?${seasonParams.toString()}`,
          "Season request failed"
        );
        if (!response) throw new Error("Season request rate-limited");
        const payload = unwrapProxyPayload(response, "Season request failed");
        const firstSeason = Array.isArray(payload?.data) ? payload.data[0] : null;
        if (!firstSeason?.id) {
          throw new Error("Season API returned an unexpected payload shape");
        }
        seasonId = firstSeason.id;
      } catch (error) {
        if (!isRateLimitError(error)) console.error("Error fetching season data:", error);
      }

      try {
        await fetchGoalieGames(seasonId);
      } catch (error) {
        setGoalieGames([]);
        setLoadError("Goalie data is unavailable because the complete season could not be loaded.");
        if (!isRateLimitError(error)) {
          console.error("Error fetching goalie game data:", error);
        }
      } finally {
        setLoading(false);
      }
  }, [fetchGoalieGames, fetchJsonWithRetry]);

  useEffect(() => {
    if (hasInitialized.current) return;
    hasInitialized.current = true;
    loadGoalieGames();
  }, [loadGoalieGames]);

  const goalieStats = useMemo(
    () => buildGoalieShareByTeam(goalieGames, selectedSpan),
    [goalieGames, selectedSpan]
  );
  const teamsWithData = Object.keys(goalieStats);
  // The narrow view shows one team; fall back to the first team with data
  // when the chosen (or default) team has no appearances in this window.
  const shownTeam = goalieStats[selectedTeam] ? selectedTeam : teamsWithData[0];

  const generateChartData = (teamAbbrev: string) => {
    const teamStats = goalieStats[teamAbbrev];
    if (!teamStats || teamStats.goalies.length === 0) {
      return null;
    }

    const teamColors = teamsInfo[teamAbbrev as keyof typeof teamsInfo];
    const colors = teamColors
      ? [
          teamColors.primaryColor,
          teamColors.secondaryColor,
          teamColors.jersey,
          teamColors.accent,
          teamColors.alt
        ]
      : ["#FF6384", "#36A2EB", "#FFCE56", "#4BC0C0", "#9966FF"];

    const goalies = teamStats.goalies.slice(0, 5); // Limit to top 5 goalies
    const totalAppearances = teamStats.totalAppearances;

    return {
      labels: goalies.map((goalie) => {
        const percentage =
          totalAppearances > 0
            ? ((goalie.gamesPlayed / totalAppearances) * 100).toFixed(1)
            : "0.0";
        // Safe handling of goalie names
        const lastName = goalie.goalieFullName
          ? goalie.goalieFullName.split(" ").pop() || goalie.goalieFullName
          : "Unknown";
        return `${lastName} (${percentage}%)`;
      }),
      datasets: [
        {
          data: goalies.map((goalie) => goalie.gamesPlayed),
          backgroundColor: goalies.map(
            (_, index) => colors[index % colors.length]
          ),
          borderColor: goalies.map((_, index) => colors[index % colors.length]),
          borderWidth: 2,
          hoverBorderWidth: 3
        }
      ]
    };
  };

  const generateChartOptions = (teamAbbrev: string) => ({
    responsive: true,
    maintainAspectRatio: false,
    plugins: {
      legend: {
        position: "left" as const,
        labels: {
          boxWidth: 12,
          padding: 8,
          font: {
            size: 14,
            family: "'Roboto Condensed', sans-serif"
          },
          color: "#ffffff"
        }
      },
      tooltip: {
        backgroundColor: "rgba(0, 0, 0, 0.8)",
        titleColor: "#ffffff",
        bodyColor: "#ffffff",
        borderColor: "#ffffff",
        borderWidth: 1,
        callbacks: {
          label: function (context: any) {
            const teamStats = goalieStats[teamAbbrev];
            const goalie = teamStats?.goalies[context.dataIndex];
            if (goalie) {
              const goalieDisplayName =
                goalie.goalieFullName || "Unknown Goalie";
              return [
                `${goalieDisplayName}: ${context.parsed} appearances`,
                `Save %: ${goalie.savePct === null ? "Unavailable" : `${(goalie.savePct * 100).toFixed(1)}%`}`,
                `GAA: ${goalie.goalsAgainstAverage === null ? "Unavailable" : goalie.goalsAgainstAverage.toFixed(2)}`
              ];
            }
            return `${context.label}: ${context.parsed} appearances`;
          }
        }
      }
    },
    cutout: "60%"
  });

  const renderTeamCharts = () => {
    const teams = Object.keys(goalieStats);

    // For mobile, show only selected team
    if (isMobile) {
      const teamsToShow = teams.filter((team) => team === shownTeam);
      if (teamsToShow.length === 0) return null;

      return (
        <div className={styles.chartsGrid}>
          <table className={styles.chartsTable}>
            <tbody>
              <tr>
                {teamsToShow.map((teamAbbrev) => {
                  const chartData = generateChartData(teamAbbrev);
                  if (!chartData) return <td key={teamAbbrev}></td>;

                  const teamInfo =
                    teamsInfo[teamAbbrev as keyof typeof teamsInfo];
                  const teamStats = goalieStats[teamAbbrev];
                  const totalGames = teamStats?.totalGames || 0;

                  return (
                    <td key={teamAbbrev}>
                      <div
                        className={styles.teamChartCard}
                        style={
                          {
                            "--team-primary":
                              teamInfo?.primaryColor || "#14a2d2",
                            "--team-secondary":
                              teamInfo?.secondaryColor || "#07aae2",
                            "--team-jersey": teamInfo?.jersey || "#ffcc00",
                            "--team-accent": teamInfo?.accent || "#ff6384",
                            "--team-alt": teamInfo?.alt || "#4bc0c0"
                          } as React.CSSProperties
                        }
                      >
                        <div className={styles.teamHeader}>
                          <div className={styles.logoAndInfo}>
                            <img
                              className={styles.teamLogo}
                              src={`/teamLogos/${teamAbbrev}.png`}
                              alt={`${teamAbbrev} logo`}
                            />
                            <h4 className={styles.teamName}>
                              {teamInfo?.shortName || teamAbbrev}
                            </h4>
                            <div className={styles.teamStats}>
                              <span className={styles.statsLabel}>Team GP:</span>
                              <span className={styles.statsValue}>
                                {totalGames}
                              </span>
                            </div>
                          </div>
                        </div>
                        <div className={styles.chartContainer}>
                          <Doughnut
                            data={chartData}
                            options={generateChartOptions(teamAbbrev)}
                          />
                        </div>
                      </div>
                    </td>
                  );
                })}
              </tr>
            </tbody>
          </table>
        </div>
      );
    }

    // Desktop view - show all teams in 4-column grid
    const teamsPerRow = 4;
    const rows = [];

    for (let i = 0; i < teams.length; i += teamsPerRow) {
      rows.push(teams.slice(i, i + teamsPerRow));
    }

    return (
      <div className={styles.chartsGrid}>
        <table className={styles.chartsTable}>
          <tbody>
            {rows.map((row, rowIndex) => (
              <tr key={rowIndex}>
                {row.map((teamAbbrev) => {
                  const chartData = generateChartData(teamAbbrev);
                  if (!chartData) return <td key={teamAbbrev}></td>;

                  const teamInfo =
                    teamsInfo[teamAbbrev as keyof typeof teamsInfo];
                  const teamStats = goalieStats[teamAbbrev];
                  const totalGames = teamStats?.totalGames || 0;

                  return (
                    <td key={teamAbbrev}>
                      <div
                        className={styles.teamChartCard}
                        style={
                          {
                            "--team-primary":
                              teamInfo?.primaryColor || "#14a2d2",
                            "--team-secondary":
                              teamInfo?.secondaryColor || "#07aae2",
                            "--team-jersey": teamInfo?.jersey || "#ffcc00",
                            "--team-accent": teamInfo?.accent || "#ff6384",
                            "--team-alt": teamInfo?.alt || "#4bc0c0"
                          } as React.CSSProperties
                        }
                      >
                        <div className={styles.teamHeader}>
                          <div className={styles.logoAndInfo}>
                            <img
                              className={styles.teamLogo}
                              src={`/teamLogos/${teamAbbrev}.png`}
                              alt={`${teamAbbrev} logo`}
                            />
                            <h4 className={styles.teamName}>
                              {teamInfo?.shortName || teamAbbrev}
                            </h4>
                            <div className={styles.teamStats}>
                              <span className={styles.statsLabel}>Team GP:</span>
                              <span className={styles.statsValue}>
                                {totalGames}
                              </span>
                            </div>
                          </div>
                        </div>
                        <div className={styles.chartContainer}>
                          <Doughnut
                            data={chartData}
                            options={generateChartOptions(teamAbbrev)}
                          />
                        </div>
                      </div>
                    </td>
                  );
                })}
                {/* Fill empty cells for incomplete rows */}
                {[...Array(teamsPerRow - row.length)].map((_, index) => (
                  <td key={`empty-${index}`}></td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    );
  };

  // Handle team dropdown change
  const handleTeamChange = (event: React.ChangeEvent<HTMLSelectElement>) => {
    setSelectedTeam(event.target.value);
  };

  return (
    <div className={styles.goalieShareChart}>
      <p>Share of recorded goalie appearances, including relief. L10, L20 and L30 use team games. These are past workload shares, not future start probabilities.</p>
      <div className={styles.buttonContainer}>
        <button
          className={`${styles.spanButton} ${selectedSpan === "L10" ? styles.active : ""}`}
          onClick={() => handleSpanButtonClick("L10")}
        >
          L10
        </button>
        <button
          className={`${styles.spanButton} ${selectedSpan === "L20" ? styles.active : ""}`}
          onClick={() => handleSpanButtonClick("L20")}
        >
          L20
        </button>
        <button
          className={`${styles.spanButton} ${selectedSpan === "L30" ? styles.active : ""}`}
          onClick={() => handleSpanButtonClick("L30")}
        >
          L30
        </button>
        <button
          className={`${styles.spanButton} ${selectedSpan === "Season" ? styles.active : ""}`}
          onClick={() => handleSpanButtonClick("Season")}
        >
          Season
        </button>
      </div>

      {/* Team selector dropdown for mobile view */}
      {isMobile && !loading && !loadError && shownTeam && (
        <div className={styles.teamSelectorContainer}>
          <select
            value={shownTeam}
            onChange={handleTeamChange}
            className={styles.teamSelector}
            aria-label="Team"
          >
            {teamsWithData.map((teamAbbrev) => (
              <option key={teamAbbrev} value={teamAbbrev}>
                {teamsInfo[teamAbbrev as keyof typeof teamsInfo]?.shortName ||
                  teamAbbrev}
              </option>
            ))}
          </select>
        </div>
      )}

      {loading ? (
        <div className={styles.loadingMessage}>Loading goalie data...</div>
      ) : loadError ? (
        <div className={styles.noDataMessage} role="alert">
          {loadError}
          <button
            type="button"
            className={styles.retryButton}
            onClick={() => loadGoalieGames()}
          >
            Try again
          </button>
        </div>
      ) : (
        <>
          {Object.keys(goalieStats).length > 0 ? (
            isMobile ? (
              // Render single chart for selected team in mobile view
              <div className={styles.mobileChartContainer}>
                {renderTeamCharts()}
              </div>
            ) : (
              renderTeamCharts()
            )
          ) : (
            <div className={styles.noDataMessage}>
              No goalie data available for the selected timeframe.
            </div>
          )}
        </>
      )}
    </div>
  );
};

export default GoalieShareChart;
