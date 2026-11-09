// @vitest-environment node
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

// Real client + real shared admission; only fetch and the local file ledger are mocked.
vi.mock("./requestBudget", async (importOriginal) => ({
  ...await importOriginal<typeof import("./requestBudget")>(),
  withNstRequestBudget: vi.fn(async (_url: string, control: any, start: () => Promise<unknown>) => {
    if (control.attemptsStarted >= control.maxAttempts) throw new Error("test attempt cap");
    control.attemptsStarted++;
    return start();
  }),
}));

import { fetchNstTextByUrl, fetchNstTextWithCacheByUrl, NST_BASE_URL, NstConfigError, NstOperationRefusedError,
  type NstOperation, type NstOperationHook, type NstOperationSettlement } from "./client";
import { NstExecutionLimitError } from "./requestBudget";
import { NstSharedAdmissionError } from "./sharedAdmission";

const permit = (allowed = true, waitMs = 0) => ({ version: 1, scope: "global-nst", allowed, waitMs, permitTtlMs: 1000 });
const page = (n: number) => `${NST_BASE_URL}/playerteams.php?fromseason=20262027&sit=all&page=${n}`;
type Call = { kind: "admission" | "provider"; url: string; signal?: AbortSignal | null };

function stubNetwork(receipts: object[], bodies: (string | Error)[] = ["<table>ok</table>"]) {
  const calls: Call[] = [];
  vi.stubGlobal("fetch", vi.fn(async (input: any, init?: RequestInit) => {
    const url = String(input);
    if (url.includes("/rest/v1/rpc/")) {
      calls.push({ kind: "admission", url, signal: init?.signal });
      return new Response(JSON.stringify(receipts.shift() ?? permit()));
    }
    calls.push({ kind: "provider", url, signal: init?.signal });
    const body = bodies.shift() ?? "<table>ok</table>";
    if (body instanceof Error) throw body;
    return new Response(body);
  }));
  return calls;
}

beforeEach(() => {
  vi.stubEnv("NST_KEY", "fixture-key");
  vi.stubEnv("NEXT_PUBLIC_SUPABASE_URL", "https://offline.invalid");
  vi.stubEnv("SUPABASE_SERVICE_ROLE_KEY", "fixture-service");
});
afterEach(() => { vi.useRealTimers(); vi.unstubAllGlobals(); vi.unstubAllEnvs(); });

