import { createHash, randomUUID } from "crypto";

import serviceRoleClient from "lib/supabase/server";

const BUCKET = "draft-pro-private-imports";
export const PRIVATE_IMPORT_CHUNK_BYTES = 750 * 1024;
type Rpc = { rpc(name: string, args: Record<string, unknown>): PromiseLike<{ data: unknown; error: { message: string } | null }> };
const client = serviceRoleClient as unknown as Rpc & typeof serviceRoleClient;
type UploadRow = { upload_id: string; save_session_id: string; draft_id: string | null; storage_prefix: string; declared_max_bytes: number; status: string; expires_at: string };

async function row(name: string, args: Record<string, unknown>) {
  const { data, error } = await client.rpc(name, args);
  if (error) throw error;
  if (!Array.isArray(data) || !data[0] || typeof data[0] !== "object") throw new Error("Private import transaction returned no result.");
  return data[0] as Record<string, unknown>;
}

async function ownedUpload(userId: string, uploadId: string) {
  const upload = await row("read_draft_pro_private_import_upload", { p_user_id: userId, p_upload_id: uploadId }) as UploadRow;
  if (upload.status !== "uploading" || Date.parse(upload.expires_at) <= Date.now()) throw new Error("Private import upload is unavailable.");
  return upload;
}

export async function beginPrivateImport(args: { userId: string; draftId: string | null; expectedVersion: number | null; attemptKey: string; name: string; mapping: unknown; declaredMaxBytes: number; replacementImportId?: string | null }) {
  const session = await row("begin_draft_pro_save_session", { p_user_id: args.userId, p_draft_id: args.draftId, p_expected_version: args.expectedVersion, p_attempt_key: args.attemptKey });
  if (session.status !== "ready") return { status: session.status, session };
  const upload = await row("begin_draft_pro_private_import_upload", { p_user_id: args.userId, p_save_session_id: session.save_session_id, p_replacement_import_id: args.replacementImportId ?? null, p_declared_max_bytes: args.declaredMaxBytes, p_name: args.name, p_content_type: "application/json", p_mapping: args.mapping ?? null });
  return { status: "ready", session, upload };
}

export async function putPrivateImportChunk(args: { userId: string; uploadId: string; prefix: string; ordinal: number; bytes: Buffer }) {
  const uploadRecord = await ownedUpload(args.userId, args.uploadId);
  if (args.bytes.byteLength === 0 || args.bytes.byteLength > PRIVATE_IMPORT_CHUNK_BYTES) throw new Error("Private import chunks must be between 1 byte and 750 KiB.");
  const maxChunks = Math.ceil(uploadRecord.declared_max_bytes / PRIVATE_IMPORT_CHUNK_BYTES);
  if (!Number.isInteger(args.ordinal) || args.ordinal < 0 || args.ordinal >= maxChunks || args.prefix !== uploadRecord.storage_prefix) throw new Error("Invalid private import chunk ordinal.");
  const remaining = uploadRecord.declared_max_bytes - args.ordinal * PRIVATE_IMPORT_CHUNK_BYTES;
  if (args.bytes.byteLength > Math.min(PRIVATE_IMPORT_CHUNK_BYTES, remaining)) throw new Error("Chunk exceeds its upload reservation.");
  const path = `${uploadRecord.storage_prefix}/${args.ordinal}`;
  // Chunks encode the normalized JSON document; keep the bucket MIME policy
  // aligned with its explicit private-import allowlist.
  const upload = await client.storage.from(BUCKET).upload(path, args.bytes, { contentType: "application/json", upsert: false });
  if (upload.error) {
    if (!/already exists/i.test(upload.error.message)) throw upload.error;
    const existing = await client.storage.from(BUCKET).download(path);
    if (existing.error) throw existing.error;
    if (!Buffer.from(await existing.data.arrayBuffer()).equals(args.bytes)) throw new Error("Private import retry chunk differs from the existing chunk.");
  }
  return path;
}

