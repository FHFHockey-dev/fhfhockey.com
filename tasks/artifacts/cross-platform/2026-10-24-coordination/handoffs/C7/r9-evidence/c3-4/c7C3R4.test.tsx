// C7 controls for C3-4 refund private-safe errors: sentinel leak sweep, status-only mapping probe, unchanged request.
import React from "react";
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterAll, afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { writeFileSync } from "node:fs";
const OUT = process.env.C7_C3R4_OUT; const observed: Record<string, unknown> = {};
afterAll(() => { if (OUT) writeFileSync(OUT, JSON.stringify(observed, null, 2)); });
const getSession = vi.hoisted(() => vi.fn());
vi.mock("lib/supabase/client", () => ({ default: { auth: { getSession, onAuthStateChange: () => ({ data: { subscription: { unsubscribe() {} } } }) } } }));
vi.mock("next/router", () => ({ useRouter: () => ({ query: {}, pathname: "/account", replace: vi.fn() }) }));
import DraftProPanel from "components/account/DraftProPanel";
const account = { access: { eligible: true, grantingSources: ["purchase"], expiresAt: "2027-07-01T04:00:00.000Z", verifiedAt: null, reason: "eligible", providerReadiness: { patreon: false } },
  passInfo: { priceCents: 599, expiresAt: "2027-07-01T04:00:00.000Z", renewal: "none" }, checkoutAvailability: { available: true, reason: "available" },
  purchases: [{ id: "purchase-1", season: "draft_pro_2026_27", status: "active", activatedAt: "2026-09-05T00:00:00.000Z", expiresAt: "2027-07-01T04:00:00.000Z", amountCents: 599, currency: "usd", receiptUrl: null, refundEligibility: { eligible: true, deadline: "2026-09-12T00:00:00.000Z", reason: "eligible" } }],
  refundRequests: [], savedDrafts: [], privateImports: [] };
beforeEach(() => getSession.mockResolvedValue({ data: { session: { access_token: "token", user: { id: "A" } } } }));
afterEach(() => { cleanup(); vi.unstubAllGlobals(); });
async function submit(reply: () => Promise<any>) {
  const fetchMock = vi.fn().mockResolvedValueOnce({ ok: true, json: async () => ({ data: account }) }).mockImplementationOnce(reply);
  vi.stubGlobal("fetch", fetchMock); render(<DraftProPanel />);
  fireEvent.change(await screen.findByLabelText(/Explanation/), { target: { value: "The draft board was unavailable." } });
  fireEvent.submit(screen.getByRole("button", { name: "Submit request" }).closest("form")!);
  await waitFor(() => expect(screen.getByRole("button", { name: "Submit request" }).hasAttribute("disabled")).toBe(false));
  await new Promise(r => setTimeout(r, 0));
  return fetchMock;
}
const SENT = "ZQX-SENTINEL-7781";
describe("C7 C3-4", () => {
  it("S1 sentinel sweep: no response text (message/code/details/statusText) ever renders, for 18 statuses", async () => {
    const leaks: string[] = []; const copies = new Set<string>();
    for (const status of [200, 201, 204, 301, 400, 401, 402, 403, 404, 405, 409, 410, 418, 422, 429, 500, 502, 503]) {
      const body = { error: { code: `${SENT}-code`, message: `${SENT}-msg`, details: `${SENT}-details` }, hint: `${SENT}-hint` };
      await submit(() => Promise.resolve({ ok: status < 300, status, statusText: `${SENT}-statusText`, json: async () => body }));
      const text = document.body.textContent ?? ""; if (text.includes(SENT)) leaks.push(String(status));
      const alert = text.match(/(Your [^.]*\.|This purchase[^.]*\.|The 7-day[^.]*\.|Check your refund[^.]*\.|We couldn't reach[^.]*\.)/)?.[0]; copies.add(`${status}: ${alert}`);
      cleanup();
    }
    observed.S1 = { leaks, copies: [...copies] }; expect(leaks).toEqual([]);
  });
  it("S2 thrown non-Error values never render", async () => {
    for (const thrown of [`${SENT}-string`, { message: `${SENT}-obj` }, new Error(`${SENT}-err`)]) {
      await submit(() => Promise.reject(thrown)); expect(document.body.textContent).not.toContain(SENT); cleanup();
    }
  });
  it.each([["infra 404 HTML", 404, null], ["409 with unrelated code", 409, "rate_limited"], ["422 with unrelated code", 422, "internal_error"]])("S3 (probe) %s → which copy", async (name, status, code) => {
    await submit(() => Promise.resolve({ ok: false, status, json: code === null ? () => Promise.reject(new SyntaxError("Unexpected token '<'")) : async () => ({ error: { code, message: "x" } }) }));
    const t = document.body.textContent ?? "";
    (observed.S3 ??= {} as any)[name] = /isn't eligible/.test(t) ? "notEligible" : /open refund request/.test(t) ? "exists" : /7-day/.test(t) ? "windowClosed" : /couldn't be confirmed/.test(t) ? "generic" : "other";
  });
  it("S4 request shape: one POST per submit with the same endpoint/headers/body keys", async () => {
    const f = await submit(() => Promise.reject(new TypeError("Failed to fetch")));
    const [url, init] = f.mock.calls[1]; observed.S4 = { calls: f.mock.calls.length, url, method: init.method, headers: init.headers, body: JSON.parse(init.body) };
    expect(f).toHaveBeenCalledTimes(2);
  });
});
