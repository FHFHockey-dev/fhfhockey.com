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
import styles from "../styles/Home.module.scss";

import { teamsInfo } from "lib/NHL/teamsInfo";

const Home: NextPage = ({
  initialGames,
  initialInjuries,
  initialStandings,
}) => {
  const [currentDate, setCurrentDate] = useState(
    moment().utcOffset(-8).format("YYYY-MM-DD")
  );
  const [games, setGames] = useState(initialGames);
  const [injuries, setInjuries] = useState(initialInjuries);
  const [standings, setStandings] = useState(initialStandings);
  const [injuryPage, setInjuryPage] = useState(0);
  const injuryRowsPerPage = 32;

  const changeDate = async (days) => {
    const newDate = moment(currentDate).add(days, "days").format("YYYY-MM-DD");
    setCurrentDate(newDate);
  };

  useEffect(() => {
    const fetchGames = async () => {
      const res = await fetch(`/api/v1/games?date=${currentDate}`);
      const data = await res.json();
      setGames(data);
    };

    fetchGames();
  }, [currentDate]);

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
    direction: "ascending",
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
      LIVE: "In Progress",
      CRIT: "Critical",
    };

    return gameStateMapping[gameState] || gameState;
  };

  return (
    <Container className={styles.container}>
      <NextSeo
        title="FHFH | Home"
        description="Five Hole Fantasy Hockey Podcast Home page."
        openGraph={{
          images: [
            {
              url: `${process.env.NEXT_PUBLIC_SITE_URL}/pictures/circle.png`,
              alt: "logo",
            },
          ],
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
              <h1>Today&apos;s Games</h1>
              <p className={styles.dateDisplay}>
                {moment(currentDate).format("MM/DD/YYYY")}
              </p>
              {/* Formatted date here */}
            </div>
            <button onClick={() => changeDate(1)}>&gt;</button>
          </div>

          <div className={styles.gamesContainer}>
            {games.map((game) => {
              // Extracting home and away team data
              const homeTeam = game.homeTeam;
              console.log("HOME TEAM: ", homeTeam);
              const homeTeamInfo = teamsInfo[homeTeam.abbrev] || {};
              const awayTeam = game.awayTeam;
              const awayTeamInfo = teamsInfo[awayTeam.abbrev] || {};

              // If either team data is missing, skip rendering this game
              if (!homeTeam || !awayTeam) {
                return null;
              }

              return (
                <Link key={game.id} href={`/game/${game.id}`}>
                  <a className={styles.gameLink}>
                    <div
                      className={styles.gameCard}
                      style={{
                        "--home-primary-color": homeTeamInfo.primaryColor,
                        "--home-secondary-color": homeTeamInfo.secondaryColor,
                        "--home-jersey-color": homeTeamInfo.jersey,
                        "--home-accent-color": homeTeamInfo.accent,
                        "--home-alt-color": homeTeamInfo.alt,
                        "--away-primary-color": awayTeamInfo.primaryColor,
                        "--away-secondary-color": awayTeamInfo.secondaryColor,
                        "--away-jersey-color": awayTeamInfo.jersey,
                        "--away-accent-color": awayTeamInfo.accent,
                        "--away-alt-color": awayTeamInfo.alt,
                      }}
                    >
                      <div className={styles.homeTeamLogo}>
                        <img
                          src={`https://assets.nhle.com/logos/nhl/svg/${homeTeam.abbrev}_light.svg`}
                          className={styles.leftImage}
                          alt={`${homeTeam.abbrev} logo`}
                        />
                      </div>
                      <span className={styles.vs}>VS</span>
                      <div className={styles.awayTeamLogo}>
                        <img
                          src={`https://assets.nhle.com/logos/nhl/svg/${awayTeam.abbrev}_light.svg`}
                          className={styles.rightImage}
                          alt={`${awayTeam.abbrev} logo`}
                        />
                      </div>
                    </div>

                    <div
                      className={styles.gameTimeCard}
                      style={{
                        "--home-primary-color": homeTeamInfo.primaryColor,
                        "--home-secondary-color": homeTeamInfo.secondaryColor,
                        "--home-jersey-color": homeTeamInfo.jersey,
                        "--home-accent-color": homeTeamInfo.accent,
                        "--home-alt-color": homeTeamInfo.alt,
                        "--away-primary-color": awayTeamInfo.primaryColor,
                        "--away-secondary-color": awayTeamInfo.secondaryColor,
                        "--away-jersey-color": awayTeamInfo.jersey,
                        "--away-accent-color": awayTeamInfo.accent,
                        "--away-alt-color": awayTeamInfo.alt,
                      }}
                    >
                      <div className={`${styles.column} ${styles.homeScore}`}>
                        {awayTeam.score}
                      </div>
                      <div className={`${styles.column} ${styles.gameTime}`}>
                        <span className={styles.gameState}>
                          {getDisplayGameState(game.gameState)}
                        </span>
                        <span className={styles.gameTimeText}>
                          {moment(game.startTimeUTC).format("h:mm A")}
                        </span>
                      </div>

                      <div className={`${styles.column} ${styles.awayScore}`}>
                        {homeTeam.score}
                      </div>
                    </div>
                  </a>
                </Link>
              );
            })}
          </div>
        </div>
        <div className={styles.separator}></div>

        <div className={styles.standingsInjuriesContainer}>
          <div className={styles.ccStandings}>
            <div className={styles.standingsHeader}>
              <h1>Standings</h1>
            </div>
            <table className={styles.standingsTable}>
              <thead className={styles.standingsTableHeader}>
                <tr>
                  <th onClick={() => sortDataBy("leagueSequence")}>Rank</th>
                  <th onClick={() => sortDataBy("teamName")}>Team</th>
                  <th>Record</th>
                </tr>
              </thead>
              <tbody>
                {standings.map((teamRecord) => (
                  <tr key={teamRecord.teamName}>
                    <td>{teamRecord.leagueSequence}</td>
                    <td>{teamRecord.teamName}</td>
                    <td>{teamRecord.record}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <div className={styles.crInjuries}>
            <div className={styles.injuriesHeader}>
              <h1>Injury Updates</h1>
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
    </Container>
  );
};

export async function getServerSideProps({ req, res }) {
  res.setHeader(
    "Cache-Control",
    "public, s-maxage=10, stale-while-revalidate=59"
  );

  const fetchGames = async (date) => {
    try {
      const scheduleUrl = `https://api-web.nhle.com/v1/schedule/${date}`;
      const response = await fetch(scheduleUrl).then((res) => res.json());
      return response.gameWeek[0].games || [];
    } catch (error) {
      console.error("Error fetching games: ", error);
      return [];
    }
  };

  // Fetch games for today's date
  const today = moment().utcOffset(-8).format("YYYY-MM-DD");
  const games = await fetchGames(today);

  const fetchInjuries = async () => {
    try {
      const response = await fetch(
        `https://stats.sports.bellmedia.ca/sports/hockey/leagues/nhl/playerInjuries?brand=tsn&type=json`
      ).then((res) => res.json());
      // if (response.status !== 200) throw new Error("Failed to fetch");

      let injuriesData = response.flatMap((team) =>
        team.playerInjuries
          ? team.playerInjuries.map((injury) => ({
              ...injury,
              team: team.competitor.shortName,
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
    }
  };

  const fetchStandings = async () => {
    try {
      const today = moment().utcOffset(-8).format("YYYY-MM-DD");
      const response = await fetch(
        `https://api-web.nhle.com/v1/standings/${today}` // Updated API endpoint
      ).then((res) => res.json());
      // if (response.status !== 200) throw new Error("Failed to fetch");

      const standingsData = response.standings.map((team) => ({
        leagueSequence: team.leagueSequence, // League sequence as the standing
        teamName: team.teamName.default, // Team name
        record: `${team.wins}-${team.losses}-${team.otLosses}`, // Record format: Wins-Losses-OT Losses
      }));
      console.log("STANDINGS: ", standingsData);
      return standingsData;
    } catch (error) {
      console.error(error);
    }
  };

  const injuries = (await fetchInjuries()) || []; // Ensure it defaults to an empty array
  const standings = (await fetchStandings()) || [];

  return {
    props: {
      initialGames: games,
      initialInjuries: injuries,
      initialStandings: standings,
    },
  };
}

export default Home;
