import { fetchAllSupabasePages } from "lib/supabase/pagination";
import type { ParsedLinesCccSource } from "lib/sources/linesCccIngestion";
import { projectionReportFromSource } from "lib/sources/tweetProjectionStorage";
import type { PlayerIdentity } from "lib/sources/playerIdentity";
import { observeLineGame } from "./gameState";
import { resolveEventUnit, type ApprovedEventAlias, type EventMembership } from "./identity";
import { claimsFromReport, relationshipClaimKey, type LineEvidenceContext } from "./sourceClaims";
import { produceLineEvidence, type PPSwap } from "./decisions";
import { fetchReviewedDecisions, matchingDecision, reviewedSwaps, reviewUnit } from "./trainerDecisions";
import { appendLineEvidence, fetchLineClaims, persistLineReconciliation } from "./storage";
import { fetchLineGames, hydrateLineGameStates } from "./service";
import { instant, lineSnapshotFlags, unitKey, type LineClaim } from "./types";

const fxIds = (source: ParsedLinesCccSource) => {
  const fx = (source.rawPayload as { provider?: unknown; fx?: Record<string, unknown> } | undefined);
  return fx?.provider === "fxtwitter" ? [fx.fx?.id, fx.fx?.repost_wrapper_id].map((value) => value == null ? null : String(value)) : [];
};
import { evidenceKey } from "./reconcile";

