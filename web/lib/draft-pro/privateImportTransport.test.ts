import { describe, expect, it, vi } from "vitest";

const rpc = vi.hoisted(() => vi.fn());
const storageUpload = vi.hoisted(() => vi.fn());
const storageDownload = vi.hoisted(() => vi.fn());
vi.mock("lib/supabase/server", () => ({ default: { rpc, storage: { from: () => ({ upload: storageUpload, download: storageDownload }) } } }));

import { putPrivateImportChunk, PRIVATE_IMPORT_CHUNK_BYTES } from "./privateImportTransport";

describe("private import transport ownership boundary", () => {
  it("does not touch Storage when the upload lookup is unavailable to this user", async () => {
    rpc.mockResolvedValueOnce({ data: [], error: null });
    await expect(putPrivateImportChunk({ userId: "other-user", uploadId: "upload-1", prefix: "spoofed", ordinal: 0, bytes: Buffer.from("[]") })).rejects.toThrow("returned no result");
    expect(storageUpload).not.toHaveBeenCalled(); expect(storageDownload).not.toHaveBeenCalled();
  });

  it("does not touch Storage when an owned upload is expired", async () => {
    rpc.mockResolvedValueOnce({ data: [{ upload_id: "upload-1", save_session_id: "save-1", draft_id: null, status: "uploading", storage_prefix: "draft-pro-import-staging/user/upload-1", declared_max_bytes: PRIVATE_IMPORT_CHUNK_BYTES, expires_at: "2000-01-01T00:00:00.000Z" }], error: null });
    await expect(putPrivateImportChunk({ userId: "user", uploadId: "upload-1", prefix: "draft-pro-import-staging/user/upload-1", ordinal: 0, bytes: Buffer.from("[]") })).rejects.toThrow("unavailable");
    expect(storageUpload).not.toHaveBeenCalled(); expect(storageDownload).not.toHaveBeenCalled();
  });
});
