import { execFileSync } from "node:child_process";
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join, resolve } from "node:path";
import { afterEach, describe, expect, it, vi } from "vitest";
import { computeForgeProducerClosure } from "../../scripts/forge-producer-closure";
import { currentProducerClosureSha256, FORGE_PRODUCER_IDENTITY_VERSION, parseProducerIdentity, producerIdentityStamp } from "./forgeProducerIdentity";

const A = "a".repeat(64), B = "b".repeat(64);

describe("FORGE producer identity stamp", () => {
  afterEach(() => vi.unstubAllEnvs());

  it("records this build's closure, or an unknown one when the build has none or a malformed value", () => {
    vi.stubEnv("FORGE_PRODUCER_CLOSURE_SHA256", A);
    expect(producerIdentityStamp()).toEqual({ version: FORGE_PRODUCER_IDENTITY_VERSION, invocations: [A] });
    for (const value of ["", "local", A.toUpperCase(), `${A}0`]) {
      vi.stubEnv("FORGE_PRODUCER_CLOSURE_SHA256", value);
      expect(currentProducerClosureSha256(), value).toBeNull();
    }
  });

  it("appends each resuming invocation, keeping an unknown entry for an unstamped earlier one", () => {
    vi.stubEnv("FORGE_PRODUCER_CLOSURE_SHA256", B);
    expect(producerIdentityStamp({ version: FORGE_PRODUCER_IDENTITY_VERSION, invocations: [A] }, true).invocations).toEqual([A, B]);
    expect(producerIdentityStamp(undefined, true).invocations).toEqual([null, B]);
    expect(producerIdentityStamp({ version: "other", invocations: [A] }, true).invocations).toEqual([null, B]);
    expect(producerIdentityStamp({ version: FORGE_PRODUCER_IDENTITY_VERSION, invocations: [A] }).invocations).toEqual([B]);
  });

  it.each([null, undefined, A, [], {}, { version: FORGE_PRODUCER_IDENTITY_VERSION, invocations: [] },
    { version: FORGE_PRODUCER_IDENTITY_VERSION, invocations: ["x"] }, { version: "v0", invocations: [A] }])(
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

  it("is computed by next.config.js only for a production build, from source, never from a runtime env label", () => {
    const web = resolve(__dirname, "../..");
    const script = `process.env.FORGE_PRODUCER_CLOSURE_SHA256 = "${"f".repeat(64)}"; const config = require("./next.config.js");
      console.log(JSON.stringify({ build: config("phase-production-build").env ?? null, dev: config("phase-development-server").env ?? null }));`;
    const out = JSON.parse(execFileSync(process.execPath, ["-e", script], { cwd: web, encoding: "utf8" }).trim().split("\n").at(-1)!);
    const expected = computeForgeProducerClosure(web).closureSha256;
    expect(out).toEqual({ build: { FORGE_PRODUCER_CLOSURE_SHA256: expected }, dev: null });
    expect(expected).not.toBe("f".repeat(64));
  }, 60_000);
});
