/** Server rollout switches. Explicit new values override the legacy combined flag. */
export function starterBoardFlags(env: Readonly<Record<string, string | undefined>> = process.env) {
  const legacy = env.START_CHART_GAME_REVISIONS === "true";
  const enabled = (name: string, fallback = legacy) => env[name] == null ? fallback : env[name] === "true";
  return {
    capture: enabled("STARTER_BOARD_CAPTURE_ENABLED"),
    compute: enabled("STARTER_BOARD_COMPUTE_ENABLED"),
    serving: enabled("STARTER_BOARD_SERVING_ENABLED"),
    challenger: enabled("STARTER_BOARD_CHALLENGER_ENABLED", false),
    scheduler: enabled("STARTER_BOARD_SCHEDULER_ENABLED", false),
  };
}

/** Omitted means full slate; an invalid configured canary must fail closed. */
export function starterBoardCanaryGameIds(env: Readonly<Record<string, string | undefined>> = process.env): number[] | null {
  const raw = env.STARTER_BOARD_CANARY_GAME_IDS;
  if (raw == null) return null;
  const entries = raw.split(",").map((value) => value.trim());
  const ids = entries.map(Number);
  if (entries.length > 16 || entries.some((value) => !/^[1-9]\d*$/.test(value))
    || ids.some((id) => !Number.isSafeInteger(id)) || new Set(ids).size !== ids.length) {
    throw new Error("STARTER_BOARD_CANARY_GAME_IDS must contain 1–16 distinct positive game IDs");
  }
  return ids;
}

export function starterBoardScopeAllowed(gameIds: readonly number[] | undefined,
  env: Readonly<Record<string, string | undefined>> = process.env): boolean {
  const canary = starterBoardCanaryGameIds(env);
  return canary === null || Boolean(gameIds?.length && gameIds.every((id) => canary.includes(id)));
}
