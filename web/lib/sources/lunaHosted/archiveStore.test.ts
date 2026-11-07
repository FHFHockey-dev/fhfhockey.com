// @vitest-environment node
import { describe, expect, it, vi } from "vitest";
import type { IftttRpcClient } from "../iftttRpcDeadline";
import { prepareCaptureEnvelope } from "./capture";
import { createLunaArchiveStore } from "./archiveStore";
function fixture() {
  const input = prepareCaptureEnvelope(Buffer.from(JSON.stringify({ Text: "Synthetic report", UserName: "Reporter",
    LinkToTweet: "https://x.com/Reporter/status/1", CreatedAt: "unverified label" })), {
    policyId: "00000000-0000-4000-8000-000000000001", appletId: "synthetic", sourceAccount: "Reporter" }, "2026-11-05T00:00:00Z");
  const ack = { status: "retained", receipt: { id: "00000000-0000-4000-8000-000000000002", kind: "luna-isolated-archive-v1",
    policyId: input.scope.policyId, appletId: input.scope.appletId, deliveryKey: input.deliveryKey,
    payloadSha256: input.payloadSha256, byteLength: input.byteLength, firstReceivedAt: input.receivedAt, classification: "baseline" } };
  let answer = { data: ack as unknown, error: null as unknown };
  const abortSignal = vi.fn(() => Promise.resolve(answer));
  const rpc = vi.fn(() => ({ abortSignal }));
  return { input, ack, rpc, abortSignal, setAnswer: (v: typeof answer) => { answer = v; },
    store: createLunaArchiveStore({ rpc } as unknown as IftttRpcClient) };
}
describe("private archive RPC adapter", () => {
  it("sends one exact envelope and honors the caller signal", async () => {
    const f = fixture(), signal = new AbortController().signal;
    expect((await f.store.retain(f.input, signal)).status).toBe("retained");
    expect(f.rpc).toHaveBeenCalledExactlyOnceWith("luna_capture_archive_rpc", { p_action: "retain",
      p_policy_id: f.input.scope.policyId, p_payload: { envelopeJson: JSON.stringify(f.input) } });
    expect(f.abortSignal).toHaveBeenCalledWith(signal);
  });
  it("rejects tampered projection before any RPC", async () => {
    const f = fixture(); const input = structuredClone(f.input); (input.submitted as any).text = "changed";
    await expect(f.store.retain(input, new AbortController().signal)).rejects.toThrow(); expect(f.rpc).not.toHaveBeenCalled();
  });
  it.each(["rpc", "hash", "invalid"])("does not retry or conceal %s failure", async failure => {
    const f = fixture();
    if (failure === "rpc") f.setAnswer({ data: null, error: { message: "private details" } });
    if (failure === "hash") f.ack.receipt.payloadSha256 = "b".repeat(64);
    if (failure === "invalid") f.setAnswer({ data: { status: "invalid" }, error: null });
    await expect(f.store.retain(f.input, new AbortController().signal)).rejects.toThrow(); expect(f.rpc).toHaveBeenCalledTimes(1);
  });
  it("performs only an exact receipt lookup after uncertainty", async () => {
    const f = fixture(); f.setAnswer({ data: null, error: null });
    expect(await f.store.lookupExact(f.input, new AbortController().signal)).toBeNull();
    expect(f.rpc).toHaveBeenCalledExactlyOnceWith("luna_capture_archive_rpc", { p_action: "lookup", p_policy_id: f.input.scope.policyId,
      p_payload: { appletId: f.input.scope.appletId, deliveryKey: f.input.deliveryKey, payloadSha256: f.input.payloadSha256 } });
  });
  it("refuses already-aborted work before RPC construction", async () => {
    const f = fixture(), controller = new AbortController(); controller.abort();
    await expect(f.store.retain(f.input, controller.signal)).rejects.toThrow("aborted"); expect(f.rpc).not.toHaveBeenCalled();
  });
});
