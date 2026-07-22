declare module "lib/supabase/Upserts/nhlRawGamecenter.mjs" {
  type Database = import("lib/supabase/database-generated.types").Database;
  type Json = import("lib/supabase/database-generated.types").Json;
  type TablesInsert<Name extends keyof Database["public"]["Tables"]> =
    import("lib/supabase/database-generated.types").TablesInsert<Name>;
  type SupabaseClient =
    import("@supabase/supabase-js").SupabaseClient<Database>;

  export const PARSER_VERSION: 1;
  export const STRENGTH_VERSION: 1;
  export const NORMALIZATION_MATERIALIZER_VERSION: "nhl-gamecenter-normalizer-v1";
  export const NORMALIZATION_PARSER_FINGERPRINT: string;
  export const DEFAULT_FETCH_RETRIES: 3;
  export const DEFAULT_FETCH_TIMEOUT_MS: 20000;
  export const DEFAULT_RETRY_DELAY_MS: 500;
  export const DEFAULT_GAME_INGEST_RETRIES: 2;

  export interface FetchRetryOptions {
    retries?: number;
    timeoutMs?: number;
    retryDelayMs?: number;
  }

  export interface GameIngestRetryOptions {
    retries?: number;
    retryDelayMs?: number;
  }

  export interface LocalizedText {
    default?: string | null;
  }

  export interface GamecenterTeam {
    id: number;
    abbrev?: string | null;
  }

  export interface GamecenterRosterSpot {
    teamId: number;
    playerId: number;
    firstName?: LocalizedText | null;
    lastName?: LocalizedText | null;
    sweaterNumber?: number | null;
    positionCode?: string | null;
    headshot?: string | null;
  }

  export interface GamecenterPlayDetails {
    eventOwnerTeamId?: number | null;
    losingPlayerId?: number | null;
    winningPlayerId?: number | null;
    shootingPlayerId?: number | null;
    scoringPlayerId?: number | null;
    goalieInNetId?: number | null;
    blockingPlayerId?: number | null;
    hittingPlayerId?: number | null;
    hitteePlayerId?: number | null;
    committedByPlayerId?: number | null;
    drawnByPlayerId?: number | null;
    servedByPlayerId?: number | null;
    playerId?: number | null;
    assist1PlayerId?: number | null;
    assist2PlayerId?: number | null;
    shotType?: string | null;
    typeCode?: string | null;
    descKey?: string | null;
    duration?: number | string | null;
    reason?: string | null;
    secondaryReason?: string | null;
    xCoord?: number | null;
    yCoord?: number | null;
    zoneCode?: string | null;
    homeScore?: number | null;
    awayScore?: number | null;
    homeSOG?: number | null;
    awaySOG?: number | null;
  }

  export interface GamecenterPlay {
    eventId: number;
    sortOrder?: number | null;
    periodDescriptor?: {
      number?: number | null;
      periodType?: string | null;
    } | null;
    timeInPeriod?: string | null;
    timeRemaining?: string | null;
    situationCode?: string | null;
    homeTeamDefendingSide?: string | null;
    typeCode?: number | string | null;
    typeDescKey?: string | null;
    details?: GamecenterPlayDetails | null;
  }

  export interface PlayByPlayPayload {
    id: number;
    season: number | string;
    gameDate: string;
    homeTeam: GamecenterTeam;
    awayTeam: GamecenterTeam;
    rosterSpots: GamecenterRosterSpot[];
    plays: GamecenterPlay[];
  }

  export interface ShiftChartRow {
    id: number;
    playerId: number;
    teamId: number;
    teamAbbrev?: string | null;
    teamName?: string | null;
    firstName?: string | null;
    lastName?: string | null;
    period?: number | null;
    shiftNumber?: number | null;
    startTime?: string | null;
    endTime?: string | null;
    duration?: string | null;
    typeCode?: number | null;
    detailCode?: number | null;
    eventNumber?: number | null;
    eventDescription?: string | null;
    eventDetails?: string | null;
    hexValue?: string | null;
  }

  export interface ShiftChartsJson {
    total: number;
    data: ShiftChartRow[];
  }

  export type ShiftChartsPayload =
    | (ShiftChartsJson & { source: "json-api" })
    | (ShiftChartsJson & {
        source: "htmlreports";
        upstream: { json: ShiftChartsJson };
        htmlReports: { visitorUrl: string; homeUrl: string };
      })
    | (ShiftChartsJson & {
        source: "json-api-empty";
        htmlReports: {
          visitorUrl: string;
          homeUrl: string;
          visitorError: string | null;
          homeError: string | null;
        };
      });

  export interface RawGamePayloads {
    gameId: number;
    seasonId: number;
    gameDate: string;
    fetchedAt: string;
    urls: {
      playByPlay: string;
      boxscore: string;
      landing: string;
      shiftcharts: string;
    };
    payloads: {
      playByPlay: PlayByPlayPayload;
      boxscore: Json;
      landing: Json;
      shiftcharts: ShiftChartsPayload;
    };
    hashes: {
      playByPlay: string;
      boxscore: string;
      landing: string;
      shiftcharts: string;
    };
  }

  export type RawPayloadInsert = TablesInsert<"nhl_api_game_payloads_raw">;
  export type NormalizedRosterInput = Omit<
    TablesInsert<"nhl_api_game_roster_spots">,
    | "game_id"
    | "season_id"
    | "game_date"
    | "source_play_by_play_hash"
    | "parser_version"
  > & {
    game_id: number;
    season_id: number;
    game_date: string;
    source_play_by_play_hash: string;
    parser_version: 1;
  };
  export type NormalizedEventInput = Omit<
    TablesInsert<"nhl_api_pbp_events">,
    | "game_id"
    | "season_id"
    | "game_date"
    | "source_play_by_play_hash"
    | "parser_version"
    | "strength_version"
  > & {
    game_id: number;
    season_id: number;
    game_date: string;
    source_play_by_play_hash: string;
    parser_version: 1;
    strength_version: 1;
  };
  export type NormalizedShiftInput = Omit<
    TablesInsert<"nhl_api_shift_rows">,
    | "game_id"
    | "season_id"
    | "game_date"
    | "source_shiftcharts_hash"
    | "parser_version"
  > & {
    game_id: number;
    season_id: number;
    game_date: string;
    source_shiftcharts_hash: string;
    parser_version: 1;
  };
  export type NormalizedRosterRow = Omit<
    NormalizedRosterInput,
    "created_at" | "updated_at"
  >;
  export type NormalizedEventRow = Omit<
    NormalizedEventInput,
    "created_at" | "updated_at"
  >;
  export type NormalizedShiftRow = Omit<
    NormalizedShiftInput,
    "created_at" | "updated_at"
  >;

  export interface NormalizedGameScope {
    gameId: number;
    seasonId: number;
    gameDate: string;
    pbpPayloadHash: string;
    shiftPayloadHash: string;
    parserFingerprint: string;
    parserVersion: 1;
    strengthVersion: 1;
    materializerVersion: "nhl-gamecenter-normalizer-v1";
    rosterRows: NormalizedRosterRow[];
    eventRows: NormalizedEventRow[];
    shiftRows: NormalizedShiftRow[];
  }

  export interface NormalizationManifestIdentity {
    normalizationFingerprint: string;
    normalizationVersion: number;
  }

  export interface NormalizationReceipt {
    gameId: number;
    normalizationStatus: "complete";
    normalizationVersion: number;
    normalizationFingerprint: string;
    sourceFingerprint: string;
    parserFingerprint: string;
    pbpRawPayloadId: number;
    pbpRawSnapshotVersion: number;
    shiftRawPayloadId: number;
    shiftRawSnapshotVersion: number;
    rosterCount: number;
    eventCount: number;
    shiftCount: number;
    prunedRosterRows: number;
    prunedEventRows: number;
    prunedShiftRows: number;
    idempotent: boolean;
    completedAt: string;
  }

  export interface RawGameIngestResult {
    gameId: number;
    rosterCount: number;
    eventCount: number;
    shiftCount: number;
    rawEndpointsStored: 4;
    normalizationVersion: number;
    normalizationFingerprint: string;
    sourceFingerprint: string;
    prunedRosterRows: number;
    prunedEventRows: number;
    prunedShiftRows: number;
    idempotent: boolean;
  }

  export interface RawGameIngestFailure {
    gameId: number;
    message: string;
  }

  export function fetchJsonWithRetry<T = Json>(
    url: string,
    options?: FetchRetryOptions,
  ): Promise<T>;
  export function fetchTextWithRetry(
    url: string,
    options?: FetchRetryOptions,
  ): Promise<string>;
  export function fetchShiftCharts(
    gameId: number,
    fetchOptions?: FetchRetryOptions,
  ): Promise<ShiftChartsJson>;
  export function fetchNhlApiRawGamePayloads(
    gameId: number,
    fetchOptions?: FetchRetryOptions,
  ): Promise<RawGamePayloads>;
  export function upsertInBatches<TRow extends Record<string, unknown>>(
    supabase: SupabaseClient,
    table: string,
    rows: readonly TRow[],
    onConflict?: string,
    batchSize?: number,
  ): Promise<number>;
  export function insertPayloadSnapshot(
    supabase: SupabaseClient,
    row: RawPayloadInsert,
  ): Promise<void>;
  export function normalizeRosterSpots(
    game: PlayByPlayPayload,
    pbpHash: string,
  ): NormalizedRosterRow[];
  export function normalizePbpEvents(
    game: PlayByPlayPayload,
    pbpHash: string,
  ): NormalizedEventRow[];
  export function normalizeShiftRows(
    game: PlayByPlayPayload,
    shiftPayload: ShiftChartsPayload,
    shiftHash: string,
  ): NormalizedShiftRow[];
  export function buildNormalizedGameScope(args: {
    gameId: number;
    seasonId: number;
    gameDate: string;
    pbpPayloadHash: string;
    shiftPayloadHash: string;
    rosterRows: NormalizedRosterInput[];
    eventRows: NormalizedEventInput[];
    shiftRows: NormalizedShiftInput[];
  }): NormalizedGameScope;
  export function readNormalizedGameManifest(
    supabase: SupabaseClient,
    gameId: number,
  ): Promise<NormalizationManifestIdentity | null>;
  export function persistNormalizedGameScope(
    supabase: SupabaseClient,
    scope: NormalizedGameScope,
    expectedCurrentManifest: NormalizationManifestIdentity | null,
  ): Promise<NormalizationReceipt>;
  export function ingestNhlApiRawGame(
    supabase: SupabaseClient,
    gameId: number,
  ): Promise<RawGameIngestResult>;
  export function ingestNhlApiRawGames(
    supabase: SupabaseClient,
    gameIds: readonly number[],
  ): Promise<RawGameIngestResult[]>;
  export function ingestNhlApiRawGamesBestEffort(
    supabase: SupabaseClient,
    gameIds: readonly number[],
    options?: GameIngestRetryOptions,
  ): Promise<{
    results: RawGameIngestResult[];
    failures: RawGameIngestFailure[];
  }>;
}
