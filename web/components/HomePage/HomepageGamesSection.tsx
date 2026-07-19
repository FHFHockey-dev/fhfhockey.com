import { useEffect, useMemo, useState, type CSSProperties } from "react";

import Link from "next/link";
import moment from "moment-timezone";
import "moment-timezone";

import ClientOnly from "components/ClientOnly";
import PanelStatus from "components/common/PanelStatus";
import OptimizedImage from "components/common/OptimizedImage";
import { buildHomepageModulePresentation } from "lib/dashboard/freshness";
import { type PlayoffBracketResponse } from "lib/NHL/server/playoffBracket";
import { fallbackNHLLogo, getTeamLogoSvg } from "lib/images";
import { HOME_SURFACE_LINKS } from "lib/navigation/siteSurfaceLinks";
import { teamsInfo } from "lib/teamsInfo";
import styles from "styles/Home.module.scss";
import HomepagePlayoffBracket from "./HomepagePlayoffBracket";
import HomepagePulse from "./HomepagePulse";
import type { HomepagePulsePoint } from "lib/homepagePulse";
import {
  formatLocalStartTime,
  formatPeriodText,
  getDisplayGameState,
} from "./homepageGameFormatting";

type HomepageGamesSectionProps = {
  currentDate: string;
  games: any[];
  gamesHeaderText: string;
  onChangeDate: (days: number) => void;
  loading: boolean;
  error: string | null;
  lastUpdatedAt: string | null;
  playoffsActive?: boolean;
  playoffBracket?: PlayoffBracketResponse | null;
  playoffWeekGames?: any[];
  heroMetrics?: Array<{
    label: string;
    value: string;
    caption: string;
  }>;
  pulsePoints?: HomepagePulsePoint[];
  openingNightDate?: string | null;
  openingNightStartTime?: string | null;
};

const COUNTDOWN_UNITS = [
  ["days", "Days"],
  ["hours", "Hours"],
  ["minutes", "Minutes"],
  ["seconds", "Seconds"],
] as const;

