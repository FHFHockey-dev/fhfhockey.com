import { createHash } from "node:crypto";
import { z } from "zod";
import { timestampMicros } from "lib/projections/evidenceTime";
import { normalizeIdentityName, type PlayerIdentity } from "./playerIdentity";

export const PLAYER_IDENTITY_SNAPSHOT_VERSION = "player-identity-snapshot-v1";
export const identityDigest = (value: unknown) => createHash("sha256").update(JSON.stringify(value)).digest("hex");
export const identityTimestamp = z.string().refine(value => timestampMicros(value) !== null, "Explicit timestamp required");
const positiveId = z.number().int().positive().safe();
const label = z.string().trim().min(1).max(200);
export const canonicalIdentityId = z.string().regex(/^nhl:[1-9]\d*$/)
  .refine(value => Number.isSafeInteger(Number(value.slice(4))));

const interval = { startsAt: identityTimestamp, endsAt: identityTimestamp.nullable() };
const validInterval = (value: { startsAt: string; endsAt: string | null }) =>
  value.endsAt === null || timestampMicros(value.startsAt)! < timestampMicros(value.endsAt)!;
const aliasSchema = z.object({
  text: label, verification: z.literal("verified"),
  scope: z.discriminatedUnion("kind", [z.object({ kind: z.literal("global") }).strict(),
    z.object({ kind: z.literal("team"), teamId: positiveId }).strict()]),
  provenance: label, ...interval,
}).strict().refine(validInterval, "Invalid alias interval");
const membershipSchema = z.object({ teamId: positiveId, provenance: label, ...interval })
  .strict().refine(validInterval, "Invalid membership interval");
const rowSchema = z.object({
  canonicalId: canonicalIdentityId, nhlPlayerId: positiveId, registryId: positiveId.nullable(),
  fullName: label, lastName: label, unicodeKey: label, searchKey: label,
  positions: z.array(label).max(5), aliases: z.array(aliasSchema).max(30),
  memberships: z.array(membershipSchema).max(30),
}).strict().refine(row => row.canonicalId === `nhl:${row.nhlPlayerId}`
  && row.unicodeKey === unicodeIdentityKey(row.fullName) && row.searchKey === normalizeIdentityName(row.fullName), "Invalid identity keys");
const snapshotContentSchema = z.object({
  version: z.literal(PLAYER_IDENTITY_SNAPSHOT_VERSION), asOf: identityTimestamp,
  provenance: label,
  completeness: z.object({ status: z.enum(["complete", "partial", "unknown"]), scope: label,
    omittedRecords: z.number().int().nonnegative().safe().nullable() }).strict(),
  rows: z.array(rowSchema).max(10000),
}).strict().refine(snapshot => snapshot.completeness.status !== "complete" || snapshot.completeness.omittedRecords === 0,
  "Complete snapshots must account for omitted records");
const snapshotSchema = z.object({ content: snapshotContentSchema, hash: z.string().regex(/^[a-f0-9]{64}$/) }).strict();

export type IdentitySnapshotRow = z.infer<typeof rowSchema>;
export type PlayerIdentitySnapshot = z.infer<typeof snapshotSchema>;
export type IdentitySnapshotRecord = {
  identity: PlayerIdentity;
  verifiedAliases: IdentitySnapshotRow["aliases"];
  memberships: IdentitySnapshotRow["memberships"];
};

/** Preserve Unicode for interchange; the separate existing search normalizer folds accents. */
export function unicodeIdentityKey(value: string): string {
  return value.normalize("NFC").replace(/[’‘]/g, "'").replace(/[‐‑–—−-]/g, " ")
    .replace(/\s+/g, " ").trim().toLowerCase();
}

export function freezeIdentityValue<T>(value: T): T {
  if (value && typeof value === "object") {
    Object.values(value).forEach(freezeIdentityValue);
    Object.freeze(value);
  }
  return value;
}