/** Additive adapter: no mutation of the classifier's interpretation or forecast capture. */
export async function processLineSnapshotEvidence(supabase: any, sources: ParsedLinesCccSource[], scheduledTeamIds: number[], now = new Date().toISOString()) {
  const flags = lineSnapshotFlags();
  if (!flags.observations) return { enabled: false, claims: 0, reconciled: 0 };
  const teamIds = [...new Set([...scheduledTeamIds, ...sources.flatMap((source) => source.team ? [source.team.id] : [])])];
  let count = 0, reconciled = 0;
  // Reviewed trainer answer keys, read-only, keyed by any tweet id the source carries.
  const reviewed = sources.length ? await fetchReviewedDecisions(supabase, sources.flatMap((source) => [source.tweetId, source.quotedTweetId, ...fxIds(source)].filter((value): value is string => !!value))) : new Map();
  for (const teamId of teamIds) {
    let games = await hydrateLineGameStates(supabase, await fetchLineGames(supabase, { teamId }), now);
    const near = games.filter((game) => Math.abs(Date.parse(`${game.date}T12:00:00Z`) - Date.parse(now)) < 2 * 86400000);
    const observed = await Promise.all(near.map((game) => observeLineGame(game, now)));
    const states = new Map(observed.map((game) => [game.id, game]));
    games = games.map((game) => states.get(game.id) ?? game);
    const relevant = sources.filter((source) => source.team?.id === teamId).map((source) => ({ source, report: projectionReportFromSource(source) })).filter((value) => value.report != null);
    const ids = [...new Set(relevant.flatMap(({ report }) => report!.interpretation.units.flatMap((unit) => unit.players.map((player) => player.playerId))))];
    // Reviewed swap players by id; the raw tweet name must still resolve (approved alias for a misspelling).
    for (const decision of [...reviewed.values()].flat()) for (const swap of decision.swaps) for (const slot of [...swap.playersIn, ...swap.playersOut])
      if (slot.playerId != null && !ids.includes(slot.playerId)) ids.push(slot.playerId);
    let playerDirectory: PlayerIdentity[] = [], memberships: EventMembership[] = [], aliases: ApprovedEventAlias[] = [];
    if (ids.length) {
      const [rosters, directory, approved] = await Promise.all([
        fetchAllSupabasePages<any>(({ from, to }) => supabase.from("rosters").select("playerId,teamId,created_at,ended_at").in("playerId", ids).order("playerId").order("teamId").order("created_at").range(from, to)),
        fetchAllSupabasePages<any>(({ from, to }) => supabase.from("players").select("id,fullName,lastName,position").in("id", ids).order("id").range(from, to)),
        fetchAllSupabasePages<any>(({ from, to }) => supabase.from("lineup_player_name_aliases").select("alias,player_id,created_at").in("player_id", ids).order("player_id").order("alias").range(from, to)),
      ]);
      playerDirectory = directory.map((row) => ({ playerId: row.id, fullName: row.fullName, lastName: row.lastName, position: row.position }));
      memberships = rosters.map((row) => ({ playerId: row.playerId, teamId: row.teamId, from: row.created_at, until: row.ended_at, evidenceId: `roster:${row.playerId}:${row.teamId}:${row.created_at}:${row.ended_at ?? "open"}` }));
      aliases = approved.map((row) => ({ raw: row.alias, playerId: row.player_id, approvedAt: row.created_at, evidenceId: `approved_alias:${row.player_id}:${row.alias}:${row.created_at}` }));
    }
    const claims: LineClaim[] = [];
    for (const { source, report: candidate } of relevant) {
      const report = candidate!;
      // Existing projection compatibility fallbacks must not manufacture ingestion evidence.
      if (!source.observedAt) report.receivedAt = "";
      const upstream = source.metadata?.lineEvidence as LineEvidenceContext | undefined;
      let produced = produceLineEvidence(source, report, games);
      if (!produced.attribution.evidence.includes("direct_post")) {
        // Relay-shaped captures: key the original, never the relaying account's post.
        const { originalTweetId, relayTweetId, originalAuthor } = produced.attribution;
        report.provenance = { relayTweetId, originalTweetId, attributionStatus: originalTweetId && originalAuthor ? "resolved" : "pending" };
        produced = produceLineEvidence(source, report, games);
      }
      const context: LineEvidenceContext = structuredClone(upstream ?? produced.context);
      const extraReasons = new Map<string, string[]>();
      const swaps = new Map<string, PPSwap>();
      const decision = upstream ? null : matchingDecision([source.tweetId, source.quotedTweetId, ...fxIds(source)].flatMap((id) => id ? reviewed.get(id) ?? [] : []),
        [report.text, source.rawText, source.enrichedText, source.quotedRawText]);
      if (decision) {
        const reference = `trainer:${decision.reviewItemId}:${decision.textSha256}`;
        const whole = [{ start: 0, end: report.text.length, text: report.text }];
        for (const [key, value] of Object.entries(context.claimEvidence ?? {})) {
          value.decisionEvidence?.sourceReferences.push(reference);
          if (decision.context) {
            value.specificity = decision.context === "warmup" ? "warmup" : decision.context === "game" ? "game" : "practice";
            if (value.phase === "unknown" || decision.context !== "game") value.phase = "pregame";
            if (value.kind === "iga" && value.phase !== "in_game") value.kind = "entry";
            if (value.decisionEvidence && !value.decisionEvidence.phase.length) value.decisionEvidence.phase = whole;
          }
          if (decision.binding && value.decisionEvidence) {
            Object.assign(value, { gameId: decision.binding.gameId ?? undefined, opponentId: decision.binding.opponentId ?? undefined, date: decision.binding.date ?? undefined, relative: undefined, timezone: undefined });
            value.decisionEvidence.binding = whole;
          }
          const unit = report.interpretation.units.find((candidate) => unitKey(candidate) === key);
          const review = unit ? reviewUnit(decision, unit) : null;
          if (review && "authority" in review) value.relationAuthority = "reviewed";
          else if (review) extraReasons.set(key, [review.reason]);
        }
        for (const swap of reviewedSwaps(decision, report.text)) {
          let relationship = report.interpretation.relationships?.find((item) => item.situation === "pp" && item.number === swap.unitNumber && item.kind === "substitution");
          if (!relationship) {
            const first = [...swap.playersIn, ...swap.playersOut].find((player) => player.span)?.span ?? whole[0]!;
            relationship = { kind: "substitution", playerIds: [], situation: "pp", number: swap.unitNumber, certainty: "reported", evidence: first, reviewReason: "incomplete_replacement" };
            (report.interpretation.relationships ??= []).push(relationship);
          }
          const key = relationshipClaimKey(relationship);
          const decided = produced.decide(key, "pp");
          decided.decisionEvidence?.sourceReferences.push(reference);
          if (decision.context && decided.decisionEvidence) { decided.specificity = decision.context === "warmup" ? "warmup" : decision.context === "game" ? "game" : "practice"; decided.phase = "pregame"; if (!decided.decisionEvidence.phase.length) decided.decisionEvidence.phase = whole; }
          if (decision.binding && decided.decisionEvidence) { Object.assign(decided, { gameId: decision.binding.gameId ?? undefined, opponentId: decision.binding.opponentId ?? undefined, date: decision.binding.date ?? undefined, relative: undefined, timezone: undefined }); decided.decisionEvidence.binding = whole; }
          (context.claimEvidence ??= {})[key] = { ...decided, relationAuthority: "reviewed" };
          swaps.set(key, swap);
        }
      }
      // Binding, phase and primary-original clock attestations must be supplied by
      // the producer per claim. Whole-post words and legacy assigned IDs are not defaults.
      const trustedPublication = ["provider_timestamp", "x_api_timestamp", "x_api"].includes(String(source.metadata?.publicationTimeBasis ?? ""));
      if (!trustedPublication) {
        context.publication = undefined;
        if (context.claimEvidence) for (const value of Object.values(context.claimEvidence)) value.publication = undefined;
      }
      const derived = claimsFromReport(report, games, { ...context, identityStatus: "unresolved", identityEvidence: [] });
      for (const raw of derived) {
        const key = raw.unit ? unitKey(raw.unit) : raw.relationship ? relationshipClaimKey(raw.relationship as never) : "";
        const claim: LineClaim = { ...raw, context: upstream ? undefined : produced.contextDecision.context, contextEvidence: upstream ? undefined : produced.contextDecision.spans,
          authorityTier: produced.tier, originalAuthor: produced.attribution.originalAuthor, relayAccount: produced.attribution.relayAccount,
          reviewReasons: [...raw.reviewReasons, ...extraReasons.get(key) ?? [], ...(produced.tier === "excluded" ? ["author_excluded"] : [])] };
        if (decision?.context && !upstream) claim.context = decision.context;
        if (claim.context === "practice" && claim.kind === "iga") claim.kind = "entry";
        if (!source.observedAt) claim.reviewReasons.push("ingestion_time_unresolved");
        if ((instant(claim.time.ingestedAt) ?? Infinity) > (instant(now) ?? -Infinity)) claim.reviewReasons.push("ingestion_not_yet_available");
        if ((instant(claim.time.interpretedAt) ?? Infinity) > (instant(now) ?? -Infinity)) claim.reviewReasons.push("interpretation_not_yet_available");
        const swap = swaps.get(key);
        if (swap) {
          const players = [...swap.playersIn, ...swap.playersOut];
          const missing = players.filter((player) => !player.span).map((player) => `identity:${player.name}:not_in_text`);
          const resolution = resolveEventUnit({ situation: "pp", number: swap.unitNumber, explicitNumber: true, complete: false, group: null,
            players: players.map((player) => ({ playerId: player.playerId ?? 0, name: player.name })), evidence: players.map((player) => player.span ?? { start: 0, end: 0, text: player.name }) },
          { teamId, effectiveAt: claim.time.effectiveAt, players: playerDirectory, memberships, aliases });
          const reasons = [...missing, ...resolution.reasons];
          const resolvedIds = resolution.unit.players.map((player) => player.playerId);
          claims.push({ ...claim, id: evidenceKey([claim.id, resolution, swap]), identityStatus: reasons.length ? "unresolved" : "resolved_at_event", identityEvidence: resolution.evidence,
            ppSwap: { unitNumber: swap.unitNumber, playersIn: resolvedIds.slice(0, swap.playersIn.length), playersOut: resolvedIds.slice(swap.playersIn.length), source: swap.source,
              names: Object.fromEntries(resolution.unit.players.map((player) => [String(player.playerId), player.name])) },
            reviewReasons: [...claim.reviewReasons.filter((reason) => reason !== "event_membership_unverified" && reason !== "incomplete_replacement"), ...reasons] });
          continue;
        }
        if (!claim.unit) {
          if (claim.kind === "retraction" && claim.relationAuthority !== "none") {
            claim.identityStatus = "resolved_at_event";
            claim.reviewReasons = claim.reviewReasons.filter((reason) => reason !== "event_membership_unverified");
          }
          claims.push(claim); continue;
        }
        const resolution = resolveEventUnit(claim.unit, { teamId, effectiveAt: claim.time.effectiveAt, players: playerDirectory, memberships, aliases });
        claims.push({ ...claim, id: evidenceKey([claim.id, resolution]), unit: resolution.unit, identityStatus: resolution.reasons.length ? "unresolved" : "resolved_at_event", identityEvidence: resolution.evidence,
          reviewReasons: [...claim.reviewReasons.filter((reason) => reason !== "event_membership_unverified"), ...resolution.reasons] });
      }
    }
    if (claims.some((claim) => claim.supersedes.length || claim.retracts.length)) {
      const targets = new Map([...await fetchLineClaims(supabase, [teamId], now), ...claims].map((claim) => [claim.id, claim]));
      for (const claim of claims) for (const id of [...claim.supersedes, ...claim.retracts]) {
        const target = targets.get(id);
        if (!target || target.teamId !== claim.teamId || target.gameId !== claim.gameId || id === claim.id) claim.reviewReasons.push(`relation_target_unresolved:${id}`);
      }
    }
    await appendLineEvidence(supabase, claims, observed);
    count += claims.length;
    for (const game of observed) {
      await persistLineReconciliation(supabase, { game, teamId, games, now, carryForward: flags.carryForward });
      reconciled++;
    }
  }
  return { enabled: true, claims: count, reconciled };
}
