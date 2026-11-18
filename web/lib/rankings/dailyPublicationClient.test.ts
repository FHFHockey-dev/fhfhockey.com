// @vitest-environment node
import { afterEach, beforeEach, expect, it, vi } from "vitest";
import { createDailyPublicationClients } from "./dailyPublicationClient";
import { MAX_DISPATCH_REQUESTS } from "./dailyPublicationPolicy";

beforeEach(() => {
  vi.stubEnv("NEXT_PUBLIC_SUPABASE_URL", "http://127.0.0.1:1");
  vi.stubEnv("SUPABASE_SERVICE_ROLE_KEY", "fixture-only");
});
afterEach(() => { vi.unstubAllEnvs(); vi.unstubAllGlobals(); vi.useRealTimers(); });

it("reserves one actual HTTP request for the terminal receipt", async () => {
  const transport = vi.fn(async () => new Response("[]"));
  vi.stubGlobal("fetch", transport);
  const clients = createDailyPublicationClients(Date.now() + 220_000);
  const read = () => clients.work.from("teams").select("id").limit(1);
  for (let i = 0; i < MAX_DISPATCH_REQUESTS - 1; i++) expect((await read()).error).toBeNull();
  expect((await read()).error).toBeTruthy();
  expect(transport).toHaveBeenCalledTimes(MAX_DISPATCH_REQUESTS - 1);
  expect((await clients.terminal.from("teams").select("id").limit(1)).error).toBeNull();
  expect(clients.requestCount()).toBe(MAX_DISPATCH_REQUESTS);
});

it("uses the writer's signal and blocks new requests when only the receipt budget remains", async () => {
  const observed: AbortSignal[] = [];
  vi.stubGlobal("fetch", async (_input: unknown, init: RequestInit) => {
    observed.push(init.signal!);
    return new Response("[]");
  });
  vi.useFakeTimers({ toFake: ["Date"] });
  const start = Date.now(), clients = createDailyPublicationClients(start + 10_000);
  const caller = new AbortController();
  await clients.work.from("teams").select("id").abortSignal(caller.signal);
  caller.abort();
  expect(observed[0].aborted).toBe(true);
  vi.setSystemTime(start + 5001);
  expect(await clients.work.from("teams").select("id")).toMatchObject({ error: expect.anything() });
  expect((await clients.terminal.from("teams").select("id")).error).toBeNull();
  vi.setSystemTime(start + 10_001);
  expect((await clients.terminal.from("teams").select("id")).error).toBeTruthy();
  expect(clients.requestCount()).toBe(2);
});
