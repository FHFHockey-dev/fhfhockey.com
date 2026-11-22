import assert from "node:assert/strict";
import { readFileSync, statSync } from "node:fs";
import { replayProjectionInputs, type ProjectionInputRead } from "../../../../web/lib/projections/inputCapture";
import { captureForgeIssuedContexts } from "../../../../web/lib/projections/issuedContext";
import { computeSkaterShotQualityAdjustments } from "../../../../web/lib/projections/calculators/skater-adjustments";
import { u8 } from "../../../../web/lib/projections/pregameCapture/der";
import { decodePacket, sha256Hex } from "../../../../web/lib/projections/pregameCapture/packet";
import { fetchLatestSkaterContextProfiles } from "../../../../web/lib/projections/queries/skater-queries";
import recorded from "./recorded-2026020336.json";

// Force offline operation even if the invoking shell has production configuration.
delete process.env.NEXT_PUBLIC_SUPABASE_URL;
delete process.env.SUPABASE_SERVICE_ROLE_KEY;
globalThis.fetch = async () => { throw new Error("Unexpected network call in offline packet harness"); };

function verifyNative(path: string) {
  const expected = recorded.nativeArchive;
  assert.equal(statSync(path).size, expected.byteLength, "Native archive byte count mismatch");
  const raw = u8(readFileSync(path));
  assert.equal(sha256Hex(raw), expected.rawSha256, "Native archive raw SHA-256 mismatch");
  const { packet, canonicalSha256 } = decodePacket(raw);
  assert.equal(canonicalSha256, expected.canonicalSha256, "Native archive canonical SHA-256 mismatch");
  assert.deepEqual(packet.binding, recorded.binding, "Native archive binding mismatch");
  assert.deepEqual(packet.readWindow, recorded.readWindow, "Native archive read window mismatch");
  assert.equal(packet.statedCutoff, recorded.statedCutoff, "Native archive stated cutoff mismatch");
  assert.ok(packet.candidates.skaters.includes(recorded.skaterCandidate.nhlPlayerId), "Native archive lacks reported skater candidate");
  return {
    classification: "original_native_packet_integrity_verified",
    binding: packet.binding,
    byteLength: raw.length,
    rawSha256: expected.rawSha256,
    canonicalSha256,
    readCount: packet.reads.length,
    witnessVerifiedInThisRun: false,
    imported: false,
  };
}

async function reconstructFragment() {
  const { gameId, slateDate } = recorded.binding;
  const { nhlPlayerId, latestSkaterContext } = recorded.skaterCandidate;
  const row = latestSkaterContext.rowFragment;
  assert.equal(row.player_id, nhlPlayerId);
  assert.ok(row.date < slateDate);
  const lookbackDate = new Date(Date.parse(slateDate) - 365 * 86_400_000).toISOString().slice(0, 10);
  // Rebuild a scoped read for one printed row fragment. The original query and full response are absent.
  const contextRead: ProjectionInputRead = {
    request: [
      { method: "from", args: [latestSkaterContext.relation] },
      { method: "select", args: ["player_id,date,nst_shots_per_60,nst_ixg_per_60,nst_rush_attempts_per_60,nst_rebounds_created_per_60,nst_oi_xgf_per_60,nst_oi_xga_per_60,nst_oi_cf_pct_rates,nst_oi_cf_pct,possession_pct_safe"] },
      { method: "in", args: ["player_id", [nhlPlayerId]] },
      { method: "lt", args: ["date", slateDate] },
      { method: "gte", args: ["date", lookbackDate] },
      { method: "order", args: ["date", { ascending: false }] },
      { method: "limit", args: [5000] },
    ],
    result: { data: [row], error: null },
    receivedAt: latestSkaterContext.receivedAt,
  };
  const strict = { rejectUnrecordedReads: true };
  const { result, writes } = await replayProjectionInputs([contextRead], () => fetchLatestSkaterContextProfiles([nhlPlayerId], slateDate), strict);
  assert.equal(writes.length, 0);
  const profile = result.shotQuality.get(nhlPlayerId);
  assert.ok(profile, "Reconstructed player context was absent");
  assert.deepEqual(profile, {
    sourceDate: row.date,
    nstShotsPer60: row.nst_shots_per_60,
    nstIxgPer60: row.nst_ixg_per_60,
    nstRushAttemptsPer60: null,
    nstReboundsCreatedPer60: null,
  });
  const { qualityPerShot, sampleWeight } = computeSkaterShotQualityAdjustments({ profile });
  assert.equal(qualityPerShot, 0.0501);
  assert.equal(sampleWeight, 0.6617);

  const fullReplayStop = "Unrecorded projection input: from games";
  await assert.rejects(
    replayProjectionInputs([contextRead], () => captureForgeIssuedContexts(slateDate, [gameId]), strict),
    { message: fullReplayStop },
  );
  return {
    classification: "historical_metadata_fragment_reconstruction",
    gameId,
    playerId: nhlPlayerId,
    source: latestSkaterContext,
    supportedCalculation: { qualityPerShot, sampleWeight },
    fullReplay: { status: "blocked_missing_native_reads", firstError: fullReplayStop },
    forecastComputed: false,
    published: false,
    imported: false,
    writes: writes.length,
  };
}

async function main() {
  const [mode, path, ...extra] = process.argv.slice(2);
  if (extra.length || (mode === "verify-native" ? !path : mode !== "reconstruct-fragment" || path)) {
    throw new Error("Usage: offline.cjs reconstruct-fragment | verify-native <original-packet.gz>");
  }
  const receipt = mode === "verify-native" ? verifyNative(path) : await reconstructFragment();
  console.log(JSON.stringify(receipt, null, 2));
}

main().catch(error => {
  console.error(error instanceof Error ? error.message : String(error));
  process.exitCode = 1;
});
