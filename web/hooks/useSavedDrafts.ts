import { useCallback, useEffect, useRef, useState } from "react";
import supabase from "lib/supabase/client";
import type { DraftProSnapshot } from "lib/draft-pro/contracts";
import type { NormalizedPrivateImport } from "lib/draft-pro/savedDrafts";

const CHUNK = 750 * 1024;
export type SavedDraftSummary = { id: string; name: string; status: "active" | "archived"; lockVersion: number; updatedAt: string };
type StoredImport = { id: string; name: string; mapping: unknown };
type StoredDraftDetail = SavedDraftSummary & { snapshot: DraftProSnapshot; privateImports: StoredImport[] };
export type SavedDraftDetail = SavedDraftSummary & { snapshot: DraftProSnapshot; privateImports: NormalizedPrivateImport[] };
export type SavedDraftConflict = { current?: SavedDraftSummary };
export type SaveOptions = { name: string; snapshot: DraftProSnapshot; expectedVersion?: number; accountSaveConsent: boolean; privateImports?: readonly NormalizedPrivateImport[] };
type Attempt = { signature: string; key: string; staged: Map<string, string> };
type Begin = { status?: string; session?: { status?: string; draft_id?: string | null; current_version?: number }; upload?: { upload_id?: string; storage_prefix?: string; status?: string } };

const key = () => typeof crypto !== "undefined" && "randomUUID" in crypto ? crypto.randomUUID() : `${Date.now()}-${Math.random()}`;
const mapping = (entry: NormalizedPrivateImport) => ({ sourceId: entry.sourceId, headers: entry.mapping });
const sourceId = (entry: StoredImport) => { const value = entry.mapping as { sourceId?: unknown } | undefined; return typeof value?.sourceId === "string" ? value.sourceId : undefined; };
const headers = (entry: StoredImport) => { const value = entry.mapping as { headers?: unknown } | undefined; return Array.isArray(value?.headers) ? value.headers : Array.isArray(entry.mapping) ? entry.mapping : []; };
const signature = (id: string | null, version: number | undefined, options: SaveOptions) => JSON.stringify({ id, version: version ?? null, name: options.name, snapshot: options.snapshot, imports: options.privateImports?.map(({ id: importId, name, sourceId: source, mapping: map, rows }) => ({ importId, name, source, map, rows })) ?? [] });
function conflict(current?: SavedDraftSummary) { const error = new Error("This saved draft changed elsewhere. Reload it or save a copy."); Object.assign(error, { conflict: current }); return error; }

async function request<T>(path: string, init?: RequestInit, current?: () => boolean): Promise<T> {
  const session = (await supabase.auth.getSession()).data.session;
  if (current && !current()) throw new Error("Saved draft operation was cancelled.");
  if (!session?.access_token) throw new Error("Sign in to use Saved Drafts.");
  const response = await fetch(path, { ...init, headers: { Authorization: `Bearer ${session.access_token}`, "Content-Type": "application/json", ...init?.headers } });
  const payload = await response.json().catch(() => ({}));
  if (response.status === 409) throw conflict(payload.data?.current as SavedDraftSummary | undefined);
  if (!response.ok) throw new Error(payload.error?.message ?? "Saved Drafts are unavailable. Your local draft is unchanged.");
  return payload.data as T;
}

