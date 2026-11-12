import { z } from "zod";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { GoalieGameBoard } from "components/GameGrid/utils/goalieGameView";
import { readGoalieCandidatesContract } from "./goalieCandidates";
import { loadExternalInputProof } from "../externalInputProof";
import { excludeOffReleaseRuns, restrictRunsToHorizon } from "../releasedRunFence";
import { timestampMicros } from "../evidenceTime";

const id = z.number().int().positive(), time = z.string().datetime({ offset: true });
const contractSchema = z.object({
  population: z.literal("candidate_goalie_game"), game_id: id, team_id: id,
  issuance: z.object({ run_id: z.string().uuid(), as_of_date: z.string(), issued_at: time, information_cutoff_at: time.nullable() }),
  rows: z.array(z.object({ goalie_id: id, rank: id, start_probability_status: z.enum(["override", "confirmed_evidence", "uncalibrated_model"]),
    confirmation_evidence_ids: z.array(z.string().min(1)).max(100) })).min(1).max(100),
});
export type GridScheduledGame = { id: number; seasonId: number; date: string; startTime: string; homeTeamId: number; awayTeamId: number };
export type GridGoalieRow = { run_id: string; as_of_date: string; game_id: number; team_id: number; opponent_team_id: number; goalie_id: number; uncertainty: unknown };

/** Identity only: model numbers are deliberately not promoted into qualified probabilities. */
export function goalieBoardsFromRows(rows: readonly GridGoalieRow[], games: readonly GridScheduledGame[], names: ReadonlyMap<number, string>, observedAt: string): GoalieGameBoard[] {
  const now = timestampMicros(observedAt), boards: GoalieGameBoard[] = [];
  if (now === null) return boards;
  for (const row of rows) {
    // Duplicate stored selections are ambiguous, never last-row-wins.
    if (rows.filter(other => other.game_id === row.game_id && other.team_id === row.team_id).length !== 1) continue;
    const game = games.find(g => g.id === row.game_id);
    if (!game || ![game.homeTeamId, game.awayTeamId].includes(row.team_id)
      || row.opponent_team_id !== (row.team_id === game.homeTeamId ? game.awayTeamId : game.homeTeamId)) continue;
    const parsed = contractSchema.safeParse(readGoalieCandidatesContract(row.uncertainty));
    if (!parsed.success) continue;
    const contract = parsed.data, issuance = contract.issuance;
    const issued = timestampMicros(issuance.issued_at), start = timestampMicros(game.startTime);
    const cutoff = issuance.information_cutoff_at === null ? null : timestampMicros(issuance.information_cutoff_at);
    if (contract.game_id !== game.id || contract.team_id !== row.team_id || issuance.run_id !== row.run_id
      || issuance.as_of_date !== row.as_of_date || row.as_of_date !== game.date || issued === null || start === null
      || issued > now || issued >= start || start <= now
      || issuance.information_cutoff_at !== null && (cutoff === null || cutoff > issued)) continue;
    const selected = contract.rows.find(c => c.goalie_id === row.goalie_id);
    const confirmations = contract.rows.filter(c => c.start_probability_status === "confirmed_evidence" && c.confirmation_evidence_ids.length > 0);
    const conflict = confirmations.length > 1 || confirmations.length === 1 && confirmations[0].goalie_id !== row.goalie_id;
    const revision = `${row.run_id}:${game.id}:${row.team_id}:${issuance.issued_at}`;
    boards.push({ gameId: game.id, seasonId: game.seasonId, teamId: row.team_id, opponentId: row.opponent_team_id,
      startsAt: game.startTime, selectionRevision: revision,
      selectedPlayerId: selected && names.has(selected.goalie_id) && !conflict ? selected.goalie_id : null,
      // This producer declares probability mass, not a complete eligible roster.
      candidateCoverage: "unknown",
      candidates: contract.rows.flatMap(candidate => {
        const name = names.get(candidate.goalie_id)?.trim();
        if (!name) return [];
        return [{ playerId: candidate.goalie_id, name, surname: name.split(/\s+/).at(-1)!,
          status: conflict ? "conflicting" as const : candidate.start_probability_status === "confirmed_evidence"
            && candidate.confirmation_evidence_ids.length > 0 && issuance.information_cutoff_at !== null ? "confirmed" as const : "projected" as const,
          source: { source: "FORGE per-candidate selection (as issued)", artifactId: row.run_id, revision,
            basis: "model_issuance" as const, observedAt: null, availableAt: null,
            cutoffAt: issuance.information_cutoff_at, issuedAt: issuance.issued_at, expiresAt: game.startTime,
            freshnessBasis: "Latest admitted run with output for this game and date; selection expires at scheduled start. Observation clocks and a frozen puck-drop receipt are unavailable. Confirmation is as of issuance, not a calibrated probability." },
          start: null, winIfStarting: null }];
      }) });
  }
  return boards;
}

