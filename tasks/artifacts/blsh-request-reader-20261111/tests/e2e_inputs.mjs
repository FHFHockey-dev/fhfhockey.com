// TEST-ONLY e2e inputs for 2026-11-11, mirroring the bridge's post-capture/rehearsal-inputs.mjs (Leg B) with the date moved
// to 2026-11-11. The stored rows come from this lane's fake DB capture (retained 10-01 rows re-stamped to 11-11), so the real
// retained 2026-10-01 NST counts page matches them. Bridge files are imported read-only; every output goes to scratch.
//   packet      <scratch> <fixtureRequest>                          -> <scratch>/packet (real v5 bytes, hand-written TLS/RUNTIME)
//   acquisition <scratch> <fixtureRequest> <conversionDir> <outDir> -> hand-built acquisition directory (custody limit)
import { readFileSync } from "node:fs";
import { join } from "node:path";

const B = "/Users/tim/Code/fhfhockey.com/tasks/artifacts/blsh-evidence-bridge-2026-11-15";
const { APPROVED } = await import(`${B}/convert.mjs`);
const F = await import(`${B}/tests/fixtures.mjs`);
export const DATE = "2026-11-11";
export const T = { started: "2026-11-17T14:05:00.000Z", box: "2026-11-17T14:10:00.000Z", capture: "2026-11-17T14:20:00.000Z" };

const [cmd, scratch, fixtureRequest, ...rest] = process.argv.slice(2);
F.EXT.request = fixtureRequest; // syntheticDay reads EXT.request at call time
const day = () => F.syntheticDay(DATE, { captureAtUTC: T.capture, boxscoreAtUTC: T.box });
if (cmd === "packet") {
  const d = day(), src = F.successorSources(scratch), real = F.runtimeFor(T.started);
  F.makePacket(join(scratch, "packet"), { date: DATE, startedAtUTC: T.started, bodies: { individual: readFileSync(F.EXT.nstCounts), onIce: d.onIcePage },
    scheduleBody: d.scheduleBody, sources: src, runtimeOver: { node: { ...real.node, execPathSHA256: APPROVED.nodeSHA256 }, launch: F.launchFor(true),
      adapterEnvironmentPresence: { NST_KEY: true, SUPABASE_SERVICE_ROLE_KEY: true, NEXT_PUBLIC_SUPABASE_URL: true, NST_JOB_LIFECYCLE_ENABLED: false } } });
  process.stdout.write(`${JSON.stringify({ ok: true, date: DATE, successorTree: src.state, wgoRows: d.counts.wgo, games: d.counts.games })}\n`);
} else if (cmd === "acquisition") {
  const [conversionDir, outDir] = rest;
  F.makeAcquisitionDir(outDir, { boxscores: day().boxscores, startedAtUTC: T.box, conversionSHA256: F.sha(readFileSync(join(conversionDir, "CONVERSION.json"))) });
  process.stdout.write(`${JSON.stringify({ ok: true, outDir, label: "E2E hand-built acquisition (custody limit)" })}\n`);
} else { process.stdout.write(`${JSON.stringify({ ok: false, refusal: "unknown_command" })}\n`); process.exitCode = 2; }
