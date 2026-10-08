import { addDays, endOfWeek, format, isValid, parseISO } from "date-fns";
import { DAYS, EXTENDED_DAYS, EXTENDED_DAY_ABBREVIATION, GameData, WeekData } from "lib/NHL/types";
import { useTeam } from "./contexts/GameGridContext";
import { isRegularScheduleGame } from "./utils/helper";
import { CategorySummary, TEAM_FORECAST_CATEGORIES, TeamForecastCategory, summarizeTeamForecasts } from "./utils/teamForecasts";
import styles from "./TeamDetails.module.scss";

export type TeamDetailsProps = {
  teamId: number;
  schedule: WeekData;
  startDate: string;
  excludedDays?: readonly EXTENDED_DAY_ABBREVIATION[];
  extended?: boolean;
  leagueSlateCounts?: readonly (number | null)[];
  coveredDates?: readonly string[];
  scheduleCoverage?: { known: number; expected: number };
  scheduleObservedAt?: string | null;
  /** The forecast eligibility check time, never a source freshness timestamp. */
  asOf?: string;
  summaries?: Partial<Record<TeamForecastCategory, CategorySummary>>;
};

const CATEGORY_NAMES: Record<TeamForecastCategory, string> = {
  G: "Goals", A: "Assists", SOG: "Shots on goal", HIT: "Hits",
  BLK: "Blocked shots", PPP: "Power-play points", PIM: "Penalty minutes",
};

type PreviewGame = GameData & {
  startTimeUTC?: string;
  venue?: string | { default?: string };
};

function calendarDate(value: Date) {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: "America/New_York", year: "numeric", month: "2-digit", day: "2-digit",
  }).format(value);
}

function validDate(value?: string) {
  return value && /^\d{4}-\d{2}-\d{2}$/.test(value) && isValid(parseISO(value)) ? value : null;
}

function gameStateLabel(game: PreviewGame) {
  const states = [game.gameScheduleState, game.gameState].map((state) => state?.toUpperCase());
  if (states.some((state) => state === "PPD" || state === "POSTPONED")) return "Postponed";
  if (states.some((state) => ["CNCL", "CANCELLED", "CANCELED"].includes(state ?? ""))) return "Cancelled";
  if (["FINAL", "OFF", "OVER"].includes(game.gameState?.toUpperCase() ?? "")) return "Completed";
  if (["LIVE", "CRIT", "IN_PROGRESS"].includes(game.gameState?.toUpperCase() ?? "")) return "In progress";
  if (game.gameState?.toUpperCase() === "PRE") return "Pregame";
  if (["FUT", "SCHEDULED"].includes(game.gameState?.toUpperCase() ?? "")) return "Scheduled";
  return "Game state unavailable";
}

