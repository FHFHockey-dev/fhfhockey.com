// Offline review of the exact buffers returned by readNativeV6Ledger. The result
// describes a dated packet. Only the independent review and policy owner can admit rows.
import { execFileSync } from "node:child_process";
import { fileURLToPath } from "node:url";
import { isDeepStrictEqual } from "node:util";
import { load } from "cheerio";
import { RUNTIME_DISPATCHER, verifyTlsChain } from "../../../tasks/artifacts/blsh-evidence-bridge-2026-11-15/convert.mjs";
import { GROUPS, MIB, canonicalNstUrl, isHash, need, parseJson, sha, stamp } from "../../../tasks/artifacts/blsh-evidence-bridge-2026-11-15/lib.mjs";

const ROOT = fileURLToPath(new URL("../../../", import.meta.url));
const ORIGIN = "https://fyhftlxokyjtpndbkfse.supabase.co";
const ADMISSION = ORIGIN + "/rest/v1/rpc/nst_admit_attempt_v1";
// Reviewed producer profile from release 5c42cb14f. The external deployment
// mapping selects the commit. Changed source requires its own review.
const SOURCE_PINS = {
  "web/lib/blsh/nativeCaptureV6/core.ts": "27c8168ca4f0b3ba7759ab55ed2c5b70c70fb729105c5fa2e8509a2d1d8f6a72",
  "web/lib/blsh/nativeCaptureV6/adapter.ts": "9b4df0df724943367a69e2b4fb6fe10d5fd16f804b5a6aef46bf001b0610dc93",
  "web/lib/blsh/nativeCaptureV6/tlsObservation.ts": "fb163bee31d483fe6476f5578dc3be15a84dd414d8b6ffce3d19e610e43d7282",
  "web/lib/blsh/nativeCaptureV6/runtimeReceipt.ts": "ff61288fdf08b297f58b2d57fe6056e944dd28a0a4c89b084d80f90f9e8c385f",
  "web/lib/blsh/nativeCaptureV6/handler.ts": "f55ad209af2cd246a8e36bdeb63f71022826acec63603d72dcc8ea56775765dd",
  "web/lib/blsh/nativeCaptureV6/sourceDate.ts": "8eb64a5963d7c1c5127531238ce49fa5ffe616e5533f01897df0d80d55c05179",
  "web/lib/blsh/nativeCaptureV6/writer.ts": "c5598effe186c89615193f2898906d0a1ea2c393cbb9e4ddae5696d0c66aec77",
  "web/lib/blsh/nativeCaptureV6/sink.ts": "26e70e3fbd2662aca9313595e7edb8c057b647cd9fbf84f8c9c04a2470930b40",
  "web/scripts/blsh/nativeProcessCapturePreparation.ts": "7f562056c16f446641917c90b41425c8c13ae97f11d6383f38e5c3cf12c3b0a7",
  "web/lib/nst/client.ts": "1a568c28f43e7a716677bc6d47eea47cbe86942cce376f95162fe3740cab738d",
};

function verifySourcePins(commit) {
  need(/^[0-9a-f]{40}$/.test(commit), "release_commit_invalid");
  for (const [path, digest] of Object.entries(SOURCE_PINS)) {
    const bytes = execFileSync("git", ["--no-replace-objects", "--no-lazy-fetch", "cat-file", "blob", commit + ":" + path],
      { cwd: ROOT, maxBuffer: MIB, stdio: ["ignore", "pipe", "ignore"] });
    need(sha(bytes) === digest, "release_source_profile_changed");
  }
}

const OVERRIDES = ["NODE_EXTRA_CA_CERTS", "NODE_TLS_REJECT_UNAUTHORIZED", "NODE_OPTIONS", "NODE_USE_SYSTEM_CA", "NODE_USE_ENV_PROXY",
  "SSL_CERT_FILE", "SSL_CERT_DIR", "HTTPS_PROXY", "HTTP_PROXY", "ALL_PROXY", "NO_PROXY", "https_proxy", "http_proxy", "all_proxy", "no_proxy"];
const keysAre = (o, keys) => o && isDeepStrictEqual(Object.keys(o).sort(), keys.split(" ").sort());
const hasDigestOrReason = (digest, reason) => isHash(digest) ? reason === null :
  digest === null && ["path_unknown", "not_regular_file", "too_large", "unreadable"].includes(reason);

