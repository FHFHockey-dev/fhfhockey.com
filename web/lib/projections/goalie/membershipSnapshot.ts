import { createHash } from "node:crypto";
import { z } from "zod";
import { buildGoalieWorkloadContract, type GoalieWorkloadContractInput } from "./workloadContract";
import { timestampMicros } from "../evidenceTime";

const id = z.number().int().positive().safe(), text = z.string().trim().min(1).max(512);
const sourceCoordinate = z.string().min(1).max(512).refine(value => value.trim().length > 0);
const time = z.string().datetime({ offset: true }).refine(value => timestampMicros(value) !== null, "Invalid evidence clock");
const clock = (value: string) => timestampMicros(value)!;
const boundaryTime = time.refine(value => {
  const micros = timestampMicros(value);
  return micros !== null && micros % BigInt(1000) === BigInt(0);
}, "Workload boundary precision is unsupported");
const team = z.string().regex(/^[A-Z]{2,3}$/);
const evidenceIds = z.array(text).max(256);
const scope = z.object({ seasonId: id, gameType: id, fromAt: boundaryTime, throughAt: boundaryTime }).strict();
const inputSchema = z.object({
  goalieId: id, scope, observedAt: time,
  scheduleComplete: z.boolean(), scheduleEvidenceIds: evidenceIds,
  games: z.array(z.object({ gameId: id, team, seasonId: id, gameType: id, date: z.string().date(), startsAt: boundaryTime,
    final: z.boolean(), reported: z.boolean(), appearancesComplete: z.boolean(), evidenceIds }).strict()).max(2000),
  appearances: z.array(z.object({ gameId: id, team, goalieId: id, started: z.boolean().nullable(), evidenceIds }).strict()).max(10000),
  membership: z.object({
    coverage: z.object({ evidenceId: text, sourceRecordId: sourceCoordinate, sourceRevision: sourceCoordinate, goalieId: id, seasonId: id,
      fromAt: time, throughAt: time, recordedAt: time, complete: z.boolean() }).strict().nullable(),
    events: z.array(z.object({ evidenceId: text, source: z.enum(["official_transaction", "official_eligibility", "roster_snapshot", "appearance"]),
      sourceRecordId: sourceCoordinate, sourceRevision: sourceCoordinate, goalieId: id, fromTeam: team.nullable(), toTeam: team.nullable(),
      // Date-only evidence is preserved, then marked uncertain by lineage admission.
      effectiveAt: z.string().max(64).nullable(), recordedAt: time }).strict()).max(256),
    stints: z.array(z.object({ stintId: text, team, enteredBy: text,
      end: z.discriminatedUnion("kind", [z.object({ kind: z.literal("departed"), exitedBy: text }).strict(),
        z.object({ kind: z.literal("ongoing") }).strict(), z.object({ kind: z.literal("unknown") }).strict()]) }).strict()).max(128)
  }).strict(),
  availability: z.array(z.object({ gameId: id, team, goalieId: id,
    status: z.enum(["injured", "scratched", "available", "unknown"]), evidenceIds }).strict()).max(2000).optional()
}).strict();

const snapshotSchema = z.object({
  contract: z.literal("goalie-membership-snapshot-v1"), snapshotId: text, createdAt: time,
  input: inputSchema
}).strict();
type Snapshot = z.infer<typeof snapshotSchema>;

function canonical(value: unknown): string {
  if (Array.isArray(value)) return `[${value.map(canonical).join(",")}]`;
  if (value !== null && typeof value === "object") return `{${Object.entries(value).filter(([, item]) => item !== undefined).sort(([a], [b]) => a.localeCompare(b))
    .map(([key, item]) => `${JSON.stringify(key)}:${canonical(item)}`).join(",")}}`;
  return JSON.stringify(value);
}
function bodyAndHash(snapshot: Snapshot) {
  if (clock(snapshot.createdAt) < clock(snapshot.input.observedAt)) throw new Error("Snapshot precedes its source observation.");
  const gameKeys = new Set(snapshot.input.games.map(game => `${game.team}:${game.gameId}`));
  if (snapshot.input.appearances.some(row => !gameKeys.has(`${row.team}:${row.gameId}`))) {
    throw new Error("Appearance has no matching team-game identity.");
  }
  const body = canonical(snapshot);
  if (Buffer.byteLength(body, "utf8") > 2 * 1024 * 1024) throw new Error("Membership snapshot exceeds its bound.");
  return { body, sha256: createHash("sha256").update(body, "utf8").digest("hex") };
}

/** Offline persistence payload. Store immutable inputs; never trust cached or caller-supplied shares. */
export function createMembershipSnapshot(snapshotId: string, createdAt: string, input: GoalieWorkloadContractInput) {
  const snapshot = snapshotSchema.parse({ contract: "goalie-membership-snapshot-v1", snapshotId, createdAt, input });
  buildGoalieWorkloadContract(snapshot.input);
  return { snapshot, ...bodyAndHash(snapshot) };
}

/** The caller supplies a separately trusted selection pin, never a checksum taken from this body. */
export function readMembershipSnapshot(body: string, expected: {
  snapshotId: string; sha256: string; goalieId: number; scope: GoalieWorkloadContractInput["scope"]; readAt: string;
}) {
  if (typeof body !== "string" || Buffer.byteLength(body, "utf8") > 2 * 1024 * 1024) throw new Error("Membership snapshot exceeds its bound.");
  const pin = z.object({ snapshotId: text, sha256: z.string().regex(/^[a-f0-9]{64}$/), goalieId: id, scope, readAt: time }).strict().parse(expected);
  const snapshot = snapshotSchema.parse(JSON.parse(body));
  const calculated = bodyAndHash(snapshot);
  if (calculated.sha256 !== pin.sha256 || snapshot.snapshotId !== pin.snapshotId || snapshot.input.goalieId !== pin.goalieId
    || snapshot.input.scope.seasonId !== pin.scope.seasonId || snapshot.input.scope.gameType !== pin.scope.gameType
    || clock(snapshot.input.scope.fromAt) !== clock(pin.scope.fromAt) || clock(snapshot.input.scope.throughAt) !== clock(pin.scope.throughAt)
    || clock(snapshot.createdAt) > clock(pin.readAt)) throw new Error("Membership snapshot selection or integrity mismatch.");
  return { snapshotId: snapshot.snapshotId, sha256: calculated.sha256, createdAt: snapshot.createdAt,
    workload: buildGoalieWorkloadContract(snapshot.input) };
}
