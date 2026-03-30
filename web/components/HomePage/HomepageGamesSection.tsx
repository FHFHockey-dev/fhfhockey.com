import { useEffect, useState, type CSSProperties } from "react";

import Link from "next/link";
import moment from "moment";
import "moment-timezone";

import ClientOnly from "components/ClientOnly";
import PanelStatus from "components/common/PanelStatus";
import OptimizedImage from "components/common/OptimizedImage";
import { buildHomepageModulePresentation } from "lib/dashboard/freshness";
import { fallbackNHLLogo, getTeamLogoSvg } from "lib/images";
import { teamsInfo } from "lib/teamsInfo";
import styles from "styles/Home.module.scss";

type HomepageGamesSectionProps = {
  currentDate: string;
  games: any[];
  gamesHeaderText: string;
  onChangeDate: (days: number) => void;
  loading: boolean;
  error: string | null;
  lastUpdatedAt: string | null;
};

const getDisplayGameState = (gameState: string) => {
  const gameStateMapping: Record<string, string> = {
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

const formatPeriodText = (
  periodNumber: number,
  periodDescriptor: string,
  inIntermission: boolean
) => {
  if (inIntermission) return "Intermission";
  if (periodDescriptor === "OT") return "Overtime";

  const periodSuffix =
    {
      1: "st",
      2: "nd",
      3: "rd"
    }[periodNumber] || "th";

  return `${periodNumber}${periodSuffix} Period`;
};

const formatLocalStartTime = (startTimeUTC: string) => {
  if (!startTimeUTC) return "";

  try {
    const timezone = moment.tz.guess();
    return moment.tz(startTimeUTC, "UTC").tz(timezone).format("h:mm A z");
  } catch {
    return moment.utc(startTimeUTC).local().format("h:mm A");
  }
};

export default function HomepageGamesSection({
  currentDate,
  games,
  gamesHeaderText,
  onChangeDate,
  loading,
  error,
  lastUpdatedAt
}: HomepageGamesSectionProps) {
  const liveGames = games.filter(
    (game) => game.gameState === "LIVE" || game.gameState === "CRIT"
  ).length;
  const finalGames = games.filter((game) =>
    ["OVER", "FINAL", "OFF"].includes(game.gameState)
  ).length;
  const upcomingGames = Math.max(games.length - liveGames - finalGames, 0);
  const firstScheduledGame = games.find((game) => typeof game.startTimeUTC === "string");
  const [scheduleContext, setScheduleContext] = useState<string | null>(null);

  useEffect(() => {
    if (!firstScheduledGame?.startTimeUTC) {
      setScheduleContext(null);
      return;
    }

    setScheduleContext(formatLocalStartTime(firstScheduledGame.startTimeUTC));
  }, [firstScheduledGame?.startTimeUTC]);

  const heroDescription =
    games.length > 0
      ? liveGames > 0
        ? `${liveGames} game${liveGames === 1 ? "" : "s"} live right now. Move from the slate to confirmed starter context and market movement without leaving the homepage flow.`
        : `${games.length} game${games.length === 1 ? "" : "s"} on the board${scheduleContext ? `, starting at ${scheduleContext}` : ""}. Scan the slate first, then jump straight into goalie, start-chart, or trend context.`
      : `No games are scheduled for ${moment(currentDate).format("MMMM D")}. Use the decision surfaces below to plan your next move before the slate repopulates.`;
  const modulePresentation = buildHomepageModulePresentation({
    source: "homepage-games",
    loading,
    error,
    isEmpty: games.length === 0 && !error,
    timestamp: lastUpdatedAt,
    maxAgeHours: 8,
    loadingMessage: "Refreshing the slate...",
    emptyMessage: `No games scheduled for ${moment(currentDate).format("MM/DD/YYYY")}.`,
    staleMessage: "Slate data may be stale. Refresh before making lineup decisions."
  });

  return (
    <div className={styles.gameCardsContainer}>
      <div className={styles.slateHero}>
        <div className={styles.slateHeroIntro}>
          <p className={styles.slateEyebrow}>Fantasy hockey today</p>
          <h1 className={styles.slateHeadline}>Start with the slate, then pick the right next click.</h1>
          <p className={styles.slateDescription}>{heroDescription}</p>
        </div>

        <div className={styles.slateSummaryRail}>
          <div className={styles.slateSummaryCard}>
            <span className={styles.slateSummaryLabel}>Date</span>
            <strong className={styles.slateSummaryValue}>
              {moment(currentDate).format("ddd, MMM D")}
            </strong>
          </div>
          <div className={styles.slateSummaryCard}>
            <span className={styles.slateSummaryLabel}>Slate</span>
            <strong className={styles.slateSummaryValue}>
              {games.length} game{games.length === 1 ? "" : "s"}
            </strong>
          </div>
          <div className={styles.slateSummaryCard}>
            <span className={styles.slateSummaryLabel}>Now</span>
            <strong className={styles.slateSummaryValue}>
              {liveGames > 0
                ? `${liveGames} live`
                : upcomingGames > 0
                  ? `${upcomingGames} upcoming`
                  : `${finalGames} final`}
            </strong>
          </div>
        </div>

        <div className={styles.slateActionRow}>
          <Link href="/start-chart" className={styles.slateActionLink}>
            Starter board
          </Link>
          <Link href="/goalies" className={styles.slateActionLink}>
            Goalie view
          </Link>
          <Link href="/trends" className={styles.slateActionLink}>
            Trend watch
          </Link>
        </div>
      </div>

      <div className={styles.gamesHeader}>
        <button onClick={() => onChangeDate(-1)} aria-label="Previous Day"></button>
        <div className={styles.headerAndDate}>
          <h1
            className={
              gamesHeaderText === "Yesterday's" || gamesHeaderText === "Tomorrow's"
                ? styles.smallerHeader
                : ""
            }
          >
            {gamesHeaderText} <span>Games</span>
          </h1>
          <p className={styles.dateDisplay}>{moment(currentDate).format("M/DD/YYYY")}</p>
        </div>
        <button onClick={() => onChangeDate(1)} aria-label="Next Day"></button>
      </div>

      <div className={styles.gamesContainer}>
        {modulePresentation.panelState && (
          <PanelStatus
            state={modulePresentation.panelState}
            message={modulePresentation.message ?? ""}
            className={styles.moduleStatusPanel}
          />
        )}
        {games.length > 0 ? (
          <>
            <div className={styles.gameColumnLabels}>
              <span className={styles.homeLabel}>Home</span>
              <span className={styles.awayLabel}>Away</span>
            </div>

            {games.map((game) => {
              const homeTeam = game.homeTeam;
              const awayTeam = game.awayTeam;
              const homeTeamInfo = teamsInfo[homeTeam.abbrev] || {};
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
                        "--home-primary-color": homeTeamInfo.primaryColor || "#888888",
                        "--home-secondary-color": homeTeamInfo.secondaryColor || "#555555",
                        "--home-jersey-color": homeTeamInfo.jersey || "#cccccc",
                        "--away-primary-color": awayTeamInfo.primaryColor || "#888888",
                        "--away-secondary-color": awayTeamInfo.secondaryColor || "#555555",
                        "--away-jersey-color": awayTeamInfo.jersey || "#cccccc",
                        "--home-primary-light-color": homeTeamInfo.lightColor || "#aaaaaa",
                        "--away-primary-light-color": awayTeamInfo.lightColor || "#aaaaaa"
                      } as CSSProperties
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
                        {typeof homeTeam?.record === "string" ? homeTeam.record : ""}
                      </div>
                    </div>
                    <div className={`${styles.teamRecordMobile} ${styles.homeRecord}`}>
                      {typeof homeTeam?.record === "string" ? homeTeam.record : ""}
                    </div>
                    <div className={styles.gameTimeSection}>
                      <div className={styles.homeScore}>{homeTeam.score ?? "-"}</div>
                      <div className={styles.gameTimeInfo}>
                        <span className={styles.gameState}>
                          {game.gameState === "LIVE"
                            ? formatPeriodText(
                                game?.periodDescriptor?.number ?? game?.period,
                                game?.periodDescriptor?.periodType ?? game?.periodType,
                                game?.clock && game.clock.inIntermission !== undefined
                                  ? game.clock.inIntermission
                                  : game?.inIntermission
                              )
                            : getDisplayGameState(game.gameState)}
                        </span>
                        <ClientOnly>
                          <span className={styles.gameTimeText}>
                            {game.gameState === "LIVE"
                              ? !(game?.clock && game.clock.inIntermission !== undefined
                                  ? game.clock.inIntermission
                                  : game?.inIntermission)
                                ? game?.clock?.timeRemaining || game?.timeRemaining || "--:--"
                                : ""
                              : formatLocalStartTime(game.startTimeUTC)}
                          </span>
                        </ClientOnly>
                      </div>
                      <div className={styles.awayScore}>{awayTeam.score ?? "-"}</div>
                    </div>
                    <div className={`${styles.teamRecordMobile} ${styles.awayRecord}`}>
                      {typeof awayTeam?.record === "string" ? awayTeam.record : ""}
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
                        {typeof awayTeam?.record === "string" ? awayTeam.record : ""}
                      </div>
                    </div>
                  </div>
                </Link>
              );
            })}
          </>
        ) : null}
      </div>
    </div>
  );
}