export async function stagePrivateImport(args: { userId: string; uploadId: string; chunkPaths: string[] }) {
  const uploadRecord = await ownedUpload(args.userId, args.uploadId);
  const maxChunks = Math.ceil(uploadRecord.declared_max_bytes / PRIVATE_IMPORT_CHUNK_BYTES);
  if (!args.chunkPaths.length || args.chunkPaths.length > Math.min(32, maxChunks)) throw new Error("Private import requires a bounded set of chunks.");
  const derivedPaths = args.chunkPaths.map((_path, ordinal) => `${uploadRecord.storage_prefix}/${ordinal}`);
  if (args.chunkPaths.some((path, ordinal) => path !== derivedPaths[ordinal])) throw new Error("Private import paths are not server-owned.");
  const chunks: Buffer[] = [];
  let totalBytes = 0;
  for (const path of derivedPaths) {
    const downloaded = await client.storage.from(BUCKET).download(path);
    if (downloaded.error) throw downloaded.error;
    const chunk = Buffer.from(await downloaded.data.arrayBuffer());
    if (!chunk.byteLength || chunk.byteLength > PRIVATE_IMPORT_CHUNK_BYTES || totalBytes + chunk.byteLength > uploadRecord.declared_max_bytes) throw new Error("Private import chunks exceed their reservation.");
    totalBytes += chunk.byteLength;
    chunks.push(chunk);
  }
  const body = Buffer.concat(chunks);
  if (body.byteLength > uploadRecord.declared_max_bytes) throw new Error("Normalized private import exceeds its reservation.");
  let rows: unknown;
  try { rows = JSON.parse(body.toString("utf8")); } catch { throw new Error("Normalized private import must be valid JSON."); }
  if (!Array.isArray(rows) || rows.some((entry) => !entry || typeof entry !== "object" || Array.isArray(entry))) throw new Error("Normalized private import rows are invalid.");
  const hash = createHash("sha256").update(body).digest("hex");
  const finalPath = `draft-pro-imports/${args.uploadId}/normalized.json`;
  const finalUpload = await client.storage.from(BUCKET).upload(finalPath, body, { contentType: "application/json", upsert: false });
  if (finalUpload.error) {
    if (!/already exists/i.test(finalUpload.error.message)) throw finalUpload.error;
    const existing = await client.storage.from(BUCKET).download(finalPath);
    if (existing.error) throw existing.error;
    const existingHash = createHash("sha256").update(Buffer.from(await existing.data.arrayBuffer())).digest("hex");
    if (existingHash !== hash) throw new Error("Private import retry content differs from the existing staged object.");
  }
  const staged = await row("stage_draft_pro_private_import_upload", { p_user_id: args.userId, p_upload_id: args.uploadId, p_chunk_paths: derivedPaths, p_actual_bytes: body.byteLength, p_row_count: rows.length, p_content_sha256: hash });
  if (staged.status !== "staged") throw new Error("Private import could not be staged.");
  return { importId: String(staged.upload_id), rowCount: rows.length, bytes: body.byteLength, hash };
}

export function newSavedDraftAttemptKey() { return randomUUID(); }

export async function readPrivateImportRows(args: { userId: string; draftId: string; importId: string }) {
  const metadata = await row("read_draft_pro_private_import_blob", { p_user_id: args.userId, p_draft_id: args.draftId, p_import_id: args.importId });
  const downloaded = await client.storage.from(BUCKET).download(String(metadata.storage_path));
  if (downloaded.error) throw downloaded.error;
  const bytes = Buffer.from(await downloaded.data.arrayBuffer());
  if (bytes.byteLength !== Number(metadata.byte_size) || createHash("sha256").update(bytes).digest("hex") !== metadata.content_sha256) throw new Error("Private import file validation failed.");
  const rows: unknown = JSON.parse(bytes.toString("utf8"));
  if (!Array.isArray(rows) || rows.length !== Number(metadata.row_count)) throw new Error("Private import file is incomplete.");
  return rows;
}
