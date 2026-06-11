declare module "lib/supabase/Upserts/nhlRawGamecenter.mjs" {
  export const PARSER_VERSION: number;
  export const STRENGTH_VERSION: number;
  export const DEFAULT_FETCH_RETRIES: number;
  export const DEFAULT_FETCH_TIMEOUT_MS: number;
  export const DEFAULT_RETRY_DELAY_MS: number;
  export const DEFAULT_GAME_INGEST_RETRIES: number;

  export function fetchJsonWithRetry(
    url: string,
    options?: Record<string, unknown>
  ): Promise<any>;
  export function fetchTextWithRetry(
    url: string,
    options?: Record<string, unknown>
  ): Promise<string>;
  export function fetchShiftCharts(
    gameId: number,
    fetchOptions?: Record<string, unknown>
  ): Promise<{ total: number; data: unknown[]; source?: string }>;
  export function fetchNhlApiRawGamePayloads(
    gameId: number,
    fetchOptions?: Record<string, unknown>
  ): Promise<{
    payloads?: {
      shiftcharts?: {
        data?: unknown[];
        source?: string;
      };
    };
  }>;
  export function upsertInBatches(
    supabase: any,
    table: string,
    rows: unknown[],
    onConflict?: string
  ): Promise<number>;
  export function insertPayloadSnapshot(
    supabase: any,
    row: Record<string, unknown>
  ): Promise<void>;
  export function normalizeRosterSpots(game: any, pbpHash: string): any[];
  export function normalizePbpEvents(game: any, pbpHash: string): any[];
  export function normalizeShiftRows(
    game: any,
    shiftPayload: any,
    shiftHash: string
  ): any[];
  export function ingestNhlApiRawGame(
    supabase: any,
    gameId: number
  ): Promise<any>;
  export function ingestNhlApiRawGames(
    supabase: any,
    gameIds: number[]
  ): Promise<any[]>;
  export function ingestNhlApiRawGamesBestEffort(
    supabase: any,
    gameIds: number[],
    options?: Record<string, unknown>
  ): Promise<{ results: any[]; failures: any[] }>;
}
