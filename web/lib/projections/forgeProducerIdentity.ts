// The FORGE producer identity a run is stamped with (TJ/Astra F1, 2026-10-26): the sha256 of the producer import
// closure that executed it, computed at production build time from the deployed source (scripts/forge-producer-closure.ts)
// and inlined by next.config.js. Next replaces `process.env.FORGE_PRODUCER_CLOSURE_SHA256` with that literal when it
// bundles the writer, so a runtime env var of that name cannot relabel a deployed build. Unbuilt code (dev, tests,
// local scripts) stamps whatever it reads, or null, and its runs carry `local:` SHAs that readers already fence.
// This module is part of the closure it identifies; consumer admission and its allowlist must stay outside it.

export const FORGE_PRODUCER_IDENTITY_VERSION = "forge-producer-closure-v1";
const SHA256 = /^[0-9a-f]{64}$/;

/** One entry per invocation that wrote the run, in order: its closure hash, or null when unknown. */
export type ForgeProducerIdentityStamp = { version: typeof FORGE_PRODUCER_IDENTITY_VERSION; invocations: Array<string | null> };

/** This build's closure hash, or null when it was not built with one. */
export function currentProducerClosureSha256(): string | null {
  const value = process.env.FORGE_PRODUCER_CLOSURE_SHA256;
  return typeof value === "string" && SHA256.test(value) ? value : null;
}

/** A stored stamp, or null when absent or malformed. */
export function parseProducerIdentity(value: unknown): ForgeProducerIdentityStamp | null {
  const stamp = value as Partial<ForgeProducerIdentityStamp> | null;
  return stamp && typeof stamp === "object" && stamp.version === FORGE_PRODUCER_IDENTITY_VERSION && Array.isArray(stamp.invocations)
    && stamp.invocations.length > 0 && stamp.invocations.every(entry => entry === null || typeof entry === "string" && SHA256.test(entry))
    ? { version: FORGE_PRODUCER_IDENTITY_VERSION, invocations: [...stamp.invocations] } : null;
}

/** The stamp for this invocation: a new run's first entry, or a resumed run's prior entries plus this one. A resumed
 * run whose earlier invocations left no readable stamp keeps an unknown (null) entry for them. */
export function producerIdentityStamp(prior?: unknown, resumed = false): ForgeProducerIdentityStamp {
  const previous = resumed ? parseProducerIdentity(prior)?.invocations ?? [null] : [];
  return { version: FORGE_PRODUCER_IDENTITY_VERSION, invocations: [...previous, currentProducerClosureSha256()] };
}
