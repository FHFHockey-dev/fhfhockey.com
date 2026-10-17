import { describe, expect, it, vi } from "vitest";
import { JSDOM } from "jsdom";
import { diagnosticHtml, diagnosticLocalOnly } from "./diagnostic";
const key = "sb-fixture-auth-token";
function page(session?: unknown, response?: unknown) {
  const network = vi.fn(async (..._args: any[]) => ({ status: 200, json: async () => response }));
  const dom = new JSDOM(diagnosticHtml(key, "fixture-nonce"), {
    url: "http://localhost:3000/api/v1/roster-schedule-optimizer/diagnostic", runScripts: "dangerously",
    beforeParse(window) { if (session !== undefined) window.localStorage.setItem(key, JSON.stringify(session)); window.fetch = network as any; },
  });
  const writes = vi.spyOn(dom.window.Storage.prototype, "setItem");
  const removes = vi.spyOn(dom.window.Storage.prototype, "removeItem");
  const run = () => { (dom.window.document.getElementById("approved") as HTMLInputElement).checked = true; dom.window.document.getElementById("run")!.click(); };
  return { dom, network, writes, removes, run, report: () => JSON.parse(dom.window.document.getElementById("report")!.textContent!) };
}
const valid = () => ({ access_token: "fixture-secret", refresh_token: "fixture-refresh", expires_at: Date.now() / 1000 + 3600, user: { id: "owner" } });
describe("isolated diagnostic", () => {
  it("is development and loopback only", () => {
    expect(diagnosticLocalOnly("development", "localhost:3000", "127.0.0.1")).toBe(true);
    expect(diagnosticLocalOnly("production", "localhost:3000", "127.0.0.1")).toBe(false);
    expect(diagnosticLocalOnly("development", "fhfhockey.com", "127.0.0.1")).toBe(false);
    expect(diagnosticLocalOnly("development", "localhost.attacker.com", "127.0.0.1")).toBe(false);
    expect(diagnosticLocalOnly("development", "localhost:3000", "203.0.113.10")).toBe(false);
    expect(diagnosticLocalOnly("development", "localhost:3000", undefined)).toBe(false);
    expect(diagnosticLocalOnly("development", "localhost:3000", "::ffff:127.0.0.1")).toBe(true);
  });
  it.each([undefined, {}, { ...valid(), expires_at: 1 }])("does not refresh or write unavailable/expired sessions", async session => {
    const p = page(session); p.run(); await vi.waitFor(() => expect(p.report().reason).toBe("normal_session_unavailable"));
    expect(p.network).not.toHaveBeenCalled(); expect(p.writes).not.toHaveBeenCalled(); expect(p.removes).not.toHaveBeenCalled(); p.dom.window.close();
  });
  it("does nothing at mount or without approval; one click permits exactly one GET and no storage writes", async () => {
    const p = page(valid(), { kind: "rso-readonly-diagnostic-v1", principalId: "owner", backendReads: 5, status: "read_complete", reason: "baseline", context: { currentProviderTimeZone: null } });
    expect(p.network).not.toHaveBeenCalled(); p.dom.window.document.getElementById("run")!.click(); expect(p.network).not.toHaveBeenCalled(); p.run(); p.run();
    await vi.waitFor(() => expect(p.report().status).toBe("read_complete")); expect(p.network).toHaveBeenCalledTimes(1);
    expect(p.network.mock.calls[0]).toEqual(["/api/v1/roster-schedule-optimizer/diagnostic-context", expect.objectContaining({ method: "GET", credentials: "omit", redirect: "error", cache: "no-store" })]);
    expect(p.writes).not.toHaveBeenCalled(); expect(p.removes).not.toHaveBeenCalled(); expect(JSON.stringify(p.report())).not.toMatch(/fixture-secret|fixture-refresh/); p.dom.window.close();
  });
  it("rejects a changed principal without displaying its report", async () => {
    const p = page(valid(), { kind: "rso-readonly-diagnostic-v1", principalId: "other", private: "not-for-this-owner" }); p.run();
    await vi.waitFor(() => expect(p.report().reason).toBe("unexpected_response")); expect(p.report().data).toBeNull(); p.dom.window.close();
  });
  it("never prints thrown errors or retries", async () => {
    const p = page(valid()); p.network.mockRejectedValue(new Error("fixture-secret")); p.run();
    await vi.waitFor(() => expect(p.report().reason).toBe("read_failed_or_session_unavailable")); expect(p.network).toHaveBeenCalledTimes(1); expect(JSON.stringify(p.report())).not.toContain("fixture-secret"); p.dom.window.close();
  });
});
