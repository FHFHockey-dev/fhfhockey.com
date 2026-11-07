// @vitest-environment node
import { afterEach, describe, expect, it, vi } from "vitest";
import { persistManualCronAudit, withManualCronAuditResponse } from "./manualCronAudit";
afterEach(() => { vi.useRealTimers(); vi.restoreAllMocks(); });
const response = () => { const res: any = { statusCode: 200, body: null, status: (code: number) => { res.statusCode = code; return res; },
 json: (body: any) => { res.body = body; return res; } }; return res; };
describe("required manual audit receipt", () => {
 it("holds HTTP success until exactly one audit acknowledgement", async () => {
  let finish!: (value: any) => void; const insert = vi.fn(() => new Promise((resolve) => { finish = resolve; }));
  const client = { from: () => ({ insert }) }; const res = response();
  const pending = withManualCronAuditResponse(async (_req, out) => { out.json({ success: true, rowsUpserted: 2 }); await persistManualCronAudit(client, { job_name: "fixture" }); })({} as any, res);
  expect(res.body).toBeNull(); finish({ error: null }); await pending;
  expect(res.body).toEqual({ success: true, rowsUpserted: 2 }); expect(insert).toHaveBeenCalledTimes(1);
 });
 it.each(["rejected", "timeout"])("preserves data-write counts with an explicit non-retry-safe %s audit", async (mode) => {
  vi.spyOn(console,"error").mockImplementation(() => {});vi.useFakeTimers();
  const insert=vi.fn(() => mode === "rejected" ? Promise.resolve({ error: { message: "fixture" } }) : new Promise(() => {}));
  const res=response();const pending=withManualCronAuditResponse(async (_req,out) => {out.json({success:true,rowsUpserted:2});await persistManualCronAudit({from:()=>({insert})},{});})({} as any,res);
  await vi.advanceTimersByTimeAsync(5000);await pending;
  expect(res.statusCode).toBe(503);expect(res.body).toMatchObject({success:false,rowsUpserted:2,finalAudit:{status:mode === "rejected" ? "failed":"unverified",retrySafe:false}});
  expect(insert).toHaveBeenCalledTimes(1);
 });
});
