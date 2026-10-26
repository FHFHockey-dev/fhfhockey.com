// The FORGE producer identity a run is stamped with (TJ/Astra F1, 2026-10-26): the sha256 of the producer import
// closure that executed it, computed at production build time from the deployed source (scripts/forge-producer-closure.ts)
// and defined by next.config.js as the bundler constant `__FORGE_PRODUCER_CLOSURE_SHA256__` (webpack DefinePlugin, server
// bundles only). Only a production build defines it: no env var, `.env` file or shell can, so unbuilt code (dev, tests,
// ts-node scripts such as run-forge-local) always stamps null, and readers deny null (C7 R40 V2).
// Each invocation also records FORGE_CODE_VERSION when set. That is an env label, so it is used only to deny: readers
// refuse a run with any `local:` code version.
// This module is part of the closure it identifies; consumer admission and its allowlist must stay outside it.

declare const __FORGE_PRODUCER_CLOSURE_SHA256__: string | undefined;

export const FORGE_PRODUCER_IDENTITY_VERSION = "forge-producer-closure-v1";
const SHA256 = /^[0-9a-f]{64}$/;

/** One entry per invocation that wrote the run, in order: its closure hash (null when unknown) and its
 * FORGE_CODE_VERSION (null when unset). */
export type ForgeProducerIdentityStamp = { version: typeof FORGE_PRODUCER_IDENTITY_VERSION; invocations: Array<string | null>;
  code_versions: Array<string | null> };

/** This build's closure hash, or null in anything a production build did not compile. */
export function currentProducerClosureSha256(): string | null {
  const value = typeof __FORGE_PRODUCER_CLOSURE_SHA256__ === "string" ? __FORGE_PRODUCER_CLOSURE_SHA256__ : null;
  return value !== null && SHA256.test(value) ? value : null;
}

/** A stored stamp, or null when absent or malformed. Stamps that predate `code_versions` read as unknown versions. */
export function parseProducerIdentity(value: unknown): ForgeProducerIdentityStamp | null {
  const stamp = value as Partial<ForgeProducerIdentityStamp> | null;
  if (!stamp || typeof stamp !== "object" || stamp.version !== FORGE_PRODUCER_IDENTITY_VERSION || !Array.isArray(stamp.invocations)
    || !stamp.invocations.length || !stamp.invocations.every(entry => entry === null || typeof entry === "string" && SHA256.test(entry))) return null;
  const codeVersions = stamp.code_versions === undefined ? stamp.invocations.map(() => null) : stamp.code_versions;
  if (!Array.isArray(codeVersions) || codeVersions.length !== stamp.invocations.length
    || !codeVersions.every(entry => entry === null || typeof entry === "string")) return null;
  return { version: FORGE_PRODUCER_IDENTITY_VERSION, invocations: [...stamp.invocations], code_versions: [...codeVersions] };
}

/** The stamp for this invocation: a new run's first entry, or a resumed run's prior entries plus this one. A resumed
 * run whose earlier invocations left no readable stamp keeps an unknown (null) entry for them. */
export function producerIdentityStamp(prior?: unknown, resumed = false): ForgeProducerIdentityStamp {
  const previous = resumed ? parseProducerIdentity(prior) ?? { invocations: [null], code_versions: [null] } : { invocations: [], code_versions: [] };
  const codeVersion = process.env.FORGE_CODE_VERSION?.trim() || null;
  return { version: FORGE_PRODUCER_IDENTITY_VERSION, invocations: [...previous.invocations, currentProducerClosureSha256()],
    code_versions: [...previous.code_versions, codeVersion] };
}
