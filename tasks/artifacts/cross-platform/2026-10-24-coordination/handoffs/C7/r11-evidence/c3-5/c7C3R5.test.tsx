// C7 controls for C3-5: sentinel sweep on account load / redeem / verify / Patreon connect; tense edges; refund F1 probes.
import React from "react";
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterAll, afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { writeFileSync } from "node:fs";
const OUT = process.env.C7_C3R5_OUT; const observed: Record<string, unknown> = {};
afterAll(() => { if (OUT) writeFileSync(OUT, JSON.stringify(observed, null, 2)); });
const getSession = vi.hoisted(() => vi.fn()); const routerQuery = vi.hoisted(() => ({} as Record<string, string>));
vi.mock("lib/supabase/client", () => ({ default: { auth: { getSession, onAuthStateChange: () => ({ data: { subscription: { unsubscribe() {} } } }) } } }));
vi.mock("next/router", () => ({ useRouter: () => ({ query: routerQuery, pathname: "/account", replace: vi.fn() }) }));
import DraftProPanel from "components/account/DraftProPanel";
const SENT = "ZQX-SENT-5521";
const purchase = (deadline: string | null, eligible = false) => ({ id: "purchase-1", season: "draft_pro_2026_27", status: "active", activatedAt: "2026-09-05T00:00:00.000Z", expiresAt: "2027-07-01T04:00:00.000Z", amountCents: 599, currency: "usd", receiptUrl: null, refundEligibility: { eligible, deadline, reason: eligible ? "eligible" : "window_closed" } });
const account = (over: any = {}) => ({ access: { eligible: true, grantingSources: ["purchase"], expiresAt: "2027-07-01T04:00:00.000Z", verifiedAt: null, reason: "eligible", providerReadiness: { patreon: false } },
  passInfo: { priceCents: 599, expiresAt: "2027-07-01T04:00:00.000Z", renewal: "none" }, checkoutAvailability: { available: true, reason: "available" }, purchases: [purchase("2026-09-12T00:00:00.000Z", true)], refundRequests: [], savedDrafts: [], privateImports: [], ...over });
