import Head from "next/head";
import type { GetServerSideProps } from "next";
import { useRouter } from "next/router";
import useSWR from "swr";
import styles from "./[gameId].module.scss";
import PlayerSearchBar from "components/StatsPage/PlayerSearchBar";

const fetcher = async (url: string) => {
  const res = await fetch(url);
  const data = await res.json();
  if (!res.ok || data?.error || data?.success === false) {
    throw new Error(data?.error || data?.message || `Request failed with status ${res.status}`);
  }
  return data;
};

const isGameId = (value: unknown): value is string =>
  typeof value === "string" && /^[1-9]\d{9}$/.test(value);

const isCompleted = (state: unknown) =>
  state === "OFF" || state === "OVER" || state === "FINAL";

function gameStatus(state: unknown) {
  if (isCompleted(state)) return "Final";
  if (state === "FUT") return "Scheduled";
  if (state === "PRE") return "Pregame";
  if (state === "LIVE" || state === "CRIT") return "Live";
  return "Status unavailable";
}

const TEAM_STAT_LABELS: Record<string, string> = {
  sog: "Shots on Goal",
  faceoffWinningPctg: "Faceoff Win %",
  faceoffWins: "Faceoff Wins",
  powerPlay: "Power Play",
  powerPlayPctg: "Power Play %",
  pim: "Penalty Minutes",
  hits: "Hits",
  blockedShots: "Blocked Shots",
  giveaways: "Giveaways",
  takeaways: "Takeaways"
};

function getName(value: any): string {
  return value?.default || value || "-";
}

function formatPct(value?: number): string {
  if (value === undefined || value === null || Number.isNaN(value)) return "-";
  const normalized = value <= 1 ? value * 100 : value;
  return `${normalized.toFixed(1)}%`;
}

function formatSavePct(value?: number): string {
  if (value === undefined || value === null || Number.isNaN(value)) return "-";
  return value.toFixed(3).replace(/^0/, "");
}

function toNumber(value: any): number {
  const numeric = Number(value);
  return Number.isFinite(numeric) ? numeric : 0;
}

function getStarter(goalies?: any[]) {
  if (!Array.isArray(goalies) || goalies.length === 0) return null;
  return (
    goalies.find((goalie) => goalie.starter) ||
    goalies.find((goalie) => goalie.toi && goalie.toi !== "00:00") ||
    goalies[0]
  );
}

function getTopSkaters(boxscore: any, awayAbbrev: string, homeAbbrev: string) {
  const collect = (side: "awayTeam" | "homeTeam", abbrev: string) => {
    const stats = boxscore?.playerByGameStats?.[side];
    return [...(stats?.forwards || []), ...(stats?.defense || [])].map(
      (player) => ({
        ...player,
        teamAbbrev: abbrev
      })
    );
  };

  return [
    ...collect("awayTeam", awayAbbrev),
    ...collect("homeTeam", homeAbbrev)
  ]
    .sort(
      (a, b) =>
        toNumber(b.points) - toNumber(a.points) ||
        toNumber(b.goals) - toNumber(a.goals) ||
        toNumber(b.sog) - toNumber(a.sog) ||
        String(b.toi || "").localeCompare(String(a.toi || ""))
    )
    .slice(0, 5);
}

function getTeamStatValue(stat: any, side: "away" | "home") {
  const value = side === "away" ? stat.awayValue : stat.homeValue;
  if (typeof value === "number" && stat.category.toLowerCase().includes("pct")) {
    return formatPct(value);
  }
  return value ?? "-";
}

function getBarWidths(awayVal: unknown, homeVal: unknown) {
  if (typeof awayVal !== "number" || !Number.isFinite(awayVal) || awayVal < 0 ||
      typeof homeVal !== "number" || !Number.isFinite(homeVal) || homeVal < 0) return null;
  const total = awayVal + homeVal;
  if (total === 0) return { away: 50, home: 50 };
  return {
    away: (awayVal / total) * 100,
    home: (homeVal / total) * 100
  };
}

// Helper to convert American/Decimal odds to implied probability
function getImpliedProb(oddsStr?: string): number | null {
  if (typeof oddsStr !== "string" || !/^[+-]?\d+(\.\d+)?$/.test(oddsStr)) return null;
  
  // Handle decimal odds
  if (!oddsStr.startsWith("+") && !oddsStr.startsWith("-")) {
    const decimal = parseFloat(oddsStr);
    return Number.isFinite(decimal) && decimal > 1 ? (1 / decimal) * 100 : null;
  }
  
  // Handle American odds
  if (!/^[+-]\d+$/.test(oddsStr)) return null;
  const odds = Number(oddsStr);
  if (!Number.isFinite(odds) || odds === 0) return null;
  if (odds > 0) {
    return (100 / (odds + 100)) * 100;
  } else {
    return (-odds / (-odds + 100)) * 100;
  }
}

