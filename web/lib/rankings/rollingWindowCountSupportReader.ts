import type { RollingWindowCountSupport } from "lib/rollingPlayerWindowCountSupport";

import type { RollingPlayerGameMetricRow } from "./skaterWindowAggregation";

/**
 * Joins L6's explicit window counts (`rolling-player-window-counts-v1`, W2-P0-11)
 * onto rolling ranking rows. The wide `<metric>_total_lastN` columns of per-60
 * metrics hold rates, so last-N counts and window membership come only from
 * `rolling_player_metric_support_payloads.support_payload.windowCountSupport`.
 * A row without support keeps `windowCountSupport: null` (unknown, never zero).
 */
export const WINDOW_COUNT_SUPPORT_TABLE = "rolling_player_metric_support_payloads";

export const WINDOW_COUNT_SUPPORT_SELECT =
  "player_id,game_date,game_id,windowCountSupport:support_payload->windowCountSupport";

const SUPPORT_PAGE_SIZE = 1000;

export type WindowCountSupportRow = {
  player_id: number | null;
  game_date: string | null;
  game_id: number | null;
  windowCountSupport: RollingWindowCountSupport | null;
};

function supportKey(playerId: unknown, gameDate: unknown) {
  return `${String(playerId)}:${String(gameDate)}`;
}

export function attachWindowCountSupport(
  rows: RollingPlayerGameMetricRow[],
  supportRows: readonly WindowCountSupportRow[],
): RollingPlayerGameMetricRow[] {
  const byKey = new Map<string, WindowCountSupportRow[]>();
  for (const support of supportRows) {
    const key = supportKey(support.player_id, support.game_date);
    byKey.set(key, [...(byKey.get(key) ?? []), support]);
  }
  return rows.map((row) => {
    const candidates = byKey.get(supportKey(row.player_id, row.game_date)) ?? [];
    // One support row per (player, date, strength); match the game id when
    // both carry one so a doubleheader-style duplicate never crosses games.
    const match =
      candidates.length === 1
        ? candidates[0]
        : candidates.find((candidate) => candidate.game_id === row.game_id);
    const support =
      match &&
      (match.game_id == null || row.game_id == null || match.game_id === row.game_id)
        ? match.windowCountSupport ?? null
        : null;
    return { ...row, windowCountSupport: support };
  });
}

type SupportQuery = {
  eq(column: string, value: unknown): SupportQuery;
  order(column: string, options: { ascending: boolean }): SupportQuery;
  range(
    from: number,
    to: number,
  ): PromiseLike<{ data: unknown[] | null; error: unknown }>;
};

type SupportClient = {
  from(table: string): { select(fields: string): SupportQuery };
};

/** All support rows for one season, strength and game date, paged by player. */
export async function fetchWindowCountSupportForDate(
  client: SupportClient,
  args: { season: number; strength: string; gameDate: string; teamId?: number | null },
): Promise<WindowCountSupportRow[]> {
  const rows: WindowCountSupportRow[] = [];
  for (let from = 0; ; from += SUPPORT_PAGE_SIZE) {
    let query = client
      .from(WINDOW_COUNT_SUPPORT_TABLE)
      .select(WINDOW_COUNT_SUPPORT_SELECT)
      .eq("season", args.season)
      .eq("strength_state", args.strength)
      .eq("game_date", args.gameDate);
    if (args.teamId != null) query = query.eq("team_id", args.teamId);
    const { data, error } = await query
      .order("player_id", { ascending: true })
      .range(from, from + SUPPORT_PAGE_SIZE - 1);
    if (error) throw error;
    const page = (data ?? []) as WindowCountSupportRow[];
    rows.push(...page);
    if (page.length < SUPPORT_PAGE_SIZE) break;
  }
  return rows;
}
