// @ts-nocheck
import type { NextPage } from "next";
import Head from "next/head";
import { NextSeo } from "next-seo";
import { useEffect, useMemo, useState } from "react";
import moment from "moment";
import Link from "next/link";
import axios from "axios";

import Banner from "../components/Banner";
import SocialMedias from "components/SocialMedias";
import Container from "components/Layout/Container";
import styles from "../styles/Home.module.scss";

import { teamsInfo } from "lib/NHL/teamsInfo";

const Home: NextPage = () => {
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
      <Homepage />
    </Container>
  );
};

const Homepage = () => {
  const [injuries, setInjuries] = useState([]);
  const [games, setGames] = useState([]);
  const [teams, setTeams] = useState({});
  const [standings, setStandings] = useState([]);

  /////////// GAMES SECTION ////////////////////////////////////////////////////////////////////////////////////////////////////

  useEffect(() => {
    const fetchGames = async () => {
      try {
        const today = moment().format("YYYY-MM-DD"); // Get today's date in the desired format
        const response = await axios.get(
          `https://statsapi.web.nhl.com/api/v1/schedule?site=en_nhl&startDate=${today}&endDate=${today}`
        );
        const gamesData = response.data.dates[0]?.games || []; // Using optional chaining and fallback to an empty array
        setGames(gamesData);
      } catch (error) {
        console.error("Error fetching games: ", error);
      }
    };

    const fetchTeams = async () => {
      const response = await axios.get(
        "https://statsapi.web.nhl.com/api/v1/teams"
      );
      const teamsData = response.data.teams.reduce(
        (acc, team) => ({ ...acc, [team.id]: team.abbreviation }),
        {}
      );
      setTeams(teamsData);
    };

    fetchGames();
    fetchTeams();
  }, []);

  /////////// INJURIES SECTION /////////////////////////////////////////////////////////////////////////////////////////////////

  const [injuryPage, setInjuryPage] = useState(0);
  const injuryRowsPerPage = 25;

  useEffect(() => {
    const fetchInjuries = async () => {
      try {
        const response = await axios.get(
          `https://stats.sports.bellmedia.ca/sports/hockey/leagues/nhl/playerInjuries?brand=tsn&type=json`
        );
        if (response.status !== 200) throw new Error("Failed to fetch");

        let injuriesData = response.data.flatMap((team) =>
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

        setInjuries(injuriesData || []);
      } catch (error) {
        console.error(error);
      }
    };
    fetchInjuries();
  }, [injuryPage]);

  const currentPageInjuries = useMemo(() => {
    return injuries.slice(
      injuryPage * injuryRowsPerPage,
      (injuryPage + 1) * injuryRowsPerPage
    );
  }, [injuries, injuryPage]);

  const displayRows = currentPageInjuries.map((injury, idx) => (
    <tr
      key={injury.player.id}
      className={idx % 2 === 0 ? "row-even" : "row-odd"}
    >
      <td className="date-column">{injury.date}</td>
      <td className="team-column">{injury.team}</td>
      <td className="name-column">{injury.player.displayName}</td>
      <td className="status-column">{injury.status}</td>
      <td className="description-column">{injury.description}</td>
    </tr>
  ));

  /////////// STANDINGS SECTION /////////////////////////////////////////////////////////////////////////////////////////////////

  useEffect(() => {
    const fetchStandings = async () => {
      try {
        const response = await axios.get(
          "https://statsapi.web.nhl.com/api/v1/standings.record.overall?&season=20232024&site=en_nhl"
        );
        if (response.status !== 200) throw new Error("Failed to fetch");
        const standingsData = response.data.records.flatMap(
          (record) => record.teamRecords
        );
        setStandings(standingsData);
      } catch (error) {
        console.error(error);
      }
    };
    fetchStandings();
  }, []);

  const [sortConfig, setSortConfig] = useState({
    key: "gamesPlayed",
    direction: "ascending",
  });

  const sortDataBy = (key) => {
    let direction = "ascending";
    if (sortConfig.key === key && sortConfig.direction === "ascending") {
      direction = "descending";
    }

    const sortedData = [...standings].sort((a, b) => {
      let aValue = key.split(".").reduce((obj, key) => obj[key], a);
      let bValue = key.split(".").reduce((obj, key) => obj[key], b);

      // Convert to number if key is 'leagueL10Rank'
      if (key === "leagueL10Rank") {
        aValue = parseInt(aValue, 10);
        bValue = parseInt(bValue, 10);
      }

      if (aValue < bValue) {
        return direction === "ascending" ? -1 : 1;
      }
      if (aValue > bValue) {
        return direction === "ascending" ? 1 : -1;
      }
      return 0;
    });

    setStandings(sortedData);
    setSortConfig({ key, direction });
  };

  /////////// JSX //////////////////////////////////////////////////////////////////////////////////////////////////////////////////

  return (
    <div className="homepage">
      <div className="clGames">
        <div className="gamesHeader">
          <h1>Today's Games</h1>
        </div>
        <div className="gamesContainer">
          {games.map((game) => {
            const homeTeamAbbr = teams[game.teams.home.team.id];
            const homeTeamInfo = teamsInfo[homeTeamAbbr] || {};
            const awayTeamAbbr = teams[game.teams.away.team.id];
            const awayTeamInfo = teamsInfo[awayTeamAbbr] || {};
            return (
              <Link
                key={game.gamePk + "-container"}
                href={`/game/${game.gamePk}`}
              >
                <a className="gameLink">
                  <div
                    className="gameCard"
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
                    <div className="homeTeamLogo">
                      <img
                        src={`https://assets.nhle.com/logos/nhl/svg/${homeTeamAbbr}_light.svg`}
                        className="left-image"
                        alt={`${homeTeamAbbr} logo`}
                      />
                    </div>
                    <span className="vs">VS</span>
                    <div className="awayTeamLogo">
                      <img
                        src={`https://assets.nhle.com/logos/nhl/svg/${awayTeamAbbr}_light.svg`}
                        className="right-image"
                        alt={`${teams[game.teams.away.team.id]} logo`}
                      />
                    </div>
                  </div>
                  <div
                    className="gameTimeCard"
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
                    <div className="column homeScore">
                      {game.teams.home.score}
                    </div>
                    <div className="column gameTime">
                      <span className="gameTimeText">
                        {moment(game.gameDate).format("h:mm A")}
                        <br />
                      </span>
                      <span className="gameDetailedState">
                        {game.status.detailedState}
                      </span>
                    </div>
                    <div className="column awayScore">
                      {game.teams.away.score}
                    </div>
                  </div>
                </a>
              </Link>
            );
          })}
        </div>
      </div>
      <div className="separator"></div>

      <div className="standingsInjuriesContainer">
        <div className="ccStandings">
          <div className="standingsHeader">
            <h1>Standings</h1>
          </div>
          <table className="standingsTable">
            <thead className="standingsTableHeader">
              <tr>
                <th onClick={() => sortDataBy("team.name")}>Team</th>
                <th onClick={() => sortDataBy("gamesPlayed")}>GP</th>
                <th onClick={() => sortDataBy("leagueRecord.wins")}>W</th>
                <th onClick={() => sortDataBy("leagueRecord.losses")}>L</th>
                <th onClick={() => sortDataBy("leagueRecord.ot")}>O</th>
                <th onClick={() => sortDataBy("points")}>PTS</th>
                <th onClick={() => sortDataBy("pointsPercentage")}>PT%</th>
                <th onClick={() => sortDataBy("leagueL10Rank")}>L10</th>
              </tr>
            </thead>
            <tbody>
              {standings.map((teamRecord) => (
                <tr key={teamRecord.team.id}>
                  <td>
                    <img
                      src={`https://assets.nhle.com/logos/nhl/svg/${
                        teams[teamRecord.team.id]
                      }_light.svg`}
                      className="standingsTeamLogo"
                      alt={`${teamRecord.team.name} logo`}
                    />
                    {teamRecord.team.name}
                  </td>
                  <td>{teamRecord.gamesPlayed}</td>
                  <td>{teamRecord.leagueRecord.wins}</td>
                  <td>{teamRecord.leagueRecord.losses}</td>
                  <td>{teamRecord.leagueRecord.ot}</td>
                  <td>{teamRecord.points}</td>
                  <td>{teamRecord.pointsPercentage.toFixed(3)}</td>
                  <td>{teamRecord.leagueL10Rank}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        <div className="crInjuries">
          <div className="injuriesHeader">
            <h1>Injury Updates</h1>
          </div>

          <table className="injuryTable">
            <thead className="injuryTableHeader">
              <tr>
                <th className="date-column">Date</th>
                <th>Team</th>
                <th className="name-column">Player</th>
                <th>Status</th>
                <th>Description</th>
              </tr>
            </thead>
            <tbody>{displayRows}</tbody>
          </table>

          <div className="pagination">
            <button
              onClick={() => setInjuryPage((prev) => Math.max(prev - 1, 0))}
              disabled={injuryPage === 0}
            >
              Previous
            </button>
            <button
              onClick={() => setInjuryPage((prev) => prev + 1)}
              disabled={injuries.length <= (injuryPage + 1) * injuryRowsPerPage}
            >
              Next
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default Home;
