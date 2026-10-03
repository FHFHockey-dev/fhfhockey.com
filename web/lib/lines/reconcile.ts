import { createHash } from "node:crypto";
import { trustworthyState } from "./gameState";
import { instant, LINE_SELECTOR_VERSION, unitKey, type EntryRevision, type LineClaim, type LineConflict, type LineGame, type PPDecision, type SelectedLineUnit } from "./types";

export function evidenceKey(value: unknown): string { return createHash("sha256").update(JSON.stringify(value)).digest("hex"); }
const claimTime = (claim: LineClaim) => instant(claim.time.effectiveAt) ?? instant(claim.time.originalPublishedAt);
const signature = (claim: LineClaim) => claim.unit?.players.map((player) => player.playerId).sort((a, b) => a - b).join(",") ?? "";
const availableAt = (claim: LineClaim, now: string) => instant(now) != null
  && (instant(claim.time.ingestedAt) ?? Infinity) <= instant(now)!
  && (instant(claim.time.interpretedAt) ?? Infinity) <= instant(now)!
  && (instant(claim.time.originalPublishedAt) ?? Infinity) <= instant(now)!;

export function eligibleClaim(claim: LineClaim): boolean {
  return claim.accepted && claim.explicit && !claim.reviewReasons.length && claim.identityStatus === "resolved_at_event"
    && claim.binding.status === "bound" && claim.gameId != null && claimTime(claim) != null
    && instant(claim.time.ingestedAt) != null && instant(claim.time.interpretedAt) != null;
}

export function mayReplace(claim: LineClaim, target: LineClaim): boolean {
  return eligibleClaim(claim) && claim.teamId === target.teamId && claim.gameId === target.gameId
    && (claimTime(claim) ?? -Infinity) >= (claimTime(target) ?? Infinity)
    && (claim.relationAuthority === "reviewed" || claim.relationAuthority === "original_author" && !!claim.author && claim.author === target.author);
}

/** Keep relay/version history in storage; only one interpretation contributes per original unit. */
export function activeLineClaims(claims: LineClaim[]): LineClaim[] {
  const versions = new Map<string, LineClaim>();
  const originalsByRelay = new Map(claims.filter((claim) => claim.originalIdentity && claim.provenance?.relayTweetId)
    .map((claim) => [claim.provenance!.relayTweetId!, claim.originalIdentity!]));
  const identity = (claim: LineClaim) => claim.originalIdentity ?? originalsByRelay.get(claim.provenance?.relayTweetId ?? "") ?? claim.provenance?.relayTweetId ?? claim.captureId;
  for (const claim of [...claims].sort((a, b) => (instant(b.time.interpretedAt) ?? 0) - (instant(a.time.interpretedAt) ?? 0) || a.id.localeCompare(b.id))) {
    const key = `${claim.teamId}:${identity(claim)}:${claim.unit ? unitKey(claim.unit) : claim.relationship ? evidenceKey(claim.relationship) : claim.kind}`;
    if (!versions.has(key)) versions.set(key, claim);
  }
  const current = [...versions.values()];
  const inactive = new Set<string>();
  // Resolve targets against all retained versions; a correction cannot acquire relay authority.
  for (const claim of current) for (const targetId of [...claim.supersedes, ...claim.retracts]) {
    const target = claims.find((candidate) => candidate.id === targetId);
    if (target && mayReplace(claim, target)) {
      for (const candidate of current) if (candidate.id === targetId || candidate.teamId === target.teamId && candidate.gameId === target.gameId && identity(candidate) === identity(target) && candidate.unit && target.unit && unitKey(candidate.unit) === unitKey(target.unit)) inactive.add(candidate.id);
    }
  }
  return current.filter((claim) => !inactive.has(claim.id) && claim.kind !== "retraction");
}

function validUnitClaim(claim: LineClaim): boolean {
  return eligibleClaim(claim) && !!claim.unit && claim.unit.players.length > 0
    && claim.unit.players.every((player) => Number.isSafeInteger(player.playerId) && player.playerId > 0)
    && new Set(claim.unit.players.map((player) => player.playerId)).size === claim.unit.players.length;
}

