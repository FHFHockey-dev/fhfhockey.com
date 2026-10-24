// C7 independent controls for C3 BILLING-CANCEL-RELOAD + AUTH-SIGNOUT-CLEANUP. Reviewer scratch only.
import React from "react";
import { act, cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterAll, afterEach, beforeEach, expect, it, vi } from "vitest";
import { writeFileSync } from "node:fs";

const OUT = process.env.C7_C3_OUT ?? "/dev/null";
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

it("X1 two subscriptions keep separate IDs across a reload; accepting one leaves the other", async () => {
  api(["sub_a", "sub_b"]); render(<InSeasonPanel />);
  await cancel(0); await cancel(1);
  cleanup(); render(<InSeasonPanel />); await cancel(0); await cancel(1);
  const s = sent(); observed.X1 = s.map(x => `${x.subscriptionId}:${x.requestId.slice(0, 8)}`);
  expect(s[2]).toEqual(s[0]); expect(s[3]).toEqual(s[1]); expect(s[0].requestId).not.toBe(s[1].requestId);
  cancelBehaviour = async () => ({ ok: true, json: async () => ({ data: { accepted: true } }) });
  fireEvent.click((await screen.findAllByRole("button", { name: "Cancel monthly access" }))[0]); fireEvent.click(screen.getByRole("button", { name: "Confirm cancellation" }));
  await screen.findByText(/Cancellation saved/);
  const stored = JSON.parse(sessionStorage.getItem(KEY)!); observed.X1stored = Object.keys(stored.requests);
  expect(Object.keys(stored.requests)).toEqual(["sub_b"]); expect(stored.requests.sub_b.requestId).toBe(s[1].requestId);
});
it("X2 a definite server rejection (503) keeps the ID for a same-owner retry after reload", async () => {
  cancelBehaviour = async () => ({ ok: false, json: async () => ({ error: "Cancellation could not be saved. Please try again." }) });
  api(); render(<InSeasonPanel />); await cancel(0, "Cancellation could not be saved. Please try again.");
  cleanup(); render(<InSeasonPanel />); await cancel(0, "Cancellation could not be saved. Please try again.");
  const s = sent(); observed.X2 = { same: s[0].requestId === s[1].requestId };
  expect(s[1].requestId).toBe(s[0].requestId);
});
it("X3 hostile subscription keys in storage are never sent or prototype-polluting", async () => {
  sessionStorage.setItem(KEY, JSON.stringify({ ownerId: "owner-a", requests: { "__proto__": { requestId: "11111111-2222-4333-8444-555555555555", savedAt: Date.now() },
    "constructor": { requestId: "11111111-2222-4333-8444-555555555555", savedAt: Date.now() }, "sub_a/../x": { requestId: "11111111-2222-4333-8444-555555555555", savedAt: Date.now() } } }));
  api(); render(<InSeasonPanel />); await cancel(0);
  const stored = JSON.parse(sessionStorage.getItem(KEY)!); observed.X3 = { keys: Object.keys(stored.requests), sent: sent().map(x => x.subscriptionId), polluted: ({} as any).requestId };
  expect(Object.keys(stored.requests)).toEqual(["sub_a"]); expect(({} as any).requestId).toBeUndefined();
  expect(sent()[0].requestId).not.toBe("11111111-2222-4333-8444-555555555555");
});
it("X4 (observation) a 36-dash request ID passes both the client and server regex and is reused", async () => {
  sessionStorage.setItem(KEY, JSON.stringify({ ownerId: "owner-a", requests: { sub_a: { requestId: "-".repeat(36), savedAt: Date.now() } } }));
  api(); render(<InSeasonPanel />); await cancel(0);
  observed.X4 = { sentRequestId: sent()[0].requestId };
});
it("X5 nothing persists before the first cancel, and no token/email is ever written", async () => {
  api(); render(<InSeasonPanel />); await screen.findAllByRole("button", { name: "Cancel monthly access" });
  const before = sessionStorage.getItem(KEY);
  await cancel(0); const raw = sessionStorage.getItem(KEY)!;
  observed.X5 = { before, raw };
  expect(before).toBeNull(); expect(raw).not.toMatch(/"t"|access_token|@/);
});
it.each(["resolves", "rejects"])("X6 resetSupabaseBrowserAuthState with no panel mounted clears only the exact key (signOut %s)", async outcome => {
  sessionStorage.setItem(KEY, "x"); sessionStorage.setItem("FHFH:IN-SEASON-CANCELLATION:V1", "x"); sessionStorage.setItem(KEY + ":old", "keep");
  sessionStorage.setItem("fhfh:in-season-cancellation:v10", "keep"); localStorage.setItem(KEY, "x");
  const client: any = { auth: { signOut: outcome === "resolves" ? vi.fn().mockResolvedValue({ error: null }) : vi.fn().mockRejectedValue(new Error("expired")) } };
  await resetSupabaseBrowserAuthState(client, 50);
  const state = { session: sessionStorage.getItem(KEY), upper: sessionStorage.getItem("FHFH:IN-SEASON-CANCELLATION:V1"), old: sessionStorage.getItem(KEY + ":old"),
    v10: sessionStorage.getItem("fhfh:in-season-cancellation:v10"), local: localStorage.getItem(KEY) };
  observed[`X6 ${outcome}`] = state;
  expect(state).toEqual({ session: null, upper: null, old: "keep", v10: "keep", local: null });
});
