import { getCurrentSeason, getTeams } from "lib/NHL/server";
import { getScheduleDaily } from "lib/NHL/server/scheduleDaily";
import { withCronJobAudit } from "lib/cron/withCronJobAudit";
import Fetch from "lib/cors-fetch";
import {
  buildExternalOddsEventOddsUrl,
  buildExternalOddsFeaturedUrl,
  buildOddsTeamDirectory,
  type ExternalOddsProviderName,
  normalizeNhlScheduleOdds,
  normalizeTheOddsApiFeaturedOdds,
  normalizeTheOddsApiPropOdds,
  type PlayerDirectoryEntry,
  type PropMarketPriceRow,
  type ScheduledGameRow,
  type SourceProvenanceSnapshotRow,
  type TheOddsApiEventOddsGame,
  type TheOddsApiFeaturedGame,
  type MarketPriceRow
} from "lib/sources/oddsSourceIngestion";
import adminOnly from "utils/adminOnlyMiddleware";

function parseRequestedDate(value: string | string[] | undefined): string {
  const rawValue = Array.isArray(value) ? value[0] : value;
  if (typeof rawValue === "string" && /^\d{4}-\d{2}-\d{2}$/.test(rawValue)) {
    return rawValue;
  }
  return new Date().toISOString().slice(0, 10);
}

function getConfiguredOddsProvider():
  | {
      provider: ExternalOddsProviderName;
      apiKey: string;
    }
  | null {
  const parlayApiKey =
    process.env.PARLAY_API_KEY ??
    process.env.PARLAYAPI_KEY ??
    process.env.PARLAYAPI_API_KEY ??
    null;
  if (parlayApiKey) {
    return {
      provider: "parlayapi",
      apiKey: parlayApiKey
    };
  }

  const theOddsApiKey =
    process.env.THE_ODDS_API_KEY ??
    process.env.ODDS_API_KEY ??
    process.env.THEODDS_API_KEY ??
    null;
  if (theOddsApiKey) {
    return {
      provider: "theoddsapi",
      apiKey: theOddsApiKey
    };
  }

  return null;
}

async function fetchJson<T>(url: string): Promise<T> {
  const response = await Fetch(url, {
    headers: {
      Accept: "application/json",
      "User-Agent": "fhfhockey/1.0 (+https://fhfhockey.com)"
    },
    cache: "no-store"
  });

  const payload = await response.json();
  if (!response.ok) {
    throw new Error(`Request failed (${response.status}) for ${url}`);
  }
  return payload as T;
}

async function fetchScheduledGamesForDate(args: {
  supabase: any;
  date: string;
}): Promise<ScheduledGameRow[]> {
  const { data, error } = await args.supabase
    .from("games")
    .select("id, date, homeTeamId, awayTeamId")
    .eq("date", args.date)
    .order("id", { ascending: true });

  if (error) throw error;
  return (data ?? []) as ScheduledGameRow[];
}

async function fetchRosterEntriesByTeam(args: {
  supabase: any;
  teamIds: number[];
}): Promise<Map<number, PlayerDirectoryEntry[]>> {
  const { data, error } = await args.supabase
    .from("players")
    .select("id, fullName, lastName, team_id")
    .in("team_id", args.teamIds);

  if (error) throw error;

  const result = new Map<number, PlayerDirectoryEntry[]>();
  for (const row of data ?? []) {
    const teamId = Number((row as any).team_id);
    if (!Number.isFinite(teamId)) continue;
    if (!result.has(teamId)) {
      result.set(teamId, []);
    }
    result.get(teamId)?.push({
      playerId: Number((row as any).id),
      fullName: String((row as any).fullName ?? ""),
      lastName: String((row as any).lastName ?? ""),
      teamId
    });
  }

  return result;
}

function dedupeMarketRows(rows: MarketPriceRow[]): MarketPriceRow[] {
  const map = new Map<string, MarketPriceRow>();
  for (const row of rows) {
    const key = [
      row.snapshot_date,
      row.game_id,
      row.market_type,
      row.sportsbook_key,
      row.outcome_key
    ].join(":");
    map.set(key, row);
  }
  return Array.from(map.values());
}

function dedupePropRows(rows: PropMarketPriceRow[]): PropMarketPriceRow[] {
  const map = new Map<string, PropMarketPriceRow>();
  for (const row of rows) {
    const key = [
      row.snapshot_date,
      row.game_id ?? "game-null",
      row.player_id,
      row.market_type,
      row.sportsbook_key,
      row.outcome_key
    ].join(":");
    map.set(key, row);
  }
  return Array.from(map.values());
}

function dedupeProvenanceRows(rows: SourceProvenanceSnapshotRow[]): SourceProvenanceSnapshotRow[] {
  const map = new Map<string, SourceProvenanceSnapshotRow>();
  for (const row of rows) {
    const key = [
      row.snapshot_date,
      row.source_type,
      row.entity_type,
      row.entity_id,
      row.source_name,
      row.game_id
    ].join(":");
    if (!map.has(key)) {
      map.set(key, row);
    }
  }
  return Array.from(map.values());
}

