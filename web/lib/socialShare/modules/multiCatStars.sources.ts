import { bounded } from "lib/socialShare/trendSources";
import { skaterSeasonScope } from "./bshBoard";
import { SKATER_SEASON_LIMITS } from "./bshBoard.sources";
import type { SharePostContext, SharePostLoadResult } from "./contract";
import { buildMultiCatStars, MULTI_CAT_CONTROL, MULTI_CAT_OWN, type MultiCatData, type MultiCatGame, type MultiCatSeason, type MultiCatSettings } from "./multiCatStars";
import { readCompletedTeamGames } from "./shared/goalieLedger.sources";
import { matchupCalendar, resolvePeriodWindow } from "./shared/periodWindow";
import { readMatchupRows } from "./shared/periodWindow.sources";
import { SKATER_APPEARANCE_COLUMNS, toSkaterAppearances, type SkaterAppearanceRow } from "./shared/skaterAppearances";

type MultiCatRow = SkaterAppearanceRow & { plus_minus: number | null };
const COLUMNS = [...SKATER_APPEARANCE_COLUMNS, "plus_minus"].join(",");

/** A SELECT over one season of wgo_skater_stats through `until`, plus the games that prove the feed is complete. Over a ceiling it fails closed. */
export async function readMultiCatSeason({ client, generatedAt }: SharePostContext, until?: string): Promise<MultiCatSeason> {
  const { season, from, through: cutoff } = skaterSeasonScope(generatedAt), through = until && until < cutoff ? until : cutoff;
  const [rows, teamGames, scheduled] = await Promise.all([
    bounded<MultiCatRow>("Skater appearances", SKATER_SEASON_LIMITS.appearances, (start, end) => client.from("wgo_skater_stats").select(COLUMNS, { count: "exact" }).eq("season_id", season).gte("date", from).lte("date", through).order("date", { ascending: true }).order("game_id", { ascending: true }).order("player_id", { ascending: true }).range(start, end)),
    readCompletedTeamGames(client, { season, from, through, limit: SKATER_SEASON_LIMITS.teamGames }),
    bounded<{ id: number }>("Schedule", SKATER_SEASON_LIMITS.scheduledGames, (start, end) => client.from("games").select("id", { count: "exact" }).eq("seasonId", season).eq("type", 2).gte("date", from).lte("date", through).order("id").range(start, end)),
  ]);
  const plusMinus = new Map(rows.map(row => [`${row.player_id}:${row.game_id}`, row.plus_minus]));
  const appearances: MultiCatGame[] = toSkaterAppearances(rows, { season, through }).map(row => ({ ...row, plusMinus: plusMinus.get(`${row.playerId}:${row.gameId}`) ?? null }));
  return { appearances, teamGames, scheduledGames: scheduled.length, through };
}

export async function loadMultiCatStars(context: SharePostContext, settings: MultiCatSettings): Promise<SharePostLoadResult<MultiCatData>> {
  const { season, through: cutoff } = skaterSeasonScope(context.generatedAt);
  const calendar = matchupCalendar(await readMatchupRows(context.client, String(season).slice(0, 4)));
  const { window, reason } = resolvePeriodWindow(settings, calendar, { ...MULTI_CAT_CONTROL, cutoff, own: MULTI_CAT_OWN });
  if (!window) return { state: "missing", reasons: [reason, ...calendar.reasons], data: null, evidence: { sources: [{ name: "Yahoo matchup weeks", tables: ["yahoo_matchup_weeks"], state: "ready", asOf: null, updatedAt: null }], sample: reason, strength: "All situations", cohort: "Not available", coverage: null } };
  return buildMultiCatStars(await readMultiCatSeason(context, window.through), settings, window);
}
