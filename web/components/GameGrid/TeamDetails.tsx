import { addDays, endOfWeek, format, isValid, parseISO } from "date-fns";
import { DAYS, EXTENDED_DAYS, EXTENDED_DAY_ABBREVIATION, GameData, WeekData } from "lib/NHL/types";
import { useTeam } from "./contexts/GameGridContext";
import { isRegularScheduleGame } from "./utils/helper";
import { CategorySummary, TEAM_FORECAST_CATEGORIES, TeamForecastCategory, TeamForecastContext, TeamForecastRecord, summarizeTeamForecasts } from "./utils/teamForecasts";
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
  scheduleRetrievedAtByDate?: Readonly<Record<string, string>>;
  forecastReadStatus?: string;
  forecastReadPending?: boolean;
  onRetryForecasts?: () => void;
  /** The forecast eligibility check time, never a source freshness timestamp. */
  asOf?: string;
  /** Reader records still require admission checks; opening a preview never fetches or generates forecasts. */
  forecastRecords?: readonly TeamForecastRecord[];
  forecastContext?: TeamForecastContext;
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
  scheduleRetrievedAtByDate, forecastReadStatus, forecastReadPending = false, onRetryForecasts,
  asOf = new Date().toISOString(), forecastRecords, forecastContext,
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
  const selectedEnd = isValid(selectedStart) ? format(addDays(selectedStart, days.length - 1), "yyyy-MM-dd") : startDate;
  const remaining = previews.filter(({ game, date, day, inferred }) => {
    const state = gameStateLabel(game);
    if (inferred || !today || date < startDate || date > weekEnd || date < today || excludedDays.includes(day) ||
        !isRegularScheduleGame(game) || !["Scheduled", "Pregame"].includes(state)) return false;
    const start = game.startTimeUTC ? parseISO(game.startTimeUTC) : null;
    return start && isValid(start) ? start.getTime() > checkedAt.getTime() : state === "Scheduled" && date > today;
  });
  const uncertainRemaining = previews.some(({ game, date, day, inferred, index }) => {
    const state = gameStateLabel(game);
    if (inferred) return !historical && index < 7 && !excludedDays.includes(day) && isRegularScheduleGame(game) &&
      ["Scheduled", "Pregame", "Game state unavailable"].includes(state);
    if (!today || date < startDate || date > weekEnd || date < today || excludedDays.includes(day) ||
        !isRegularScheduleGame(game)) return false;
    return state === "Game state unavailable" || ((state === "Pregame" || state === "Scheduled" && date === today) &&
      (!game.startTimeUTC || !isValid(parseISO(game.startTimeUTC))));
  });
  const gameIds = remaining.map(({ game }) => game.id);
  const forecastsByGame = new Map(previews.map(({ game, date, inferred }) => {
    const start = Date.parse(game.startTimeUTC ?? "");
    const covered = coveredDates ? coveredDates.includes(date) : coverageComplete;
    const contextMatches = forecastContext?.seasonId === game.season &&
      forecastContext.games.filter((item) => item.gameId === game.id).length === 1 &&
      Date.parse(forecastContext.games.find((item) => item.gameId === game.id)?.startsAt ?? "") === start;
    const canUse = !inferred && covered && contextMatches && checkValid && date >= startDate && date <= selectedEnd &&
      Number.isFinite(start) && start > checkedAt.getTime() && calendarDate(new Date(start)) === date && isRegularScheduleGame(game) &&
      ["Scheduled", "Pregame"].includes(gameStateLabel(game)) &&
      (game.homeTeam.id === teamId || game.awayTeam.id === teamId);
    const records = canUse ? forecastRecords : undefined;
    const categories = summarizeTeamForecasts({ teamId, gameIds: [game.id], asOf,
      records, context: forecastContext });
    // Only records admitted by the same per-game check may be used as source metadata.
    const sources = Object.fromEntries(TEAM_FORECAST_CATEGORIES.map((category) => [category,
      categories[category].status === "available"
        ? records?.find((record) => record.teamId === teamId && record.gameId === game.id && record.category === category)
        : undefined,
    ])) as Partial<Record<TeamForecastCategory, TeamForecastRecord>>;
    return [game.id, { categories, sources }] as const;
  }));
  const remainingSummaries = Object.fromEntries(TEAM_FORECAST_CATEGORIES.map((category) => {
    const known = gameIds.map((id) => {
      const forecast = forecastsByGame.get(id)!;
      return { summary: forecast.categories[category], source: forecast.sources[category] };
    }).filter(({ summary }) => summary.status === "available");
    const basis = known[0]?.source;
    // One aggregate requires a shared decision vintage, model/run and immutable input
    // snapshot. Per-game output revisions and emission times may legitimately differ.
    const sharedBasis = known.every(({ source }) => source && basis &&
      Date.parse(source.cutoffAt) === Date.parse(basis.cutoffAt) &&
      source.modelVersion === basis.modelVersion && source.comparisonLineageId === basis.comparisonLineageId &&
      source.sourceWatermark === basis.sourceWatermark && source.scope === basis.scope &&
      source.conditioning === basis.conditioning && source.unit === basis.unit && source.creditDefinition === basis.creditDefinition);
    // Sum the values shown in the game cards so rounded rows and totals reconcile.
    const mean = sharedBasis && known.length
      ? known.reduce((total, { summary }) => total + Number(summary.mean!.toFixed(1)), 0) : null;
    const scheduleKnown = coverageComplete && !uncertainRemaining && checkValid;
    const status: CategorySummary["status"] = !gameIds.length && scheduleKnown ? "no_games"
      : !sharedBasis || !known.length || !Number.isFinite(mean) ? "unavailable"
      : known.length === gameIds.length && scheduleKnown ? "available" : "partial";
    return [category, { status, mean, knownGames: known.length, expectedGames: gameIds.length,
      limitations: !sharedBasis
        ? ["Mixed forecast vintages — weekly total unavailable. Game forecasts must share a cutoff, model, run and source snapshot; per-game values remain visible."]
        : status === "unavailable" ? ["Qualified team category forecast unavailable."] : [],
    }];
  })) as Record<TeamForecastCategory, CategorySummary>;
  const headingId = `game-grid-team-heading-${teamId}`;

  return (
    <section className={styles.details} aria-labelledby={headingId}>
      <h2 id={headingId}>{team?.name ?? `Team ${teamId}`} game previews</h2>
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
      {forecastReadStatus && <p className={styles.metadata} role="status">{forecastReadStatus}</p>}
      {onRetryForecasts && <button type="button" className={styles.closeButton}
        aria-disabled={forecastReadPending || undefined} aria-busy={forecastReadPending || undefined}
        onClick={() => { if (!forecastReadPending) onRetryForecasts(); }}>Refresh team forecasts</button>}
      <h3>Remaining-week category forecasts</h3>
      <p className={styles.metadata}>
        {gameIds.length} confirmed upcoming regular-season {gameIds.length === 1 ? "game" : "games"} in the included dates.
        {uncertainRemaining && " Remaining eligibility is unavailable for games without a current state, actual date or start time."}
        {!coverageComplete && " Incomplete schedule coverage may omit games."}
      </p>
      <p className={styles.metadata}>
        Totals sum the displayed full-game pregame means, rounded to one decimal. These are not live remaining-game forecasts.
      </p>
      <dl className={styles.categories} aria-label="Remaining-week category forecasts">
        {TEAM_FORECAST_CATEGORIES.map((category) => {
          const summary = remainingSummaries[category];
          const hasMean = (summary.status === "available" || summary.status === "partial") &&
            summary.mean !== null && Number.isFinite(summary.mean) && summary.mean >= 0;
          const knownSubtotal = hasMean && (summary.status === "partial" || !coverageComplete || uncertainRemaining);
          return (
            <div key={category} className={styles.category}>
              <dt><span>{category}</span><span className={styles.categoryName}>{CATEGORY_NAMES[category]}</span></dt>
              <dd>{hasMean ? summary.mean!.toFixed(1) : summary.status === "no_games" ? "No remaining games" : "Unavailable"}</dd>
              <dd className={styles.coverage}>
                {knownSubtotal ? "Known subtotal, " : summary.status === "unavailable" && summary.knownGames > 0 ? "Per-game coverage: " : "Coverage: "}
                {summary.knownGames} of {summary.expectedGames} games
              </dd>
              {summary.limitations.length > 0 && <dd className={styles.coverage}>{summary.limitations.join(" ")}</dd>}
            </div>
          );
        })}
      </dl>
      <h3>{extended ? "Selected 10-day game previews" : "Selected game previews"}</h3>
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
                </p>
                <p className={styles.metadata}>Full-game pregame category means (regulation and overtime).</p>
                {scheduleRetrievedAtByDate?.[date] && <p className={styles.metadata}>
                  Schedule retrieved: {scheduleRetrievedAtByDate[date]}. Provider source freshness unavailable.
                </p>}
                <dl className={styles.gameCategories} aria-label={`Game ${game.id} category forecasts`}>
                  {TEAM_FORECAST_CATEGORIES.map((category) => {
                    const summary = forecastsByGame.get(game.id)!.categories[category];
                    const source = forecastsByGame.get(game.id)!.sources[category];
                    return (
                      <div key={category} className={styles.category}>
                        <dt><span>{category}</span><span className={styles.categoryName}>{CATEGORY_NAMES[category]}</span></dt>
                        <dd>{summary.status === "available" ? summary.mean!.toFixed(1) : "Unavailable"}</dd>
                        <dd className={styles.coverage}>Coverage: {summary.knownGames} of 1 game</dd>
                        {summary.limitations.length > 0 && <dd className={styles.coverage}>{summary.limitations.join(" ")}</dd>}
                        {source && <dd className={styles.coverage}>
                          Model: {source.modelVersion}. Cutoff: {source.cutoffAt}. Issued: {source.issuedAt}.
                          {" "}Source: {source.sourceWatermark}. Source available: {source.sourceAvailableAt}.
                        </dd>}
                      </div>
                    );
                  })}
                </dl>
                {!Object.keys(forecastsByGame.get(game.id)!.sources).some((category) =>
                  forecastsByGame.get(game.id)!.sources[category as TeamForecastCategory]) && (
                  <p className={styles.metadata}>Category forecasts and forecast source freshness unavailable for this game.</p>
                )}
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
  return <h4>{home ? "vs" : "at"} {opponent?.name ?? `Team ${opponentId}`}</h4>;
}
