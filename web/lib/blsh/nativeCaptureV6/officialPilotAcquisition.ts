import { createHash } from "node:crypto";
import { constants, openSync, fstatSync, readSync, closeSync } from "node:fs";
import { performance } from "node:perf_hooks";
import { decodeReviewedEvidenceJSON } from "../../buyLowSellHigh/reviewedFiveGameWindow.server";
import { NST_ADMISSION_PROJECT_HOST } from "../../nst/admissionOrigin";
import { defaultCAStoreSHA256, RUNTIME_OVERRIDE_KEYS } from "./runtimeReceipt";
import type { OfficialPilotStore, OfficialPilotTarget } from "./officialPilotStore";
import { BUDGET, getBox, liveRoots, officialUrl } from "./officialPilotAcquisition.transport.mjs";

export const OFFICIAL_ORIGIN = "https://" + NST_ADMISSION_PROJECT_HOST;
export const OFFICIAL_SLOT = Date.parse("2026-11-22T12:45:00Z");
export const officialSlot = (wall: number) => wall >= OFFICIAL_SLOT && wall < OFFICIAL_SLOT + 60000;
const digest = (bytes: Uint8Array | string) => createHash("sha256").update(bytes).digest("hex");
export const pilotDigest = (bytes: Buffer) => digest(new Uint8Array(bytes.buffer, bytes.byteOffset, bytes.byteLength));
const json = (value: unknown) => Buffer.from(JSON.stringify(value) + "\n");
const iso = (time: number) => new Date(time).toISOString();
const need = (ok: unknown, code: string) => { if (!ok) throw new Error(code); };
export type FixtureSocket = { port: number; ca: string };
export type PilotIntake = { approval: OfficialPilotTarget; grantBase64: string; acquisitionPinsSHA256: string };
export type PilotClock = { wall: number; mono: number };
export const pilotClock = (): PilotClock => ({ wall: Date.now(), mono: performance.now() });
function remaining(start: PilotClock, now: PilotClock, limit: number) {
  if (now.wall < start.wall || now.mono < start.mono) return -1;
  return Math.floor(limit - Math.max(now.wall - start.wall, now.mono - start.mono));
}
function fits(start: PilotClock, now: PilotClock, limit: number, reserve: number) {
  return remaining(start, now, limit) >= reserve;
}
export const outerRemaining = (ingress: PilotClock) => remaining(ingress, pilotClock(), 225000);
export function outerTime(ingress: PilotClock, reserve = 0) {
  need(fits(ingress, pilotClock(), 225000, reserve), "official_function_deadline");
}

/** The deployed JS and executable are read-only runtime identities. Never create local custody files. */
function fileDigest(path: string, maxBytes: number, ingress: PilotClock) {
  const fd = openSync(path, constants.O_RDONLY | constants.O_NOFOLLOW | constants.O_NONBLOCK);
  try {
    const info = fstatSync(fd);
    need(info.isFile() && info.size > 0 && info.size <= maxBytes, "official_runtime_file");
    const chunk = new Uint8Array(65536), hash = createHash("sha256");
    for (let offset = 0; offset < info.size;) {
      outerTime(ingress, BUDGET.totalMs + 10000);
      const n = readSync(fd, chunk, 0, Math.min(chunk.length, info.size - offset), offset);
      need(n > 0, "official_runtime_file"); hash.update(chunk.subarray(0, n)); offset += n;
    }
    const end = fstatSync(fd);
    need(end.size === info.size && end.mtimeMs === info.mtimeMs, "official_runtime_file");
    return hash.digest("hex");
  } finally { closeSync(fd); }
}

export function officialRuntime(routePath: string, ingress: PilotClock, fixture?: FixtureSocket) {
  need(/^v22\.\d+\.\d+$/.test(process.version) && process.versions.modules === "127" && process.execArgv.length === 0
    && typeof routePath === "string" && routePath.startsWith("/") && process.env.VERCEL_REGION === "iad1"
    && (process.env.VERCEL_PROJECT_ID === undefined || process.env.VERCEL_PROJECT_ID === "prj_LV0wbwH5gRjOsZlowzEFNGRuX7Lw"), "official_runtime_identity");
  const overrideKeysPresent = RUNTIME_OVERRIDE_KEYS.filter(key => Object.hasOwn(process.env, key));
  const roots = liveRoots(), defaultCASHA256 = defaultCAStoreSHA256(), bundledCASHA256 = digest(roots.join("\n"));
  need(!overrideKeysPresent.length && roots.length > 0 && defaultCASHA256 === bundledCASHA256, "official_trust_store_mismatch");
  return { acquisitionClass: fixture ? "loopback_fixture_only" : "vercel_direct_https", supabaseOrigin: OFFICIAL_ORIGIN,
    region: process.env.VERCEL_REGION!, nodeVersion: process.version, nodeABI: process.versions.modules, opensslVersion: process.versions.openssl,
    execPathSHA256: fileDigest(process.execPath, 512 * 1024 * 1024, ingress), routeBundleSHA256: fileDigest(routePath, 64 * 1024 * 1024, ingress),
    bundledCASHA256: fixture ? digest(fixture.ca) : bundledCASHA256, defaultCASHA256, overrideKeysPresent,
    ...(fixture ? { fixtureCA: fixture.ca } : {}) };
}