const sentinelReply = (status: number) => ({ ok: status < 300, status, statusText: `${SENT}-st`, json: async () => ({ error: { code: `${SENT}-code`, message: `${SENT}-msg` }, message: `${SENT}-m2`, detail: `${SENT}-d` }) });
beforeEach(() => getSession.mockResolvedValue({ data: { session: { access_token: "token", user: { id: "A" } } } }));
afterEach(() => { cleanup(); vi.unstubAllGlobals(); delete routerQuery.draft_pro_checkout; vi.useRealTimers(); });
const route = (handlers: Record<string, () => any>, acct: any = account()) => vi.fn(async (url: string) => {
  for (const [k, h] of Object.entries(handlers)) if (url.endsWith(k)) return h();
  return { ok: true, status: 200, json: async () => ({ data: acct }) };
});
const settle = () => new Promise(r => setTimeout(r, 30));
describe("C7 C3-5", () => {
  it("S1 account load: sentinel never renders for 400/401/403/404/500/502/503 or thrown values", async () => {
    const leaks: string[] = []; const shown: Record<string, string> = {};
    for (const st of [400, 401, 403, 404, 500, 502, 503]) {
      vi.stubGlobal("fetch", vi.fn(async () => sentinelReply(st))); render(<DraftProPanel />);
      await waitFor(() => expect(document.body.textContent).toMatch(/sign-in has expired|account details are unavailable/)); await settle();
      const t = document.body.textContent!; if (t.includes(SENT)) leaks.push(String(st)); shown[st] = /sign-in has expired/.test(t) ? "signIn" : "unavailable"; cleanup();
    }
    for (const thrown of [new TypeError(`${SENT}-te`), `${SENT}-str`, { message: `${SENT}-obj` }]) {
      vi.stubGlobal("fetch", vi.fn(async () => { throw thrown; })); render(<DraftProPanel />); await settle(); await settle();
      if (document.body.textContent!.includes(SENT)) leaks.push(`thrown:${typeof thrown}`); cleanup();
    }
    observed.S1 = { leaks, shown }; expect(leaks).toEqual([]);
  });
  it("S2 redeem: sentinel never renders; parse failure copy recorded", async () => {
    const leaks: string[] = []; const shown: Record<string, string> = {};
    const cases: Record<string, () => any> = { "400": () => sentinelReply(400), "401": () => sentinelReply(401), "403": () => sentinelReply(403), "429": () => sentinelReply(429), "500": () => sentinelReply(500),
      "200-not-redeemed": () => ({ ok: true, status: 200, json: async () => ({ redeemed: false, error: `${SENT}` }) }),
      "502-html": () => ({ ok: false, status: 502, json: () => Promise.reject(new SyntaxError(`Unexpected token '<' ${SENT}`)) }),
      "network": () => Promise.reject(new TypeError(`Failed to fetch ${SENT}`)) };
    for (const [name, h] of Object.entries(cases)) {
      vi.stubGlobal("fetch", route({ "/access-codes/redeem": h }, account({ access: { eligible: false, grantingSources: [], expiresAt: null, verifiedAt: null, reason: "no_grant", providerReadiness: { patreon: false } } })));
      render(<DraftProPanel />);
      fireEvent.change(await screen.findByLabelText("Draft Pro access code"), { target: { value: "FHFH-COMP-11111111-1111-4111-8111-111111111111" } });
      fireEvent.submit(screen.getByRole("button", { name: "Redeem code" }).closest("form")!);
      const alert = await screen.findByRole("alert"); await settle();
      const t = document.body.textContent!; if (t.includes(SENT)) leaks.push(name); shown[name] = alert.textContent!.slice(0, 60);
      expect(screen.getByRole("button", { name: "Redeem code" }).hasAttribute("disabled")).toBe(false); cleanup();
    }
    observed.S2 = { leaks, shown }; expect(leaks).toEqual([]);
  });
  it("S3 checkout verify: sentinel never renders and the retry button remains", async () => {
    const leaks: string[] = []; const shown: Record<string, string> = {};
    for (const st of [400, 401, 403, 409, 429, 500, 503]) {
      routerQuery.draft_pro_checkout = "cs_test_c7";
      vi.stubGlobal("fetch", route({ "/checkout/verify": () => sentinelReply(st) }, account({ access: { eligible: false, grantingSources: [], expiresAt: null, verifiedAt: null, reason: "no_grant", providerReadiness: { patreon: false } } })));
      render(<DraftProPanel />);
      await waitFor(() => expect(document.body.textContent).toMatch(/couldn't be checked|Sign in to confirm|wait a minute/), { timeout: 4000 }); await settle();
      const t = document.body.textContent!; if (t.includes(SENT)) leaks.push(String(st));
      shown[st] = (t.match(/(Your purchase status couldn't be checked|Sign in to confirm your Draft Pro purchase|Please wait a minute before checking again)/) ?? [""])[0];
      cleanup(); delete routerQuery.draft_pro_checkout;
    }
    observed.S3 = { leaks, shown }; expect(leaks).toEqual([]);
  });
  it("S4 Patreon connect: sentinel never renders; button re-enables", async () => {
    const leaks: string[] = [];
    for (const h of [() => sentinelReply(500), () => sentinelReply(401), () => Promise.reject(new TypeError(`${SENT}-net`)), () => ({ ok: false, status: 500, json: async () => ({ error: { nested: SENT } }) })]) {
      vi.stubGlobal("fetch", route({ "/patreon/connect": h })); render(<DraftProPanel />);
      fireEvent.click(await screen.findByRole("button", { name: "Connect Patreon" })); await settle(); await settle();
      if (document.body.textContent!.includes(SENT) || /\[object Object\]/.test(document.body.textContent!)) leaks.push("leak");
      expect(screen.getByRole("button", { name: "Connect Patreon" }).hasAttribute("disabled")).toBe(false); cleanup();
    }
    observed.S4 = { leaks }; expect(leaks).toEqual([]);
  });
  it.each([["+90s", 90_000, "ends"], ["-90s", -90_000, "ended"], ["+400d", 400 * 86400000, "ends"], ["invalid", null, "?"]])("T1 deadline %s → tense", async (name, offset, want) => {
    const deadline = offset === null ? "not-a-date" : new Date(Date.now() + (offset as number)).toISOString();
    vi.stubGlobal("fetch", route({}, account({ purchases: [purchase(deadline, false)] }))); render(<DraftProPanel />);
    const p = await screen.findByText(/Refund eligibility:/); (observed.T1 ??= {} as any)[name] = p.textContent;
    if (want !== "?") expect(p.textContent).toMatch(new RegExp(`window ${want} `));
  });
  it.each([["proxy 404 html", 404, null], ["404 other code", 404, "other"], ["409 other", 409, "rate_limited"], ["422 config own code", 422, "configuration_error"], ["422 no code", 422, undefined], ["400 no code", 400, undefined], ["401", 401, undefined], ["422 window (authentic)", 422, "refund_window_closed"]])("F1 refund %s", async (name, status, code) => {
    vi.stubGlobal("fetch", route({ "/refund-requests": () => ({ ok: false, status, json: code === null ? () => Promise.reject(new SyntaxError("<")) : async () => ({ error: code === undefined ? {} : { code, message: "x" } }) }) }));
    render(<DraftProPanel />);
    fireEvent.change(await screen.findByLabelText(/Explanation/), { target: { value: "The draft board was unavailable." } });
    fireEvent.submit(screen.getByRole("button", { name: "Submit request" }).closest("form")!);
    const st = await screen.findByRole("status"); (observed.F1 ??= {} as any)[name] = st.textContent!.slice(0, 70);
    const generic = /couldn't be confirmed right now/.test(st.textContent!);
    if (name === "401") expect(st.textContent).toMatch(/sign-in has expired/); else if (name.includes("authentic")) expect(st.textContent).toMatch(/7-day/); else expect(generic).toBe(true);
  });
});
