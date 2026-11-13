import { createHash } from "node:crypto";
import { z } from "zod";
import { timestampMicros } from "../evidenceTime";
import { membershipEventsFromStoredObservations } from "./storedMembershipEvidence";

const id = z.number().int().positive().safe();
const hash = z.string().regex(/^[a-f0-9]{64}$/);
const time = z.string().datetime({ offset: true }).refine(value => timestampMicros(value) !== null, "Invalid inventory clock");
const project = z.string().regex(/^[a-z0-9]{20}$/);
const selectionSchema = z.object({
  projectId: project, sha256: hash, readAt: time, sourceCutoff: time, seasonId: id,
  identity: z.object({ goalieId: id, fhfhPlayerId: id, nhlPlayerId: id }).strict(),
  teams: z.array(z.object({ teamId: id, abbreviation: z.string().regex(/^[A-Z]{2,3}$/) }).strict()).max(64),
  rows: z.array(z.object({ observationId: z.string().uuid(), sourceHash: hash }).strict()).min(1).max(32)
}).strict();
export type MembershipInventorySelection = z.infer<typeof selectionSchema>;

const envelopeSchema = z.object({
  contract: z.literal("goalie-membership-inventory-v1"), projectId: project, capturedAt: time,
  observations: z.array(z.unknown()).max(32)
}).strict();
const coordinatesSchema = z.array(z.object({ id: z.string().uuid(), source_hash: hash }).passthrough()).max(32);

/**
 * Offline/server-only admission of an already retained export. No file, database or provider access.
 * The selection comes from a separately trusted owner receipt, never from the export itself.
 * Exact row/hash agreement proves selection integrity, not authenticity or membership coverage.
 */
export function readMembershipInventory(body: string, expected: MembershipInventorySelection, resolutions: unknown = []) {
  if (typeof body !== "string" || Buffer.byteLength(body, "utf8") > 128 * 1024) {
    throw new Error("Membership inventory exceeds its byte bound.");
  }
  const pin = selectionSchema.parse(expected);
  if (new Set(pin.rows.map(row => row.observationId)).size !== pin.rows.length) {
    throw new Error("Duplicate membership inventory selection.");
  }
  const sha256 = createHash("sha256").update(body, "utf8").digest("hex");
  if (sha256 !== pin.sha256) throw new Error("Membership inventory byte integrity mismatch.");
  const envelope = envelopeSchema.parse(JSON.parse(body));
  if (envelope.projectId !== pin.projectId || timestampMicros(envelope.capturedAt)! > timestampMicros(pin.readAt)!
    || timestampMicros(pin.sourceCutoff)! > timestampMicros(envelope.capturedAt)!) {
    throw new Error("Membership inventory project or clock mismatch.");
  }
  const coordinates = coordinatesSchema.parse(envelope.observations);
  if (coordinates.length !== pin.rows.length || new Set(coordinates.map(row => row.id)).size !== coordinates.length
    || coordinates.some(row => !pin.rows.some(selected => selected.observationId === row.id && selected.sourceHash === row.source_hash))) {
    throw new Error("Membership inventory requested rows mismatch.");
  }
  const admission = membershipEventsFromStoredObservations({ identity: pin.identity, seasonId: pin.seasonId,
    observedAt: pin.sourceCutoff, teams: pin.teams, observations: envelope.observations, resolutions });
  if (admission.records.some(record => record.reasons.includes("source_identity_mismatch"))) {
    throw new Error("Membership inventory identity mismatch.");
  }
  if (admission.records.some(({ observation }) => Buffer.byteLength(observation.source_key, "utf8") > 512
    || observation.source_url !== null && Buffer.byteLength(observation.source_url, "utf8") > 512)) {
    throw new Error("Membership inventory source coordinate exceeds its bound.");
  }
  return { projectId: pin.projectId, sha256, capturedAt: envelope.capturedAt,
    requestedRowCount: pin.rows.length, returnedRowCount: coordinates.length, admission };
}
