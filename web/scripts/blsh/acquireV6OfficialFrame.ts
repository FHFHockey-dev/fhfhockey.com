/** Derive one skater's original-byte frame after capture. From web with the same ts-node flags as prepareV6Observation:
 * acquireV6OfficialFrame.ts EXPORT LEDGER_PINS OFFICIAL_ARCHIVE INDEPENDENT_FRAME_PINS NEW_FRAME_FILE [--fixture-only]
 * FRAME_PINS contains runId, sourceDate, playerId, evidenceAsOfUTC, acquisitionPinsSHA256, acquisitionManifestSHA256.
 * Keep the resulting frame digest independently with the original acquisition evidence.
 */
import { closeSync, fsyncSync, openSync, readdirSync, realpathSync, writeFileSync } from "node:fs";
import { basename, dirname, join, relative, resolve, sep } from "node:path";
import { readNativeV6LedgerExport } from "./readNativeV6Ledger";

const outside = (directory: string, file: string) => { const rel = relative(directory, file); return rel === ".." || rel.startsWith(".." + sep); };
export async function deriveV6OfficialFrame(exportDir: string, ledgerPins: string, officialDir: string, framePins: string, output: string, fixtureOnly = false) {
  const { MIB, encode, isHash, need, parseJson, readBound, sha } = await import("../../../tasks/artifacts/blsh-evidence-bridge-2026-11-15/lib.mjs");
  const { reviewNativeV6Packet } = await import("./reviewNativeV6Packet.mjs");
  const { deriveOfficialFrame, deriveHostedOfficialFrame } = await import("./prepareV6ObservationEvidence.mjs");
  const directory = realpathSync(officialDir), ledger = realpathSync(exportDir), pinsFile = realpathSync(framePins), ledgerPinFile = realpathSync(ledgerPins);
  const destination = join(realpathSync(dirname(resolve(output))), basename(output));
  need([ledger, directory].every(dir => outside(dir, pinsFile) && outside(dir, ledgerPinFile) && outside(dir, destination))
    && pinsFile !== ledgerPinFile && outside(resolve(__dirname, "../../.."), destination), "official_private_paths_required");
  const runBytes = readBound(join(ledger, "run.json"), 65536);
  const verified = readNativeV6LedgerExport(ledger, ledgerPinFile), profile = reviewNativeV6Packet(verified), pins = parseJson(readBound(pinsFile, 65536));
  need(runBytes.equals(new Uint8Array(readBound(join(ledger, "run.json"), 65536))), "official_ledger_changed");
  need(pins.sourceDate === profile.sourceDate && pins.runId === profile.runId && Number.isSafeInteger(pins.playerId) && pins.playerId > 0
    && isHash(pins.acquisitionManifestSHA256) && isHash(pins.acquisitionPinsSHA256), "official_frame_pins_invalid");
  const read = (name: string, limit: number, hash: string) => {
    const path = join(directory, basename(name));
    need(realpathSync(path) === path, "official_symlink_refused");
    const bytes = readBound(path, Math.min(limit, 4 * MIB));
    need(sha(bytes) === hash, "official_frame_digest_mismatch");
    return bytes;
  };
  const schedule = parseJson(verified.files.get("schedule.raw.json"));
  const dates = schedule.gameWeek.filter((row: { date: string }) => row.date === pins.sourceDate);
  need(dates.length === 1, "schedule_day_ambiguous");
  const { frame } = Object.prototype.hasOwnProperty.call(pins, "hostedOfficial")
    ? deriveHostedOfficialFrame(directory, dates[0], pins.playerId, pins, profile, runBytes, fixtureOnly, undefined)
    : deriveOfficialFrame(read, readdirSync(directory), dates[0], pins.playerId, pins, profile, runBytes, fixtureOnly);
  const bytes = encode(frame), fd = openSync(destination, "wx", 0o600);
  try { writeFileSync(fd, new Uint8Array(bytes)); fsyncSync(fd); } finally { closeSync(fd); }
  return { status: fixtureOnly ? "fixture_only_frame" : "official_frame_pending_independent_review", frameSHA256: sha(bytes), acceptedWitnesses: 0 };
}

if (require.main === module) {
  const a = process.argv.slice(2);
  if (!(a.length === 5 || (a.length === 6 && a[5] === "--fixture-only"))) { process.stderr.write("Expected EXPORT LEDGER_PINS OFFICIAL_ARCHIVE FRAME_PINS NEW_FRAME_FILE [--fixture-only]\n"); process.exitCode = 1; }
  else void deriveV6OfficialFrame(a[0], a[1], a[2], a[3], a[4], a[5] === "--fixture-only")
    .then(report => process.stdout.write(JSON.stringify(report) + "\n"))
    .catch(error => { process.stderr.write((error.code ?? error.message) + "\n"); process.exitCode = 1; });
}