describe("NST client opt-in operation controls", () => {
  describe("defaults unchanged", () => {
    it("without new options: one admission POST then one GET, full text, cache reused", async () => {
      const calls = stubNetwork([permit()]);
      const first = await fetchNstTextWithCacheByUrl(page(1), { retries: 0 });
      const second = await fetchNstTextWithCacheByUrl(page(1), { retries: 0 });
      expect(first.text).toBe("<table>ok</table>");
      expect(second.text).toBe(first.text);
      expect(calls.map((call) => call.kind)).toEqual(["admission", "provider"]);
    });
    it("without a cap a denied permit still waits and polls again", async () => {
      vi.useFakeTimers();
      const calls = stubNetwork([permit(false, 22_000), permit()]);
      const pending = fetchNstTextByUrl(page(2), { retries: 0 });
      await vi.advanceTimersByTimeAsync(22_000);
      expect((await pending).text).toBe("<table>ok</table>");
      expect(calls.map((call) => call.kind)).toEqual(["admission", "admission", "provider"]);
    });
    it("leaves the response body unread so legacy response.text() callers still work", async () => {
      stubNetwork([permit()]);
      const result = await fetchNstTextByUrl(page(3), { retries: 0 });
      expect(await result.response.text()).toBe("<table>ok</table>");
    });
  });

  describe("maxResponseBytes", () => {
    it("accepts a body at the limit and refuses one byte over without retrying", async () => {
      const calls = stubNetwork([permit(), permit()], ["12345", "123456"]);
      expect((await fetchNstTextByUrl(page(4), { retries: 0, maxResponseBytes: 5 })).text).toBe("12345");
      const over = fetchNstTextByUrl(page(5), { retries: 2, maxResponseBytes: 5 });
      await expect(over).rejects.toBeInstanceOf(NstExecutionLimitError);
      await expect(over).rejects.toMatchObject({ dispatchStarted: true, message: "NST response byte limit reached." });
      expect(calls.filter((call) => call.kind === "provider")).toHaveLength(2);
    });
    it.each([0, -1, 1.5, Number.NaN])("rejects an invalid limit %s before any request", async (limit) => {
      const calls = stubNetwork([]);
      await expect(fetchNstTextByUrl(page(6), { maxResponseBytes: limit })).rejects.toBeInstanceOf(NstConfigError);
      expect(calls).toHaveLength(0);
    });
    it("bypasses the memory cache when bounded", async () => {
      const calls = stubNetwork([permit(), permit(), permit()]);
      await fetchNstTextWithCacheByUrl(page(7), { retries: 0 });
      await fetchNstTextWithCacheByUrl(page(7), { retries: 0, maxResponseBytes: 1024 });
      expect(calls.filter((call) => call.kind === "provider")).toHaveLength(2);
    });
  });

  describe("maxAdmissionCalls", () => {
    it("1: a denied permit fails at once with one admission call and no GET", async () => {
      const calls = stubNetwork([permit(false, 22_000)]);
      const started = Date.now();
      const result = fetchNstTextByUrl(page(8), { retries: 0, maxAdmissionCalls: 1 });
      await expect(result).rejects.toBeInstanceOf(NstExecutionLimitError);
      await expect(result).rejects.toThrow("admission-call limit");
      expect(Date.now() - started).toBeLessThan(5_000);
      expect(calls.map((call) => call.kind)).toEqual(["admission"]);
    });
    it("1: an allowed permit dispatches exactly one GET", async () => {
      const calls = stubNetwork([permit()]);
      await fetchNstTextByUrl(page(9), { retries: 0, maxAdmissionCalls: 1 });
      expect(calls.map((call) => call.kind)).toEqual(["admission", "provider"]);
    });
    it("counts across retries of the same page", async () => {
      const calls = stubNetwork([permit(), permit()], [new Error("socket reset"), "<table>ok</table>"]);
      await expect(fetchNstTextByUrl(page(10), { retries: 2, maxAdmissionCalls: 1 })).rejects.toThrow("admission-call limit");
      expect(calls.map((call) => call.kind)).toEqual(["admission", "provider"]);
    });
    it("2: allows one wait and re-poll", async () => {
      vi.useFakeTimers();
      const calls = stubNetwork([permit(false, 22_000), permit()]);
      const pending = fetchNstTextByUrl(page(11), { retries: 0, maxAdmissionCalls: 2 });
      await vi.advanceTimersByTimeAsync(22_000);
      await pending;
      expect(calls.map((call) => call.kind)).toEqual(["admission", "admission", "provider"]);
    });
    it.each([0, 2.5, -3])("rejects an invalid cap %s before any request", async (cap) => {
      const calls = stubNetwork([]);
      await expect(fetchNstTextByUrl(page(12), { maxAdmissionCalls: cap })).rejects.toBeInstanceOf(NstConfigError);
      expect(calls).toHaveLength(0);
    });
  });

  describe("operationHook", () => {
    function recordingHook(events: string[], settlements: NstOperationSettlement[], refuse?: (op: NstOperation) => boolean): NstOperationHook {
      return async (operation, perform) => {
        events.push(`hook:${operation.kind}#${operation.attempt}`);
        if (refuse?.(operation)) throw new Error("runner refused");
        const settlement = await perform();
        events.push(`settled:${operation.kind}`);
        settlements.push(settlement);
        return settlement;
      };
    }
    it("wraps admission then provider in order, counting before dispatch, with sanitized settlements", async () => {
      const events: string[] = [];
      const settlements: NstOperationSettlement[] = [];
      vi.stubGlobal("fetch", vi.fn(async (input: any) => {
        const url = String(input);
        events.push(url.includes("/rest/v1/rpc/") ? "fetch:admission" : "fetch:provider");
        return new Response(url.includes("/rest/v1/rpc/") ? JSON.stringify(permit()) : "<table>héllo</table>");
      }));
      const result = await fetchNstTextByUrl(page(13), { retries: 0, allowQueryKeyFallback: true, operationHook: recordingHook(events, settlements) });
      expect(events).toEqual(["hook:admission#1", "fetch:admission", "settled:admission", "hook:provider#1", "fetch:provider", "settled:provider"]);
      expect(settlements[0]).toEqual({ kind: "admission", httpStatus: 200, valid: true, allowed: true, waitMs: 0 });
      expect(settlements[1]).toEqual({ kind: "provider", httpStatus: 200, redirected: false, finalUrl: "", decodedBytes: 21 }); // UTF-8 bytes, not characters
      expect(JSON.stringify(settlements)).not.toContain("fixture");
      expect(result.text).toBe("<table>héllo</table>");
    });
    it("passes credential-free operation URLs to the hook", async () => {
      stubNetwork([permit()]);
      const seen: NstOperation[] = [];
      await fetchNstTextByUrl(page(14), { retries: 0, allowQueryKeyFallback: true,
        operationHook: async (operation, perform) => { seen.push(operation); return perform(); } });
      expect(seen.map((op) => [op.kind, op.method])).toEqual([["admission", "POST"], ["provider", "GET"]]);
      expect(seen[0].redactedUrl).toBe("https://offline.invalid/rest/v1/rpc/nst_admit_attempt_v1");
      expect(seen[1].redactedUrl).toContain("key=%5BREDACTED%5D");
      expect(JSON.stringify(seen)).not.toContain("fixture");
    });
    it("a refused provider operation sends nothing and is not retried", async () => {
      const calls = stubNetwork([permit(), permit(), permit()]);
      const events: string[] = [];
      const result = fetchNstTextByUrl(page(15), { retries: 2, operationHook: recordingHook(events, [], (op) => op.kind === "provider") });
      await expect(result).rejects.toBeInstanceOf(NstOperationRefusedError);
      expect(calls.map((call) => call.kind)).toEqual(["admission"]);
      expect(events).toEqual(["hook:admission#1", "settled:admission", "hook:provider#1"]);
    });
    it("a refused admission operation sends nothing at all", async () => {
      const calls = stubNetwork([]);
      await expect(fetchNstTextByUrl(page(16), { retries: 2, operationHook: recordingHook([], [], () => true) }))
        .rejects.toBeInstanceOf(NstOperationRefusedError);
      expect(calls).toHaveLength(0);
    });
    it("a hook can refuse every call after a failure (retry blocked)", async () => {
      const calls = stubNetwork([permit(), permit()], [new Error("socket reset")]);
      let failed = false;
      const hook: NstOperationHook = async (_operation, perform) => {
        if (failed) throw new Error("operation_after_failure");
        try { return await perform(); } catch (error) { failed = true; throw error; }
      };
      await expect(fetchNstTextByUrl(page(17), { retries: 2, operationHook: hook })).rejects.toBeInstanceOf(NstOperationRefusedError);
      expect(calls.map((call) => call.kind)).toEqual(["admission", "provider"]);
    });
    it("surfaces the operation's own failure when the hook rethrows it", async () => {
      stubNetwork([permit()], [new Error("socket reset")]);
      await expect(fetchNstTextByUrl(page(18), { retries: 0, operationHook: async (_op, perform) => perform() }))
        .rejects.toThrow("socket reset");
    });
    it("a hook that returns without performing is a refusal", async () => {
      const calls = stubNetwork([permit()]);
      await expect(fetchNstTextByUrl(page(19), { retries: 0, operationHook: async () => ({ fake: true }) }))
        .rejects.toBeInstanceOf(NstOperationRefusedError);
      expect(calls).toHaveLength(0);
    });
    it("perform may run only once per operation", async () => {
      const calls = stubNetwork([permit()]);
      let second: unknown;
      const result = await fetchNstTextByUrl(page(20), { retries: 0, operationHook: async (op, perform) => {
        const settled = await perform();
        if (op.kind === "provider") second = await perform().catch((error) => error);
        return settled;
      } });
      // The repeat is refused without a request; the first, real result stands.
      expect(second).toBeInstanceOf(NstExecutionLimitError);
      expect(result.text).toBe("<table>ok</table>");
      expect(calls.map((call) => call.kind)).toEqual(["admission", "provider"]);
    });
    it("rejecting a settled admission stops before any GET", async () => {
      const calls = stubNetwork([permit()]);
      const result = fetchNstTextByUrl(page(21), { retries: 2, operationHook: async (op, perform) => {
        const settled = await perform();
        if (op.kind === "admission") throw new Error("permit_not_usable");
        return settled;
      } });
      await expect(result).rejects.toBeInstanceOf(NstSharedAdmissionError);
      expect(calls.map((call) => call.kind)).toEqual(["admission"]);
    });
    it("links the hook's abort signal into both requests", async () => {
      const calls = stubNetwork([permit()]);
      const controller = new AbortController();
      await fetchNstTextByUrl(page(22), { retries: 0, operationHook: async (_op, perform) => perform({ signal: controller.signal }) });
      expect(calls.every((call) => call.signal?.aborted === false)).toBe(true);
      controller.abort();
      expect(calls.every((call) => call.signal?.aborted === true)).toBe(true);
    });
    it("with a hook and maxAdmissionCalls 1 the BLSH page shape is exactly two operations", async () => {
      const calls = stubNetwork([permit()]);
      const ops: string[] = [];
      await fetchNstTextByUrl(page(23), { retries: 0, maxAdmissionCalls: 1, maxResponseBytes: 2_097_152,
        operationHook: async (op, perform) => { ops.push(`${op.kind}#${op.attempt}`); return perform(); } });
      expect(ops).toEqual(["admission#1", "provider#1"]);
      expect(calls).toHaveLength(2);
    });
    it("rejects a non-function hook before any request", async () => {
      const calls = stubNetwork([]);
      await expect(fetchNstTextByUrl(page(24), { operationHook: "nope" as any })).rejects.toBeInstanceOf(NstConfigError);
      expect(calls).toHaveLength(0);
    });
  });

  it("a non-pinned admission project sends no admission POST and no NST GET", async () => {
    vi.stubEnv("NEXT_PUBLIC_SUPABASE_URL", "https://otherproject.supabase.co");
    const calls = stubNetwork([permit()]);
    await expect(fetchNstTextByUrl(page(25), { retries: 2 })).rejects.toThrow("pinned production project");
    expect(calls).toHaveLength(0);
  });
});
