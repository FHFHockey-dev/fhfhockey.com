import { createHash, randomUUID } from "crypto";

import serviceRoleClient from "lib/supabase/server";

const BUCKET = "draft-pro-private-imports";
export const PRIVATE_IMPORT_CHUNK_BYTES = 750 * 1024;
type Rpc = { rpc(name: string, args: Record<string, unknown>): PromiseLike<{ data: unknown; error: { message: string } | null }> };
const client = serviceRoleClient as unknown as Rpc & typeof serviceRoleClient;

async function row(name: string, args: Record<string, unknown>) {
  const { data, error } = await client.rpc(name, args);
  if (error) throw error;
  if (!Array.isArray(data) || !data[0] || typeof data[0] !== "object") throw new Error("Private import transaction returned no result.");
  return data[0] as Record<string, unknown>;
}

export async function beginPrivateImport(args: { userId: string; draftId: string | null; expectedVersion: number | null; attemptKey: string; name: string; mapping: unknown; declaredMaxBytes: number; replacementImportId?: string | null }) {
  const session = await row("begin_draft_pro_save_session", { p_user_id: args.userId, p_draft_id: args.draftId, p_expected_version: args.expectedVersion, p_attempt_key: args.attemptKey });
  if (session.status !== "ready") return { status: session.status, session };
  const upload = await row("begin_draft_pro_private_import_upload", { p_user_id: args.userId, p_save_session_id: session.save_session_id, p_replacement_import_id: args.replacementImportId ?? null, p_declared_max_bytes: args.declaredMaxBytes, p_name: args.name, p_content_type: "application/json", p_mapping: args.mapping ?? null });
  return { status: "ready", session, upload };
}

export async function putPrivateImportChunk(args: { userId: string; uploadId: string; prefix: string; ordinal: number; bytes: Buffer }) {
  if (args.bytes.byteLength === 0 || args.bytes.byteLength > PRIVATE_IMPORT_CHUNK_BYTES) throw new Error("Private import chunks must be between 1 byte and 750 KiB.");
  if (!Number.isInteger(args.ordinal) || args.ordinal < 0 || args.ordinal > 99_999) throw new Error("Invalid private import chunk ordinal.");
  const path = `${args.prefix}/${args.ordinal.toString().padStart(5, "0")}`;
  const upload = await client.storage.from(BUCKET).upload(path, args.bytes, { contentType: "application/octet-stream", upsert: false });
  if (upload.error) throw upload.error;
  return path;
}

export async function stagePrivateImport(args: { userId: string; uploadId: string; chunkPaths: string[] }) {
  if (!args.chunkPaths.length || args.chunkPaths.length > 100) throw new Error("Private import requires a bounded set of chunks.");
  const chunks: Buffer[] = [];
  for (const path of args.chunkPaths) {
    const downloaded = await client.storage.from(BUCKET).download(path);
    if (downloaded.error) throw downloaded.error;
    chunks.push(Buffer.from(await downloaded.data.arrayBuffer()));
  }
  const body = Buffer.concat(chunks);
  if (body.byteLength > 10 * 1024 * 1024) throw new Error("Normalized private import exceeds 10 MiB.");
  let rows: unknown;
  try { rows = JSON.parse(body.toString("utf8")); } catch { throw new Error("Normalized private import must be valid JSON."); }
  if (!Array.isArray(rows) || rows.some((entry) => !entry || typeof entry !== "object" || Array.isArray(entry))) throw new Error("Normalized private import rows are invalid.");
  const hash = createHash("sha256").update(body).digest("hex");
  const staged = await row("stage_draft_pro_private_import_upload", { p_user_id: args.userId, p_upload_id: args.uploadId, p_chunk_paths: args.chunkPaths, p_actual_bytes: body.byteLength, p_row_count: rows.length, p_content_sha256: hash });
  if (staged.status !== "staged") throw new Error("Private import could not be staged.");
  return { importId: String(staged.upload_id), rowCount: rows.length, bytes: body.byteLength, hash };
}

export function newSavedDraftAttemptKey() { return randomUUID(); }
