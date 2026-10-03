import { fetchAllSupabasePages } from "lib/supabase/pagination";
import { eligibleClaim, evidenceKey, mayReplace, reconcileEntry, reconcilePP } from "./reconcile";
import { instant, unitKey, type EntryRevision, type LineClaim, type LineGame, type PPDecision } from "./types";

export async function appendLineEvidence(supabase: any, claims: LineClaim[], games: LineGame[]) {
  // Null ingestion instants remain in the payload; the row's capture clock is this append operation.
  const captures = [...new Map(claims.map((claim) => [claim.captureId, { capture_id: claim.captureId, team_id: claim.teamId,
    original_identity: claim.originalIdentity, captured_at: instant(claim.time.ingestedAt) == null ? claim.time.interpretedAt : claim.time.ingestedAt,
    payload: { text: claim.text, originalIdentity: claim.originalIdentity, provenance: claim.provenance, sourceUrl: claim.sourceUrl, author: claim.author, time: claim.time } }])).values()];
  if (captures.length) {
    const capture = await supabase.from("line_source_captures").upsert(captures, { onConflict: "capture_id", ignoreDuplicates: true });
    if (capture.error) throw capture.error;
    const result = await supabase.from("line_claim_revisions").upsert(claims.map((claim) => ({ claim_id: claim.id, capture_id: claim.captureId,
      team_id: claim.teamId, game_id: claim.gameId, interpretation_version: claim.version, interpreted_at: claim.time.interpretedAt, payload: claim })), { onConflict: "claim_id", ignoreDuplicates: true });
    if (result.error) throw result.error;
    // Attempted links remain in the immutable payload. The FK index contains only
    // resolved authorized links; retries use stored payloads, never revised input
    // under an existing claim ID, to avoid silently clearing a review decision.
    const attemptedIds = [...new Set(claims.flatMap((claim) => eligibleClaim(claim) && (claim.supersedes.length || claim.retracts.length) ? [claim.id, ...claim.supersedes, ...claim.retracts] : []))];
    const stored = attemptedIds.length ? await fetchAllSupabasePages<{ claim_id: string; payload: LineClaim }>(({ from, to }) => supabase.from("line_claim_revisions")
      .select("claim_id,payload").in("claim_id", attemptedIds).order("claim_id").range(from, to)) : [];
    const resolved = new Map(stored.map((row) => [row.claim_id, row.payload]));
    const relations = claims.flatMap((input) => {
      const claim = resolved.get(input.id);
      if (!claim) return [];
      return (["supersedes", "retracts"] as const).flatMap((kind) => claim[kind].flatMap((id) => {
        const target = resolved.get(id);
        if (!target || id === claim.id || !mayReplace(claim, target)
          || claim.kind === "entry_correction" && (!claim.unit || !target.unit || unitKey(claim.unit) !== unitKey(target.unit))) return [];
        return [{ claim_id: claim.id, target_claim_id: id, kind, authority: claim.relationAuthority }];
      }));
    });
    if (relations.length) { const result = await supabase.from("line_claim_relations").upsert(relations, { onConflict: "claim_id,target_claim_id,kind", ignoreDuplicates: true }); if (result.error) throw result.error; }
  }
  const states = games.filter((game) => instant(game.observedAt) != null && game.stateSource).map((game) => ({ state_id: evidenceKey(game), game_id: game.id,
    observed_at: game.observedAt, schedule_identity: game.scheduleIdentity, payload: game }));
  if (states.length) { const result = await supabase.from("line_game_state_observations").upsert(states, { onConflict: "state_id", ignoreDuplicates: true }); if (result.error) throw result.error; }
}

export async function fetchLineClaims(supabase: any, teamIds: number[], now: string): Promise<LineClaim[]> {
  const rows = await fetchAllSupabasePages<{ payload: LineClaim }>(({ from, to }) => supabase.from("line_claim_revisions").select("payload")
    .in("team_id", teamIds).lte("interpreted_at", now).order("claim_id").range(from, to));
  return rows.map((row) => row.payload);
}

export async function fetchEntryHistory(supabase: any, teamIds: number[]): Promise<EntryRevision[]> {
  const rows = await fetchAllSupabasePages<{ payload: EntryRevision }>(({ from, to }) => supabase.from("line_entry_revisions").select("payload")
    .in("team_id", teamIds).order("game_id").order("team_id").order("revision").range(from, to));
  return rows.map((row) => row.payload);
}

export async function latestLineDecisions(supabase: any, gameId: number, teamId: number): Promise<{ entry: EntryRevision | null; pp: PPDecision[] }> {
  const [entries, pp] = await Promise.all([
    supabase.from("line_entry_revisions").select("payload").eq("game_id", gameId).eq("team_id", teamId).order("revision", { ascending: false }).limit(1),
    fetchAllSupabasePages<{ payload: PPDecision }>(({ from, to }) => supabase.from("line_pp_decisions").select("payload")
      .eq("game_id", gameId).eq("team_id", teamId).order("revision", { ascending: false }).order("decision_id", { ascending: false }).range(from, to)),
  ]);
  if (entries.error) throw entries.error;
  const units = new Map<number, PPDecision>();
  for (const row of pp) if (!units.has(row.payload.unitNumber)) units.set(row.payload.unitNumber, row.payload);
  return { entry: entries.data?.[0]?.payload ?? null, pp: [...units.values()] };
}

/** Runs only in the gated processor, never on a public GET. Existing forecasts are untouched. */
export async function persistLineReconciliation(supabase: any, args: { game: LineGame; teamId: number; games: LineGame[]; now: string; carryForward: boolean }) {
  for (let attempt = 0; attempt < 2; attempt++) {
    const [claims, previous] = await Promise.all([fetchLineClaims(supabase, [args.teamId], args.now), latestLineDecisions(supabase, args.game.id, args.teamId)]);
    const entry = reconcileEntry({ ...args, claims, previous: previous.entry });
    const pp = reconcilePP({ ...args, claims, previous: previous.pp });
    const result = await supabase.rpc("append_line_decisions", { p_game_id: args.game.id, p_team_id: args.teamId,
      p_expected_entry_id: previous.entry?.id ?? null, p_entry: entry, p_pp: pp });
    if (result.error) throw result.error;
    if (result.data === true) return { entry, pp };
  }
  throw new Error("Line evidence changed concurrently; reconciliation deferred");
}
