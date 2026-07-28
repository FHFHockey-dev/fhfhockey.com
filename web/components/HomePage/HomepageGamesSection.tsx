import {
  useEffect,
  useMemo,
  useRef,
  useState,
  type CSSProperties,
  type KeyboardEvent as ReactKeyboardEvent,
} from "react";

import Link from "next/link";
import moment from "moment-timezone";
import "moment-timezone";

import ClientOnly from "components/ClientOnly";
import PanelStatus from "components/common/PanelStatus";
import OptimizedImage from "components/common/OptimizedImage";
import { buildHomepageModulePresentation } from "lib/dashboard/freshness";
import { type PlayoffBracketResponse } from "lib/NHL/server/playoffBracket";
import type { HomepageGameAnalytics } from "lib/homepageGameAnalytics";
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
  isFinalGameState,
  isLiveGameState,
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

const WEEKDAY_LABELS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

type MobileSlateMode = "light" | "medium" | "heavy";
type MobileGameGroup = "live" | "scheduled" | "final";

const getMobileSlateMode = (gameCount: number): MobileSlateMode => {
  if (gameCount <= 5) return "light";
  if (gameCount <= 11) return "medium";
  return "heavy";
};

const getMobileGameGroup = (gameState?: string): MobileGameGroup => {
  if (isLiveGameState(gameState)) return "live";
  if (isFinalGameState(gameState)) return "final";
  return "scheduled";
};

const getGameColorStyle = (
  homeTeamAbbreviation: string,
  awayTeamAbbreviation: string,
) => {
  const homeTeamInfo = teamsInfo[homeTeamAbbreviation];
  const awayTeamInfo = teamsInfo[awayTeamAbbreviation];

  return {
    "--home-primary-color": homeTeamInfo?.primaryColor ?? "#888888",
    "--home-secondary-color": homeTeamInfo?.secondaryColor ?? "#555555",
    "--home-jersey-color": homeTeamInfo?.jersey ?? "#cccccc",
    "--away-primary-color": awayTeamInfo?.primaryColor ?? "#888888",
    "--away-secondary-color": awayTeamInfo?.secondaryColor ?? "#555555",
    "--away-jersey-color": awayTeamInfo?.jersey ?? "#cccccc",
    "--home-primary-light-color": homeTeamInfo?.lightColor ?? "#aaaaaa",
    "--away-primary-light-color": awayTeamInfo?.lightColor ?? "#aaaaaa",
  } as CSSProperties;
};

const compactMetric = (value: number) =>
  Number.isInteger(value) ? String(value) : value.toFixed(2);

const probabilityTone = (probability: number) =>
  probability > 0.5
    ? "favored"
    : probability < 0.5
      ? "underdog"
      : "even";

const probabilityClassName = (probability: number) => {
  const tone = probabilityTone(probability);
  if (tone === "favored") return styles.probabilityFavored;
  if (tone === "underdog") return styles.probabilityUnderdog;
  return styles.probabilityEven;
};

const formatEdge = (percentagePoints: number) =>
  `${percentagePoints > 0 ? "+" : ""}${percentagePoints.toFixed(1)}pp`;

const isFreshLiveMetric = (updatedAt?: string) => {
  if (!updatedAt) return false;
  const age = Date.now() - Date.parse(updatedAt);
  return Number.isFinite(age) && age >= -60_000 && age <= 15 * 60_000;
};

