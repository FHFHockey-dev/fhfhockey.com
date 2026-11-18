import { execFileSync } from "node:child_process";
import { expect, vi } from "vitest";
import { prepareNativeProcessCapture } from "./nativeProcessCapturePreparation";
import { runNativeCaptureV6, PINNED_SUPABASE_ORIGIN, type NativeCaptureAdapterV6 } from "../../lib/blsh/nativeCaptureV6/core";
import { createFakeCaptureStore } from "../../lib/blsh/nativeCaptureV6/fakeCaptureStore.testHelper";
import { RUNTIME_OVERRIDE_KEYS } from "../../lib/blsh/nativeCaptureV6/runtimeReceipt";
import { createPacketSink } from "../../lib/blsh/nativeCaptureV6/sink";

export const sourceDate = "2026-11-20", now = "2026-11-21T12:05:00.000Z", deploymentId = "dpl_fixture";
const json = (data: unknown) => Buffer.from(JSON.stringify(data, null, 2) + "\n");

export const fixtureGames = [
  { id: 2026020301, homeTeam: { id: 1, abbrev: "NJD" }, awayTeam: { id: 2, abbrev: "NYI" } },
  { id: 2026020302, homeTeam: { id: 3, abbrev: "NYR" }, awayTeam: { id: 4, abbrev: "PHI" } },
];

// Real core, plan, runtime receipt and checkpointed packet sink. Only the Storage/SQL
// store, HTTPS dispatch results, wall/monotonic clock and hosted environment are fixtures.
export async function capture(html: (group: "individual" | "onIce") => string = () => "<table><tr><td>é 🏒</td></tr></table>\r\n",
  games = [fixtureGames[0]]) {
  vi.useFakeTimers();
  vi.setSystemTime(now);
  const execArgv = process.execArgv;
  process.execArgv = [];
  for (const key of [...RUNTIME_OVERRIDE_KEYS, "VERCEL_GIT_COMMIT_SHA", "NST_JOB_LIFECYCLE_ENABLED"]) vi.stubEnv(key, undefined);
  for (const [key, value] of Object.entries({ VERCEL_ENV: "production", VERCEL_DEPLOYMENT_ID: deploymentId, VERCEL_REGION: "iad1",
    NST_KEY: "fixture", SUPABASE_SERVICE_ROLE_KEY: "fixture", NEXT_PUBLIC_SUPABASE_URL: PINNED_SUPABASE_ORIGIN })) vi.stubEnv(key, value);
  const fake = createFakeCaptureStore();
  const deployment = { deploymentId, gitCommitSha: null, region: "iad1", invocationOrdinal: 1 };
  const claim = await fake.store.claim({ sourceDate, deployment });
  if (!claim.claimed) throw new Error("missing_claim");
  const { runId } = claim;
  const sink = createPacketSink({ store: fake.store, runId, sourceDate });
  try {
    let sequence = 0;
    const tls = (url: string) => ({
      channel: "undici:client:sendHeaders", authorized: true, authorizationError: null, servername: new URL(url).hostname,
      alpnProtocol: "http/1.1", protocol: "TLSv1.3", cipher: { name: "TLS_AES_128_GCM_SHA256", standardName: "TLS_AES_128_GCM_SHA256", version: "TLSv1.3" },
      sessionReused: false, connectionReused: false, connectionSequence: ++sequence, peerCertificate: { fingerprint256: Array(32).fill("AA").join(":"),
        valid_from: "Oct  1 00:00:00 2026 GMT", valid_to: "Dec 31 00:00:00 2026 GMT", subjectCN: new URL(url).hostname, issuerCNChain: ["fixture CA"] },
    });
    const response = (url: string, bytes: Buffer) => ({ bytes, status: 200, finalUrl: url, redirected: false, tls: tls(url) });
    const adapter: NativeCaptureAdapterV6 = { sourceDate, supabaseOrigin: PINNED_SUPABASE_ORIGIN,
      schedule: dispatch => dispatch("schedule", async spec => response(spec.url, json({ gameWeek: [{ date: sourceDate, games: games.map(game => ({
        ...game, season: 20262027, gameType: 2, gameState: "OFF", gameScheduleState: "OK",
      })) }] }))),
      async nst(group, url, { dispatch }) {
        await dispatch(`admission:${group}`, async spec => ({ kind: "admission", valid: true, allowed: true, httpStatus: 200, waitMs: 0, tls: tls(spec.url) }));
        return dispatch(`nst:${group}`, async () => response(url, Buffer.from(html(group))));
      },
    };
    const plan = prepareNativeProcessCapture({ seasonId: 20262027, date: sourceDate, plannedAtUTC: now, groups: ["individual", "onIce"] });
    const capture = runNativeCaptureV6({ plan, runId, sourceDate, supabaseOrigin: PINNED_SUPABASE_ORIGIN, routeBundlePath: null,
      invocationOrdinal: 1 }, adapter, sink);
    const completed = expect(capture).resolves.toHaveProperty("state", "packet_complete_pending_review");
    await vi.runAllTimersAsync();
    await completed;
    const record = fake.runs.get(runId)!;
    const puts = fake.calls.filter(call => call.kind === "putObject"), intents = fake.calls.filter(call => call.kind === "intent");
    const run = { run_id: runId, pipeline: "native-v6", source_date: sourceDate, pruned_at: null as string | null, state: record.state, reason: record.reason,
      manifest_sha256: record.manifestSHA256, deployment, claimed_at: now, closed_at: new Date(fake.calls.at(-1)!.at).toISOString(),
      operation_intents: record.intents.map((value, i) => ({ ...(value as object), intendedAtUTC: new Date(intents[i].at).toISOString() })) };
    const objects = [...fake.objects].map(([path, item]) => ({ ordinal: item.ordinal, run_id: runId, path, bytes: item.bytes.length,
      written_at: new Date(puts[item.ordinal - 1].at).toISOString().replace("Z", "000+00:00"), sha256: item.sha256 }));
    const bytes = new Map([...fake.objects].map(([path, item]) => [path, item.bytes]));
    const gitCommitSha = execFileSync("git", ["rev-parse", "HEAD"], { encoding: "utf8" }).trim();
    const pins = { deploymentId, gitCommitSha, sourceDate, runId };
    return { run, objects, bytes, pins };
  } finally {
    sink.dispose();
    vi.unstubAllEnvs();
    vi.useRealTimers();
    process.execArgv = execArgv;
  }
}
