import { useEffect, useMemo, useState } from "react";

import supabase from "lib/supabase";
import type { Tables } from "lib/supabase/database-generated.types";
import { fetchAllSupabasePages } from "lib/supabase/pagination";

type ScheduleWgoTeamRow = Pick<
  Tables<"wgo_team_stats">,
  | "id"
  | "team_id"
  | "franchise_name"
  | "date"
  | "games_played"
  | "wins"
  | "losses"
  | "ot_losses"
  | "points"
  | "goals_for"
  | "goals_against"
  | "goals_for_per_game"
  | "goals_against_per_game"
  | "shots_for_per_game"
  | "shots_against_per_game"
  | "faceoff_win_pct"
  | "penalty_kill_pct"
  | "power_play_pct"
  | "hits"
  | "blocked_shots"
  | "takeaways"
  | "giveaways"
  | "penalty_minutes"
  | "pp_opportunities"
  | "game_id"
  | "opponent_id"
  | "sat_pct"
  | "shooting_pct_5v5"
  | "save_pct_5v5"
>;

export interface ScheduleWgoTeamStat {
  id: number;
  team_id: number;
  franchise_name: string;
  date: string;
  games_played: number;
  wins: number;
  losses: number;
  ot_losses: number;
  points: number;
  goals_for: number;
  goals_against: number;
  goals_for_per_game: number;
  goals_against_per_game: number;
  shots_for_per_game: number;
  shots_against_per_game: number;
  faceoff_win_pct: number;
  penalty_kill_pct: number;
  power_play_pct: number;
  hits: number;
  blocked_shots: number;
  takeaways: number;
  giveaways: number;
  penalty_minutes: number;
  pp_opportunities: number;
  game_id: number;
  opponent_id: number;
  sat_pct?: number;
  shooting_pct_5v5?: number;
  save_pct_5v5?: number;
  zone_start_pct_5v5?: number;
}

type WgoState = {
  identity: string | null;
  stats: ScheduleWgoTeamStat[];
  loading: boolean;
  error: string | null;
};

const WGO_SELECT =
  "id,team_id,franchise_name,date,games_played,wins,losses,ot_losses,points,goals_for,goals_against,goals_for_per_game,goals_against_per_game,shots_for_per_game,shots_against_per_game,faceoff_win_pct,penalty_kill_pct,power_play_pct,hits,blocked_shots,takeaways,giveaways,penalty_minutes,pp_opportunities,game_id,opponent_id,sat_pct,shooting_pct_5v5,save_pct_5v5";

function parseIdentity(teamId: number | string, seasonId: string) {
  const parsedTeamId = Number(teamId);
  const parsedSeasonId = Number(seasonId);
  const valid =
    Number.isSafeInteger(parsedTeamId) &&
    parsedTeamId > 0 &&
    /^\d{8}$/.test(seasonId) &&
    Number.isSafeInteger(parsedSeasonId);

  return {
    identity: JSON.stringify([String(teamId), seasonId]),
    parsedTeamId,
    parsedSeasonId,
    valid,
  };
}

function normalizeRow(row: ScheduleWgoTeamRow): ScheduleWgoTeamStat {
  const numberOrZero = (value: number | null) => value ?? 0;
  return {
    id: row.id,
    team_id: numberOrZero(row.team_id),
    franchise_name: row.franchise_name,
    date: row.date,
    games_played: numberOrZero(row.games_played),
    wins: numberOrZero(row.wins),
    losses: numberOrZero(row.losses),
    ot_losses: numberOrZero(row.ot_losses),
    points: numberOrZero(row.points),
    goals_for: numberOrZero(row.goals_for),
    goals_against: numberOrZero(row.goals_against),
    goals_for_per_game: numberOrZero(row.goals_for_per_game),
    goals_against_per_game: numberOrZero(row.goals_against_per_game),
    shots_for_per_game: numberOrZero(row.shots_for_per_game),
    shots_against_per_game: numberOrZero(row.shots_against_per_game),
    faceoff_win_pct: numberOrZero(row.faceoff_win_pct),
    penalty_kill_pct: numberOrZero(row.penalty_kill_pct),
    power_play_pct: numberOrZero(row.power_play_pct),
    hits: numberOrZero(row.hits),
    blocked_shots: numberOrZero(row.blocked_shots),
    takeaways: numberOrZero(row.takeaways),
    giveaways: numberOrZero(row.giveaways),
    penalty_minutes: numberOrZero(row.penalty_minutes),
    pp_opportunities: numberOrZero(row.pp_opportunities),
    game_id: numberOrZero(row.game_id),
    opponent_id: numberOrZero(row.opponent_id),
    sat_pct: row.sat_pct ?? undefined,
    shooting_pct_5v5: row.shooting_pct_5v5 ?? undefined,
    save_pct_5v5: row.save_pct_5v5 ?? undefined,
  };
}

export function useTeamScheduleWgoStats(
  teamId: number | string,
  seasonId: string,
) {
  const request = useMemo(
    () => parseIdentity(teamId, seasonId),
    [seasonId, teamId],
  );
  const [state, setState] = useState<WgoState>({
    identity: null,
    stats: [],
    loading: request.valid,
    error: null,
  });

  useEffect(() => {
    let ownsRequest = true;

    if (!request.valid) {
      setState({
        identity: request.identity,
        stats: [],
        loading: false,
        error: "WGO analytics unavailable.",
      });
      return () => {
        ownsRequest = false;
      };
    }

    setState({
      identity: request.identity,
      stats: [],
      loading: true,
      error: null,
    });

    const load = async () => {
      try {
        const data = await fetchAllSupabasePages<ScheduleWgoTeamRow>(
          ({ from, to }) =>
            supabase
              .from("wgo_team_stats")
              .select(WGO_SELECT)
              .eq("team_id", request.parsedTeamId)
              .eq("season_id", request.parsedSeasonId)
              .order("date", { ascending: true })
              .order("id", { ascending: true })
              .range(from, to),
        );

        if (!ownsRequest) return;
        setState({
          identity: request.identity,
          stats: data.map(normalizeRow),
          loading: false,
          error: null,
        });
      } catch {
        if (!ownsRequest) return;
        console.error("Unable to load schedule WGO analytics.");
        setState({
          identity: request.identity,
          stats: [],
          loading: false,
          error: "WGO analytics unavailable.",
        });
      }
    };

    void load();
    return () => {
      ownsRequest = false;
    };
  }, [request]);

  if (state.identity !== request.identity) {
    return {
      stats: [],
      loading: request.valid,
      error: request.valid ? null : "WGO analytics unavailable.",
    };
  }

  return { stats: state.stats, loading: state.loading, error: state.error };
}
