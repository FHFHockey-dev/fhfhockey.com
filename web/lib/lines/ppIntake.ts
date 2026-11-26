import { readOfficialPowerPlayEvidence, type OfficialPowerPlayEvidence } from "./officialPowerPlay";
import { readPenaltyClue } from "./ppClue";
import { corroborateInGamePP, qualifiesForPPCorroboration } from "./ppCorroboration";
import { evidenceKey, isBindingUpgrade } from "./reconcile";
import { fetchLineClaims } from "./storage";
import { instant, LINE_SELECTOR_VERSION, type LineClaim, type LineGame } from "./types";

const BINDING_REASONS = new Set(["no_game_binding_evidence", "binding_decision_unverified"]);
const HOUR_MS = 3_600_000;
/** A game is read only when some target's publication time could fall inside it (from 1 h before its start to 6 h after). */
const couldContain = (game: LineGame, published: number[]) => {
  const start = instant(game.actualStart) ?? instant(game.scheduledStart);
  return start == null || published.some((at) => at >= start - HOUR_MS && at <= start + 6 * HOUR_MS);
};

/**
 * PPCF P1, at intake. A qualifying in-game PP claim is corroborated against the official reports of the team's already-observed
 * games whose window could contain its publication time (one read per game per call, shared cache). A penalty clue is optional.
 * A claim with no stated session context that binds takes the in-game phase from timing (TJ 2026-11-25). Unresolved results leave the claim
 * as it was; pending results add `nhl_corroboration_pending`; bound results bind it. `nhl_verified_at` is metadata appended
 * after the claim ID is computed from the stable result.
 */
export async function bindInGamePPClaims(supabase: any, claims: LineClaim[], args: { teamId: number; observed: LineGame[]; now: string; since: string;
  read?: (game: LineGame) => Promise<OfficialPowerPlayEvidence | null> }): Promise<LineClaim[]> {
  const read = args.read ?? readOfficialPowerPlayEvidence;
  const targets = claims.map((claim, index) => ({ claim, index })).filter(({ claim }) => qualifiesForPPCorroboration(claim));
  if (!targets.length) return claims;
  const games = args.observed.filter((game) => [game.homeTeamId, game.awayTeamId].includes(args.teamId) && (game.phase === "live" || game.phase === "final" || game.actualStart != null));
  const published = targets.map(({ claim }) => instant(claim.time.originalPublishedAt)!);
  const evidence = new Map<number, OfficialPowerPlayEvidence | null>();
  for (const game of games) if (couldContain(game, published)) evidence.set(game.id, await read(game));
  const output = [...claims];
  let stored: LineClaim[] | null = null;
  for (const { claim, index } of targets) {
    const result = corroborateInGamePP(claim, games, (id) => evidence.get(id) ?? null, (id) => readPenaltyClue(claim.text, evidence.get(id)?.roster ?? []));
    if (result.status === "unresolved") continue;
    // The ID covers only the stable result; metadata (the period window, which closes as the report fills in) is stored after it.
    const { metadata, ...stable } = result.status === "bound" ? result : { ...result, metadata: undefined };
    const id = evidenceKey([claim.id, stable]);
    if (result.status !== "bound") {
      output[index] = { ...claim, id, reviewReasons: [...new Set([...claim.reviewReasons, "nhl_corroboration_pending"])] };
      continue;
    }
    const timed = claim.phase === "unknown";
    const bound: LineClaim = { ...claim, id, gameId: result.gameId, explicit: true,
      ...timed ? { phase: "in_game" as const, context: "game" as const, specificity: "game" as const } : {},
      binding: { status: "bound", evidence: [...result.evidence, ...metadata ?? [], ...timed ? ["session_context:in_game_by_time"] : [], `nhl_verified_at:${args.now}`],
        resolverVersion: LINE_SELECTOR_VERSION, scheduleIdentity: result.scheduleIdentity },
      reviewReasons: claim.reviewReasons.filter((reason) => !BINDING_REASONS.has(reason) && !(timed && reason === "claim_phase_unresolved")) };
    // An earlier unbound or pending reading of the same original is superseded by the bound one (see activeLineClaims).
    stored ??= await fetchLineClaims(supabase, [args.teamId], args.now, args.since);
    const sameOriginal = (other: LineClaim) => other.captureId === claim.captureId || !!claim.originalIdentity && other.originalIdentity === claim.originalIdentity;
    bound.supersedes = [...new Set([...claim.supersedes, ...stored.filter((other) => other.id !== id && sameOriginal(other) && isBindingUpgrade(bound, other)).map((other) => other.id)])].sort();
    output[index] = bound;
  }
  return output;
}
