// /Users/tim/Desktop/FHFH/fhfhockey.com/web/pages/index.tsx
// @ts-nocheck
import type { NextPage } from "next";
import Head from "next/head";
import { NextSeo } from "next-seo";
import { useMemo, useState, useEffect } from "react";
import OptimizedImage from "components/common/OptimizedImage";
import { getTeamLogoSvg, fallbackNHLLogo } from "lib/images";
import moment from "moment";
import "moment-timezone"; // Import moment-timezone
import Link from "next/link";

import Banner from "../components/Banner";
import SocialMedias from "components/SocialMedias";
import Container from "components/Layout/Container";
import ClientOnly from "components/ClientOnly";
import styles from "../styles/Home.module.scss";

import { teamsInfo } from "lib/teamsInfo";
import { fetchCurrentSeason } from "utils/fetchCurrentSeason";
import { checkIsOffseason } from "../hooks/useOffseason";
import Fetch from "lib/cors-fetch";

// Import our chart component
import TeamStandingsChart from "components/TeamStandingsChart/TeamStandingsChart";
import TransactionTrends from "components/TransactionTrends/TransactionTrends";

// Shared debug logger for both server and client
const debugLog = (...args: any[]) => {
  if (process.env.NODE_ENV !== "production") {
    // eslint-disable-next-line no-console
    console.log(...args);
  }
};

// DEV NOTE:
// Integrate Live Period/Time Clock instead of just displaying "LIVE" for live games

