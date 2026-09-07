import { beforeEach, describe, expect, it, vi } from "vitest";

const auth = vi.hoisted(() => vi.fn());
const access = vi.hoisted(() => vi.fn());
const requireCapability = vi.hoisted(() => vi.fn());
const begin = vi.hoisted(() => vi.fn());
vi.mock("lib/api/requireApiUser", () => ({ requireApiUser: auth }));
vi.mock("lib/draft-pro/features", () => ({ getDraftProFeatureFlags: () => ({ private_imports: true }) }));
vi.mock("lib/draft-pro/server", () => ({ loadDraftProAccess: access, requireDraftProServerCapability: requireCapability }));
vi.mock("lib/draft-pro/privateImportTransport", () => ({ beginPrivateImport: begin }));

import handler from "./private-imports";

const response = () => {
  const value: any = { statusCode: 0 };
  return Object.assign(value, { status(code: number) { value.statusCode = code; return value; }, json(body: unknown) { value.body = body; return value; }, setHeader: vi.fn() });
};
const body = { draftId: "11111111-1111-4111-8111-111111111111", expectedVersion: 2, attemptKey: "attempt-1", name: "My import", mapping: { sourceId: "custom_csv_1", headers: [{ original: "Player", standardized: "name", selected: true }] }, declaredMaxBytes: 1024 };
const session = { save_session_id: null, expires_at: "2099-01-01T00:00:00.000Z", draft_id: body.draftId, current_version: 3 };

describe("private import begin route", () => {
  beforeEach(() => { vi.clearAllMocks(); requireCapability.mockReset(); auth.mockResolvedValue({ id: "owner-1" }); access.mockResolvedValue({}); begin.mockResolvedValue({ status: "ready", session: { ...session, status: "ready", save_session_id: "save-1" }, upload: { status: "ready", upload_id: "upload-1" } }); });

  it.each(["busy", "conflict"])("maps SQL %s save-session results to 409", async (status) => {
    begin.mockResolvedValueOnce({ status, session: { ...session, status } });
    const res = response(); await handler({ method: "POST", headers: {}, body } as any, res);
    expect(res.statusCode).toBe(409); expect(res.body).toEqual({ data: { current: { id: body.draftId, lockVersion: 3 } } });
  });

  it("requires a bounded source identity and normalized header mapping", async () => {
    const res = response(); await handler({ method: "POST", headers: {}, body: { ...body, mapping: { headers: [] } } } as any, res);
    expect(res.statusCode).toBe(400); expect(begin).not.toHaveBeenCalled(); expect(res.setHeader).toHaveBeenCalledWith("Cache-Control", "private, no-store");
  });

  it("preserves the inactive capability's 403 reason", async () => {
    const denied: any = new Error("Private imports require an active grant."); denied.statusCode = 403; denied.code = "no_active_grant";
    requireCapability.mockImplementation(() => { throw denied; });
    const res = response(); await handler({ method: "POST", headers: {}, body } as any, res);
    expect(res.statusCode).toBe(403); expect(res.body).toEqual({ error: { code: "no_active_grant", message: "Private imports require an active grant." } }); expect(begin).not.toHaveBeenCalled();
  });

  it("returns a normal ready upload begin result", async () => {
    const res = response(); await handler({ method: "POST", headers: {}, body } as any, res);
    expect(res.statusCode).toBe(201); expect(begin).toHaveBeenCalledWith(expect.objectContaining({ userId: "owner-1", mapping: body.mapping }));
  });
});
