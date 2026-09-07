import { beforeEach, describe, expect, it, vi } from "vitest";
import { createHash } from "crypto";

const rpc = vi.hoisted(() => vi.fn());
const storageUpload = vi.hoisted(() => vi.fn());
const storageDownload = vi.hoisted(() => vi.fn());
vi.mock("lib/supabase/server", () => ({ default: { rpc, storage: { from: () => ({ upload: storageUpload, download: storageDownload }) } } }));
const binary = (value: ArrayLike<number>) => Uint8Array.from(value);
const arrayBuffer = (value: ArrayLike<number>) => binary(value).buffer;

import { putPrivateImportChunk, readPrivateImportChunk, stagePrivateImport, PRIVATE_IMPORT_CHUNK_BYTES } from "./privateImportTransport";

const uploadRow = (overrides: Record<string, unknown> = {}) => ({
  upload_id: "upload-1", save_session_id: "save-1", draft_id: null, status: "uploading", storage_prefix: "draft-pro-import-staging/user/upload-1", declared_max_bytes: PRIVATE_IMPORT_CHUNK_BYTES,
  expires_at: "2099-01-01T00:00:00.000Z", save_session_status: "pending", save_session_expires_at: "2099-01-01T00:00:00.000Z", final_storage_path: "draft-pro-imports/upload-1/normalized.json",
  actual_bytes: null, row_count: null, content_sha256: null, chunk_paths: [], ...overrides,
});

