/** One fixed pilot, explicitly invoked after separate human approval. --check
 * reads only source/runtime files and allowlisted non-secret environment values.
 * An authorization receipt records external approval; this program cannot grant it.
 */
import { createHash } from "node:crypto";
import { closeSync, constants, fstatSync, lstatSync, openSync, readFileSync, realpathSync } from "node:fs";
import { createRequire } from "node:module";
import { dirname, isAbsolute, join, resolve } from "node:path";
import type { NativeCaptureRunInput } from "./nativeProcessCaptureRunner";

const WEB = "/Users/tim/Code/fhfhockey.com/web";
const ORIGIN = "https://fyhftlxokyjtpndbkfse.supabase.co";
const OUTPUT = "/Users/tim/Library/Application Support/fhfh-blsh-native-20261113T140500Z";
const SLOT = "2026-11-13T14:05:00.000Z";
// One start in this 60-second window; at most 120 seconds of capture work.
const LAST_START = Date.parse(SLOT) + 60_000;
const NODE_SHA256 = "daa77e22e1b8778361b392461e9921a6d292d0382ebf4ae872a0081f02f01fef";
const resolveModule = createRequire(__filename).resolve;
const SOURCE_PINS = {
  runner: ["scripts/blsh/nativeProcessCaptureRunner.ts", "5ef3a631cdc4abb8a6a8f5a2f3a379c75640fa82fb7b563a0feb9444c94099eb"],
  preparation: ["scripts/blsh/nativeProcessCapturePreparation.ts", "7f562056c16f446641917c90b41425c8c13ae97f11d6383f38e5c3cf12c3b0a7"],
  adapter: ["scripts/blsh/nativeProcessCaptureAdapter.ts", "0162fb52fe3df0b3c1b70f11b0739792a5b0f32b8dbd35b92255597a506c5368"],
  client: ["lib/nst/client.ts", "1a568c28f43e7a716677bc6d47eea47cbe86942cce376f95162fe3740cab738d"],
  budget: ["lib/nst/requestBudget.ts", "ccbab70aee15aba93818df4ef42d41195eceb39757af0ad3eef3b3dd15437e5a"],
  admission: ["lib/nst/sharedAdmission.ts", "a5f62acc1781205672c0e19aaf9c12b6cb1f6e16053876b746bc45aa210b9e4a"],
  admissionOrigin: ["lib/nst/admissionOrigin.ts", "1ffe197f90c577b477f94b54e404713a2b001c78edf12d92a249441281cdccba"],
  lifecycle: ["lib/nst/jobLifecycle.server.ts", "c28bf71b51a879f2ad7793f640e640f101bcea6318423ac3e168618f6bc3f1a8"],
  ratePolicy: ["lib/cron/nstRateLimitPolicy.ts", "f90686ed0e22f7dcc8685c111c62445004cb32744284ae22f3e37f9b6e491f2c"],
} as const;
const DEPENDENCIES = [
  ["ts-node", "node_modules/ts-node/dist/index.js", "87ec393a2dc38640a2a88a806163eb77a63badd805a9fa96c6e9434a7cdf2324", "80961faab4990ab53d33976bf716aa32444d70c64f73a487c23c21b0ca81398e"],
  ["typescript", "node_modules/typescript/lib/typescript.js", "0fba5508ecbe50cd00a45f132a76582fb22a4ec55769fd3d794fd0e026f9fb67", "1e03325943793f3bf11667b94fca412fe5ba617c85b84c16f0474933da156baa"],
  ["cheerio", "node_modules/cheerio/dist/commonjs/index.js", "ed43f738462a3ce5f277d8626dad1a0210464e38331064b3b43e1083b1ffd494", "ff0b5a83f1728f43695a00b920c20d3a8998c61b791712c1e20dcd24ad0a96b4"],
  ["memory-cache", "node_modules/memory-cache/index.js", "080bbdd424b66ccb062e39e8439653f2058c50fe94e830b2e4051db929084123", "b512a5712769e5d7e50b73bd2ded3a2247fb1c348cf9171a59fbf6e90e958daf"],
] as const;
const need = (value: unknown, code: string): void => { if (!value) throw new Error(code); };
const sha = (bytes: Buffer) => createHash("sha256").update(new Uint8Array(bytes)).digest("hex");
const fileHash = (path: string) => {
  const stat = lstatSync(path);
  need(stat.isFile() && !stat.isSymbolicLink(), "bootstrap_source_not_regular");
  return sha(readFileSync(path));
};

