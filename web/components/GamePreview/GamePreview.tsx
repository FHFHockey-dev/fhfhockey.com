import React from "react";
import useSWR from "swr";
import styles from "./GamePreview.module.scss";

const fetcher = (url: string) => fetch(url).then((res) => res.json());

// Helper to convert American/Decimal odds to implied probability
function getImpliedProb(oddsStr?: string): number {
  if (!oddsStr) return 50;
  
  // Handle decimal odds
  if (!oddsStr.startsWith("+") && !oddsStr.startsWith("-")) {
    const decimal = parseFloat(oddsStr);
    if (!isNaN(decimal) && decimal > 0) return (1 / decimal) * 100;
  }
  
  // Handle American odds
  const odds = parseInt(oddsStr.replace("+", ""), 10);
  if (isNaN(odds)) return 50;
  if (odds > 0) {
    return (100 / (odds + 100)) * 100;
  } else {
    return (-odds / (-odds + 100)) * 100;
  }
}

interface GamePreviewProps {
  gameId: string | number;
}

export default function GamePreview({ gameId }: GamePreviewProps) {
  const { data: rightRail, error: rrError } = useSWR(
    gameId ? `/api/v1/game/${gameId}/right-rail` : null,
    fetcher
  );

  const currentGame = rightRail?.seasonSeries?.find(
    (g: any) => g.id === Number(gameId)
  );
  
  const gameDate = currentGame?.gameDate;

  const { data: scheduleData } = useSWR(
    gameDate ? `/api/v1/schedule/date/${gameDate}` : null,
    fetcher
  );

  // Find game in daily schedule to get odds
  const gameOdds = scheduleData?.gameWeek?.[0]?.games?.find(
    (g: any) => g.id === Number(gameId)
  );

  // DraftKings is usually providerId 9, fallback to 8 (Sportradar) or first available
  const findOdds = (teamOdds: any[]) => {
    if (!teamOdds || !teamOdds.length) return undefined;
    return teamOdds.find((o: any) => o.providerId === 9)?.value || 
           teamOdds.find((o: any) => o.providerId === 8)?.value || 
           teamOdds[0]?.value;
  };

  const awayMoneylineStr = findOdds(gameOdds?.awayTeam?.odds);
  const homeMoneylineStr = findOdds(gameOdds?.homeTeam?.odds);

  const rawAwayProb = getImpliedProb(awayMoneylineStr);
  const rawHomeProb = getImpliedProb(homeMoneylineStr);
  const totalProb = rawAwayProb + rawHomeProb;
  
  // Normalize probabilities (removing the vig)
  const awayProb = totalProb ? Math.round((rawAwayProb / totalProb) * 100) : 42; // fallback to mock data
  const homeProb = totalProb ? 100 - awayProb : 58;

  // Team Context
  const awayTeam = currentGame?.awayTeam || { abbrev: "Away", score: 0 };
  const homeTeam = currentGame?.homeTeam || { abbrev: "Home", score: 0 };
  
  const awayStats = rightRail?.teamSeasonStats?.awayTeam || {
    ppPctg: 0.21, pkPctg: 0.82, goalsForPerGamePlayed: 3.1, goalsAgainstPerGamePlayed: 2.8
  };
  const homeStats = rightRail?.teamSeasonStats?.homeTeam || {
    ppPctg: 0.22, pkPctg: 0.74, goalsForPerGamePlayed: 3.3, goalsAgainstPerGamePlayed: 3.1
  };

  // Calculate visual bar widths for strengths
  const getBarWidths = (awayVal: number, homeVal: number) => {
    const total = awayVal + homeVal;
    if (total === 0) return { away: 50, home: 50 };
    return {
      away: (awayVal / total) * 100,
      home: (homeVal / total) * 100
    };
  };

  const ppVsPkAway = awayStats.ppPctg + (1 - homeStats.pkPctg);
  const ppVsPkHome = homeStats.ppPctg + (1 - awayStats.pkPctg);
  const specialTeamsBars = getBarWidths(ppVsPkAway, ppVsPkHome);
  const goalsBars = getBarWidths(awayStats.goalsForPerGamePlayed, homeStats.goalsForPerGamePlayed);

  return (
    <div className={styles.bentoGrid}>
      
      {/* Win Probability & Projected Score */}
      <section className={`${styles.dataPanel} ${styles.panelProbability}`}>
        <div className={styles.panelHeader}>
          <h3>Implied Win Probability</h3>
        </div>
        <div className={styles.panelBody}>
          <div className={styles.probabilityHero}>
            <div className={styles.probScale}>
              <div className={styles.probLabels}>
                <span className={styles.probAway}>{awayTeam.abbrev} {awayProb}%</span>
                <span className={styles.probHome}>{homeTeam.abbrev} {homeProb}%</span>
              </div>
              <div className={styles.probBar}>
                <div className={styles.probFillAway} style={{ width: `${awayProb}%` }}></div>
                <div className={styles.probFillHome} style={{ width: `${homeProb}%` }}></div>
              </div>
              <div className={styles.probLabels} style={{ color: "rgba(255,255,255,0.5)", marginTop: "0.25rem" }}>
                <span>Proj: {awayStats.goalsForPerGamePlayed.toFixed(1)}</span>
                <span>Proj: {homeStats.goalsForPerGamePlayed.toFixed(1)}</span>
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
                <div className={styles.goalieName}>Away Starter</div>
                <div className={`${styles.goalieStatus} ${styles.unconfirmed}`}>Expected</div>
              </div>
              <div className={styles.statGrid}>
                <div className={styles.statBox}>
                  <span className={styles.statLabel}>SV%</span>
                  <span className={styles.statValue}>.000</span>
                </div>
                <div className={styles.statBox}>
                  <span className={styles.statLabel}>GAA</span>
                  <span className={styles.statValue}>0.00</span>
                </div>
                <div className={styles.statBox}>
                  <span className={styles.statLabel}>GSAx</span>
                  <span className={styles.statValue}>0.0</span>
                </div>
              </div>
            </div>

            {/* Home Goalie */}
            <div className={`${styles.goalieCard} ${styles.home}`}>
              <div className={styles.goalieHeader}>
                <div className={styles.goalieName}>Home Starter</div>
                <div className={`${styles.goalieStatus} ${styles.unconfirmed}`}>Expected</div>
              </div>
              <div className={styles.statGrid}>
                <div className={styles.statBox}>
                  <span className={styles.statLabel}>SV%</span>
                  <span className={styles.statValue}>.000</span>
                </div>
                <div className={styles.statBox}>
                  <span className={styles.statLabel}>GAA</span>
                  <span className={styles.statValue}>0.00</span>
                </div>
                <div className={styles.statBox}>
                  <span className={styles.statLabel}>GSAx</span>
                  <span className={styles.statValue}>0.0</span>
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
          <div className={styles.strengthRow}>
            <div className={styles.strengthLabels}>
              <span className={styles.strengthValueAway}>{awayStats.goalsForPerGamePlayed.toFixed(2)}</span>
              <span>Goals / 60</span>
              <span className={styles.strengthValueHome}>{homeStats.goalsForPerGamePlayed.toFixed(2)}</span>
            </div>
            <div className={styles.strengthBarWrap}>
              <div className={styles.strengthFillAway} style={{ width: `${goalsBars.away}%` }}></div>
              <div className={styles.strengthFillHome} style={{ width: `${goalsBars.home}%` }}></div>
            </div>
          </div>
          <div className={styles.strengthRow}>
            <div className={styles.strengthLabels}>
              <span className={styles.strengthValueAway}>{(awayStats.ppPctg * 100).toFixed(1)}%</span>
              <span>PP% vs PK%</span>
              <span className={styles.strengthValueHome}>{(homeStats.pkPctg * 100).toFixed(1)}%</span>
            </div>
            <div className={styles.strengthBarWrap}>
              <div className={styles.strengthFillAway} style={{ width: `${specialTeamsBars.away}%` }}></div>
              <div className={styles.strengthFillHome} style={{ width: `${specialTeamsBars.home}%` }}></div>
            </div>
          </div>
          <div className={styles.strengthRow}>
            <div className={styles.strengthLabels}>
              <span className={styles.strengthValueAway}>{(awayStats.pkPctg * 100).toFixed(1)}%</span>
              <span>PK% vs PP%</span>
              <span className={styles.strengthValueHome}>{(homeStats.ppPctg * 100).toFixed(1)}%</span>
            </div>
            <div className={styles.strengthBarWrap}>
              <div className={styles.strengthFillAway} style={{ width: `${specialTeamsBars.home}%` }}></div>
              <div className={styles.strengthFillHome} style={{ width: `${specialTeamsBars.away}%` }}></div>
            </div>
          </div>
        </div>
      </section>

      {/* Projected Lines */}
      <section className={`${styles.dataPanel} ${styles.panelLines}`}>
        <div className={styles.panelHeader}>
          <h3>5v5 Line Matchups</h3>
        </div>
        <div className={styles.panelBody}>
          <table className={styles.linesTable}>
            <thead>
              <tr>
                <th>{awayTeam.abbrev} Line</th>
                <th>Matchup</th>
                <th>{homeTeam.abbrev} Line</th>
              </tr>
            </thead>
            <tbody>
              <tr>
                <td><span className={styles.xgValue}>-</span></td>
                <td className={styles.lineMatchup}>L1 v L1</td>
                <td><span className={styles.xgValue}>-</span></td>
              </tr>
              <tr>
                <td><span className={styles.xgValue}>-</span></td>
                <td className={styles.lineMatchup}>L2 v L2</td>
                <td><span className={styles.xgValue}>-</span></td>
              </tr>
              <tr>
                <td><span className={styles.xgValue}>-</span></td>
                <td className={styles.lineMatchup}>L3 v L3</td>
                <td><span className={styles.xgValue}>-</span></td>
              </tr>
            </tbody>
          </table>
        </div>
      </section>

      {/* Hot Players */}
      <section className={`${styles.dataPanel} ${styles.panelTrends}`}>
        <div className={styles.panelHeader}>
          <h3>Player Trends</h3>
        </div>
        <div className={styles.panelBody}>
          <div className={styles.playerList}>
            <div className={styles.placeholderText} style={{ padding: "1rem 0" }}>
              Fetching player trends from FHFH Database...
            </div>
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
            {rightRail?.seasonSeries?.map((game: any) => {
              const isCompleted = game.gameState === "OFF" || game.gameState === "FINAL";
              if (!isCompleted) return null;
              
              const aTeam = game.awayTeam;
              const hTeam = game.homeTeam;
              const winner = aTeam.score > hTeam.score ? aTeam : hTeam;
              const isHomeWin = winner.id === hTeam.id;

              return (
                <div className={styles.h2hCard} key={game.id}>
                  <div className={styles.h2hDate}>
                    {new Date(game.gameDate).toLocaleDateString([], { month: 'short', day: 'numeric', year: 'numeric' })}
                  </div>
                  <div className={styles.h2hScore}>
                    {aTeam.abbrev} {aTeam.score} - {hTeam.score} {hTeam.abbrev}
                  </div>
                  <div className={isHomeWin ? styles.h2hWinnerHome : styles.h2hWinnerAway}>
                    {winner.abbrev} Win
                  </div>
                </div>
              );
            })}
            {(!rightRail?.seasonSeries || !rightRail.seasonSeries.some((g: any) => g.gameState === "OFF" || g.gameState === "FINAL")) && (
              <div className={styles.placeholderText} style={{ padding: "0.5rem", width: "100%" }}>
                First meeting of the season.
              </div>
            )}
          </div>
        </div>
      </section>

    </div>
  );
}
