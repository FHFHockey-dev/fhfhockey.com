import supabase from "lib/supabase/server";
import { reconcileTeamToPlayers } from "lib/projections/reconcile";

type GameRow = {
  id: number;
  date: string;
  homeTeamId: number;
  awayTeamId: number;
};

type LineCombinationRow = {
  gameId: number;
  teamId: number;
  forwards: number[] | null;
  defensemen: number[] | null;
  goalies: number[] | null;
};

type RollingRow = {
  player_id: number;
  strength_state: string;
  game_date: string;
  toi_seconds_avg_last5: number | null;
  toi_seconds_avg_all: number | null;
  sog_per_60_avg_last5: number | null;
  sog_per_60_avg_all: number | null;
  goals_total_all: number | null;
  shots_total_all: number | null;
  assists_total_all: number | null;
};

type RosterEventRow = {
  event_id: number;
  team_id: number | null;
  player_id: number | null;
  event_type: string;
  confidence: number;
  payload: any;
  effective_from: string;
  effective_to: string | null;
};

function assertSupabase() {
  if (!supabase) throw new Error("Supabase server client not available");
}

function clamp(n: number, lo: number, hi: number): number {
  return Math.min(hi, Math.max(lo, n));
}

function pickLatestByPlayer(rows: RollingRow[]): Map<number, RollingRow> {
  const byPlayer = new Map<number, RollingRow>();
  for (const r of rows) {
    const existing = byPlayer.get(r.player_id);
    if (!existing || r.game_date > existing.game_date) byPlayer.set(r.player_id, r);
  }
  return byPlayer;
}

function safeNumber(n: number | null | undefined, fallback: number): number {
  return typeof n === "number" && Number.isFinite(n) ? n : fallback;
}

function computeShotsFromRate(toiSeconds: number, sogPer60: number): number {
  const toiMinutes = toiSeconds / 60;
  return (sogPer60 / 60) * toiMinutes;
}

function computeRate(numerator: number, denom: number, fallback: number): number {
  if (!Number.isFinite(numerator) || !Number.isFinite(denom) || denom <= 0) return fallback;
  return numerator / denom;
}

type TeamStrengthAverages = {
  toiEsSecondsAvg: number | null;
  toiPpSecondsAvg: number | null;
  shotsEsAvg: number | null;
  shotsPpAvg: number | null;
};

function meanOrNull(nums: Array<number | null | undefined>): number | null {
  const vals = nums.filter((n): n is number => typeof n === "number" && Number.isFinite(n));
  if (vals.length === 0) return null;
  return vals.reduce((a, b) => a + b, 0) / vals.length;
}

async function fetchTeamStrengthAverages(teamId: number, cutoffDate: string): Promise<TeamStrengthAverages> {
  assertSupabase();
  const { data, error } = await supabase
    .from("forge_team_game_strength")
    .select("game_date,toi_es_seconds,toi_pp_seconds,shots_es,shots_pp")
    .eq("team_id", teamId)
    .lt("game_date", cutoffDate)
    .order("game_date", { ascending: false })
    .limit(10);
  if (error) throw error;

  const rows = (data ?? []) as any[];
  return {
    toiEsSecondsAvg: meanOrNull(rows.map((r) => (r?.toi_es_seconds == null ? null : Number(r.toi_es_seconds)))),
    toiPpSecondsAvg: meanOrNull(rows.map((r) => (r?.toi_pp_seconds == null ? null : Number(r.toi_pp_seconds)))),
    shotsEsAvg: meanOrNull(rows.map((r) => (r?.shots_es == null ? null : Number(r.shots_es)))),
    shotsPpAvg: meanOrNull(rows.map((r) => (r?.shots_pp == null ? null : Number(r.shots_pp))))
  };
}

function toDayBoundsUtc(dateOnly: string): { startTs: string; endTs: string } {
  return {
    startTs: `${dateOnly}T00:00:00.000Z`,
    endTs: `${dateOnly}T23:59:59.999Z`
  };
}

function availabilityMultiplierForEvent(eventType: string, confidence: number): number | null {
  const c = typeof confidence === "number" && Number.isFinite(confidence) ? confidence : 0.5;
  switch (eventType) {
    case "INJURY_OUT":
    case "SENDDOWN":
      return 0;
    case "DTD":
      return clamp(1 - 0.6 * c, 0.2, 1);
    case "RETURN":
    case "CALLUP":
      return 1;
    default:
      return null;
  }
}

