import { DraftProRequestError } from "lib/draft-pro/requestError";
import { beforeEach, describe, expect, it, vi } from "vitest";

const auth = vi.hoisted(() => vi.fn());
const access = vi.hoisted(() => vi.fn());
const requireCapability = vi.hoisted(() => vi.fn());
const list = vi.hoisted(() => vi.fn());
const commit = vi.hoisted(() => vi.fn());
const read = vi.hoisted(() => vi.fn());
const mutate = vi.hoisted(() => vi.fn());
vi.mock("lib/api/requireApiUser", () => ({ requireApiUser: auth }));
vi.mock("lib/draft-pro/features", () => ({ getDraftProFeatureFlags: () => ({ saved_drafts: true }) }));
vi.mock("lib/draft-pro/server", () => ({ loadDraftProAccess: access, requireDraftProServerCapability: requireCapability }));
vi.mock("lib/draft-pro/savedDraftsServer", () => ({ listSavedDrafts: list, commitSavedDraft: commit, readSavedDraft: read, mutateSavedDraft: mutate }));

import handler from "../../../pages/api/v1/account/draft-pro/drafts";
import itemHandler from "../../../pages/api/v1/account/draft-pro/drafts/[id]";

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
    requireCapability.mockImplementation(() => { throw new DraftProRequestError(403, "No access", "no_active_grant"); });
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

  it.each([403, 503])("sanitizes backend status %s on saved-draft list and detail", async (statusCode) => {
    const dependencyError = Object.assign(new Error("synthetic-private-relation-detail"), { statusCode, code: "synthetic-backend-code" });
    list.mockRejectedValueOnce(dependencyError);
    read.mockRejectedValueOnce(dependencyError);
    for (const route of [handler, itemHandler]) {
      const res = response();
      await route({ method: "GET", headers: {}, query: { id: "00000000-0000-4000-8000-000000000001" } } as any, res);
      expect(res.statusCode).toBe(500);
      expect(res.body).toEqual({ error: { code: "saved_drafts_unavailable", message: "Saved Drafts are unavailable. Your local draft is unchanged." } });
      expect(JSON.stringify(res.body)).not.toContain("synthetic-private");
      expect(JSON.stringify(res.body)).not.toContain("synthetic-backend");
    }
  });

});
