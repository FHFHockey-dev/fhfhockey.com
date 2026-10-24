import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { resetSupabaseBrowserAuthState as baselineReset } from "../isolated/baseline/web/lib/supabase/browser-auth";
import { resetSupabaseBrowserAuthState as proposedReset } from "../isolated/proposed/web/lib/supabase/browser-auth";

const mocks = vi.hoisted(() => ({ owner: "owner-a", session: vi.fn(), auth: vi.fn(), refresh: vi.fn() }));
vi.mock("hooks/useProviderSyncAccess", () => ({ useProviderSyncAccess: () => ({ status: "ready", access: { eligible: false }, refresh: mocks.refresh }) }));
vi.mock("lib/supabase/client", () => ({ default: { auth: { getSession: mocks.session, onAuthStateChange: mocks.auth } } }));
vi.mock("next/link", () => ({ default: ({ children, href }: { children: React.ReactNode; href: string }) => <a href={href}>{children}</a> }));
import InSeasonPanel from "../isolated/panel/web/components/account/InSeasonPanel";

const key = "fhfh:in-season-cancellation:v1";
const seedId = "11111111-2222-4333-8444-555555555555";
const now = 1_800_000_000_000;
const day = 24 * 60 * 60 * 1000;
const ids: string[] = [];
const saved = (ownerId = "owner-a", savedAt = now) => JSON.stringify({ ownerId, requests: { sub_fixture: { requestId: seedId, savedAt } } });
const fakeClient = (signOut: ReturnType<typeof vi.fn>) => ({ auth: { signOut } }) as never;

beforeEach(() => {
  localStorage.clear(); sessionStorage.clear(); vi.clearAllMocks(); ids.length = 0; mocks.owner = "owner-a";
  vi.spyOn(Date, "now").mockReturnValue(now);
  mocks.session.mockImplementation(async () => ({ data: { session: { user: { id: mocks.owner }, access_token: "SYNTHETIC_REVIEW_TOKEN" } } }));
  mocks.auth.mockReturnValue({ data: { subscription: { unsubscribe: vi.fn() } } });
  vi.stubGlobal("fetch", vi.fn(async (url, init) => {
    if (url === "/api/v1/account/in-season/checkout") return { ok: true, json: async () => ({ data: { managementAvailable: true } }) };
    if (url === "/api/v1/account/in-season/subscriptions") return { ok: true, json: async () => ({ data: { subscriptions: [{ subscriptionId: "sub_fixture", cancelledAt: null, billingStoppedAt: null, stopComplete: false }] } }) };
    if (url === "/api/v1/account/in-season/cancel") { ids.push(JSON.parse(init.body).requestId); throw new Error("review response lost"); }
    throw new Error(`Unexpected offline fixture URL: ${String(url)}`);
  }));
});
afterEach(() => { cleanup(); vi.restoreAllMocks(); vi.unstubAllGlobals(); vi.useRealTimers(); });
async function attempt() {
  fireEvent.click(await screen.findByRole("button", { name: "Cancel monthly access" }));
  fireEvent.click(screen.getByRole("button", { name: "Confirm cancellation" }));
  await screen.findByText("review response lost");
}

describe("Independent C3 persistence and shared-reset boundary", () => {
  it.each([{ age: day - 1, reuse: true }, { age: day, reuse: false }])("honors the exact restore cutoff at $age ms", async ({ age, reuse }) => {
    sessionStorage.setItem(key, saved("owner-a", now - age)); render(<InSeasonPanel />); await attempt();
    expect(ids[0] === seedId).toBe(reuse);
    expect(sessionStorage.getItem(key)).not.toContain("SYNTHETIC_REVIEW_TOKEN");
  });
  it("retains raw bytes beyond 24 hours while unmounted, then discards the expired ID on restore", async () => {
    render(<InSeasonPanel />); await attempt(); const stored = sessionStorage.getItem(key), first = ids[0]; cleanup();
    vi.mocked(Date.now).mockReturnValue(now + 2 * day);
    expect(sessionStorage.getItem(key)).toBe(stored); // No timer/expiry purges an unmounted tab.
    render(<InSeasonPanel />); await attempt(); expect(ids[1]).not.toBe(first);
  });
  it("leaves former-owner metadata until a no-callback new owner restores, but never reuses that owner's request ID", async () => {
    render(<InSeasonPanel />); await attempt(); const first = ids[0]; cleanup(); mocks.owner = "owner-b";
    render(<InSeasonPanel />); await screen.findByRole("button", { name: "Cancel monthly access" });
    expect(JSON.parse(sessionStorage.getItem(key)!).ownerId).toBe("owner-a");
    await attempt(); expect(ids[1]).not.toBe(first);
    const state = sessionStorage.getItem(key)!; expect(JSON.parse(state).ownerId).toBe("owner-b"); expect(state).not.toContain(first);
  });
  it("reproduces cleanup after panel unmount: baseline leaves the key; the exact proposed copy clears it", async () => {
    render(<InSeasonPanel />); await attempt(); cleanup();
    const signOut = vi.fn().mockResolvedValue({ error: null });
    await baselineReset(fakeClient(signOut)); expect(sessionStorage.getItem(key)).not.toBeNull();
    await proposedReset(fakeClient(signOut)); expect(sessionStorage.getItem(key)).toBeNull();
    expect(signOut).toHaveBeenNthCalledWith(1, { scope: "local" }); expect(signOut).toHaveBeenNthCalledWith(2, { scope: "local" });
  });
  it.each(["resolved", "rejected", "timeout"])("the proposal clears only the exact key/case variants in both stores when sign-out is %s", async mode => {
    const removed = [key, key.toUpperCase()];
    const preserved = [`${key}:extra`, `x${key}`, "fhfh:in-season-cancellation:v2", "manual-plan-fixture", "fhfh:rso:local-plan", "unrelated-app-state"];
    for (const storage of [localStorage, sessionStorage]) for (const k of [...removed, ...preserved]) storage.setItem(k, "private fixture bytes");
    const signOut = vi.fn(mode === "resolved" ? async () => ({ error: null }) : mode === "rejected" ? async () => { throw new Error("SYNTHETIC_AUTH_FAILURE"); } : () => new Promise(() => {}));
    if (mode === "timeout") vi.useFakeTimers();
    const reset = proposedReset(fakeClient(signOut), 5);
    if (mode === "timeout") await vi.advanceTimersByTimeAsync(5);
    await reset;
    for (const storage of [localStorage, sessionStorage]) {
      for (const k of removed) expect(storage.getItem(k)).toBeNull();
      for (const k of preserved) expect(storage.getItem(k)).toBe("private fixture bytes");
    }
  });
  it("continues sessionStorage cleanup if access to localStorage throws", async () => {
    sessionStorage.setItem(key, saved()); const actualLocalStorage = window.localStorage; actualLocalStorage.setItem("manual-plan-fixture", "preserve");
    vi.spyOn(window, "localStorage", "get").mockImplementation(() => { throw new Error("storage blocked"); });
    await proposedReset(fakeClient(vi.fn().mockResolvedValue({ error: null })));
    expect(sessionStorage.getItem(key)).toBeNull(); expect(actualLocalStorage.getItem("manual-plan-fixture")).toBe("preserve");
  });
});