/** Export supplied canonical data only. Undated teamId/aliases on PlayerIdentity are deliberately not promoted. */
export function buildPlayerIdentitySnapshot(args: {
  asOf: string; provenance: string; completeness: PlayerIdentitySnapshot["content"]["completeness"];
  records: IdentitySnapshotRecord[];
}): PlayerIdentitySnapshot {
  const rows = args.records.map(({ identity: player, verifiedAliases, memberships }) => ({
    canonicalId: `nhl:${player.playerId}`, nhlPlayerId: player.playerId, registryId: player.registryId ?? null,
    fullName: player.fullName, lastName: player.lastName,
    unicodeKey: unicodeIdentityKey(player.fullName), searchKey: normalizeIdentityName(player.fullName),
    positions: [...new Set((player.position ?? "").split(/[,/\s]+/).filter(Boolean).map(p => p.toUpperCase()))].sort(),
    aliases: verifiedAliases.map(alias => aliasSchema.parse(alias)).sort((a, b) => JSON.stringify(a) < JSON.stringify(b) ? -1 : JSON.stringify(a) > JSON.stringify(b) ? 1 : 0),
    memberships: memberships.map(membership => membershipSchema.parse(membership)).sort((a, b) => JSON.stringify(a) < JSON.stringify(b) ? -1 : JSON.stringify(a) > JSON.stringify(b) ? 1 : 0),
  })).sort((a, b) => a.nhlPlayerId - b.nhlPlayerId);
  const content = snapshotContentSchema.parse({ version: PLAYER_IDENTITY_SNAPSHOT_VERSION, asOf: args.asOf,
    provenance: args.provenance, completeness: args.completeness, rows });
  return validatePlayerIdentitySnapshot({ content, hash: identityDigest(content) });
}

export function validatePlayerIdentitySnapshot(value: unknown): PlayerIdentitySnapshot {
  const snapshot = snapshotSchema.parse(value), rows = snapshot.content.rows;
  if (snapshot.hash !== identityDigest(snapshot.content)) throw new Error("identity_snapshot_hash_mismatch");
  if (new Set(rows.map(row => row.canonicalId)).size !== rows.length) throw new Error("duplicate_canonical_identity");
  const registered = rows.flatMap(row => row.registryId === null ? [] : [row.registryId]);
  if (new Set(registered).size !== registered.length) throw new Error("conflicting_registry_link");
  return freezeIdentityValue(snapshot);
}

export type PlayerIdentityIndex = {
  snapshot: PlayerIdentitySnapshot;
  byId: Readonly<Record<string, IdentitySnapshotRow>>;
  byName: Readonly<Record<string, readonly string[]>>;
};

export function indexPlayerIdentitySnapshot(value: unknown): PlayerIdentityIndex {
  const snapshot = validatePlayerIdentitySnapshot(value);
  const byId: Record<string, IdentitySnapshotRow> = Object.create(null);
  const byName: Record<string, string[]> = Object.create(null);
  for (const row of snapshot.content.rows) {
    byId[row.canonicalId] = row;
    for (const name of [row.fullName, row.lastName, `${row.fullName[0]} ${row.lastName}`, ...row.aliases.map(alias => alias.text)]) {
      const key = normalizeIdentityName(name);
      byName[key] = [...new Set([...(byName[key] ?? []), row.canonicalId])];
    }
  }
  return freezeIdentityValue({ snapshot, byId, byName });
}

export function identityIntervalContains(value: { startsAt: string; endsAt: string | null }, at: string): boolean {
  const time = timestampMicros(at);
  return time !== null && timestampMicros(value.startsAt)! <= time
    && (value.endsAt === null || time < timestampMicros(value.endsAt)!);
}

export function snapshotRowAtSource(row: IdentitySnapshotRow, index: PlayerIdentityIndex, publishedAt: string) {
  // A current snapshot is never evidence for an undated historical membership, or for its future.
  const withinSnapshot = timestampMicros(publishedAt) !== null
    && timestampMicros(publishedAt)! <= timestampMicros(index.snapshot.content.asOf)!;
  const teamIds = withinSnapshot ? [...new Set(row.memberships.filter(m => identityIntervalContains(m, publishedAt)).map(m => m.teamId))] : [];
  const aliases = withinSnapshot ? row.aliases.filter(alias => identityIntervalContains(alias, publishedAt)
    && (alias.scope.kind === "global" || teamIds.includes(alias.scope.teamId))) : [];
  const identity: PlayerIdentity = { playerId: row.nhlPlayerId, registryId: row.registryId ?? undefined,
    fullName: row.fullName, lastName: row.lastName, position: row.positions.join("/"),
    teamId: teamIds.length === 1 ? teamIds[0] : null, aliases: aliases.map(alias => alias.text) };
  return { identity, teamIds, aliases };
}