export default function GameStatsPage() {
  const router = useRouter();
  const gameId = isGameId(router.query.gameId) ? router.query.gameId : null;
  const invalidGameId = router.isReady && !gameId;

  const { data: rightRail, error: rrError, isLoading: railLoading } = useSWR(
    gameId ? `/api/v1/game/${gameId}/right-rail` : null,
    fetcher
  );

  const { data: boxscoreResponse, error: boxscoreError, isLoading: boxscoreLoading } = useSWR(
    gameId ? `/api/v1/game/${gameId}/boxscore` : null,
    fetcher
  );
  const boxscore = boxscoreResponse?.success === true && boxscoreResponse.data?.id === Number(gameId)
    ? boxscoreResponse.data : null;
  const seasonSeries = Array.isArray(rightRail?.seasonSeries) ? rightRail.seasonSeries : [];

  const currentGame = boxscore?.awayTeam && boxscore?.homeTeam ? boxscore : seasonSeries.find(
    (g: any) => g.id === Number(gameId)
  );
  
  const gameDate = currentGame?.gameDate || boxscore?.gameDate;

  const { data: scheduleData } = useSWR(
    gameDate ? `/api/v1/schedule/date/${gameDate}` : null,
    fetcher
  );

  const hasGameData = Boolean(currentGame?.awayTeam && currentGame?.homeTeam);
  const isLoading = !router.isReady || Boolean(gameId && !hasGameData && (railLoading || boxscoreLoading));

  // Find game in daily schedule to get odds
  const gameOdds = scheduleData?.gameWeek?.[0]?.games?.find(
    (g: any) => g.id === Number(gameId)
  );

  // DraftKings is usually providerId 9, fallback to 8 (Sportradar) or first available
  const findOdds = (teamOdds: any[]) => {
    if (!Array.isArray(teamOdds) || !teamOdds.length) return undefined;
    return teamOdds.find(o => o.providerId === 9)?.value || 
           teamOdds.find(o => o.providerId === 8)?.value || 
           teamOdds[0]?.value;
  };

  const awayMoneylineStr = findOdds(gameOdds?.awayTeam?.odds);
  const homeMoneylineStr = findOdds(gameOdds?.homeTeam?.odds);

  const rawAwayProb = getImpliedProb(awayMoneylineStr);
  const rawHomeProb = getImpliedProb(homeMoneylineStr);
  const totalProb = (rawAwayProb ?? 0) + (rawHomeProb ?? 0);
  
  // Normalize probabilities (removing the vig)
  const hasMarketOdds = rawAwayProb != null && rawHomeProb != null;
  const awayProb =
    rawAwayProb != null && hasMarketOdds && totalProb > 0
      ? Math.round((rawAwayProb / totalProb) * 100)
      : null;
  const homeProb = awayProb == null ? null : 100 - awayProb;

  // Team Context
  const awayTeam = currentGame?.awayTeam || boxscore?.awayTeam || { abbrev: "Away", score: null };
  const homeTeam = currentGame?.homeTeam || boxscore?.homeTeam || { abbrev: "Home", score: null };
  
  const teamGameStats = Array.isArray(rightRail?.teamGameStats) ? rightRail.teamGameStats : [];
  const sogStat = teamGameStats.find((stat: any) => stat.category === "sog");
  const powerPlayPctStat = teamGameStats.find(
    (stat: any) => stat.category === "powerPlayPctg"
  );
  const faceoffStat = teamGameStats.find(
    (stat: any) => stat.category === "faceoffWinningPctg"
  );
  const shotsBars = getBarWidths(sogStat?.awayValue, sogStat?.homeValue);
  const powerPlayBars = getBarWidths(
    powerPlayPctStat?.awayValue,
    powerPlayPctStat?.homeValue
  );
  const faceoffBars = getBarWidths(
    faceoffStat?.awayValue,
    faceoffStat?.homeValue
  );
  
  const last10Away = rightRail?.last10Record?.awayTeam || { record: "Unavailable", streak: 0 };
  const last10Home = rightRail?.last10Record?.homeTeam || { record: "Unavailable", streak: 0 };

  const awayStarter = getStarter(boxscore?.playerByGameStats?.awayTeam?.goalies);
  const homeStarter = getStarter(boxscore?.playerByGameStats?.homeTeam?.goalies);
  const topSkaters = getTopSkaters(
    boxscore,
    awayTeam?.abbrev || "Away",
    homeTeam?.abbrev || "Home"
  );
  const visibleTeamStats = teamGameStats.slice(0, 6);

  return (
    <>
      <Head>
        <title>Game Preview | FHFHockey</title>
      </Head>
      <div className={styles.pageShell}>
        <div className={styles.pageStack}>
          {/* Top Bar with Search */}
          <div className={styles.controlBar}>
             <PlayerSearchBar />
          </div>
          
          {/* 1. Identity & Scope Header */}
          <header className={styles.matchupHeader}>
             <div className={styles.teamAway}>
                <span className={styles.teamEyebrow}>Away ({last10Away.record})</span>
             <div className={styles.teamName}>{awayTeam.abbrev}</div>
                <div className={styles.teamRecord}>
                  {last10Away.streak > 0 ? `${last10Away.streakType}${last10Away.streak} Streak` : " "}
                </div>
             </div>
             <div className={styles.gameInfo}>
                <div className={styles.gameStatus}>
                  {isLoading
                    ? "Loading..."
                    : !hasGameData
                      ? "Unavailable"
                      : gameStatus(currentGame?.gameState)}
                </div>
                <div className={styles.gameTime}>
                  {gameOdds
                    ? new Date(gameOdds.startTimeUTC).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
                    : gameDate
                      ? new Date(`${gameDate}T12:00:00`).toLocaleDateString([], { month: "short", day: "numeric", year: "numeric" })
                      : "-"}
                </div>
                <div className={styles.venue}>NHL GameCenter</div>
             </div>
             <div className={styles.teamHome}>
                <span className={styles.teamEyebrow}>Home ({last10Home.record})</span>
             <div className={styles.teamName}>{homeTeam.abbrev}</div>
                <div className={styles.teamRecord}>
                  {last10Home.streak > 0 ? `${last10Home.streakType}${last10Home.streak} Streak` : " "}
                </div>
             </div>
          </header>

          {!isLoading && !hasGameData && (
            <div className={styles.dataPanel}>
              <div className={styles.panelBody}>
                <div className={styles.placeholderText}>
                  {invalidGameId ? "Invalid game ID."
                    : rrError || boxscoreError ? "Game data could not be loaded."
                    : "Game data is unavailable for this id."}
                </div>
              </div>
            </div>
          )}
          {boxscoreError && <p role="status">Boxscore could not be loaded.</p>}
          {rrError && <p role="status">Team game context could not be loaded.</p>}

          {/* Bento Grid */}
          {hasGameData && <div className={styles.bentoGrid}>
            
            {/* Win Probability & Projected Score */}
            <section className={`${styles.dataPanel} ${styles.panelProbability}`}>
              <div className={styles.panelHeader}>
                <h3>Implied Win Probability</h3>
              </div>
              <div className={styles.panelBody}>
                <div className={styles.probabilityHero}>
                  <div className={styles.probScale}>
                    <div className={styles.probLabels}>
                      <span className={styles.probAway}>{awayTeam.abbrev} {awayProb == null ? "-" : `${awayProb}%`}</span>
                      <span className={styles.probHome}>{homeTeam.abbrev} {homeProb == null ? "-" : `${homeProb}%`}</span>
                    </div>
                    {hasMarketOdds ? <div className={styles.probBar}>
                      <div className={styles.probFillAway} style={{ width: `${awayProb}%` }}></div>
                      <div className={styles.probFillHome} style={{ width: `${homeProb}%` }}></div>
                    </div> : <p>Market odds unavailable.</p>}
                    <div className={styles.probLabels} style={{ color: "rgba(255,255,255,0.5)", marginTop: "0.25rem" }}>
                      <span>Score: {awayTeam.score ?? "-"}</span>
                      <span>Score: {homeTeam.score ?? "-"}</span>
                    </div>
                  </div>
                </div>
              </div>
            </section>

            {/* Goalie Matchup */}
            <section className={`${styles.dataPanel} ${styles.panelGoalies}`}>
              <div className={styles.panelHeader}>
                <h3>Goalie Matchup</h3>
              </div>
              <div className={styles.panelBody}>
                <div className={styles.goalieMatchup}>
                  {/* Away Goalie */}
                  <div className={`${styles.goalieCard} ${styles.away}`}>
                    <div className={styles.goalieHeader}>
                      <div className={styles.goalieName}>{getName(awayStarter?.name)}</div>
                      <div className={styles.goalieStatus}>
                        {awayStarter?.decision || (awayStarter ? "Starter" : "Unavailable")}
                      </div>
                    </div>
                    <div className={styles.statGrid}>
                      <div className={styles.statBox}>
                        <span className={styles.statLabel}>SV%</span>
                        <span className={styles.statValue}>{formatSavePct(awayStarter?.savePctg)}</span>
                      </div>
                      <div className={styles.statBox}>
                        <span className={styles.statLabel}>GA</span>
                        <span className={styles.statValue}>{awayStarter?.goalsAgainst ?? "-"}</span>
                      </div>
                      <div className={styles.statBox}>
                        <span className={styles.statLabel}>SA</span>
                        <span className={styles.statValue}>{awayStarter?.shotsAgainst ?? "-"}</span>
                      </div>
                    </div>
                  </div>

                  {/* Home Goalie */}
                  <div className={`${styles.goalieCard} ${styles.home}`}>
                    <div className={styles.goalieHeader}>
                      <div className={styles.goalieName}>{getName(homeStarter?.name)}</div>
                      <div className={styles.goalieStatus}>
                        {homeStarter?.decision || (homeStarter ? "Starter" : "Unavailable")}
                      </div>
                    </div>
                    <div className={styles.statGrid}>
                      <div className={styles.statBox}>
                        <span className={styles.statLabel}>SV%</span>
                        <span className={styles.statValue}>{formatSavePct(homeStarter?.savePctg)}</span>
                      </div>
                      <div className={styles.statBox}>
                        <span className={styles.statLabel}>GA</span>
                        <span className={styles.statValue}>{homeStarter?.goalsAgainst ?? "-"}</span>
                      </div>
                      <div className={styles.statBox}>
                        <span className={styles.statLabel}>SA</span>
                        <span className={styles.statValue}>{homeStarter?.shotsAgainst ?? "-"}</span>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </section>

            {/* Team Strengths */}
            <section className={`${styles.dataPanel} ${styles.panelStrengths}`}>
              <div className={styles.panelHeader}>
                <h3>Team Strengths</h3>
              </div>
              <div className={styles.panelBody}>
                {/* We don't have 5v5 xG% from the basic NHL API, so using Goals/Gm vs GoalsAgainst/Gm for now */}
                <div className={styles.strengthRow}>
                  <div className={styles.strengthLabels}>
                    <span className={styles.strengthValueAway}>{sogStat?.awayValue ?? "-"}</span>
                    <span>Shots on Goal</span>
                    <span className={styles.strengthValueHome}>{sogStat?.homeValue ?? "-"}</span>
                  </div>
                  {shotsBars && <div className={styles.strengthBarWrap}>
                    <div className={styles.strengthFillAway} style={{ width: `${shotsBars.away}%` }}></div>
                    <div className={styles.strengthFillHome} style={{ width: `${shotsBars.home}%` }}></div>
                  </div>}
                </div>
                <div className={styles.strengthRow}>
                  <div className={styles.strengthLabels}>
                    <span className={styles.strengthValueAway}>{formatPct(powerPlayPctStat?.awayValue)}</span>
                    <span>Power Play</span>
                    <span className={styles.strengthValueHome}>{formatPct(powerPlayPctStat?.homeValue)}</span>
                  </div>
                  {powerPlayBars && <div className={styles.strengthBarWrap}>
                    <div className={styles.strengthFillAway} style={{ width: `${powerPlayBars.away}%` }}></div>
                    <div className={styles.strengthFillHome} style={{ width: `${powerPlayBars.home}%` }}></div>
                  </div>}
                </div>
                <div className={styles.strengthRow}>
                  <div className={styles.strengthLabels}>
                    <span className={styles.strengthValueAway}>{formatPct(faceoffStat?.awayValue)}</span>
                    <span>Faceoff Win %</span>
                    <span className={styles.strengthValueHome}>{formatPct(faceoffStat?.homeValue)}</span>
                  </div>
                  {faceoffBars && <div className={styles.strengthBarWrap}>
                    <div className={styles.strengthFillAway} style={{ width: `${faceoffBars.away}%` }}></div>
                    <div className={styles.strengthFillHome} style={{ width: `${faceoffBars.home}%` }}></div>
                  </div>}
                </div>
              </div>
            </section>

            {/* Projected Lines */}
            <section className={`${styles.dataPanel} ${styles.panelLines}`}>
              <div className={styles.panelHeader}>
                <h3>Team Game Stats</h3>
              </div>
              <div className={styles.panelBody}>
                <table className={styles.linesTable}>
                  <thead>
                    <tr>
                      <th>{awayTeam.abbrev}</th>
                      <th>Metric</th>
                      <th>{homeTeam.abbrev}</th>
                    </tr>
                  </thead>
                  <tbody>
                    {visibleTeamStats.map((stat: any) => (
                      <tr key={stat.category}>
                        <td><span className={styles.xgValue}>{getTeamStatValue(stat, "away")}</span></td>
                        <td className={styles.lineMatchup}>{TEAM_STAT_LABELS[stat.category] || stat.category}</td>
                        <td><span className={styles.xgValue}>{getTeamStatValue(stat, "home")}</span></td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </section>

            {/* Hot Players */}
            <section className={`${styles.dataPanel} ${styles.panelTrends}`}>
              <div className={styles.panelHeader}>
                <h3>Top Skaters</h3>
              </div>
              <div className={styles.panelBody}>
                <div className={styles.playerList}>
                  {topSkaters.length > 0 ? (
                    topSkaters.map((player: any) => (
                      <div className={styles.playerItem} key={player.playerId}>
                        <div className={styles.playerInfo}>
                          <span className={styles.playerPos}>{player.teamAbbrev}</span>
                          <span className={styles.playerName}>{getName(player.name)}</span>
                        </div>
                        <div className={styles.playerTrend}>
                          {player.points ?? "-"}P / {player.sog ?? "-"} SOG
                        </div>
                      </div>
                    ))
                  ) : (
                    <div className={styles.placeholderText} style={{ padding: "1rem 0" }}>
                      Skater boxscore is unavailable for this game.
                    </div>
                  )}
                </div>
              </div>
            </section>

            {/* Head-to-Head */}
            <section className={`${styles.dataPanel} ${styles.panelH2H}`}>
              <div className={styles.panelHeader}>
                <h3>Recent Head-to-Head</h3>
              </div>
              <div className={styles.panelBody}>
                <div className={styles.h2hList}>
                  {seasonSeries.map((game: any) => {
                    if (!isCompleted(game.gameState) || !game.awayTeam || !game.homeTeam) return null;
                    
                    const aTeam = game.awayTeam;
                    const hTeam = game.homeTeam;
                    const scoresKnown = typeof aTeam.score === "number" && Number.isFinite(aTeam.score) && aTeam.score >= 0 &&
                      typeof hTeam.score === "number" && Number.isFinite(hTeam.score) && hTeam.score >= 0;
                    const winner = scoresKnown && aTeam.score !== hTeam.score
                      ? (aTeam.score > hTeam.score ? aTeam : hTeam) : null;
                    const isHomeWin = winner?.id === hTeam.id;

                    return (
                      <div className={styles.h2hCard} key={game.id}>
                        <div className={styles.h2hDate}>
                          {new Date(game.gameDate).toLocaleDateString([], { month: 'short', day: 'numeric', year: 'numeric' })}
                        </div>
                        <div className={styles.h2hScore}>
                          {aTeam.abbrev} {aTeam.score ?? "-"} - {hTeam.score ?? "-"} {hTeam.abbrev}
                        </div>
                        <div className={isHomeWin ? styles.h2hWinnerHome : styles.h2hWinnerAway}>
                          {winner ? `${winner.abbrev} Win` : "Result unavailable"}
                        </div>
                      </div>
                    );
                  })}
                  {!seasonSeries.some((g: any) => isCompleted(g.gameState) && g.awayTeam && g.homeTeam) && (
                    <div className={styles.placeholderText} style={{ padding: "0.5rem", width: "100%" }}>
                      {Array.isArray(rightRail?.seasonSeries) ? "No completed meetings available." : "Head-to-head results are unavailable."}
                    </div>
                  )}
                </div>
              </div>
            </section>

          </div>}
        </div>
      </div>
    </>
  );
}

export const getServerSideProps: GetServerSideProps = async ({ params }) =>
  isGameId(params?.gameId) ? { props: {} } : { notFound: true };