/** At most ten dates, thirty runs, 160 games, 9,600 scalar coverage rows and 320 full team-game rows. No producer execution. */
export async function readGoalieGridBoards(client: SupabaseClient<any>, from: string, through: string, observedAt: string) {
  const { data: gameRows, error: gameError } = await client.from("games")
    .select("id,seasonId,date,startTime,homeTeamId,awayTeamId").gte("date", from).lte("date", through).limit(161);
  if (gameError) throw gameError;
  const games = (gameRows ?? []) as GridScheduledGame[];
  if (games.length > 160 || new Set(games.map(g => g.id)).size !== games.length) throw new Error("Goalie schedule coverage is ambiguous or exceeds its bound.");
  if (!games.length) return [];
  const { data: runRows, error: runError } = await restrictRunsToHorizon(excludeOffReleaseRuns(client.from("forge_runs")
    .select("run_id,as_of_date").eq("status", "succeeded").gte("as_of_date", from).lte("as_of_date", through)
    .lte("created_at", observedAt)), 1).order("created_at", { ascending: false }).limit(30);
  if (runError) throw runError;
  const runs = (runRows ?? []) as { run_id: string; as_of_date: string }[];
  if (!runs.length) return [];
  const proof = await loadExternalInputProof(client, runs.map(r => r.run_id));
  const admitted = runs.filter(run => proof.has(run.run_id));
  if (!admitted.length) return [];
  // Discover which games each run actually issued before loading candidate payloads.
  // A one-game run must not replace the other games from an earlier slate run.
  const coverageLimit = admitted.length * games.length * 2;
  const { data: coverageRows, count: coverageCount, error: coverageError } = await client.from("forge_goalie_projections")
    .select("run_id,game_id", { count: "exact" }).in("run_id", admitted.map(run => run.run_id))
    .in("game_id", games.map(game => game.id)).eq("horizon_games", 1).limit(coverageLimit + 1);
  if (coverageError) throw coverageError;
  if ((coverageCount ?? 0) > coverageLimit || (coverageRows?.length ?? 0) > coverageLimit) throw new Error("Goalie run coverage exceeds its bound.");
  if (coverageCount === null || coverageCount !== (coverageRows?.length ?? 0)) throw new Error("Goalie run coverage is incomplete.");
  const issued = new Set((coverageRows ?? []).map(row => `${row.run_id}:${row.game_id}`));
  const chosen = new Map<number, string>();
  for (const run of admitted) for (const game of games) {
    if (!chosen.has(game.id) && run.as_of_date === game.date && issued.has(`${run.run_id}:${game.id}`)) chosen.set(game.id, run.run_id);
  }
  if (!chosen.size) return [];
  const gamesByRun = new Map<string, number[]>();
  for (const [gameId, runId] of chosen) gamesByRun.set(runId, [...(gamesByRun.get(runId) ?? []), gameId]);
  // Keep both teams on one run; an invalid/missing team row does not resurrect an older selection.
  const { data: stored, error } = await client.from("forge_goalie_projections")
    .select("run_id,as_of_date,game_id,team_id,opponent_team_id,goalie_id,uncertainty")
    .or([...gamesByRun].map(([runId, gameIds]) => `and(run_id.eq.${runId},game_id.in.(${gameIds.join(",")}))`).join(","))
    .eq("horizon_games", 1).limit(321);
  if (error) throw error;
  const rows = (stored ?? []) as GridGoalieRow[];
  if (rows.length > 320) throw new Error("Goalie candidate read exceeds its bound.");
  const ids = [...new Set(rows.flatMap(row => readGoalieCandidatesContract(row.uncertainty)?.rows.map(c => c.goalie_id) ?? []))];
  if (ids.length > 400) throw new Error("Goalie identity read exceeds its bound.");
  if (!ids.length) return [];
  const { data: players, error: nameError } = await client.from("players").select("id,fullName").in("id", ids).limit(401);
  if (nameError) throw nameError;
  const names = new Map<number, string>((players ?? []).flatMap(p => typeof p.fullName === "string" ? [[p.id, p.fullName] as [number, string]] : []));
  return goalieBoardsFromRows(rows, games, names, observedAt);
}