/** Uses the selected schedule snapshot; opening a team never starts a data read. */
export default function TeamDetails({
  teamId, schedule, startDate, excludedDays = [], extended = false,
  leagueSlateCounts = [], coveredDates, scheduleCoverage, scheduleObservedAt,
  asOf = new Date().toISOString(), summaries,
}: TeamDetailsProps) {
  const team = useTeam(teamId);
  const selectedStart = parseISO(startDate);
  const weekEnd = isValid(selectedStart)
    ? format(endOfWeek(selectedStart, { weekStartsOn: 1 }), "yyyy-MM-dd") : startDate;
  const checkedAt = parseISO(asOf);
  const checkValid = isValid(checkedAt);
  const today = checkValid ? calendarDate(checkedAt) : null;
  const historical = today !== null && weekEnd < today;
  const coverageComplete = !!scheduleCoverage && scheduleCoverage.expected > 0 &&
    scheduleCoverage.known === scheduleCoverage.expected;
  const sourceDate = scheduleObservedAt ? parseISO(scheduleObservedAt) : null;
  const days = extended ? EXTENDED_DAYS : DAYS;
  const byId = new Map<number, {
    game: PreviewGame; date: string; inferred: boolean; day: EXTENDED_DAY_ABBREVIATION; index: number;
  }>();
  days.forEach((day, index) => {
    const game = schedule[day] as PreviewGame | undefined;
    if (!game || !isValid(selectedStart)) return;
    const date = validDate(game.gameDate);
    byId.set(game.id, { game, date: date ?? format(addDays(selectedStart, index), "yyyy-MM-dd"), inferred: !date, day, index });
  });
  const previews = [...byId.values()].sort((a, b) =>
    a.date.localeCompare(b.date) || (a.game.startTimeUTC ?? "").localeCompare(b.game.startTimeUTC ?? "") || a.game.id - b.game.id);
  const remaining = previews.filter(({ game, date, day }) => {
    const state = gameStateLabel(game);
    if (!today || date < startDate || date > weekEnd || date < today || excludedDays.includes(day) ||
        !isRegularScheduleGame(game) || !["Scheduled", "Pregame"].includes(state)) return false;
    const start = game.startTimeUTC ? parseISO(game.startTimeUTC) : null;
    return start && isValid(start) ? start.getTime() > checkedAt.getTime() : state === "Scheduled" && date > today;
  });
  const uncertainRemaining = previews.some(({ game, date, day }) => {
    if (!today || date < startDate || date > weekEnd || date < today || excludedDays.includes(day) ||
        !isRegularScheduleGame(game)) return false;
    const state = gameStateLabel(game);
    return state === "Game state unavailable" || ((state === "Pregame" || state === "Scheduled" && date === today) &&
      (!game.startTimeUTC || !isValid(parseISO(game.startTimeUTC))));
  });
  const gameIds = remaining.map(({ game }) => game.id);
  const fallback = summarizeTeamForecasts({ teamId, gameIds, asOf });
  const headingId = `game-grid-team-heading-${teamId}`;

  return (
    <section className={styles.details} aria-labelledby={headingId}>
      <h3 id={headingId}>{team?.name ?? `Team ${teamId}`} game previews</h3>
      <p className={styles.horizon}>
        Remaining calendar week: {startDate} through {weekEnd} (Sunday), Eastern time.
        {historical && " Historical selection — no live remaining forecasts."}
      </p>
      <p className={styles.metadata}>
        {checkValid ? `Forecast check: ${new Intl.DateTimeFormat("en-US", {
          timeZone: "America/New_York", month: "short", day: "numeric", year: "numeric",
          hour: "numeric", minute: "2-digit", timeZoneName: "short",
        }).format(checkedAt)}. ` : "Forecast check time unavailable. "}
        {scheduleCoverage ? `Schedule coverage: ${scheduleCoverage.known} of ${scheduleCoverage.expected} calendar dates. ` : "Schedule coverage unavailable. "}
        {sourceDate && isValid(sourceDate) ? `Schedule source observed: ${scheduleObservedAt}.` : "Schedule source freshness unavailable."}
      </p>
      <h4>Remaining-week category forecasts</h4>
      <p className={styles.metadata}>
        {gameIds.length} confirmed upcoming regular-season {gameIds.length === 1 ? "game" : "games"} in the included dates.
        {uncertainRemaining && " Remaining eligibility is unavailable for games without a current state or start time."}
        {!coverageComplete && " Incomplete schedule coverage may omit games."}
      </p>
      <dl className={styles.categories}>
        {TEAM_FORECAST_CATEGORIES.map((category) => {
          let summary = gameIds.length === 0 ? fallback[category] : summaries?.[category] ?? fallback[category];
          if (summary.expectedGames !== gameIds.length || (!coverageComplete || uncertainRemaining || !checkValid) && summary.status === "no_games") {
            summary = { status: "unavailable", mean: null, knownGames: 0, expectedGames: gameIds.length, limitations: ["The remaining schedule is not fully known."] };
          }
          const hasMean = (summary.status === "available" || summary.status === "partial") &&
            summary.mean !== null && Number.isFinite(summary.mean) && summary.mean >= 0;
          const knownSubtotal = hasMean && (summary.status === "partial" || !coverageComplete || uncertainRemaining);
          return (
            <div key={category} className={styles.category}>
              <dt><span>{category}</span><span className={styles.categoryName}>{CATEGORY_NAMES[category]}</span></dt>
              <dd>{hasMean ? summary.mean!.toFixed(1) : summary.status === "no_games" ? "No remaining games" : "Unavailable"}</dd>
              <dd className={styles.coverage}>
                {knownSubtotal ? "Known subtotal, " : "Coverage: "}
                {summary.knownGames} of {summary.expectedGames} games
              </dd>
              {summary.limitations.length > 0 && <dd className={styles.coverage}>{summary.limitations.join(" ")}</dd>}
            </div>
          );
        })}
      </dl>
      <h4>{extended ? "Selected 10-day game previews" : "Selected game previews"}</h4>
      {previews.length === 0 ? (
        <p>{coverageComplete ? "No upcoming games in this selection." : "Schedule unavailable for this selection. Retry the schedule read."}</p>
      ) : (
        <ol className={styles.previews}>
          {previews.map(({ game, date, inferred, day, index }) => {
            const home = game.homeTeam.id === teamId;
            const opponent = home ? game.awayTeam : game.homeTeam;
            const start = game.startTimeUTC ? parseISO(game.startTimeUTC) : null;
            const time = start && isValid(start) ? new Intl.DateTimeFormat("en-US", {
              timeZone: "America/New_York", hour: "numeric", minute: "2-digit", timeZoneName: "short",
            }).format(start) : "Start time unavailable";
            const slateCount = leagueSlateCounts[index];
            const covered = coveredDates ? coveredDates.includes(date) : coverageComplete && date <= weekEnd;
            const eligible = gameIds.includes(game.id);
            const venue = typeof game.venue === "string" ? game.venue : game.venue?.default;
            return (
              <li key={game.id} className={styles.preview}>
                <TeamGameHeading opponentId={opponent.id} home={home} />
                <p>{format(parseISO(date), "EEE, MMM d, yyyy")} · {time} · {gameStateLabel(game)}</p>
                <p className={styles.metadata}>
                  {home ? "Home" : "Away"}{venue ? ` · ${venue}` : " · Venue unavailable"} · Regular-season slate: {covered && typeof slateCount === "number" && Number.isFinite(slateCount) ? `${slateCount} games` : "unavailable"}.
                </p>
                <p className={styles.metadata}>
                  {date > weekEnd ? "Next calendar week — outside remaining-week totals. " : ""}
                  {excludedDays.includes(day) ? "Excluded date — outside remaining-week totals. " : ""}
                  {!eligible && date <= weekEnd && !excludedDays.includes(day) ? "Outside confirmed remaining predictions. " : ""}
                  {inferred ? "Date inferred from selected column. " : ""}
                  {!covered ? "Schedule coverage unavailable for this date. " : ""}
                  Category forecasts and forecast source freshness unavailable for this game.
                </p>
              </li>
            );
          })}
        </ol>
      )}
      <p className={styles.limitations}>
        Category means require an admitted team forecast source. Schedule games and BPA scores are not category projections.
        Started, completed, postponed, cancelled and excluded games do not count as remaining predictions.
      </p>
    </section>
  );
}

function TeamGameHeading({ opponentId, home }: { opponentId: number; home: boolean }) {
  const opponent = useTeam(opponentId);
  return <h5>{home ? "vs" : "at"} {opponent?.name ?? `Team ${opponentId}`}</h5>;
}
