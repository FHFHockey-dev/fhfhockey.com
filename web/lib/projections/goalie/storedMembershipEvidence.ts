import { z } from "zod";
import type { MembershipEvent } from "./membershipLineage";
import { timestampMicros } from "../evidenceTime";

const id = z.number().int().positive().safe(), text = z.string().trim().min(1);
const time = z.string().datetime({ offset: true }).refine(value => timestampMicros(value) !== null, "Invalid evidence clock");
const clock = (value: string) => timestampMicros(value)!;
const hash = z.string().regex(/^[a-f0-9]{64}$/);
/** Bounded projection of the existing season-roster observations table; no database client. */
const observation = z.object({
  id: text, season_id: id, fhfh_player_id: id.nullable(), nhl_player_id: id.nullable(),
  observation_kind: z.enum(["official_roster", "player_landing", "official_transaction", "trusted_ifttt"]),
  event_type: z.enum(["membership", "signing", "trade", "waiver", "release", "affiliate_assignment", "injury", "unknown"]),
  organization_team_id: id.nullable(),
  roster_status: z.enum(["active_nhl", "injured_nhl", "affiliate", "prospect_reserve", "unsigned", "unresolved"]),
  source_key: z.string().min(1).refine(value => value.trim().length > 0), source_url: z.string().url().nullable(), source_hash: hash,
  observed_at: time, available_at: time, effective_at: time.nullable(), created_at: time,
  supersedes_id: text.nullable()
}).strict();
export type StoredRosterObservation = z.infer<typeof observation>;

/** Separately reviewed boundary interpretation. Its receipt must be persisted with the source row. */
const resolution = z.object({
  resolutionId: text, revision: text, observationId: text, sourceHash: hash,
  basis: z.literal("official_nhl_membership_boundary"),
  fromTeamId: id.nullable(), toTeamId: id.nullable(), recordedAt: time
}).strict();
export type MembershipTransitionResolution = z.infer<typeof resolution>;

/**
 * Recover usable evidence without equating organization membership, article publication,
 * current roster, first appearance or latest-observation selection with a tenure boundary.
 * A resolution supplies team-boundary meaning, never a missing effective timestamp.
 */
