// BLSH operator: predict RUNTIME.json (successor HANDOFF §3, v5 shape) from the CURRENT process, before the slot.
// Run from web/ as: node --require ./node_modules/ts-node/register/transpile-only <this> '<adapter presence JSON>'
// Reads only key PRESENCE from process.env (no values), plus the public project URL comparison and lifecycle flag.
// adapterEnvironmentPresence for the two secret keys is supplied by the caller as booleans (from the file probe);
// the secrets themselves are never in this process. No network, no writes.
// v5: `launch` is predicted for the launcher's FIXED argv (scripts/blsh/nativeProcessCaptureBootstrap.ts from web/);
// `globalDispatcher` is predicted by checking the undici registry is empty, then loading the pinned `cheerio`
// (which loads npm undici and registers its default Agent), exactly as the runner's imports do.
"use strict";
const tls = require("node:tls"), crypto = require("node:crypto"), fs = require("node:fs"), path = require("node:path");
const { createRequire } = require("node:module");
const ORIGIN = "https://fyhftlxokyjtpndbkfse.supabase.co";
const RUNTIME_ENV = ["NODE_EXTRA_CA_CERTS", "NODE_TLS_REJECT_UNAUTHORIZED", "NODE_OPTIONS", "NODE_USE_SYSTEM_CA", "NODE_USE_ENV_PROXY",
  "SSL_CERT_FILE", "SSL_CERT_DIR", "HTTPS_PROXY", "HTTP_PROXY", "ALL_PROXY", "NO_PROXY", "https_proxy", "http_proxy", "all_proxy", "no_proxy"];
const LAUNCH_ENV = ["NODE_PATH", "DISABLE_V8_COMPILE_CACHE", "TS_NODE_COMPILER_OPTIONS", "OPENSSL_CONF", "TS_NODE_PROJECT", "TS_NODE_SKIP_PROJECT",
  "TS_NODE_COMPILER", "TS_NODE_TRANSPILE_ONLY", "TS_NODE_REQUIRE", "TS_NODE_CWD", "TS_NODE_DIR", "TS_NODE_COMPILER_HOST", "TS_NODE_EMIT",
  "TS_NODE_SCOPE", "TS_NODE_SCOPE_DIR", "TS_NODE_SWC", "TS_NODE_TRANSPILER"];
const DISPATCHER = Symbol.for("undici.globalDispatcher.1");
const h = s => crypto.createHash("sha256").update(s).digest("hex");
const supplied = JSON.parse(process.argv[2] || "{}");
const has = k => Object.prototype.hasOwnProperty.call(process.env, k);

// Bootstrap rule: no dispatcher may be registered before the runtime imports.
const preinstalled = globalThis[DISPATCHER] !== undefined;
createRequire(path.join(process.cwd(), "scripts/blsh/nativeProcessCaptureRunner.ts"))("cheerio");
const atLoad = globalThis[DISPATCHER];

const entry = path.resolve(process.cwd(), "scripts/blsh/nativeProcessCaptureBootstrap.ts");
const entrySHA = fs.existsSync(entry) ? h(fs.readFileSync(entry)) : null;
const defaults = tls.getCACertificates("default");
const predicted = {
  version: "fhfh.blsh.native-capture-runtime.v1",
  startedAtUTC: "PREDICTED",
  node: { version: process.version, execPath: process.execPath, execPathSHA256: h(fs.readFileSync(process.execPath)), execArgv: process.execArgv },
  tls: { rootCertificatesSHA256: h(tls.rootCertificates.join("\n")), rootCertificateCount: tls.rootCertificates.length,
         defaultCACertificatesSHA256: h(defaults.join("\n")), defaultCACertificateCount: defaults.length },
  environmentPresence: Object.fromEntries(RUNTIME_ENV.map(k => [k, has(k)])),
  supabaseOrigin: process.env.NEXT_PUBLIC_SUPABASE_URL?.trim() === ORIGIN ? ORIGIN : "NOT_PINNED",
  lifecycleMode: process.env.NST_JOB_LIFECYCLE_ENABLED === "true" ? "enabled" : "disabled",
  adapterEnvironmentPresence: {
    NST_KEY: supplied.NST_KEY === true,
    SUPABASE_SERVICE_ROLE_KEY: supplied.SUPABASE_SERVICE_ROLE_KEY === true,
    NEXT_PUBLIC_SUPABASE_URL: has("NEXT_PUBLIC_SUPABASE_URL"),
    NST_JOB_LIFECYCLE_ENABLED: has("NST_JOB_LIFECYCLE_ENABLED"),
  },
  launch: {
    entryScript: entry, entryScriptSHA256: entrySHA, cwd: process.cwd(), bootstrapPath: entry, bootstrapSHA256: entrySHA,
    entryIsBootstrap: entrySHA !== null,
    environmentPresence: Object.fromEntries(LAUNCH_ENV.map(k => [k, has(k)])),
    otherTsNodeKeysPresent: Object.keys(process.env).filter(k => k.startsWith("TS_NODE_") && !LAUNCH_ENV.includes(k)).sort(),
  },
  globalDispatcher: { present: atLoad !== undefined, constructorName: atLoad?.constructor?.name ?? null,
                      sameAsRunnerLoad: !preinstalled && atLoad !== undefined && globalThis[DISPATCHER] === atLoad },
  valuesRecorded: false,
};
process.stdout.write(JSON.stringify({ predicted, diagnostics: { dispatcherPreinstalledBeforeImports: preinstalled } }) + "\n");