async function upload(args: { draftId: string | null; expectedVersion: number | undefined; attemptKey: string; entry: NormalizedPrivateImport; replacementImportId?: string; current: () => boolean }) {
  if (!args.current()) throw new Error("Saved draft save was cancelled.");
  const bytes = new TextEncoder().encode(JSON.stringify(args.entry.rows));
  if (!bytes.byteLength || bytes.byteLength > 10 * 1024 * 1024) throw new Error("Normalized private import exceeds the 10 MiB limit.");
  const begun = await request<Begin>("/api/v1/account/draft-pro/private-imports", { method: "POST", body: JSON.stringify({ draftId: args.draftId, expectedVersion: args.expectedVersion ?? null, attemptKey: args.attemptKey, name: args.entry.name, mapping: mapping(args.entry), declaredMaxBytes: bytes.byteLength, replacementImportId: args.replacementImportId ?? null }) }, args.current);
  if (begun.status !== "ready" || !begun.upload?.upload_id || !begun.upload.storage_prefix) {
    if (begun.session?.status === "conflict" || begun.session?.status === "busy") throw conflict(begun.session.draft_id ? { id: begun.session.draft_id, name: "", status: "active", lockVersion: begun.session.current_version ?? 0, updatedAt: "" } : undefined);
    throw new Error("Private import upload could not be started. Your local draft is unchanged.");
  }
  const paths = Array.from({ length: Math.ceil(bytes.byteLength / CHUNK) }, (_value, ordinal) => `${begun.upload!.storage_prefix}/${ordinal}`);
  if (begun.upload.status !== "staged") for (let ordinal = 0; ordinal < paths.length; ordinal += 1) {
    if (!args.current()) throw new Error("Saved draft save was cancelled.");
    const token = (await supabase.auth.getSession()).data.session?.access_token;
    if (!token || !args.current()) throw new Error("Saved draft save was cancelled.");
    const response = await fetch(`/api/v1/account/draft-pro/private-imports/${begun.upload.upload_id}/chunks/${ordinal}`, { method: "PUT", headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json", "X-Draft-Pro-Upload-Prefix": begun.upload.storage_prefix }, body: bytes.slice(ordinal * CHUNK, Math.min(bytes.byteLength, (ordinal + 1) * CHUNK)) });
    const payload = await response.json().catch(() => ({}));
    if (!response.ok || payload.data?.path !== paths[ordinal]) throw new Error(payload.error?.message ?? "Private import upload failed. Your local draft is unchanged.");
  }
  if (!args.current()) throw new Error("Saved draft save was cancelled.");
  const staged = await request<{ importId?: string }>(`/api/v1/account/draft-pro/private-imports/${begun.upload.upload_id}/stage`, { method: "POST", body: JSON.stringify({ chunkPaths: paths }) }, args.current);
  if (!staged.importId) throw new Error("Private import could not be staged. Your local draft is unchanged.");
  return staged.importId;
}

async function restoreImportChunks(draftId: string, metadata: StoredImport, current: () => boolean): Promise<NormalizedPrivateImport> {
  const parts: Uint8Array[] = []; let count = 0; let size = 0; let hash = ""; let rowsCount = 0;
  for (let ordinal = 0; ordinal === 0 || ordinal < count; ordinal += 1) {
    const token = (await supabase.auth.getSession()).data.session?.access_token;
    if (!token || !current()) throw new Error("Saved draft restore was cancelled.");
    const response = await fetch(`/api/v1/account/draft-pro/drafts/${draftId}/imports/${metadata.id}?ordinal=${ordinal}`, { headers: { Authorization: `Bearer ${token}` } });
    if (!response.ok) throw new Error("Private import file is unavailable; the draft was not restored.");
    const nextCount = Number(response.headers.get("X-Draft-Pro-Total-Chunks")); const nextSize = Number(response.headers.get("X-Draft-Pro-Total-Bytes")); const nextHash = response.headers.get("X-Draft-Pro-SHA256") ?? ""; const nextRows = Number(response.headers.get("X-Draft-Pro-Row-Count"));
    if (!Number.isInteger(nextCount) || nextCount < 1 || nextCount > 32 || !Number.isInteger(nextSize) || nextSize < 1 || nextSize > 10 * 1024 * 1024 || !/^[a-f0-9]{64}$/.test(nextHash) || !Number.isInteger(nextRows) || nextRows < 0 || nextRows > 100000) throw new Error("Private import metadata is invalid.");
    if (ordinal && (count !== nextCount || size !== nextSize || hash !== nextHash || rowsCount !== nextRows)) throw new Error("Private import metadata changed during restore.");
    count = nextCount; size = nextSize; hash = nextHash; rowsCount = nextRows; parts.push(new Uint8Array(await response.arrayBuffer()));
  }
  const bytes = new Uint8Array(parts.reduce((total, part) => total + part.byteLength, 0)); let offset = 0; for (const part of parts) { bytes.set(part, offset); offset += part.byteLength; }
  if (bytes.byteLength !== size) throw new Error("Private import file validation failed.");
  const digest = Array.from(new Uint8Array(await crypto.subtle.digest("SHA-256", bytes))).map((value) => value.toString(16).padStart(2, "0")).join("");
  if (digest !== hash) throw new Error("Private import file validation failed.");
  const rows = JSON.parse(new TextDecoder().decode(bytes)); const source = sourceId(metadata);
  if (!source || !Array.isArray(rows) || rows.length !== rowsCount || rows.some((row) => !row || typeof row !== "object" || Array.isArray(row))) throw new Error("Private import file is incomplete.");
  return { id: metadata.id, name: metadata.name, sourceId: source, mapping: headers(metadata) as NormalizedPrivateImport["mapping"], rows };
}

export function useSavedDrafts() {
  const [drafts, setDrafts] = useState<SavedDraftSummary[]>([]); const [status, setStatus] = useState<"idle" | "loading" | "saving" | "saved" | "error">("idle"); const [error, setError] = useState<string | null>(null); const [conflictState, setConflict] = useState<SavedDraftConflict | null>(null); const [opened, setOpened] = useState<SavedDraftDetail | null>(null);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null); const epoch = useRef(0); const generation = useRef(0); const openedRef = useRef<SavedDraftDetail | null>(null); const accountId = useRef<string | null>(null); const queue = useRef<Promise<unknown>>(Promise.resolve()); const active = useRef<Attempt | null>(null);
  const replaceOpened = (next: SavedDraftDetail | null) => { openedRef.current = next; setOpened(next); };
  const refresh = useCallback(async () => { const at = epoch.current; setStatus("loading"); setError(null); try { const next = await request<SavedDraftSummary[]>("/api/v1/account/draft-pro/drafts", undefined, () => at === epoch.current); if (at === epoch.current) { setDrafts(next); setStatus("idle"); } } catch (cause) { if (at === epoch.current) { setStatus("error"); setError(cause instanceof Error ? cause.message : "Saved Drafts are unavailable."); } } }, []);
  useEffect(() => { void refresh(); void supabase.auth.getSession().then(({ data }) => { accountId.current = data.session?.user?.id ?? null; }); const subscription = supabase.auth.onAuthStateChange?.((event, session) => { const nextAccountId = session?.user?.id ?? null; if (nextAccountId === accountId.current && event !== "SIGNED_OUT") return; accountId.current = nextAccountId; epoch.current += 1; generation.current += 1; active.current = null; if (timer.current) clearTimeout(timer.current); timer.current = null; setDrafts([]); replaceOpened(null); setConflict(null); void refresh(); }).data.subscription; return () => { epoch.current += 1; generation.current += 1; active.current = null; if (timer.current) clearTimeout(timer.current); subscription?.unsubscribe(); }; }, [refresh]);
  const saveNow = useCallback((id: string | null, options: SaveOptions) => {
    const requestedGeneration = generation.current;
    const run = async () => {
      if (requestedGeneration !== generation.current) throw new Error("Saved draft save was cancelled.");
      const currentOpened = openedRef.current;
      const expectedVersion = id && currentOpened?.id === id ? currentOpened.lockVersion : options.expectedVersion; const sig = signature(id, expectedVersion, options); const attempt = active.current?.signature === sig ? active.current : { signature: sig, key: key(), staged: new Map<string, string>() }; active.current = attempt;
      const current = () => requestedGeneration === generation.current; setStatus("saving"); setError(null); setConflict(null);
      try {
        const previous = new Map((currentOpened?.id === id ? currentOpened.privateImports : []).map((entry) => [entry.id, entry])); const retained: string[] = [];
        const changed = (options.privateImports ?? []).filter((entry) => { const old = entry.id ? previous.get(entry.id) : undefined; return !old || old.name !== entry.name || old.sourceId !== entry.sourceId || JSON.stringify(old.mapping) !== JSON.stringify(entry.mapping) || JSON.stringify(old.rows) !== JSON.stringify(entry.rows); });
        if (changed.length && !options.accountSaveConsent) throw new Error("Confirm saving private imports to your account before uploading them.");
        for (const entry of options.privateImports ?? []) { const old = entry.id ? previous.get(entry.id) : undefined; if (!changed.includes(entry)) { if (!old?.id) throw new Error("Saved private import metadata is incomplete."); retained.push(old.id); } else if (!attempt.staged.has(entry.sourceId)) attempt.staged.set(entry.sourceId, await upload({ draftId: id, expectedVersion, attemptKey: attempt.key, entry, replacementImportId: old?.id, current })); }
        if (!current()) throw new Error("Saved draft save was cancelled.");
        const saved = await request<SavedDraftSummary>(id ? `/api/v1/account/draft-pro/drafts/${id}` : "/api/v1/account/draft-pro/drafts", { method: id ? "PUT" : "POST", body: JSON.stringify({ name: options.name, snapshot: options.snapshot, ...(expectedVersion === undefined ? {} : { expectedVersion }), attemptKey: attempt.key, importIds: retained }) }, current);
        if (!current()) return saved;
        const detail = await request<StoredDraftDetail>(`/api/v1/account/draft-pro/drafts/${saved.id}`, undefined, current); if (!current()) return saved;
        const local = new Map((options.privateImports ?? []).map((entry) => [entry.sourceId, entry])); const hydrated = detail.privateImports.map((entry) => { const source = sourceId(entry); const value = source ? local.get(source) : undefined; if (!value) throw new Error("Saved private import metadata is incomplete."); return { ...value, id: entry.id, name: entry.name, mapping: headers(entry) as NormalizedPrivateImport["mapping"] }; });
        setDrafts((all) => [saved, ...all.filter((draft) => draft.id !== saved.id)]); replaceOpened({ ...detail, ...saved, privateImports: hydrated }); active.current = null; setStatus("saved"); return saved;
      } catch (cause) { if (current()) { setStatus("error"); setError(cause instanceof Error ? cause.message : "Could not save this draft."); setConflict((cause as Error & { conflict?: SavedDraftSummary }).conflict ? { current: (cause as Error & { conflict?: SavedDraftSummary }).conflict } : null); } throw cause; }
    };
    const next = queue.current.catch(() => undefined).then(run); queue.current = next; return next;
  }, []);
  const autosave = useCallback((id: string, options: SaveOptions) => { if (timer.current) clearTimeout(timer.current); timer.current = setTimeout(() => { void saveNow(id, options).catch(() => undefined); }, 2000); }, [saveNow]);
  const open = useCallback(async (id: string) => {
    if (timer.current) clearTimeout(timer.current);
    const at = ++generation.current; setStatus("loading"); setError(null); setConflict(null);
    try {
      const value = await request<StoredDraftDetail>(`/api/v1/account/draft-pro/drafts/${id}`, undefined, () => at === generation.current);
      const imports = await Promise.all(value.privateImports.map((entry) => restoreImportChunks(id, entry, () => at === generation.current)));
      if (at !== generation.current) throw new Error("Saved draft restore was cancelled.");
      const restored: SavedDraftDetail = { ...value, privateImports: imports }; replaceOpened(restored); setStatus("idle"); return restored;
    } catch (cause) { if (at === generation.current) { setStatus("error"); setError(cause instanceof Error ? cause.message : "Could not open this saved draft."); } throw cause; }
  }, []);
  const mutate = useCallback(async (id: string, init: RequestInit, deleted = false) => {
    const at = generation.current; setStatus("saving"); setError(null); setConflict(null);
    try {
      const saved = await request<SavedDraftSummary>(`/api/v1/account/draft-pro/drafts/${id}`, init, () => at === generation.current);
      if (at !== generation.current) return saved;
      if (deleted) { setDrafts((all) => all.filter((draft) => draft.id !== id)); if (openedRef.current?.id === id) { generation.current += 1; active.current = null; if (timer.current) clearTimeout(timer.current); timer.current = null; replaceOpened(null); } }
      else { setDrafts((all) => [saved, ...all.filter((draft) => draft.id !== saved.id)]); if (openedRef.current?.id === saved.id) replaceOpened({ ...openedRef.current, ...saved }); }
      setStatus("saved"); return saved;
    } catch (cause) { if (at === generation.current) { setStatus("error"); setError(cause instanceof Error ? cause.message : "Could not update this saved draft."); setConflict((cause as Error & { conflict?: SavedDraftSummary }).conflict ? { current: (cause as Error & { conflict?: SavedDraftSummary }).conflict } : null); } throw cause; }
  }, []);
  const rename = useCallback((id: string, name: string, expectedVersion: number) => mutate(id, { method: "PATCH", body: JSON.stringify({ action: "rename", name, expectedVersion }) }), [mutate]);
  const duplicate = useCallback((id: string, name: string, expectedVersion: number) => mutate(id, { method: "POST", body: JSON.stringify({ action: "duplicate", name, expectedVersion }) }), [mutate]);
  const remove = useCallback((id: string, expectedVersion: number) => mutate(id, { method: "DELETE", body: JSON.stringify({ expectedVersion }) }, true), [mutate]);
  const reloadConflict = useCallback(async () => conflictState?.current ? open(conflictState.current.id) : null, [conflictState, open]); const saveAsAnother = useCallback((options: SaveOptions, name: string) => saveNow(null, { ...options, name, expectedVersion: undefined }), [saveNow]);
  return { drafts, status, error, conflict: conflictState, opened, refresh, saveNow, autosave, open, rename, duplicate, remove, reloadConflict, saveAsAnother };
}
