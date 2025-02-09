///////////////////////////////////////////////////////////////////////////////////////////////
// C:\Users\timbr\OneDrive\Desktop\fhfhockey.com-3\web\pages\index.tsx

// @ts-nocheck
import type { NextPage } from "next";
import Head from "next/head";
import { NextSeo } from "next-seo";
import { useMemo, useState, useEffect } from "react";
import moment from "moment";
import Link from "next/link";

import Banner from "../components/Banner";
import SocialMedias from "components/SocialMedias";
import Container from "components/Layout/Container";
import ClientOnly from "components/ClientOnly";
import styles from "../styles/Home.module.scss";

import { teamsInfo } from "lib/NHL/teamsInfo";
import { fetchCurrentSeason } from "utils/fetchCurrentSeason";
import Fetch from "lib/cors-fetch";

// Import our chart component
import TeamStandingsChart from "components/TeamStandingsChart/TeamStandingsChart";

// DEV NOTE:
// Integrate Live Period/Time Clock instead of just displaying "LIVE" for live games

const Home: NextPage = ({
  initialGames,
  initialInjuries,
  initialStandings,
  nextGameDate
}) => {
  const [currentDate, setCurrentDate] = useState(
    moment().utcOffset(-8).format("YYYY-MM-DD")
  );
  const [games, setGames] = useState(initialGames);
  const [injuries, setInjuries] = useState(initialInjuries);
  const [standings, setStandings] = useState(initialStandings);
  const [injuryPage, setInjuryPage] = useState(0);
  const injuryRowsPerPage = 32;

  const [isOffseason, setIsOffseason] = useState(false);
  const [nextAvailableGames, setNextAvailableGames] = useState([]); // fetching games if none today

  useEffect(() => {
    const checkSeason = async () => {
      const currentSeason = await fetchCurrentSeason();
      const now = new Date();

      const isPlayoffs =
        now >= new Date(currentSeason.playoffsStartDate) &&
        now <= new Date(currentSeason.playoffsEndDate);
      const isRegularSeason =
        now >= new Date(currentSeason.startDate) &&
        now <= new Date(currentSeason.endDate);

      setIsOffseason(!isPlayoffs && !isRegularSeason);
    };

    checkSeason();
  }, []);

  // useEffect(() => {
  //   const fetchStandings = async () => {
  //     try {
  //       const response = await Fetch(
  //         `https://api-web.nhle.com/v1/standings/2024-10-04`
  //       );
  //       const data = await response.json();
  //       console.log({ standings: data }); // Debug: Log data to check the response format

  //       if (!data || !data.standings) {
  //         throw new Error("Invalid standings data");
  //       }

  //       setStandings(data.standings);
  //     } catch (error) {
  //       console.error("Error fetching standings:", error);
  //     }
  //   };

  //   fetchStandings();
  // }, []);

  useEffect(() => {
    const fetchGames = async () => {
      const res = await fetch(`/api/v1/games?date=${currentDate}`);
      const data = await res.json();

      // If no games are scheduled for today, fetch the next day's games
      if (data.length === 0 && isOffseason) {
        let nextDayWithGames = null;
        let nextDay = moment(currentDate).add(1, "days");

        while (!nextDayWithGames) {
          const res = await fetch(
            `/api/v1/games?date=${nextDay.format("YYYY-MM-DD")}`
          );
          const dayData = await res.json();

          if (dayData.length > 0) {
            nextDayWithGames = dayData;
            setNextAvailableGames(dayData);
          } else {
            nextDay = nextDay.add(1, "days");
          }
        }
      } else {
        // Fetch period and time remaining for LIVE games
        const liveGamePromises = data
          .filter((game) => game.gameState === "LIVE")
          .map(async (game) => {
            const liveDataResponse = await Fetch(
              `https://api-web.nhle.com/v1/gamecenter/${game.id}/landing`
            );
            const liveData = await liveDataResponse.json();

            return {
              ...game,
              period: liveData.periodDescriptor.number,
              periodType: liveData.periodDescriptor.periodType,
              timeRemaining: liveData.clock.timeRemaining,
              inIntermission: liveData.clock.inIntermission
            };
          });

        const liveGamesData = await Promise.all(liveGamePromises);

        // Combine live games data with other games data
        const updatedGames = data.map((game) => {
          const liveGameData = liveGamesData.find(
            (liveGame) => liveGame.id === game.id
          );
          return liveGameData || game;
        });

        setGames(updatedGames);
      }
    };

    fetchGames();
  }, [currentDate, isOffseason]);

  const changeDate = async (days) => {
    const newDate = moment(currentDate).add(days, "days").format("YYYY-MM-DD");
    setCurrentDate(newDate);
  };

  const formatPeriodText = (periodNumber, periodDescriptor, inIntermission) => {
    if (inIntermission) {
      return "Intermission";
    } else if (periodDescriptor === "OT") {
      return "Overtime";
    } else {
      const periodSuffix =
        {
          "1": "st",
          "2": "nd",
          "3": "rd"
        }[periodNumber] || "th"; // Default to 'th' for any other cases

      return `${periodNumber}${periodSuffix} Period`;
    }
  };

  const currentPageInjuries = useMemo(() => {
    // Check if 'injuries' is defined and is an array
    if (Array.isArray(injuries)) {
      return injuries.slice(
        injuryPage * injuryRowsPerPage,
        (injuryPage + 1) * injuryRowsPerPage
      );
    }
    return []; // Return an empty array if 'injuries' is not defined
  }, [injuries, injuryPage]);

  const displayRows = currentPageInjuries.map((injury, idx) => (
    <tr
      key={injury.player.id}
      className={idx % 2 === 0 ? styles.rowEven : styles.rowOdd}
    >
      <td className={styles.dateColumn}>{injury.date}</td>
      <td className={styles.teamColumn}>{injury.team}</td>
      <td className={styles.nameColumn}>{injury.player.displayName}</td>
      <td className={styles.statusColumn}>{injury.status}</td>
      <td className={styles.descriptionColumn}>{injury.description}</td>
    </tr>
  ));

  const [sortConfig, setSortConfig] = useState({
    key: "leagueSequence",
    direction: "ascending"
  });

  const sortedStandings = useMemo(() => {
    return [...standings].sort((a, b) => {
      let aValue = a[sortConfig.key];
      let bValue = b[sortConfig.key];

      if (sortConfig.key === "leagueSequence") {
        aValue = parseInt(aValue, 10);
        bValue = parseInt(bValue, 10);
      }

      if (aValue < bValue) {
        return sortConfig.direction === "ascending" ? -1 : 1;
      }
      if (aValue > bValue) {
        return sortConfig.direction === "ascending" ? 1 : -1;
      }
      return 0;
    });
  }, [standings, sortConfig]);

  const sortDataBy = (key) => {
    let direction = "ascending";
    if (sortConfig.key === key && sortConfig.direction === "ascending") {
      direction = "descending";
    }
    setSortConfig({ key, direction });
  };

  const getDisplayGameState = (gameState) => {
    const gameStateMapping = {
      FUT: "Scheduled",
      PRE: "Pregame",
      OVER: "Final",
      FINAL: "Final",
      OFF: "Final",
      LIVE: "LIVE",
      CRIT: "Critical"
    };

    return gameStateMapping[gameState] || gameState;
  };

  return (
    (<Container className={styles.container}>
      <NextSeo
        title="FHFH | Home"
        description="Five Hole Fantasy Hockey Podcast Home page."
        openGraph={{
          images: [
            {
              url: `${process.env.NEXT_PUBLIC_SITE_URL}/pictures/circle.png`,
              alt: "logo"
            }
          ]
        }}
      />
      <Head>
        <meta
          name="google-site-verification"
          content="ilj1AkBDPlpfcKH8A0zBJUdKtcUjE8TKIyCLa6buHxk"
        />
      </Head>
      <Banner className={styles.socialMedia}>
        <SocialMedias />
      </Banner>
      <div className={styles.homepage}>
        <div className={styles.clGames}>
          <div className={styles.gamesHeader}>
            <button onClick={() => changeDate(-1)}>&lt;</button>

            <div className={styles.headerAndDate}>
              <h1>
                {games.length > 0 || !isOffseason ? "Today's" : "Upcoming"}{" "}
                <span>Games</span>
              </h1>
              <p className={styles.dateDisplay}>
                Scheduled for: {moment(nextGameDate).format("MM/DD/YYYY")}
              </p>
            </div>
            <button onClick={() => changeDate(1)}>&gt;</button>
          </div>

          <div className={styles.gamesContainer}>
            {games.length > 0
              ? games.map((game) => {
                  const homeTeam = game.homeTeam;
                  const homeTeamInfo = teamsInfo[homeTeam.abbrev] || {};
                  const awayTeam = game.awayTeam;
                  const awayTeamInfo = teamsInfo[awayTeam.abbrev] || {};

                  if (!homeTeam || !awayTeam) {
                    return null;
                  }

                  return (
                    (<Link key={game.id} href={`/game/${game.id}`} className={styles.gameLink}>

                      <div
                        className={styles.combinedGameCard}
                        style={{
                          "--home-primary-color": homeTeamInfo.primaryColor,
                          "--home-secondary-color":
                            homeTeamInfo.secondaryColor,
                          "--home-jersey-color": homeTeamInfo.jersey,
                          "--home-accent-color": homeTeamInfo.accent,
                          "--home-alt-color": homeTeamInfo.alt,
                          "--away-primary-color": awayTeamInfo.primaryColor,
                          "--away-secondary-color":
                            awayTeamInfo.secondaryColor,
                          "--away-jersey-color": awayTeamInfo.jersey,
                          "--away-accent-color": awayTeamInfo.accent,
                          "--away-alt-color": awayTeamInfo.alt
                        }}
                      >
                        <div className={styles.homeTeamLogo}>
                          <img
                            src={`https://assets.nhle.com/logos/nhl/svg/${homeTeam.abbrev}_light.svg`}
                            className={styles.leftImage}
                            alt={`${homeTeam.abbrev} logo`}
                          />
                        </div>
                        <div className={styles.gameTimeSection}>
                          <div className={styles.homeScore}>
                            {homeTeam.score}
                          </div>
                          <div className={styles.gameTimeInfo}>
                            <span className={styles.gameState}>
                              {game.gameState === "LIVE"
                                ? formatPeriodText(
                                    game.periodDescriptor.number,
                                    game.periodDescriptor.periodType,
                                    game.inIntermission
                                  )
                                : getDisplayGameState(game.gameState)}
                            </span>
                            <span className={styles.gameTimeText}>
                              {game.gameState === "LIVE" &&
                              !game.inIntermission ? (
                                game.timeRemaining
                              ) : (
                                <ClientOnly placeHolder={<>&nbsp;</>}>
                                  {moment(game.startTimeUTC).format("h:mm A")}
                                </ClientOnly>
                              )}
                            </span>
                          </div>
                          <div className={styles.awayScore}>
                            {awayTeam.score}
                          </div>
                        </div>

                        <div className={styles.awayTeamLogo}>
                          <img
                            src={`https://assets.nhle.com/logos/nhl/svg/${awayTeam.abbrev}_light.svg`}
                            className={styles.rightImage}
                            alt={`${awayTeam.abbrev} logo`}
                          />
                        </div>
                      </div>

                    </Link>)
                  );
                })
              : nextAvailableGames.map((game) => {
                  const homeTeam = game.homeTeam;
                  const homeTeamInfo = teamsInfo[homeTeam.abbrev] || {};
                  const awayTeam = game.awayTeam;
                  const awayTeamInfo = teamsInfo[awayTeam.abbrev] || {};

                  if (!homeTeam || !awayTeam) {
                    return null;
                  }

                  return (
                    (<Link key={game.id} href={`/game/${game.id}`} className={styles.gameLink}>

                      <div
                        className={styles.combinedGameCard}
                        style={{
                          "--home-primary-color": homeTeamInfo.primaryColor,
                          "--home-secondary-color":
                            homeTeamInfo.secondaryColor,
                          "--home-jersey-color": homeTeamInfo.jersey,
                          "--home-accent-color": homeTeamInfo.accent,
                          "--home-alt-color": homeTeamInfo.alt,
                          "--away-primary-color": awayTeamInfo.primaryColor,
                          "--away-secondary-color":
                            awayTeamInfo.secondaryColor,
                          "--away-jersey-color": awayTeamInfo.jersey,
                          "--away-accent-color": awayTeamInfo.accent,
                          "--away-alt-color": awayTeamInfo.alt
                        }}
                      >
                        <div className={styles.homeTeamLogo}>
                          <img
                            src={`https://assets.nhle.com/logos/nhl/svg/${homeTeam.abbrev}_light.svg`}
                            className={styles.leftImage}
                            alt={`${homeTeam.abbrev} logo`}
                          />
                        </div>
                        <div className={styles.gameTimeSection}>
                          <div className={styles.homeScore}>
                            {homeTeam.score}
                          </div>
                          <div className={styles.gameTimeInfo}>
                            <span className={styles.gameState}>
                              {game.gameState === "LIVE"
                                ? formatPeriodText(
                                    game.periodDescriptor.number,
                                    game.periodDescriptor.periodType,
                                    game.inIntermission
                                  )
                                : getDisplayGameState(game.gameState)}
                            </span>
                            <span className={styles.gameTimeText}>
                              {game.gameState === "LIVE" &&
                              !game.inIntermission ? (
                                game.timeRemaining
                              ) : (
                                <ClientOnly placeHolder={<>&nbsp;</>}>
                                  {moment(game.startTimeUTC).format("h:mm A")}
                                </ClientOnly>
                              )}
                            </span>
                          </div>
                          <div className={styles.awayScore}>
                            {awayTeam.score}
                          </div>
                        </div>

                        <div className={styles.awayTeamLogo}>
                          <img
                            src={`https://assets.nhle.com/logos/nhl/svg/${awayTeam.abbrev}_light.svg`}
                            className={styles.rightImage}
                            alt={`${awayTeam.abbrev} logo`}
                          />
                        </div>
                      </div>

                    </Link>)
                  );
                })}
          </div>
        </div>
        <div className={styles.separator}></div>

        {/* Our new chart, spanning 100% width */}
        <TeamStandingsChart />

        <div className={styles.standingsInjuriesContainer}>
          <div className={styles.ccStandings}>
            <div className={styles.standingsHeader}>
              <h1>
                Current <span>Standings</span>
              </h1>
            </div>
            <table className={styles.standingsTable}>
              <thead className={styles.standingsTableHeader}>
                <tr>
                  <th>Rank</th>
                  <th>Team</th>
                  <th>Record</th>
                  <th>Points</th>
                </tr>
              </thead>
              <tbody>
                {standings.map((teamRecord) => (
                  <tr key={teamRecord.teamName}>
                    <td className={styles.standingsRankCell}>
                      {teamRecord.leagueSequence}
                    </td>
                    <td className={styles.standingsTeamNameCell}>
                      {/* Add team logo */}
                      <img
                        className={styles.standingsTeamLogo}
                        src={teamRecord.teamLogo}
                        alt={`${teamRecord.teamName} logo`}
                      />{" "}
                      <span className={styles.standingsTeamNameSpan}>
                        {teamRecord.teamName}
                      </span>
                    </td>
                    <td className={styles.standingsRecordCell}>
                      {/* Ensure wins, losses, and otLosses are handled correctly */}
                      {`${teamRecord.wins || 0}-${teamRecord.losses || 0}-${
                        teamRecord.otLosses || 0
                      }`}
                    </td>
                    <td className={styles.standingsPointsCell}>
                      {teamRecord.points}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <div className={styles.crInjuries}>
            <div className={styles.injuriesHeader}>
              <h1>
                Injury <span>Updates</span>
              </h1>
            </div>

            <table className={styles.injuryTable}>
              <thead className={styles.injuryTableHeader}>
                <tr>
                  <th className={styles.dateColumn}>Date</th>
                  <th>Team</th>
                  <th className={styles.nameColumn}>Player</th>
                  <th>Status</th>
                  <th>Description</th>
                </tr>
              </thead>
              <tbody>{displayRows}</tbody>
            </table>

            <div className={styles.pagination}>
              <button
                onClick={() => setInjuryPage((prev) => Math.max(prev - 1, 0))}
                disabled={injuryPage === 0}
              >
                Previous
              </button>
              <button
                onClick={() => setInjuryPage((prev) => prev + 1)}
                disabled={
                  injuries.length <= (injuryPage + 1) * injuryRowsPerPage
                }
              >
                Next
              </button>
            </div>
          </div>
        </div>
      </div>
    </Container>)
  );
};

export async function getServerSideProps({ req, res }) {
  res.setHeader(
    "Cache-Control",
    "public, s-maxage=10, stale-while-revalidate=59"
  );

  const fetchGames = async (date: string) => {
    try {
      const scheduleUrl = `https://api-web.nhle.com/v1/schedule/${date}`;
      const response = await Fetch(scheduleUrl).then((res) => res.json());

      // Ensure you check if the structure includes gameWeek and games
      return response?.gameWeek?.[0]?.games || [];
    } catch (error) {
      console.error("Error fetching games: ", error);
      return [];
    }
  };

  const fetchInjuries = async () => {
    try {
      const response = await Fetch(
        `https://stats.sports.bellmedia.ca/sports/hockey/leagues/nhl/playerInjuries?brand=tsn&type=json`
      ).then((res) => res.json());

      let injuriesData = response.flatMap((team) =>
        team.playerInjuries
          ? team.playerInjuries.map((injury) => ({
              ...injury,
              team: team.competitor.shortName
            }))
          : []
      );

      // Sort injuriesData by date, most recent first
      injuriesData = injuriesData.sort((a, b) =>
        moment(b.date).diff(moment(a.date))
      );

      return injuriesData || [];
    } catch (error) {
      console.error(error);
      return [];
    }
  };

  const fetchStandings = async () => {
    try {
      const currentSeason = await fetchCurrentSeason();
      const now = new Date();

      const isPlayoffs =
        now >= new Date(currentSeason.playoffsStartDate) &&
        now <= new Date(currentSeason.playoffsEndDate);
      const isRegularSeason =
        now >= new Date(currentSeason.startDate) &&
        now <= new Date(currentSeason.endDate);

      const isOffseason = !isPlayoffs && !isRegularSeason;
      const dateForStandings = isOffseason
        ? moment(currentSeason.regularSeasonStartDate).format("YYYY-MM-DD")
        : moment().utcOffset(-8).format("YYYY-MM-DD");

      const response = await Fetch(
        `https://api-web.nhle.com/v1/standings/${dateForStandings}`
      ).then((res) => res.json());

      if (!response || !response.standings) {
        throw new Error("Standings data not available");
      }

      const standingsData = response.standings.map((team: any) => ({
        leagueSequence: team.leagueSequence,
        teamName: team.teamName.default,
        wins: team.wins,
        losses: team.losses,
        otLosses: team.otLosses,
        points: team.points,
        teamLogo: `https://assets.nhle.com/logos/nhl/svg/${team.teamAbbrev.default}_light.svg` // Adjust based on actual data
      }));

      return standingsData;
    } catch (error) {
      console.error("Error fetching standings: ", error);
      return [];
    }
  };

  const today = moment().utcOffset(-8).format("YYYY-MM-DD");
  const gamesToday = await fetchGames(today);
  const injuries = await fetchInjuries();
  const standings = await fetchStandings();

  // Function to find the next available game date after a given date
  const findNextGameDate = async (startDate: string): Promise<string> => {
    let nextDay = moment(startDate).add(1, "days").format("YYYY-MM-DD");
    while (true) {
      const games = await fetchGames(nextDay);
      if (games.length > 0) {
        return nextDay;
      }
      nextDay = moment(nextDay).add(1, "days").format("YYYY-MM-DD");
    }
  };

  const nextGameDate = await findNextGameDate(today);

  return {
    props: {
      initialGames: gamesToday,
      initialInjuries: injuries,
      initialStandings: standings,
      nextGameDate // Pass the next game date to the component
    }
  };
}

export default Home;
