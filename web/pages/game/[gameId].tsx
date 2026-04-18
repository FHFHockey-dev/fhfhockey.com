// @ts-nocheck
// PATH: web/pages/game/[gameId].tsx
import type { GetServerSideProps } from "next";
import { useRouter } from "next/router";
import { useEffect, useState, useMemo } from "react";
import Fetch from "lib/cors-fetch";
import { teamsInfo } from "lib/teamsInfo";
import PoissonDistributionChart from "components/PoissonDistributionChart";
import Image from "next/image";
import styles from "./GamePage.module.scss";
import Link from "next/link";
import GamePreview from "components/GamePreview/GamePreview";

function deriveSeasonIdFromGameDate(gameDateLike) {
  const parsedDate = gameDateLike ? new Date(gameDateLike) : new Date();
  const safeDate = Number.isNaN(parsedDate.getTime()) ? new Date() : parsedDate;
  const year = safeDate.getUTCFullYear();
  const month = safeDate.getUTCMonth();
  const seasonStartYear = month >= 8 ? year : year - 1;
  return `${seasonStartYear}${seasonStartYear + 1}`;
}

function formatGoalieSavePct(value) {
  if (value == null || Number.isNaN(Number(value))) return "-";
  return Number(value).toFixed(3).replace(/^0+/, "");
}

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
        const seasonId =
          String(response?.season ?? response?.seasonId ?? "").trim() ||
          deriveSeasonIdFromGameDate(response?.gameDate);
        setGameDetails(response);
        fetchTeamStats(response.homeTeam.abbrev, "home", seasonId);
        fetchTeamStats(response.awayTeam.abbrev, "away", seasonId);
        fetchPowerPlayStats(response.homeTeam.abbrev, "home", seasonId);
        fetchPowerPlayStats(response.awayTeam.abbrev, "away", seasonId);
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

  async function fetchTeamStats(teamAbbreviation, teamType, seasonId) {
    const franchiseId = teamsInfo[teamAbbreviation]?.franchiseId;
    if (!franchiseId) return;

    const targetSeasonId = seasonId || deriveSeasonIdFromGameDate();
    const statsURL = `https://api.nhle.com/stats/rest/en/team/summary?isAggregate=false&isGame=false&sort=[{"property":"points","direction":"DESC"},{"property":"wins","direction":"DESC"},{"property":"teamId","direction":"ASC"}]&start=0&limit=50&factCayenneExp=gamesPlayed>=1&cayenneExp=franchiseId=${franchiseId} and gameTypeId=2 and seasonId<=${targetSeasonId} and seasonId>=${targetSeasonId}`;
    try {
      const response = await Fetch(statsURL).then((res) => res.json());
      const statsData = response.data[0] || {}; // Assuming the first object contains the relevant stats
      if (teamType === "home") {
        setHomeTeamStats(statsData);
      } else {
        setAwayTeamStats(statsData);
      }
    } catch (error) {
      console.error(`Error fetching ${teamType} team stats:`, error);
    }
  }

  async function fetchPowerPlayStats(teamAbbreviation, teamType, seasonId) {
    // Match the teamID from teamsInfo to fetch the correct stats
    const teamId = teamsInfo[teamAbbreviation]?.id;
    if (!teamId) return;

    const targetSeasonId = seasonId || deriveSeasonIdFromGameDate();
    const powerPlayStatsURL = `https://api.nhle.com/stats/rest/en/team/powerplay?isAggregate=false&isGame=false&sort=[{"property":"powerPlayPct","direction":"DESC"}]&start=0&limit=50&factCayenneExp=gamesPlayed>=1&cayenneExp=teamId=${teamId} and gameTypeId=2 and seasonId<=${targetSeasonId} and seasonId>=${targetSeasonId}`;
    try {
      const response = await Fetch(powerPlayStatsURL).then((res) => res.json());
      const powerPlayStats = response.data?.[0];
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
      <div
        className={`${styles["teamCard"]} ${side === "away" ? styles["teamCard--away"] : ""}`}
      >
        <div className={styles["teamCard__glow"]} />
        <div className={styles["teamCard__inner"]}>
          <div className={styles["teamCard__logoWrap"]}>
            {logo ? (
              <Image
                src={logo}
                alt={`${teamName} logo`}
                width={82}
                height={82}
                className={styles["teamCard__logo"]}
              />
            ) : (
              <span className={styles["teamCard__placeholder"]}>{abbrev}</span>
            )}
          </div>
          <div className={styles["teamCard__details"]}>
            <span className={styles["teamCard__abbr"]}>{abbrev}</span>
            <span className={styles["teamCard__name"]}>{teamName}</span>
            {record ? (
              <span className={styles["teamCard__record"]}>{record}</span>
            ) : null}
          </div>
        </div>
      </div>
    );

    return (
      <section className={styles["gameHero"]}>
        <div className={styles["gameHero__backdrop"]} />
        <header className={styles["gameHero__header"]}>
          <span
            className={`${styles.statusPill} ${
              isLive
                ? styles["is-live"]
                : isFinal
                  ? styles["is-final"]
                  : styles["is-scheduled"] || "is-scheduled"
            }`}
          >
            {statusLabel}
          </span>
          {heroMetaItems.length ? (
            <div className={styles["gameHero__meta"]}>
              {heroMetaItems.map((item, index) => (
                <span
                  key={`${item}-${index}`}
                  className={styles["gameHero__metaItem"]}
                >
                  {item}
                </span>
              ))}
            </div>
          ) : null}
        </header>
        <div className={styles["gameHero__scoreboard"]}>
          {renderTeamCard(
            "home",
            homeTeamName,
            homeAbbrev,
            homeTeamRecord,
            homeTeam?.logo
          )}
          <div
            className={`${styles["gameHero__score"]} ${
              showScores ? styles["gameHero__score--final"] : ""
            }`}
          >
            <div className={styles["gameHero__scoreGlyph"]}>
              {showScores ? (
                <>
                  <span
                    className={`${styles["scoreValue"]} ${styles["scoreValue--home"]}`}
                  >
                    {homeScoreDisplay}
                  </span>
                  <span className={styles["scoreDivider"]}>:</span>
                  <span
                    className={`${styles["scoreValue"]} ${styles["scoreValue--away"]}`}
                  >
                    {awayScoreDisplay}
                  </span>
                </>
              ) : (
                <span className={styles["scoreGlyph"]}>VS</span>
              )}
            </div>
            {scoreboardMeta.length ? (
              <div className={styles["gameHero__scoreMeta"]}>
                {scoreboardMeta.map((item, index) => (
                  <span
                    key={`${item}-${index}`}
                    className={styles["scoreMeta__item"]}
                  >
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
      <div className={`${styles.statRow} ${styles[advantageClass]}`}>
        <div className={styles["statRowHeader"]}>
          <span
            className={`${styles["statValue"]} ${styles["statValue--home"]}`}
          >
            {homeStat ?? "—"}
          </span>
          <span className={styles["statLabel"]}>{statLabel}</span>
          <span
            className={`${styles["statValue"]} ${styles["statValue--away"]}`}
          >
            {awayStat ?? "—"}
          </span>
        </div>
        <div
          className={styles["comparisonBar"]}
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
      <div className={styles["game-page"]} style={themeStyles}>
        {gameDetails ? (
          <>
            {renderGameHero()}

            <section className={styles["gameContent"]}>
              <div className={styles["previewWorkspace"]}>
                <GamePreview gameId={gameId as string} />
              </div>
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
      <div className={styles["gameOverPage"]} style={themeStyles}>
        {gameDetails ? (
          <>
            {renderGameHero()}

            <section className={styles["gameContent"]}>
              <div className={styles["gameOverPageContainer"]}>
                <div className={styles["gameOverFlexContainer"]}>
                  <div className={styles["gameOverStatsContainer"]}>
                    <div className={styles["GOtable"]}>
                      <table>
                        <thead className={styles["gameOverHeader"]}>
                          <tr>
                            <th className={styles["GOTLHcell"]}>
                              <Image
                                className={styles["GOteamLogoHome"]}
                                src={gameDetails.homeTeam.logo}
                                alt={`${gameDetails.homeTeam.commonName.default} logo`}
                                width={75}
                                height={75}
                              />
                            </th>
                            <th className={styles["GOgameDetailsCell"]}>
                              Game Details
                            </th>
                            <th className={styles["GOTLAcell"]}>
                              <Image
                                className={styles["GOteamLogoAway"]}
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
                            <td>{hitsStat?.homeValue ?? "N/A"}</td>
                            <td>HIT</td>
                            <td>{hitsStat?.awayValue ?? "N/A"}</td>
                          </tr>
                          <tr>
                            <td>{blockedShotsStat?.homeValue ?? "N/A"}</td>
                            <td>BLK</td>
                            <td>{blockedShotsStat?.awayValue ?? "N/A"}</td>
                          </tr>
                          <tr>
                            <td>{penaltyMinutesStat?.homeValue ?? "N/A"}</td>
                            <td>PIM</td>
                            <td>{penaltyMinutesStat?.awayValue ?? "N/A"}</td>
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
                  <div className={styles["threeStarsContainer"]}>
                    <div className={styles["threeStarsHeader"]}>
                      <span>Three Stars of the Game</span>
                    </div>
                    {threeStars.map((star, index) => (
                      <div className={styles["starRow"]} key={index}>
                        <Image
                          src={star.headshot}
                          alt={`${star.name}\'s headshot`}
                          width={75}
                          height={75}
                        />
                        <div className={styles["starStats"]}>
                          <span>{`${star.goals}G, ${star.assists}A, ${star.points}P`}</span>
                          <span>{`${star.sweaterNo} | ${star.position}`}</span>
                        </div>
                        <span className={styles["starName"]}>
                          {star.name}
                        </span>{" "}
                      </div>
                    ))}
                  </div>
                </div>
              </div>
              <div className={styles["gameOverScratchesContainer"]}>
                <div className={styles["GOscratches"]}>
                  <div className={styles["GOscratchHeader"]}>
                    <span>Scratches</span>
                  </div>
                  <div className={styles["GOscratchDetails"]}>
                    <div className={styles["GOhomeScratches"]}>
                      <div className={styles["GOscratchHomeHeader"]}>
                        <span>{gameDetails.homeTeam.commonName.default}</span>
                      </div>
                      {homeScratches.map((player) => (
                        <span
                          className={styles["scratchesName"]}
                          key={player.id}
                        >
                          -{" "}
                          {`${player.firstName.default} ${player.lastName.default}`}
                          <br />
                        </span>
                      ))}
                    </div>

                    <div className={styles["GOawayScratches"]}>
                      <div className={styles["GOscratchAwayHeader"]}>
                        <span>{gameDetails.awayTeam.commonName.default}</span>
                      </div>
                      {awayScratches.map((player) => (
                        <span
                          className={styles["scratchesName"]}
                          key={player.id}
                        >
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
      <div className={styles["game-page"]} style={themeStyles}>
        <p>Game details are not available.</p>
      </div>
    );
  }
}

export const getServerSideProps: GetServerSideProps = async () => ({
  props: {}
});
