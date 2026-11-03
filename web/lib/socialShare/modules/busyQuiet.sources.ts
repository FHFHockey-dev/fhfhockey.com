import { bounded } from "lib/socialShare/trendSources";
import { buildBusyQuiet, cutLateNights, GOALIE_PERIOD_ROLLING, goalieLedgerScope, goalieMinStarts, goalieRangeMissing, goalieWindows, NST_GOALIE_COLUMNS, NST_TEAM_COLUMNS, rangeLedger, resolveGoalieRange, type BusyQuietData, type BusyQuietSettings, type GoalieDateRange, type NstGoalieRow, type NstTeamRow } from "./busyQuiet";
import type { SharePostContext, SharePostLoadResult, SharePostReadClient } from "./contract";
import { readCompletedTeamGames, readGoalieAppearances } from "./shared/goalieLedger.sources";
import { matchupCalendar, type PeriodWindowSettings } from "./shared/periodWindow";
import { readMatchupRows } from "./shared/periodWindow.sources";

/** Ceilings for a full 1,312-game season: above them a read fails closed. */
export const LEDGER_LIMITS = { appearances: 3200, teamGames: 2700, schedule: 1400, nstGoalie: 3200, nstTeam: 2700 } as const;

/** The season's ledger, shared with Goalie Category Rescue. Failing any part fails the post: these are its proof of completeness. */
export async function readGoalieLedger(client: SharePostReadClient, scope: { season: number; from: string; through: string }) {
  const [appearances, teamGames, scheduled] = await Promise.all([
    readGoalieAppearances(client, { ...scope, limit: LEDGER_LIMITS.appearances }),
    readCompletedTeamGames(client, { ...scope, limit: LEDGER_LIMITS.teamGames }),
    bounded<{ id: number; date: string }>("Schedule", LEDGER_LIMITS.schedule, (start, end) => client.from("games").select("id,date", { count: "exact" }).eq("seasonId", scope.season).eq("type", 2).gte("date", scope.from).lte("date", scope.through).order("date").order("id").range(start, end)),
  ]);
  return { appearances, teamGames, scheduledDates: scheduled.map(game => game.date) };
}
/** A rolling window needs no calendar, so it reads none. Chosen dates are refused here, before the ledger is read. */
export async function readGoalieRange(client: SharePostReadClient, settings: PeriodWindowSettings, scope: { season: number; through: string }): Promise<{ range: GoalieDateRange | null; reason?: undefined } | { range?: undefined; reason: string }> {
  if (settings.period === GOALIE_PERIOD_ROLLING) return { range: null };
  return resolveGoalieRange(settings, matchupCalendar(await readMatchupRows(client, String(scope.season).slice(0, 4))), scope.through);
}
const orNull = <T>(read: Promise<T[]>) => read.catch(() => null);

export async function loadBusyQuiet({ client, generatedAt }: SharePostContext, settings: BusyQuietSettings): Promise<SharePostLoadResult<BusyQuietData>> {
  const scope = goalieLedgerScope(generatedAt), { range, reason } = await readGoalieRange(client, settings, scope);
  if (reason !== undefined) return goalieRangeMissing(reason);
  // The NST reads follow the window the builder will draw, late nights cut, so its oldest game has its danger-zone row too.
  const ledger = await readGoalieLedger(client, scope), cut = cutLateNights(rangeLedger(ledger, range), range, scope.through), lastDate = cut.ledger ? cut.through : scope.through;
  const eligible = cut.ledger ? goalieWindows(cut.ledger.appearances, range ? "std" : settings.window).filter(window => window.starts >= goalieMinStarts(settings)) : [];
  const since = eligible.reduce<string | null>((oldest, window) => !oldest || window.firstDate < oldest ? window.firstDate : oldest, null);
  // Danger-zone and team-chance columns are extra context: their failure leaves shots standing and says so on the card.
  const [nstGoalie, nstTeam] = since === null ? [[], []] : await Promise.all([
    orNull(bounded<NstGoalieRow>("NST goalie shots", LEDGER_LIMITS.nstGoalie, (start, end) => client.from("nst_gamelog_goalie_all_counts").select(NST_GOALIE_COLUMNS, { count: "exact" }).eq("season", scope.season).in("player_id", eligible.map(window => window.goalieId)).gte("date_scraped", since).lte("date_scraped", lastDate).order("date_scraped").order("player_id").range(start, end))),
    orNull(bounded<NstTeamRow>("NST team chances", LEDGER_LIMITS.nstTeam, (start, end) => client.from("nst_team_gamelogs_as_counts").select(NST_TEAM_COLUMNS, { count: "exact" }).eq("season_id", scope.season).eq("situation", "all").gte("date", since).lte("date", lastDate).order("date").order("team_abbreviation").range(start, end))),
  ]);
  return buildBusyQuiet({ settings, ...ledger, nstGoalie, nstTeam, through: scope.through, range });
}