function reviewRuntime(rt) {
  need(keysAre(rt, "version startedAtUTC node tls environmentPresence supabaseOrigin lifecycleMode adapterEnvironmentPresence deployment instance globalDispatcher valuesRecorded")
    && rt.valuesRecorded === false, "runtime_shape");
  const { node, tls, deployment, instance } = rt;
  need(keysAre(node, "version execPath execPathSHA256 execPathUnavailable execArgv") && /^v22\.\d+\.\d+$/.test(node.version)
    && typeof node.execPath === "string" && node.execPath.startsWith("/") && hasDigestOrReason(node.execPathSHA256, node.execPathUnavailable)
    && isDeepStrictEqual(node.execArgv, []), "runtime_node_profile");
  need(isDeepStrictEqual(rt.environmentPresence, Object.fromEntries(OVERRIDES.map(key => [key, false])))
    && isDeepStrictEqual(rt.adapterEnvironmentPresence, { NST_KEY: true, SUPABASE_SERVICE_ROLE_KEY: true, NEXT_PUBLIC_SUPABASE_URL: true,
      NST_JOB_LIFECYCLE_ENABLED: false }), "runtime_environment_profile");
  need(keysAre(tls, "defaultCACertificatesSHA256 defaultCACertificateCount rootCertificatesSHA256 rootCertificateCount")
    && isHash(tls.rootCertificatesSHA256) && tls.rootCertificatesSHA256 === tls.defaultCACertificatesSHA256
    && Number.isSafeInteger(tls.rootCertificateCount) && tls.rootCertificateCount > 0 && tls.rootCertificateCount === tls.defaultCACertificateCount
    && isDeepStrictEqual(rt.globalDispatcher, RUNTIME_DISPATCHER), "runtime_trust_profile");
  need(keysAre(deployment, "provider deploymentId env region gitCommitSha gitCommitRef routeBundleSHA256 routeBundleUnavailable")
    && hasDigestOrReason(deployment.routeBundleSHA256, deployment.routeBundleUnavailable)
    && keysAre(instance, "coldStart invocationOrdinal processUptimeMs") && instance.coldStart === (instance.invocationOrdinal === 1)
    && Number.isSafeInteger(instance.processUptimeMs) && instance.processUptimeMs >= 0, "runtime_instance_profile");
}

function completedGameIds(scheduleBytes, date) {
  const days = parseJson(scheduleBytes).gameWeek?.filter(day => day.date === date);
  need(days?.length === 1 && Array.isArray(days[0].games) && days[0].games.length > 0, "schedule_day_unavailable");
  const teamIds = new Set(), teamCodes = new Set(), ids = new Set();
  for (const game of days[0].games) {
    need(Number.isSafeInteger(game.id) && /^202602\d{4}$/.test(String(game.id)) && !ids.has(game.id)
      && game.season === 20262027 && game.gameType === 2 && ["OFF", "FINAL"].includes(game.gameState) && game.gameScheduleState === "OK", "schedule_scope_or_finality");
    ids.add(game.id);
    for (const team of [game.homeTeam, game.awayTeam]) {
      need(Number.isSafeInteger(team?.id) && team.id > 0 && !teamIds.has(team.id) && typeof team.abbrev === "string" && /^[A-Z]{2,3}$/.test(team.abbrev)
        && !teamCodes.has(team.abbrev), "schedule_team_identity");
      teamIds.add(team.id);
      teamCodes.add(team.abbrev);
    }
  }
  return [...ids].sort((a, b) => a - b);
}