function checkLocalPrerequisites() {
  need(process.cwd() === WEB && realpathSync(WEB) === WEB
    && realpathSync(__filename) === join(WEB, "scripts/blsh/nativeProcessCaptureBootstrap.ts"), "bootstrap_wrong_checkout");
  need(process.version === "v22.23.4" && process.platform === "darwin" && process.arch === "arm64"
    && process.execPath === "/usr/local/bin/node" && fileHash(process.execPath) === NODE_SHA256, "bootstrap_runtime_mismatch");
  need(JSON.stringify(process.execArgv) === JSON.stringify(["--require", "./node_modules/ts-node/register/transpile-only"]), "bootstrap_loader_arguments");
  need(process.env.NODE_PATH === "." && process.env.DISABLE_V8_COMPILE_CACHE === "1"
    && process.env.TS_NODE_COMPILER_OPTIONS === '{"module":"commonjs","moduleResolution":"node"}', "bootstrap_loader_environment");
  const forbidden = ["NODE_OPTIONS", "NODE_EXTRA_CA_CERTS", "NODE_TLS_REJECT_UNAUTHORIZED", "NODE_USE_SYSTEM_CA", "NODE_USE_ENV_PROXY",
    "SSL_CERT_FILE", "SSL_CERT_DIR", "HTTPS_PROXY", "HTTP_PROXY", "ALL_PROXY", "https_proxy", "http_proxy", "all_proxy",
    "TS_NODE_PROJECT", "TS_NODE_SKIP_PROJECT", "TS_NODE_COMPILER", "TS_NODE_TRANSPILE_ONLY", "TS_NODE_REQUIRE", "TS_NODE_CWD",
    "TS_NODE_DIR", "TS_NODE_COMPILER_HOST", "TS_NODE_EMIT", "TS_NODE_SCOPE", "TS_NODE_SCOPE_DIR", "TS_NODE_SWC", "TS_NODE_TRANSPILER"];
  need(forbidden.every(key => process.env[key] === undefined), "bootstrap_runtime_override");
  need(fileHash(join(WEB, "tsconfig.json")) === "bf729d54eb8c1f8647c54f2406025cfce9e02c0b33b2a427032a83a1a963207b", "bootstrap_tsconfig_mismatch");
  for (const [name, entry, entryHash, manifestHash] of DEPENDENCIES) {
    need(resolveModule(name) === join(WEB, entry) && fileHash(join(WEB, entry)) === entryHash
      && fileHash(join(WEB, "node_modules", name, "package.json")) === manifestHash, "bootstrap_dependency_mismatch");
  }
  for (const [path, hash] of Object.values(SOURCE_PINS)) {
    // CommonJS prefers sibling .js files. Bind what imports will resolve, not
    // just the .ts bytes on disk, including pinned transitive NST modules.
    need(resolveModule(join(WEB, path.slice(0, -3))) === join(WEB, path), "bootstrap_source_resolution_mismatch");
    need(fileHash(join(WEB, path)) === hash, "bootstrap_source_pin_mismatch");
  }
  const parent = dirname(OUTPUT), stat = lstatSync(parent);
  need(stat.isDirectory() && !stat.isSymbolicLink() && realpathSync(parent) === parent
    && (stat.mode & 0o777) === 0o700 && stat.uid === process.getuid?.(), "bootstrap_private_parent_invalid");
  let absent = false;
  try { lstatSync(OUTPUT); } catch (error) { if ((error as NodeJS.ErrnoException).code === "ENOENT") absent = true; else throw error; }
  need(absent, "bootstrap_output_exists");
  return {
    state: "offline_preflight_only" as const, executionAuthorized: false, sourcePinsMatched: 9,
    bootstrapSHA256: fileHash(__filename), node: process.version,
    project: process.env.NEXT_PUBLIC_SUPABASE_URL === undefined ? "unset"
      : process.env.NEXT_PUBLIC_SUPABASE_URL === ORIGIN ? "pinned" : "mismatch",
    lifecycle: process.env.NST_JOB_LIFECYCLE_ENABLED === "true" ? "enabled" : "disabled",
    proposedSlotUTC: SLOT, latestStartExclusiveUTC: new Date(LAST_START).toISOString(), proposedOutputDirectory: OUTPUT,
    credentialsInspected: false, networkRequests: 0, outputCreated: false,
  };
}