type BoxResponse = { body: Buffer; tls: unknown; writes: number; httpStatus: number; dispatchedAtUTC: string };
export async function runOfficialPilot(store: OfficialPilotStore, runId: string, intake: PilotIntake,
  runtime: ReturnType<typeof officialRuntime>, ingress: PilotClock, fixture?: FixtureSocket) {
  const { approval, grantBase64, acquisitionPinsSHA256 } = intake, start = pilotClock(), startedAtUTC = iso(start.wall);
  need(officialSlot(start.wall), "official_slot_closed");
  const files: { file: string; bytes: number; sha256: string }[] = [];
  let lastRetrieval = start.wall;
  const check = (reserve = 0) => {
    const now = pilotClock();
    need(now.wall >= lastRetrieval && fits(start, now, BUDGET.totalMs, reserve), "official_acquisition_deadline");
    outerTime(ingress, Math.max(reserve, 5000));
  };
  const closeRemaining = () => Math.min(remaining(start, pilotClock(), BUDGET.totalMs), outerRemaining(ingress));
  const put = async (file: string, bytes: Buffer, journal?: PilotClock) => {
    check();
    const sha256 = pilotDigest(bytes), ordinal = files.length + 1;
    // The original bytes and index (a journal's intent) are one acknowledged SQL commit.
    const remainingMs = () => Math.min(closeRemaining(), outerRemaining(ingress) - 5000,
      journal ? remaining(journal, pilotClock(), BUDGET.perRequestTimeoutMs) : Infinity);
    need(remainingMs() > 0, "official_acquisition_deadline");
    await store.putObject(runId, approval.sourceDate, ordinal, file, bytes, sha256, remainingMs);
    check(); files.push({ file, bytes: bytes.length, sha256 }); return sha256;
  };
  await put("RUNTIME.json", json({ version: "fhfh.blsh.official-pilot-runtime.v1", ...runtime, ...approval, runId, grantBase64, acquisitionPinsSHA256, startedAtUTC }));
  for (const [index, gameId] of approval.gameIds.entries()) {
    if (index) { check(BUDGET.spacingMs + BUDGET.perRequestTimeoutMs); await new Promise(resolve => setTimeout(resolve, BUDGET.spacingMs)); }
    check(BUDGET.perRequestTimeoutMs);
    const journal = pilotClock(), operation = index + 1, url = officialUrl(gameId);
    need(journal.wall >= lastRetrieval + (index ? BUDGET.spacingMs : 0), "official_acquisition_chronology");
    const journalSHA256 = await put(`operation-${operation}-STARTED.json`, json({ operation, method: "GET", url, acquisitionPinsSHA256, startedAtUTC: iso(journal.wall) }), journal);
    check(BUDGET.perRequestTimeoutMs);
    const result = await getBox(url, journal.wall, journal.mono, start.wall, start.mono, fixture) as BoxResponse;
    const end = pilotClock();
    need(fits(journal, end, BUDGET.perRequestTimeoutMs, 0) && Date.parse(result.dispatchedAtUTC) <= end.wall
      && result.httpStatus === 200 && result.writes === 1 && result.body.length > 0 && result.body.length <= BUDGET.maxBodyBytes, "official_provider_receipt");
    lastRetrieval = end.wall; check();
    const box = decodeReviewedEvidenceJSON<Record<string, unknown>>(new Uint8Array(result.body));
    need(box.id === gameId && box.gameDate === approval.sourceDate && box.season === 20262027 && box.gameType === 2
      && (box.gameState === "FINAL" || box.gameState === "OFF") && box.gameScheduleState === "OK", "official_game_scope");
    const sha256 = await put(`boxscore-${gameId}.body.json`, result.body);
    await put(`boxscore-${gameId}.receipt.json`, json({ version: "fhfh.blsh.v6-official-boxscore-receipt.v2", acquisitionPinsSHA256, journalSHA256,
      acquisitionStartedAtUTC: startedAtUTC, operation, url, finalUrl: url, method: "GET", httpStatus: 200, redirected: false, writeEvents: 1,
      dispatchedAtUTC: result.dispatchedAtUTC, retrievedAtUTC: iso(end.wall), sha256, bytes: result.body.length, tls: result.tls }));
  }
  check();
  const manifest = json({ version: "fhfh.blsh.official-pilot-manifest.v1", status: "acquisition_complete_pending_review", runId, ...approval, acquisitionPinsSHA256,
    requests: approval.gameIds.length, retries: 0, completedAtUTC: iso(Date.now()), files });
  const manifestSHA256 = await put("MANIFEST.json", manifest);
  check(5000);
  return { manifest, manifestSHA256, closeRemaining };
}