describe("private import transport ownership boundary", () => {
  beforeEach(() => vi.clearAllMocks());
  it("does not touch Storage when the upload lookup is unavailable to this user", async () => {
    rpc.mockResolvedValueOnce({ data: [], error: null });
    await expect(putPrivateImportChunk({ userId: "other-user", uploadId: "upload-1", prefix: "spoofed", ordinal: 0, bytes: Buffer.from("[]") })).rejects.toThrow("returned no result");
    expect(storageUpload).not.toHaveBeenCalled(); expect(storageDownload).not.toHaveBeenCalled();
  });

  it("does not touch Storage when an owned upload is expired", async () => {
    rpc.mockResolvedValueOnce({ data: [uploadRow({ expires_at: "2000-01-01T00:00:00.000Z" })], error: null });
    await expect(putPrivateImportChunk({ userId: "user", uploadId: "upload-1", prefix: "draft-pro-import-staging/user/upload-1", ordinal: 0, bytes: Buffer.from("[]") })).rejects.toThrow("unavailable");
    expect(storageUpload).not.toHaveBeenCalled(); expect(storageDownload).not.toHaveBeenCalled();
  });

  it("does not touch Storage when the owned parent save session is expired", async () => {
    rpc.mockResolvedValueOnce({ data: [uploadRow({ save_session_expires_at: "2000-01-01T00:00:00.000Z" })], error: null });
    await expect(putPrivateImportChunk({ userId: "user", uploadId: "upload-1", prefix: "draft-pro-import-staging/user/upload-1", ordinal: 0, bytes: Buffer.from("[]") })).rejects.toThrow("unavailable");
    expect(storageUpload).not.toHaveBeenCalled(); expect(storageDownload).not.toHaveBeenCalled();
  });

  it("accepts an identical duplicate chunk but rejects changed retry bytes", async () => {
    const upload = uploadRow();
    rpc.mockResolvedValueOnce({ data: [upload], error: null }); storageUpload.mockResolvedValueOnce({ error: { message: "already exists" } }); storageDownload.mockResolvedValueOnce({ error: null, data: { arrayBuffer: async () => arrayBuffer(Buffer.from("[]")) } });
    await expect(putPrivateImportChunk({ userId: "user", uploadId: "upload-1", prefix: upload.storage_prefix, ordinal: 0, bytes: Buffer.from("[]") })).resolves.toContain("/0");
    rpc.mockResolvedValueOnce({ data: [upload], error: null }); storageUpload.mockResolvedValueOnce({ error: { message: "already exists" } }); storageDownload.mockResolvedValueOnce({ error: null, data: { arrayBuffer: async () => arrayBuffer(Buffer.from("different")) } });
    await expect(putPrivateImportChunk({ userId: "user", uploadId: "upload-1", prefix: upload.storage_prefix, ordinal: 0, bytes: Buffer.from("[]") })).rejects.toThrow("differs");
  });

  it("allows an identical staged replay after checking persisted metadata and final bytes", async () => {
    const body = Buffer.from(JSON.stringify([{ player: "A" }])); const hash = createHash("sha256").update(binary(body)).digest("hex");
    rpc.mockResolvedValueOnce({ data: [uploadRow({ status: "staged", actual_bytes: body.byteLength, row_count: 1, content_sha256: hash })], error: null });
    rpc.mockResolvedValueOnce({ data: [{ status: "staged", upload_id: "upload-1", storage_path: "draft-pro-imports/upload-1/normalized.json", expires_at: "2099-01-01T00:00:00.000Z" }], error: null });
    storageDownload.mockResolvedValueOnce({ error: null, data: { arrayBuffer: async () => arrayBuffer(body) } }).mockResolvedValueOnce({ error: null, data: { arrayBuffer: async () => arrayBuffer(body) } });
    await expect(stagePrivateImport({ userId: "user", uploadId: "upload-1", chunkPaths: ["draft-pro-import-staging/user/upload-1/0"] })).resolves.toMatchObject({ importId: "upload-1", hash });
    expect(storageUpload).not.toHaveBeenCalled(); expect(rpc).toHaveBeenCalledTimes(2);
  });

  it("rejects changed staged replay content before a final Storage write", async () => {
    const stored = Buffer.from(JSON.stringify([{ player: "A" }])); const changed = Buffer.from(JSON.stringify([{ player: "B" }]));
    rpc.mockResolvedValueOnce({ data: [uploadRow({ status: "staged", actual_bytes: stored.byteLength, row_count: 1, content_sha256: createHash("sha256").update(binary(stored)).digest("hex") })], error: null });
    storageDownload.mockResolvedValueOnce({ error: null, data: { arrayBuffer: async () => arrayBuffer(changed) } });
    await expect(stagePrivateImport({ userId: "user", uploadId: "upload-1", chunkPaths: ["draft-pro-import-staging/user/upload-1/0"] })).rejects.toThrow("differs from the staged upload");
    expect(storageUpload).not.toHaveBeenCalled(); expect(storageDownload).toHaveBeenCalledTimes(1);
  });

  it("rejects a staged replay when the persisted final object hash changed", async () => {
    const body = Buffer.from(JSON.stringify([{ player: "A" }])); const hash = createHash("sha256").update(binary(body)).digest("hex");
    rpc.mockResolvedValueOnce({ data: [uploadRow({ status: "staged", actual_bytes: body.byteLength, row_count: 1, content_sha256: hash })], error: null });
    storageDownload.mockResolvedValueOnce({ error: null, data: { arrayBuffer: async () => arrayBuffer(body) } }).mockResolvedValueOnce({ error: null, data: { arrayBuffer: async () => arrayBuffer(Buffer.from("changed final")) } });
    await expect(stagePrivateImport({ userId: "user", uploadId: "upload-1", chunkPaths: ["draft-pro-import-staging/user/upload-1/0"] })).rejects.toThrow("existing staged object");
    expect(storageUpload).not.toHaveBeenCalled();
  });

  it("rejects chunk bounds before Storage I/O", async () => {
    rpc.mockResolvedValueOnce({ data: [uploadRow({ declared_max_bytes: 2 })], error: null });
    await expect(putPrivateImportChunk({ userId: "user", uploadId: "upload-1", prefix: "draft-pro-import-staging/user/upload-1", ordinal: 0, bytes: Buffer.from("too large") })).rejects.toThrow("exceeds its upload reservation");
    expect(storageUpload).not.toHaveBeenCalled(); expect(storageDownload).not.toHaveBeenCalled();
  });

  it("rejects more rows than the restore contract supports before final Storage upload", async () => {
    const body = Buffer.from(JSON.stringify(Array.from({ length: 100_001 }, () => ({ player: "A" }))));
    const splitAt = Math.ceil(body.byteLength / 2); const first = body.subarray(0, splitAt); const second = body.subarray(splitAt);
    rpc.mockResolvedValueOnce({ data: [uploadRow({ declared_max_bytes: body.byteLength })], error: null });
    storageDownload.mockResolvedValueOnce({ error: null, data: { arrayBuffer: async () => arrayBuffer(first) } }).mockResolvedValueOnce({ error: null, data: { arrayBuffer: async () => arrayBuffer(second) } });
    await expect(stagePrivateImport({ userId: "user", uploadId: "upload-1", chunkPaths: ["draft-pro-import-staging/user/upload-1/0", "draft-pro-import-staging/user/upload-1/1"] })).rejects.toThrow("100,000-row limit");
    expect(storageUpload).not.toHaveBeenCalled(); expect(rpc).toHaveBeenCalledTimes(1);
  });

  it("returns bounded first/last chunks that reassemble with metadata", async () => {
    const body = Buffer.from(JSON.stringify([{ player: "A" }, { player: "B" }]));
    const metadata = { storage_path: "private/final.json", byte_size: body.byteLength, row_count: 2, content_sha256: createHash("sha256").update(binary(body)).digest("hex") };
    rpc.mockResolvedValue({ data: [metadata], error: null });
    storageDownload.mockResolvedValue({ error: null, data: { arrayBuffer: async () => arrayBuffer(body) } });
    const first = await readPrivateImportChunk({ userId: "user", draftId: "draft", importId: "import", ordinal: 0 });
    expect(Buffer.from(first.bytes)).toEqual(body); expect(first.totalChunks).toBe(1); expect(first.rowCount).toBe(2);
  });
});
