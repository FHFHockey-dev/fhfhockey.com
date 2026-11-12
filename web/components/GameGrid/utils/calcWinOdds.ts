// components/GameGrid/utils/calcWinOdds.ts

import { DAYS, EXTENDED_DAY_ABBREVIATION, WeekData } from "lib/NHL/types";

/**
 * Game Grid win odds are withheld (owner decision 64, W1 P0 #14): the stored
 * `expected_goals` odds come from an unqualified model, and the placeholder
 * game model (decision 1) is not a substitute. They return only when a model
 * and its consumers qualify on genuinely pregame, held-out games.
 */
export const GAME_GRID_WIN_ODDS = {
  status: "unavailable",
  message: "Model odds unavailable",
  detail:
    "FHFH game odds are withheld while the model is developed and validated. Week Score uses schedule volume, off-nights and slate crowding only."
} as const;

/** Withheld: always null, whatever odds a stale row or payload carries. */
export function calculateBlendedWinOdds(
  _winOdds: number | null | undefined,
  _apiWinOdds: number | null | undefined
): number | null {
  return null;
}

export function formatWinOdds(winOdds: number): string {
  return (
    winOdds.toLocaleString(undefined, {
      minimumFractionDigits: 1,
      maximumFractionDigits: 1
    }) + "%"
  );
}

/**
 * The per-day win-odds list behind Week Score's matchup term. Withheld with the
 * odds (decision 64): every day is null, so the matchup term is 0 and the
 * back-to-back 0.75 cut no longer applies.
 * @returns A list of nulls, one per day.
 */
export function convertTeamRowToWinOddsList(
  _row: WeekData & { teamId: number; weekNumber: number },
  _excludedDays: readonly EXTENDED_DAY_ABBREVIATION[] = [],
  days: readonly EXTENDED_DAY_ABBREVIATION[] = DAYS
): (number | null)[] {
  return days.map(() => null);
}

/**
 * Test if the day is the 2nd day of a back-to-back.
 * @param winOddsList A list of WinOdds
 * @param day The index of the day
 * @returns true if the `day` is 2nd day of a back-to-back. Otherwise, false.
 */
export function isBackToBack(winOddsList: (number | null)[], day: number) {
  if (day <= 0) return false;
  const playedYesterday = winOddsList[day - 1] !== null;
  const playedToday = winOddsList[day] !== null;

  if (!playedToday) return false;
  if (playedYesterday && playedToday) return true;
  return false;
}
