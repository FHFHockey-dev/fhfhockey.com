import Head from "next/head";
import { useRouter } from "next/router";
import styles from "./[gameId].module.scss";
import PlayerSearchBar from "components/StatsPage/PlayerSearchBar";

export default function GameStatsPage() {
  const router = useRouter();
  const { gameId } = router.query;

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
                <span className={styles.teamEyebrow}>Away (18-12-4)</span>
                <div className={styles.teamName}>Lightning</div>
                <div className={styles.teamRecord}>1st Atlantic</div>
             </div>
             <div className={styles.gameInfo}>
                <div className={styles.gameStatus}>Scheduled</div>
                <div className={styles.gameTime}>7:00 PM EST</div>
                <div className={styles.venue}>Amalie Arena</div>
             </div>
             <div className={styles.teamHome}>
                <span className={styles.teamEyebrow}>Home (22-9-2)</span>
                <div className={styles.teamName}>Panthers</div>
                <div className={styles.teamRecord}>2nd Atlantic</div>
             </div>
          </header>

          {/* Bento Grid */}
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
                      <span className={styles.probAway}>TBL 42%</span>
                      <span className={styles.probHome}>FLA 58%</span>
                    </div>
                    <div className={styles.probBar}>
                      <div className={styles.probFillAway} style={{ width: "42%" }}></div>
                      <div className={styles.probFillHome} style={{ width: "58%" }}></div>
                    </div>
                    <div className={styles.probLabels} style={{ color: "rgba(255,255,255,0.5)", marginTop: "0.25rem" }}>
                      <span>Proj: 2.8</span>
                      <span>Proj: 3.4</span>
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
                      <div className={styles.goalieName}>A. Vasilevskiy</div>
                      <div className={`${styles.goalieStatus} ${styles.confirmed}`}>Confirmed</div>
                    </div>
                    <div className={styles.statGrid}>
                      <div className={styles.statBox}>
                        <span className={styles.statLabel}>SV%</span>
                        <span className={`${styles.statValue} ${styles.good}`}>.918</span>
                      </div>
                      <div className={styles.statBox}>
                        <span className={styles.statLabel}>GAA</span>
                        <span className={styles.statValue}>2.45</span>
                      </div>
                      <div className={styles.statBox}>
                        <span className={styles.statLabel}>GSAx</span>
                        <span className={`${styles.statValue} ${styles.good}`}>+8.4</span>
                      </div>
                    </div>
                  </div>

                  {/* Home Goalie */}
                  <div className={`${styles.goalieCard} ${styles.home}`}>
                    <div className={styles.goalieHeader}>
                      <div className={styles.goalieName}>S. Bobrovsky</div>
                      <div className={`${styles.goalieStatus} ${styles.unconfirmed}`}>Expected</div>
                    </div>
                    <div className={styles.statGrid}>
                      <div className={styles.statBox}>
                        <span className={styles.statLabel}>SV%</span>
                        <span className={styles.statValue}>.908</span>
                      </div>
                      <div className={styles.statBox}>
                        <span className={styles.statLabel}>GAA</span>
                        <span className={styles.statValue}>2.81</span>
                      </div>
                      <div className={styles.statBox}>
                        <span className={styles.statLabel}>GSAx</span>
                        <span className={`${styles.statValue} ${styles.bad}`}>-1.2</span>
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
                    <span className={styles.strengthValueAway}>51.2%</span>
                    <span>5v5 xG%</span>
                    <span className={styles.strengthValueHome}>54.8%</span>
                  </div>
                  <div className={styles.strengthBarWrap}>
                    <div className={styles.strengthFillAway} style={{ width: "48%" }}></div>
                    <div className={styles.strengthFillHome} style={{ width: "52%" }}></div>
                  </div>
                </div>
                <div className={styles.strengthRow}>
                  <div className={styles.strengthLabels}>
                    <span className={styles.strengthValueAway}>26.4%</span>
                    <span>PP% vs PK%</span>
                    <span className={styles.strengthValueHome}>82.1%</span>
                  </div>
                  <div className={styles.strengthBarWrap}>
                    <div className={styles.strengthFillAway} style={{ width: "60%" }}></div>
                    <div className={styles.strengthFillHome} style={{ width: "40%" }}></div>
                  </div>
                </div>
                <div className={styles.strengthRow}>
                  <div className={styles.strengthLabels}>
                    <span className={styles.strengthValueAway}>3.12</span>
                    <span>Goals/60</span>
                    <span className={styles.strengthValueHome}>3.45</span>
                  </div>
                  <div className={styles.strengthBarWrap}>
                    <div className={styles.strengthFillAway} style={{ width: "47%" }}></div>
                    <div className={styles.strengthFillHome} style={{ width: "53%" }}></div>
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
                      <th>TBL Line</th>
                      <th>Matchup</th>
                      <th>FLA Line</th>
                    </tr>
                  </thead>
                  <tbody>
                    <tr>
                      <td>
                        <span className={styles.xgValue}>55.2%</span><br />
                        <span style={{ fontSize: "0.65rem", color: "gray" }}>Stamkos/Point</span>
                      </td>
                      <td className={styles.lineMatchup}>L1 v L1</td>
                      <td>
                        <span className={styles.xgValue}>58.1%</span><br />
                        <span style={{ fontSize: "0.65rem", color: "gray" }}>Barkov/Tkachuk</span>
                      </td>
                    </tr>
                    <tr>
                      <td>
                        <span className={styles.xgValue}>48.4%</span>
                      </td>
                      <td className={styles.lineMatchup}>L2 v L2</td>
                      <td>
                        <span className={styles.xgValue}>51.0%</span>
                      </td>
                    </tr>
                    <tr>
                      <td>
                        <span className={styles.xgValue}>45.1%</span>
                      </td>
                      <td className={styles.lineMatchup}>L3 v L3</td>
                      <td>
                        <span className={styles.xgValue}>53.2%</span>
                      </td>
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
                  <div className={styles.playerItem}>
                    <div className={styles.playerInfo}>
                      <span className={styles.playerPos}>C</span>
                      <span className={styles.playerName}>A. Barkov (FLA)</span>
                    </div>
                    <div className={styles.playerTrend}>
                      🔥 8 PTS (L5)
                    </div>
                  </div>
                  <div className={styles.playerItem}>
                    <div className={styles.playerInfo}>
                      <span className={styles.playerPos}>RW</span>
                      <span className={styles.playerName}>N. Kucherov (TBL)</span>
                    </div>
                    <div className={styles.playerTrend}>
                      🔥 7 PTS (L5)
                    </div>
                  </div>
                  <div className={styles.playerItem}>
                    <div className={styles.playerInfo}>
                      <span className={styles.playerPos}>D</span>
                      <span className={styles.playerName}>A. Ekblad (FLA)</span>
                    </div>
                    <div className={`${styles.playerTrend} ${styles.cold}`}>
                      ❄️ 0 PTS (L5)
                    </div>
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
                  <div className={styles.h2hCard}>
                    <div className={styles.h2hDate}>Oct 12, 2025</div>
                    <div className={styles.h2hScore}>FLA 4 - 2 TBL</div>
                    <div className={styles.h2hWinnerHome}>Panthers Win</div>
                  </div>
                  <div className={styles.h2hCard}>
                    <div className={styles.h2hDate}>Dec 05, 2025</div>
                    <div className={styles.h2hScore}>TBL 3 - 1 FLA</div>
                    <div className={styles.h2hWinnerAway}>Lightning Win</div>
                  </div>
                  <div className={styles.h2hCard}>
                    <div className={styles.h2hDate}>Feb 18, 2026</div>
                    <div className={styles.h2hScore}>FLA 5 - 4 TBL (OT)</div>
                    <div className={styles.h2hWinnerHome}>Panthers Win</div>
                  </div>
                </div>
              </div>
            </section>

          </div>
        </div>
      </div>
    </>
  );
}
