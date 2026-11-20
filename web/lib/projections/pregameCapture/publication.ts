import type { SupabaseClient } from "@supabase/supabase-js";
import { getServiceRoleClient } from "lib/supabase/server";
import { computeForgePregamePublication } from "../run-forge-projections";
import { starterBoardFlags, starterBoardScopeAllowed } from "../starterBoardFlags";
import { ackQualifies, effectiveStartMicros } from "./deadline";
import { u8 } from "./der";
import { decodePacket, type PregamePacket } from "./packet";
import { POLICY_ID } from "./policy";
import type { TsaTrust } from "./rfc3161";
import { supabaseCaptureRpc, type ReadRow } from "./rpc";
import { MICROS_PER_MS, parseInstantMicros } from "./time";
import { tsaProfile, trustFromProfile } from "./tsaProfiles";
import { pregameScheduleProblem, reverifyStoredWitness } from "./verifier";

const uuid = /^[\da-f]{8}-(?:[\da-f]{4}-){3}[\da-f]{12}$/;

export type PublicationTarget = { claimId: string; gameId: number; codeVersion: string };
type PublicationDeps = { db?: SupabaseClient; trust?: TsaTrust; now?: () => number };
type PublicationReceipt = {
  runId: string; revisionId: string; inputSnapshotId: string; publishedAt: string; observedAt: string; alreadyPublished: boolean;
};

export class PublicationError extends Error {
  constructor(readonly status: number, reason: string) { super(reason); }
}

function packetForPublication(row: ReadRow, trust: TsaTrust, nowMs: number) {
  const clocks = { scheduledStart: row.scheduledStart, currentScheduledStart: row.currentStart };
  const dbNow = parseInstantMicros(row.dbReadAt);
  const start = effectiveStartMicros(clocks);
  if (!row.currentStart || pregameScheduleProblem(row.teamGameStatuses) ||
      dbNow >= start || BigInt(nowMs) * MICROS_PER_MS >= start) {
    throw new PublicationError(409, "game_no_longer_eligible");
  }
  try {
    const bytes = Buffer.from(row.packetBase64!, "base64");
    if (bytes.byteLength !== row.byteLength) throw new Error("length");
    const { packet, rawSha256, canonicalSha256 } = decodePacket(u8(bytes));
    const binding = packet.binding;
    if (rawSha256 !== row.rawSha256 || rawSha256 !== row.storedRawSha256 || canonicalSha256 !== row.canonicalSha256 ||
        binding.claimId !== row.claimId || binding.gameId !== row.gameId || binding.codeVersion !== row.codeVersion ||
        binding.policyId !== row.policyId || binding.slateDate !== row.slateDate || binding.calendarRevision !== row.calendarRevision ||
        binding.homeTeamId !== row.homeTeamId || binding.awayTeamId !== row.awayTeamId ||
        parseInstantMicros(binding.scheduledStart) !== parseInstantMicros(row.scheduledStart) ||
        parseInstantMicros(binding.inputCutoff) !== parseInstantMicros(row.inputCutoff) || parseInstantMicros(binding.inputCutoff) > dbNow) {
      throw new Error("binding");
    }
    const witness = reverifyStoredWitness(row, trust);
    if (!witness.withinDeadline || !ackQualifies(parseInstantMicros(witness.ackUpper), clocks)) throw new Error("witness");
    return packet;
  } catch {
    throw new PublicationError(409, "capture_verification_failed");
  }
}

async function waitForPacketCutoff(packet: PregamePacket, dbReadAt: string, now: () => number) {
  // A fast witness can finish before the transport's conservative end-of-read bound.
  // Wait only for that signed tolerance. The transaction independently checks its clock before issuing.
  const cutoff = parseInstantMicros(packet.statedCutoff);
  const localNow = BigInt(now()) * MICROS_PER_MS;
  const dbNow = parseInstantMicros(dbReadAt);
  const gap = cutoff - (localNow < dbNow ? localNow : dbNow);
  if (gap <= BigInt(0)) return;
  const waitMs = Number((gap + MICROS_PER_MS - BigInt(1)) / MICROS_PER_MS);
  if (waitMs > packet.transport.stampToleranceMs) throw new PublicationError(503, "capture_cutoff_pending");
  await new Promise<void>(resolve => setTimeout(resolve, waitMs));
  if (BigInt(now()) * MICROS_PER_MS < cutoff) throw new PublicationError(503, "capture_cutoff_pending");
}

