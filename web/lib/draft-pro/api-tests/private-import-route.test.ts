import { DraftProRequestError } from "lib/draft-pro/requestError";
import { beforeEach, describe, expect, it, vi } from "vitest";

const auth = vi.hoisted(() => vi.fn());
const access = vi.hoisted(() => vi.fn());
const requireCapability = vi.hoisted(() => vi.fn());
const readChunk = vi.hoisted(() => vi.fn());
vi.mock("lib/api/requireApiUser", () => ({ requireApiUser: auth }));
vi.mock("lib/draft-pro/features", () => ({ getDraftProFeatureFlags: () => ({ private_imports: true }) }));
vi.mock("lib/draft-pro/server", () => ({ loadDraftProAccess: access, requireDraftProServerCapability: requireCapability }));
vi.mock("lib/draft-pro/privateImportTransport", () => ({ readPrivateImportChunk: readChunk }));

import handler from "../../../pages/api/v1/account/draft-pro/drafts/[id]/imports/[importId]";

const response = () => {
  const value: any = { statusCode: 0 };
  return Object.assign(value, { status(code: number) { value.statusCode = code; return value; }, json(body: unknown) { value.body = body; return value; }, send(body: unknown) { value.body = body; return value; }, end: vi.fn(), setHeader: vi.fn() });
};
const query = { id: "11111111-1111-4111-8111-111111111111", importId: "22222222-2222-4222-8222-222222222222", ordinal: "0" };

describe("private import read route", () => {
  beforeEach(() => { vi.clearAllMocks(); requireCapability.mockReset(); auth.mockResolvedValue({ id: "owner-1" }); access.mockResolvedValue({}); readChunk.mockResolvedValue({ bytes: Buffer.from("[]"), totalBytes: 2, totalChunks: 1, sha256: "a".repeat(64), rowCount: 0 }); });

  it("preserves the capability guard's 403 reason before storage access", async () => {
    const denied = new DraftProRequestError(403, "Private imports require an active grant.", "no_active_grant");
    requireCapability.mockImplementation(() => { throw denied; });
    const res = response(); await handler({ method: "GET", headers: {}, query } as any, res);
    expect(res.statusCode).toBe(403); expect(res.body).toEqual({ error: { code: "no_active_grant", message: "Private imports require an active grant." } }); expect(readChunk).not.toHaveBeenCalled();
  });

  it("rejects invalid and foreign-shaped route parameters before private storage access", async () => {
    const res = response(); await handler({ method: "GET", headers: {}, query: { ...query, importId: "foreign-import" } } as any, res);
    expect(res.statusCode).toBe(400); expect(readChunk).not.toHaveBeenCalled(); expect(res.setHeader).toHaveBeenCalledWith("Cache-Control", "private, no-store");
  });

  it("sends Uint8Array transport bytes as a real Buffer", async () => {
    const bytes = new Uint8Array([91, 93]);
    readChunk.mockResolvedValue({ bytes, totalBytes: 2, totalChunks: 1, sha256: "a".repeat(64), rowCount: 0 });
    const res = response(); await handler({ method: "GET", headers: {}, query } as any, res);
    expect(res.statusCode).toBe(200); expect(Buffer.isBuffer(res.body)).toBe(true); expect([...res.body]).toEqual([91, 93]); expect(res.setHeader).toHaveBeenCalledWith("Content-Type", "application/octet-stream");
  });

  it.each([403, 503])("sanitizes storage status %s with the existing unavailable response", async (statusCode) => {
    readChunk.mockRejectedValueOnce(Object.assign(new Error("synthetic-private-storage-detail"), { statusCode, code: "synthetic-storage-code" }));
    const res = response();
    await handler({ method: "GET", headers: {}, query } as any, res);
    expect(res.statusCode).toBe(404);
    expect(res.body).toEqual({ error: { code: "private_import_unavailable", message: "Private import is unavailable." } });
    expect(JSON.stringify(res.body)).not.toContain("synthetic-private");
    expect(JSON.stringify(res.body)).not.toContain("synthetic-storage");
  });

});
