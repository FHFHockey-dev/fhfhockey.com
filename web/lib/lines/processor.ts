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
import { fetchLineGames, latestLineGameStates } from "./service";
import { trustworthyState } from "./gameState";
import { instant, lineSnapshotFlags, unitKey, type LineClaim, type LineGame } from "./types";

const fxIds = (source: ParsedLinesCccSource) => {
  const fx = (source.rawPayload as { provider?: unknown; fx?: Record<string, unknown> } | undefined);
  return fx?.provider === "fxtwitter" ? [fx.fx?.id, fx.fx?.repost_wrapper_id].map((value) => value == null ? null : String(value)) : [];
};
import { evidenceKey } from "./reconcile";

/** Minimum time between NHL game-state observations of one game (equal to the trusted-state age, so a reused state stays trusted). */
export const LINE_OBSERVE_INTERVAL_MS = 5 * 60_000;
const DAY_MS = 86_400_000;
/** Games the processor reads per team: back far enough for PP carry-forward staleness (3 team games), forward for binding. */
const GAME_WINDOW = { backDays: 21, forwardDays: 3 };
const day = (now: string, offsetDays: number) => new Date(Date.parse(now) + offsetDays * DAY_MS).toISOString().slice(0, 10);

/**
 * Additive adapter: no mutation of the classifier's interpretation or forecast capture.
 * Load (production incident 2026-11-07): only teams with new evidence in this call are processed, never the scheduled
 * slate (`scheduledTeamIds` is accepted for the call sites and ignored); an empty call makes no database request. Reads are
 * bounded to a date window and to the latest state/decision rows; a game is observed at most every 5 minutes; a team is
 * reconciled only when this call stored a new claim for it or a freshly observed game changed phase.
 */