export default withCronJobAudit(
  adminOnly(async (req, res) => {
    try {
      const snapshotDate = parseRequestedDate(req.query.date);
      const scheduledGames = await fetchScheduledGamesForDate({
        supabase: req.supabase,
        date: snapshotDate
      });

      if (scheduledGames.length === 0) {
        return res.json({
          success: true,
          snapshotDate,
          marketRowsUpserted: 0,
          propRowsUpserted: 0,
          providers: {
            nhlSchedule: false,
            theOddsApi: false
          }
        });
      }

      const season = await getCurrentSeason();
      const teams = buildOddsTeamDirectory(await getTeams(season.seasonId));
      const teamIds = Array.from(
        new Set(
          scheduledGames.flatMap((game) => [game.homeTeamId, game.awayTeamId]).filter(Number.isFinite)
        )
      );
      const rosterByTeam = await fetchRosterEntriesByTeam({
        supabase: req.supabase,
        teamIds
      });

      let marketRows: MarketPriceRow[] = [];
      let propRows: PropMarketPriceRow[] = [];
      let provenanceRows: SourceProvenanceSnapshotRow[] = [];
      const warnings: string[] = [];

      const scheduleDaily = await getScheduleDaily(snapshotDate);
      const fallbackNormalized = normalizeNhlScheduleOdds({
        snapshotDate,
        scheduleDaily,
        scheduledGames
      });
      marketRows.push(...fallbackNormalized.rows);
      provenanceRows.push(...fallbackNormalized.provenanceRows);

      const configuredProvider = getConfiguredOddsProvider();
      if (configuredProvider) {
        try {
          const featuredGames = await fetchJson<TheOddsApiFeaturedGame[]>(
            buildExternalOddsFeaturedUrl({
              provider: configuredProvider.provider,
              apiKey: configuredProvider.apiKey
            })
          );
          const featuredNormalized = normalizeTheOddsApiFeaturedOdds({
            snapshotDate,
            featuredGames,
            scheduledGames,
            teams,
            provider: configuredProvider.provider
          });

          marketRows.push(...featuredNormalized.rows);
          provenanceRows.push(...featuredNormalized.provenanceRows);

          for (const [localGameId, eventId] of featuredNormalized.matchedEvents.entries()) {
            const localGame = scheduledGames.find((game) => game.id === localGameId);
            if (!localGame) continue;

            try {
              const eventOdds = await fetchJson<TheOddsApiEventOddsGame>(
                buildExternalOddsEventOddsUrl({
                  provider: configuredProvider.provider,
                  apiKey: configuredProvider.apiKey,
                  eventId
                })
              );
              const propNormalized = normalizeTheOddsApiPropOdds({
                snapshotDate,
                localGame,
                eventOdds,
                teams,
                rosterByTeam,
                provider: configuredProvider.provider
              });
              propRows.push(...propNormalized.rows);
              provenanceRows.push(...propNormalized.provenanceRows);
            } catch (error: any) {
              warnings.push(
                `${configuredProvider.provider} event odds failed for local game ${localGameId}: ${error?.message ?? "Unknown error"}`
              );
            }
          }
        } catch (error: any) {
          warnings.push(
            `${configuredProvider.provider} featured odds failed: ${error?.message ?? "Unknown error"}`
          );
        }
      } else {
        warnings.push(
          "No external odds API key is configured; set PARLAY_API_KEY or THE_ODDS_API_KEY to ingest live props."
        );
      }

      const dedupedMarketRows = dedupeMarketRows(marketRows);
      const dedupedPropRows = dedupePropRows(propRows);
      const dedupedProvenanceRows = dedupeProvenanceRows(provenanceRows);

      if (dedupedMarketRows.length > 0) {
        const { error } = await req.supabase
          .from("market_prices_daily" as any)
          .upsert(dedupedMarketRows as any, {
            onConflict: "snapshot_date,game_id,market_type,sportsbook_key,outcome_key"
          });
        if (error) throw error;
      }

      if (dedupedPropRows.length > 0) {
        const { error } = await req.supabase
          .from("prop_market_prices_daily" as any)
          .upsert(dedupedPropRows as any, {
            onConflict:
              "snapshot_date,player_id,market_type,sportsbook_key,outcome_key,game_id"
          });
        if (error) throw error;
      }

      if (dedupedProvenanceRows.length > 0) {
        const { error } = await req.supabase
          .from("source_provenance_snapshots" as any)
          .upsert(dedupedProvenanceRows as any, {
            onConflict:
              "snapshot_date,source_type,entity_type,entity_id,source_name,game_id"
          });
        if (error) throw error;
      }

      return res.json({
        success: true,
        snapshotDate,
        marketRowsUpserted: dedupedMarketRows.length,
        propRowsUpserted: dedupedPropRows.length,
        provenanceRowsUpserted: dedupedProvenanceRows.length,
        providers: {
          nhlSchedule: fallbackNormalized.rows.length > 0,
          externalProvider: configuredProvider?.provider ?? null
        },
        warnings
      });
    } catch (error: any) {
      console.error("update-market-prices error:", error);
      return res.status(500).json({
        success: false,
        error: error?.message ?? "Unknown error"
      });
    }
  }),
  {
    jobName: "/api/v1/db/update-market-prices"
  }
);