async function hasPbpGame(gameId: number): Promise<boolean> {
  assertSupabase();
  const { data, error } = await supabase
    .from("pbp_games")
    .select("id")
    .eq("id", gameId)
    .maybeSingle();
  if (error) throw error;
  return Boolean((data as any)?.id);
}

async function hasShiftTotals(gameId: number): Promise<boolean> {
  assertSupabase();
  const { count, error } = await supabase
    .from("shift_charts")
    .select("id", { count: "exact", head: true })
    .eq("game_id", gameId);
  if (error) throw error;
  return (count ?? 0) > 0;
}

async function fetchLineCombinations(gameId: number): Promise<LineCombinationRow[]> {
  assertSupabase();
  const { data, error } = await supabase
    .from("lineCombinations")
    .select("gameId,teamId,forwards,defensemen,goalies")
    .eq("gameId", gameId);
  if (error) throw error;
  return (data ?? []) as any;
}

async function fetchRollingRows(
  playerIds: number[],
  strengthState: "ev" | "pp",
  cutoffDate: string
): Promise<RollingRow[]> {
  assertSupabase();
  if (playerIds.length === 0) return [];
  const { data, error } = await supabase
    .from("rolling_player_game_metrics")
    .select(
      "player_id,strength_state,game_date,toi_seconds_avg_last5,toi_seconds_avg_all,sog_per_60_avg_last5,sog_per_60_avg_all,goals_total_all,shots_total_all,assists_total_all"
    )
    .in("player_id", playerIds)
    .eq("strength_state", strengthState)
    .lt("game_date", cutoffDate)
    .order("game_date", { ascending: false })
    .limit(5000);
  if (error) throw error;
  return (data ?? []) as any;
}

async function createRun(asOfDate: string): Promise<string> {
  assertSupabase();
  const { data, error } = await supabase
    .from("forge_runs")
    .insert({
      as_of_date: asOfDate,
      status: "running",
      git_sha: process.env.VERCEL_GIT_COMMIT_SHA ?? process.env.GIT_SHA ?? null,
      metrics: {}
    })
    .select("run_id")
    .single();
  if (error) throw error;
  return (data as any).run_id as string;
}

async function finalizeRun(runId: string, status: "succeeded" | "failed", metrics: any) {
  assertSupabase();
  const { error } = await supabase
    .from("forge_runs")
    .update({ status, metrics, updated_at: new Date().toISOString() })
    .eq("run_id", runId);
  if (error) throw error;
}

type ProjectionTotals = {
  toiEsSeconds: number;
  toiPpSeconds: number;
  shotsEs: number;
  shotsPp: number;
  goalsEs: number;
  goalsPp: number;
  assistsEs: number;
  assistsPp: number;
};