export async function processLineSnapshotEvidence(supabase: any, sources: ParsedLinesCccSource[], _scheduledTeamIds: number[], now = new Date().toISOString()) {
  const flags = lineSnapshotFlags();
  if (!flags.observations) return { enabled: false, claims: 0, reconciled: 0 };
  // Pure: a source without an accepted interpretation and team is no evidence and costs nothing.
  const candidates = sources.map((source) => ({ source, report: projectionReportFromSource(source) })).filter((value) => value.report != null && value.source.team != null);
  const teamIds = [...new Set(candidates.map(({ source }) => source.team!.id))];
  if (!teamIds.length) return { enabled: true, claims: 0, reconciled: 0 };
  let count = 0, reconciled = 0;
  // Reviewed trainer answer keys, read-only, keyed by any tweet id the source carries.
  const reviewed = await fetchReviewedDecisions(supabase, candidates.flatMap(({ source }) => [source.tweetId, source.quotedTweetId, ...fxIds(source)].filter((value): value is string => !!value)));
  for (const teamId of teamIds) {
    let games = await fetchLineGames(supabase, { teamId, dateFrom: day(now, -GAME_WINDOW.backDays), dateTo: day(now, GAME_WINDOW.forwardDays) });
    const near = games.filter((game) => Math.abs(Date.parse(`${game.date}T12:00:00Z`) - Date.parse(now)) < 2 * DAY_MS);
    const stored = await latestLineGameStates(supabase, near);
    // Reuse a stored state younger than the interval; otherwise observe the NHL feed once and store the new state.
    const fresh = (game: LineGame) => trustworthyState(game, now) && Date.parse(now) - (instant(game.observedAt) ?? -Infinity) < LINE_OBSERVE_INTERVAL_MS;
    const observed = await Promise.all(stored.filter((game) => !fresh(game)).map((game) => observeLineGame(game, now)));
    // A real transition (pregame -> live, live -> final) against the stored phase; a failed read ("unknown") is not one.
    const phaseChanged = new Set(observed.filter((game) => game.phase !== "unknown" && game.phase !== stored.find((previous) => previous.id === game.id)!.phase).map((game) => game.id));
    const states = new Map([...stored.filter(fresh), ...observed].map((game) => [game.id, game]));
    games = games.map((game) => states.get(game.id) ?? game);
    const relevant = candidates.filter(({ source }) => source.team!.id === teamId).map(({ source, report }) => ({ source, report: structuredClone(report) }));
    const ids = [...new Set(relevant.flatMap(({ report }) => report!.interpretation.units.flatMap((unit) => unit.players.map((player) => player.playerId))))];
    // Reviewed swap players by id; the raw tweet name must still resolve (approved alias for a misspelling).
    for (const decision of [...reviewed.values()].flat()) for (const swap of decision.swaps) for (const slot of [...swap.playersIn, ...swap.playersOut])
      if (slot.playerId != null && !ids.includes(slot.playerId)) ids.push(slot.playerId);
    const changes = relevant.flatMap(({ report }) => report!.interpretation.changes ?? []);
    for (const change of changes) for (const player of [...change.playersIn, ...change.playersOut]) if (!ids.includes(player.playerId)) ids.push(player.playerId);
    // Names the parser could not resolve can still match an approved alias, never a fuzzy guess.
    const unresolvedNames = [...new Set(changes.flatMap((change) => change.unresolved.map((item) => item.text)))];
    if (unresolvedNames.length) {
      const rows = await fetchAllSupabasePages<any>(({ from, to }) => supabase.from("lineup_player_name_aliases").select("alias,player_id").in("alias", unresolvedNames).order("player_id").order("alias").range(from, to));
      for (const row of rows) if (!ids.includes(row.player_id)) ids.push(row.player_id);
    }
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
      // First sighting by the poller is the ingestion clock when intake recorded it.
      const mapped = source.metadata?.sourceProvenance as { ingestedAt?: string; ingestedAtBasis?: string } | undefined;
      if (source.observedAt && mapped?.ingestedAtBasis === "first_seen_at" && instant(mapped.ingestedAt) != null && instant(mapped.ingestedAt)! <= (instant(report.receivedAt) ?? Infinity)) report.receivedAt = mapped.ingestedAt!;
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
      // Parser PP changes (Lane D): a swap on an explicitly numbered unit, unless a reviewed key already covers it.
      const lineupChanges = new Map<string, Omit<PPSwap, "unitNumber"> & { kind: NonNullable<LineClaim["lineupChange"]>["kind"] }>();
      if (!upstream) for (const change of report.interpretation.changes ?? []) {
        const side = (name: "in" | "out", resolved: typeof change.playersIn) => [...resolved.map((player) => ({ playerId: player.playerId, name: player.name, span: player.evidence })),
          ...change.unresolved.filter((item) => item.side === name).map((item) => ({ playerId: null, name: item.text, span: { start: item.start, end: item.end, text: item.text } }))]
          .sort((a, b) => (a.span?.start ?? 0) - (b.span?.start ?? 0));
        // Lineup changes: who is in and who is out, nothing more. The kind (IGA or entry) is the producer's phase decision.
        if (change.situation === "lineup" && change.kind !== "pp_replace") {
          const relationship = { kind: "substitution" as const, playerIds: [], situation: null, number: null, certainty: "reported" as const, evidence: change.evidence, reviewReason: "incomplete_replacement" as const };
          (report.interpretation.relationships ??= []).push(relationship);
          const key = relationshipClaimKey(relationship);
          (context.claimEvidence ??= {})[key] = produced.decide(key, null);
          lineupChanges.set(key, { kind: change.kind, playersIn: side("in", change.playersIn), playersOut: side("out", change.playersOut), source: `parser:${change.kind}` });
          continue;
        }
        const unitNumber = change.number;
        if (change.kind !== "pp_replace" || change.situation !== "pp" || !change.explicitNumber || (unitNumber !== 1 && unitNumber !== 2)) continue;
        if ([...swaps.values()].some((swap) => swap.unitNumber === unitNumber)) continue;
        const relationship = { kind: "substitution" as const, playerIds: [], situation: "pp" as const, number: unitNumber, certainty: "reported" as const, evidence: change.evidence, reviewReason: "incomplete_replacement" as const };
        (report.interpretation.relationships ??= []).push(relationship);
        const key = relationshipClaimKey(relationship);
        (context.claimEvidence ??= {})[key] = produced.decide(key, "pp");
        swaps.set(key, { unitNumber, playersIn: side("in", change.playersIn), playersOut: side("out", change.playersOut), source: `parser:${change.kind}` });
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
        const claim: LineClaim = { ...raw, context: upstream ? undefined : produced.contextDecision.context ?? undefined, contextEvidence: upstream ? undefined : produced.contextDecision.spans,
          authorityTier: produced.tier, originalAuthor: produced.attribution.originalAuthor, relayAccount: produced.attribution.relayAccount,
          reviewReasons: [...raw.reviewReasons, ...extraReasons.get(key) ?? [], ...(produced.tier === "excluded" ? ["author_excluded"] : [])] };
        if (decision?.context && !upstream) claim.context = decision.context;
        // A relay account is never the author, even internally (no original-author relation authority either).
        if (!upstream && produced.attribution.relayOnly) { claim.author = null; claim.certainty = claim.certainty === "confirmed" ? "reported" : claim.certainty; claim.confirmationEvidence = []; }
        if (claim.context === "practice" && claim.kind === "iga") claim.kind = "entry";
        if (!source.observedAt) claim.reviewReasons.push("ingestion_time_unresolved");
        if ((instant(claim.time.ingestedAt) ?? Infinity) > (instant(now) ?? -Infinity)) claim.reviewReasons.push("ingestion_not_yet_available");
        if ((instant(claim.time.interpretedAt) ?? Infinity) > (instant(now) ?? -Infinity)) claim.reviewReasons.push("interpretation_not_yet_available");
        const lineupChange = lineupChanges.get(key);
        if (lineupChange) {
          const players = [...lineupChange.playersIn, ...lineupChange.playersOut];
          const resolution = resolveEventUnit({ situation: "scratch", number: null, explicitNumber: false, complete: false, group: null,
            players: players.map((player) => ({ playerId: player.playerId ?? 0, name: player.name })), evidence: players.map((player) => player.span ?? { start: 0, end: 0, text: player.name }) },
          { teamId, effectiveAt: claim.time.effectiveAt, players: playerDirectory, memberships, aliases });
          const resolved = resolution.unit.players;
          const ids = (from: number, to: number) => resolved.slice(from, to).map((player) => player.playerId).filter((id) => id > 0);
          const playersIn = ids(0, lineupChange.playersIn.length), playersOut = ids(lineupChange.playersIn.length, players.length);
          claims.push({ ...claim, id: evidenceKey([claim.id, resolution, lineupChange]), identityStatus: resolution.reasons.length ? "unresolved" : "resolved_at_event", identityEvidence: resolution.evidence,
            relationship: claim.relationship ? { ...claim.relationship, playerIds: [...playersIn, ...playersOut] } : null,
            lineupChange: { kind: lineupChange.kind, playersIn, playersOut, source: lineupChange.source,
              names: Object.fromEntries(resolved.filter((player) => player.playerId > 0).map((player) => [String(player.playerId), player.name])) },
            reviewReasons: [...claim.reviewReasons.filter((reason) => reason !== "event_membership_unverified" && reason !== "incomplete_replacement"), ...resolution.reasons] });
          continue;
        }
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
      const targets = new Map([...await fetchLineClaims(supabase, [teamId], now, day(now, -GAME_WINDOW.backDays)), ...claims].map((claim) => [claim.id, claim]));
      for (const claim of claims) for (const id of [...claim.supersedes, ...claim.retracts]) {
        const target = targets.get(id);
        if (!target || target.teamId !== claim.teamId || target.gameId !== claim.gameId || id === claim.id) claim.reviewReasons.push(`relation_target_unresolved:${id}`);
      }
    }
    const { insertedClaims } = await appendLineEvidence(supabase, claims, observed);
    count += claims.length;
    for (const game of near.map((candidate) => states.get(candidate.id)!)) {
      if (!insertedClaims && !phaseChanged.has(game.id)) continue;
      await persistLineReconciliation(supabase, { game, teamId, games, now, carryForward: flags.carryForward, claimsSince: day(now, -GAME_WINDOW.backDays) });
      reconciled++;
    }
  }
  return { enabled: true, claims: count, reconciled };
}
