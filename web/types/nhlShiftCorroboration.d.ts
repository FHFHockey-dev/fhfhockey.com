declare module "lib/supabase/Upserts/nhlShiftCorroboration.mjs" {
  export const SHIFT_CORROBORATION_RULE: "shift-clock-mismatch-covered-and-officially-corroborated/v1";
  export const SHIFT_CORROBORATION_EXCLUSION_REASON: "CLOCK_DURATION_MISMATCH_COVERED_UNDER_EVERY_READING_AND_ABSENT_FROM_OFFICIAL_RECORD";
  export const SHIFT_CORROBORATION_ZERO_TOI_EXCLUSION_REASON: "CLOCK_DURATION_MISMATCH_FOR_PLAYER_WITH_ZERO_BOXSCORE_TOI_AND_NO_OFFICIAL_SHIFTS";
  export const SHIFT_CORROBORATION_DUPLICATE_REASON: "EXACT_INTERVAL_DUPLICATE_OF_A_ROW_THE_OFFICIAL_REPORT_LISTS";

  export type ShiftCorroborationFailure =
    | "DISABLED"
    | "PBP_NOT_FINAL"
    | "SOURCES_UNAVAILABLE"
    | "INVALID_EVIDENCE"
    | "TOO_MANY_CLOCK_MISMATCHES"
    | "MISMATCH_NOT_COVERED_UNDER_EVERY_READING"
    | "HTML_ROW_INCONSISTENT"
    | "BOXSCORE_PLAYER_MISSING"
    | "BOXSCORE_TOI_DISAGREES_WITH_HTML"
    | "HTML_ROWS_DISAGREE_WITH_JSON"
    | "BOXSCORE_TOI_DISAGREES_WITH_JSON";

  export type ShiftCorroborationExclusion = {
    id: number;
    playerId: number;
    teamId: number;
    period: number;
    shiftNumber: number;
    startTime: string;
    endTime: string;
    duration: string;
    reason:
      | typeof SHIFT_CORROBORATION_EXCLUSION_REASON
      | typeof SHIFT_CORROBORATION_ZERO_TOI_EXCLUSION_REASON;
    coveredByIds: number[];
  };

  export type ShiftCorroborationDuplicate = {
    id: number;
    playerId: number;
    teamId: number;
    period: number;
    shiftNumber: number;
    startTime: string;
    endTime: string;
    duration: string;
    reason: typeof SHIFT_CORROBORATION_DUPLICATE_REASON;
    duplicateOfId: number;
  };

  export type ShiftCorroboration = {
    rule: typeof SHIFT_CORROBORATION_RULE;
    excluded: ShiftCorroborationExclusion[];
    duplicates: ShiftCorroborationDuplicate[];
    boxscore: {
      url: string;
      players: Array<{ playerId: number; teamId: number; toi: string }>;
    };
  };

  export class ShiftCorroborationError extends Error {
    readonly code: "SHIFT_CORROBORATION_REJECTED";
    readonly reason: ShiftCorroborationFailure;
    constructor(reason: ShiftCorroborationFailure, gameId: number);
  }

  export function isShiftCorroborationEnabled(env?: Record<string, string | undefined>): boolean;
  export function buildBoxscoreUrl(gameId: number): string;
  export function findShiftClockMismatchRows<T>(rows: readonly T[] | null | undefined): T[];
  export function verifyShiftCorroboration<T>(gameId: number, payload: T): T;
  export function buildCorroboratedShiftPayload<T extends { source: string }>(args: {
    gameId: number;
    htmlPayload: T;
    boxscore: unknown;
  }): T & { corroboration: ShiftCorroboration };
}
