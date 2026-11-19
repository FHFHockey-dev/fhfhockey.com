// @vitest-environment node
import { afterEach, expect, it, vi } from "vitest";
import { forgeEnv, withForgeEnv } from "./forgeEnvScope";
import { starterBoardCanaryGameIds, starterBoardFlags, starterBoardScopeAllowed } from "./starterBoardFlags";
import { projectionModelEnvironment } from "./run-forge-projections";

afterEach(() => { vi.unstubAllEnvs(); });

const prod = { STARTER_BOARD_CAPTURE_ENABLED: "true", STARTER_BOARD_COMPUTE_ENABLED: "false", STARTER_BOARD_SERVING_ENABLED: "false",
  STARTER_BOARD_CANARY_GAME_IDS: "2026010049", FORGE_SKATER_MODEL_MODE: undefined };
const fixture = { STARTER_BOARD_COMPUTE_ENABLED: "true", STARTER_BOARD_SERVING_ENABLED: "true", STARTER_BOARD_CANARY_GAME_IDS: "2099020991" };

it("is process.env itself outside a scope, so every existing caller reads exactly what it read before", () => {
  for (const [k, v] of Object.entries(prod)) vi.stubEnv(k, v);
  expect(forgeEnv()).toBe(process.env);
  expect(starterBoardFlags()).toEqual(starterBoardFlags(process.env));
  expect(starterBoardFlags()).toMatchObject({ capture: true, compute: false, serving: false });
  expect(starterBoardCanaryGameIds()).toEqual([2026010049]);
  expect(starterBoardScopeAllowed([2099020991])).toBe(false);
  expect(projectionModelEnvironment().STARTER_BOARD_COMPUTE_ENABLED).toBe("false");
});

it("layers fixture flags over process.env only inside its own async chain, without modifying process.env", async () => {
  for (const [k, v] of Object.entries(prod)) vi.stubEnv(k, v);
  const before = { ...process.env };
  let inside: unknown;
  const outsideWhileRunning: unknown[] = [];
  const gate = Promise.withResolvers<void>();
  const scoped = withForgeEnv(fixture, async () => {
    await gate.promise;                      // a concurrent caller runs while this scope is open
    await new Promise(resolve => setTimeout(resolve, 5));
    inside = { flags: starterBoardFlags(), canary: starterBoardCanaryGameIds(), allowed: starterBoardScopeAllowed([2099020991]),
      env: projectionModelEnvironment().STARTER_BOARD_COMPUTE_ENABLED };
  });
  const concurrent = (async () => {
    outsideWhileRunning.push(starterBoardFlags(), starterBoardCanaryGameIds(), projectionModelEnvironment().STARTER_BOARD_COMPUTE_ENABLED);
    gate.resolve();
  })();
  await Promise.all([scoped, concurrent]);
  expect(inside).toEqual({ flags: { capture: true, compute: true, serving: true, challenger: false, scheduler: false },
    canary: [2099020991], allowed: true, env: "true" });
  expect(outsideWhileRunning).toEqual([{ capture: true, compute: false, serving: false, challenger: false, scheduler: false }, [2026010049], "false"]);
  expect({ ...process.env }).toEqual(before);
  expect(forgeEnv()).toBe(process.env);
});

it("keeps an explicitly passed env authoritative inside a scope", async () => {
  await withForgeEnv(fixture, async () => {
    expect(starterBoardFlags({ STARTER_BOARD_COMPUTE_ENABLED: "false" }).compute).toBe(false);
    expect(starterBoardCanaryGameIds({})).toBeNull();
  });
});
