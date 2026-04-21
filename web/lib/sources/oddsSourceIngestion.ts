import type { Team } from "lib/NHL/types";
import { teamsInfo } from "lib/teamsInfo";

const MINUTES_TO_MS = 60 * 1000;
const ODDS_PROVIDER_SPORT_KEY = "icehockey_nhl";
const ODDS_PROVIDER_REGIONS = "us";
const ODDS_PROVIDER_ODDS_FORMAT = "american";
const ODDS_PROVIDER_FEATURED_TTL_MINUTES = 15;
const ODDS_PROVIDER_PROPS_TTL_MINUTES = 10;
const NHL_SCHEDULE_ODDS_TTL_MINUTES = 180;

export const LAUNCH_GAME_MARKETS = ["h2h", "spreads", "totals"] as const;
export const LAUNCH_PROP_MARKETS = [
  "player_points",
  "player_power_play_points",
  "player_assists",
  "player_blocked_shots",
  "player_shots_on_goal",
  "player_goals",
  "player_total_saves",
  "player_goal_scorer_anytime"
] as const;

export type LaunchGameMarket = (typeof LAUNCH_GAME_MARKETS)[number];
export type LaunchPropMarket = (typeof LAUNCH_PROP_MARKETS)[number];
export type ExternalOddsProviderName = "parlayapi" | "theoddsapi";
export type OddsProviderName = ExternalOddsProviderName | "nhl-schedule";

export type OddsTeamDirectoryEntry = Team & {
  shortName: string | null;
  location: string | null;
};

export type ScheduledGameRow = {
  id: number;
  date: string;
  homeTeamId: number;
  awayTeamId: number;
};

export type PlayerDirectoryEntry = {
  playerId: number;
  fullName: string;
  lastName: string;
  teamId: number | null;
};

export type MarketPriceRow = {
  snapshot_date: string;
  game_id: number;
  market_type: string;
  sportsbook_key: string;
  outcome_key: string;
  line_value: number | null;
  price_american: number | null;
  implied_probability: number | null;
  source_payload: Record<string, unknown>;
  source_rank: number;
  is_official: boolean;
  source_observed_at: string;
  freshness_expires_at: string | null;
  provenance: Record<string, unknown>;
  metadata: Record<string, unknown>;
  computed_at: string;
  updated_at: string;
};

export type PropMarketPriceRow = {
  snapshot_date: string;
  game_id: number | null;
  player_id: number;
  market_type: string;
  sportsbook_key: string;
  outcome_key: string;
  line_value: number | null;
  price_american: number | null;
  implied_probability: number | null;
  source_payload: Record<string, unknown>;
  source_rank: number;
  is_official: boolean;
  source_observed_at: string;
  freshness_expires_at: string | null;
  provenance: Record<string, unknown>;
  metadata: Record<string, unknown>;
  computed_at: string;
  updated_at: string;
};

export type SourceProvenanceSnapshotRow = {
  snapshot_date: string;
  source_type: string;
  entity_type: string;
  entity_id: number;
  game_id: number;
  source_name: string;
  source_url: string | null;
  source_rank: number;
  is_official: boolean;
  status: string;
  observed_at: string;
  freshness_expires_at: string | null;
  payload: Record<string, unknown>;
  metadata: Record<string, unknown>;
  updated_at: string;
};

export type TheOddsApiOutcome = {
  name?: string;
  description?: string;
  price?: number;
  point?: number;
};

export type TheOddsApiMarket = {
  key?: string;
  last_update?: string;
  outcomes?: TheOddsApiOutcome[];
};

export type TheOddsApiBookmaker = {
  key?: string;
  title?: string;
  last_update?: string;
  markets?: TheOddsApiMarket[];
};

export type TheOddsApiFeaturedGame = {
  id?: string;
  canonical_event_id?: string;
  sport_key?: string;
  sport_title?: string;
  commence_time?: string;
  home_team?: string;
  away_team?: string;
  bookmakers?: TheOddsApiBookmaker[];
};

export type TheOddsApiEventOddsGame = TheOddsApiFeaturedGame;

export type ScheduleDailyOdds = {
  providerId: number;
  value: string;
};

