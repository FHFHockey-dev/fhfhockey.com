// @ts-nocheck
// PATH: web/pages/game/[gameId].tsx
import { useRouter } from "next/router";
import { useEffect, useState } from "react";
import Fetch from "lib/cors-fetch";
import { teamsInfo } from "lib/NHL/teamsInfo";
import PoissonDistributionChart from "./PoissonDistributionChart";

export default function Page() {
  const router = useRouter();
  const { gameId } = router.query;
  const [gameDetails, setGameDetails] = useState(null);
  const [gameLandingDetails, setGameLandingDetails] = useState(null); // Added state for game landing details
  const [homeTeamStats, setHomeTeamStats] = useState({});
  const [awayTeamStats, setAwayTeamStats] = useState({});
  const [homeTeamPowerPlayStats, setHomeTeamPowerPlayStats] = useState({});
  const [awayTeamPowerPlayStats, setAwayTeamPowerPlayStats] = useState({});
  const [chartData, setChartData] = useState([]); // Initialize chartData as part of the component's state

  useEffect(() => {
    async function fetchGameDetails() {
      if (!gameId) return;
      const endpointURL = `https://api-web.nhle.com/v1/gamecenter/${gameId}/boxscore`;
      try {
        const response = await Fetch(endpointURL).then((res) => res.json());
        setGameDetails(response);
        fetchTeamStats(response.homeTeam.abbrev, "home");
        fetchTeamStats(response.awayTeam.abbrev, "away");
        fetchPowerPlayStats(response.homeTeam.abbrev, "home");
        fetchPowerPlayStats(response.awayTeam.abbrev, "away");
        console.log("(response) Game details:", response);
      } catch (error) {
        console.error("Error fetching game details:", error);
      }
    }

    async function fetchGameLandingDetails() {
      if (!gameId) return;
      const landingURL = `https://api-web.nhle.com/v1_1/gamecenter/${gameId}/landing`;
      try {
        const landingResponse = await Fetch(landingURL).then((res) =>
          res.json()
        );
        setGameLandingDetails(landingResponse); // Update state with fetched game landing details
        console.log("(landingResponse) Game landing details:", landingResponse);
        console.log("Summary:", landingResponse.summary);
      } catch (error) {
        console.error("Error fetching game landing details:", error);
      }
    }

    fetchGameDetails();
    fetchGameLandingDetails();
  }, [gameId]);

  async function fetchTeamStats(teamAbbreviation, teamType) {
    const franchiseId = teamsInfo[teamAbbreviation]?.franchiseId;
    if (!franchiseId) return;

    const statsURL = `https://api.nhle.com/stats/rest/en/team/summary?isAggregate=false&isGame=false&sort=[{"property":"points","direction":"DESC"},{"property":"wins","direction":"DESC"},{"property":"teamId","direction":"ASC"}]&start=0&limit=50&factCayenneExp=gamesPlayed>=1&cayenneExp=franchiseId=${franchiseId} and gameTypeId=2 and seasonId<=20232024 and seasonId>=20232024`;
    try {
      const response = await Fetch(statsURL).then((res) => res.json());
      const statsData = response.data[0]; // Assuming the first object contains the relevant stats
      if (teamType === "home") {
        setHomeTeamStats(statsData);
      } else {
        setAwayTeamStats(statsData);
      }
    } catch (error) {
      console.error(`Error fetching ${teamType} team stats:`, error);
    }
  }

  async function fetchPowerPlayStats(teamAbbreviation, teamType) {
    // Match the teamID from teamsInfo to fetch the correct stats
    const teamId = teamsInfo[teamAbbreviation]?.id;
    if (!teamId) return;

    const powerPlayStatsURL = `https://api.nhle.com/stats/rest/en/team/powerplay?isAggregate=false&isGame=false&sort=[{"property":"powerPlayPct","direction":"DESC"}]&start=0&limit=50&factCayenneExp=gamesPlayed>=1&cayenneExp=gameTypeId=2 and seasonId<=20232024 and seasonId>=20232024`;
    try {
      const response = await Fetch(powerPlayStatsURL).then((res) => res.json());
      // Use the teamId to find the relevant team's stats
      const powerPlayStats = response.data.find(
        (stat) => stat.teamId == teamId
      ); // Ensure the comparison is correct for the data type (== or === depending on data type consistency)
      console.log("powerPlayStats:", powerPlayStats);
      if (!powerPlayStats) {
        console.error(`No power play stats found for teamId: ${teamId}`);
        return; // Early return if no stats found for the team
      }
      if (teamType === "home") {
        setHomeTeamPowerPlayStats(powerPlayStats);
      } else {
        setAwayTeamPowerPlayStats(powerPlayStats);
      }
    } catch (error) {
      console.error(`Error fetching ${teamType} team power play stats:`, error);
    }
  }

  const formatTime = (totalSeconds) => {
    if (totalSeconds === undefined || totalSeconds === null) {
      return "-";
    }
    const minutes = Math.floor(totalSeconds / 60);
    const seconds = Math.round(totalSeconds % 60);
    return `${minutes}:${seconds.toString().padStart(2, "0")}`;
  };

  const getAdvantage = (
    homeStat,
    awayStat,
    label,
    statKey,
    isLowerBetter = false
  ) => {
    // Determine the team with the advantage
    let advantageTeam = isLowerBetter
      ? homeStat < awayStat
        ? "home"
        : "away"
      : homeStat > awayStat
      ? "home"
      : "away";

    // Determine the team colors based on which team has the advantage
    let teamColors = advantageTeam === "home" ? homeTeamColors : awayTeamColors;
    let abbreviation =
      advantageTeam === "home"
        ? gameDetails.homeTeam.abbrev
        : gameDetails.awayTeam.abbrev;

    // Return the table cell with the appropriate styling and information
    return (
      <td
        style={{
          backgroundColor: teamColors.primaryColor,
          color: teamColors.secondaryColor,
          borderLeft: `2px solid ${teamColors.secondaryColor}`,
          borderRight: `2px solid ${teamColors.secondaryColor}`,
          borderBottom: `2px solid white`,
        }}
      >
        {label}:
        <br />
        {abbreviation}
      </td>
    );
  };

  const homeTeamRecord = gameLandingDetails?.homeTeam?.record;
  const awayTeamRecord = gameLandingDetails?.awayTeam?.record;

  // Extract team abbreviations to access team colors
  const homeTeamAbbreviation = gameDetails?.homeTeam?.abbrev;
  const awayTeamAbbreviation = gameDetails?.awayTeam?.abbrev;

  // Access team colors using abbreviations
  const homeTeamColors = teamsInfo[homeTeamAbbreviation] || {};
  const awayTeamColors = teamsInfo[awayTeamAbbreviation] || {};

  const ComparisonBar = ({ homeStat, awayStat, homeColor, awayColor }) => {
    const { homePercentage, awayPercentage } = calculatePercentage(
      homeStat,
      awayStat
    );
    const gradientBackground = `linear-gradient(115deg, ${homeColor} ${
      homePercentage - 2
    }%, #303030 ${homePercentage - 2}%, #303030 ${
      homePercentage + 2
    }%, ${awayColor} ${homePercentage + 2}%)`;

    return (
      <div
        className="comparisonBar"
        style={{
          display: "flex",
          width: "100%",
          backgroundImage: gradientBackground,
        }}
      />
    );
  };

  const StatRow = ({
    statLabel,
    homeStat,
    awayStat,
    isLowerBetter = false,
    homeTeamColors,
    awayTeamColors,
  }) => {
    // Determine the team with the advantage

    let advantageTeam = isLowerBetter
      ? homeStat < awayStat
        ? "home"
        : "away"
      : homeStat > awayStat
      ? "home"
      : "away";

    const advantage = getAdvantage(
      homeStat,
      awayStat,
      statLabel,
      statLabel.toLowerCase().replace(/\s/g, ""),
      isLowerBetter
    );

    // Calculate the percentage representation for the comparison bar
    const { homePercentage, awayPercentage } = calculatePercentage(
      homeStat,
      awayStat
    );

    return (
      <div
        className="statRow"
        style={{
          "--home-primary-color": homeTeamColors.primaryColor,
          "--home-secondary-color": homeTeamColors.secondaryColor,
          "--home-jersey-color": homeTeamColors.jersey,
          "--home-accent-color": homeTeamColors.accent,
          "--home-alt-color": homeTeamColors.alt,
          "--away-primary-color": awayTeamColors.primaryColor,
          "--away-secondary-color": awayTeamColors.secondaryColor,
          "--away-jersey-color": awayTeamColors.jersey,
          "--away-accent-color": awayTeamColors.accent,
          "--away-alt-color": awayTeamColors.alt,
        }}
      >
        <div className="statRowHeader">
          <div className="statValue homeValue">{homeStat}</div>
          <div className={`statLabel ${advantageTeam}-advantage`}>
            {statLabel}
          </div>
          <div className="statValue awayValue">{awayStat}</div>
        </div>
        <div className="statBarContainer">
          <ComparisonBar
            homeStat={homeStat}
            awayStat={awayStat}
            homeColor={homeTeamColors?.primaryColor || "#FFFFFF"} // Default to white if undefined
            awayColor={awayTeamColors?.secondaryColor || "#FFFFFF"}
          />
        </div>
        <div
          className="emptyGPvs"
          style={{
            height: "20px",
            width: "100%",
            display: "flex",
            borderBottom: "3px double #FFF",
          }}
        >
          {" "}
        </div>
      </div>
    );
  };

  const calculatePercentage = (homeStat, awayStat) => {
    const total = parseFloat(homeStat) + parseFloat(awayStat);
    if (total === 0) {
      // Avoid division by zero; treat as equal if both are 0
      return { homePercentage: 50, awayPercentage: 50 };
    }
    const homePercentage = (parseFloat(homeStat) / total) * 100;
    const awayPercentage = (parseFloat(awayStat) / total) * 100;
    return { homePercentage, awayPercentage };
  };

  ///////////////////////// CHART STUFF //////////////////////////////
  // Prepare the data for PoissonDistributionChart

  const l10pointsPct = (teamType) => {
    // Check if gameLandingDetails and gameLandingDetails.matchup are loaded
    if (!gameLandingDetails || !gameLandingDetails.matchup) {
      return 0; // Return a default value or handle this case as needed
    }

    // Determine which team's record to use based on the teamType parameter
    const last10Record =
      teamType === "home"
        ? gameLandingDetails?.matchup?.last10Record?.homeTeam?.record
        : gameLandingDetails?.matchup?.last10Record?.awayTeam?.record;

    // Split the record string into wins, losses, and overtime losses
    const [wins, losses, overtimeLosses] = last10Record
      .split("-")
      .map((num) => parseInt(num, 10));

    // Calculate the points achieved in the last 10 games
    const points = wins * 2 + overtimeLosses; // Assuming 2 points for a win and 1 point for an overtime loss

    // Calculate the points percentage
    const totalPossiblePoints = 10 * 2; // 10 games, 2 points possible per game
    return points / totalPossiblePoints;
  };

  useEffect(() => {
    // Verify all dependencies are loaded
    if (
      gameDetails &&
      homeTeamStats &&
      awayTeamStats &&
      homeTeamPowerPlayStats &&
      awayTeamPowerPlayStats
    ) {
      // Compute chartData here and then set it in state
      const computedChartData = [
        {
          team: gameDetails?.homeTeam?.abbrev || "",
          logo: gameDetails?.homeTeam?.logo || "",
          goalsForPerGame: homeTeamStats?.goalsForPerGame || 0,
          goalsAgainstPerGame: homeTeamStats?.goalsAgainstPerGame || 0,
          shotsForPerGame: homeTeamStats?.shotsForPerGame || 0,
          shotsAgainstPerGame: homeTeamStats?.shotsAgainstPerGame || 0,
          powerPlayPercentage: homeTeamPowerPlayStats?.powerPlayPct || 0,
          penaltyKillPercentage: homeTeamStats?.penaltyKillPct || 0,
          powerPlayGoalsPerGame: homeTeamPowerPlayStats?.ppGoalsPerGame || 0,
          powerPlayOpportunitesPerGame:
            homeTeamPowerPlayStats?.ppOpportunitiesPerGame || 0,
          shGoalsAgainstPerGame:
            homeTeamPowerPlayStats?.shGoalsAgainstPerGame || 0,
          l10ptsPct: l10pointsPct("home"),
          seasonSeriesWins:
            gameLandingDetails?.matchup?.seasonSeriesWins?.homeTeamWins || 0,
        },
        {
          team: gameDetails?.awayTeam?.abbrev || "",
          logo: gameDetails?.awayTeam?.logo || "",
          goalsForPerGame: awayTeamStats?.goalsForPerGame || 0,
          goalsAgainstPerGame: awayTeamStats?.goalsAgainstPerGame || 0,
          shotsForPerGame: awayTeamStats?.shotsForPerGame || 0,
          shotsAgainstPerGame: awayTeamStats?.shotsAgainstPerGame || 0,
          powerPlayPercentage: awayTeamPowerPlayStats?.powerPlayPct || 0,
          penaltyKillPercentage: awayTeamStats?.penaltyKillPct || 0,
          powerPlayGoalsPerGame: awayTeamPowerPlayStats?.ppGoalsPerGame || 0,
          powerPlayOpportunitesPerGame:
            awayTeamPowerPlayStats?.ppOpportunitiesPerGame || 0,
          shGoalsAgainstPerGame:
            awayTeamPowerPlayStats?.shGoalsAgainstPerGame || 0,
          l10ptsPct: l10pointsPct("away"),
          seasonSeriesWins:
            gameLandingDetails?.matchup?.seasonSeriesWins?.awayTeamWins || 0,
        },
      ];
      setChartData(computedChartData);
    }
  }, [
    gameDetails,
    homeTeamStats,
    awayTeamStats,
    homeTeamPowerPlayStats,
    awayTeamPowerPlayStats,
    gameLandingDetails,
  ]); // Ensure all dependencies are listed

  if (
    gameLandingDetails?.gameState === "FUT" ||
    gameLandingDetails?.gameState === "PRE"
  ) {
    return (
      <div className="game-page">
        {gameDetails ? (
          <>
            <div className="gameDetailsContainer">
              <div
                className="gamePageCard"
                style={{
                  "--home-primary-color": homeTeamColors.primaryColor,
                  "--home-secondary-color": homeTeamColors.secondaryColor,
                  "--home-jersey-color": homeTeamColors.jersey,
                  "--home-accent-color": homeTeamColors.accent,
                  "--home-alt-color": homeTeamColors.alt,
                  "--away-primary-color": awayTeamColors.primaryColor,
                  "--away-secondary-color": awayTeamColors.secondaryColor,
                  "--away-jersey-color": awayTeamColors.jersey,
                  "--away-accent-color": awayTeamColors.accent,
                  "--away-alt-color": awayTeamColors.alt,
                }}
              >
                <div className="gamePageCardLeft">
                  <img
                    className="teamLogoHome"
                    src={gameDetails.homeTeam.logo}
                    alt={`${gameDetails.homeTeam.name.default} logo`}
                  />
                  <span className="team-nameGPvs home-team">
                    {gameDetails.homeTeam.name.default}
                  </span>
                </div>
                <span className="GPvs">VS</span>
                <div className="gamePageCardRight">
                  <span className="team-nameGPvs away-team">
                    {gameDetails.awayTeam.name.default}
                  </span>
                  <img
                    className="teamLogoAway"
                    src={gameDetails.awayTeam.logo}
                    alt={`${gameDetails.awayTeam.name.default} logo`}
                  />
                </div>
              </div>
            </div>

            <div className="statsAndPlayerCompContainer">
              {/* ///////////////////////////////// STAT ROW ///////////////////////////////////////////////////////// */}
              <div className="gamePageVsTableContainer">
                <div className="gamePageVsTable">
                  <div
                    className="statTableHeader"
                    style={{
                      "--home-primary-color": homeTeamColors.primaryColor,
                      "--home-secondary-color": homeTeamColors.secondaryColor,
                      "--home-jersey-color": homeTeamColors.jersey,
                      "--home-accent-color": homeTeamColors.accent,
                      "--home-alt-color": homeTeamColors.alt,
                      "--away-primary-color": awayTeamColors.primaryColor,
                      "--away-secondary-color": awayTeamColors.secondaryColor,
                      "--away-jersey-color": awayTeamColors.jersey,
                      "--away-accent-color": awayTeamColors.accent,
                      "--away-alt-color": awayTeamColors.alt,
                    }}
                  >
                    <div className="statTableLeft">
                      <img
                        className="teamLogoHomeStatTable"
                        src={gameDetails.homeTeam.logo}
                        alt={`${gameDetails.homeTeam.name.default} logo`}
                        style={{ width: "40px" }}
                      />
                    </div>
                    <span className="advantageHeaderText">Advantage</span>

                    <div className="statTableRight">
                      <img
                        className="teamLogoAwayStatTable"
                        src={gameDetails.awayTeam.logo}
                        alt={`${gameDetails.awayTeam.name.default} logo`}
                        style={{ width: "40px" }}
                      />
                    </div>
                  </div>
                  {/* Use StatRow for each statistic you want to display */}
                  <StatRow
                    statLabel="WINS"
                    homeStat={homeTeamStats.wins}
                    awayStat={awayTeamStats.wins}
                    homeTeamColors={homeTeamColors}
                    awayTeamColors={awayTeamColors}
                  />
                  <StatRow
                    statLabel="GF/GM"
                    homeStat={
                      homeTeamStats.goalsForPerGame
                        ? homeTeamStats.goalsForPerGame.toFixed(2)
                        : "-"
                    }
                    awayStat={
                      awayTeamStats.goalsForPerGame
                        ? awayTeamStats.goalsForPerGame.toFixed(2)
                        : "-"
                    }
                    homeTeamColors={homeTeamColors}
                    awayTeamColors={awayTeamColors}
                  />
                  <StatRow
                    statLabel="GA/GM"
                    homeStat={
                      homeTeamStats.goalsAgainstPerGame
                        ? homeTeamStats.goalsAgainstPerGame.toFixed(2)
                        : "-"
                    }
                    awayStat={
                      awayTeamStats.goalsAgainstPerGame
                        ? awayTeamStats.goalsAgainstPerGame.toFixed(2)
                        : "-"
                    }
                    isLowerBetter // Lower is better for goals against
                    homeTeamColors={homeTeamColors}
                    awayTeamColors={awayTeamColors}
                  />
                  <StatRow
                    statLabel="PP%"
                    homeStat={
                      homeTeamPowerPlayStats.powerPlayPct
                        ? (homeTeamPowerPlayStats.powerPlayPct * 100).toFixed(
                            1
                          ) + "%"
                        : "-"
                    }
                    awayStat={
                      awayTeamPowerPlayStats.powerPlayPct
                        ? (awayTeamPowerPlayStats.powerPlayPct * 100).toFixed(
                            1
                          ) + "%"
                        : "-"
                    }
                    homeTeamColors={homeTeamColors}
                    awayTeamColors={awayTeamColors}
                  />
                  <StatRow
                    statLabel="PK%"
                    homeStat={
                      homeTeamStats.penaltyKillPct
                        ? (homeTeamStats.penaltyKillPct * 100).toFixed(1) + "%"
                        : "-"
                    }
                    awayStat={
                      awayTeamStats.penaltyKillPct
                        ? (awayTeamStats.penaltyKillPct * 100).toFixed(1) + "%"
                        : "-"
                    }
                    homeTeamColors={homeTeamColors}
                    awayTeamColors={awayTeamColors}
                  />
                  <StatRow
                    statLabel="SF/GM"
                    homeStat={
                      homeTeamStats.shotsForPerGame
                        ? homeTeamStats.shotsForPerGame.toFixed(1)
                        : "-"
                    }
                    awayStat={
                      awayTeamStats.shotsForPerGame
                        ? awayTeamStats.shotsForPerGame.toFixed(1)
                        : "-"
                    }
                    homeTeamColors={homeTeamColors}
                    awayTeamColors={awayTeamColors}
                  />
                  <StatRow
                    statLabel="SA/GM"
                    homeStat={
                      homeTeamStats.shotsAgainstPerGame
                        ? homeTeamStats.shotsAgainstPerGame.toFixed(1)
                        : "-"
                    }
                    awayStat={
                      awayTeamStats.shotsAgainstPerGame
                        ? awayTeamStats.shotsAgainstPerGame.toFixed(1)
                        : "-"
                    }
                    isLowerBetter // Lower is better for shots against
                    homeTeamColors={homeTeamColors}
                    awayTeamColors={awayTeamColors}
                  />
                  <StatRow
                    statLabel="PPO/GM"
                    homeStat={
                      homeTeamPowerPlayStats.ppOpportunitiesPerGame
                        ? homeTeamPowerPlayStats.ppOpportunitiesPerGame.toFixed(
                            2
                          )
                        : "-"
                    }
                    awayStat={
                      awayTeamPowerPlayStats.ppOpportunitiesPerGame
                        ? awayTeamPowerPlayStats.ppOpportunitiesPerGame.toFixed(
                            2
                          )
                        : "-"
                    }
                    homeTeamColors={homeTeamColors}
                    awayTeamColors={awayTeamColors}
                  />
                  <StatRow
                    statLabel="PPG/GM"
                    homeStat={
                      homeTeamPowerPlayStats.ppGoalsPerGame
                        ? homeTeamPowerPlayStats.ppGoalsPerGame.toFixed(2)
                        : "-"
                    }
                    awayStat={
                      awayTeamPowerPlayStats.ppGoalsPerGame
                        ? awayTeamPowerPlayStats.ppGoalsPerGame.toFixed(2)
                        : "-"
                    }
                    homeTeamColors={homeTeamColors}
                    awayTeamColors={awayTeamColors}
                  />
                  <StatRow
                    statLabel="S%"
                    homeStat={
                      (
                        (homeTeamStats.goalsForPerGame /
                          homeTeamStats.shotsForPerGame) *
                        100
                      ).toFixed(1) + "%"
                    }
                    awayStat={
                      (
                        (awayTeamStats.goalsForPerGame /
                          awayTeamStats.shotsForPerGame) *
                        100
                      ).toFixed(1) + "%"
                    }
                    isLowerBetter
                    homeTeamColors={homeTeamColors}
                    awayTeamColors={awayTeamColors}
                  />
                  <StatRow
                    statLabel="SV%"
                    homeStat={
                      (
                        1 -
                        homeTeamStats.goalsAgainstPerGame /
                          homeTeamStats.shotsAgainstPerGame
                      )
                        .toFixed(3)
                        .replace(/^0+/, "") + "%"
                    }
                    awayStat={
                      (
                        1 -
                        awayTeamStats.goalsAgainstPerGame /
                          awayTeamStats.shotsAgainstPerGame
                      )
                        .toFixed(3)
                        .replace(/^0+/, "") + "%"
                    }
                    homeTeamColors={homeTeamColors}
                    awayTeamColors={awayTeamColors}
                  />
                </div>
              </div>
              <div
                className="statsPlayerAndGoalieCompContainer"
                style={{
                  display: "flex",
                  flexDirection: "column",
                  alignItems: "center",
                  width: "100%",
                }}
              >
                <div
                  className="playerCompContainer"
                  style={{
                    "--home-primary-color": homeTeamColors.primaryColor,
                    "--home-secondary-color": homeTeamColors.secondaryColor,
                    "--home-jersey-color": homeTeamColors.jersey,
                    "--home-accent-color": homeTeamColors.accent,
                    "--home-alt-color": homeTeamColors.alt,
                    "--away-primary-color": awayTeamColors.primaryColor,
                    "--away-secondary-color": awayTeamColors.secondaryColor,
                    "--away-jersey-color": awayTeamColors.jersey,
                    "--away-accent-color": awayTeamColors.accent,
                    "--away-alt-color": awayTeamColors.alt,
                  }}
                >
                  <div className="playerCompHeader">
                    <div className="playerCompHeaderLeft">
                      <img
                        className="teamLogoHomePC"
                        src={gameDetails.homeTeam.logo}
                        alt={`${gameDetails.homeTeam.name.default} logo`}
                        style={{ width: "75px" }}
                      />
                    </div>

                    <p>Last 5 Games</p>
                    <div className="playerCompHeaderRight">
                      <img
                        className="teamLogoAwayPC"
                        src={gameDetails.awayTeam.logo}
                        alt={`${gameDetails.awayTeam.name.default} logo`}
                        style={{ width: "75px" }}
                      />
                    </div>
                  </div>
                  {gameLandingDetails?.matchup?.teamLeadersL5
                    ?.filter(
                      (leader) => leader.category.toLowerCase() !== "plusminus"
                    )
                    .map((leader, index) => (
                      <div className="playerCompDetails" key={index}>
                        {/* Home player side */}
                        <div className="playerDetail homePlayer">
                          <img
                            src={leader.homeLeader.headshot}
                            alt="Home player headshot"
                            className="playerHeadshot"
                          />

                          <div className="playerStats">
                            <span>{leader.homeLeader.firstName.default}</span>
                            <span className="lastName">
                              {leader.homeLeader.lastName.default}
                            </span>
                            <span>
                              #{leader.homeLeader.sweaterNumber} •{" "}
                              {leader.homeLeader.positionCode}
                            </span>
                          </div>
                          <span className="value">
                            {leader.homeLeader.value}
                          </span>
                        </div>

                        {/* Vertical text between players */}
                        <div className="verticalText">
                          {leader.category.toUpperCase()}
                        </div>

                        {/* Away player side */}
                        <div className="playerDetail awayPlayer">
                          <span className="value">
                            {leader.awayLeader.value}
                          </span>
                          <div className="playerStats">
                            <span>{leader.awayLeader.firstName.default}</span>
                            <span className="lastName">
                              {leader.awayLeader.lastName.default}
                            </span>
                            <span>
                              {leader.awayLeader.positionCode} • #
                              {leader.awayLeader.sweaterNumber}
                            </span>
                            <img
                              src={leader.awayLeader.headshot}
                              alt="Away player headshot"
                              className="playerHeadshot"
                            />
                          </div>
                        </div>
                      </div>
                    ))}
                </div>

                {/* Goalie Comparison Container */}
                <div
                  className="goalieCompContainer"
                  style={{
                    "--home-primary-color": homeTeamColors.primaryColor,
                    "--home-secondary-color": homeTeamColors.secondaryColor,
                    "--home-jersey-color": homeTeamColors.jersey,
                    "--home-accent-color": homeTeamColors.accent,
                    "--home-alt-color": homeTeamColors.alt,
                    "--away-primary-color": awayTeamColors.primaryColor,
                    "--away-secondary-color": awayTeamColors.secondaryColor,
                    "--away-jersey-color": awayTeamColors.jersey,
                    "--away-accent-color": awayTeamColors.accent,
                    "--away-alt-color": awayTeamColors.alt,
                  }}
                >
                  {" "}
                  {/* Add some margin for spacing */}
                  <div className="goalieCompHeader">
                    <div className="goalieCompHeaderLeft">
                      <img
                        className="teamLogoHomePC"
                        src={gameDetails.homeTeam.logo}
                        alt={`${gameDetails.homeTeam.name.default} logo`}
                        style={{ width: "75px" }}
                      />
                    </div>
                    <p>Goalie Comparison</p>
                    <div className="goalieCompHeaderRight">
                      <img
                        className="teamLogoAwayPC"
                        src={gameDetails.awayTeam.logo}
                        alt={`${gameDetails.awayTeam.name.default} logo`}
                        style={{ width: "75px" }}
                      />
                    </div>
                  </div>
                  <div className="goalieStatsContainer">
                    <div className="homeGoalies">
                      {gameLandingDetails?.matchup?.goalieComparison?.homeTeam.map(
                        (goalie) => (
                          <div key={goalie.playerId} className="goalieStatRow">
                            <div className="goalieImage">
                              <img
                                src={goalie.headshot}
                                alt={`Headshot of ${goalie.name.default}`}
                              />
                            </div>
                            <div className="goalieName">
                              <span>{goalie.firstName.default}</span>{" "}
                              {/* First Name */}
                              <span className="goalieLastName">
                                {goalie.lastName.default}
                              </span>{" "}
                              {/* Last Name */}
                              <span className="goalieSweaterNumber">
                                #{goalie.sweaterNumber} • {goalie.positionCode}
                              </span>
                            </div>
                            <div className="homeGoalieStatHighlight">
                              <div className="goalieStatDetails">
                                <span className="spanGoalieValue">Record:</span>
                                <span className="spanGoalieStat">
                                  {goalie.record}
                                </span>
                              </div>
                              <div className="goalieStatDetails">
                                <span className="spanGoalieValue">GAA:</span>
                                <span className="spanGoalieStat">
                                  {goalie?.gaa?.toFixed(2)}
                                </span>
                              </div>
                              <div className="goalieStatDetails">
                                <span className="spanGoalieValue">SV%:</span>
                                <span className="spanGoalieStat">
                                  {goalie?.savePctg
                                    ?.toFixed(3)
                                    ?.replace(/^0+/, "")}
                                  %
                                </span>
                              </div>
                              <div className="goalieStatDetails">
                                <span className="spanGoalieValue">SO:</span>
                                <span className="spanGoalieStat">
                                  {goalie?.shutouts}
                                </span>
                              </div>
                            </div>
                          </div>
                        )
                      )}
                    </div>
                    <div className="awayGoalies">
                      {gameLandingDetails?.matchup?.goalieComparison?.awayTeam.map(
                        (goalie) => (
                          <div key={goalie.playerId} className="goalieStatRow">
                            <div className="awayGoalieStatHighlight">
                              <div className="goalieStatDetails">
                                <span className="spanGoalieValue">Record:</span>
                                <span className="spanGoalieStat">
                                  {goalie.record}
                                </span>
                              </div>
                              <div className="goalieStatDetails">
                                <span className="spanGoalieValue">GAA:</span>
                                <span className="spanGoalieStat">
                                  {goalie.gaa.toFixed(2)}
                                </span>
                              </div>
                              <div className="goalieStatDetails">
                                <span className="spanGoalieValue">SV%:</span>
                                <span className="spanGoalieStat">
                                  {goalie.savePctg
                                    .toFixed(3)
                                    .replace(/^0+/, "")}
                                  %
                                </span>
                              </div>
                              <div className="goalieStatDetails">
                                <span className="spanGoalieValue">SO:</span>
                                <span className="spanGoalieStat">
                                  {goalie.shutouts}
                                </span>
                              </div>
                            </div>
                            <div className="goalieName">
                              <span>{goalie.firstName.default}</span>{" "}
                              {/* First Name */}
                              <span className="goalieLastName">
                                {goalie.lastName.default}
                              </span>{" "}
                              <span className="goalieSweaterNumber">
                                #{goalie.sweaterNumber} • {goalie.positionCode}
                              </span>
                            </div>

                            <div className="goalieImage">
                              <img
                                src={goalie.headshot}
                                alt={`Headshot of ${goalie.name.default}`}
                              />
                            </div>
                          </div>
                        )
                      )}
                    </div>
                  </div>
                </div>
              </div>
            </div>
            {chartData.length > 0 ? (
              <div className="poissonChartContainer">
                <PoissonDistributionChart chartData={chartData} />
              </div>
            ) : (
              <div>Loading chart data...</div>
            )}
          </>
        ) : (
          <p>Loading game details...</p>
        )}
      </div>
    );
  } else if (
    gameLandingDetails?.gameState === "OFF" ||
    gameLandingDetails?.gameState === "OVER" ||
    gameLandingDetails?.gameState === "FINAL"
  ) {
    return (
      <div className="gameOverPage">
        {gameDetails ? (
          <>
            <div
              className="gameOverDetailsContainer"
              style={{
                "--home-primary-color": homeTeamColors.primaryColor,
                "--home-secondary-color": homeTeamColors.secondaryColor,
                "--home-jersey-color": homeTeamColors.jersey,
                "--home-accent-color": homeTeamColors.accent,
                "--home-alt-color": homeTeamColors.alt,
                "--away-primary-color": awayTeamColors.primaryColor,
                "--away-secondary-color": awayTeamColors.secondaryColor,
                "--away-jersey-color": awayTeamColors.jersey,
                "--away-accent-color": awayTeamColors.accent,
                "--away-alt-color": awayTeamColors.alt,
              }}
            >
              <div className="gameOverCard">
                <div className="gamePageCardLeft">
                  <img
                    className="teamLogoHome"
                    src={gameDetails.homeTeam.logo}
                    alt={`${gameDetails.homeTeam.name.default} logo`}
                  />
                  <span className="team-nameGPvs home-team">
                    {gameDetails.homeTeam.name.default} <br />
                    <span className="team-record">
                      {gameDetails.homeTeam.score}
                    </span>
                  </span>
                </div>
                <span className="GPvs">VS</span>
                <div className="gamePageCardRight">
                  <span className="team-nameGPvs away-team">
                    {gameDetails.awayTeam.name.default} <br />
                    <span className="team-record">
                      {gameDetails.awayTeam.score}
                    </span>
                  </span>
                  <img
                    className="teamLogoAway"
                    src={gameDetails.awayTeam.logo}
                    alt={`${gameDetails.awayTeam.name.default} logo`}
                  />
                </div>
              </div>
            </div>

            <div
              className="gameOverPageContainer"
              style={{
                "--home-primary-color": homeTeamColors.primaryColor,
                "--home-secondary-color": homeTeamColors.secondaryColor,
                "--home-jersey-color": homeTeamColors.jersey,
                "--home-accent-color": homeTeamColors.accent,
                "--home-alt-color": homeTeamColors.alt,
                "--away-primary-color": awayTeamColors.primaryColor,
                "--away-secondary-color": awayTeamColors.secondaryColor,
                "--away-jersey-color": awayTeamColors.jersey,
                "--away-accent-color": awayTeamColors.accent,
                "--away-alt-color": awayTeamColors.alt,
              }}
            >
              <div className="gameOverFlexContainer">
                <div className="gameOverStatsContainer">
                  <div className="GOtable">
                    <table>
                      <thead className="gameOverHeader">
                        <tr>
                          <th className="GOTLHcell">
                            <img
                              className="GOteamLogoHome"
                              src={gameDetails.homeTeam.logo}
                              alt={`${gameDetails.homeTeam.name.default} logo`}
                              style={{ width: "75px" }}
                            />
                          </th>
                          <th className="GOgameDetailsCell">Game Details</th>
                          <th className="GOTLAcell">
                            <img
                              className="GOteamLogoAway"
                              src={gameDetails.awayTeam.logo}
                              alt={`${gameDetails.awayTeam.name.default} logo`}
                              style={{ width: "75px" }}
                            />
                          </th>
                        </tr>
                      </thead>

                      <tbody>
                        <tr>
                          <td>{gameDetails.homeTeam.sog}</td>
                          <td>SOG</td>
                          <td>{gameDetails.awayTeam.sog}</td>
                        </tr>
                        <tr>
                          <td>{gameDetails.homeTeam.hits}</td>
                          <td>HIT</td>
                          <td>{gameDetails.awayTeam.hits}</td>
                        </tr>
                        <tr>
                          <td>{gameDetails.homeTeam.blocks}</td>
                          <td>BLK</td>
                          <td>{gameDetails.awayTeam.blocks}</td>
                        </tr>
                        <tr>
                          <td>{gameDetails.homeTeam.pim}</td>
                          <td>PIM</td>
                          <td>{gameDetails.awayTeam.pim}</td>
                        </tr>
                        <tr>
                          <td>{gameDetails.homeTeam.faceoffWinningPctg}</td>
                          <td>FO%</td>
                          <td>{gameDetails.awayTeam.faceoffWinningPctg}</td>
                        </tr>
                        <tr>
                          <td>
                            {(
                              (parseFloat(
                                gameDetails.homeTeam.powerPlayConversion.split(
                                  "/"
                                )[0]
                              ) /
                                parseFloat(
                                  gameDetails.homeTeam.powerPlayConversion.split(
                                    "/"
                                  )[1]
                                )) *
                              100
                            ).toFixed(2) || "N/A"}
                            %
                          </td>
                          <td>PPG</td>
                          <td>
                            {(
                              (parseFloat(
                                gameDetails.awayTeam.powerPlayConversion.split(
                                  "/"
                                )[0]
                              ) /
                                parseFloat(
                                  gameDetails.awayTeam.powerPlayConversion.split(
                                    "/"
                                  )[1]
                                )) *
                              100
                            ).toFixed(2) || "N/A"}
                            %
                          </td>
                        </tr>
                      </tbody>
                    </table>
                  </div>
                </div>
                <div className="threeStarsContainer">
                  <div className="threeStarsHeader">
                    <span>Three Stars of the Game</span>
                  </div>
                  {gameLandingDetails.summary.threeStars.map((star, index) => (
                    <div className="starRow" key={index}>
                      <img
                        src={star.headshot}
                        alt={`${star.name}'s headshot`}
                        style={{ height: "75px" }}
                      />
                      <div className="starStats">
                        <span>{`${star.goals}G, ${star.assists}A, ${star.points}P`}</span>
                        <span>{`${star.sweaterNo} | ${star.position}`}</span>
                      </div>
                      <span className="starName">{star.name}</span>{" "}
                    </div>
                  ))}
                </div>
              </div>
            </div>
            <div className="gameOverScratchesContainer">
              <div className="GOscratches">
                <div className="GOscratchHeader">
                  <span>Scratches</span>
                </div>
                <div className="GOscratchDetails">
                  <div className="GOhomeScratches">
                    <div className="GOscratchHomeHeader">
                      <span>{gameDetails.homeTeam.name.default}</span>
                    </div>
                    {gameLandingDetails.summary.gameInfo.homeTeam.scratches.map(
                      (player) => (
                        <span className="scratchesName" key={player.id}>
                          -{" "}
                          {`${player.firstName.default} ${player.lastName.default}`}
                          <br />
                        </span>
                      )
                    )}
                  </div>

                  <div className="GOawayScratches">
                    <div className="GOscratchAwayHeader">
                      <span>{gameDetails.awayTeam.name.default}</span>
                    </div>
                    {gameLandingDetails.summary.gameInfo.awayTeam.scratches.map(
                      (player) => (
                        <span className="scratchesName" key={player.id}>
                          -{" "}
                          {`${player.firstName.default} ${player.lastName.default}`}
                          <br />
                        </span>
                      )
                    )}
                  </div>
                </div>
              </div>
            </div>
          </>
        ) : (
          <p>Loading game details...</p>
        )}
      </div>
    );
  } else {
    return (
      <div className="game-page">
        <p>Game details are not available.</p>
      </div>
    );
  }
}