function receipt(value: unknown, claimId: string): PublicationReceipt {
  const row = value as Partial<PublicationReceipt> | null;
  if (row?.runId !== claimId || !uuid.test(row.revisionId ?? "") || !uuid.test(row.inputSnapshotId ?? "") || !row.publishedAt) {
    throw new PublicationError(503, "publication_receipt_unconfirmed");
  }
  if (row.observedAt === null) throw new PublicationError(409, "committed_without_pregame_observation");
  if (!row.observedAt || parseInstantMicros(row.observedAt) < parseInstantMicros(row.publishedAt)) {
    throw new PublicationError(503, "publication_receipt_unconfirmed");
  }
  return { runId: claimId, revisionId: row.revisionId!, inputSnapshotId: row.inputSnapshotId!,
    publishedAt: row.publishedAt, observedAt: row.observedAt, alreadyPublished: true };
}

/** A single qualified claim supplies every model input. The transaction rechecks the schedule at publication. */
export async function publishQualifiedPregameCapture(target: PublicationTarget, deps: PublicationDeps = {}): Promise<PublicationReceipt> {
  const { claimId, gameId, codeVersion } = target;
  if (!uuid.test(claimId) || !Number.isSafeInteger(gameId) || gameId <= 0) throw new PublicationError(400, "invalid_target");
  if (!/^[a-f0-9]{40}$/.test(codeVersion)) throw new PublicationError(503, "release_pin_unavailable");
  if (!starterBoardFlags().compute || !starterBoardScopeAllowed([gameId])) throw new PublicationError(409, "compute_scope_disabled");
  const db: SupabaseClient = deps.db ?? getServiceRoleClient();
  const row = await supabaseCaptureRpc(db, 15_000).read(claimId).catch(() => {
    throw new PublicationError(503, "capture_read_unconfirmed");
  });
  if (!row) throw new PublicationError(404, "claim_missing");
  if (row.claimId !== claimId || row.gameId !== gameId || row.codeVersion !== codeVersion || row.policyId !== POLICY_ID) {
    throw new PublicationError(409, "claim_binding_mismatch");
  }
  if (row.outcome !== "qualified" || row.witnessVerdict !== "qualified" || row.saveFenced || !row.artifactPresent ||
      !row.rawSha256 || !row.canonicalSha256 || !row.rowVersion || !row.packetBase64) {
    throw new PublicationError(409, "capture_not_qualified");
  }
  const pin = { p_claim_id: claimId, p_code_version: codeVersion, p_raw_sha256: row.rawSha256, p_canonical_sha256: row.canonicalSha256 };
  const confirm = async () => {
    const { data, error } = await db.rpc("forge_pregame_publication_receipt_v1", pin).abortSignal(AbortSignal.timeout(15_000));
    if (error) throw new PublicationError(503, "publication_receipt_unconfirmed");
    return data === null ? null : receipt(data, claimId);
  };
  // Recover a committed response loss without rerunning the model, including after puck drop.
  const existing = await confirm();
  if (existing) return existing;
  const now = deps.now ?? Date.now;
  const packet = packetForPublication(row, deps.trust ?? trustFromProfile(tsaProfile("digicert-g4-v1"), "capture"), now());
  await waitForPacketCutoff(packet, row.dbReadAt, now);
  const start = effectiveStartMicros({ scheduledStart: row.scheduledStart, currentScheduledStart: row.currentStart });
  const computed = await computeForgePregamePublication(packet, {
    codeVersion, deadlineMs: Math.min(now() + 150_000, Number(start / MICROS_PER_MS)),
  }).catch(() => { throw new PublicationError(422, "packet_calculation_failed"); });
  const { data, error } = await db.rpc("forge_pregame_publish_v1", {
    ...pin, p_snapshot: computed.snapshot, p_metrics: computed.metrics, p_players: computed.rows.players,
    p_teams: computed.rows.teams, p_goalies: computed.rows.goalies, p_reserves: computed.rows.reserves,
  }).abortSignal(AbortSignal.timeout(30_000));
  if (error?.code === "22023" && /^pregame_publication_[a-z_]+$/.test(error.message)) {
    throw new PublicationError(409, error.message);
  }
  if (error || data?.runId !== claimId || typeof data.alreadyPublished !== "boolean") throw new PublicationError(503, "publication_unconfirmed");
  const confirmed = await confirm();
  if (!confirmed) throw new PublicationError(503, "publication_receipt_unconfirmed");
  return { ...confirmed, alreadyPublished: data.alreadyPublished };
}
