import { execFileSync } from "node:child_process";
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join, resolve } from "node:path";
import { afterEach, describe, expect, it, vi } from "vitest";
import { computeForgeProducerClosure } from "../../scripts/forge-producer-closure";
import { currentProducerClosureSha256, FORGE_PRODUCER_IDENTITY_VERSION, parseProducerIdentity, producerIdentityStamp } from "./forgeProducerIdentity";

const A = "a".repeat(64), B = "b".repeat(64);
// What a production build's DefinePlugin supplies; unbuilt code (this test runner included) has no such constant.
const BUILD_CONSTANT = "__FORGE_PRODUCER_CLOSURE_SHA256__";
const asBuilt = (value: string | undefined) => {
  if (value === undefined) delete (globalThis as Record<string, unknown>)[BUILD_CONSTANT];
  else (globalThis as Record<string, unknown>)[BUILD_CONSTANT] = value;
};

describe("FORGE producer identity stamp", () => {
  afterEach(() => { vi.unstubAllEnvs(); asBuilt(undefined); });

  it("records the build's closure, or an unknown one when the build has none or a malformed value", () => {
    asBuilt(A);
    expect(producerIdentityStamp()).toEqual({ version: FORGE_PRODUCER_IDENTITY_VERSION, invocations: [A], code_versions: [null] });
    for (const value of ["", "local", A.toUpperCase(), `${A}0`]) {
      asBuilt(value);
      expect(currentProducerClosureSha256(), value).toBeNull();
    }
  });

  it("never takes the closure from an env var: unbuilt code stamps null whatever the env says (C7 R40 V2)", () => {
    vi.stubEnv("FORGE_PRODUCER_CLOSURE_SHA256", A);
    vi.stubEnv("__FORGE_PRODUCER_CLOSURE_SHA256__", A);
    expect(currentProducerClosureSha256()).toBeNull();
    expect(producerIdentityStamp().invocations).toEqual([null]);
  });

  it("records each invocation's FORGE_CODE_VERSION beside its closure", () => {
    asBuilt(A);
    vi.stubEnv("FORGE_CODE_VERSION", "local:abc");
    expect(producerIdentityStamp()).toMatchObject({ invocations: [A], code_versions: ["local:abc"] });
    vi.stubEnv("FORGE_CODE_VERSION", "");
    expect(producerIdentityStamp().code_versions).toEqual([null]);
  });

  it("appends each resuming invocation, keeping an unknown entry for an unstamped earlier one", () => {
    asBuilt(B);
    expect(producerIdentityStamp({ version: FORGE_PRODUCER_IDENTITY_VERSION, invocations: [A] }, true).invocations).toEqual([A, B]);
    expect(producerIdentityStamp(undefined, true)).toMatchObject({ invocations: [null, B], code_versions: [null, null] });
    expect(producerIdentityStamp({ version: "other", invocations: [A] }, true).invocations).toEqual([null, B]);
    expect(producerIdentityStamp({ version: FORGE_PRODUCER_IDENTITY_VERSION, invocations: [A] }).invocations).toEqual([B]);
  });

  it.each([null, undefined, A, [], {}, { version: FORGE_PRODUCER_IDENTITY_VERSION, invocations: [] },
    { version: FORGE_PRODUCER_IDENTITY_VERSION, invocations: ["x"] }, { version: "v0", invocations: [A] },
    { version: FORGE_PRODUCER_IDENTITY_VERSION, invocations: [A], code_versions: [] },
    { version: FORGE_PRODUCER_IDENTITY_VERSION, invocations: [A], code_versions: [1] }])(
    "parses %j as no stamp", value => expect(parseProducerIdentity(value)).toBeNull());
});

describe("FORGE producer closure identity", () => {
  // A synthetic tree: root imports a helper; an unrelated module sits outside the closure.
  function tree(files: Record<string, string>) {
    const root = mkdtempSync(join(tmpdir(), "forge-closure-"));
    const all = { "tsconfig.json": JSON.stringify({ compilerOptions: { baseUrl: ".", moduleResolution: "bundler", module: "esnext",
      paths: { "lib/*": ["./lib/*"] } } }), ...files };
    for (const [file, text] of Object.entries(all)) { mkdirSync(dirname(join(root, file)), { recursive: true }); writeFileSync(join(root, file), text); }
    return root;
  }
  const base = { "lib/root.ts": 'import { read } from "lib/helper";\nexport const run = () => read("skatersGameStats");\n',
    "lib/helper.ts": "export const read = (table: string) => table;\n", "lib/unrelated.ts": "export const x = 1;\n" };
  const roots: string[] = [];
  const identity = (files: Record<string, string>) => { const root = tree(files); roots.push(root);
    return computeForgeProducerClosure(root, ["lib/root.ts"]); };
  afterEach(() => { for (const root of roots.splice(0)) rmSync(root, { recursive: true, force: true }); });

  it("is the same for a later tree whose closure is unchanged, and new when any closure module changes", () => {
    const first = identity(base);
    expect(first.scan.modules).toEqual(["lib/helper.ts", "lib/root.ts"]);
    expect(identity({ ...base, "lib/unrelated.ts": "export const x = 2;\n" }).closureSha256).toBe(first.closureSha256);
    expect(identity({ ...base, "lib/helper.ts": "export const read = (table: string) => `${table}`;\n" }).closureSha256).not.toBe(first.closureSha256);
    expect(identity({ ...base, "lib/root.ts": `${base["lib/root.ts"]}import "lib/unrelated";\n` }).closureSha256).not.toBe(first.closureSha256);
  });

  it("is defined by next.config.js only in a production build's server bundles, from source, never from an env label", () => {
    const web = resolve(__dirname, "../..");
    // A stand-in webpack: records what each compiler would define.
    const script = `process.env.FORGE_PRODUCER_CLOSURE_SHA256 = "${"f".repeat(64)}"; const config = require("./next.config.js");
      class DefinePlugin { constructor(definitions) { this.definitions = definitions; } }
      const compile = (phase, isServer) => { const built = config(phase); const out = built.webpack({ plugins: [] }, { dev: false, isServer, webpack: { DefinePlugin } });
        return { env: built.env ?? null, defines: out.plugins.map(plugin => plugin.definitions) }; };
      console.log(JSON.stringify({ server: compile("phase-production-build", true), client: compile("phase-production-build", false),
        dev: compile("phase-development-server", true) }));`;
    const out = JSON.parse(execFileSync(process.execPath, ["-e", script], { cwd: web, encoding: "utf8" }).trim().split("\n").at(-1)!);
    const expected = computeForgeProducerClosure(web).closureSha256;
    expect(out).toEqual({ server: { env: null, defines: [{ [BUILD_CONSTANT]: JSON.stringify(expected) }] },
      client: { env: null, defines: [] }, dev: { env: null, defines: [] } });
    expect(expected).not.toBe("f".repeat(64));
  }, 60_000);
});
