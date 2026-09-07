import { describe, expect, it, vi } from "vitest";
import { createHash } from "crypto";

const rpc = vi.hoisted(() => vi.fn());
const storageUpload = vi.hoisted(() => vi.fn());
const storageDownload = vi.hoisted(() => vi.fn());
vi.mock("lib/supabase/server", () => ({ default: { rpc, storage: { from: () => ({ upload: storageUpload, download: storageDownload }) } } }));

import { putPrivateImportChunk, readPrivateImportChunk, PRIVATE_IMPORT_CHUNK_BYTES } from "./privateImportTransport";

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

  it("accepts an identical duplicate chunk but rejects changed retry bytes", async () => {
    const upload = { upload_id: "upload-1", save_session_id: "save-1", draft_id: null, status: "uploading", storage_prefix: "draft-pro-import-staging/user/upload-1", declared_max_bytes: PRIVATE_IMPORT_CHUNK_BYTES, expires_at: "2099-01-01T00:00:00.000Z" };
    rpc.mockResolvedValueOnce({ data: [upload], error: null }); storageUpload.mockResolvedValueOnce({ error: { message: "already exists" } }); storageDownload.mockResolvedValueOnce({ error: null, data: { arrayBuffer: async () => Buffer.from("[]") } });
    await expect(putPrivateImportChunk({ userId: "user", uploadId: "upload-1", prefix: upload.storage_prefix, ordinal: 0, bytes: Buffer.from("[]") })).resolves.toContain("/0");
    rpc.mockResolvedValueOnce({ data: [upload], error: null }); storageUpload.mockResolvedValueOnce({ error: { message: "already exists" } }); storageDownload.mockResolvedValueOnce({ error: null, data: { arrayBuffer: async () => Buffer.from("different") } });
    await expect(putPrivateImportChunk({ userId: "user", uploadId: "upload-1", prefix: upload.storage_prefix, ordinal: 0, bytes: Buffer.from("[]") })).rejects.toThrow("differs");
  });

  it("returns bounded first/last chunks that reassemble with metadata", async () => {
    const body = Buffer.from(JSON.stringify([{ player: "A" }, { player: "B" }]));
    const metadata = { storage_path: "private/final.json", byte_size: body.byteLength, row_count: 2, content_sha256: createHash("sha256").update(body).digest("hex") };
    rpc.mockResolvedValue({ data: [metadata], error: null });
    storageDownload.mockResolvedValue({ error: null, data: { arrayBuffer: async () => body } });
    const first = await readPrivateImportChunk({ userId: "user", draftId: "draft", importId: "import", ordinal: 0 });
    expect(Buffer.concat([first.bytes])).toEqual(body); expect(first.totalChunks).toBe(1); expect(first.rowCount).toBe(2);
  });
});
