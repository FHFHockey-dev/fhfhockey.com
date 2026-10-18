import { beforeEach, describe, expect, it, vi } from "vitest";

const auth = vi.hoisted(() => vi.fn());
const access = vi.hoisted(() => vi.fn());
const requireCapability = vi.hoisted(() => vi.fn());
const begin = vi.hoisted(() => vi.fn());
const stage = vi.hoisted(() => vi.fn());
const putChunk = vi.hoisted(() => vi.fn());
vi.mock("lib/api/requireApiUser", () => ({ requireApiUser: auth }));
vi.mock("lib/draft-pro/features", () => ({ getDraftProFeatureFlags: () => ({ private_imports: true }) }));
vi.mock("lib/draft-pro/server", () => ({ loadDraftProAccess: access, requireDraftProServerCapability: requireCapability }));
vi.mock("lib/draft-pro/privateImportTransport", () => ({ beginPrivateImport: begin, stagePrivateImport: stage, putPrivateImportChunk: putChunk, PRIVATE_IMPORT_CHUNK_BYTES: 750 * 1024 }));

import handler from "../../../pages/api/v1/account/draft-pro/private-imports";
import stageHandler from "../../../pages/api/v1/account/draft-pro/private-imports/[uploadId]/stage";
import chunkHandler from "../../../pages/api/v1/account/draft-pro/private-imports/[uploadId]/chunks/[ordinal]";

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

  it("hides unexpected begin failures behind a fixed 500", async () => {
    vi.spyOn(console, "error").mockImplementation(() => undefined);
    begin.mockRejectedValueOnce({ code: "42P01", message: 'relation "private_table" does not exist' });
    const res = response(); await handler({ method: "POST", headers: {}, body } as any, res);
    expect(res.statusCode).toBe(500); expect(res.body).toEqual({ error: { code: "PRIVATE_IMPORT_UNAVAILABLE", message: "Private imports are unavailable. Your local draft is unchanged." } });
  });
});

const rawFailure = { code: "42P01", message: 'relation "private_table" does not exist' };
const typed = (message: string) => Object.assign(new Error(message), { statusCode: 400 });
const chunkRequest = (headers: Record<string, string>) => ({ method: "PUT", headers, query: { uploadId: "upload-1", ordinal: "0" }, async *[Symbol.asyncIterator]() { yield Buffer.from("[]"); } });

describe("private import stage and chunk routes", () => {
  beforeEach(() => { vi.clearAllMocks(); requireCapability.mockReset(); auth.mockResolvedValue({ id: "owner-1" }); access.mockResolvedValue({}); vi.spyOn(console, "error").mockImplementation(() => undefined); });

  it("keeps typed stage validation as 400 and schema errors as 400 without staging", async () => {
    stage.mockRejectedValueOnce(typed("Private import paths are not server-owned."));
    let res = response(); await stageHandler({ method: "POST", headers: {}, query: { uploadId: "upload-1" }, body: { chunkPaths: ["x"] } } as any, res);
    expect(res.statusCode).toBe(400); expect(res.body).toEqual({ error: { code: "private_import_stage_invalid", message: "Private import paths are not server-owned." } });
    res = response(); await stageHandler({ method: "POST", headers: {}, query: { uploadId: "upload-1" }, body: { chunkPaths: [] } } as any, res);
    expect(res.statusCode).toBe(400); expect(res.body.error.code).toBe("private_import_stage_invalid");
    expect(stage).toHaveBeenCalledTimes(1);
  });

  it("hides unexpected stage failures behind a fixed 500", async () => {
    stage.mockRejectedValueOnce(rawFailure);
    const res = response(); await stageHandler({ method: "POST", headers: {}, query: { uploadId: "upload-1" }, body: { chunkPaths: ["x"] } } as any, res);
    expect(res.statusCode).toBe(500); expect(res.body).toEqual({ error: { code: "PRIVATE_IMPORT_STAGE_UNAVAILABLE", message: "Private imports are unavailable. Your local draft is unchanged." } });
    expect(JSON.stringify(res.body)).not.toContain("private_table");
  });

  it("answers 400 for a missing upload prefix and typed chunk validation", async () => {
    let res = response(); await chunkHandler(chunkRequest({}) as any, res);
    expect(res.statusCode).toBe(400); expect(res.body).toEqual({ error: { code: "private_import_chunk_invalid", message: "Upload prefix is required." } }); expect(putChunk).not.toHaveBeenCalled();
    putChunk.mockRejectedValueOnce(typed("Invalid private import chunk ordinal."));
    res = response(); await chunkHandler(chunkRequest({ "x-draft-pro-upload-prefix": "prefix" }) as any, res);
    expect(res.statusCode).toBe(400); expect(res.body.error.message).toBe("Invalid private import chunk ordinal.");
  });

  it("hides unexpected chunk storage failures behind a fixed 500", async () => {
    putChunk.mockRejectedValueOnce(rawFailure);
    const res = response(); await chunkHandler(chunkRequest({ "x-draft-pro-upload-prefix": "prefix" }) as any, res);
    expect(res.statusCode).toBe(500); expect(res.body).toEqual({ error: { code: "PRIVATE_IMPORT_CHUNK_UNAVAILABLE", message: "Private imports are unavailable. Your local draft is unchanged." } });
  });
});
