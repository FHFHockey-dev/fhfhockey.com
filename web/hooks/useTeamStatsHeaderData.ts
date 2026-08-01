import { useEffect, useMemo, useState } from "react";

import supabase from "lib/supabase";

export interface TeamStatsHeaderData {
  division_sequence: number | null;
  conference_sequence: number | null;
  league_sequence: number | null;
  points: number;
  wins: number;
  losses: number;
  ot_losses: number;
  streak_code: string;
  streak_count: number;
  l10_wins: number;
  l10_losses: number;
  l10_ot_losses: number;
  goal_for: number;
  goal_against: number;
  point_pctg: number;
  division_name: string;
  conference_name: string;
  games_played: number;
  regulation_wins: number;
}

type HeaderState = {
  identity: string | null;
  data: TeamStatsHeaderData | null;
  loading: boolean;
  error: string | null;
};

function parseRequest(
  teamId: number | undefined,
  teamAbbreviation: string,
  seasonId: number | undefined,
) {
  const seasonText = String(seasonId ?? "");
  const seasonStart = Number(seasonText.slice(0, 4));
  const seasonEnd = Number(seasonText.slice(4));
  const valid =
    Number.isSafeInteger(teamId) &&
    Number(teamId) > 0 &&
    /^[A-Z]{3}$/.test(teamAbbreviation) &&
    Number.isSafeInteger(seasonId) &&
    /^\d{8}$/.test(seasonText) &&
    seasonEnd === seasonStart + 1;
  return {
    identity: JSON.stringify([
      teamId ?? null,
      teamAbbreviation,
      seasonId ?? null,
    ]),
    valid,
  };
}

export function useTeamStatsHeaderData(
  teamId: number | undefined,
  teamAbbreviation: string,
  seasonId: number | undefined,
) {
  const request = useMemo(
    () => parseRequest(teamId, teamAbbreviation, seasonId),
    [seasonId, teamAbbreviation, teamId],
  );
  const [state, setState] = useState<HeaderState>({
    identity: null,
    data: null,
    loading: request.valid,
    error: null,
  });

  useEffect(() => {
    let ownsRequest = true;
    if (!request.valid || teamId === undefined || seasonId === undefined) {
      setState({
        identity: request.identity,
        data: null,
        loading: false,
        error: "Team standings unavailable.",
      });
      return () => {
        ownsRequest = false;
      };
    }

    setState({
      identity: request.identity,
      data: null,
      loading: true,
      error: null,
    });

    const load = async () => {
      try {
        const { data: summary, error: summaryError } = await supabase
          .from("team_summary_years")
          .select(
            "games_played,wins,losses,ot_losses,points,goals_for,goals_against,point_pct,regulation_and_ot_wins",
          )
          .eq("team_id", teamId)
          .eq("season_id", seasonId)
          .maybeSingle();

        if (!ownsRequest) return;
        if (summaryError) throw summaryError;
        if (!summary) {
          setState({
            identity: request.identity,
            data: null,
            loading: false,
            error: null,
          });
          return;
        }

        const { data: standingsRows, error: standingsError } = await supabase
          .from("nhl_standings_details")
          .select(
            "division_sequence,conference_sequence,league_sequence,streak_code,streak_count,l10_wins,l10_losses,l10_ot_losses,division_name,conference_name",
          )
          .eq("team_abbrev", teamAbbreviation)
          .eq("season_id", seasonId)
          .order("date", { ascending: false })
          .limit(1);

        if (!ownsRequest) return;
        if (standingsError) throw standingsError;
        const standings = standingsRows?.[0];
        setState({
          identity: request.identity,
          data: {
            division_sequence: standings?.division_sequence ?? null,
            conference_sequence: standings?.conference_sequence ?? null,
            league_sequence: standings?.league_sequence ?? null,
            points: summary.points ?? 0,
            wins: summary.wins ?? 0,
            losses: summary.losses ?? 0,
            ot_losses: summary.ot_losses ?? 0,
            streak_code: standings?.streak_code ?? "",
            streak_count: standings?.streak_count ?? 0,
            l10_wins: standings?.l10_wins ?? 0,
            l10_losses: standings?.l10_losses ?? 0,
            l10_ot_losses: standings?.l10_ot_losses ?? 0,
            goal_for: summary.goals_for ?? 0,
            goal_against: summary.goals_against ?? 0,
            point_pctg: summary.point_pct ?? 0,
            division_name: standings?.division_name ?? "",
            conference_name: standings?.conference_name ?? "",
            games_played: summary.games_played ?? 0,
            regulation_wins: summary.regulation_and_ot_wins ?? 0,
          },
          loading: false,
          error: null,
        });
      } catch {
        if (!ownsRequest) return;
        console.error("Unable to load team standings header.");
        setState({
          identity: request.identity,
          data: null,
          loading: false,
          error: "Team standings unavailable.",
        });
      }
    };

    void load();
    return () => {
      ownsRequest = false;
    };
  }, [request, seasonId, teamAbbreviation, teamId]);

  if (state.identity !== request.identity) {
    return {
      data: null,
      loading: request.valid,
      error: request.valid ? null : "Team standings unavailable.",
    };
  }

  return { data: state.data, loading: state.loading, error: state.error };
}
