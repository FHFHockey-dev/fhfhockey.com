import { fetchAllSupabasePages } from "lib/supabase/pagination";
import type { ParsedLinesCccSource } from "lib/sources/linesCccIngestion";
import { projectionReportFromSource } from "lib/sources/tweetProjectionStorage";
import type { PlayerIdentity } from "lib/sources/playerIdentity";
import { observeLineGame } from "./gameState";
import { resolveEventUnit, type ApprovedEventAlias, type EventMembership } from "./identity";
import { claimsFromReport, type LineEvidenceContext } from "./sourceClaims";
import { appendLineEvidence, fetchLineClaims, persistLineReconciliation } from "./storage";
import { fetchLineGames, hydrateLineGameStates } from "./service";
import { instant, lineSnapshotFlags, type LineClaim } from "./types";
import { evidenceKey } from "./reconcile";

/** Additive adapter: no mutation of the classifier's interpretation or forecast capture. */
export async function processLineSnapshotEvidence(supabase: any, sources: ParsedLinesCccSource[], scheduledTeamIds: number[], now = new Date().toISOString()) {
  const flags = lineSnapshotFlags();
  if (!flags.observations) return { enabled: false, claims: 0, reconciled: 0 };
  const teamIds = [...new Set([...scheduledTeamIds, ...sources.flatMap((source) => source.team ? [source.team.id] : [])])];
  let count = 0, reconciled = 0;
  for (const teamId of teamIds) {
    let games = await hydrateLineGameStates(supabase, await fetchLineGames(supabase, { teamId }), now);
    const near = games.filter((game) => Math.abs(Date.parse(`${game.date}T12:00:00Z`) - Date.parse(now)) < 2 * 86400000);
    const observed = await Promise.all(near.map((game) => observeLineGame(game, now)));
    const states = new Map(observed.map((game) => [game.id, game]));
    games = games.map((game) => states.get(game.id) ?? game);
    const relevant = sources.filter((source) => source.team?.id === teamId).map((source) => ({ source, report: projectionReportFromSource(source) })).filter((value) => value.report != null);
    const ids = [...new Set(relevant.flatMap(({ report }) => report!.interpretation.units.flatMap((unit) => unit.players.map((player) => player.playerId))))];
    let players: PlayerIdentity[] = [], memberships: EventMembership[] = [], aliases: ApprovedEventAlias[] = [];
    if (ids.length) {
      const [rosters, directory, approved] = await Promise.all([
        fetchAllSupabasePages<any>(({ from, to }) => supabase.from("rosters").select("playerId,teamId,created_at,ended_at").in("playerId", ids).order("playerId").order("teamId").order("created_at").range(from, to)),
        fetchAllSupabasePages<any>(({ from, to }) => supabase.from("players").select("id,fullName,lastName,position").in("id", ids).order("id").range(from, to)),
        fetchAllSupabasePages<any>(({ from, to }) => supabase.from("lineup_player_name_aliases").select("alias,player_id,created_at").in("player_id", ids).order("player_id").order("alias").range(from, to)),
      ]);
      players = directory.map((row) => ({ playerId: row.id, fullName: row.fullName, lastName: row.lastName, position: row.position }));
      memberships = rosters.map((row) => ({ playerId: row.playerId, teamId: row.teamId, from: row.created_at, until: row.ended_at, evidenceId: `roster:${row.playerId}:${row.teamId}:${row.created_at}:${row.ended_at ?? "open"}` }));
      aliases = approved.map((row) => ({ raw: row.alias, playerId: row.player_id, approvedAt: row.created_at, evidenceId: `approved_alias:${row.player_id}:${row.alias}:${row.created_at}` }));
    }
    const claims: LineClaim[] = [];
    for (const { source, report: candidate } of relevant) {
      const report = candidate!;
      // Existing projection compatibility fallbacks must not manufacture ingestion evidence.
      if (!source.observedAt) report.receivedAt = "";
      const context: LineEvidenceContext = structuredClone(source.metadata?.lineEvidence as LineEvidenceContext ?? {});
      // Binding, phase and primary-original clock attestations must be supplied by
      // the producer per claim. Whole-post words and legacy assigned IDs are not defaults.
      const trustedPublication = ["provider_timestamp", "x_api_timestamp", "x_api"].includes(String(source.metadata?.publicationTimeBasis ?? ""));
      if (!trustedPublication) {
        context.publication = undefined;
        if (context.claimEvidence) for (const decision of Object.values(context.claimEvidence)) decision.publication = undefined;
      }
      const derived = claimsFromReport(report, games, { ...context, identityStatus: "unresolved", identityEvidence: [] });
      for (const claim of derived) {
        if (!source.observedAt) claim.reviewReasons.push("ingestion_time_unresolved");
        if ((instant(claim.time.ingestedAt) ?? Infinity) > (instant(now) ?? -Infinity)) claim.reviewReasons.push("ingestion_not_yet_available");
        if ((instant(claim.time.interpretedAt) ?? Infinity) > (instant(now) ?? -Infinity)) claim.reviewReasons.push("interpretation_not_yet_available");
        if (!claim.unit) {
          if (claim.kind === "retraction" && claim.relationAuthority !== "none") {
            claim.identityStatus = "resolved_at_event";
            claim.reviewReasons = claim.reviewReasons.filter((reason) => reason !== "event_membership_unverified");
          }
          claims.push(claim); continue;
        }
        const resolution = resolveEventUnit(claim.unit, { teamId, effectiveAt: claim.time.effectiveAt, players, memberships, aliases });
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
