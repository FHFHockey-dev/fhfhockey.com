import { beforeEach, describe, expect, it, vi } from "vitest";

const auth = vi.hoisted(() => vi.fn());
const access = vi.hoisted(() => vi.fn());
const requireCapability = vi.hoisted(() => vi.fn());
const list = vi.hoisted(() => vi.fn());
const commit = vi.hoisted(() => vi.fn());
vi.mock("lib/api/requireApiUser", () => ({ requireApiUser: auth }));
vi.mock("lib/draft-pro/features", () => ({ getDraftProFeatureFlags: () => ({ saved_drafts: true }) }));
vi.mock("lib/draft-pro/server", () => ({ loadDraftProAccess: access, requireDraftProServerCapability: requireCapability }));
vi.mock("lib/draft-pro/savedDraftsServer", () => ({ listSavedDrafts: list, commitSavedDraft: commit }));

import handler from "./index";

const response = () => {
  const value: any = { statusCode: 0 };
  return Object.assign(value, { status(code: number) { value.statusCode = code; return value; }, json(body: unknown) { value.body = body; return value; }, setHeader: vi.fn() });
};
const valid = { attemptKey: "attempt-1", name: "Mock draft", snapshot: { settings: {}, picks: [], keepers: [], trades: [], team: {}, sourceWeights: {}, importMappings: {}, favorites: [], notes: [], tiers: {}, recommendationPreferences: {} } };

describe("saved drafts route", () => {
  beforeEach(() => { vi.clearAllMocks(); requireCapability.mockReset(); auth.mockResolvedValue({ id: "user-1" }); access.mockResolvedValue({}); list.mockResolvedValue([]); commit.mockResolvedValue({ conflict: false, draft: { id: "draft-1" } }); });

  it("returns only owned summaries on GET without requesting premium payloads", async () => {
    const res = response(); await handler({ method: "GET", headers: {} } as any, res);
    expect(res.statusCode).toBe(200); expect(list).toHaveBeenCalledWith("user-1"); expect(access).not.toHaveBeenCalled();
  });

  it("requires the server capability before a cloud save", async () => {
    requireCapability.mockImplementation(() => { const error: any = new Error("No access"); error.statusCode = 403; error.code = "no_active_grant"; throw error; });
    const res = response(); await handler({ method: "POST", headers: {}, body: valid } as any, res);
    expect(res.statusCode).toBe(403); expect(commit).not.toHaveBeenCalled();
  });

  it("maps an atomic version conflict to 409", async () => {
    commit.mockResolvedValue({ conflict: true, current: { id: "draft-1", lockVersion: 3 } });
    const res = response(); await handler({ method: "POST", headers: {}, body: valid } as any, res);
    expect(res.statusCode).toBe(409); expect(commit).toHaveBeenCalledWith(expect.objectContaining({ userId: "user-1", draftId: null }));
  });

  it("maps a busy save session to a 409 with the SQL draft version", async () => {
    commit.mockResolvedValue({ conflict: true, current: { id: "draft-1", lockVersion: 3 } });
    const res = response(); await handler({ method: "POST", headers: {}, body: valid } as any, res);
    expect(res.statusCode).toBe(409); expect(res.body).toEqual({ data: { current: { id: "draft-1", lockVersion: 3 } } });
  });

  it("rejects consent-only client fields so callers must use the upload boundary", async () => {
    const res = response(); await handler({ method: "POST", headers: {}, body: { ...valid, accountSaveConsent: true } } as any, res);
    expect(res.statusCode).toBe(400); expect(commit).not.toHaveBeenCalled();
  });

  it("requires the stable attempt key that binds a save to its upload session", async () => {
    const { attemptKey: _attemptKey, ...withoutAttemptKey } = valid;
    const res = response(); await handler({ method: "POST", headers: {}, body: withoutAttemptKey } as any, res);
    expect(res.statusCode).toBe(400); expect(commit).not.toHaveBeenCalled();
  });
});