function readAuthorization(path: string, bootstrapSHA256: string) {
  need(isAbsolute(path) && path.endsWith(".json"), "bootstrap_authorization_path");
  const fd = openSync(path, constants.O_RDONLY | constants.O_NOFOLLOW);
  let receipt: Record<string, unknown>;
  try {
    const stat = fstatSync(fd);
    need(stat.isFile() && stat.size > 0 && stat.size <= 16_384 && (stat.mode & 0o777) === 0o600
      && stat.uid === process.getuid?.(), "bootstrap_authorization_file");
    const bytes = readFileSync(fd);
    need(bytes.length <= 16_384, "bootstrap_authorization_file");
    receipt = JSON.parse(new TextDecoder("utf-8", { fatal: true }).decode(bytes)) as Record<string, unknown>;
  } finally { closeSync(fd); }
  need(receipt !== null && typeof receipt === "object" && !Array.isArray(receipt), "bootstrap_authorization_shape");
  const fields = ["version", "approvedBy", "approvedAtUTC", "approvalReference", "operator", "bootstrapSHA256", "slotStartUTC", "outputDirectory",
    "supabaseOrigin", "lifecycleMode", "maximumHTTPAttempts", "coordinationReceipt", "runtimeReceipt", "admissionReceipt"];
  need(Object.keys(receipt).sort().join() === fields.sort().join(), "bootstrap_authorization_fields");
  need(receipt.version === "fhfh.blsh.native-pilot-authorization.v1" && receipt.approvedBy === "TJ"
    && receipt.bootstrapSHA256 === bootstrapSHA256 && receipt.slotStartUTC === SLOT && receipt.outputDirectory === OUTPUT
    && receipt.supabaseOrigin === ORIGIN && receipt.lifecycleMode === "disabled" && receipt.maximumHTTPAttempts === 5, "bootstrap_authorization_scope");
  for (const key of ["approvalReference", "operator", "coordinationReceipt", "runtimeReceipt", "admissionReceipt"])
    need(typeof receipt[key] === "string" && /^[A-Za-z0-9._:-]{1,200}$/.test(receipt[key] as string), "bootstrap_authorization_reference");
  need(typeof receipt.approvedAtUTC === "string" && /^2026-11-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/.test(receipt.approvedAtUTC)
    && Number.isFinite(Date.parse(receipt.approvedAtUTC)) && Date.parse(receipt.approvedAtUTC) <= Date.now(), "bootstrap_authorization_time");
}

let attempted = false;
export async function nativeProcessCaptureBootstrap(args: readonly string[]) {
  need(args.length === 0 || (args.length === 1 && args[0] === "--check") || (args.length === 2 && args[0] === "--run"), "bootstrap_arguments");
  if (args[0] !== "--run") return checkLocalPrerequisites();
  need(!attempted, "bootstrap_already_attempted"); attempted = true;
  const preflight = checkLocalPrerequisites();
  readAuthorization(args[1], preflight.bootstrapSHA256);
  const checkExecution = () => {
    need(Date.now() >= Date.parse(SLOT) && Date.now() < LAST_START, "bootstrap_outside_approved_slot");
    need(process.env.NEXT_PUBLIC_SUPABASE_URL === ORIGIN && process.env.NST_JOB_LIFECYCLE_ENABLED !== "true", "bootstrap_configured_environment_mismatch");
  };
  checkExecution();
  // No runtime module or adapter factory is loaded by --check. Credential access
  // begins only in the separately approved path, after every local gate above.
  const { prepareNativeProcessCapture } = await import("./nativeProcessCapturePreparation");
  const { runNativeProcessCapture } = await import("./nativeProcessCaptureRunner");
  const { createNativeProcessCaptureAdapter } = await import("./nativeProcessCaptureAdapter");
  checkExecution();
  const input: NativeCaptureRunInput = {
    plan: prepareNativeProcessCapture({ seasonId: 20262027, date: "2026-11-07", plannedAtUTC: new Date().toISOString(), groups: ["individual", "onIce"] }),
    supabaseOrigin: ORIGIN, lifecycleMode: "disabled",
    sourceSHA256: Object.fromEntries(Object.entries(SOURCE_PINS).map(([role, [, hash]]) => [role, hash])) as NativeCaptureRunInput["sourceSHA256"],
  };
  try {
    const adapter = createNativeProcessCaptureAdapter(input);
    checkExecution();
    await runNativeProcessCapture(input, adapter, OUTPUT);
    return { state: "packet_complete_pending_review", executionAuthorized: false, sourceAcceptance: false };
  } catch { throw new Error("bootstrap_capture_failed_preserve_packet_no_retry"); }
}

if (require.main === module) {
  void nativeProcessCaptureBootstrap(process.argv.slice(2)).then(result => process.stdout.write(`${JSON.stringify(result)}\n`)).catch(() => {
    process.stderr.write("BLSH bootstrap failed. Preserve any packet; no automatic retry.\n");
    process.exitCode = 1;
  });
}