export async function runProjectionV2ForDate(
  asOfDate: string,
  opts?: { deadlineMs?: number }
): Promise<{
  runId: string;
  gamesProcessed: number;
  playerRowsUpserted: number;
  teamRowsUpserted: number;
  goalieRowsUpserted: number;
  timedOut: boolean;
}> {
  assertSupabase();
  const runId = await createRun(asOfDate);

  const metrics: any = {
    as_of_date: asOfDate,
    started_at: new Date().toISOString(),
    games: 0,
    player_rows: 0,
    team_rows: 0,
    goalie_rows: 0,
    data_quality: {
      missing_pbp_games: 0,
      missing_shift_totals: 0,
      missing_line_combos: 0,
      empty_skater_rosters: 0,
      missing_ev_metrics_players: 0,
      missing_pp_metrics_players: 0,
      toi_scaled_teams: 0,
      toi_scale_min: null as number | null,
      toi_scale_max: null as number | null
    },
    warnings: [] as string[]
  };

  try {
    const { data: games, error: gamesErr } = await supabase
      .from("games")
      .select("id,date,homeTeamId,awayTeamId")
      .eq("date", asOfDate);
    if (gamesErr) throw gamesErr;

    const teamStrengthCache = new Map<number, TeamStrengthAverages>();
    const { startTs, endTs } = toDayBoundsUtc(asOfDate);

    const teamIds = Array.from(
      new Set(
        ((games ?? []) as GameRow[]).flatMap((g) => [g.homeTeamId, g.awayTeamId]).filter((n) => n != null)
      )
    );

    const playerAvailabilityMultiplier = new Map<number, number>();
    const goalieOverrideByTeamId = new Map<number, { goalieId: number; starterProb: number }>();

    if (teamIds.length > 0) {
      const { data: events, error: evErr } = await supabase
        .from("forge_roster_events")
        .select("event_id,team_id,player_id,event_type,confidence,payload,effective_from,effective_to")
        .in("team_id", teamIds)
        .lte("effective_from", endTs)
        .order("effective_from", { ascending: false })
        .limit(5000);
      if (evErr) throw evErr;

      const bestAvailabilityEventByPlayer = new Map<number, RosterEventRow>();

      for (const e of (events ?? []) as any[]) {
        const row = e as RosterEventRow;
        if (row.effective_to != null && row.effective_to < startTs) continue;
        if (row.player_id != null) {
          const mult = availabilityMultiplierForEvent(row.event_type, row.confidence);
          if (mult != null) {
            const existing = bestAvailabilityEventByPlayer.get(row.player_id);
            if (!existing || row.effective_from > existing.effective_from) {
              bestAvailabilityEventByPlayer.set(row.player_id, row);
            }
          }
        }

        if (
          row.team_id != null &&
          row.player_id != null &&
          (row.event_type === "GOALIE_START_CONFIRMED" || row.event_type === "GOALIE_START_LIKELY")
        ) {
          const starterProb = row.event_type === "GOALIE_START_CONFIRMED" ? 1 : clamp(row.confidence ?? 0.75, 0.5, 1);
          const existing = goalieOverrideByTeamId.get(row.team_id);
          if (!existing || starterProb > existing.starterProb) {
            goalieOverrideByTeamId.set(row.team_id, { goalieId: row.player_id, starterProb });
          }
        }
      }

      for (const [playerId, ev] of bestAvailabilityEventByPlayer.entries()) {
        const mult = availabilityMultiplierForEvent(ev.event_type, ev.confidence);
        if (mult != null) playerAvailabilityMultiplier.set(playerId, mult);
      }
    }

    const deadlineMs = safeNumber(opts?.deadlineMs, Number.POSITIVE_INFINITY);
    let timedOut = false;

    let playerRowsUpserted = 0;
    let teamRowsUpserted = 0;
    let goalieRowsUpserted = 0;

    gamesLoop: for (const game of (games ?? []) as GameRow[]) {
      if (Date.now() > deadlineMs) {
        timedOut = true;
        break gamesLoop;
      }
      if (!(await hasPbpGame(game.id))) metrics.data_quality.missing_pbp_games += 1;
      if (!(await hasShiftTotals(game.id))) metrics.data_quality.missing_shift_totals += 1;

      const lineCombos = await fetchLineCombinations(game.id);
      const byTeam = new Map<number, LineCombinationRow>();
      for (const row of lineCombos) byTeam.set(row.teamId, row);

      const teamShotsByTeamId = new Map<number, { shotsEs: number; shotsPp: number }>();
      const goalieCandidates: Array<{
        teamId: number;
        opponentTeamId: number;
        goalieId: number;
        starterProb: number;
      }> = [];

      for (const teamId of [game.homeTeamId, game.awayTeamId]) {
        if (Date.now() > deadlineMs) {
          timedOut = true;
          break gamesLoop;
        }
        const lc = byTeam.get(teamId);
        const opponentTeamId = teamId === game.homeTeamId ? game.awayTeamId : game.homeTeamId;
        if (!lc) {
          metrics.warnings.push(`missing lineCombinations for game=${game.id} team=${teamId}`);
          metrics.data_quality.missing_line_combos += 1;
          continue;
        }

        const rawSkaterIds = [
          ...(lc.forwards ?? []),
          ...(lc.defensemen ?? [])
        ].filter((n) => typeof n === "number");

        const skaterIds = rawSkaterIds.filter((playerId) => (playerAvailabilityMultiplier.get(playerId) ?? 1) > 0);

        if (skaterIds.length === 0) {
          metrics.warnings.push(`empty skaterIds for game=${game.id} team=${teamId}`);
          metrics.data_quality.empty_skater_rosters += 1;
          continue;
        }

        const evRows = await fetchRollingRows(skaterIds, "ev", asOfDate);
        const ppRows = await fetchRollingRows(skaterIds, "pp", asOfDate);
        const evLatest = pickLatestByPlayer(evRows);
        const ppLatest = pickLatestByPlayer(ppRows);

        // Initial per-player TOI estimates (seconds)
        const projected = new Map<number, { toiEs: number; toiPp: number; shotsEs: number; shotsPp: number; goalRate: number; assistRate: number }>();

        for (const playerId of skaterIds) {
          const ev = evLatest.get(playerId);
          const pp = ppLatest.get(playerId);

          if (!ev) metrics.data_quality.missing_ev_metrics_players += 1;
          if (!pp) metrics.data_quality.missing_pp_metrics_players += 1;

          const toiEs = safeNumber(
            ev?.toi_seconds_avg_last5,
            safeNumber(ev?.toi_seconds_avg_all, 700)
          );
          const toiPp = safeNumber(
            pp?.toi_seconds_avg_last5,
            safeNumber(pp?.toi_seconds_avg_all, 120)
          );

          const sogPer60Ev = safeNumber(ev?.sog_per_60_avg_last5, safeNumber(ev?.sog_per_60_avg_all, 6));
          const sogPer60Pp = safeNumber(pp?.sog_per_60_avg_last5, safeNumber(pp?.sog_per_60_avg_all, 8));

          const shotsEs = computeShotsFromRate(toiEs, sogPer60Ev);
          const shotsPp = computeShotsFromRate(toiPp, sogPer60Pp);

          // Simple conversion priors from totals (all-strength) to avoid overfitting.
          const goalsTotal = safeNumber(ev?.goals_total_all, 0);
          const shotsTotal = safeNumber(ev?.shots_total_all, 0);
          const assistsTotal = safeNumber(ev?.assists_total_all, 0);
          const goalRate = clamp(computeRate(goalsTotal + 2, shotsTotal + 40, 0.1), 0.03, 0.25);
          const assistRate = clamp(computeRate(assistsTotal + 3, (goalsTotal + 3) * 2, 0.7), 0.2, 1.4);

          const availabilityMultiplier = playerAvailabilityMultiplier.get(playerId) ?? 1;
          projected.set(playerId, {
            toiEs: toiEs * availabilityMultiplier,
            toiPp: toiPp * availabilityMultiplier,
            shotsEs: shotsEs * availabilityMultiplier,
            shotsPp: shotsPp * availabilityMultiplier,
            goalRate,
            assistRate
          });
        }

        // Task 3.6 reconciliation: hard constraints for team TOI + shots (by strength).
        const targetSkaterSeconds = 60 * 60 * 5;
        const strengthAverages =
          teamStrengthCache.get(teamId) ??
          (await fetchTeamStrengthAverages(teamId, asOfDate));
        teamStrengthCache.set(teamId, strengthAverages);

        const initialToiEs = Array.from(projected.values()).reduce((acc, p) => acc + p.toiEs, 0);
        const initialToiPp = Array.from(projected.values()).reduce((acc, p) => acc + p.toiPp, 0);
        const initialShotsEs = Array.from(projected.values()).reduce((acc, p) => acc + p.shotsEs, 0);
        const initialShotsPp = Array.from(projected.values()).reduce((acc, p) => acc + p.shotsPp, 0);

        const avgToiEs = strengthAverages.toiEsSecondsAvg;
        const avgToiPp = strengthAverages.toiPpSecondsAvg;
        const toiDenom =
          (typeof avgToiEs === "number" ? avgToiEs : 0) + (typeof avgToiPp === "number" ? avgToiPp : 0);
        const fallbackDenom = initialToiEs + initialToiPp;

        const ppShare =
          toiDenom > 0
            ? safeNumber(avgToiPp, 0) / toiDenom
            : fallbackDenom > 0
              ? initialToiPp / fallbackDenom
              : 0.1;

        const toiPpTarget = Math.round(clamp(ppShare, 0, 0.5) * targetSkaterSeconds);
        const toiEsTarget = targetSkaterSeconds - toiPpTarget;

        const shotsEsTarget = safeNumber(strengthAverages.shotsEsAvg, initialShotsEs);
        const shotsPpTarget = safeNumber(strengthAverages.shotsPpAvg, initialShotsPp);

        const { players: reconciledPlayers, report } = reconcileTeamToPlayers({
          players: Array.from(projected.entries()).map(([playerId, p]) => ({
            playerId,
            toiEsSeconds: p.toiEs,
            toiPpSeconds: p.toiPp,
            shotsEs: p.shotsEs,
            shotsPp: p.shotsPp
          })),
          targets: {
            toiEsSeconds: toiEsTarget,
            toiPpSeconds: toiPpTarget,
            shotsEs: shotsEsTarget,
            shotsPp: shotsPpTarget
          }
        });

        const totalToiBefore = initialToiEs + initialToiPp;
        const totalToiAfter = report.toiEs.after + report.toiPp.after;
        const toiScale = totalToiBefore > 0 ? totalToiAfter / totalToiBefore : 1;

        if (Math.abs(toiScale - 1) > 0.01) {
          metrics.data_quality.toi_scaled_teams += 1;
          metrics.data_quality.toi_scale_min =
            metrics.data_quality.toi_scale_min == null
              ? toiScale
              : Math.min(metrics.data_quality.toi_scale_min, toiScale);
          metrics.data_quality.toi_scale_max =
            metrics.data_quality.toi_scale_max == null
              ? toiScale
              : Math.max(metrics.data_quality.toi_scale_max, toiScale);
        }

        for (const rp of reconciledPlayers) {
          const cur = projected.get(rp.playerId);
          if (!cur) continue;
          cur.toiEs = rp.toiEsSeconds;
          cur.toiPp = rp.toiPpSeconds;
          cur.shotsEs = rp.shotsEs;
          cur.shotsPp = rp.shotsPp;
          projected.set(rp.playerId, cur);
        }

        const playerUpserts = [];
        const teamTotals: ProjectionTotals = {
          toiEsSeconds: 0,
          toiPpSeconds: 0,
          shotsEs: 0,
          shotsPp: 0,
          goalsEs: 0,
          goalsPp: 0,
          assistsEs: 0,
          assistsPp: 0
        };

        for (const [playerId, p] of projected.entries()) {
          const shotsEs = p.shotsEs;
          const shotsPp = p.shotsPp;
          const goalsEs = shotsEs * p.goalRate;
          const goalsPp = shotsPp * p.goalRate;
          const assistsEs = goalsEs * p.assistRate;
          const assistsPp = goalsPp * p.assistRate;

          teamTotals.toiEsSeconds += p.toiEs;
          teamTotals.toiPpSeconds += p.toiPp;
          teamTotals.shotsEs += shotsEs;
          teamTotals.shotsPp += shotsPp;
          teamTotals.goalsEs += goalsEs;
          teamTotals.goalsPp += goalsPp;
          teamTotals.assistsEs += assistsEs;
          teamTotals.assistsPp += assistsPp;

          playerUpserts.push({
            run_id: runId,
            as_of_date: asOfDate,
            horizon_games: 1,
            game_id: game.id,
            player_id: playerId,
            team_id: teamId,
            opponent_team_id: opponentTeamId,
            proj_toi_es_seconds: p.toiEs,
            proj_toi_pp_seconds: p.toiPp,
            proj_toi_pk_seconds: null,
            proj_shots_es: Number(shotsEs.toFixed(3)),
            proj_shots_pp: Number(shotsPp.toFixed(3)),
            proj_shots_pk: null,
            proj_goals_es: Number(goalsEs.toFixed(3)),
            proj_goals_pp: Number(goalsPp.toFixed(3)),
            proj_goals_pk: null,
            proj_assists_es: Number(assistsEs.toFixed(3)),
            proj_assists_pp: Number(assistsPp.toFixed(3)),
            proj_assists_pk: null,
            uncertainty: {},
            updated_at: new Date().toISOString()
          });
        }

        const { error: playerErr } = await supabase
          .from("forge_player_projections")
          .upsert(playerUpserts, { onConflict: "run_id,game_id,player_id,horizon_games" });
        if (playerErr) throw playerErr;
        playerRowsUpserted += playerUpserts.length;

        const teamUpsert = {
          run_id: runId,
          as_of_date: asOfDate,
          horizon_games: 1,
          game_id: game.id,
          team_id: teamId,
          opponent_team_id: opponentTeamId,
          proj_toi_es_seconds: teamTotals.toiEsSeconds,
          proj_toi_pp_seconds: teamTotals.toiPpSeconds,
          proj_toi_pk_seconds: null,
          proj_shots_es: Number(teamTotals.shotsEs.toFixed(3)),
          proj_shots_pp: Number(teamTotals.shotsPp.toFixed(3)),
          proj_shots_pk: null,
          proj_goals_es: Number(teamTotals.goalsEs.toFixed(3)),
          proj_goals_pp: Number(teamTotals.goalsPp.toFixed(3)),
          proj_goals_pk: null,
          uncertainty: {},
          updated_at: new Date().toISOString()
        };

        const { error: teamErr } = await supabase
          .from("forge_team_projections")
          .upsert(teamUpsert, { onConflict: "run_id,game_id,team_id,horizon_games" });
        if (teamErr) throw teamErr;
        teamRowsUpserted += 1;

        teamShotsByTeamId.set(teamId, {
          shotsEs: Number(teamUpsert.proj_shots_es ?? 0),
          shotsPp: Number(teamUpsert.proj_shots_pp ?? 0)
        });

        // Goalie: pick the highest probability starter from goalie_start_projections if available.
        const goalieOverride = goalieOverrideByTeamId.get(teamId);
        const { data: goalieStarts, error: gsErr } = await supabase
          .from("goalie_start_projections")
          .select("player_id,start_probability")
          .eq("game_id", game.id)
          .eq("team_id", teamId)
          .order("start_probability", { ascending: false })
          .limit(1);
        if (gsErr) throw gsErr;
        const goalieId = goalieOverride?.goalieId ?? (goalieStarts?.[0] as any)?.player_id ?? (lc.goalies?.[0] ?? null);

        if (goalieId != null) {
          const starterProb = goalieOverride?.starterProb ?? Number((goalieStarts?.[0] as any)?.start_probability ?? 0.5);
          goalieCandidates.push({ teamId, opponentTeamId, goalieId, starterProb });
        }
      }

      // Create goalie projections after both teams are projected so we can use opponent shots.
      for (const c of goalieCandidates) {
        if (Date.now() > deadlineMs) {
          timedOut = true;
          break gamesLoop;
        }
        const oppShots = teamShotsByTeamId.get(c.opponentTeamId);
        if (!oppShots) {
          metrics.warnings.push(`missing opponent shots for game=${game.id} team=${c.teamId}`);
          continue;
        }
        const shotsAgainst = Number((oppShots.shotsEs + oppShots.shotsPp).toFixed(3));

        // Baseline league save% until we wire goalie priors.
        const svPct = 0.9;
        const goalsAllowed = shotsAgainst * (1 - svPct);
        const saves = shotsAgainst - goalsAllowed;

        const goalieUpsert = {
          run_id: runId,
          as_of_date: asOfDate,
          horizon_games: 1,
          game_id: game.id,
          goalie_id: c.goalieId,
          team_id: c.teamId,
          opponent_team_id: c.opponentTeamId,
          starter_probability: Number(c.starterProb),
          proj_shots_against: shotsAgainst,
          proj_goals_allowed: Number(goalsAllowed.toFixed(3)),
          proj_saves: Number(saves.toFixed(3)),
          uncertainty: {},
          updated_at: new Date().toISOString()
        };

        const { error: goalieErr } = await supabase
          .from("forge_goalie_projections")
          .upsert(goalieUpsert, { onConflict: "run_id,game_id,goalie_id,horizon_games" });
        if (goalieErr) throw goalieErr;
        goalieRowsUpserted += 1;
      }

      metrics.games += 1;
    }

    metrics.player_rows = playerRowsUpserted;
    metrics.team_rows = teamRowsUpserted;
    metrics.goalie_rows = goalieRowsUpserted;
    metrics.finished_at = new Date().toISOString();
    metrics.timed_out = timedOut;

    await finalizeRun(runId, timedOut ? "failed" : "succeeded", metrics);
    return {
      runId,
      gamesProcessed: metrics.games,
      playerRowsUpserted,
      teamRowsUpserted,
      goalieRowsUpserted,
      timedOut
    };
  } catch (e) {
    metrics.finished_at = new Date().toISOString();
    metrics.error = (e as any)?.message ?? String(e);
    await finalizeRun(runId, "failed", metrics);
    throw e;
  }
}
