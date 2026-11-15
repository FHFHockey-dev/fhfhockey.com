/**
 * Test-only harness: routes the server Supabase client to the active fixture world through the real capture
 * interceptor, freezes the clock, and records what the writer's own capture saw. Never touches a network.
 */
import { vi } from "vitest";
import { interceptProjectionQuery } from "lib/projections/queryCaptureHook";
import { createWorldClient, type World } from "../__fixtures__/world/store";
import type { ProjectionInputRead } from "lib/projections/inputCapture";

type Operation = { method: string; args: unknown[] };
let active: ReturnType<typeof createWorldClient> | null = null;

export function useWorld(world: World) {
  active = createWorldClient(world);
}

function client() {
  if (!active) throw new Error("fixture world: no active world");
  return active;
}

/** Stand-in for `lib/supabase/server`: same proxy shape, the world as its live client. */
export const worldServerModule = () => {
  const proxy = new Proxy({} as any, {
    get(_target, property) {
      if (property === "from" || property === "rpc") {
        return (...args: unknown[]) => {
          const live = () => (client() as any)[property](...args);
          return interceptProjectionQuery(property, args, live) ?? live();
        };
      }
      return undefined;
    },
  });
  return { default: proxy, getServiceRoleClient: () => proxy };
};

/** Captures recorded by the writer's own `captureProjectionInputs` call, newest last. */
export const writerCaptures: Array<{ reads: ProjectionInputRead[]; writes: Operation[][] }> = [];

export const FROZEN_NOW = "2026-11-14T20:00:00.000Z";
export const CODE_VERSION = "fixture-code-version";

export type ScenarioEnv = Record<string, string | undefined>;
const BASE_ENV: ScenarioEnv = {
  STARTER_BOARD_CAPTURE_ENABLED: "true",
  STARTER_BOARD_COMPUTE_ENABLED: "true",
  STARTER_BOARD_SERVING_ENABLED: "false",
  STARTER_BOARD_CANARY_GAME_IDS: undefined,
  STARTER_BOARD_SEASON_BOOTSTRAP_ENABLED: "false",
  START_CHART_GAME_REVISIONS: undefined,
  FORGE_RESERVE_PASS_ENABLED: "false",
  FORGE_SKATER_MODEL_MODE: undefined,
  FORGE_CODE_VERSION: CODE_VERSION,
};

export async function withScenarioEnv<T>(env: ScenarioEnv, work: () => Promise<T>): Promise<T> {
  const merged = { ...BASE_ENV, ...env };
  const saved = Object.fromEntries(Object.keys(merged).map((key) => [key, process.env[key]]));
  for (const [key, value] of Object.entries(merged)) {
    if (value === undefined) delete process.env[key];
    else process.env[key] = value;
  }
  vi.useFakeTimers({ toFake: ["Date"], now: new Date(FROZEN_NOW) });
  try {
    return await work();
  } finally {
    vi.useRealTimers();
    for (const [key, value] of Object.entries(saved)) {
      if (value === undefined) delete process.env[key];
      else process.env[key] = value;
    }
  }
}

/** A JSON-stable view of reads/writes for oracle files. */
export function normalizeReads(reads: ProjectionInputRead[]) {
  return reads.map((read) => ({ request: read.request, result: read.result, ...(read.failure ? { failure: read.failure } : {}) }));
}