export type ScheduleDailyGame = {
  id: number;
  awayTeam: {
    id: number;
    abbrev: string;
    odds?: ScheduleDailyOdds[];
  };
  homeTeam: {
    id: number;
    abbrev: string;
    odds?: ScheduleDailyOdds[];
  };
};

export type ScheduleDailyData = {
  gameWeek: Array<{
    date: string;
    games: ScheduleDailyGame[];
  }>;
  oddsPartners: Array<{
    partnerId: number;
    name: string;
  }>;
};

type ExternalOddsProviderConfig = {
  providerName: ExternalOddsProviderName;
  baseUrl: string;
};

const EXTERNAL_ODDS_PROVIDER_CONFIG: Record<
  ExternalOddsProviderName,
  ExternalOddsProviderConfig
> = {
  parlayapi: {
    providerName: "parlayapi",
    baseUrl: "https://parlay-api.com/v1"
  },
  theoddsapi: {
    providerName: "theoddsapi",
    baseUrl: "https://api.the-odds-api.com/v4"
  }
};

type NormalizeFeaturedOddsArgs = {
  snapshotDate: string;
  featuredGames: TheOddsApiFeaturedGame[];
  scheduledGames: ScheduledGameRow[];
  teams: OddsTeamDirectoryEntry[];
};

type NormalizePropOddsArgs = {
  snapshotDate: string;
  localGame: ScheduledGameRow;
  eventOdds: TheOddsApiEventOddsGame;
  teams: OddsTeamDirectoryEntry[];
  rosterByTeam: Map<number, PlayerDirectoryEntry[]>;
};

