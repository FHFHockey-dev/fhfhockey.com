import React, { useMemo, useState, useRef } from "react";
import { NextSeo } from "next-seo";

import Container from "components/Layout/Container";
import { getTeams } from "lib/NHL/server";
import Link from "next/link";
import StrengthOfSchedule from "components/teamLandingPage/strengthofSchedule";
import { Team } from "lib/NHL/types";
import useScreenSize, { BreakPoint } from "hooks/useScreenSize";
import ClientOnly from "components/ClientOnly";
import Fetch from "lib/cors-fetch";
import GoalieTrends from "./goalieTrends";

type StatsProps = {
  teams: Team[];
  pastSoSRankings: SoS[];
  futureSoSRankings: SoS[];
  teamPowerRankings: any[];
};

type Direction = "ascending" | "descending";

function Stats({
  teams,
  pastSoSRankings,
  futureSoSRankings,
  teamPowerRankings,
}: StatsProps) {
  const size = useScreenSize();
  const isMobileView = size.screen === BreakPoint.s;
  const [sortConfig, setSortConfig] = useState<{
    key: string;
    direction: Direction;
  }>({
    key: "",
    direction: "ascending",
  });
  const [sortedTeamPowerRankings, setSortedTeamPowerRankings] =
    useState(teamPowerRankings);
  const fantasyPowerRankings = useMemo(() => {
    if (sortedTeamPowerRankings.length > 0) {
      const leagueAverages = calculateLeagueAverages(sortedTeamPowerRankings);
      // console.log('League averages:', leagueAverages);
      const standardDeviations = calculateStandardDeviations(
        sortedTeamPowerRankings,
        leagueAverages
      );
      // console.log('Standard deviations:', standardDeviations);
      let updatedTeamsWithPowerScores = calculatePowerScores(
        sortedTeamPowerRankings,
        leagueAverages,
        standardDeviations
      );
      // console.log('Teams with power scores:', updatedTeamsWithPowerScores);

      // Sort teams by powerScore in descending order
      updatedTeamsWithPowerScores = updatedTeamsWithPowerScores.sort(
        (a, b) => b.powerScore - a.powerScore
      );

      return updatedTeamsWithPowerScores;
    } else {
      return [];
    }
  }, [sortedTeamPowerRankings]);

  const sortDataBy = (key: string, direction: Direction) => {
    const sortedData = [...sortedTeamPowerRankings].sort((a, b) => {
      const aStats =
        a.lastTenGames && a.lastTenGames[0].lastTenGames[0]
          ? a.lastTenGames[0].lastTenGames[0][key]
          : null;
      const bStats =
        b.lastTenGames && b.lastTenGames[0].lastTenGames[0]
          ? b.lastTenGames[0].lastTenGames[0][key]
          : null;

      if (aStats === null) return direction === "ascending" ? 1 : -1;
      if (bStats === null) return direction === "ascending" ? -1 : 1;

      return direction === "ascending" ? aStats - bStats : bStats - aStats;
    });
    setSortedTeamPowerRankings(sortedData);
  };

  const requestSort = (key: string) => {
    let direction: Direction = "ascending";
    if (
      key === "L10pim" ||
      key === "L10ptsPct" ||
      key === "L10hits" ||
      key === "L10blocks" ||
      key === "L10powerPlayOpportunities" ||
      key === "L10goalsFor" ||
      key === "L10shotsFor" ||
      key === "L10powerPlay" ||
      key === "L10penaltyKill"
    ) {
      direction = "descending";
    }
    if (sortConfig.key === key && sortConfig.direction === direction) {
      direction = direction === "ascending" ? "descending" : "ascending";
    }
    setSortConfig({ key, direction });
    sortDataBy(key, direction);
  };

  const logosRef = useRef<HTMLDivElement>(null);

  const scrollLogos = (direction: "left" | "right") => {
    const container = logosRef.current;
    if (container) {
      const scrollAmount = 250; // Use a fixed value for testing
      console.log("Scroll Amount:", scrollAmount); // Debugging
      if (direction === "left") {
        container.scrollLeft -= scrollAmount;
      } else {
        container.scrollLeft += scrollAmount;
      }
    }
  };

  return (
    <Container>
      <NextSeo
        title="FHFH | Team Stat Catalogue"
        description="Five Hole Fantasy Hockey Podcast Stats for all teams in NHL."
      />

      <div className="team-logos-container">
        <div className="scroll-button left" onClick={() => scrollLogos("left")}>
          &lt;
        </div>
        <div className="team-logos-grid" ref={logosRef}>
          {teams.map((team) => (
            <img
              key={team.id}
              src={`https://assets.nhle.com/logos/nhl/svg/${team.abbreviation}_light.svg`}
              alt={`${team.name} Logo`}
            />
          ))}
        </div>
        <div
          className="scroll-button right"
          onClick={() => scrollLogos("right")}
        >
          &gt;
        </div>
      </div>

      <div className="team-landing-page">
        <div
          className="stats-and-trends-grid"
          style={{ display: "flex", alignItems: "flex-start" }}
        >
          <div
            className="sos-tables-container"
            style={{
              display: "flex",
              flexDirection: "row",
            }}
          >
            <div className="sos-container">
              <h2>
                Strength of Schedule -{" "}
                <span className="spanColorBlue">Past</span>
              </h2>
              <StrengthOfSchedule type="past" rankings={pastSoSRankings} />
            </div>

            <div className="goalie-trends-container">
              <GoalieTrends />
            </div>
            <div className="sos-container">
              <h2>
                Strength of Schedule -{" "}
                <span className="spanColorBlue">Future</span>
              </h2>
              <StrengthOfSchedule type="future" rankings={futureSoSRankings} />
            </div>
          </div>
        </div>

        <div className="tables-container">
          <div className="team-ranks-table-container">
            <h1>
              Team Power Rankings -{" "}
              <span className="spanColorBlue">Last 10 Games</span>
            </h1>
            <table className="team-ranks-table">
              <thead className="team-ranks-table-header">
                <tr>
                  <th>Rank</th>
                  <th>Team</th>
                  <th onClick={() => requestSort("L10ptsPct")}>PTS%</th>
                  <th onClick={() => requestSort("L10goalsFor")}>GF/GP</th>
                  <th onClick={() => requestSort("L10goalsAgainst")}>GA/GP</th>
                  <th onClick={() => requestSort("L10shotsFor")}>SF/GP</th>
                  <th onClick={() => requestSort("L10shotsAgainst")}>SA/GP</th>
                  <th onClick={() => requestSort("L10powerPlay")}>PP%</th>
                  <th onClick={() => requestSort("L10penaltyKill")}>PK%</th>
                  <th onClick={() => requestSort("L10powerPlayOpportunities")}>
                    PPO/GP
                  </th>
                  <th onClick={() => requestSort("L10hits")}>HIT/GP</th>
                  <th onClick={() => requestSort("L10blocks")}>BLK/GP</th>
                  <th onClick={() => requestSort("L10pim")}>PIM/GP</th>
                </tr>
              </thead>
              <tbody>
                {sortedTeamPowerRankings.map((team, index) => {
                  const teamStats = team.lastTenGames
                    ? team.lastTenGames[0]
                    : null;
                  if (!teamStats) {
                    console.warn(
                      `Missing detailed stats for team: ${team.abbreviation}`
                    );
                    return (
                      <tr key={team.id}>
                        <td>{index + 1}</td>
                        <td>
                          <img
                            className="tableImg"
                            src={`https://assets.nhle.com/logos/nhl/svg/${team.abbreviation}_light.svg`}
                            alt={`${team.name} Logo`}
                            style={{
                              width: "22px",
                              height: "22px",
                              marginRight: "10px",
                            }}
                          />
                          {team.name}
                        </td>
                        {/* Render empty cells for missing stats */}
                        <td colSpan={10}>Stats not available</td>
                      </tr>
                    );
                  }

                  return (
                    <tr key={team.id} className="team-ranks-row">
                      <td>{index + 1}</td>
                      <td className="team-cell">
                        <div className="team-logo-container">
                          <img
                            src={`https://assets.nhle.com/logos/nhl/svg/${team.abbreviation}_dark.svg`}
                            alt={`${team.name} Logo`}
                          />
                        </div>
                        <div className="team-label-container"></div>
                      </td>
                      <td>
                        {(teamStats.lastTenGames[0].L10ptsPct * 100).toFixed(1)}
                        %
                      </td>
                      <td>
                        {teamStats.lastTenGames[0].L10goalsFor.toFixed(2)}
                      </td>
                      <td>
                        {teamStats.lastTenGames[0].L10goalsAgainst.toFixed(2)}
                      </td>
                      <td>
                        {teamStats.lastTenGames[0].L10shotsFor.toFixed(2)}
                      </td>
                      <td>
                        {teamStats.lastTenGames[0].L10shotsAgainst.toFixed(2)}
                      </td>
                      <td>
                        {(teamStats.lastTenGames[0].L10powerPlay * 100).toFixed(
                          1
                        )}
                        %
                      </td>
                      <td>
                        {(
                          teamStats.lastTenGames[0].L10penaltyKill * 100
                        ).toFixed(1)}
                        %
                      </td>
                      <td>
                        {teamStats.lastTenGames[0].L10powerPlayOpportunities.toFixed(
                          2
                        )}
                      </td>
                      <td>{teamStats.lastTenGames[0].L10hits.toFixed(2)}</td>
                      <td>{teamStats.lastTenGames[0].L10blocks.toFixed(2)}</td>
                      <td>{teamStats.lastTenGames[0].L10pim.toFixed(2)}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
          <div className="table-separator"></div>
          <div className="fantasy-power-ranks-table-container">
            <h1>
              Fantasy Power Rankings -{" "}
              <span className="spanColorBlue">Last 10 Games</span>
            </h1>
            <table className="fantasy-power-ranks-table">
              <thead className="fantasy-power-ranks-table-header">
                <tr>
                  <th>Rank</th>
                  <th>Team</th>
                  <th>PTS%</th>
                  <th>GF/GP</th>
                  <th>GA/GP</th>
                  <th>SF/GP</th>
                  <th>SA/GP</th>
                  <th>PP%</th>
                  <th>PK%</th>
                  <th>PPO/GP</th>
                  <th>HIT/GP</th>
                  <th>BLK/GP</th>
                  <th>PIM/GP</th>
                </tr>
              </thead>
              <tbody>
                {fantasyPowerRankings.map((team, index) => (
                  <tr key={team.id} className="fantasy-power-ranks-row">
                    <td className={index % 2 === 0 ? "odd-row" : ""}>
                      {index + 1}
                    </td>
                    <td
                      className={`team-cell ${
                        index % 2 === 0 ? "odd-row" : ""
                      }`}
                    >
                      <div className="team-logo-container">
                        <img
                          src={`https://assets.nhle.com/logos/nhl/svg/${team.abbreviation}_dark.svg`}
                          alt={`${team.name} Logo`}
                        />
                      </div>
                      <ClientOnly>
                        {!isMobileView && (
                          <div className="team-label-container"></div>
                        )}
                      </ClientOnly>
                    </td>
                    <td className={getColorClass(team.L10ptsPctRank)}>
                      {team.L10ptsPctRank}
                    </td>
                    <td className={getColorClass(team.L10goalsForRank)}>
                      {team.L10goalsForRank}
                    </td>
                    <td className={getColorClass(team.L10goalsAgainstRank)}>
                      {team.L10goalsAgainstRank}
                    </td>
                    <td className={getColorClass(team.L10shotsForRank)}>
                      {team.L10shotsForRank}
                    </td>
                    <td className={getColorClass(team.L10shotsAgainstRank)}>
                      {team.L10shotsAgainstRank}
                    </td>
                    <td className={getColorClass(team.L10powerPlayRank)}>
                      {team.L10powerPlayRank}
                    </td>
                    <td className={getColorClass(team.L10penaltyKillRank)}>
                      {team.L10penaltyKillRank}
                    </td>
                    <td
                      className={getColorClass(
                        team.L10powerPlayOpportunitiesRank
                      )}
                    >
                      {team.L10powerPlayOpportunitiesRank}
                    </td>
                    <td className={getColorClass(team.L10hitsRank)}>
                      {team.L10hitsRank}
                    </td>
                    <td className={getColorClass(team.L10blocksRank)}>
                      {team.L10blocksRank}
                    </td>
                    <td className={getColorClass(team.L10pimRank)}>
                      {team.L10pimRank}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </Container>
  );
}

export async function getStaticProps() {
  const teams = await getTeams();

  // sort the teams in alphabetical order
  teams.sort((a, b) => a.name.localeCompare(b.name));
  const { pastSoSRankings, futureSoSRankings } = await getSoSRankings();
  const teamPowerRankings = await getTeamPowerRankings(teams);

  return {
    props: {
      teams,
      pastSoSRankings,
      futureSoSRankings,
      teamPowerRankings,
    },
    revalidate: 60 * 60, // 1 hour in seconds
  };
}

export type SoS = {
  team: string;
  sos: number;
};

async function getSoSRankings(): Promise<{
  pastSoSRankings: SoS[];
  futureSoSRankings: SoS[];
}> {
  const teamRecords = await fetch(
    "https://api-web.nhle.com/v1/standings/2023-11-27"
  )
    .then((response) => response.json())
    .then((res) => processTeamData(res.standings));
  const teamAbbrevs = Object.keys(teamRecords);
  const gameLogs = await fetchGameLogs(teamAbbrevs, teamRecords);
  const opponentRecords = calculateOpponentRecords(gameLogs, teamRecords);
  const fullTeamData = {
    records: teamRecords,
    logs: gameLogs,
    opponentRecords,
  };

  if (Object.keys(fullTeamData).length > 0 && fullTeamData.opponentRecords) {
    const pastSoSRankings = calculatePastSoSRanking(
      fullTeamData.opponentRecords
    );
    const futureSoSRankings = calculateFutureSoSRanking(
      fullTeamData.opponentRecords
    );

    return { pastSoSRankings, futureSoSRankings } as any;
  }

  return { pastSoSRankings: [], futureSoSRankings: [] };
}

const getCurrentDate = () => {
  const today = new Date();
  const year = today.getFullYear();
  const month = String(today.getMonth() + 1).padStart(2, "0"); // Months are 0-indexed
  const day = String(today.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
};

async function getTeamPowerRankings(teams: Team[]) {
  const rankTeams = (data: any[]) => {
    return data.sort((a, b) => {
      // Check if lastTenGames data is available for both teams
      if (
        a.lastTenGames &&
        b.lastTenGames &&
        a.lastTenGames[0] &&
        b.lastTenGames[0]
      ) {
        // Compare the teams based on L10goalsFor
        return b.lastTenGames[0].L10goalsFor - a.lastTenGames[0].L10goalsFor;
      }
      return 0; // If data is not available, keep the original order
    });
  };

  const detailedDataPromises = teams.map((team) => {
    return fetchTeamStats(team.id, team.id)
      .then((stats) => {
        return { ...team, lastTenGames: [stats] };
      })
      .catch((error: any) => {
        console.error(`Error fetching stats for team ${team.name}: ${error}`);
        return { ...team, lastTenGames: [null] }; // Set to null if error
      });
  });

  const detailedData = await Promise.all(detailedDataPromises);

  const rankedData = rankTeams(detailedData);

  // Calculate ranks for each stat and add to team data
  [
    "L10ptsPct",
    "L10goalsFor",
    "L10goalsAgainst",
    "L10shotsAgainst",
    "L10shotsFor",
    "L10powerPlay",
    "L10penaltyKill",
    "L10powerPlayOpportunities",
    "L10hits",
    "L10blocks",
    "L10pim",
  ].forEach((statKey) => {
    const statRanks = calculateStatRanks(rankedData, statKey);
    rankedData.forEach((team) => {
      const rankEntry = statRanks.find((rank) => rank.teamId === team.id);
      team[`${statKey}Rank`] = rankEntry ? rankEntry.rank : null;

      // Console log for each team's rank in this stat
      // console.log(`${team.abbreviation} rank in ${statKey}: ${team[`${statKey}Rank`]}`);
    });
  });

  return rankedData;
}

const fetchTeamStats = async (franchiseId: number, teamId: number) => {
  const currentDate = getCurrentDate();
  const statsUrl = `https://api.nhle.com/stats/rest/en/team/summary?isAggregate=false&isGame=true&sort=%5B%7B%22property%22:%22points%22,%22direction%22:%22DESC%22%7D,%7B%22property%22:%22wins%22,%22direction%22:%22DESC%22%7D,%7B%22property%22:%22teamId%22,%22direction%22:%22ASC%22%7D%5D&start=0&limit=50&factCayenneExp=gamesPlayed%3E=1&cayenneExp=franchiseId%3D${franchiseId}%20and%20gameDate%3C=%22${currentDate}%2023%3A59%3A59%22%20and%20gameDate%3E=%222023-09-29%22%20and%20gameTypeId=2`;
  try {
    const response = await fetch(statsUrl);
    const data = await response.json();

    if (data && data.data) {
      data.data.sort(
        (a: any, b: any) =>
          new Date(b.gameDate).getTime() - new Date(a.gameDate).getTime()
      );
      const lastTenGames = data.data.slice(0, 10) as any[];

      const gameStatsPromises = lastTenGames.map((game) =>
        fetchGameStats(game.gameId, teamId)
      );
      const gamesStats = await Promise.all(gameStatsPromises);
      const lastTenStats = {
        lastTenIds: lastTenGames.map((game) => game.gameId),
        L10ptsPct: average(lastTenGames, "pointPct"),
        L10goalsAgainst: average(lastTenGames, "goalsAgainst"),
        L10goalsFor: average(lastTenGames, "goalsFor"),
        L10shotsFor: average(lastTenGames, "shotsForPerGame"),
        L10shotsAgainst: average(lastTenGames, "shotsAgainstPerGame"),
        L10powerPlay: average(lastTenGames, "powerPlayPct"),
        L10penaltyKill: average(lastTenGames, "penaltyKillPct"),
        L10powerPlayOpportunities:
          gamesStats.length === 0
            ? 0
            : totalSum(gamesStats, "powerPlayOpportunities") /
              gamesStats.length,
        L10hits:
          gamesStats.length === 0
            ? 0
            : totalSum(gamesStats, "hits") / gamesStats.length,
        L10blocks:
          gamesStats.length === 0
            ? 0
            : totalSum(gamesStats, "blocks") / gamesStats.length,
        L10pim:
          gamesStats.length === 0
            ? 0
            : totalSum(gamesStats, "pim") / gamesStats.length,
      };

      // console.log("LAST TEN GAMES: ", lastTenGames, lastTenStats);
      return { lastTenGames: [lastTenStats] };
    }

    return null;
  } catch (error) {
    console.error(`Error fetching team stats: ${error}`);
    return null;
  }
};

function calculateStatRanks(teamsData: any[], statKey: string) {
  // Define stats for which lower values are better
  const reverseOrderStats = ["L10goalsAgainst", "L10shotsAgainst"];

  // Create an array with teams and their respective stat values
  const teamsWithStat: any[] = teamsData.map((team) => ({
    teamId: team.id,
    teamName: team.abbreviation,
    statValue: team.lastTenGames[0].lastTenGames[0][statKey],
  }));

  // Sort the teams by the stat value
  if (reverseOrderStats.includes(statKey)) {
    // For stats where lower is better, sort in ascending order
    teamsWithStat.sort((a, b) => a.statValue - b.statValue);
  } else {
    // For other stats, sort in descending order
    teamsWithStat.sort((a, b) => b.statValue - a.statValue);
  }

  // Assign ranks based on sorted order
  let currentRank = 1;
  let previousValue: any = null;
  teamsWithStat.forEach((team, index) => {
    if (previousValue !== null && team.statValue === previousValue) {
      // Prepend 'T-' for tied ranks
      team.rank = `T-${currentRank}`;
    } else {
      currentRank = index + 1;
      team.rank = currentRank.toString();
      previousValue = team.statValue;
    }
  });

  return teamsWithStat.map((team) => ({
    teamId: team.teamId,
    rank: team.rank,
  }));
}

function totalSum(games: any[], key: string) {
  return games.reduce((acc, game) => acc + (game[key] || 0), 0);
}

function average(games: any[], key: string) {
  const sum = games.reduce((acc, game) => acc + (game[key] || 0), 0);
  return games.length > 0 ? sum / games.length : 0;
}

const fetchGameStats = async (gameId: string, teamId: number) => {
  const boxscoreUrl = `https://api-web.nhle.com/v1/gamecenter/${gameId}/boxscore`;

  try {
    const response = await fetch(boxscoreUrl);
    const data = await response.json();

    // Determine if the team is the home or away team
    const isHomeTeam = data.homeTeam.id === teamId;
    const teamStats = isHomeTeam ? data.homeTeam : data.awayTeam;

    // Extract the relevant stats here
    const powerPlayOpportunities = extractPowerPlayOpportunities(
      teamStats.powerPlayConversion
    );
    const pim = teamStats.pim; // Penalty in minutes
    const hits = teamStats.hits;
    const blocks = teamStats.blocks;

    // Return the extracted stats
    return {
      powerPlayOpportunities,
      pim,
      hits,
      blocks,
    };
  } catch (error) {
    console.error(`Error fetching game stats: ${error}`);
    return null;
  }
};

function extractPowerPlayOpportunities(powerPlayConversion: any) {
  // Use a regular expression to extract numbers from the format "x/y"
  const matches = powerPlayConversion.match(/(\d+)\/(\d+)/);
  if (matches && matches.length === 3) {
    // The second element in the matches array will be the total opportunities
    return parseInt(matches[2], 10);
  }

  // Return 0 if the format is not as expected
  return 0;
}

const processTeamData = (teams: any[]) => {
  return teams.reduce((acc, team) => {
    const teamKey = team.teamAbbrev.default;
    acc[teamKey] = {
      overall: {
        pointPctg: team.pointPctg,
        goalDifferentialPctg: team.goalDifferentialPctg,
        winPctg: team.winPctg,
        overallRecord: `${team.wins}-${team.losses}-${team.otLosses}`,
      },
      home: {
        homeGamesPlayed: team.homeGamesPlayed,
        homeGoalDifferential: team.homeGoalDifferential,
        homeGoalsFor: team.homeGoalsFor,
        homeGoalsAgainst: team.homeGoalsAgainst,
        homeWins: team.homeWins,
        homeLosses: team.homeLosses,
        homeOtLosses: team.homeOtLosses,
        homePoints: team.homePoints,
        homeRecord: `${team.homeWins}-${team.homeLosses}-${team.homeOtLosses}`,
        homePtsPct: (team.homePoints / (team.homeGamesPlayed * 2)).toFixed(3),
      },
      away: {
        roadGamesPlayed: team.roadGamesPlayed,
        roadGoalDifferential: team.roadGoalDifferential,
        roadGoalsFor: team.roadGoalsFor,
        roadGoalsAgainst: team.roadGoalsAgainst,
        roadWins: team.roadWins,
        roadLosses: team.roadLosses,
        roadOtLosses: team.roadOtLosses,
        roadPoints: team.roadPoints,
        roadRecord: `${team.roadWins}-${team.roadLosses}-${team.roadOtLosses}`,
        roadPtsPct: (team.roadPoints / (team.roadGamesPlayed * 2)).toFixed(3),
      },
      lastTen: {
        l10GamesPlayed: team.l10GamesPlayed,
        l10GoalDifferential: team.l10GoalDifferential,
        l10GoalsFor: team.l10GoalsFor,
        l10GoalsAgainst: team.l10GoalsAgainst,
        l10Wins: team.l10Wins,
        l10Losses: team.l10Losses,
        l10OtLosses: team.l10OtLosses,
        l10Points: team.l10Points,
        l10Record: `${team.l10Wins}-${team.l10Losses}-${team.l10OtLosses}`,
        l10PtsPct: (team.l10Points / (team.l10GamesPlayed * 2)).toFixed(3),
      },
    };
    return acc;
  }, {});
};

const processGameLogs = (
  games: any[],
  teamAbbrev: string,
  teamRecords: any
) => {
  return games
    .filter((game) => game.gameType === 2) // Only include regular season games
    .map((game) => {
      const isHomeGame = game.homeTeam.abbrev === teamAbbrev;
      const opponentAbbrev = isHomeGame
        ? game.awayTeam.abbrev
        : game.homeTeam.abbrev;
      const opponentRecord = teamRecords[opponentAbbrev];

      // Calculate opponent's points percentage
      const opponentPtsPct = opponentRecord.overall.pointPctg;

      // Determine opponent's home/away win percentages
      const opponentHomeWinPct = opponentRecord.home.homePtsPct;
      const opponentRoadWinPct = opponentRecord.away.roadPtsPct;

      // Extract the scores
      const teamScore = isHomeGame ? game.homeTeam.score : game.awayTeam.score;
      const opponentScore = isHomeGame
        ? game.awayTeam.score
        : game.homeTeam.score;

      // Determine the outcome of the game
      let outcome;
      if (teamScore > opponentScore) {
        outcome = "win";
      } else if (teamScore < opponentScore) {
        outcome = "loss";
      } else {
        outcome = "tie"; // Adjust based on NHL rules for ties/overtime losses
      }

      // Additional details can be extracted as needed, e.g., gameDate, venue, etc.
      return {
        date: game.gameDate,
        isHomeGame,
        opponent: opponentAbbrev,
        opponentRecord,
        opponentPtsPct,
        opponentHomeWinPct,
        opponentRoadWinPct,
        teamScore,
        opponentScore,
        outcome,
      };
    });
};

const calculatePastSoSRanking = (opponentRecords: any) => {
  const sosRankings = Object.entries(opponentRecords).map(
    ([team, recordData]: any) => {
      // Ensure past opponent records are available
      if (
        !recordData.past ||
        recordData.past.homeGames + recordData.past.awayGames === 0
      ) {
        return { team, sos: 0 }; // Return default value if data is missing or no games played
      }

      const { past } = recordData;
      const totalPastGames = past.homeGames + past.awayGames;

      const weightedOppWinPct =
        (past.homeGames * parseFloat(past.opponents.avgAwayWinPct) +
          past.awayGames * parseFloat(past.opponents.avgHomeWinPct)) /
        totalPastGames;

      return { team, sos: weightedOppWinPct.toFixed(3) }; // Round the sos value to 3 decimal places
    }
  );

  // @ts-expect-error
  sosRankings.sort((a, b) => parseFloat(b.sos) - parseFloat(a.sos)); // Ensure sorting is based on numerical values

  return sosRankings;
};

const calculateFutureSoSRanking = (opponentRecords: any) => {
  const sosRankings = Object.entries(opponentRecords).map(
    ([team, recordData]: any) => {
      // Ensure future opponent records are available
      if (
        !recordData.future ||
        recordData.future.homeGames + recordData.future.awayGames === 0
      ) {
        return { team, sos: 0 }; // Return default value if data is missing or no games scheduled
      }

      const { future } = recordData;
      const totalFutureGames = future.homeGames + future.awayGames;

      const weightedOppWinPct =
        (future.homeGames * parseFloat(future.opponents.avgAwayWinPct) +
          future.awayGames * parseFloat(future.opponents.avgHomeWinPct)) /
        totalFutureGames;

      return { team, sos: weightedOppWinPct.toFixed(3) }; // Round the sos value to 3 decimal places
    }
  );

  // @ts-expect-error
  sosRankings.sort((a, b) => parseFloat(b.sos) - parseFloat(a.sos)); // Ensure sorting is based on numerical values

  return sosRankings;
};

const aggregateOpponentRecords = (opponents: any[]) => {
  const totalOpponents = opponents.length;
  if (totalOpponents === 0) {
    return {
      avgHomeWinPct: 0,
      avgAwayWinPct: 0,
      avgPtsPct: 0,
      avgGoalDiff: 0,
    };
  }

  const totals = opponents.reduce(
    (acc, record) => {
      acc.homeWinPct += parseFloat(record.home.homePtsPct);
      acc.awayWinPct += parseFloat(record.away.roadPtsPct);
      acc.ptsPct += record.overall.pointPctg;
      acc.goalDiff += record.overall.goalDifferentialPctg;
      return acc;
    },
    { homeWinPct: 0, awayWinPct: 0, ptsPct: 0, goalDiff: 0 }
  );

  return {
    avgHomeWinPct: (totals.homeWinPct / totalOpponents).toFixed(3),
    avgAwayWinPct: (totals.awayWinPct / totalOpponents).toFixed(3),
    avgPtsPct: (totals.ptsPct / totalOpponents).toFixed(3),
    avgGoalDiff: (totals.goalDiff / totalOpponents).toFixed(3),
  };
};

const calculateOpponentRecords = (gameLogs: any, teamRecords: any) => {
  const combinedOpponentRecords: any = {};

  for (const team in gameLogs) {
    let pastOpponents: any[] = [];
    let futureOpponents: any[] = [];
    let pastHomeGames = 0;
    let pastAwayGames = 0;
    let futureHomeGames = 0;
    let futureAwayGames = 0;

    gameLogs[team].forEach((game: any) => {
      const opponentAbbrev = game.opponent;
      const opponentRecord = teamRecords[opponentAbbrev];
      const currentDate = new Date();

      if (new Date(game.date) < currentDate) {
        // Past game
        pastOpponents.push(opponentRecord);
        if (game.isHomeGame) {
          pastHomeGames++;
        } else {
          pastAwayGames++;
        }
      } else {
        // Future game
        futureOpponents.push(opponentRecord);
        if (game.isHomeGame) {
          futureHomeGames++;
        } else {
          futureAwayGames++;
        }
      }
    });

    combinedOpponentRecords[team] = {
      past: {
        opponents: aggregateOpponentRecords(pastOpponents),
        homeGames: pastHomeGames,
        awayGames: pastAwayGames,
      },
      future: {
        opponents: aggregateOpponentRecords(futureOpponents),
        homeGames: futureHomeGames,
        awayGames: futureAwayGames,
      },
    };
  }

  return combinedOpponentRecords;
};

const fetchGameLogs = async (teamAbbrevs: string[], teamRecords: any) => {
  const gameLogs: any = {};

  for (const abbrev of teamAbbrevs) {
    try {
      const response = await fetch(
        `https://api-web.nhle.com/v1/club-schedule-season/${abbrev}/20232024`
      );
      const data = await response.json();
      gameLogs[abbrev] = processGameLogs(data.games, abbrev, teamRecords);
    } catch (error) {
      console.error(`Error fetching game logs for ${abbrev}:`, error);
    }
  }

  return gameLogs;
};

function calculateLeagueAverages(teamsData: any[]) {
  const statsSums = {
    L10ptsPct: 0,
    L10goalsFor: 0,
    L10goalsAgainst: 0,
    L10shotsFor: 0,
    L10shotsAgainst: 0,
    L10powerPlay: 0,
    L10penaltyKill: 0,
    L10powerPlayOpportunities: 0,
    L10hits: 0,
    L10blocks: 0,
    L10pim: 0,
  };

  teamsData.forEach((team) => {
    const stats = team.lastTenGames[0].lastTenGames[0]; // Accessing the nested lastTenGames
    statsSums.L10ptsPct += stats.L10ptsPct;
    statsSums.L10goalsFor += stats.L10goalsFor;
    statsSums.L10goalsAgainst += stats.L10goalsAgainst;
    statsSums.L10shotsFor += stats.L10shotsFor;
    statsSums.L10shotsAgainst += stats.L10shotsAgainst;
    statsSums.L10powerPlay += stats.L10powerPlay;
    statsSums.L10penaltyKill += stats.L10penaltyKill;
    statsSums.L10powerPlayOpportunities += stats.L10powerPlayOpportunities;
    statsSums.L10hits += stats.L10hits;
    statsSums.L10blocks += stats.L10blocks;
    statsSums.L10pim += stats.L10pim;
  });

  const numberOfTeams = teamsData.length;
  return {
    L10ptsPct: statsSums.L10ptsPct / numberOfTeams,
    L10goalsFor: statsSums.L10goalsFor / numberOfTeams,
    L10goalsAgainst: statsSums.L10goalsAgainst / numberOfTeams,
    L10shotsFor: statsSums.L10shotsFor / numberOfTeams,
    L10shotsAgainst: statsSums.L10shotsAgainst / numberOfTeams,
    L10powerPlay: statsSums.L10powerPlay / numberOfTeams,
    L10penaltyKill: statsSums.L10penaltyKill / numberOfTeams,
    L10powerPlayOpportunities:
      statsSums.L10powerPlayOpportunities / numberOfTeams,
    L10hits: statsSums.L10hits / numberOfTeams,
    L10blocks: statsSums.L10blocks / numberOfTeams,
    L10pim: statsSums.L10pim / numberOfTeams,
  };
}

function calculateStandardDeviations(teamsData: any[], leagueAverages: any) {
  let sumsOfSquaredDifferences = {
    L10ptsPct: 0,
    L10goalsFor: 0,
    L10goalsAgainst: 0,
    L10shotsFor: 0,
    L10shotsAgainst: 0,
    L10powerPlay: 0,
    L10penaltyKill: 0,
    L10powerPlayOpportunities: 0,
    L10hits: 0,
    L10blocks: 0,
    L10pim: 0,
  };

  teamsData.forEach((team) => {
    const stats = team.lastTenGames[0].lastTenGames[0];
    for (const stat in sumsOfSquaredDifferences) {
      if (sumsOfSquaredDifferences.hasOwnProperty(stat)) {
        let difference = stats[stat] - leagueAverages[stat];
        // @ts-ignore
        sumsOfSquaredDifferences[stat] += difference * difference;
      }
    }
  });

  let stdDeviations: any = {};
  const numberOfTeams = teamsData.length;
  for (const stat in sumsOfSquaredDifferences) {
    if (sumsOfSquaredDifferences.hasOwnProperty(stat)) {
      stdDeviations[stat] = Math.sqrt(
        // @ts-ignore
        sumsOfSquaredDifferences[stat] / numberOfTeams
      );
    }
  }

  return stdDeviations;
}

function calculatePowerScores(
  teamsData: any[],
  leagueAverages: any,
  leagueStdDeviations: any
) {
  // Define weights for each stat
  const statWeights = {
    L10ptsPct: 10,
    L10goalsFor: 6,
    L10goalsAgainst: 4,
    L10shotsFor: 2,
    L10shotsAgainst: 2,
    L10powerPlay: 10,
    L10penaltyKill: 2,
    L10powerPlayOpportunities: 4,
    L10hits: 1,
    L10blocks: 1,
    L10pim: 1,
  };

  return teamsData.map((team) => {
    const stats = team.lastTenGames[0].lastTenGames[0];
    let powerScore = 0;

    for (const stat in leagueAverages) {
      if (leagueAverages.hasOwnProperty(stat)) {
        const zScore =
          (stats[stat] - leagueAverages[stat]) / leagueStdDeviations[stat];
        // @ts-ignore
        const weightedZScore = zScore * statWeights[stat];

        if (stat === "L10goalsAgainst" || stat === "L10shotsAgainst") {
          powerScore -= weightedZScore; // Negate the score for these stats
        } else {
          powerScore += weightedZScore;
        }
      }
    }

    return { ...team, powerScore };
  });
}

const getColorClass = (rank: string) => {
  // Check if the rank has 'T-' prefix and remove it
  const cleanRank = rank.startsWith("T-") ? rank.substring(2) : rank;

  // Convert the cleaned rank to a number for calculation
  const numericRank = Number(cleanRank);

  // If you add more colors, change * 10 to * n where n is the number of colors
  const scaledRank = Math.ceil((numericRank / 32) * 32);
  return `rank-color-${scaledRank}`;
};

export default Stats;
