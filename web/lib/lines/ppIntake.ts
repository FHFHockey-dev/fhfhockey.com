import { readOfficialPowerPlayEvidence, type OfficialPowerPlayEvidence } from "./officialPowerPlay";
import { hasPenaltyCuePhrase, readPenaltyClue } from "./ppClue";
import { corroborateInGamePP, qualifiesForPPCorroboration } from "./ppCorroboration";
import { evidenceKey, isBindingUpgrade } from "./reconcile";
import { fetchLineClaims } from "./storage";
import { LINE_SELECTOR_VERSION, type LineClaim, type LineGame } from "./types";

const BINDING_REASONS = new Set(["no_game_binding_evidence", "binding_decision_unverified"]);

/**
 * PPCF P1, at intake. A qualifying in-game PP claim whose original carries a penalty cue is corroborated against the official
 * reports of the team's already-observed games (one read per game per call, shared cache). Unresolved results leave the claim
 * as it was; pending results add `nhl_corroboration_pending`; bound results bind it. `nhl_verified_at` is metadata appended
 * after the claim ID is computed from the stable result.
 */
export async function bindInGamePPClaims(supabase: any, claims: LineClaim[], args: { teamId: number; observed: LineGame[]; now: string; since: string;
  read?: (game: LineGame) => Promise<OfficialPowerPlayEvidence | null> }): Promise<LineClaim[]> {
  const read = args.read ?? readOfficialPowerPlayEvidence;
  const targets = claims.map((claim, index) => ({ claim, index })).filter(({ claim }) => qualifiesForPPCorroboration(claim) && hasPenaltyCuePhrase(claim.text));
  if (!targets.length) return claims;
  const games = args.observed.filter((game) => [game.homeTeamId, game.awayTeamId].includes(args.teamId) && (game.phase === "live" || game.phase === "final" || game.actualStart != null));
  const evidence = new Map<number, OfficialPowerPlayEvidence | null>();
  for (const game of games) evidence.set(game.id, await read(game));
  const output = [...claims];
  let stored: LineClaim[] | null = null;
  for (const { claim, index } of targets) {
    const result = corroborateInGamePP(claim, games, (id) => evidence.get(id) ?? null, (id) => readPenaltyClue(claim.text, evidence.get(id)?.roster ?? []));
    if (result.status === "unresolved") continue;
    const id = evidenceKey([claim.id, result]);
    if (result.status !== "bound") {
      output[index] = { ...claim, id, reviewReasons: [...new Set([...claim.reviewReasons, "nhl_corroboration_pending"])] };
      continue;
    }
    const bound: LineClaim = { ...claim, id, gameId: result.gameId, explicit: true,
      binding: { status: "bound", evidence: [...result.evidence, `nhl_verified_at:${args.now}`], resolverVersion: LINE_SELECTOR_VERSION, scheduleIdentity: result.scheduleIdentity },
      reviewReasons: claim.reviewReasons.filter((reason) => !BINDING_REASONS.has(reason)) };
    // An earlier unbound or pending reading of the same original is superseded by the bound one (see activeLineClaims).
    stored ??= await fetchLineClaims(supabase, [args.teamId], args.now, args.since);
    const sameOriginal = (other: LineClaim) => other.captureId === claim.captureId || !!claim.originalIdentity && other.originalIdentity === claim.originalIdentity;
    bound.supersedes = [...new Set([...claim.supersedes, ...stored.filter((other) => other.id !== id && sameOriginal(other) && isBindingUpgrade(bound, other)).map((other) => other.id)])].sort();
    output[index] = bound;
  }
  return output;
}