export default function HomepageGamesSection({
  currentDate,
  games,
  gamesHeaderText,
  onChangeDate,
  loading,
  error,
  lastUpdatedAt,
  playoffsActive = false,
  playoffBracket = null,
  playoffWeekGames = [],
  heroMetrics = [],
  pulsePoints = [],
  openingNightDate = null,
  openingNightStartTime = null,
}: HomepageGamesSectionProps) {
  const liveGames = games.filter(
    (game) => game.gameState === "LIVE" || game.gameState === "CRIT",
  ).length;
  const finalGames = games.filter((game) =>
    ["OVER", "FINAL", "OFF"].includes(game.gameState),
  ).length;
  const upcomingGames = Math.max(games.length - liveGames - finalGames, 0);
  const uniqueTeamCount = new Set(
    games
      .flatMap((game) => [game?.homeTeam?.abbrev, game?.awayTeam?.abbrev])
      .filter(Boolean),
  ).size;
  const firstScheduledGame = games.find(
    (game) => typeof game.startTimeUTC === "string",
  );
  const [scheduleContext, setScheduleContext] = useState<string | null>(null);
  const [countdownNow, setCountdownNow] = useState<number | null>(null);
  const hasOfficialPuckDrop = Boolean(
    openingNightStartTime && moment(openingNightStartTime).isValid(),
  );
  const openingNightTarget = useMemo(() => {
    const date = openingNightDate?.slice(0, 10);
    if (!date) return null;

    const scheduledStart = openingNightStartTime
      ? moment(openingNightStartTime).tz("America/New_York")
      : null;
    const target = scheduledStart?.isValid()
      ? scheduledStart
      : moment.tz(date, "YYYY-MM-DD", "America/New_York").startOf("day");
    return target.isValid() ? target : null;
  }, [openingNightDate, openingNightStartTime]);

  useEffect(() => {
    if (!firstScheduledGame?.startTimeUTC) {
      setScheduleContext(null);
      return;
    }

    setScheduleContext(formatLocalStartTime(firstScheduledGame.startTimeUTC));
  }, [firstScheduledGame?.startTimeUTC]);

  useEffect(() => {
    if (!openingNightTarget) {
      setCountdownNow(null);
      return;
    }

    const updateCountdown = () => setCountdownNow(Date.now());
    updateCountdown();
    const interval = window.setInterval(updateCountdown, 1_000);
    return () => window.clearInterval(interval);
  }, [openingNightTarget]);

  const openingNightCountdown = useMemo(() => {
    if (!openingNightTarget || countdownNow === null) return null;
    const remaining = Math.max(openingNightTarget.valueOf() - countdownNow, 0);

    return {
      days: Math.floor(remaining / 86_400_000),
      hours: Math.floor((remaining % 86_400_000) / 3_600_000),
      minutes: Math.floor((remaining % 3_600_000) / 60_000),
      seconds: Math.floor((remaining % 60_000) / 1_000),
      complete: remaining === 0,
    };
  }, [countdownNow, openingNightTarget]);
  const showOpeningNightCountdown = Boolean(
    games.length === 0 &&
    openingNightTarget &&
    (!openingNightCountdown || !openingNightCountdown.complete),
  );

  const heroDescription = playoffsActive
    ? liveGames > 0
      ? `${liveGames} playoff game${liveGames === 1 ? "" : "s"} live right now. Track the bracket, tonight's slate, and every best-of-seven race from one surface.`
      : games.length > 0
        ? `${games.length} playoff game${games.length === 1 ? "" : "s"} on the board${scheduleContext ? `, starting at ${scheduleContext}` : ""}.`
        : `No playoff games are scheduled for ${moment(currentDate).format("MMMM D")}, but the bracket stays live with the next series turn already mapped.`
    : games.length > 0
      ? liveGames > 0
        ? `${liveGames} game${liveGames === 1 ? "" : "s"} live right now. Move from the slate to confirmed starter context and market movement without leaving the homepage flow.`
        : `${games.length} game${games.length === 1 ? "" : "s"} on the board${scheduleContext ? `, starting at ${scheduleContext}` : ""}.`
      : `No games are scheduled for ${moment(currentDate).format("MMMM D")}.\nUse the tools below to plan your next move before the slate repopulates.`;
  const modulePresentation = buildHomepageModulePresentation({
    source: "homepage-games",
    loading,
    error,
    isEmpty: games.length === 0 && !error,
    timestamp: lastUpdatedAt,
    maxAgeHours: 8,
    loadingMessage: "Refreshing the slate...",
    emptyMessage: `No games scheduled for ${moment(currentDate).format("MM/DD/YYYY")}.`,
    staleMessage:
      "Slate data may be stale. Refresh before making lineup decisions.",
  });

  return (
    <div className={styles.gameCardsContainer}>
      <section
        className={styles.gamesStrip}
        aria-labelledby="games-strip-heading"
      >
        <div className={styles.gamesHeader}>
          <div className={styles.gamesHeaderTitle}>
            <h2 id="games-strip-heading">
              {gamesHeaderText} <span>Games</span>
            </h2>
          </div>
          {!playoffsActive ? (
            <button
              onClick={() => onChangeDate(-1)}
              aria-label="Previous Day"
            ></button>
          ) : null}
          <div className={styles.headerAndDate}>
            <span className={styles.dateDisplay}>
              {moment(currentDate).format("ddd, MMM D")}
            </span>
          </div>
          {!playoffsActive ? (
            <button
              onClick={() => onChangeDate(1)}
              aria-label="Next Day"
            ></button>
          ) : null}
          <div className={styles.gamesSummary} aria-label="Slate summary">
            <span>
              <strong>{games.length}</strong>
              Games
            </span>
            <span>
              <strong>{uniqueTeamCount}</strong>
              Teams
            </span>
            <span>
              <strong>{liveGames + finalGames}</strong>
              Games started
            </span>
          </div>
        </div>

        <div className={styles.gamesContainer}>
          {modulePresentation.panelState &&
          !(
            showOpeningNightCountdown &&
            modulePresentation.panelState === "empty"
          ) ? (
            <PanelStatus
              state={modulePresentation.panelState}
              message={modulePresentation.message ?? ""}
              className={styles.moduleStatusPanel}
            />
          ) : null}
          {showOpeningNightCountdown ? (
            <section
              className={styles.openingNightCountdown}
              aria-labelledby="opening-night-countdown-heading"
            >
              <div className={styles.openingNightIntro}>
                <span>Next season</span>
                <h3 id="opening-night-countdown-heading">
                  Opening night countdown
                </h3>
                <p>
                  The slate returns on{" "}
                  <time dateTime={openingNightTarget?.toISOString()}>
                    {hasOfficialPuckDrop
                      ? openingNightTarget?.format("MMM D, YYYY · h:mm A z")
                      : openingNightTarget?.format("MMM D, YYYY")}
                  </time>
                  .
                </p>
                <small>
                  {hasOfficialPuckDrop
                    ? "Puck-drop time from the official NHL schedule."
                    : "Official season date from the FHFH registry; puck-drop time updates when the NHL schedule is available."}
                </small>
              </div>
              <div
                className={styles.countdownGrid}
                aria-label="Time remaining until NHL opening night"
              >
                {COUNTDOWN_UNITS.map(([key, label]) => (
                  <span className={styles.countdownUnit} key={key}>
                    <strong>
                      {openingNightCountdown
                        ? String(openingNightCountdown[key]).padStart(2, "0")
                        : "--"}
                    </strong>
                    <small>{label}</small>
                  </span>
                ))}
              </div>
            </section>
          ) : null}
          {playoffsActive && playoffBracket ? (
            <HomepagePlayoffBracket
              currentDate={currentDate}
              games={games}
              playoffBracket={playoffBracket}
              playoffWeekGames={playoffWeekGames}
            />
          ) : null}
          {games.length > 0 && !playoffsActive ? (
            <div className={styles.gamesGrid}>
              {games.map((game) => {
                const homeTeam = game.homeTeam;
                const awayTeam = game.awayTeam;
                const homeTeamInfo = teamsInfo[homeTeam.abbrev];
                const awayTeamInfo = teamsInfo[awayTeam.abbrev];
                const broadcast = game?.tvBroadcasts?.[0]?.network ?? null;

                if (!homeTeam?.abbrev || !awayTeam?.abbrev) return null;

                return (
                  <Link
                    key={game.id}
                    href={`/game/${game.id}`}
                    className={styles.gameLink}
                  >
                    <div
                      className={styles.combinedGameCard}
                      style={
                        {
                          "--home-primary-color":
                            homeTeamInfo?.primaryColor ?? "#888888",
                          "--home-secondary-color":
                            homeTeamInfo?.secondaryColor ?? "#555555",
                          "--home-jersey-color":
                            homeTeamInfo?.jersey ?? "#cccccc",
                          "--away-primary-color":
                            awayTeamInfo?.primaryColor ?? "#888888",
                          "--away-secondary-color":
                            awayTeamInfo?.secondaryColor ?? "#555555",
                          "--away-jersey-color":
                            awayTeamInfo?.jersey ?? "#cccccc",
                          "--home-primary-light-color":
                            homeTeamInfo?.lightColor ?? "#aaaaaa",
                          "--away-primary-light-color":
                            awayTeamInfo?.lightColor ?? "#aaaaaa",
                        } as CSSProperties
                      }
                    >
                      <span className={styles.broadcastLabel}>
                        {broadcast ?? getDisplayGameState(game.gameState)}
                      </span>
                      <div
                        className={styles.awayTeamLogo}
                        title={`AWAY ${awayTeam?.abbrev ?? ""} record: ${awayTeam?.record ?? "n/a"}`}
                      >
                        <OptimizedImage
                          src={getTeamLogoSvg(awayTeam.abbrev)}
                          className={styles.leftImage}
                          alt={`${awayTeam.abbrev} logo`}
                          width={52}
                          height={52}
                          priority={false}
                          fallbackSrc={fallbackNHLLogo}
                        />
                        <strong className={styles.teamAbbreviation}>
                          {awayTeam.abbrev}
                        </strong>
                        <span className={styles.teamRecord}>
                          {typeof awayTeam?.record === "string"
                            ? awayTeam.record
                            : ""}
                        </span>
                      </div>
                      <div className={styles.gameTimeInfo}>
                        <span className={styles.gameState}>
                          {game.gameState === "LIVE"
                            ? formatPeriodText(
                                game?.periodDescriptor?.number ?? game?.period,
                                game?.periodDescriptor?.periodType ??
                                  game?.periodType,
                                game?.clock &&
                                  game.clock.inIntermission !== undefined
                                  ? game.clock.inIntermission
                                  : game?.inIntermission,
                              )
                            : getDisplayGameState(game.gameState)}
                        </span>
                        <ClientOnly>
                          <span className={styles.gameTimeText}>
                            {game.gameState === "LIVE"
                              ? !(game?.clock &&
                                game.clock.inIntermission !== undefined
                                  ? game.clock.inIntermission
                                  : game?.inIntermission)
                                ? game?.clock?.timeRemaining ||
                                  game?.timeRemaining ||
                                  "--:--"
                                : ""
                              : formatLocalStartTime(game.startTimeUTC)}
                          </span>
                        </ClientOnly>
                        <span className={styles.matchupDivider}>vs</span>
                      </div>
                      <div
                        className={styles.homeTeamLogo}
                        title={`HOME ${homeTeam?.abbrev ?? ""} record: ${homeTeam?.record ?? "n/a"}`}
                      >
                        <OptimizedImage
                          src={getTeamLogoSvg(homeTeam.abbrev)}
                          className={styles.rightImage}
                          alt={`${homeTeam.abbrev} logo`}
                          width={52}
                          height={52}
                          priority={false}
                          fallbackSrc={fallbackNHLLogo}
                        />
                        <strong className={styles.teamAbbreviation}>
                          {homeTeam.abbrev}
                        </strong>
                        <span className={styles.teamRecord}>
                          {typeof homeTeam?.record === "string"
                            ? homeTeam.record
                            : ""}
                        </span>
                      </div>
                      {homeTeam.score != null || awayTeam.score != null ? (
                        <span className={styles.gameScore}>
                          {awayTeam.score ?? "–"}–{homeTeam.score ?? "–"}
                        </span>
                      ) : null}
                    </div>
                  </Link>
                );
              })}
            </div>
          ) : null}
        </div>
      </section>

      <section className={styles.slateHero} aria-labelledby="slate-heading">
        <div className={styles.slateHeroIntro}>
          <p className={styles.slateEyebrow}>Welcome to</p>
          <h1 id="slate-heading" className={styles.slateHeadline}>
            {playoffsActive ? "The Bracket" : "The Slate"}
          </h1>
          <p className={styles.slateDescription}>
            Real-Time NHL Analytics.
            <br />
            Built for Fantasy.
          </p>
          <div className={styles.slateAccent} aria-hidden="true">
            <i></i>
            <i></i>
            <i></i>
            <i></i>
          </div>
        </div>

        <div className={styles.slateDashboard}>
          <div className={styles.slateSummaryRail}>
            {heroMetrics.map((metric) => (
              <div key={metric.label} className={styles.slateSummaryCard}>
                <span className={styles.metricIcon} aria-hidden="true"></span>
                <span className={styles.slateSummaryLabel}>{metric.label}</span>
                <strong className={styles.slateSummaryValue}>
                  {metric.value}
                </strong>
                <small>{metric.caption}</small>
              </div>
            ))}
          </div>

          <div className={styles.edgePanel}>
            <HomepagePulse initialPoints={pulsePoints} />
            <div className={styles.edgeCopy}>
              <strong>
                Today&apos;s <span>Edge</span>
              </strong>
              <p>{heroDescription}</p>
            </div>
            {lastUpdatedAt ? (
              <ClientOnly>
                <div className={styles.dataUpdated}>
                  <span>Data updated</span>
                  <small>
                    <i aria-hidden="true"></i>
                    {moment(lastUpdatedAt).fromNow()}
                  </small>
                </div>
              </ClientOnly>
            ) : null}
          </div>
        </div>

        <nav className={styles.slateActionRow} aria-label="Homepage tools">
          {HOME_SURFACE_LINKS.slice(0, 4).map((link) => (
            <Link
              key={link.href}
              href={link.href}
              className={styles.slateActionLink}
            >
              {link.label}
            </Link>
          ))}
        </nav>
      </section>
    </div>
  );
}
