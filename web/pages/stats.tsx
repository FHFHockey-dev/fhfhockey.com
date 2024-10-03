// C:\Users\timbr\OneDrive\Desktop\fhfhockey.com-3\web\pages\stats.tsx

import React, { useMemo, useState, useRef } from "react";
import { NextSeo } from "next-seo";

import Container from "components/Layout/Container";
import { getTeams } from "lib/NHL/server";
import StrengthOfSchedule from "components/TeamLandingPage/StrengthOfSchedule";
import { Team } from "lib/NHL/types";
import useScreenSize, { BreakPoint } from "hooks/useScreenSize";
import ClientOnly from "components/ClientOnly";
import supabase from "lib/supabase";
import GoalieTrends from "components/TeamLandingPage/goalieTrends";

import { fetchAllRows } from "utils/fetchAllRows";

type StatsProps = {
  teams: Team[];
  pastSoSRankings: SoS[];
  futureSoSRankings: SoS[];
  teamPowerRankings: PowerRanking[];
};

type SoS = {
  team: string;
  sos: number;
};

type PowerRanking = {
  team_id: number;
  team_name: string;
  power_score: number;
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
      // Sort teams by powerScore in descending order
      const sorted = [...sortedTeamPowerRankings].sort(
        (a, b) => b.power_score - a.power_score
      );

      // Assign ranks
      return sorted.map((team, index) => ({
        ...team,
        rank: index + 1,
      }));
    } else {
      return [];
    }
  }, [sortedTeamPowerRankings]);

  const sortDataBy = (key: string, direction: Direction) => {
    const sortedData = [...sortedTeamPowerRankings].sort((a, b) => {
      const aValue = a[key as keyof PowerRanking];
      const bValue = b[key as keyof PowerRanking];

      if (aValue === undefined) return direction === "ascending" ? 1 : -1;
      if (bValue === undefined) return direction === "ascending" ? -1 : 1;

      if (typeof aValue === "number" && typeof bValue === "number") {
        return direction === "ascending" ? aValue - bValue : bValue - aValue;
      }

      return 0;
    });
    setSortedTeamPowerRankings(sortedData);
  };

  const requestSort = (key: string) => {
    let direction: Direction = "ascending";
    if (key === "power_score") {
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
      const scrollAmount = 250; // Adjust as needed
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
          style={{
            display: "flex",
            alignItems: "flex-start",
            flexDirection: isMobileView ? "column" : "row",
          }}
        >
          {isMobileView && (
            <>
              <div className="goalie-trends-container">
                <GoalieTrends />
              </div>
              <div className="sos-tables-container">
                <div className="sos-container">
                  <h2>
                    Strength of Schedule -{" "}
                    <span className="spanColorBlue">Past</span>
                  </h2>
                  <StrengthOfSchedule type="past" rankings={pastSoSRankings} />
                </div>

                <div className="sos-container">
                  <h2>
                    Strength of Schedule -{" "}
                    <span className="spanColorBlue">Future</span>
                  </h2>
                  <StrengthOfSchedule
                    type="future"
                    rankings={futureSoSRankings}
                  />
                </div>
              </div>
            </>
          )}

          {!isMobileView && (
            <>
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
                <StrengthOfSchedule
                  type="future"
                  rankings={futureSoSRankings}
                />
              </div>
            </>
          )}
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
                  <th onClick={() => requestSort("power_score")}>
                    Power Score
                  </th>
                </tr>
              </thead>
              <tbody>
                {fantasyPowerRankings.map((team) => (
                  <tr key={team.team_id} className="team-ranks-row">
                    <td>{team.rank}</td>
                    <td>
                      <img
                        className="tableImg"
                        src={`https://assets.nhle.com/logos/nhl/svg/${
                          teams.find((t) => t.id === team.team_id)?.abbreviation
                        }_light.svg`}
                        alt={`${team.team_name} Logo`}
                        style={{
                          width: "22px",
                          height: "22px",
                          marginRight: "10px",
                        }}
                      />
                      {team.team_name}
                    </td>
                    <td>{team.power_score.toFixed(2)}</td>
                  </tr>
                ))}
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
                  <th>Power Score</th>
                </tr>
              </thead>
              <tbody>
                {fantasyPowerRankings.map((team, index) => (
                  <tr key={team.team_id} className="fantasy-power-ranks-row">
                    <td>{index + 1}</td>
                    <td>
                      <div className="team-logo-container">
                        <img
                          src={`https://assets.nhle.com/logos/nhl/svg/${
                            teams.find((t) => t.id === team.team_id)
                              ?.abbreviation
                          }_dark.svg`}
                          alt={`${team.team_name} Logo`}
                        />
                      </div>
                      <ClientOnly>
                        {!isMobileView && (
                          <div className="team-label-container">
                            {team.team_name}
                          </div>
                        )}
                      </ClientOnly>
                    </td>
                    <td>{team.power_score.toFixed(2)}</td>
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
  console.log("getStaticProps started"); // Server-side log

  // 1. Fetch current season's teams
  const teams: Team[] = await getTeams();
  console.log("Fetched teams:", teams.length);

  // 2. Fetch sos_standings data with necessary fields, including game_date
  const sosStandingsData = await fetchAllRows<any>(
    supabase,
    "sos_standings",
    `
      team_id,
      team_name,
      game_date,
      past_opponent_total_wins,
      past_opponent_total_losses,
      past_opponent_total_ot_losses,
      future_opponent_total_wins,
      future_opponent_total_losses,
      future_opponent_total_ot_losses
    `
  );

  if (!sosStandingsData || sosStandingsData.length === 0) {
    console.error("No sos_standings data found.");
    return {
      props: {
        teams,
        pastSoSRankings: [],
        futureSoSRankings: [],
        teamPowerRankings: [],
      },
      revalidate: 3600, // Revalidate every hour
    };
  }

  console.log("Fetched sos_standings data:", sosStandingsData.length);

  // 3. Group data by team_id
  const sosStandingsPerTeam = new Map<number, any[]>();

  sosStandingsData.forEach((standing: any) => {
    const teamId = standing.team_id;
    let teamStandings = sosStandingsPerTeam.get(teamId);
    if (!teamStandings) {
      teamStandings = [];
      sosStandingsPerTeam.set(teamId, teamStandings);
    }
    teamStandings.push(standing);
  });

  // 4. Prepare SoS Rankings using the latest valid data per team
  const pastSoSRankings: SoS[] = [];
  const futureSoSRankings: SoS[] = [];

  sosStandingsPerTeam.forEach((standingsList: any[], teamId: number) => {
    // Sort standingsList by game_date descending
    standingsList.sort(
      (a, b) =>
        new Date(b.game_date).getTime() - new Date(a.game_date).getTime()
    );

    let validStanding = null;

    for (const standing of standingsList) {
      const {
        past_opponent_total_wins,
        past_opponent_total_losses,
        past_opponent_total_ot_losses,
        future_opponent_total_wins,
        future_opponent_total_losses,
        future_opponent_total_ot_losses,
      } = standing;

      const pastTotalsSum =
        past_opponent_total_wins +
        past_opponent_total_losses +
        past_opponent_total_ot_losses;
      const futureTotalsSum =
        future_opponent_total_wins +
        future_opponent_total_losses +
        future_opponent_total_ot_losses;

      if (pastTotalsSum !== 0 || futureTotalsSum !== 0) {
        validStanding = standing;
        break; // Exit the loop as we've found the latest valid standing
      }
    }

    if (validStanding) {
      const {
        team_name,
        past_opponent_total_wins,
        past_opponent_total_losses,
        past_opponent_total_ot_losses,
        future_opponent_total_wins,
        future_opponent_total_losses,
        future_opponent_total_ot_losses,
      } = validStanding;

      // Calculate past SoS (Opponent Winning Percentage)
      const pastTotalGames =
        past_opponent_total_wins +
        past_opponent_total_losses +
        past_opponent_total_ot_losses;
      const pastOWP =
        pastTotalGames > 0 ? past_opponent_total_wins / pastTotalGames : 0;

      pastSoSRankings.push({
        team: team_name,
        sos: parseFloat(pastOWP.toFixed(3)),
      });

      // Calculate future SoS
      const futureTotalGames =
        future_opponent_total_wins +
        future_opponent_total_losses +
        future_opponent_total_ot_losses;
      const futureOWP =
        futureTotalGames > 0
          ? future_opponent_total_wins / futureTotalGames
          : 0;

      futureSoSRankings.push({
        team: team_name,
        sos: parseFloat(futureOWP.toFixed(3)),
      });
    } else {
      // If no valid standing found, log a warning
      console.warn(
        `No valid standings with non-zero opponent totals found for team_id ${teamId}`
      );
    }
  });

  // 5. Sort the SoS rankings
  pastSoSRankings.sort((a, b) => b.sos - a.sos);
  futureSoSRankings.sort((a, b) => b.sos - a.sos);

  // 6. Fetch Power Rankings from Supabase
  const powerRankingsData = await fetchAllRows<any>(
    supabase,
    "power_rankings",
    `
      team_id,
      team_name,
      power_score
    `
  );

  if (!powerRankingsData || powerRankingsData.length === 0) {
    console.error("No power_rankings data found.");
    return {
      props: {
        teams,
        pastSoSRankings,
        futureSoSRankings,
        teamPowerRankings: [],
      },
      revalidate: 3600, // Revalidate every hour
    };
  }

  console.log("Fetched power_rankings data:", powerRankingsData.length);

  // 7. Process Power Rankings
  const teamPowerRankings = powerRankingsData.map((team: any) => ({
    team_id: team.team_id,
    team_name: team.team_name,
    power_score: team.power_score,
  }));

  console.log("getStaticProps completed"); // Server-side log

  return {
    props: {
      teams,
      pastSoSRankings,
      futureSoSRankings,
      teamPowerRankings,
    },
    revalidate: 3600, // 1 hour in seconds
  };
}

export default Stats;
