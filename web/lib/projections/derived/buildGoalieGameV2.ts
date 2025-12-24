import supabase from "lib/supabase/server";

type GameRow = {
  id: number;
  date: string;
  homeTeamId: number;
  awayTeamId: number;
};

type PbpPlayRow = {
  gameid: number;
  typedesckey: string | null;
  eventownerteamid: number | null;
  goalieinnetid: number | null;
};

function assertSupabase() {
  if (!supabase) throw new Error("Supabase server client not available");
}

function isShotAgainstEvent(typeDescKey: string | null): boolean {
  return typeDescKey === "shot-on-goal" || typeDescKey === "goal";
}

export async function buildGoalieGameV2ForDateRange(opts: {
  startDate: string;
  endDate: string;
  deadlineMs?: number;
}): Promise<{ gamesProcessed: number; rowsUpserted: number }> {
  assertSupabase();
  const { startDate, endDate, deadlineMs } = opts;

  const { data: games, error: gamesErr } = await supabase
    .from("games")
    .select("id,date,homeTeamId,awayTeamId")
    .gte("date", startDate)
    .lte("date", endDate)
    .order("date", { ascending: true });
  if (gamesErr) throw gamesErr;

  let rowsUpserted = 0;

  for (const game of (games ?? []) as GameRow[]) {
    if (deadlineMs != null && Date.now() > deadlineMs) break;
    const { data: plays, error: playsErr } = await supabase
      .from("pbp_plays")
      .select("gameid,typedesckey,eventownerteamid,goalieinnetid")
      .eq("gameid", game.id);
    if (playsErr) throw playsErr;

    type GoalieAgg = { sa: number; ga: number };
    const byTeamGoalie = new Map<string, GoalieAgg>();

    for (const p of (plays ?? []) as PbpPlayRow[]) {
      if (!isShotAgainstEvent(p.typedesckey)) continue;
      const shooterTeam = p.eventownerteamid;
      const goalieId = p.goalieinnetid;
      if (!shooterTeam || !goalieId) continue;

      const defendingTeam =
        shooterTeam === game.homeTeamId ? game.awayTeamId : game.homeTeamId;

      const key = `${defendingTeam}:${goalieId}`;
      const cur = byTeamGoalie.get(key) ?? { sa: 0, ga: 0 };
      cur.sa += 1;
      if (p.typedesckey === "goal") cur.ga += 1;
      byTeamGoalie.set(key, cur);
    }

    // Choose the goalie with the highest SA count for each team.
    const bestByTeam = new Map<number, { goalieId: number; sa: number; ga: number }>();
    for (const [key, agg] of byTeamGoalie.entries()) {
      const [teamIdStr, goalieIdStr] = key.split(":");
      const teamId = Number(teamIdStr);
      const goalieId = Number(goalieIdStr);
      const existing = bestByTeam.get(teamId);
      if (!existing || agg.sa > existing.sa) {
        bestByTeam.set(teamId, { goalieId, sa: agg.sa, ga: agg.ga });
      }
    }

    const upserts = Array.from(bestByTeam.entries()).map(([teamId, v]) => ({
      game_id: game.id,
      goalie_id: v.goalieId,
      team_id: teamId,
      opponent_team_id: teamId === game.homeTeamId ? game.awayTeamId : game.homeTeamId,
      game_date: game.date,
      shots_against: v.sa,
      goals_allowed: v.ga,
      saves: Math.max(0, v.sa - v.ga),
      toi_seconds: null,
      updated_at: new Date().toISOString()
    }));

    if (upserts.length === 0) continue;

    const { error: upErr } = await supabase
      .from("forge_goalie_game")
      .upsert(upserts, { onConflict: "game_id,goalie_id" });
    if (upErr) throw upErr;

    rowsUpserted += upserts.length;
  }

  return { gamesProcessed: (games ?? []).length, rowsUpserted };
}
