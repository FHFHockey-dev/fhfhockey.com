// Dependency-free view of the request-scoped FORGE env overlay (forgeEnvScope.ts, server-only), so shared readers can ask
// whether they run inside a game-scoped FORGE request without importing node:async_hooks. Until forgeEnvScope installs
// its probe, and always in browsers, the answer is false.
let probe: () => boolean = () => false;

/** True only inside withForgeEnv: the game-scoped FORGE routes and their own readback. */
export function forgeEnvScoped(): boolean {
  return probe();
}

export function installForgeScopeProbe(next: () => boolean): void {
  probe = next;
}

/** Pregame publications (one game, private custody, independent verdict) serve only their own scoped readback. Live
 * readers outside that scope never select them, so a game-scoped run cannot displace the daily run anywhere. */
export const PREGAME_PUBLICATION_METRIC = "metrics->pregame_publication";
