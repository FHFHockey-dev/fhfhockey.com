// C7 independent controls for C3 BILLING-CANCEL-RELOAD + AUTH-SIGNOUT-CLEANUP. Reviewer scratch only.
import React from "react";
import { act, cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterAll, afterEach, beforeEach, expect, it, vi } from "vitest";
import { writeFileSync } from "node:fs";

const OUT = process.env.C7_C3R1_OUT ?? "/dev/null";
const observed: Record<string, unknown> = {};
afterAll(() => { if (OUT !== "/dev/null") writeFileSync(OUT, JSON.stringify(observed, null, 2)); });
const m = vi.hoisted(() => ({ access: vi.fn(), session: vi.fn(), auth: vi.fn(), refresh: vi.fn() }));
vi.mock("hooks/useProviderSyncAccess", () => ({ useProviderSyncAccess: m.access }));
vi.mock("lib/supabase/client", () => ({ default: { auth: { getSession: m.session, onAuthStateChange: m.auth } } }));
vi.mock("next/link", () => ({ default: ({ children, href }: any) => <a href={href}>{children}</a> }));
import InSeasonPanel from "components/account/InSeasonPanel";
import { resetSupabaseBrowserAuthState } from "lib/supabase/browser-auth";

const KEY = "fhfh:in-season-cancellation:v1";
const subs = (ids: string[]) => ids.map(subscriptionId => ({ subscriptionId, cancelledAt: null, billingStoppedAt: null, stopComplete: false }));
let cancelBehaviour: (body: any) => Promise<any> = () => Promise.reject(new Error("Cancellation response lost"));
function api(subscriptionIds = ["sub_a"]) {
  vi.mocked(fetch).mockImplementation(async (url: any, init: any) => {
    if (url === "/api/v1/account/in-season/subscriptions") return { ok: true, json: async () => ({ data: { subscriptions: subs(subscriptionIds) } }) } as Response;
    if (url === "/api/v1/account/in-season/cancel") return cancelBehaviour(JSON.parse(init.body));
    return { ok: true, json: async () => ({ data: { seasonPassAvailable: false, monthlyAvailable: false, managementAvailable: true, initialMonthlyAmountCents: 177, monthlyReason: "disabled" } }) } as Response;
  });
}
const sent = () => vi.mocked(fetch).mock.calls.filter(([u]) => u === "/api/v1/account/in-season/cancel").map(([, i]) => JSON.parse((i as any).body));
async function cancel(index = 0, expectText: RegExp | string = "Cancellation response lost") {
  const buttons = await screen.findAllByRole("button", { name: "Cancel monthly access" });
  fireEvent.click(buttons[index]); fireEvent.click(screen.getByRole("button", { name: "Confirm cancellation" }));
  await screen.findByText(expectText);
}
beforeEach(() => {
  vi.resetAllMocks(); sessionStorage.clear(); localStorage.clear();
  m.auth.mockReturnValue({ data: { subscription: { unsubscribe: vi.fn() } } });
  m.session.mockResolvedValue({ data: { session: { access_token: "t", user: { id: "owner-a" } } } });
  m.access.mockReturnValue({ status: "ready", access: { eligible: false }, refresh: m.refresh });
  vi.stubGlobal("fetch", vi.fn()); cancelBehaviour = () => Promise.reject(new Error("Cancellation response lost"));
});
afterEach(() => { cleanup(); vi.unstubAllGlobals(); });

const STRICT = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/;
const real = crypto.randomUUID();
it.each([
  ["36 dashes", "-".repeat(36), false], ["v1 UUID", "6ba7b810-9dad-11d1-80b4-00c04fd430c8", false], ["uppercase v4", real.toUpperCase(), false],
  ["v4 bad variant", "11111111-2222-4333-c444-555555555555", false], ["35 chars", real.slice(0, 35), false], ["trailing space", real + " ", false],
  ["hex without dashes (36)", "0123456789abcdef0123456789abcdef0123", false], ["v4-shaped nil-ish", "00000000-0000-4000-8000-000000000000", true], ["real randomUUID", real, true],
])("R1-U %s stored → %s", async (name, stored, reuse) => {
  sessionStorage.setItem(KEY, JSON.stringify({ ownerId: "owner-a", requests: { sub_a: { requestId: stored, savedAt: Date.now() - 1000 } } }));
  api(); render(<InSeasonPanel />); await cancel(0);
  const sentId = sent()[0].requestId; observed[`R1-U ${name}`] = { stored, sent: sentId, reused: sentId === stored };
  expect(STRICT.test(sentId)).toBe(true); expect(sentId === stored).toBe(reuse);
  const kept = JSON.parse(sessionStorage.getItem(KEY)!).requests.sub_a.requestId; expect(kept).toBe(sentId);
});
it("R1-U fresh IDs from the panel are strict v4 and survive reload", async () => {
  api(); render(<InSeasonPanel />); await cancel(0); cleanup(); render(<InSeasonPanel />); await cancel(0);
  const s = sent(); observed["R1-U fresh"] = s.map(x => x.requestId);
  expect(STRICT.test(s[0].requestId)).toBe(true); expect(s[1].requestId).toBe(s[0].requestId);
});