const Home: NextPage = ({
  initialGames,
  initialInjuries,
  initialStandings,
  nextGameDate
}) => {
  // Debug logging
  debugLog("Server passed nextGameDate:", nextGameDate);
  debugLog(
    "Client moment().format('YYYY-MM-DD'):",
    moment().format("YYYY-MM-DD")
  );

  // Always start with today's date, regardless of whether there are games
  const todayDate = moment().format("YYYY-MM-DD");
  const [currentDate, setCurrentDate] = useState(todayDate);
  debugLog("Client currentDate initialized to:", todayDate);

  // If server found games for a different date, we'll use initialGames only if currentDate matches nextGameDate
  const [games, setGames] = useState(
    currentDate === nextGameDate ? initialGames : []
  );
  const [injuries, setInjuries] = useState(initialInjuries);
  const [standings, setStandings] = useState(initialStandings);
  const [injuryPage, setInjuryPage] = useState(0);
  const injuryRowsPerPage = 32;

  const [isOffseason, setIsOffseason] = useState(false);

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

  useEffect(() => {
    const fetchGames = async () => {
      const res = await fetch(`/api/v1/games?date=${currentDate}`);
      const data = await res.json();

      // Dev: log a sample of the schedule payload to verify structure
      if (process.env.NODE_ENV !== "production") {
        try {
          const sample = Array.isArray(data) ? data.slice(0, 1) : data;
          debugLog("/api/v1/games payload sample:", sample);
          if (Array.isArray(data) && data[0]) {
            debugLog("first game homeTeam:", data[0].homeTeam);
            debugLog("first game awayTeam:", data[0].awayTeam);
          }
        } catch (e) {
          // ignore
        }
      }

      // Fetch period and time remaining for LIVE games from gamecenter
      const liveGamePromises = data
        .filter((game) => game.gameState === "LIVE")
        .map(async (game) => {
          const liveDataResponse = await Fetch(
            `https://api-web.nhle.com/v1/gamecenter/${game.id}/landing`
          );
          const liveData = await liveDataResponse.json();

          return {
            id: game.id,
            clock: liveData.clock || null,
            periodDescriptor: liveData.periodDescriptor || null
          };
        });

      const liveGamesData = await Promise.all(liveGamePromises);

      // Combine live overlay with schedule payload
      const updatedGames = data.map((game) => {
        const overlay = liveGamesData.find((lg) => lg.id === game.id);
        if (overlay) {
          return {
            ...game,
            clock:
              overlay.clock ||
              game.clock ||
              (typeof game.timeRemaining === "string" ||
              typeof game.inIntermission === "boolean"
                ? {
                    timeRemaining: game.timeRemaining,
                    inIntermission: game.inIntermission
                  }
                : null),
            periodDescriptor:
              overlay.periodDescriptor ||
              game.periodDescriptor ||
              (game.period || game.periodType
                ? { number: game.period, periodType: game.periodType }
                : null)
          };
        }
        const clockFromSchedule =
          typeof game.timeRemaining === "string" ||
          typeof game.inIntermission === "boolean"
            ? {
                timeRemaining: game.timeRemaining,
                inIntermission: game.inIntermission
              }
            : null;
        const pdFromSchedule =
          game.periodDescriptor ||
          (game.period || game.periodType
            ? { number: game.period, periodType: game.periodType }
            : null);
        return {
          ...game,
          clock: game.clock || clockFromSchedule || null,
          periodDescriptor: pdFromSchedule || null
        };
      });

      if (process.env.NODE_ENV !== "production") {
        try {
          const sample = Array.isArray(updatedGames)
            ? updatedGames.slice(0, 1)
            : updatedGames;
          debugLog("updatedGames sample:", sample);
        } catch (e) {
          // ignore
        }
      }

      // Fetch standings NOW to attach record strings (W-L-OTL) by team abbrev
      let gamesWithRecords = updatedGames;
      try {
        const standingsNowResp = await Fetch(
          `https://api-web.nhle.com/v1/standings/now`
        );
        const standingsNow = await standingsNowResp.json();
        const recByAbbrev = {} as any;
        if (standingsNow && Array.isArray(standingsNow.standings)) {
          standingsNow.standings.forEach((row: any) => {
            const abbr = row?.teamAbbrev?.default;
            const wins = row?.wins ?? 0;
            const losses = row?.losses ?? 0;
            const otl = row?.otLosses ?? 0;
            if (abbr) recByAbbrev[abbr] = `${wins}-${losses}-${otl}`;
          });
        }
        gamesWithRecords = updatedGames.map((g: any) => {
          const homeAbbrev = g?.homeTeam?.abbrev;
          const awayAbbrev = g?.awayTeam?.abbrev;
          const homeRecord =
            typeof g?.homeTeam?.record === "string" && g.homeTeam.record
              ? g.homeTeam.record
              : homeAbbrev
                ? recByAbbrev[homeAbbrev] || ""
                : "";
          const awayRecord =
            typeof g?.awayTeam?.record === "string" && g.awayTeam.record
              ? g.awayTeam.record
              : awayAbbrev
                ? recByAbbrev[awayAbbrev] || ""
                : "";
          return {
            ...g,
            homeTeam: { ...g.homeTeam, record: homeRecord },
            awayTeam: { ...g.awayTeam, record: awayRecord }
          };
        });
      } catch (e) {
        // eslint-disable-next-line no-console
        console.warn("standings/now fetch failed; records may be missing", e);
      }

      setGames(gamesWithRecords);
    };

    fetchGames();
  }, [currentDate]);

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

  // Format a UTC start time to the user's local timezone, e.g. "7:00 PM EDT"
  const formatLocalStartTime = (startTimeUTC: string) => {
    if (!startTimeUTC) return "";
    try {
      const tz = moment.tz.guess();
      return moment.tz(startTimeUTC, "UTC").tz(tz).format("h:mm A z");
    } catch (e) {
      // Fallback without timezone abbreviation
      return moment.utc(startTimeUTC).local().format("h:mm A");
    }
  };

  const currentPageInjuries = useMemo(() => {
    if (!Array.isArray(initialInjuries)) return []; // Use initialInjuries for safety
    return initialInjuries.slice(
      injuryPage * injuryRowsPerPage,
      (injuryPage + 1) * injuryRowsPerPage
    );
  }, [initialInjuries, injuryPage]); // Depend on initialInjuries

  // const displayRows = currentPageInjuries.map((injury, idx) => (
  //   <tr
  //     key={injury.player.id}
  //     className={idx % 2 === 0 ? styles.rowEven : styles.rowOdd}
  //   >
  //     <td className={styles.dateColumn}>{injury.date}</td>
  //     <td className={styles.teamColumn}>{injury.team}</td>
  //     <td className={styles.nameColumn}>{injury.player.displayName}</td>
  //     <td className={styles.statusColumn}>{injury.status}</td>
  //     <td className={styles.descriptionColumn}>{injury.description}</td>
  //   </tr>
  // ));

  const displayInjuryRows = currentPageInjuries.map((injury, idx) => {
    // Construct logo URL based on team abbreviation (similar to standings)
    // Ensure injury.team holds the abbreviation (e.g., 'TOR', 'BOS')
    const teamAbbrev = injury.team?.toUpperCase() ?? "NHL"; // Default to NHL if missing
    const injuryTeamLogoUrl = getTeamLogoSvg(teamAbbrev);

    return (
      <tr key={`${injury.player?.id ?? idx}-${idx}`}>
        <td className={styles.dateColumn}>
          {injury.date ? moment(injury.date).format("M/D/YY") : "N/A"}
        </td>
        {/* Team Column now includes Logo */}
        <td className={styles.teamColumn}>
          <OptimizedImage
            className={styles.injuryTeamLogo}
            src={injuryTeamLogoUrl}
            alt={`${injury.team ?? ""} logo`}
            width={25}
            height={25}
            priority={false}
            fallbackSrc={fallbackNHLLogo}
          />
          {/* Optional: Add span for abbreviation if desired */}
          {/* <span className={styles.injuryTeamNameSpan}>{injury.team}</span> */}
        </td>
        <td className={styles.nameColumn}>
          {injury.player?.displayName ?? "N/A"}
        </td>
        <td className={styles.statusColumn}>{injury.status ?? "N/A"}</td>
        <td className={styles.descriptionColumn}>
          {injury.description ?? "N/A"}
        </td>
      </tr>
    );
  });

  // const [sortConfig, setSortConfig] = useState({
  //   key: "leagueSequence",
  //   direction: "ascending"
  // });

  // const sortedStandings = useMemo(() => {
  //   return [...standings].sort((a, b) => {
  //     let aValue = a[sortConfig.key];
  //     let bValue = b[sortConfig.key];

  //     if (sortConfig.key === "leagueSequence") {
  //       aValue = parseInt(aValue, 10);
  //       bValue = parseInt(bValue, 10);
  //     }

  //     if (aValue < bValue) {
  //       return sortConfig.direction === "ascending" ? -1 : 1;
  //     }
  //     if (aValue > bValue) {
  //       return sortConfig.direction === "ascending" ? 1 : -1;
  //     }
  //     return 0;
  //   });
  // }, [standings, sortConfig]);

  const [sortConfig, setSortConfig] = useState({
    key: "leagueSequence",
    direction: "ascending"
  });
  const sortedStandings = useMemo(() => {
    if (!Array.isArray(standings)) return []; // Guard against undefined standings
    return [...standings].sort((a, b) => {
      let aValue = a[sortConfig.key];
      let bValue = b[sortConfig.key];

      // Special handling for numeric sorting if needed
      if (
        sortConfig.key === "leagueSequence" ||
        sortConfig.key === "points" ||
        sortConfig.key === "wins" ||
        sortConfig.key === "losses" ||
        sortConfig.key === "otLosses"
      ) {
        aValue = parseInt(aValue, 10) || 0;
        bValue = parseInt(bValue, 10) || 0;
      } else if (typeof aValue === "string") {
        // Basic string comparison
        aValue = aValue.toUpperCase();
        bValue = bValue.toUpperCase();
      }

      if (aValue < bValue) return sortConfig.direction === "ascending" ? -1 : 1;
      if (aValue > bValue) return sortConfig.direction === "ascending" ? 1 : -1;
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

  // Simplified display logic - always use currentDate and games
  const today = moment().format("YYYY-MM-DD");
  const yesterday = moment().subtract(1, "days").format("YYYY-MM-DD");
  const tomorrow = moment().add(1, "days").format("YYYY-MM-DD");

  let gamesHeaderText = "Upcoming";
  if (currentDate === today) {
    gamesHeaderText = "Today's";
  } else if (currentDate === yesterday) {
    gamesHeaderText = "Yesterday's";
  } else if (currentDate === tomorrow) {
    gamesHeaderText = "Tomorrow's";
  }

  return (
    <Container>
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
        {/* --- Games Section --- */}
        <div className={styles.gameCardsContainer}>
          <div className={styles.gamesHeader}>
            <button
              onClick={() => changeDate(-1)}
              aria-label="Previous Day"
            ></button>
            <div className={styles.headerAndDate}>
              <h1
                className={
                  gamesHeaderText === "Yesterday's" ||
                  gamesHeaderText === "Tomorrow's"
                    ? styles.smallerHeader
                    : ""
                }
              >
                {gamesHeaderText} <span>Games</span>
              </h1>
              <p className={styles.dateDisplay}>
                {moment(currentDate).format("M/DD/YYYY")}
              </p>
            </div>
            <button
              onClick={() => changeDate(1)}
              aria-label="Next Day"
            ></button>
          </div>
          <div className={styles.gamesContainer}>
            {games.length > 0 ? (
              games.map((game) => {
                const homeTeam = game.homeTeam;
                const homeTeamInfo = teamsInfo[homeTeam.abbrev] || {};
                const awayTeam = game.awayTeam;
                const awayTeamInfo = teamsInfo[awayTeam.abbrev] || {};

                if (!homeTeam?.abbrev || !awayTeam?.abbrev) return null;

                return (
                  <Link
                    key={game.id}
                    href={`/game/${game.id}`}
                    className={styles.gameLink}
                    passHref
                  >
                    <div
                      className={styles.combinedGameCard}
                      style={
                        {
                          "--home-primary-color":
                            homeTeamInfo.primaryColor || "#888888",
                          "--home-secondary-color":
                            homeTeamInfo.secondaryColor || "#555555",
                          "--home-jersey-color":
                            homeTeamInfo.jersey || "#cccccc",
                          "--away-primary-color":
                            awayTeamInfo.primaryColor || "#888888",
                          "--away-secondary-color":
                            awayTeamInfo.secondaryColor || "#555555",
                          "--away-jersey-color":
                            awayTeamInfo.jersey || "#cccccc"
                        } as React.CSSProperties
                      }
                    >
                      <div
                        className={styles.homeTeamLogo}
                        title={`HOME ${homeTeam?.abbrev ?? ""} record: ${homeTeam?.record ?? "n/a"}`}
                      >
                        <div className={styles.homeAwayLabel}>HOME</div>
                        <OptimizedImage
                          src={getTeamLogoSvg(homeTeam.abbrev)}
                          className={styles.leftImage}
                          alt={`${homeTeam.abbrev} logo`}
                          width={70}
                          height={70}
                          priority={false}
                          fallbackSrc={fallbackNHLLogo}
                        />
                        <div className={styles.teamRecord}>
                          {typeof homeTeam?.record === "string"
                            ? homeTeam.record
                            : ""}
                        </div>
                      </div>
                      <div className={styles.gameTimeSection}>
                        <div className={styles.homeScore}>
                          {homeTeam.score ?? "-"}
                        </div>
                        <div className={styles.gameTimeInfo}>
                          <span className={styles.gameState}>
                            {game.gameState === "LIVE"
                              ? formatPeriodText(
                                  game?.periodDescriptor?.number ??
                                    game?.period,
                                  game?.periodDescriptor?.periodType ??
                                    game?.periodType,
                                  game?.clock &&
                                    game.clock.inIntermission !== undefined
                                    ? game.clock.inIntermission
                                    : (game as any)?.inIntermission
                                )
                              : getDisplayGameState(game.gameState)}
                          </span>
                          <ClientOnly>
                            <span className={styles.gameTimeText}>
                              {game.gameState === "LIVE"
                                ? !(game?.clock &&
                                  game.clock.inIntermission !== undefined
                                    ? game.clock.inIntermission
                                    : (game as any)?.inIntermission)
                                  ? (game?.clock && game.clock.timeRemaining) ||
                                    (game as any)?.timeRemaining ||
                                    "--:--"
                                  : ""
                                : formatLocalStartTime(game.startTimeUTC)}
                            </span>
                          </ClientOnly>
                        </div>
                        <div className={styles.awayScore}>
                          {awayTeam.score ?? "-"}
                        </div>
                      </div>
                      <div
                        className={styles.awayTeamLogo}
                        title={`AWAY ${awayTeam?.abbrev ?? ""} record: ${awayTeam?.record ?? "n/a"}`}
                      >
                        <div className={styles.homeAwayLabel}>AWAY</div>
                        <OptimizedImage
                          src={getTeamLogoSvg(awayTeam.abbrev)}
                          className={styles.rightImage}
                          alt={`${awayTeam.abbrev} logo`}
                          width={70}
                          height={70}
                          priority={false}
                          fallbackSrc={fallbackNHLLogo}
                        />
                        <div className={styles.teamRecord}>
                          {typeof awayTeam?.record === "string"
                            ? awayTeam.record
                            : ""}
                        </div>
                      </div>
                    </div>
                  </Link>
                );
              })
            ) : (
              <p className={styles.noGamesMessage}>
                No games scheduled for{" "}
                {moment(currentDate).format("MM/DD/YYYY")}.
              </p>
            )}
          </div>
        </div>

        {/* --- Transaction Trends (Ownership Risers/Fallers) --- */}
        <ClientOnly>
          <TransactionTrends />
        </ClientOnly>

        {/* --- Chart Section --- */}
        <div className={styles.chartContainer}>
          <TeamStandingsChart />
        </div>

        {/* --- Standings & Injuries Section --- */}
        <div className={styles.standingsInjuriesContainer}>
          {/* Standings */}
          <div className={styles.standingsContainer}>
            <div className={styles.standingsHeader}>
              <h2>
                Current <span>Standings</span>
              </h2>
            </div>
            <div className={styles.tableWrapper}>
              <table className={styles.standingsTable}>
                <caption className={styles.visuallyHidden}>
                  NHL League Standings
                </caption>
                <thead>
                  <tr>
                    <th scope="col">Rank</th>
                    <th scope="col">Team</th>
                    <th scope="col">Record</th>
                    <th scope="col">Points</th>
                  </tr>
                </thead>
                <tbody>
                  {sortedStandings.map((teamRecord) => (
                    <tr key={teamRecord.teamName}>
                      <th scope="row">{teamRecord.leagueSequence}</th>
                      <td>
                        <OptimizedImage
                          className={styles.standingsTeamLogo}
                          src={teamRecord.teamLogo}
                          alt={`${teamRecord.teamName} logo`}
                          width={25}
                          height={25}
                          priority={false}
                          fallbackSrc={fallbackNHLLogo}
                        />
                        <span className={styles.standingsTeamNameSpan}>
                          {teamRecord.teamName}
                        </span>
                      </td>
                      <td>{`${teamRecord.wins || 0}-${teamRecord.losses || 0}-${
                        teamRecord.otLosses || 0
                      }`}</td>
                      <td>{teamRecord.points}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          {/* Injuries */}
          <div className={styles.injuriesContainer}>
            <div className={styles.injuriesHeader}>
              <h2>
                Injury <span>Updates</span>
              </h2>
            </div>
            <div className={styles.tableWrapper}>
              <table className={styles.injuryTable} aria-live="polite">
                <caption className={styles.visuallyHidden}>
                  Recent NHL Injury Updates
                </caption>
                <thead>
                  <tr>
                    <th scope="col" className={styles.dateColumn}>
                      Date
                    </th>
                    <th scope="col" className={styles.teamColumn}>
                      Team
                    </th>
                    <th scope="col" className={styles.nameColumn}>
                      Player
                    </th>
                    <th scope="col" className={styles.statusColumn}>
                      Status
                    </th>
                    <th scope="col" className={styles.descriptionColumn}>
                      Description
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {displayInjuryRows.length > 0 ? (
                    displayInjuryRows
                  ) : (
                    <tr>
                      <td
                        colSpan={5}
                        style={{ textAlign: "center", padding: "20px" }}
                      >
                        No recent injury updates found.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
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
                  !Array.isArray(injuries) ||
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
    "public, s-maxage=60, stale-while-revalidate=120" // Cache for 60s, allow stale for 2 min
  );

  const fetchGames = async (date: string) => {
    try {
      const scheduleUrl = `https://api-web.nhle.com/v1/schedule/${date}`;
      const response = await Fetch(scheduleUrl).then((res) => res.json());
      return response?.gameWeek?.[0]?.games || [];
    } catch (error) {
      console.error(`Error fetching games for ${date}: `, error.message);
      return [];
    }
  };

  const fetchInjuries = async () => {
    try {
      const response = await Fetch(
        `https://stats.sports.bellmedia.ca/sports/hockey/leagues/nhl/playerInjuries?brand=tsn&type=json`
      ).then((res) => res.json());

      if (!Array.isArray(response)) {
        console.error("Unexpected injuries API response format:", response);
        return [];
      }

      let injuriesData = response.flatMap((team) =>
        team.playerInjuries && Array.isArray(team.playerInjuries)
          ? team.playerInjuries.map((injury) => ({
              ...injury,
              team: team.competitor?.shortName ?? "N/A", // Added null check
              date: injury.date
                ? moment(injury.date).format("YYYY-MM-DD")
                : "N/A" // Format date
            }))
          : []
      );

      // Sort injuriesData by date, most recent first
      injuriesData = injuriesData.sort((a, b) =>
        moment(b.date).diff(moment(a.date))
      );

      return injuriesData;
    } catch (error) {
      console.error("Error fetching injuries: ", error.message);
      return [];
    }
  };

  const fetchStandings = async () => {
    try {
      const currentSeason = await fetchCurrentSeason(); // Assuming this returns valid start/end dates
      const now = new Date();
      let dateForStandings = moment().utc().format("YYYY-MM-DD"); // Use UTC for server

      if (currentSeason && currentSeason.startDate && currentSeason.endDate) {
        const seasonStart = new Date(currentSeason.startDate);
        const seasonEnd = new Date(currentSeason.endDate);

        // Check if current date is outside the regular season range
        if (now < seasonStart || now > seasonEnd) {
          // Attempt to get the end date of the season if outside
          dateForStandings = moment(seasonEnd).format("YYYY-MM-DD");
          console.log(
            `Outside regular season. Fetching standings for season end date: ${dateForStandings}`
          );
        }
      } else {
        console.warn(
          "Could not determine current season dates accurately. Defaulting to today for standings."
        );
      }

      const response = await Fetch(
        `https://api-web.nhle.com/v1/standings/${dateForStandings}`
      ).then((res) => res.json());

      if (!response || !Array.isArray(response.standings)) {
        console.error(
          "Standings data not available or in unexpected format for date:",
          dateForStandings,
          response
        );
        return []; // Return empty array if no standings found
      }

      // Map directly if the structure is already flat
      const standingsData = response.standings.map((team: any) => ({
        leagueSequence: team.leagueSequence ?? 99, // Provide default
        teamName: team.teamName?.default ?? "Unknown Team", // Provide default
        wins: team.wins ?? 0,
        losses: team.losses ?? 0,
        otLosses: team.otLosses ?? 0,
        points: team.points ?? 0,
        teamLogo:
          team.teamLogo ??
          `https://assets.nhle.com/logos/nhl/svg/${
            team.teamAbbrev?.default ?? "NHL"
          }_light.svg` // Default logo
      }));

      // Sort by leagueSequence ascending after mapping
      standingsData.sort((a, b) => a.leagueSequence - b.leagueSequence);

      return standingsData;
    } catch (error) {
      console.error("Error fetching standings: ", error.message);
      return [];
    }
  };

  // Check if we're in the offseason first
  const isOffseason = await checkIsOffseason();

  const today = moment().format("YYYY-MM-DD");
  let gamesToday = [];
  let nextGameDateFound = today;

  if (isOffseason) {
    console.log("Currently in offseason - skipping game search");
    // During offseason, don't search for games as there won't be any
    // Just use empty array and today's date
    gamesToday = [];
    nextGameDateFound = today;
  } else {
    // Only search for games during the regular season or playoffs
    gamesToday = await fetchGames(today);
    nextGameDateFound = today;

    if (gamesToday.length === 0) {
      debugLog(
        `No games found for today (${today}), searching for next available date...`
      );
      let nextDay = moment(today).add(1, "days");
      let attempts = 0;
      const maxAttempts = 7; // Reduce from 30 to 7 days during season

      while (gamesToday.length === 0 && attempts < maxAttempts) {
        const dateStr = nextDay.format("YYYY-MM-DD");
        debugLog(`Checking for games on ${dateStr}...`);
        gamesToday = await fetchGames(dateStr);
        if (gamesToday.length > 0) {
          nextGameDateFound = dateStr;
          debugLog(`Found next games on ${nextGameDateFound}`);
          break;
        }
        nextDay.add(1, "days");
        attempts++;
      }
      if (gamesToday.length === 0) {
        console.warn(
          `Could not find games within the next ${maxAttempts} days.`
        );
      }
    } else {
      debugLog(`Found games for today (${today})`);
    }
  }

  const injuries = await fetchInjuries();
  const standings = await fetchStandings();

  return {
    props: {
      initialGames: gamesToday,
      initialInjuries: injuries,
      initialStandings: standings,
      nextGameDate: nextGameDateFound,
      isOffseason // Pass offseason status to client
    }
  };
}

export default Home;