function normalizeKey(value: string): string {
  return value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/\u00a0/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function addMinutesIso(value: string, minutes: number): string {
  return new Date(Date.parse(value) + minutes * MINUTES_TO_MS).toISOString();
}

function toSportsbookKey(value: string | null | undefined): string {
  return normalizeKey(value ?? "")
    .replace(/[^a-z0-9]+/g, "_")
    .replace(/^_+|_+$/g, "") || "unknown";
}

function resolveTeamEntry(
  value: string | null | undefined,
  teams: OddsTeamDirectoryEntry[]
): OddsTeamDirectoryEntry | null {
  const normalized = normalizeKey(value ?? "");
  if (!normalized) return null;

  return (
    teams.find((team) => {
      const candidates = [
        team.abbreviation,
        team.name,
        team.shortName,
        team.location,
        `${team.location ?? ""} ${team.shortName ?? ""}`.trim()
      ]
        .filter((item): item is string => Boolean(item))
        .map((item) => normalizeKey(item));

      return candidates.includes(normalized);
    }) ?? null
  );
}

function resolvePlayerEntry(
  playerName: string,
  rosterEntries: PlayerDirectoryEntry[]
): PlayerDirectoryEntry | null {
  const normalizedName = normalizeKey(playerName);
  const fullNameMatch =
    rosterEntries.find((entry) => normalizeKey(entry.fullName) === normalizedName) ?? null;
  if (fullNameMatch) return fullNameMatch;

  const lastName = normalizedName.split(" ").pop() ?? normalizedName;
  const lastNameMatches = rosterEntries.filter(
    (entry) => normalizeKey(entry.lastName) === lastName
  );
  return lastNameMatches.length === 1 ? lastNameMatches[0] : null;
}

function toPriceAmerican(value: unknown): number | null {
  if (typeof value !== "number" || !Number.isFinite(value)) return null;
  if (!Number.isInteger(value)) return null;
  return value;
}

export function americanPriceToImpliedProbability(price: number | null): number | null {
  if (price == null || !Number.isFinite(price) || price === 0) return null;
  if (price > 0) {
    return 100 / (price + 100);
  }
  return -price / (-price + 100);
}

export function buildOddsTeamDirectory(teams: Team[]): OddsTeamDirectoryEntry[] {
  return teams.map((team) => {
    const catalogEntry =
      teamsInfo[team.abbreviation as keyof typeof teamsInfo] ??
      Object.values(teamsInfo).find((entry) => entry.id === team.id) ??
      null;
    return {
      ...team,
      shortName: catalogEntry?.shortName ?? null,
      location: catalogEntry?.location ?? null
    };
  });
}

export function buildExternalOddsFeaturedUrl(args: {
  provider: ExternalOddsProviderName;
  apiKey: string;
}): string {
  const config = EXTERNAL_ODDS_PROVIDER_CONFIG[args.provider];
  return `${config.baseUrl}/sports/${ODDS_PROVIDER_SPORT_KEY}/odds?regions=${ODDS_PROVIDER_REGIONS}&markets=${LAUNCH_GAME_MARKETS.join(",")}&oddsFormat=${ODDS_PROVIDER_ODDS_FORMAT}&apiKey=${args.apiKey}`;
}

export function buildExternalOddsEventOddsUrl(args: {
  provider: ExternalOddsProviderName;
  apiKey: string;
  eventId: string;
}): string {
  const config = EXTERNAL_ODDS_PROVIDER_CONFIG[args.provider];
  return `${config.baseUrl}/sports/${ODDS_PROVIDER_SPORT_KEY}/events/${args.eventId}/odds?regions=${ODDS_PROVIDER_REGIONS}&markets=${LAUNCH_PROP_MARKETS.join(",")}&oddsFormat=${ODDS_PROVIDER_ODDS_FORMAT}&apiKey=${args.apiKey}`;
}

export function getOddsSourceContract() {
  return {
    primaryProvider: "parlayapi" as const,
    fallbackProvider: "nhl-schedule" as const,
    fallbackExternalProvider: "theoddsapi" as const,
    sportKey: ODDS_PROVIDER_SPORT_KEY,
    featuredMarkets: [...LAUNCH_GAME_MARKETS],
    propMarkets: [...LAUNCH_PROP_MARKETS],
    featuredRegions: ODDS_PROVIDER_REGIONS,
    oddsFormat: ODDS_PROVIDER_ODDS_FORMAT,
    providerRanks: {
      parlayapi: 1,
      theoddsapi: 1,
      "nhl-schedule": 2
    }
  };
}

function findLocalGameByTeams(args: {
  homeTeamId: number;
  awayTeamId: number;
  scheduledGames: ScheduledGameRow[];
}): ScheduledGameRow | null {
  return (
    args.scheduledGames.find(
      (game) => game.homeTeamId === args.homeTeamId && game.awayTeamId === args.awayTeamId
    ) ?? null
  );
}

function buildMarketPriceRow(args: {
  snapshotDate: string;
  localGame: ScheduledGameRow;
  marketType: string;
  sportsbookKey: string;
  outcomeKey: string;
  lineValue: number | null;
  priceAmerican: number | null;
  sourcePayload: Record<string, unknown>;
  sourceRank: number;
  isOfficial: boolean;
  sourceObservedAt: string;
  freshnessExpiresAt: string | null;
  provenance: Record<string, unknown>;
  metadata?: Record<string, unknown>;
}): MarketPriceRow {
  const now = new Date().toISOString();
  return {
    snapshot_date: args.snapshotDate,
    game_id: args.localGame.id,
    market_type: args.marketType,
    sportsbook_key: args.sportsbookKey,
    outcome_key: args.outcomeKey,
    line_value: args.lineValue,
    price_american: args.priceAmerican,
    implied_probability: americanPriceToImpliedProbability(args.priceAmerican),
    source_payload: args.sourcePayload,
    source_rank: args.sourceRank,
    is_official: args.isOfficial,
    source_observed_at: args.sourceObservedAt,
    freshness_expires_at: args.freshnessExpiresAt,
    provenance: args.provenance,
    metadata: args.metadata ?? {},
    computed_at: now,
    updated_at: now
  };
}

function buildPropMarketPriceRow(args: {
  snapshotDate: string;
  localGame: ScheduledGameRow;
  playerId: number;
  marketType: string;
  sportsbookKey: string;
  outcomeKey: string;
  lineValue: number | null;
  priceAmerican: number | null;
  sourcePayload: Record<string, unknown>;
  sourceRank: number;
  isOfficial: boolean;
  sourceObservedAt: string;
  freshnessExpiresAt: string | null;
  provenance: Record<string, unknown>;
  metadata?: Record<string, unknown>;
}): PropMarketPriceRow {
  const now = new Date().toISOString();
  return {
    snapshot_date: args.snapshotDate,
    game_id: args.localGame.id,
    player_id: args.playerId,
    market_type: args.marketType,
    sportsbook_key: args.sportsbookKey,
    outcome_key: args.outcomeKey,
    line_value: args.lineValue,
    price_american: args.priceAmerican,
    implied_probability: americanPriceToImpliedProbability(args.priceAmerican),
    source_payload: args.sourcePayload,
    source_rank: args.sourceRank,
    is_official: args.isOfficial,
    source_observed_at: args.sourceObservedAt,
    freshness_expires_at: args.freshnessExpiresAt,
    provenance: args.provenance,
    metadata: args.metadata ?? {},
    computed_at: now,
    updated_at: now
  };
}

export function normalizeTheOddsApiFeaturedOdds(
  args: NormalizeFeaturedOddsArgs & {
    provider?: ExternalOddsProviderName;
  }
): {
  rows: MarketPriceRow[];
  matchedEvents: Map<number, string>;
  provenanceRows: SourceProvenanceSnapshotRow[];
} {
  const rows: MarketPriceRow[] = [];
  const matchedEvents = new Map<number, string>();
  const provenanceRows: SourceProvenanceSnapshotRow[] = [];
  const provider = args.provider ?? "parlayapi";

  for (const event of args.featuredGames) {
    const homeTeam = resolveTeamEntry(event.home_team, args.teams);
    const awayTeam = resolveTeamEntry(event.away_team, args.teams);
    if (!homeTeam || !awayTeam) continue;

    const localGame = findLocalGameByTeams({
      homeTeamId: homeTeam.id,
      awayTeamId: awayTeam.id,
      scheduledGames: args.scheduledGames
    });
    if (!localGame) continue;

    if (event.id) {
      matchedEvents.set(localGame.id, event.id);
    }

    const observedAt = event.bookmakers?.[0]?.last_update ?? event.commence_time ?? new Date().toISOString();
    for (const bookmaker of event.bookmakers ?? []) {
      const sportsbookKey = toSportsbookKey(bookmaker.key ?? bookmaker.title);
      const bookmakerObservedAt = bookmaker.last_update ?? observedAt;
      const freshnessExpiresAt = addMinutesIso(
        bookmakerObservedAt,
        ODDS_PROVIDER_FEATURED_TTL_MINUTES
      );

      for (const market of bookmaker.markets ?? []) {
        if (!LAUNCH_GAME_MARKETS.includes(market.key as LaunchGameMarket)) continue;

        for (const outcome of market.outcomes ?? []) {
          const priceAmerican = toPriceAmerican(outcome.price);
          const outcomeName = String(outcome.name ?? "").trim();
          const matchedOutcomeTeam = resolveTeamEntry(outcomeName, args.teams);
          const outcomeKey =
            market.key === "totals"
              ? normalizeKey(outcomeName)
              : matchedOutcomeTeam
                ? `team:${matchedOutcomeTeam.abbreviation}`
                : normalizeKey(outcomeName);

          rows.push(
            buildMarketPriceRow({
              snapshotDate: args.snapshotDate,
              localGame,
              marketType: market.key ?? "unknown",
              sportsbookKey,
              outcomeKey,
              lineValue:
                typeof outcome.point === "number" && Number.isFinite(outcome.point)
                  ? outcome.point
                  : null,
              priceAmerican,
              sourcePayload: {
                bookmaker,
                market,
                outcome
              },
              sourceRank: 1,
              isOfficial: false,
              sourceObservedAt: market.last_update ?? bookmakerObservedAt,
              freshnessExpiresAt,
              provenance: {
                provider,
                eventId: event.id ?? null,
                canonicalEventId: event.canonical_event_id ?? null
              },
              metadata: {
                homeTeamId: localGame.homeTeamId,
                awayTeamId: localGame.awayTeamId
              }
            })
          );
        }
      }

      provenanceRows.push({
        snapshot_date: args.snapshotDate,
        source_type: "odds",
        entity_type: "game",
        entity_id: localGame.id,
        game_id: localGame.id,
        source_name: provider,
        source_url: event.id
          ? buildExternalOddsEventOddsUrl({
              provider,
              apiKey: "redacted",
              eventId: event.id
            })
          : null,
        source_rank: 1,
        is_official: false,
        status: "observed",
        observed_at: bookmakerObservedAt,
        freshness_expires_at: freshnessExpiresAt,
        payload: {
          eventId: event.id ?? null,
          canonicalEventId: event.canonical_event_id ?? null,
          sportsbookKey,
          markets: (bookmaker.markets ?? []).map((market) => market.key ?? "unknown")
        },
        metadata: {
          sportKey: event.sport_key ?? ODDS_PROVIDER_SPORT_KEY,
          canonicalEventId: event.canonical_event_id ?? null
        },
        updated_at: new Date().toISOString()
      });
    }
  }

  return {
    rows,
    matchedEvents,
    provenanceRows
  };
}

export function normalizeTheOddsApiPropOdds(
  args: NormalizePropOddsArgs & {
    provider?: ExternalOddsProviderName;
  }
): {
  rows: PropMarketPriceRow[];
  provenanceRows: SourceProvenanceSnapshotRow[];
} {
  const rows: PropMarketPriceRow[] = [];
  const provenanceRows: SourceProvenanceSnapshotRow[] = [];
  const rosterEntries = [
    ...(args.rosterByTeam.get(args.localGame.homeTeamId) ?? []),
    ...(args.rosterByTeam.get(args.localGame.awayTeamId) ?? [])
  ];
  const observedAt =
    args.eventOdds.bookmakers?.[0]?.last_update ??
    args.eventOdds.commence_time ??
    new Date().toISOString();
  const provider = args.provider ?? "parlayapi";

  for (const bookmaker of args.eventOdds.bookmakers ?? []) {
    const sportsbookKey = toSportsbookKey(bookmaker.key ?? bookmaker.title);
    const bookmakerObservedAt = bookmaker.last_update ?? observedAt;
    const freshnessExpiresAt = addMinutesIso(
      bookmakerObservedAt,
      ODDS_PROVIDER_PROPS_TTL_MINUTES
    );

    for (const market of bookmaker.markets ?? []) {
      if (!LAUNCH_PROP_MARKETS.includes(market.key as LaunchPropMarket)) continue;

      for (const outcome of market.outcomes ?? []) {
        const playerName =
          String(outcome.description ?? "").trim() || String(outcome.name ?? "").trim();
        const playerEntry = resolvePlayerEntry(playerName, rosterEntries);
        if (!playerEntry) continue;

        rows.push(
          buildPropMarketPriceRow({
            snapshotDate: args.snapshotDate,
            localGame: args.localGame,
            playerId: playerEntry.playerId,
            marketType: market.key ?? "unknown",
            sportsbookKey,
            outcomeKey: normalizeKey(String(outcome.name ?? "unknown")),
            lineValue:
              typeof outcome.point === "number" && Number.isFinite(outcome.point)
                ? outcome.point
                : null,
            priceAmerican: toPriceAmerican(outcome.price),
            sourcePayload: {
              bookmaker,
              market,
              outcome
            },
            sourceRank: 1,
            isOfficial: false,
            sourceObservedAt: market.last_update ?? bookmakerObservedAt,
            freshnessExpiresAt,
            provenance: {
              provider,
              eventId: args.eventOdds.id ?? null
            },
            metadata: {
              teamId: playerEntry.teamId
            }
          })
        );
      }
    }

    provenanceRows.push({
      snapshot_date: args.snapshotDate,
      source_type: "prop",
      entity_type: "game",
      entity_id: args.localGame.id,
      game_id: args.localGame.id,
      source_name: provider,
      source_url: args.eventOdds.id
        ? buildExternalOddsEventOddsUrl({
            provider,
            apiKey: "redacted",
            eventId: args.eventOdds.id
          })
        : null,
      source_rank: 1,
      is_official: false,
      status: "observed",
      observed_at: bookmakerObservedAt,
      freshness_expires_at: freshnessExpiresAt,
      payload: {
        eventId: args.eventOdds.id ?? null,
        sportsbookKey,
        markets: (bookmaker.markets ?? []).map((market) => market.key ?? "unknown")
      },
      metadata: {},
      updated_at: new Date().toISOString()
    });
  }

  return { rows, provenanceRows };
}

export function normalizeNhlScheduleOdds(args: {
  snapshotDate: string;
  scheduleDaily: ScheduleDailyData;
  scheduledGames: ScheduledGameRow[];
}): {
  rows: MarketPriceRow[];
  provenanceRows: SourceProvenanceSnapshotRow[];
} {
  const partnerNameById = new Map(
    (args.scheduleDaily.oddsPartners ?? []).map((partner) => [partner.partnerId, partner.name])
  );
  const rows: MarketPriceRow[] = [];
  const provenanceRows: SourceProvenanceSnapshotRow[] = [];

  for (const day of args.scheduleDaily.gameWeek ?? []) {
    for (const game of day.games ?? []) {
      const localGame =
        args.scheduledGames.find((row) => row.id === game.id) ??
        findLocalGameByTeams({
          homeTeamId: game.homeTeam.id,
          awayTeamId: game.awayTeam.id,
          scheduledGames: args.scheduledGames
        });
      if (!localGame) continue;

      const observedAt = new Date().toISOString();
      const freshnessExpiresAt = addMinutesIso(observedAt, NHL_SCHEDULE_ODDS_TTL_MINUTES);
      const awayOddsByProvider = new Map((game.awayTeam.odds ?? []).map((item) => [item.providerId, item.value]));

      for (const homeOdd of game.homeTeam.odds ?? []) {
        const awayValue = awayOddsByProvider.get(homeOdd.providerId);
        if (!awayValue) continue;
        const partnerName = partnerNameById.get(homeOdd.providerId) ?? `partner_${homeOdd.providerId}`;
        const sportsbookKey = toSportsbookKey(partnerName);
        const homePrice = Number.parseInt(String(homeOdd.value), 10);
        const awayPrice = Number.parseInt(String(awayValue), 10);

        rows.push(
          buildMarketPriceRow({
            snapshotDate: args.snapshotDate,
            localGame,
            marketType: "h2h",
            sportsbookKey,
            outcomeKey: `team:${game.homeTeam.abbrev}`,
            lineValue: null,
            priceAmerican: Number.isFinite(homePrice) ? homePrice : null,
            sourcePayload: {
              providerId: homeOdd.providerId,
              homeOdd,
              awayOdd: awayValue
            },
            sourceRank: 2,
            isOfficial: false,
            sourceObservedAt: observedAt,
            freshnessExpiresAt,
            provenance: {
              provider: "nhl-schedule"
            },
            metadata: {}
          })
        );
        rows.push(
          buildMarketPriceRow({
            snapshotDate: args.snapshotDate,
            localGame,
            marketType: "h2h",
            sportsbookKey,
            outcomeKey: `team:${game.awayTeam.abbrev}`,
            lineValue: null,
            priceAmerican: Number.isFinite(awayPrice) ? awayPrice : null,
            sourcePayload: {
              providerId: homeOdd.providerId,
              homeOdd: homeOdd.value,
              awayOdd: awayValue
            },
            sourceRank: 2,
            isOfficial: false,
            sourceObservedAt: observedAt,
            freshnessExpiresAt,
            provenance: {
              provider: "nhl-schedule"
            },
            metadata: {}
          })
        );

        provenanceRows.push({
          snapshot_date: args.snapshotDate,
          source_type: "odds",
          entity_type: "game",
          entity_id: localGame.id,
          game_id: localGame.id,
          source_name: "nhl-schedule",
          source_url: `https://api-web.nhle.com/v1/schedule/${args.snapshotDate}`,
          source_rank: 2,
          is_official: false,
          status: "observed",
          observed_at: observedAt,
          freshness_expires_at: freshnessExpiresAt,
          payload: {
            providerId: homeOdd.providerId,
            partnerName
          },
          metadata: {},
          updated_at: new Date().toISOString()
        });
      }
    }
  }

  return { rows, provenanceRows };
}
