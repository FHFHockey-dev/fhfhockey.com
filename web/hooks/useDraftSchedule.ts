import { useEffect, useMemo, useState } from "react";
import publicSupabase from "lib/supabase/public-client";
import { useScheduleRange } from "components/GameGrid/utils/useSchedule";
import type { ProcessedPlayer } from "hooks/useProcessedProjectionsData";
import { calculateScheduleMetrics, type DashboardMatchupWeek, type PlayerScheduleMetrics } from "lib/draftDashboard/scheduleMetrics";

export function useDraftSchedule(players: readonly ProcessedPlayer[], playoffWeeks: readonly number[], scope: "season" | "playoffs") {
  const [weeks, setWeeks] = useState<DashboardMatchupWeek[]>([]);
  const [weeksError, setWeeksError] = useState<string | null>(null);
  useEffect(() => {
    let ignore = false;
    void (async () => {
      const { data, error } = await publicSupabase.from("yahoo_matchup_weeks")
        .select("week,start_date,end_date").eq("game_key", "477").order("week", { ascending: true });
      if (error) throw error;
      if (!data?.length) throw new Error("Yahoo weeks for game 477 are unavailable.");
      const valid = data.filter((week): week is DashboardMatchupWeek => Boolean(week.start_date && week.end_date && week.start_date <= week.end_date));
      if (valid.length !== data.length) throw new Error("Yahoo week dates are incomplete.");
      if (!ignore) setWeeks(valid);
    })().catch((error) => { if (!ignore) setWeeksError(error.message ?? "Yahoo weeks unavailable."); });
    return () => { ignore = true; };
  }, []);
  const effectiveScope = scope === "playoffs" && weeks.some((week) => playoffWeeks.includes(week.week)) ? "playoffs" : "season";
  const selectedWeeks = useMemo(() => weeks.filter((week) => effectiveScope === "season" || playoffWeeks.includes(week.week)), [weeks, effectiveScope, playoffWeeks]);
  const range = useScheduleRange(weeks[0]?.start_date, weeks.at(-1)?.end_date);
  const playerMetrics = useMemo<PlayerScheduleMetrics | undefined>(() => {
    if (range.status !== "ready" || !selectedWeeks.length) return undefined;
    const metrics = calculateScheduleMetrics(range.games, selectedWeeks);
    const teams = new Map<string, number>();
    range.teams.forEach((team) => teams.set(team.abbreviation.toUpperCase(), Math.max(team.id, teams.get(team.abbreviation.toUpperCase()) ?? 0)));
    return new Map(players.flatMap((player) => {
      const team = teams.get(player.displayTeam?.trim().toUpperCase() ?? "");
      if (team == null) return [];
      return [[String(player.playerId), metrics.get(team) ?? { games: 0, off: 0, b2b: 0 }]];
    }));
  }, [range.status, range.games, range.teams, selectedWeeks, players]);
  return { weeks, selectedWeeks, playerMetrics, weeksError, scope: effectiveScope,
    error: weeksError ?? range.error,
    loading: !weeksError && (!weeks.length || range.status === "loading"),
    periodLabel: effectiveScope === "playoffs" ? `Playoffs · Weeks ${selectedWeeks.map((week) => week.week).join(", ")}` : "Season · Yahoo 477",
  };
}