function MobileGameItem({
  game,
  mode,
}: {
  game: any;
  mode: MobileSlateMode;
}) {
  const homeTeam = game?.homeTeam;
  const awayTeam = game?.awayTeam;
  if (!homeTeam?.abbrev || !awayTeam?.abbrev) return null;

  const group = getMobileGameGroup(game.gameState);
  const broadcast = game?.tvBroadcasts?.[0]?.network ?? null;
  const inIntermission = Boolean(
    game?.clock && game.clock.inIntermission !== undefined
      ? game.clock.inIntermission
      : game?.inIntermission,
  );
  const periodLabel =
    group === "live"
      ? formatPeriodText(
          game?.periodDescriptor?.number ?? game?.period ?? 1,
          game?.periodDescriptor?.periodType ?? game?.periodType ?? "REG",
          inIntermission,
        ).replace(" Period", "")
      : null;
  const clock =
    group === "live" && !inIntermission
      ? game?.clock?.timeRemaining || game?.timeRemaining || "--:--"
      : null;
  const stateLabel =
    group === "live"
      ? "Live"
      : group === "final"
        ? "Final"
        : getDisplayGameState(game.gameState);
  const analytics = (game.analytics ?? null) as HomepageGameAnalytics | null;
  const edgeAvailable =
    group === "scheduled" &&
    analytics?.predictionFreshness !== "stale" &&
    analytics?.edgeTeamAbbreviation &&
    typeof analytics.edgePercentagePoints === "number";
  const probabilitiesAvailable =
    group === "scheduled" &&
    analytics?.predictionFreshness !== "stale" &&
    typeof analytics?.awayWinProbability === "number" &&
    typeof analytics.homeWinProbability === "number";
  const projectedGoalsAvailable =
    group === "scheduled" &&
    analytics?.projectedGoalsFreshness !== "stale" &&
    typeof analytics?.awayProjectedGoals === "number" &&
    typeof analytics.homeProjectedGoals === "number";
  const xgAvailable =
    group !== "scheduled" &&
    (group === "final" || isFreshLiveMetric(analytics?.xgUpdatedAt)) &&
    typeof analytics?.awayXg === "number" &&
    typeof analytics.homeXg === "number";
  const shotsAvailable =
    group !== "scheduled" &&
    (group === "final" || isFreshLiveMetric(analytics?.shotsUpdatedAt)) &&
    typeof analytics?.awayShotsOnGoal === "number" &&
    typeof analytics.homeShotsOnGoal === "number";
  const starterAvailable =
    group !== "final" &&
    (analytics?.awayStarter?.name || analytics?.homeStarter?.name);
  const matchupLabel = `${awayTeam.abbrev} at ${homeTeam.abbrev}, ${stateLabel}${
    probabilitiesAvailable
      ? `, pregame win probability ${awayTeam.abbrev} ${Math.round(
          analytics!.awayWinProbability! * 100,
        )} percent, ${homeTeam.abbrev} ${Math.round(
          analytics!.homeWinProbability! * 100,
        )} percent`
      : ""
  }`;

  return (
    <Link
      href={`/game/${game.id}`}
      className={styles.mobileGameLink}
      data-game-state={group}
      data-has-probabilities={probabilitiesAvailable ? "true" : "false"}
      aria-label={matchupLabel}
      style={getGameColorStyle(homeTeam.abbrev, awayTeam.abbrev)}
    >
      <span className={styles.mobileGameState}>
        <i aria-hidden="true" />
        <span>{stateLabel}</span>
      </span>
      <span className={styles.mobileGameTime}>
        <ClientOnly>
          <span>
            {group === "scheduled"
              ? mode === "light"
                ? formatLocalStartTime(game.startTimeUTC)
                : formatLocalStartTime(game.startTimeUTC).replace(
                    /\s[A-Z]{2,5}$/,
                    "",
                  )
              : periodLabel}
            {clock ? <small>{clock}</small> : null}
          </span>
        </ClientOnly>
      </span>
      {probabilitiesAvailable ? (
        <span
          className={`${styles.mobileWinProbability} ${styles.mobileAwayProbability} ${probabilityClassName(
            analytics.awayWinProbability!,
          )}`}
          data-probability-tone={probabilityTone(
            analytics.awayWinProbability!,
          )}
          title={`${awayTeam.abbrev} pregame win probability`}
        >
          {Math.round(analytics.awayWinProbability! * 100)}%
        </span>
      ) : null}
      <span
        className={`${styles.mobileTeam} ${styles.mobileAwayTeam}`}
        title={`AWAY ${awayTeam.abbrev} record: ${awayTeam?.record ?? "n/a"}`}
      >
        <OptimizedImage
          src={getTeamLogoSvg(awayTeam.abbrev)}
          alt={`${awayTeam.abbrev} logo`}
          width={32}
          height={32}
          priority={false}
          fallbackSrc={fallbackNHLLogo}
        />
        <strong>{awayTeam.abbrev}</strong>
        {awayTeam.score != null ? <b>{awayTeam.score}</b> : null}
      </span>
      <span className={styles.mobileMatchupDivider}>
        {group === "scheduled" ? "AT" : "–"}
      </span>
      <span
        className={`${styles.mobileTeam} ${styles.mobileHomeTeam}`}
        title={`HOME ${homeTeam.abbrev} record: ${homeTeam?.record ?? "n/a"}`}
      >
        {homeTeam.score != null ? <b>{homeTeam.score}</b> : null}
        <strong>{homeTeam.abbrev}</strong>
        <OptimizedImage
          src={getTeamLogoSvg(homeTeam.abbrev)}
          alt={`${homeTeam.abbrev} logo`}
          width={32}
          height={32}
          priority={false}
          fallbackSrc={fallbackNHLLogo}
        />
      </span>
      {probabilitiesAvailable ? (
        <span
          className={`${styles.mobileWinProbability} ${styles.mobileHomeProbability} ${probabilityClassName(
            analytics.homeWinProbability!,
          )}`}
          data-probability-tone={probabilityTone(
            analytics.homeWinProbability!,
          )}
          title={`${homeTeam.abbrev} pregame win probability`}
        >
          {Math.round(analytics.homeWinProbability! * 100)}%
        </span>
      ) : null}
      <span className={styles.mobileBroadcast}>{broadcast ?? ""}</span>
      {edgeAvailable ||
      projectedGoalsAvailable ||
      xgAvailable ||
      shotsAvailable ? (
        <span className={styles.mobileAnalytics}>
          {projectedGoalsAvailable ? (
            <span>
              <small>Proj</small>
              {compactMetric(analytics.awayProjectedGoals!)}–
              {compactMetric(analytics.homeProjectedGoals!)}
            </span>
          ) : null}
          {edgeAvailable ? (
            <span>
              <small>Edge</small>
              {analytics.edgeTeamAbbreviation}{" "}
              {formatEdge(analytics.edgePercentagePoints!)}
            </span>
          ) : null}
          {xgAvailable ? (
            <span>
              <small>xGF</small>
              {compactMetric(analytics.awayXg!)}–
              {compactMetric(analytics.homeXg!)}
            </span>
          ) : null}
          {shotsAvailable ? (
            <span>
              <small>SOG</small>
              {analytics.awayShotsOnGoal}–{analytics.homeShotsOnGoal}
            </span>
          ) : null}
        </span>
      ) : null}
      {starterAvailable ? (
        <span className={styles.mobileStarters}>
          <small>Starters</small>
          {analytics?.awayStarter?.name
            ? `${analytics.awayStarter.confirmed ? "✓ " : ""}${analytics.awayStarter.name} (${awayTeam.abbrev})`
            : ""}
          {analytics?.awayStarter?.name && analytics?.homeStarter?.name
            ? " vs "
            : ""}
          {analytics?.homeStarter?.name
            ? `${analytics.homeStarter.confirmed ? "✓ " : ""}${analytics.homeStarter.name} (${homeTeam.abbrev})`
            : ""}
        </span>
      ) : null}
      {awayTeam.record || homeTeam.record ? (
        <span className={styles.mobileGameRecords}>
          {awayTeam.record ? `${awayTeam.abbrev} ${awayTeam.record}` : ""}
          {awayTeam.record && homeTeam.record ? " · " : ""}
          {homeTeam.record ? `${homeTeam.abbrev} ${homeTeam.record}` : ""}
        </span>
      ) : null}
      <span className={styles.mobileGameChevron} aria-hidden="true">
        ›
      </span>
    </Link>
  );
}

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
  const [calendarOpen, setCalendarOpen] = useState(false);
  const [calendarMonth, setCalendarMonth] = useState(() =>
    moment(currentDate).startOf("month").format("YYYY-MM-DD"),
  );
  const dateSelectorRef = useRef<HTMLDivElement | null>(null);
  const dateButtonRef = useRef<HTMLButtonElement | null>(null);
  const calendarDialogRef = useRef<HTMLDivElement | null>(null);
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

  useEffect(() => {
    if (!calendarOpen) return;

    setCalendarMonth(
      moment(currentDate).startOf("month").format("YYYY-MM-DD"),
    );

    const focusSelectedDate = window.requestAnimationFrame(() => {
      calendarDialogRef.current
        ?.querySelector<HTMLButtonElement>(
          `[data-calendar-date="${currentDate}"]`,
        )
        ?.focus();
    });

    const closeCalendar = () => {
      setCalendarOpen(false);
      window.requestAnimationFrame(() => dateButtonRef.current?.focus());
    };
    const handlePointerDown = (event: MouseEvent) => {
      if (
        dateSelectorRef.current &&
        !dateSelectorRef.current.contains(event.target as Node)
      ) {
        setCalendarOpen(false);
      }
    };
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        event.preventDefault();
        closeCalendar();
        return;
      }

      if (event.key !== "Tab" || !calendarDialogRef.current) return;
      const focusableElements = Array.from(
        calendarDialogRef.current.querySelectorAll<HTMLElement>(
          'button:not([disabled]), [href], [tabindex]:not([tabindex="-1"])',
        ),
      );
      const firstElement = focusableElements[0];
      const lastElement = focusableElements.at(-1);

      if (event.shiftKey && document.activeElement === firstElement) {
        event.preventDefault();
        lastElement?.focus();
      } else if (!event.shiftKey && document.activeElement === lastElement) {
        event.preventDefault();
        firstElement?.focus();
      }
    };

    document.addEventListener("mousedown", handlePointerDown);
    document.addEventListener("keydown", handleKeyDown);
    return () => {
      window.cancelAnimationFrame(focusSelectedDate);
      document.removeEventListener("mousedown", handlePointerDown);
      document.removeEventListener("keydown", handleKeyDown);
    };
  }, [calendarOpen, currentDate]);

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
  const openingNightSeasonLabel = openingNightTarget
    ? `${openingNightTarget.year()}-${String(
        openingNightTarget.year() + 1,
      ).slice(-2)} season`
    : "Next season";
  const displayedCalendarMonth = useMemo(
    () => moment(calendarMonth, "YYYY-MM-DD", true),
    [calendarMonth],
  );
  const calendarWeeks = useMemo(() => {
    const firstVisibleDate = displayedCalendarMonth
      .clone()
      .startOf("month")
      .startOf("week");

    return Array.from({ length: 6 }, (_, weekIndex) =>
      Array.from({ length: 7 }, (_, dayIndex) =>
        firstVisibleDate.clone().add(weekIndex * 7 + dayIndex, "days"),
      ),
    );
  }, [displayedCalendarMonth]);
  const todayDate = moment().format("YYYY-MM-DD");
  const mobileSlateMode = getMobileSlateMode(games.length);
  const mobileGameGroups = [
    {
      key: "live" as const,
      label: "Live now",
      games: games.filter((game) => getMobileGameGroup(game.gameState) === "live"),
    },
    {
      key: "scheduled" as const,
      label: "Scheduled",
      games: games.filter(
        (game) => getMobileGameGroup(game.gameState) === "scheduled",
      ),
    },
    {
      key: "final" as const,
      label: "Final",
      games: games.filter(
        (game) => getMobileGameGroup(game.gameState) === "final",
      ),
    },
  ].filter((group) => group.games.length > 0);
  const mobileOrderedGames = mobileGameGroups.flatMap((group) => group.games);

  const closeCalendar = (restoreFocus = true) => {
    setCalendarOpen(false);
    if (restoreFocus) {
      window.requestAnimationFrame(() => dateButtonRef.current?.focus());
    }
  };
  const selectDate = (selectedDate: string) => {
    const dayOffset = moment(selectedDate, "YYYY-MM-DD", true).diff(
      moment(currentDate, "YYYY-MM-DD", true),
      "days",
    );
    if (dayOffset !== 0) onChangeDate(dayOffset);
    closeCalendar();
  };
  const focusCalendarDate = (date: moment.Moment) => {
    const dateValue = date.format("YYYY-MM-DD");
    const focusDate = () =>
      calendarDialogRef.current
        ?.querySelector<HTMLButtonElement>(
          `[data-calendar-date="${dateValue}"]`,
        )
        ?.focus();

    if (
      !calendarDialogRef.current?.querySelector(
        `[data-calendar-date="${dateValue}"]`,
      )
    ) {
      setCalendarMonth(date.clone().startOf("month").format("YYYY-MM-DD"));
      window.requestAnimationFrame(() =>
        window.requestAnimationFrame(focusDate),
      );
      return;
    }
    focusDate();
  };
  const handleCalendarKeyDown = (
    event: ReactKeyboardEvent<HTMLButtonElement>,
    date: moment.Moment,
  ) => {
    const keyOffsets: Partial<Record<string, number>> = {
      ArrowLeft: -1,
      ArrowRight: 1,
      ArrowUp: -7,
      ArrowDown: 7,
    };
    const dayOffset = keyOffsets[event.key];
    let nextDate: moment.Moment | null =
      dayOffset === undefined ? null : date.clone().add(dayOffset, "days");

    if (event.key === "Home") nextDate = date.clone().startOf("week");
    if (event.key === "End") nextDate = date.clone().endOf("week");
    if (event.key === "PageUp") nextDate = date.clone().subtract(1, "month");
    if (event.key === "PageDown") nextDate = date.clone().add(1, "month");
    if (!nextDate) return;

    event.preventDefault();
    focusCalendarDate(nextDate);
  };

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
      : "No games today.\nUse the tools below to plan your next move.";
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
              type="button"
              onClick={() => onChangeDate(-1)}
              aria-label="Previous Day"
            ></button>
          ) : null}
          <div className={styles.dateSelector} ref={dateSelectorRef}>
            <button
              ref={dateButtonRef}
              type="button"
              className={styles.headerAndDate}
              aria-label={`Choose game date, currently ${moment(currentDate).format("MMMM D, YYYY")}`}
              aria-haspopup="dialog"
              aria-expanded={calendarOpen}
              aria-controls="homepage-games-calendar"
              onClick={() => setCalendarOpen((open) => !open)}
            >
              <span className={styles.dateDisplay}>
                {moment(currentDate).format("ddd, MMM D")}
              </span>
            </button>
            {calendarOpen ? (
              <div
                id="homepage-games-calendar"
                ref={calendarDialogRef}
                className={styles.calendarPopover}
                role="dialog"
                aria-modal="true"
                aria-label="Choose game date"
              >
                <div className={styles.calendarHeader}>
                  <button
                    type="button"
                    aria-label="Previous month"
                    onClick={() =>
                      setCalendarMonth(
                        displayedCalendarMonth
                          .clone()
                          .subtract(1, "month")
                          .format("YYYY-MM-DD"),
                      )
                    }
                  >
                    ‹
                  </button>
                  <strong aria-live="polite">
                    {displayedCalendarMonth.format("MMMM YYYY")}
                  </strong>
                  <button
                    type="button"
                    aria-label="Next month"
                    onClick={() =>
                      setCalendarMonth(
                        displayedCalendarMonth
                          .clone()
                          .add(1, "month")
                          .format("YYYY-MM-DD"),
                      )
                    }
                  >
                    ›
                  </button>
                </div>
                <div
                  className={styles.calendarGrid}
                  role="grid"
                  aria-label={displayedCalendarMonth.format("MMMM YYYY")}
                >
                  <div className={styles.calendarWeekdays} role="row">
                    {WEEKDAY_LABELS.map((weekday) => (
                      <span
                        key={weekday}
                        role="columnheader"
                        aria-label={weekday}
                      >
                        {weekday.slice(0, 1)}
                      </span>
                    ))}
                  </div>
                  {calendarWeeks.map((week) => (
                    <div
                      className={styles.calendarWeek}
                      role="row"
                      key={week[0].format("YYYY-MM-DD")}
                    >
                      {week.map((date) => {
                        const dateValue = date.format("YYYY-MM-DD");
                        const selected = dateValue === currentDate;
                        const today = dateValue === todayDate;
                        const outsideMonth =
                          date.month() !== displayedCalendarMonth.month();

                        return (
                          <button
                            type="button"
                            role="gridcell"
                            key={dateValue}
                            data-calendar-date={dateValue}
                            data-outside-month={outsideMonth || undefined}
                            aria-label={date.format("MMMM D, YYYY")}
                            aria-selected={selected}
                            aria-current={today ? "date" : undefined}
                            onClick={() => selectDate(dateValue)}
                            onKeyDown={(event) =>
                              handleCalendarKeyDown(event, date)
                            }
                          >
                            {date.date()}
                          </button>
                        );
                      })}
                    </div>
                  ))}
                </div>
                <div className={styles.calendarFooter}>
                  <button type="button" onClick={() => selectDate(todayDate)}>
                    Today
                  </button>
                  <button type="button" onClick={() => closeCalendar()}>
                    Close
                  </button>
                </div>
              </div>
            ) : null}
          </div>
          {!playoffsActive ? (
            <button
              type="button"
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
            <span data-live={liveGames > 0 || undefined}>
              <strong>
                {liveGames > 0 ? liveGames : liveGames + finalGames}
              </strong>
              {liveGames > 0 ? "Live" : "Games started"}
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
                <span>{openingNightSeasonLabel}</span>
                <h3 id="opening-night-countdown-heading">
                  Opening night countdown
                </h3>
                <p>
                  The season opens on{" "}
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
            <div
              className={
                games.length > 0 ? styles.playoffBracketWithGames : undefined
              }
            >
              <HomepagePlayoffBracket
                currentDate={currentDate}
                games={games}
                playoffBracket={playoffBracket}
                playoffWeekGames={playoffWeekGames}
              />
            </div>
          ) : null}
          {games.length > 0 && !playoffsActive ? (
            <div className={styles.gamesGrid}>
              {games.map((game) => {
                const homeTeam = game.homeTeam;
                const awayTeam = game.awayTeam;

                if (!homeTeam?.abbrev || !awayTeam?.abbrev) return null;
                const broadcast = game?.tvBroadcasts?.[0]?.network ?? null;

                return (
                  <Link
                    key={game.id}
                    href={`/game/${game.id}`}
                    className={styles.gameLink}
                  >
                    <div
                      className={styles.combinedGameCard}
                      style={getGameColorStyle(
                        homeTeam.abbrev,
                        awayTeam.abbrev,
                      )}
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
          {games.length > 0 ? (
            <div
              className={styles.mobileGamesSlate}
              data-slate-mode={mobileSlateMode}
              aria-label={`${mobileSlateMode} slate, ${games.length} games`}
            >
              {mobileSlateMode === "light" ? (
                <div className={styles.mobileGameGroup}>
                  {mobileOrderedGames.map((game) => (
                    <MobileGameItem
                      key={game.id}
                      game={game}
                      mode={mobileSlateMode}
                    />
                  ))}
                </div>
              ) : (
                mobileGameGroups.map((group) => (
                  <section
                    className={styles.mobileGameGroup}
                    data-game-group={group.key}
                    aria-labelledby={`mobile-${group.key}-games`}
                    key={group.key}
                  >
                    <h3 id={`mobile-${group.key}-games`}>
                      {group.label} <span>({group.games.length})</span>
                    </h3>
                    {group.games.map((game) => (
                      <MobileGameItem
                        key={game.id}
                        game={game}
                        mode={mobileSlateMode}
                      />
                    ))}
                  </section>
                ))
              )}
              <Link
                href="/game-grid/7-Day-Forecast"
                className={styles.mobileGamesViewAll}
              >
                View all {games.length} games
                <span aria-hidden="true">›</span>
              </Link>
            </div>
          ) : null}
        </div>
      </section>

      <section className={styles.slateHero} aria-labelledby="slate-heading">
        <div className={styles.slateHeroIntro}>
          <h1 id="slate-heading" className={styles.slateHeadline}>
            {playoffsActive ? "The Bracket" : "The Slate"}
          </h1>
          <p className={styles.slateDescription}>
            Real-time analytics. Built for fantasy.
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
