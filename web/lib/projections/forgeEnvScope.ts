import { AsyncLocalStorage } from "node:async_hooks";

type Env = Readonly<Record<string, string | undefined>>;
const scope = new AsyncLocalStorage<Env>();

/** The environment FORGE flag readers see: process.env, unless the current async call chain runs inside
 * withForgeEnv. Outside such a scope this is exactly process.env, so ordinary runs are unchanged. */
export function forgeEnv(): Env {
  return scope.getStore() ?? process.env;
}

/** Runs one call chain with fixture flags layered over process.env. AsyncLocalStorage keeps the overlay to this chain:
 * concurrent requests in the same process still read process.env, and process.env itself is never modified. */
export function withForgeEnv<T>(overrides: Env, work: () => Promise<T>): Promise<T> {
  return scope.run(Object.freeze({ ...process.env, ...overrides }), work);
}