const specificity = (claim: LineClaim) => claim.specificity === "warmup" ? 2 : claim.specificity === "game" ? 1 : 0;
function selectUnits(claims: LineClaim[], priority: (claim: LineClaim) => LineClaim = (claim) => claim): { units: SelectedLineUnit[]; conflicts: LineConflict[] } {
  const groups = new Map<string, LineClaim[]>();
  for (const claim of claims.filter(validUnitClaim)) {
    const key = unitKey(claim.unit!); groups.set(key, [...groups.get(key) ?? [], claim]);
  }
  const units: SelectedLineUnit[] = [], conflicts: LineConflict[] = [];
  for (const [key, candidates] of [...groups.entries()].sort(([a], [b]) => a.localeCompare(b))) {
    candidates.sort((a, b) => specificity(priority(b)) - specificity(priority(a)) || priority(b).authority - priority(a).authority || (claimTime(b) ?? 0) - (claimTime(a) ?? 0) || a.id.localeCompare(b.id));
    const best = candidates[0]!;
    const peers = candidates.filter((claim) => specificity(priority(claim)) === specificity(priority(best)) && priority(claim).authority === priority(best).authority);
    if (new Set(peers.map(signature)).size > 1) { conflicts.push({ unitKey: key, claimIds: peers.map((claim) => claim.id).sort(), reason: "Contradictory applicable reports require review" }); continue; }
    const designation = best.certainty === "confirmed" && best.confirmationEvidence.length ? "confirmed" : best.certainty === "projected" ? "projected" : "reported";
    units.push({ unit: best.unit!, claims: peers.filter((claim) => signature(claim) === signature(best)), designation, originGameId: best.gameId });
  }
  return { units, conflicts };
}

export function reconcileEntry(args: { game: LineGame; teamId: number; claims: LineClaim[]; previous: EntryRevision | null; now: string }): EntryRevision {
  const { game, teamId, previous, now } = args;
  const frozen = previous?.status === "frozen" || previous?.status === "corrected";
  const canFreeze = trustworthyState(game, now) && (game.phase === "live" || game.phase === "final" && instant(game.actualStart) != null);
  const cutoff = frozen ? previous!.cutoff : canFreeze ? game.actualStart ?? game.observedAt : null;
  const scoped = args.claims.filter((claim) => claim.gameId === game.id && claim.teamId === teamId && claim.binding.scheduleIdentity === game.scheduleIdentity);
  const active = activeLineClaims(scoped.filter((claim) => availableAt(claim, cutoff ?? now)));
  const candidates = active.filter((claim) => (claim.kind === "entry" || claim.kind === "pp" || claim.kind === "entry_correction" && claim.supersedes.some((id) => scoped.some((target) => target.id === id && mayReplace(claim, target)))) && claim.phase === "pregame"
    && (claim.time.effectiveUntil == null || (instant(claim.time.effectiveUntil) ?? -Infinity) > (instant(cutoff ?? now) ?? Infinity))
    && (cutoff == null || (claimTime(claim) ?? Infinity) <= instant(cutoff)! && (instant(claim.time.ingestedAt) ?? Infinity) <= instant(cutoff)! && (instant(claim.time.interpretedAt) ?? Infinity) <= instant(cutoff)!));
  let selected = selectUnits(candidates);
  let correctionClaimIds: string[] = [];
  let evidenceClaims = candidates;
  let reason = canFreeze ? `Entry frozen at ${game.actualStart ? "actual start" : "first observed live transition"}` : "Applicable pregame evidence";
  if (frozen) {
    // Older snapshots retain selected claims and conflict IDs. Only those known IDs may
    // be recovered; a normal late claim is never admitted into the frozen evidence set.
    const retainedIds = new Set([...previous!.units.flatMap((unit) => unit.claims.map((claim) => claim.id)),
      ...previous!.conflicts.flatMap((conflict) => conflict.claimIds), ...previous!.correctionClaimIds]);
    const retained = previous!.evidenceClaims ?? [...previous!.units.flatMap((unit) => unit.claims), ...scoped.filter((claim) => retainedIds.has(claim.id))];
    const known = new Map(retained.map((claim) => [claim.id, claim]));
    const pending = scoped.filter((claim) => !known.has(claim.id) && availableAt(claim, now) && (claimTime(claim) ?? Infinity) <= (instant(now) ?? -Infinity)
      && (claim.kind === "retraction" && eligibleClaim(claim) || claim.kind === "entry_correction" && validUnitClaim(claim) && claim.phase === "pregame"))
      .sort((a, b) => (instant(a.time.interpretedAt) ?? 0) - (instant(b.time.interpretedAt) ?? 0) || a.id.localeCompare(b.id));
    const changes: LineClaim[] = [];
    for (let pass = 0; pass < pending.length; pass++) {
      let added = false;
      for (const claim of pending) {
        if (known.has(claim.id)) continue;
        const ids = claim.kind === "retraction" ? claim.retracts : claim.supersedes;
        if (!ids.length || !ids.every((id) => {
          const target = known.get(id);
          return target && mayReplace(claim, target) && (claim.kind === "retraction" || target.unit && unitKey(target.unit) === unitKey(claim.unit!));
        })) continue;
        known.set(claim.id, claim); changes.push(claim); added = true;
      }
      if (!added) break;
    }
    if (!changes.length) return previous!;
    evidenceClaims = [...known.values()].sort((a, b) => a.id.localeCompare(b.id));
    // A correction replaces its targets' place in the frozen selection. Its own
    // ranking cannot silently resolve an opposing claim it did not supersede.
    const priority = (claim: LineClaim, seen = new Set<string>()): LineClaim => {
      if (claim.kind !== "entry_correction" || seen.has(claim.id)) return claim;
      const visited = new Set([...seen, claim.id]);
      const targets = claim.supersedes.flatMap((id) => known.has(id) ? [priority(known.get(id)!, visited)] : []);
      return targets.sort((a, b) => specificity(b) - specificity(a) || b.authority - a.authority || a.id.localeCompare(b.id))[0] ?? claim;
    };
    selected = selectUnits(activeLineClaims(evidenceClaims), priority);
    correctionClaimIds = [...previous!.correctionClaimIds, ...changes.map((claim) => claim.id)].sort();
    reason = changes.some((claim) => claim.kind === "retraction") ? "Entry evidence retracted" : "Entry lineup corrected";
  }
  const status = frozen ? "corrected" : canFreeze ? "frozen" : "expected";
  const fingerprint = evidenceKey([game.id, teamId, status, cutoff, selected, correctionClaimIds, LINE_SELECTOR_VERSION]);
  if (previous && evidenceKey([game.id, teamId, previous.status, previous.cutoff, { units: previous.units, conflicts: previous.conflicts }, previous.correctionClaimIds, previous.selectorVersion]) === fingerprint) return previous;
  return { id: evidenceKey([fingerprint, previous?.id ?? null]), gameId: game.id, teamId, revision: (previous?.revision ?? 0) + 1, previousId: previous?.id ?? null,
    status, ...selected, cutoff, frozenState: frozen ? previous!.frozenState : canFreeze ? game : null,
    selectorVersion: LINE_SELECTOR_VERSION, createdAt: now, reason, correctionClaimIds, evidenceClaims };
}