export function reviewNativeV6Packet({ receipt, files }) {
  const json = name => parseJson(files.get(name));
  const rt = json("RUNTIME.json"), plan = json("PLAN.json"), manifest = json("MANIFEST.json");
  const start = stamp(rt.startedAtUTC), end = stamp(manifest.completedAtUTC);
  const date = receipt.sourceDate, pages = GROUPS.map(group => ({ group, url: canonicalNstUrl(date, group) }));
  const { input, expiresAtUTC, pages: savedPages, ...fixedPlan } = plan;
  const planned = stamp(input.plannedAtUTC);
  // All remaining fields are fixed producer output, including the transport
  // budgets and non-admission claims. Bind their original JSON field order.
  need(sha(JSON.stringify(fixedPlan)) === "ab22216abe3e3d9f0812ecc028ef94e9bccc5e71629fa9347c7fd775850abc2f"
    && isDeepStrictEqual(savedPages, pages) && isDeepStrictEqual(input, { seasonId: 20262027, date, plannedAtUTC: new Date(planned).toISOString(), groups: GROUPS })
    && planned <= start && start - planned <= 900000 && expiresAtUTC === new Date(planned + 900000).toISOString(), "capture_plan_scope_or_expiry");
  reviewRuntime(rt);

  const observations = {}, ops = {}, bodies = {};
  let previousEnd = start, permitStart, firstNstStart;
  const order = ["schedule", "admission:individual", "nst:individual", "admission:onIce", "nst:onIce"];
  for (const [index, operation] of order.entries()) {
    const started = json(`operation-${index + 1}-STARTED.json`), settled = json(`operation-${index + 1}-SETTLED.json`);
    const from = stamp(started.startedAtUTC), to = stamp(settled.completedAtUTC);
    const admission = operation.startsWith("admission:"), schedule = operation === "schedule";
    const group = schedule ? "schedule" : operation.split(":")[1];
    const url = schedule ? "https://api-web.nhle.com/v1/schedule/" + date : admission ? ADMISSION : canonicalNstUrl(date, group);
    need(keysAre(started, "operation url method startedAtUTC") && keysAre(settled, "operation completedAtUTC permit transport tls")
      && started.operation === operation && settled.operation === operation && started.url === url && started.method === (admission ? "POST" : "GET"), "journal_operation_scope");
    // The schedule's STARTED time precedes its separately budgeted 20 s storage checkpoint.
    need(from >= previousEnd && to >= from && to <= end && to - from < (admission ? 1000 : schedule ? 35000 : 15000), "journal_chronology");
    ops[index + 1] = { started, settled };
    previousEnd = to;
    if (admission) {
      need(settled.permit === "allowed" && settled.transport === null, "journal_admission");
      permitStart = from;
      continue;
    }
    if (!schedule) {
      need(from - permitStart < 1000 && (firstNstStart === undefined || from - firstNstStart >= 22000), "journal_permit_or_spacing");
      firstNstStart ??= from;
    }
    const obs = json(group + ".TRANSPORT-OBSERVATION.json"), transport = settled.transport;
    const filename = group + (schedule ? ".raw.json" : ".parser-input.html"), body = files.get(filename);
    const max = schedule ? MIB : 2 * MIB;
    need(settled.permit === null && transport?.httpStatus === 200 && transport.finalUrlMatchesRequested === true && transport.redirected === false
      && Number.isSafeInteger(transport.decodedBytes) && transport.decodedBytes > 0 && transport.decodedBytes <= max, "journal_transport");
    need(keysAre(obs, "status operation file sha256 bytes retrievedAtUTC retainedAtUTC httpStatus finalUrl redirected TLSVerified tls tlsEvidence representation deploymentBinding parsedRows completedGameIds originalPublicationUTC modelDefinition independentlyAccepted advancedAdmission score")
      && obs.operation === operation && obs.file === filename && obs.sha256 === sha(body) && obs.bytes === body.length && body.length <= max
      && obs.finalUrl === url && obs.httpStatus === 200 && obs.redirected === false && obs.retrievedAtUTC === settled.completedAtUTC
      && obs.representation === (schedule ? "original_decoded_body" : "client_redacted_parser_input"), "observation_binding");
    need(obs.status === "candidate_requires_adapter_and_source_review" && obs.tlsEvidence === "pending_runtime_review" && obs.TLSVerified === null
      && obs.originalPublicationUTC === null && obs.modelDefinition === "unknown" && obs.score === null && obs.independentlyAccepted === false
      && obs.advancedAdmission === false, "observation_overclaim");
    previousEnd = stamp(obs.retainedAtUTC);
    need(previousEnd >= to && previousEnd <= end, "observation_retention_time");
    if (schedule) {
      need(transport.decodedBytes === body.length && obs.parsedRows === null
        && isDeepStrictEqual(obs.completedGameIds, completedGameIds(body, date)), "schedule_observation_mismatch");
    } else {
      // The retained HTML is redacted. Its size can differ from transport.decodedBytes.
      const $ = load(new TextDecoder("utf-8", { fatal: true }).decode(body));
      const rows = $("table tr").filter((_, tr) => $(tr).children("td").length > 0).length;
      need(obs.completedGameIds === null && rows > 0 && rows <= 5000 && obs.parsedRows === rows, "parser_input_rows");
    }
    observations[group] = obs;
    bodies[group] = { file: filename, sha256: obs.sha256, bytes: body.length, retrievedAtUTC: obs.retrievedAtUTC };
  }
  verifyTlsChain(ops, observations, rt.tls.defaultCACertificatesSHA256, rt.globalDispatcher);
  verifySourcePins(receipt.gitCommitSha);
  return { ...receipt, status: "v6_packet_profile_checked_pending_independent_review",
    profileVersion: "fhfh.blsh.offline-v6-packet-review.v1", sourceFiles: SOURCE_PINS, bodies, completedGameIds: observations.schedule.completedGameIds,
    completeLatestFiveEstablished: false, currentUseQualified: false, score: null, independentlyAccepted: false, advancedAdmission: false };
}
