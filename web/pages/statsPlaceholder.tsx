// C:\Users\timbr\OneDrive\Desktop\fhfhockey.com-3\web\pages\statsPlaceholder.tsx

import React, { useMemo, useState, useRef } from "react";
import { NextSeo } from "next-seo";

import Container from "components/Layout/Container";
import LegacySurfaceNotice from "components/LegacySurfaceNotice/LegacySurfaceNotice";
import { getCurrentSeason, getTeams } from "lib/NHL/server";
import StrengthOfSchedule from "components/TeamLandingPage/StrengthOfSchedule";
import { Team } from "lib/NHL/types";
import useScreenSize, { BreakPoint } from "hooks/useScreenSize";
import ClientOnly from "components/ClientOnly";
import supabase from "lib/supabase";
import type { SupabaseClient } from "@supabase/supabase-js";
import GoalieTrends from "components/TeamLandingPage/goalieTrends";

import { fetchAllRows } from "utils/fetchAllRows";
import {
  buildCanonicalSosRankingsV2,
  TEAM_SOS_READER_COLUMNS,
  type CanonicalSosRanking,
  type TeamSosReaderRow,
} from "lib/trends/strengthOfSchedule";
import { DESCRIPTIVE_SOS_VERSION } from "lib/trends/strengthOfScheduleContract";
import { TEAM_SOS_TABLE } from "lib/trends/teamSosSnapshot";

type StatsProps = {
  teams: Team[];
  pastSoSRankings: CanonicalSosRanking[];
  futureSoSRankings: CanonicalSosRanking[];
  teamPowerRankings: PowerRanking[];
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
        (a, b) => b.power_score - a.power_score,
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
      <LegacySurfaceNotice
        replacementHref="/underlying-stats"
        replacementLabel="Underlying Stats"
      >
        This bookmark-compatible team catalogue is retained for historical reference.
        Current team analysis lives in Underlying Stats.
      </LegacySurfaceNotice>

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
  // 1. Resolve one started season and its canonical current team membership.
  const currentSeason = await getCurrentSeason();
  const teams: Team[] = await getTeams(currentSeason.seasonId, {
    mode: "current-canonical",
  });

  // 2. Latest descriptive-sos-v2 snapshot for that season (v1 sos_standings
  //    rows are issued history and are not served).
  let sosRows: TeamSosReaderRow[] = [];
  // team_sos_daily joins the generated types once its migration is applied.
  const sosDb = supabase as unknown as SupabaseClient<any>;
  try {
    const latest = await sosDb
      .from(TEAM_SOS_TABLE)
      .select("snapshot_date")
      .eq("season_id", currentSeason.seasonId)
      .eq("sos_version", DESCRIPTIVE_SOS_VERSION)
      .order("snapshot_date", { ascending: false })
      .limit(1);
    if (latest.error) throw latest.error;
    const snapshotDate = latest.data?.[0]?.snapshot_date;
    if (snapshotDate) {
      const snapshot = await sosDb
        .from(TEAM_SOS_TABLE)
        .select(TEAM_SOS_READER_COLUMNS)
        .eq("season_id", currentSeason.seasonId)
        .eq("sos_version", DESCRIPTIVE_SOS_VERSION)
        .eq("snapshot_date", snapshotDate);
      if (snapshot.error) throw snapshot.error;
      sosRows = (snapshot.data as unknown as TeamSosReaderRow[]) ?? [];
    }
  } catch (error) {
    console.error("Unable to load current-season team SOS (v2) data.", error);
  }

  if (sosRows.length === 0) {
    console.error("No descriptive-sos-v2 snapshot found.");
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

  // 3. Canonical team membership owns identity and excludes retired IDs.
  const { past: pastSoSRankings, future: futureSoSRankings } =
    buildCanonicalSosRankingsV2(sosRows, teams);

  // 4. Fetch Power Rankings from Supabase
  const powerRankingsData = await fetchAllRows<any>(
    supabase,
    "power_rankings",
    `
      team_id,
      team_name,
      power_score
    `,
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

  // 5. Process Power Rankings
  const teamPowerRankings = powerRankingsData.map((team: any) => ({
    team_id: team.team_id,
    team_name: team.team_name,
    power_score: team.power_score,
  }));

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
