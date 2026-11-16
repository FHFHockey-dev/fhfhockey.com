// BLSH pilot T-1.2b: credential-free runtime snapshot for RUNTIME-RECEIPT-PLAN §4 items 4 and 7.
// Run in the launcher's env shape but WITHOUT the two secret keys, with the capture's exact execArgv, from web/:
//   cd /Users/tim/Code/fhfhockey.com/web && /usr/bin/env -i PATH=/usr/bin:/bin TMPDIR="$(mktemp -d)/" NODE_PATH=. \
//     DISABLE_V8_COMPILE_CACHE=1 TS_NODE_COMPILER_OPTIONS='{"module":"commonjs","moduleResolution":"node"}' \
//     NEXT_PUBLIC_SUPABASE_URL=https://fyhftlxokyjtpndbkfse.supabase.co \
//     /usr/local/bin/node --require ./node_modules/ts-node/register/transpile-only <this file>
// Reads no env value except the public project URL comparison. This file itself loads no npm package code (the npm
// undici version is read from its package.json, resolved the way the runner's cheerio resolves it); the documented
// execArgv does preload ts-node and typescript, by design, so the snapshot sees the capture's exact execArgv
// (credential-free, at T-1). No network, no writes.
// Prints one JSON object. `noOverrides` is true only if every check in `overrides` is clean.
"use strict";
const tls = require("node:tls"), crypto = require("node:crypto"), fs = require("node:fs"), path = require("node:path");
const { createRequire } = require("node:module");
const ORIGIN = "https://fyhftlxokyjtpndbkfse.supabase.co";
const OVERRIDE_ENV = ["NODE_EXTRA_CA_CERTS", "NODE_TLS_REJECT_UNAUTHORIZED", "NODE_OPTIONS", "NODE_USE_SYSTEM_CA", "NODE_USE_ENV_PROXY",
  "SSL_CERT_FILE", "SSL_CERT_DIR", "OPENSSL_CONF", "HTTPS_PROXY", "HTTP_PROXY", "ALL_PROXY", "NO_PROXY",
  "https_proxy", "http_proxy", "all_proxy", "no_proxy"];
const EXPECTED_ARGV = ["--require", "./node_modules/ts-node/register/transpile-only"];
const h = b => crypto.createHash("sha256").update(b).digest("hex");
const has = k => Object.prototype.hasOwnProperty.call(process.env, k);
const count = kind => { try { return tls.getCACertificates(kind).length; } catch { return null; } };
const sameList = (a, b) => a.length === b.length && a.every((x, i) => x === b[i]);

const web = process.cwd();
const fromRunner = createRequire(path.join(web, "scripts/blsh/nativeProcessCaptureRunner.ts"));
const fromCheerio = createRequire(fromRunner.resolve("cheerio"));
let npmUndici = null;
try { const p = fromCheerio.resolve("undici/package.json"); npmUndici = { path: path.relative(web, p).split(path.sep).join("/"), version: JSON.parse(fs.readFileSync(p, "utf8")).version }; } catch { /* reported as null */ }

const def = tls.getCACertificates("default"), bundled = tls.getCACertificates("bundled");
const overrides = {
  overrideEnvKeysPresent: OVERRIDE_ENV.filter(has),
  dyldKeysPresent: Object.keys(process.env).filter(k => k.startsWith("DYLD_")),
  lifecycleKeyPresent: has("NST_JOB_LIFECYCLE_ENABLED"),
  execArgvIsCaptureExact: JSON.stringify(process.execArgv) === JSON.stringify(EXPECTED_ARGV),
  defaultCAEqualsBundled: sameList(def, bundled),
  defaultRejectUnauthorized: !has("NODE_TLS_REJECT_UNAUTHORIZED") || process.env.NODE_TLS_REJECT_UNAUTHORIZED !== "0",
  undiciGlobalDispatcherPreinstalled: globalThis[Symbol.for("undici.globalDispatcher.1")] !== undefined,
};
const noOverrides = overrides.overrideEnvKeysPresent.length === 0 && overrides.dyldKeysPresent.length === 0 && !overrides.lifecycleKeyPresent
  && overrides.execArgvIsCaptureExact && overrides.defaultCAEqualsBundled && overrides.defaultRejectUnauthorized && !overrides.undiciGlobalDispatcherPreinstalled;
const out = {
  version: "fhfh.blsh.preapproval-runtime-snapshot.v1",
  takenAtUTC: new Date().toISOString(),
  node: { version: process.version, execPath: process.execPath, execPathSHA256: h(fs.readFileSync(process.execPath)), execArgv: process.execArgv },
  versions: { openssl: process.versions.openssl, nodeBundledUndici: process.versions.undici ?? null, npmUndiciResolvedFromCheerio: npmUndici,
    v8: process.versions.v8, uv: process.versions.uv },
  tls: { defaultMinVersion: tls.DEFAULT_MIN_VERSION, defaultMaxVersion: tls.DEFAULT_MAX_VERSION, defaultECDHCurve: tls.DEFAULT_ECDH_CURVE,
    caCounts: { default: def.length, bundled: bundled.length, system: count("system"), extra: count("extra") },
    rootCertificatesSHA256: h(tls.rootCertificates.join("\n")), defaultCACertificatesSHA256: h(def.join("\n")) },
  supabaseOrigin: process.env.NEXT_PUBLIC_SUPABASE_URL === ORIGIN ? "pinned" : "not_pinned",
  envKeyNames: Object.keys(process.env).sort(),
  overrides,
  noOverrides,
  statement: noOverrides
    ? "No NODE_TLS_REJECT_UNAUTHORIZED, CA (NODE_EXTRA_CA_CERTS, NODE_USE_SYSTEM_CA, SSL_CERT_FILE/DIR), proxy, OPENSSL_CONF, NODE_OPTIONS or preload override is present; execArgv is exactly the capture's; the default CA store equals Node's bundled store; certificate and hostname verification are at Node's defaults; no undici dispatcher is preinstalled."
    : "OVERRIDES PRESENT: see `overrides`. Not valid pre-approval evidence.",
  boundary: "Defaults and the absence of overrides before the run only; never TLSVerified provenance (RUNTIME-RECEIPT-PLAN §4).",
  valuesRecorded: false,
};
process.stdout.write(JSON.stringify(out, null, 1) + "\n");
process.exitCode = noOverrides && out.supabaseOrigin === "pinned" ? 0 : 1;
