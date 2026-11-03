import { bounded } from "lib/socialShare/trendSources";
import { UNKNOWN_EVIDENCE, type SharePostContext, type SharePostLoadResult } from "./contract";
import { buildBshBoard, PERIOD_ROLLING, SKATER_PERIOD_CONTROL, skaterSeasonScope, trimLateNights, type BshBoardData, type BshBoardSettings, type SkaterPeriod, type SkaterSeason, type SlateScheduleRow } from "./bshBoard";
import { readCompletedTeamGames } from "./shared/goalieLedger.sources";
import { matchupCalendar, periodDates, resolvePeriodWindow, type PeriodWindowSettings } from "./shared/periodWindow";
import { readMatchupRows } from "./shared/periodWindow.sources";
import { readSkaterAppearances } from "./shared/skaterAppearances.sources";

/** Ceilings for a full regular season, failing closed above them: 2,624 team games × about 18 skaters, and 1,312 games. */
export const SKATER_SEASON_LIMITS = { appearances: 50000, teamGames: 2700, scheduledGames: 1400 };

/**
 * The dates a board's period covers, or why it has none. Recent games need no calendar, so that default reads nothing extra.
 * A week under way counts through the last completed games, and the label says so.
 */
export async function readSkaterPeriod({ client, generatedAt }: SharePostContext, settings: PeriodWindowSettings): Promise<{ period?: SkaterPeriod; reason?: undefined } | { period?: undefined; reason: string }> {
  if (settings.period === PERIOD_ROLLING) return {};
  const { season, through: cutoff } = skaterSeasonScope(generatedAt), calendar = matchupCalendar(await readMatchupRows(client, String(season).slice(0, 4)));
  const { window, reason } = resolvePeriodWindow(settings, calendar, { ...SKATER_PERIOD_CONTROL, cutoff });
  if (!window) return { reason: [reason, ...calendar.reasons].join(" ") };
  const through = window.through < cutoff ? window.through : cutoff;
  return { period: { from: window.from, through, label: through === window.through ? window.label : `Week ${window.week} · ${periodDates(window.from, through)} so far` } };
}
/** Builds from the season with its incomplete newest nights cut, and says so beside the card. */
export function lateFeedTrimmed<Data>(read: SkaterSeason, build: (season: SkaterSeason) => SharePostLoadResult<Data>): SharePostLoadResult<Data> {
  const { season, pageNotes } = trimLateNights(read);
  return { ...build(season), pageNotes };
}
/** A period with no dates is a reason on the card, not a read. */
export const periodMissing = (reason: string) => ({ state: "missing" as const, reasons: [reason], evidence: UNKNOWN_EVIDENCE, data: null });

/** The one read behind this lane's posts: a season of appearances, or a period's, plus the games that prove the feed is complete. */
export async function readSkaterSeason({ client, generatedAt }: SharePostContext, period?: SkaterPeriod): Promise<SkaterSeason> {
  const scope = skaterSeasonScope(generatedAt), { season } = scope, from = period?.from ?? scope.from, through = period?.through ?? scope.through;
  const [appearances, teamGames, scheduled] = await Promise.all([
    readSkaterAppearances(client, { season, from, through, limit: SKATER_SEASON_LIMITS.appearances }),
    readCompletedTeamGames(client, { season, from, through, limit: SKATER_SEASON_LIMITS.teamGames }),
    bounded<SlateScheduleRow>("Schedule", SKATER_SEASON_LIMITS.scheduledGames, (start, end) => client.from("games").select("id,date,homeTeamId,awayTeamId", { count: "exact" }).eq("seasonId", season).eq("type", 2).gte("date", from).lte("date", through).order("id").range(start, end)),
  ]);
  return { appearances, teamGames, scheduledGames: scheduled.length, through, period, schedule: scheduled };
}

export async function loadBshBoard(context: SharePostContext, settings: BshBoardSettings): Promise<SharePostLoadResult<BshBoardData>> {
  const { period, reason } = await readSkaterPeriod(context, settings);
  return reason ? periodMissing(reason) : lateFeedTrimmed(await readSkaterSeason(context, period), season => buildBshBoard(season, settings));
}
