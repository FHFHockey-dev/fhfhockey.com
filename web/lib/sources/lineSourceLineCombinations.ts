import { fetchAllSupabasePages } from "lib/supabase/pagination";
import {
  selectFirstArrivalBuckets,
  type FirstArrivalCandidate,
} from "lib/sources/lineSourceFirstArrival";

export type LineCombinationSourceRow = {
  capture_key: string;
  source_key?: string | null;
  source_account?: string | null;
  source_url: string | null;
  tweet_id: string | null;
  snapshot_date: string;
  observed_at: string | null;
  tweet_posted_at: string | null;
  game_id: number | null;
  team_id: number | null;
  team_abbreviation: string | null;
  classification: string | null;
  status: string;
  nhl_filter_status: string;
  line_1_player_ids: Array<number | null> | null;
  line_2_player_ids: Array<number | null> | null;
  line_3_player_ids: Array<number | null> | null;
  line_4_player_ids: Array<number | null> | null;
  pair_1_player_ids: Array<number | null> | null;
  pair_2_player_ids: Array<number | null> | null;
  pair_3_player_ids: Array<number | null> | null;
  goalie_1_player_id: number | null;
  goalie_2_player_id: number | null;
};

export type LineCombinationSourceMutation = {
  gameId: number;
  teamId: number;
  forwards: number[] | null;
  defensemen: number[] | null;
  goalies: number[] | null;
  sourceKind: "tweet";
  sourceKey: string;
  sourceUrl: string | null;
  sourceCaptureKey: string;
  observedAt: string | null;
};

const SOURCE_SELECT =
  "capture_key, source_url, tweet_id, snapshot_date, observed_at, tweet_posted_at, game_id, team_id, team_abbreviation, classification, status, nhl_filter_status, line_1_player_ids, line_2_player_ids, line_3_player_ids, line_4_player_ids, pair_1_player_ids, pair_2_player_ids, pair_3_player_ids, goalie_1_player_id, goalie_2_player_id";

function validIds(groups: Array<Array<number | null> | null>): number[] | null {
  const provided = groups.filter((group): group is Array<number | null> =>
    Array.isArray(group),
  );
  if (
    provided.length !== groups.length ||
    provided.some((group) => group.some((id) => !Number.isFinite(id)))
  ) {
    return null;
  }
  const ids = provided.flat().map(Number);
  return new Set(ids).size === ids.length ? ids : null;
}

export function buildLineCombinationSourceMutation(
  row: LineCombinationSourceRow,
): LineCombinationSourceMutation | null {
  if (
    row.status !== "observed" ||
    row.nhl_filter_status !== "accepted" ||
    row.game_id == null ||
    row.team_id == null
  ) {
    return null;
  }

  const sourceKey = row.source_key ?? "ccc";
  const base = {
    gameId: row.game_id,
    teamId: row.team_id,
    sourceKind: "tweet" as const,
    sourceKey,
    sourceUrl: row.source_url,
    sourceCaptureKey: row.capture_key,
    observedAt: row.tweet_posted_at ?? row.observed_at,
  };

  if (row.classification === "goalie_start") {
    const goalies = [row.goalie_1_player_id, row.goalie_2_player_id].filter(
      (id): id is number => Number.isFinite(id),
    );
    if (goalies.length === 0) return null;
    return { ...base, forwards: null, defensemen: null, goalies };
  }

  if (
    row.classification !== "lineup" &&
    row.classification !== "practice_lines"
  ) {
    return null;
  }

  const forwards = validIds([
    row.line_1_player_ids,
    row.line_2_player_ids,
    row.line_3_player_ids,
    row.line_4_player_ids,
  ]);
  const defensemen = validIds([
    row.pair_1_player_ids,
    row.pair_2_player_ids,
    row.pair_3_player_ids,
  ]);
  if (forwards?.length !== 12 || defensemen?.length !== 6) return null;

  const goalies = [row.goalie_1_player_id, row.goalie_2_player_id].filter(
    (id): id is number => Number.isFinite(id),
  );
  return {
    ...base,
    forwards,
    defensemen,
    goalies: goalies.length > 0 ? goalies : null,
  };
}

function toCandidate(
  row: LineCombinationSourceRow,
): FirstArrivalCandidate<LineCombinationSourceRow> {
  return {
    value: row,
    captureKey: row.capture_key,
    sourceKey: row.source_key ?? "ccc",
    tweetId: row.tweet_id,
    snapshotDate: row.snapshot_date,
    teamId: row.team_id,
    teamAbbreviation: row.team_abbreviation,
    gameId: row.game_id,
    signalType: row.classification,
    tweetPostedAt: row.tweet_posted_at,
    observedAt: row.observed_at,
    status: row.status,
    nhlFilterStatus: row.nhl_filter_status,
  };
}

export function selectLineCombinationSourceMutations(
  rows: LineCombinationSourceRow[],
): LineCombinationSourceMutation[] {
  return selectFirstArrivalBuckets(rows.map(toCandidate))
    .map(({ winner }) => buildLineCombinationSourceMutation(winner.value))
    .filter(
      (mutation): mutation is LineCombinationSourceMutation => mutation != null,
    );
}

export async function fetchLineCombinationSourceRowsForDate(args: {
  supabase: any;
  date: string;
}): Promise<LineCombinationSourceRow[]> {
  const [cccRows, genericRows] = await Promise.all([
    fetchAllSupabasePages<LineCombinationSourceRow>(({ from, to }) =>
      args.supabase
        .from("lines_ccc" as any)
        .select(SOURCE_SELECT)
        .eq("snapshot_date", args.date)
        .eq("status", "observed")
        .eq("nhl_filter_status", "accepted")
        .order("capture_key", { ascending: true })
        .range(from, to),
    ),
    fetchAllSupabasePages<LineCombinationSourceRow>(({ from, to }) =>
      args.supabase
        .from("line_source_snapshots" as any)
        .select(`source_key, source_account, ${SOURCE_SELECT}`)
        .eq("source_group", "gdl_suite")
        .eq("snapshot_date", args.date)
        .eq("status", "observed")
        .eq("nhl_filter_status", "accepted")
        .order("capture_key", { ascending: true })
        .range(from, to),
    ),
  ]);

  return [...cccRows, ...genericRows];
}

export async function syncLineCombinationSourceWinners(args: {
  supabase: any;
  date: string;
}) {
  const rows = await fetchLineCombinationSourceRowsForDate(args);
  const mutations = selectLineCombinationSourceMutations(rows);
  const results = await Promise.allSettled(
    mutations.map((mutation) =>
      args.supabase
        .rpc("upsert_line_combinations_from_source", {
          p_game_id: mutation.gameId,
          p_team_id: mutation.teamId,
          p_source_kind: mutation.sourceKind,
          p_source_key: mutation.sourceKey,
          p_source_url: mutation.sourceUrl,
          p_source_capture_key: mutation.sourceCaptureKey,
          p_observed_at: mutation.observedAt,
          p_forwards: mutation.forwards,
          p_defensemen: mutation.defensemen,
          p_goalies: mutation.goalies,
        })
        .throwOnError(),
    ),
  );
  const failures = results.flatMap((result, index) =>
    result.status === "rejected"
      ? [
          {
            mutation: mutations[index],
            reason: result.reason?.message ?? String(result.reason),
          },
        ]
      : [],
  );

  return {
    sourceRows: rows.length,
    eligibleWinners: mutations.length,
    written: mutations.length - failures.length,
    failures: failures.slice(0, 10),
  };
}
