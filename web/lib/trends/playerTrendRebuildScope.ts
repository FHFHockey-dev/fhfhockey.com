export const PLAYER_TREND_REPAIR_WINDOW_DAYS = 7;

export function resolvePlayerTrendWriteFromDate(today: string): string {
  const date = new Date(`${today}T00:00:00.000Z`);
  date.setUTCDate(date.getUTCDate() - PLAYER_TREND_REPAIR_WINDOW_DAYS);
  return date.toISOString().slice(0, 10);
}
