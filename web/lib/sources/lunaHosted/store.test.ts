// @vitest-environment node
import { afterEach, describe, expect, it, vi } from "vitest";
import type { IftttRpcClient } from "../iftttRpcDeadline";
import { createHostedLunaStore } from "./store";
import { HOSTED_LUNA_VERSION } from "./contract";
import { LUNA_MODEL, LUNA_RESERVATION_NANO_USD, priceLunaUsage } from "../tweetLunaTransport";
const ID = "f40f38e5-03dd-4f70-a0a2-7934a49fc5c6", KEY = "1".repeat(64);
const reply = (status: string, extra = {}) => ({ data: { version: HOSTED_LUNA_VERSION, jobId: ID, status, ...extra }, error: null });
function harness() {
  const responses: any[] = [];
  const abort = vi.fn();
  const rpc = vi.fn(() => {
    const next = responses.shift();
    const promise = next instanceof Promise ? next : Promise.resolve(next);
    return Object.assign(promise, { abortSignal: (signal: AbortSignal) => { signal.addEventListener("abort", abort); return promise; } });
  });
  return { responses, rpc, abort, store: createHostedLunaStore({ rpc } as unknown as IftttRpcClient) };
}
function receipt() {
  const body = { model: LUNA_MODEL, usage: { input_tokens: 100, output_tokens: 50 } };
  return { body, endpoint: "responses" as const, requestId: "synthetic", chargeNanoUsd: priceLunaUsage(body, "responses") };
}
afterEach(() => vi.useRealTimers());
describe("hosted Luna RPC protocol", () => {
  it.each([reply("claimed", { job: {} }), reply("completed"), reply("held")])("accepts the bound claim response %#", async r => {
    const h = harness(); h.responses.push(r); expect((await h.store.claim(ID)).status).toBe(r.data.status);
    expect(h.rpc).toHaveBeenCalledWith("luna_hosted_review_rpc", { p_action: "claim", p_job_id: ID, p_payload: {} });
  });
  it.each([reply("refused"), { data: null, error: { message: "private" } },
    { data: { ...reply("claimed").data, jobId: "other" }, error: null }])("refuses unbound/unavailable claim without retry %#", async r => {
    const h = harness(); h.responses.push(r); await expect(h.store.claim(ID)).rejects.toThrow(); expect(h.rpc).toHaveBeenCalledTimes(1);
  });
  it("normalizes uppercase IDs before every RPC mutation and matches canonical replies", async () => {
    const h = harness(), upper = ID.toUpperCase();
    const result = { review: { status: "review_only", canPublish: false, canChangeStatus: false,
      canWriteAliases: false, canExecuteReplacement: false }, bindingStatus: "not_eligible", candidate: null };
    h.responses.push(reply("claimed", { job: {} }), reply("reserved"), reply("settled"),
      reply("held"), reply("completed"), reply("held"));
    expect((await h.store.claim(upper)).status).toBe("claimed");
    const a = h.store.admission(upper);
    await a.reserve(KEY, LUNA_RESERVATION_NANO_USD); await a.settle(KEY, receipt());
    await a.uncertain(KEY); await h.store.finish(upper, result as any); await h.store.hold(upper);
    expect(h.rpc).toHaveBeenCalledTimes(6);
    for (const call of h.rpc.mock.calls) expect((call as any)[1].p_job_id).toBe(ID);
  });
  it("rejects invalid IDs before mutation", async () => {
    const h = harness(); await expect(h.store.claim("invalid")).rejects.toThrow();
    expect(h.rpc).not.toHaveBeenCalled();
  });
  it("still rejects a different valid UUID in a response", async () => {
    const h = harness(); h.responses.push({ data: { ...reply("claimed").data,
      jobId: "00000000-0000-4000-8000-000000000001" }, error: null });
    await expect(h.store.claim(ID.toUpperCase())).rejects.toThrow("hosted_store_unavailable");
    expect(h.rpc).toHaveBeenCalledOnce();
  });
  it("aborts a hanging mutation at six seconds without retry", async () => {
    vi.useFakeTimers(); const h = harness(); h.responses.push(new Promise(() => undefined));
    const result = h.store.claim(ID); const assertion = expect(result).rejects.toThrow();
    await vi.advanceTimersByTimeAsync(6000); await assertion;
    expect(h.abort).toHaveBeenCalledOnce(); expect(h.rpc).toHaveBeenCalledOnce();
  });
  it("uses the fixed reservation and accepts only validated settled replays", async () => {
    const h = harness(); const a = h.store.admission(ID); h.responses.push(reply("reserved"), reply("replay", { receiptJson: JSON.stringify(receipt()) }));
    expect(await a.reserve(KEY, LUNA_RESERVATION_NANO_USD)).toEqual({ status: "reserved" });
    expect((await a.reserve(KEY, LUNA_RESERVATION_NANO_USD)).status).toBe("replay");
    await expect(a.reserve(KEY, 1)).rejects.toThrow(); expect(h.rpc).toHaveBeenCalledTimes(2);
  });
  it.each(["expired", "stopped", "exhausted", "running", "uncertain"])("fails closed on %s reservation", async reason => {
    const h = harness(); h.responses.push(reply("refused", { reason }));
    await expect(h.store.admission(ID).reserve(KEY, LUNA_RESERVATION_NANO_USD)).rejects.toThrow("luna_budget_stopped");
    expect(h.rpc).toHaveBeenCalledOnce();
  });
  it("rejects replay accounting that disagrees with usage", async () => {
    const h = harness(); h.responses.push(reply("replay", { receiptJson: JSON.stringify({ ...receipt(), chargeNanoUsd: 0 }) }));
    await expect(h.store.admission(ID).reserve(KEY, LUNA_RESERVATION_NANO_USD)).rejects.toThrow();
  });
  it("settles the receipt, and separately records uncertainty after an ambiguous result", async () => {
    const h = harness(), a = h.store.admission(ID); h.responses.push(reply("settled"), reply("held"));
    await a.settle(KEY, receipt()); await a.uncertain(KEY, "synthetic-request");
    expect(h.rpc.mock.calls.map(c => (c as any)[1].p_action)).toEqual(["settle", "uncertain"]);
  });
  it("preserves exact result JSON ordering instead of a jsonb round trip", async () => {
    const h = harness(); h.responses.push(reply("completed"));
    const result = { review: { status: "review_only", canPublish: false, canChangeStatus: false,
      canWriteAliases: false, canExecuteReplacement: false }, bindingStatus: "not_eligible", candidate: null };
    await h.store.finish(ID, result as any);
    expect(h.rpc).toHaveBeenCalledWith("luna_hosted_review_rpc", { p_action: "finish", p_job_id: ID,
      p_payload: { resultJson: JSON.stringify(result) } });
  });
  it("does not retry a failed settlement", async () => {
    const h = harness(); h.responses.push({ data: null, error: true });
    await expect(h.store.admission(ID).settle(KEY, receipt())).rejects.toThrow(); expect(h.rpc).toHaveBeenCalledOnce();
  });
});
