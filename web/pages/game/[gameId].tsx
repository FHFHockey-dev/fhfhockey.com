// @ts-nocheck
// PATH: web/pages/game/[gameId].tsx
import { useRouter } from "next/router";
import { useEffect, useState, useMemo } from "react";
import Fetch from "lib/cors-fetch";
import { teamsInfo } from "lib/teamsInfo";
import PoissonDistributionChart from "components/PoissonDistributionChart";
import Image from "next/image";
import styles from "./GamePage.scss";
import Link from "next/link";

export default function Page() {
  const router = useRouter();
  const { gameId } = router.query;
  const [gameDetails, setGameDetails] = useState(null);
  const [gameLandingDetails, setGameLandingDetails] = useState(null); // Added state for game landing details
  const [homeTeamStats, setHomeTeamStats] = useState({});
  const [awayTeamStats, setAwayTeamStats] = useState({});
  const [homeTeamPowerPlayStats, setHomeTeamPowerPlayStats] = useState({});
  const [awayTeamPowerPlayStats, setAwayTeamPowerPlayStats] = useState({});

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
      } catch (error) {
        console.error("Error fetching game details:", error);
      }
    }

    async function fetchGameLandingDetails() {
      if (!gameId) return;
      const landingURL = `https://api-web.nhle.com/v1/gamecenter/${gameId}/landing`;
      try {
        const landingResponse = await Fetch(landingURL).then((res) =>
          res.json()
        );
        setGameLandingDetails(landingResponse); // Update state with fetched game landing details
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

  const homeTeamRecord = gameLandingDetails?.homeTeam?.record;
  const awayTeamRecord = gameLandingDetails?.awayTeam?.record;
  const summary = gameLandingDetails?.summary;
  const teamGameStats = summary?.teamGameStats ?? [];
  const threeStars = summary?.threeStars ?? [];
  const homeScratches =
    summary?.gameInfo?.homeTeam?.scratches ?? [];
  const awayScratches =
    summary?.gameInfo?.awayTeam?.scratches ?? [];
  const findTeamStat = (category) =>
    teamGameStats.find((stat) => stat.category === category);
  const hitsStat = findTeamStat("hits");
  const blockedShotsStat = findTeamStat("blockedShots");
  const penaltyMinutesStat = findTeamStat("pim");
  const faceoffStat = findTeamStat("faceoffWinningPctg");
  const powerPlayPctgStat = findTeamStat("powerPlayPctg");

  // Extract team abbreviations to access team colors
  const homeTeamAbbreviation = gameDetails?.homeTeam?.abbrev;
  const awayTeamAbbreviation = gameDetails?.awayTeam?.abbrev;

  // Access team colors using abbreviations
  const homeTeamColors = teamsInfo[homeTeamAbbreviation] || {};
  const awayTeamColors = teamsInfo[awayTeamAbbreviation] || {};

  const themeStyles = useMemo(() => {
    const fallbackPrimary = "var(--fhfh-primary-color)";
    const fallbackSecondary = "var(--fhfh-secondary-color)";
    const fallbackNeutral = "var(--fhfh-surface-base)";
    const fallbackAccent = "var(--fhfh-border-accent)";

    const safeColor = (value: string | undefined, fallback: string) =>
      typeof value === "string" && value.trim().length > 0 ? value : fallback;

    return {
      "--home-primary-color": safeColor(
        homeTeamColors.primaryColor,
        fallbackPrimary
      ),
      "--home-secondary-color": safeColor(
        homeTeamColors.secondaryColor,
        fallbackSecondary
      ),
      "--home-jersey-color": safeColor(
        homeTeamColors.jersey,
        fallbackNeutral
      ),
      "--home-accent-color": safeColor(
        homeTeamColors.accent,
        fallbackAccent
      ),
      "--home-alt-color": safeColor(homeTeamColors.alt, fallbackNeutral),
      "--away-primary-color": safeColor(
        awayTeamColors.primaryColor,
        fallbackPrimary
      ),
      "--away-secondary-color": safeColor(
        awayTeamColors.secondaryColor,
        fallbackSecondary
      ),
      "--away-jersey-color": safeColor(
        awayTeamColors.jersey,
        fallbackNeutral
      ),
      "--away-accent-color": safeColor(
        awayTeamColors.accent,
        fallbackAccent
      ),
      "--away-alt-color": safeColor(awayTeamColors.alt, fallbackNeutral)
    };
  }, [
    homeTeamColors.primaryColor,
    homeTeamColors.secondaryColor,
    homeTeamColors.jersey,
    homeTeamColors.accent,
    homeTeamColors.alt,
    awayTeamColors.primaryColor,
    awayTeamColors.secondaryColor,
    awayTeamColors.jersey,
    awayTeamColors.accent,
    awayTeamColors.alt
  ]);

  const homeTeam = gameDetails?.homeTeam;
  const awayTeam = gameDetails?.awayTeam;
  const normalizedState = (gameLandingDetails?.gameState || "")
    .toString()
    .toUpperCase();
  const isUpcoming = normalizedState === "FUT" || normalizedState === "PRE";
  const isFinal =
    normalizedState === "FINAL" ||
    normalizedState === "OVER" ||
    normalizedState === "OFF" ||
    normalizedState === "F";
  const isLive =
    normalizedState === "LIVE" ||
    normalizedState === "IN" ||
    normalizedState === "STARTED";
  const statusLabel =
    summary?.gameStatus?.detailedState ||
    (isFinal
      ? "Final"
      : isLive
        ? "In Progress"
        : isUpcoming
          ? "Scheduled"
          : normalizedState || "Game");

  const startTimeUTC =
    gameLandingDetails?.gameSchedule?.startTimeUTC ||
    gameLandingDetails?.gameDate ||
    gameDetails?.gameDate ||
    null;

  const formattedStart = useMemo(() => {
    if (!startTimeUTC) return null;
    const date = new Date(startTimeUTC);
    if (Number.isNaN(date.getTime())) return null;
    try {
      return new Intl.DateTimeFormat(undefined, {
        dateStyle: "full",
        timeStyle: "short"
      }).format(date);
    } catch (error) {
      return date.toLocaleString();
    }
  }, [startTimeUTC]);

  const venueName =
    gameLandingDetails?.gameSchedule?.venue?.default ||
    summary?.gameInfo?.venue?.name ||
    summary?.gameInfo?.venue?.default ||
    gameDetails?.venue?.default ||
    null;

  const broadcastInfo =
    gameLandingDetails?.gameSchedule?.tvBroadcasts
      ?.map(
        (broadcast) =>
          broadcast?.callLetters || broadcast?.network || broadcast?.source
      )
      .filter(Boolean)
      .join(" • ") || null;

  const seriesSummary =
    summary?.gameStatus?.seriesStatusShort ||
    summary?.seriesSummary?.summary ||
    null;

  const attendanceValue = summary?.attendance;
  const attendanceDisplay =
    typeof attendanceValue === "number"
      ? `${attendanceValue.toLocaleString()} fans`
      : typeof attendanceValue === "string" && attendanceValue.trim().length > 0
        ? attendanceValue
        : null;

  const homeScore =
    typeof homeTeam?.score === "number" ? homeTeam.score : null;
  const awayScore =
    typeof awayTeam?.score === "number" ? awayTeam.score : null;
  const showScores =
    isFinal || isLive || (homeScore !== null || awayScore !== null);

  const renderGameHero = () => {
    const homeTeamName =
      homeTeam?.commonName?.default ||
      homeTeam?.teamName ||
      homeTeam?.abbrev ||
      "Home";
    const awayTeamName =
      awayTeam?.commonName?.default ||
      awayTeam?.teamName ||
      awayTeam?.abbrev ||
      "Away";
    const homeAbbrev = homeTeam?.abbrev || "HOME";
    const awayAbbrev = awayTeam?.abbrev || "AWAY";
    const homeScoreDisplay =
      showScores && homeScore !== null ? String(homeScore) : "—";
    const awayScoreDisplay =
      showScores && awayScore !== null ? String(awayScore) : "—";
    const heroMetaItems = [
      formattedStart,
      venueName,
      broadcastInfo
    ].filter(Boolean);
    const scoreboardMeta = showScores
      ? [statusLabel, seriesSummary, attendanceDisplay].filter(Boolean)
      : [
          formattedStart,
          statusLabel || "Awaiting puck drop",
          seriesSummary,
          broadcastInfo
        ].filter(Boolean);

    const renderTeamCard = (side, teamName, abbrev, record, logo) => (
      <div className={`teamCard teamCard--${side}`}>
        <div className="teamCard__glow" />
        <div className="teamCard__inner">
          <div className="teamCard__logoWrap">
            {logo ? (
              <Image
                src={logo}
                alt={`${teamName} logo`}
                width={82}
                height={82}
                className="teamCard__logo"
              />
            ) : (
              <span className="teamCard__placeholder">{abbrev}</span>
            )}
          </div>
          <div className="teamCard__details">
            <span className="teamCard__abbr">{abbrev}</span>
            <span className="teamCard__name">{teamName}</span>
            {record ? (
              <span className="teamCard__record">{record}</span>
            ) : null}
          </div>
        </div>
      </div>
    );

    return (
      <section className="gameHero">
        <div className="gameHero__backdrop" />
        <header className="gameHero__header">
          <span
            className={`statusPill ${
              isLive ? "is-live" : isFinal ? "is-final" : "is-scheduled"
            }`}
          >
            {statusLabel}
          </span>
          {heroMetaItems.length ? (
            <div className="gameHero__meta">
              {heroMetaItems.map((item, index) => (
                <span key={`${item}-${index}`} className="gameHero__metaItem">
                  {item}
                </span>
              ))}
            </div>
          ) : null}
        </header>
        <div className="gameHero__scoreboard">
          {renderTeamCard(
            "home",
            homeTeamName,
            homeAbbrev,
            homeTeamRecord,
            homeTeam?.logo
          )}
          <div
            className={`gameHero__score ${
              showScores ? "gameHero__score--final" : ""
            }`}
          >
            <div className="gameHero__scoreGlyph">
              {showScores ? (
                <>
                  <span className="scoreValue scoreValue--home">
                    {homeScoreDisplay}
                  </span>
                  <span className="scoreDivider">:</span>
                  <span className="scoreValue scoreValue--away">
                    {awayScoreDisplay}
                  </span>
                </>
              ) : (
                <span className="scoreGlyph">VS</span>
              )}
            </div>
            {scoreboardMeta.length ? (
              <div className="gameHero__scoreMeta">
                {scoreboardMeta.map((item, index) => (
                  <span key={`${item}-${index}`} className="scoreMeta__item">
                    {item}
                  </span>
                ))}
              </div>
            ) : null}
          </div>
          {renderTeamCard(
            "away",
            awayTeamName,
            awayAbbrev,
            awayTeamRecord,
            awayTeam?.logo
          )}
        </div>
      </section>
    );
  };

  const StatRow = ({
    statLabel,
    homeStat,
    awayStat,
    isLowerBetter = false
  }) => {
    const normalizeValue = (value) => {
      if (value === null || value === undefined) return 0;
      if (typeof value === "number") {
        return Number.isFinite(value) ? value : 0;
      }
      const parsed = parseFloat(String(value).replace(/[^\d.-]/g, ""));
      return Number.isFinite(parsed) ? parsed : 0;
    };

    const homeValue = normalizeValue(homeStat);
    const awayValue = normalizeValue(awayStat);

    let advantageTeam: "home" | "away" | "tie" = "tie";
    if (homeValue !== awayValue) {
      const isHomeAhead = isLowerBetter
        ? homeValue < awayValue
        : homeValue > awayValue;
      advantageTeam = isHomeAhead ? "home" : "away";
    }

    const { homePercentage } = calculatePercentage(homeValue, awayValue);
    const advantageClass =
      advantageTeam !== "tie" ? `is-${advantageTeam}` : "is-tie";

    return (
      <div className={`statRow ${advantageClass}`}>
        <div className="statRowHeader">
          <span className="statValue statValue--home">
            {homeStat ?? "—"}
          </span>
          <span className="statLabel">{statLabel}</span>
          <span className="statValue statValue--away">
            {awayStat ?? "—"}
          </span>
        </div>
        <div
          className="comparisonBar"
          style={{ "--home-share": `${homePercentage}` }}
          data-winner={advantageTeam}
        />
      </div>
    );
  };

  const calculatePercentage = (homeStat, awayStat) => {
    const safeHome = Number.isFinite(homeStat) ? homeStat : 0;
    const safeAway = Number.isFinite(awayStat) ? awayStat : 0;
    const total = safeHome + safeAway;
    if (total <= 0) {
      return { homePercentage: 50, awayPercentage: 50 };
    }
    const homePercentage = (safeHome / total) * 100;
    const awayPercentage = 100 - homePercentage;
    return { homePercentage, awayPercentage };
  };

  const formatRate = (
    numerator?: number | null,
    denominator?: number | null,
    multiplier = 1,
    digits = 1,
    suffix = ""
  ) => {
    const num =
      typeof numerator === "number" ? numerator : Number(numerator ?? 0);
    const den =
      typeof denominator === "number" ? denominator : Number(denominator ?? 0);
    if (!Number.isFinite(num) || !Number.isFinite(den) || den === 0) {
      return "-";
    }
    const value = (num / den) * multiplier;
    return Number.isFinite(value) ? `${value.toFixed(digits)}${suffix}` : "-";
  };

  const formatSavePercentage = (
    goalsAgainst?: number | null,
    shotsAgainst?: number | null
  ) => {
    const shots =
      typeof shotsAgainst === "number" ? shotsAgainst : Number(shotsAgainst);
    const goals =
      typeof goalsAgainst === "number" ? goalsAgainst : Number(goalsAgainst);
    if (!Number.isFinite(shots) || !Number.isFinite(goals) || shots === 0) {
      return "-";
    }
    const pct = 1 - goals / shots;
    if (!Number.isFinite(pct)) {
      return "-";
    }
    return `${pct.toFixed(3).replace(/^0+/, "")}%`;
  };

  const formatNumber = (
    value?: number | null,
    digits = 1,
    suffix = ""
  ) => {
    if (typeof value !== "number" || !Number.isFinite(value)) {
      return "-";
    }
    return `${value.toFixed(digits)}${suffix}`;
  };

  const formatPercentValue = (
    value?: number | null,
    digits = 1
  ) => {
    if (typeof value !== "number" || !Number.isFinite(value)) {
      return "-";
    }
    return `${(value * 100).toFixed(digits)}%`;
  };

  ///////////////////////// CHART STUFF //////////////////////////////

  const chartData = useMemo(() => {
    // Ensure default values (like 0 or empty strings) are consistent
    const homeTeamAbbrev = gameDetails?.homeTeam?.abbrev || "";
    const awayTeamAbbrev = gameDetails?.awayTeam?.abbrev || "";
    const homeLogo = gameDetails?.homeTeam?.logo || "";
    const awayLogo = gameDetails?.awayTeam?.logo || "";

    // Use nullish coalescing (??) or || to provide defaults safely
    return [
      {
        team: homeTeamAbbrev,
        logo: homeLogo,
        // IMPORTANT: Use the correct fields for the Poisson calculation
        homeExpectedGoals: homeTeamStats?.goalsForPerGame ?? 0, // Assuming this is the intended value
        // Include other stats needed by the component, defaulting to 0 or appropriate value
        goalsForPerGame: homeTeamStats?.goalsForPerGame ?? 0,
        goalsAgainstPerGame: homeTeamStats?.goalsAgainstPerGame ?? 0,
        shotsForPerGame: homeTeamStats?.shotsForPerGame ?? 0,
        shotsAgainstPerGame: homeTeamStats?.shotsAgainstPerGame ?? 0,
        powerPlayPercentage: homeTeamPowerPlayStats?.powerPlayPct ?? 0,
        penaltyKillPercentage: homeTeamStats?.penaltyKillPct ?? 0,
        powerPlayGoalsPerGame: homeTeamPowerPlayStats?.ppGoalsPerGame ?? 0,
        powerPlayOpportunitesPerGame:
          homeTeamPowerPlayStats?.ppOpportunitiesPerGame ?? 0,
        shGoalsAgainstPerGame:
          homeTeamPowerPlayStats?.shGoalsAgainstPerGame ?? 0,
        seasonSeriesWins:
          gameLandingDetails?.matchup?.seasonSeriesWins?.homeTeamWins ?? 0
      },
      {
        team: awayTeamAbbrev,
        logo: awayLogo,
        // IMPORTANT: Use the correct fields for the Poisson calculation
        awayExpectedGoals: awayTeamStats?.goalsForPerGame ?? 0, // Assuming this is the intended value
        // Include other stats needed by the component, defaulting to 0 or appropriate value
        goalsForPerGame: awayTeamStats?.goalsForPerGame ?? 0,
        goalsAgainstPerGame: awayTeamStats?.goalsAgainstPerGame ?? 0,
        shotsForPerGame: awayTeamStats?.shotsForPerGame ?? 0,
        shotsAgainstPerGame: awayTeamStats?.shotsAgainstPerGame ?? 0,
        powerPlayPercentage: awayTeamPowerPlayStats?.powerPlayPct ?? 0,
        penaltyKillPercentage: awayTeamStats?.penaltyKillPct ?? 0,
        powerPlayGoalsPerGame: awayTeamPowerPlayStats?.ppGoalsPerGame ?? 0,
        powerPlayOpportunitesPerGame:
          awayTeamPowerPlayStats?.ppOpportunitiesPerGame ?? 0,
        shGoalsAgainstPerGame:
          awayTeamPowerPlayStats?.shGoalsAgainstPerGame ?? 0,
        seasonSeriesWins:
          gameLandingDetails?.matchup?.seasonSeriesWins?.awayTeamWins ?? 0
      }
    ];
  }, [
    // List ALL state variables used inside this useMemo block
    gameDetails,
    homeTeamStats,
    awayTeamStats,
    homeTeamPowerPlayStats,
    awayTeamPowerPlayStats,
    gameLandingDetails
  ]);


  const isDataLoaded = useMemo(
    () =>
      !!(
        gameDetails && // Check for truthiness
        homeTeamStats &&
        Object.keys(homeTeamStats).length > 0 && // Check if object is not empty
        awayTeamStats &&
        Object.keys(awayTeamStats).length > 0 &&
        homeTeamPowerPlayStats &&
        Object.keys(homeTeamPowerPlayStats).length > 0 &&
        awayTeamPowerPlayStats &&
        Object.keys(awayTeamPowerPlayStats).length > 0 &&
        // Ensure the specific data needed by chartData has non-default values if possible
        chartData[0]?.team &&
        chartData[1]?.team && // e.g., check if team names are loaded
        chartData[0]?.homeExpectedGoals !== 0 && // Check if key stats are loaded
        chartData[1]?.awayExpectedGoals !== 0
      ),
    [
      gameDetails,
      homeTeamStats,
      awayTeamStats,
      homeTeamPowerPlayStats,
      awayTeamPowerPlayStats,
      chartData
    ]
  ); // Recalculate when dependencies change

  if (
    gameLandingDetails?.gameState === "FUT" ||
    gameLandingDetails?.gameState === "PRE"
  ) {
    return (
      <div className="game-page" style={themeStyles}>
        {gameDetails ? (
          <>
            {renderGameHero()}

            <section className="gameContent">
              <div className="statsAndPlayerCompContainer">
              {/* ///////////////////////////////// STAT ROW ///////////////////////////////////////////////////////// */}
              <div className="gamePageVsTableContainer">
                <h1 className="tableHeader">
                  Team <span className="spanColorBlue">Advantage</span>
                </h1>

                <div className="gamePageVsTable">
                  <div className="statTableHeader">
                    <div className="statTableLeft">
                      <Image
                        className="teamLogoHomeStatTable"
                        src={gameDetails.homeTeam.logo}
                        alt={`${gameDetails.homeTeam.commonName.default} logo`}
                        width={60}
                        height={60}
                      />
                    </div>
                    <span className="advantageHeaderText">VS</span>

                    <div className="statTableRight">
                      <Image
                        className="teamLogoAwayStatTable"
                        src={gameDetails.awayTeam.logo}
                        alt={`${gameDetails.awayTeam.commonName.default} logo`}
                        width={60}
                        height={60}
                      />
                    </div>
                  </div>
                  {/* Use StatRow for each statistic you want to display */}
                  <StatRow
                    statLabel="WINS"
                    homeStat={homeTeamStats.wins}
                    awayStat={awayTeamStats.wins}
                  />
                  <StatRow
                    statLabel="GF/GM"
                    homeStat={formatNumber(
                      homeTeamStats.goalsForPerGame,
                      2
                    )}
                    awayStat={formatNumber(
                      awayTeamStats.goalsForPerGame,
                      2
                    )}
                  />
                  <StatRow
                    statLabel="GA/GM"
                    homeStat={formatNumber(
                      homeTeamStats.goalsAgainstPerGame,
                      2
                    )}
                    awayStat={formatNumber(
                      awayTeamStats.goalsAgainstPerGame,
                      2
                    )}
                    isLowerBetter // Lower is better for goals against
                  />
                  <StatRow
                    statLabel="PP%"
                    homeStat={formatPercentValue(
                      homeTeamPowerPlayStats.powerPlayPct,
                      1
                    )}
                    awayStat={formatPercentValue(
                      awayTeamPowerPlayStats.powerPlayPct,
                      1
                    )}
                  />
                  <StatRow
                    statLabel="PK%"
                    homeStat={formatPercentValue(
                      homeTeamStats.penaltyKillPct,
                      1
                    )}
                    awayStat={formatPercentValue(
                      awayTeamStats.penaltyKillPct,
                      1
                    )}
                  />
                  <StatRow
                    statLabel="SF/GM"
                    homeStat={formatNumber(
                      homeTeamStats.shotsForPerGame,
                      1
                    )}
                    awayStat={formatNumber(
                      awayTeamStats.shotsForPerGame,
                      1
                    )}
                  />
                  <StatRow
                    statLabel="SA/GM"
                    homeStat={formatNumber(
                      homeTeamStats.shotsAgainstPerGame,
                      1
                    )}
                    awayStat={formatNumber(
                      awayTeamStats.shotsAgainstPerGame,
                      1
                    )}
                    isLowerBetter // Lower is better for shots against
                  />
                  <StatRow
                    statLabel="PPO/GM"
                    homeStat={formatNumber(
                      homeTeamPowerPlayStats.ppOpportunitiesPerGame,
                      2
                    )}
                    awayStat={formatNumber(
                      awayTeamPowerPlayStats.ppOpportunitiesPerGame,
                      2
                    )}
                  />
                  <StatRow
                    statLabel="PPG/GM"
                    homeStat={formatNumber(
                      homeTeamPowerPlayStats.ppGoalsPerGame,
                      2
                    )}
                    awayStat={formatNumber(
                      awayTeamPowerPlayStats.ppGoalsPerGame,
                      2
                    )}
                  />
                  <StatRow
                    statLabel="S%"
                    homeStat={formatRate(
                      homeTeamStats.goalsForPerGame,
                      homeTeamStats.shotsForPerGame,
                      100,
                      1,
                      "%"
                    )}
                    awayStat={formatRate(
                      awayTeamStats.goalsForPerGame,
                      awayTeamStats.shotsForPerGame,
                      100,
                      1,
                      "%"
                    )}
                  />
                  <StatRow
                    statLabel="SV%"
                    homeStat={formatSavePercentage(
                      homeTeamStats.goalsAgainstPerGame,
                      homeTeamStats.shotsAgainstPerGame
                    )}
                    awayStat={formatSavePercentage(
                      awayTeamStats.goalsAgainstPerGame,
                      awayTeamStats.shotsAgainstPerGame
                    )}
                  />
                </div>
              </div>

              <div className="statsPlayerAndGoalieCompContainer">
                <h1 className="tableHeader">
                  Last <span className="spanColorBlue">5 Games</span>
                </h1>
                <div className="playerCompContainer">
                  <div className="playerCompHeader">
                    <div className="playerCompHeaderLeft">
                      <Image
                        className="teamLogoHomePC"
                        src={gameDetails.homeTeam.logo}
                        alt={`${gameDetails.homeTeam.commonName.default} logo`}
                        width={75}
                        height={75}
                      />
                    </div>

                    <p>Leaders</p>
                    <div className="playerCompHeaderRight">
                      <Image
                        className="teamLogoAwayPC"
                        src={gameDetails.awayTeam.logo}
                        alt={`${gameDetails.awayTeam.commonName.default} logo`}
                        width={75}
                        height={75}
                      />
                    </div>
                  </div>
                  {gameLandingDetails?.matchup?.skaterComparison?.leaders
                    ?.filter(
                      (leader) => leader.category.toLowerCase() !== "plusminus"
                    )
                    .map((leader, index) => (
                      <div className="playerCompDetails" key={index}>
                        {/* Home player side */}
                        <div className="playerDetail homePlayer">
                          <Link
                            href={`/stats/player/${leader.homeLeader.playerId}`}
                          >
                            <Image
                              src={leader.homeLeader.headshot}
                              alt="Home player headshot"
                              className="playerHeadshot interactive"
                              width={50}
                              height={50}
                            />
                          </Link>

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
                            <Link
                              href={`/stats/player/${leader.awayLeader.playerId}`}
                            >
                              <Image
                                src={leader.awayLeader.headshot}
                                alt="Away player headshot"
                                className="playerHeadshot interactive"
                                width={50}
                                height={50}
                              />
                            </Link>
                          </div>
                        </div>
                      </div>
                    ))}
                </div>

                {/* Goalie Comparison Container */}
                <h1 className="tableHeader">
                  Goalie <span className="spanColorBlue">Comparison</span>
                </h1>
                <div className="goalieCompContainer">
                  {" "}
                  {/* Add some margin for spacing */}
                  <div className="goalieCompHeader">
                    <div className="goalieCompHeaderLeft">
                      <Image
                        className="teamLogoHomePC"
                        src={gameDetails.homeTeam.logo}
                        alt={`${gameDetails.homeTeam.commonName.default} logo`}
                        width={75}
                        height={75}
                      />
                    </div>
                    <div className="goalieCompHeaderMiddle">Goalies</div>
                    <div className="goalieCompHeaderRight">
                      <Image
                        className="teamLogoAwayPC"
                        src={gameDetails.awayTeam.logo}
                        alt={`${gameDetails.awayTeam.commonName.default} logo`}
                        width={75}
                        height={75}
                      />
                    </div>
                  </div>
                  <div className="goalieStatsContainer">
                    <div className="homeGoalies">
                      {gameLandingDetails?.matchup?.goalieComparison?.homeTeam?.leaders?.map(
                        (goalie) => (
                          <div key={goalie.playerId} className="goalieStatRow">
                            <div className="goalieImage">
                              <Image
                                src={goalie.headshot}
                                alt={`Headshot of ${goalie.name.default}`}
                                width={60}
                                height={60}
                              />
                            </div>
                            <div className="goalieName">
                              <span>
                                {goalie.firstName.default}{" "}
                                <span className="goalieLastName">
                                  {goalie.lastName.default}
                                </span>
                              </span>{" "}
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
                                  {goalie?.gaa?.toFixed(2) ?? "-"}
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
                      {gameLandingDetails?.matchup?.goalieComparison?.awayTeam?.leaders?.map(
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
                                  {goalie.gaa != null
                                    ? goalie.gaa.toFixed(2)
                                    : "-"}
                                </span>
                              </div>
                              <div className="goalieStatDetails">
                                <span className="spanGoalieValue">SV%:</span>
                                <span className="spanGoalieStat">
                                  {goalie.savePctg != null
                                    ? goalie.savePctg
                                        .toFixed(3)
                                        .replace(/^0+/, "")
                                    : "-"}
                                  %
                                </span>
                              </div>
                              <div className="goalieStatDetails">
                                <span className="spanGoalieValue">SO:</span>
                                <span className="spanGoalieStat">
                                  {goalie.shutouts ?? "-"}{" "}
                                </span>
                              </div>
                            </div>
                            <div className="goalieName">
                              <span>
                                {goalie.firstName.default}{" "}
                                <span className="goalieLastName">
                                  {goalie.lastName.default}
                                </span>
                              </span>{" "}
                              {/* First Name */}{" "}
                              <span className="goalieSweaterNumber">
                                #{goalie.sweaterNumber} • {goalie.positionCode}
                              </span>
                            </div>

                            <div className="goalieImage">
                              <Image
                                src={goalie.headshot}
                                alt={`Headshot of ${goalie.name.default}`}
                                width={60}
                                height={60}
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
              {/* Conditionally render PoissonDistributionChart if all data is loaded */}
              {isDataLoaded ? (
                <div className="poissonChartContainer">
                  <PoissonDistributionChart chartData={chartData} />
                </div>
              ) : (
                <p>Loading chart data...</p>
              )}
            </section>
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
      <div className="gameOverPage" style={themeStyles}>
        {gameDetails ? (
          <>
            {renderGameHero()}

            <section className="gameContent">
              <div className="gameOverPageContainer">
                <div className="gameOverFlexContainer">
                  <div className="gameOverStatsContainer">
                    <div className="GOtable">
                      <table>
                      <thead className="gameOverHeader">
                        <tr>
                          <th className="GOTLHcell">
                            <Image
                              className="GOteamLogoHome"
                              src={gameDetails.homeTeam.logo}
                              alt={`${gameDetails.homeTeam.commonName.default} logo`}
                              width={75}
                              height={75}
                            />
                          </th>
                          <th className="GOgameDetailsCell">Game Details</th>
                          <th className="GOTLAcell">
                            <Image
                              className="GOteamLogoAway"
                              src={gameDetails.awayTeam.logo}
                              alt={`${gameDetails.awayTeam.commonName.default} logo`}
                              width={75}
                              height={75}
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
                          <td>
                            {hitsStat?.homeValue ?? "N/A"}
                          </td>
                          <td>HIT</td>
                          <td>
                            {hitsStat?.awayValue ?? "N/A"}
                          </td>
                        </tr>
                        <tr>
                          <td>
                            {blockedShotsStat?.homeValue ?? "N/A"}
                          </td>
                          <td>BLK</td>
                          <td>
                            {blockedShotsStat?.awayValue ?? "N/A"}
                          </td>
                        </tr>
                        <tr>
                          <td>
                            {penaltyMinutesStat?.homeValue ?? "N/A"}
                          </td>
                          <td>PIM</td>
                          <td>
                            {penaltyMinutesStat?.awayValue ?? "N/A"}
                          </td>
                        </tr>
                        <tr>
                          <td>
                            {faceoffStat?.homeValue != null
                              ? `${(faceoffStat.homeValue * 100).toFixed(2)}%`
                              : "N/A"}
                          </td>
                          <td>FO%</td>
                          <td>
                            {faceoffStat?.awayValue != null
                              ? `${(faceoffStat.awayValue * 100).toFixed(2)}%`
                              : "N/A"}
                          </td>
                        </tr>
                        <tr>
                          <td>
                            {powerPlayPctgStat?.homeValue != null
                              ? `${(powerPlayPctgStat.homeValue * 100).toFixed(2)}%`
                              : "N/A"}
                          </td>
                          <td>PPG</td>
                          <td>
                            {powerPlayPctgStat?.awayValue != null
                              ? `${(powerPlayPctgStat.awayValue * 100).toFixed(2)}%`
                              : "N/A"}
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
                  {threeStars.map((star, index) => (
                    <div className="starRow" key={index}>
                      <Image
                        src={star.headshot}
                        alt={`${star.name}\'s headshot`}
                        width={75}
                        height={75}
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
                      <span>{gameDetails.homeTeam.commonName.default}</span>
                    </div>
                    {homeScratches.map((player) => (
                      <span className="scratchesName" key={player.id}>
                        -{" "}
                        {`${player.firstName.default} ${player.lastName.default}`}
                        <br />
                      </span>
                    ))}
                  </div>

                  <div className="GOawayScratches">
                    <div className="GOscratchAwayHeader">
                      <span>{gameDetails.awayTeam.commonName.default}</span>
                    </div>
                    {awayScratches.map((player) => (
                      <span className="scratchesName" key={player.id}>
                        -{" "}
                        {`${player.firstName.default} ${player.lastName.default}`}
                        <br />
                      </span>
                    ))}
                  </div>
                </div>
              </div>
            </div>
            </section>
          </>
        ) : (
          <p>Loading game details...</p>
        )}
      </div>
    );
  } else {
    return (
      <div className="game-page" style={themeStyles}>
        <p>Game details are not available.</p>
      </div>
    );
  }
}