export function membershipEventsFromStoredObservations(input: {
  identity: { goalieId: number; fhfhPlayerId: number; nhlPlayerId: number };
  seasonId: number;
  observedAt: string;
  teams: { teamId: number; abbreviation: string }[];
  observations: unknown;
  resolutions: unknown;
}) {
  z.object({ goalieId: id, fhfhPlayerId: id, nhlPlayerId: id }).strict().parse(input.identity);
  id.parse(input.seasonId); time.parse(input.observedAt);
  const rows = z.array(observation).max(256).parse(input.observations);
  const resolutions = z.array(resolution).max(256).parse(input.resolutions);
  const teams = z.array(z.object({ teamId: id, abbreviation: z.string().regex(/^[A-Z]{2,3}$/) }).strict()).max(64).parse(input.teams);
  if (new Set(rows.map(r => r.id)).size !== rows.length
    || new Set(rows.map(r => JSON.stringify([r.season_id, r.observation_kind, r.source_key, r.source_hash]))).size !== rows.length
    || new Set(resolutions.map(r => r.observationId)).size !== resolutions.length
    || new Set(resolutions.map(r => r.resolutionId)).size !== resolutions.length || new Set(teams.map(t => t.teamId)).size !== teams.length
    || new Set(teams.map(t => t.abbreviation)).size !== teams.length) throw new Error("Duplicate stored membership identity or resolution.");
  if (resolutions.some(r => !rows.some(row => row.id === r.observationId))) throw new Error("Membership resolution has no source observation.");
  const teamById = new Map(teams.map(t => [t.teamId, t.abbreviation]));
  const observed = clock(input.observedAt), events: MembershipEvent[] = [];
  const records = rows.map(row => {
    const selected = resolutions.find(r => r.observationId === row.id);
    const reasons: string[] = [];
    if (row.season_id !== input.seasonId || row.fhfh_player_id === null && row.nhl_player_id === null
      || row.fhfh_player_id !== null && row.fhfh_player_id !== input.identity.fhfhPlayerId
      || row.nhl_player_id !== null && row.nhl_player_id !== input.identity.nhlPlayerId) reasons.push("source_identity_mismatch");
    if (clock(row.observed_at) > clock(row.available_at) || clock(row.available_at) > clock(row.created_at)
      || clock(row.created_at) > observed || row.effective_at !== null && clock(row.effective_at) > clock(row.available_at)) {
      reasons.push("source_clock_invalid");
    }
    const contextOnly = row.observation_kind !== "official_transaction" || row.event_type === "injury";
    if (contextOnly) reasons.push(row.event_type === "injury" ? "availability_does_not_end_membership" : "observation_is_not_membership_boundary");
    else {
      const url = row.source_url === null ? null : new URL(row.source_url);
      if (!url || url.protocol !== "https:" || url.username || url.password
        || !(url.hostname === "nhl.com" || url.hostname.endsWith(".nhl.com"))) reasons.push("official_source_unproven");
      if (!["membership", "signing", "trade", "release"].includes(row.event_type)) reasons.push("transaction_membership_effect_unresolved");
      if (!selected) reasons.push("boundary_interpretation_missing");
      if (row.effective_at === null) reasons.push("effective_time_unknown");
      if (selected) {
        if (selected.sourceHash !== row.source_hash || clock(selected.recordedAt) < clock(row.created_at)
          || clock(selected.recordedAt) > observed) reasons.push("boundary_resolution_receipt_mismatch");
        if (selected.fromTeamId === selected.toTeamId
          || selected.fromTeamId !== null && !teamById.has(selected.fromTeamId)
          || selected.toTeamId !== null && !teamById.has(selected.toTeamId)) reasons.push("boundary_team_identity_unresolved");
        if (row.event_type === "trade" && (selected.fromTeamId === null || selected.toTeamId === null)
          || ["membership", "signing"].includes(row.event_type) && (selected.fromTeamId !== null || selected.toTeamId === null)
          || row.event_type === "release" && (selected.fromTeamId === null || selected.toTeamId !== null)
          || row.organization_team_id !== (selected.toTeamId ?? selected.fromTeamId)) reasons.push("boundary_event_conflict");
        if (selected.toTeamId !== null && !["active_nhl", "injured_nhl"].includes(row.roster_status)) reasons.push("nhl_membership_status_unresolved");
        // Keep a missing effective time explicit. The lineage consumer will withhold full shares.
        if (reasons.every(reason => reason === "effective_time_unknown")) {
          events.push({ evidenceId: `roster-observation:${row.id}:${selected.resolutionId}:${selected.revision}`,
            source: "official_transaction", sourceRecordId: row.source_key,
            sourceRevision: `${row.source_hash}:${selected.resolutionId}:${selected.revision}`,
            goalieId: input.identity.goalieId,
            fromTeam: selected.fromTeamId === null ? null : teamById.get(selected.fromTeamId)!,
            toTeam: selected.toTeamId === null ? null : teamById.get(selected.toTeamId)!,
            effectiveAt: row.effective_at, recordedAt: selected.recordedAt });
        }
      }
    }
    return { observation: row, resolution: selected ?? null, disposition: contextOnly ? "context_only" as const
      : reasons.length ? "unresolved" as const : "boundary_evidence" as const, reasons: [...new Set(reasons)].sort() };
  }).sort((a, b) => a.observation.id.localeCompare(b.observation.id));
  return {
    contract: "goalie-stored-membership-evidence-v1" as const,
    identity: { ...input.identity }, seasonId: input.seasonId, observedAt: input.observedAt,
    records, events: events.sort((a, b) => a.evidenceId.localeCompare(b.evidenceId)),
    // The old transactionCoverage flag and latest-per-player RPC do not prove complete tenure.
    coverage: null, membershipComplete: false as const,
    reasons: ["independent_membership_coverage_required"] as const
  };
}