export function reconcilePP(args: { game: LineGame; teamId: number; games: LineGame[]; claims: LineClaim[]; previous?: PPDecision[]; now: string; carryForward: boolean }): PPDecision[] {
  const { game, teamId, now } = args;
  const games = new Map(args.games.map((candidate) => [candidate.id, candidate]));
  const active = activeLineClaims(args.claims.filter((claim) => claim.teamId === teamId && availableAt(claim, now)
    && (claim.gameId === game.id && claim.phase === "pregame" && claim.kind !== "retraction" || (claimTime(claim) ?? Infinity) <= (instant(now) ?? -Infinity))))
    .filter((claim) => validUnitClaim(claim) && claim.kind === "pp"
    && claim.unit!.situation === "pp" && claim.unit!.explicitNumber && [1, 2].includes(claim.unit!.number ?? 0)
    && claim.unit!.complete && claim.unit!.players.length === 5 && claim.unit!.group == null && games.get(claim.gameId!)?.scheduleIdentity === claim.binding.scheduleIdentity
    && availableAt(claim, now) && (claim.time.effectiveUntil == null || (instant(claim.time.effectiveUntil) ?? -Infinity) > instant(now)!)
    && (claim.gameId === game.id && claim.phase === "pregame" || (claimTime(claim) ?? Infinity) <= instant(now)!));
  return [1, 2].map((number) => {
    const current = active.filter((claim) => claim.gameId === game.id && claim.unit!.number === number && ["pregame", "in_game"].includes(claim.phase));
    const carried = args.carryForward ? active.filter((claim) => claim.unit!.number === number && claim.gameId !== game.id && claim.phase === "in_game"
      && !!games.get(claim.gameId!) && games.get(claim.gameId!)!.date < game.date) : [];
    carried.sort((a, b) => games.get(b.gameId!)!.date.localeCompare(games.get(a.gameId!)!.date) || (claimTime(b) ?? 0) - (claimTime(a) ?? 0));
    const origin = carried[0]?.gameId;
    const selected = selectUnits(current.length ? current : carried.filter((claim) => claim.gameId === origin));
    let selection = selected.units[0] ?? null;
    if (selection && !current.length) selection = { ...selection, designation: "carried" };
    const conflict = selected.conflicts[0] ?? null;
    const previous = args.previous?.find((decision) => decision.unitNumber === number);
    const fingerprint = evidenceKey([game.id, teamId, number, selection, conflict, LINE_SELECTOR_VERSION]);
    if (previous && evidenceKey([game.id, teamId, number, previous.selection, previous.conflict, previous.selectorVersion]) === fingerprint) return previous;
    const id = evidenceKey([fingerprint, previous?.id ?? null]);
    return { id, revision: (previous?.revision ?? 0) + 1, gameId: game.id, teamId, unitNumber: number, selection, conflict, replacesId: previous?.id ?? null,
      reason: conflict ? "Conflicting PP evidence" : current.length ? "Applicable game-specific PP evidence" : selection ? "Carried forward from accepted in-game PP evidence" : "No applicable PP evidence",
      decidedAt: now, selectorVersion: LINE_SELECTOR_VERSION };
  });
}
