import { captureForgeIssuedContexts, forgeIssuedContextsFingerprint, type ForgeIssuedContextV1 } from "../issuedContext";
import { loadForgeNativeInputs, type ForgeNativeCandidates } from "../run-forge-projections";
import { parseInstantMicros } from "./time";

/**
 * Model-free collection of one game's native FORGE inputs: exactly the writer's reads for a captured single-game run
 * (issued context before and after, preflight, completeness, skater and goalie loaders), with no scoring, no writes and
 * no RPC beyond the two read-only rolling/physical-totals reads the loaders already make. Run it inside
 * `captureProjectionInputs` with the strict transport; replaying the writer against those reads consumes every one.
 *
 * `seasonBootstrap` must match the writer run it stands for (the writer applies it only to live runs).
 */
export async function collectNativePregameInputs(args: {
  slateDate: string; gameId: number; inputCutoff: string; deadlineMs: number; seasonBootstrap?: boolean;
}): Promise<{ candidates: ForgeNativeCandidates; issuedContextAfter: ForgeIssuedContextV1 }> {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(args.slateDate) || !Number.isSafeInteger(args.gameId) || args.gameId <= 0
    || !Number.isFinite(args.deadlineMs)) {
    throw new Error("Invalid native input collection request");
  }
  parseInstantMicros(args.inputCutoff);
  if (Date.now() > args.deadlineMs) throw new Error("FORGE native input collection passed its deadline.");
  const before = await captureForgeIssuedContexts(args.slateDate, [args.gameId]);
  const { candidates } = await loadForgeNativeInputs(args.slateDate, {
    gameIds: [args.gameId], decisionAsOf: args.inputCutoff, deadlineMs: args.deadlineMs,
    seasonBootstrap: args.seasonBootstrap === true,
  });
  const after = await captureForgeIssuedContexts(args.slateDate, [args.gameId]);
  if (forgeIssuedContextsFingerprint(before) !== forgeIssuedContextsFingerprint(after)) {
    throw new Error("Issued FORGE schedule or roster context changed during calculation.");
  }
  return { candidates, issuedContextAfter: after[0] };
}
