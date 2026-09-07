import { useCallback, useEffect, useRef, useState } from "react";

import supabase from "lib/supabase/client";
import type { DraftProSnapshot } from "lib/draft-pro/contracts";

export type SavedDraftSummary = { id: string; name: string; status: "active" | "archived"; lockVersion: number; updatedAt: string };
export type SavedDraftDetail = SavedDraftSummary & { snapshot: DraftProSnapshot; privateImports: unknown[] };
export type SavedDraftConflict = { current?: SavedDraftSummary };

type SaveOptions = { name: string; snapshot: DraftProSnapshot; expectedVersion?: number; accountSaveConsent: boolean; privateImports?: unknown[] };

async function request<T>(path: string, init?: RequestInit): Promise<T> {
  const session = (await supabase.auth.getSession()).data.session;
  if (!session?.access_token) throw new Error("Sign in to use Saved Drafts.");
  const response = await fetch(path, {
    ...init,
    headers: { Authorization: `Bearer ${session.access_token}`, "Content-Type": "application/json", ...init?.headers },
  });
  const payload = await response.json().catch(() => ({}));
  if (response.status === 409) {
    const error = new Error("This saved draft changed elsewhere. Reload it or save a copy.");
    Object.assign(error, { conflict: payload.data?.current as SavedDraftConflict["current"] });
    throw error;
  }
  if (!response.ok) throw new Error(payload.error?.message ?? "Saved Drafts are unavailable. Your local draft is unchanged.");
  return payload.data as T;
}

async function restoreImportChunks(draftId: string, metadata: unknown, isCurrent: () => boolean) {
  const entry = metadata as { id?: string; import_id?: string };
  const importId = entry.id ?? entry.import_id;
  if (!importId) throw new Error("Private import metadata is incomplete.");
  const chunks: Uint8Array[] = []; let totalChunks = 0; let totalBytes = 0; let sha256 = ""; let rowCount = 0;
  for (let ordinal = 0; ordinal === 0 || ordinal < totalChunks; ordinal += 1) {
    const session = (await supabase.auth.getSession()).data.session;
    if (!session?.access_token || !isCurrent()) throw new Error("Saved draft restore was cancelled.");
    const response = await fetch(`/api/v1/account/draft-pro/drafts/${draftId}/imports/${importId}?ordinal=${ordinal}`, { headers: { Authorization: `Bearer ${session.access_token}` } });
    if (!response.ok) throw new Error("Private import file is unavailable; the draft was not restored.");
    const nextChunks = Number(response.headers.get("X-Draft-Pro-Total-Chunks")); const nextBytes = Number(response.headers.get("X-Draft-Pro-Total-Bytes")); const nextHash = response.headers.get("X-Draft-Pro-SHA256") ?? ""; const nextRows = Number(response.headers.get("X-Draft-Pro-Row-Count"));
    if (!Number.isInteger(nextChunks) || nextChunks < 1 || nextChunks > 32 || !Number.isInteger(nextBytes) || nextBytes < 1 || nextBytes > 10 * 1024 * 1024 || !/^[a-f0-9]{64}$/.test(nextHash) || !Number.isInteger(nextRows) || nextRows < 0 || nextRows > 100_000) throw new Error("Private import metadata is invalid.");
    if (ordinal && (nextChunks !== totalChunks || nextBytes !== totalBytes || nextHash !== sha256 || nextRows !== rowCount)) throw new Error("Private import metadata changed during restore.");
    totalChunks = nextChunks; totalBytes = nextBytes; sha256 = nextHash; rowCount = nextRows;
    chunks.push(new Uint8Array(await response.arrayBuffer()));
  }
  const bytes = new Uint8Array(chunks.reduce((size, chunk) => size + chunk.byteLength, 0)); let offset = 0; for (const chunk of chunks) { bytes.set(chunk, offset); offset += chunk.byteLength; }
  if (bytes.byteLength !== totalBytes || !sha256 || !Number.isInteger(rowCount)) throw new Error("Private import file validation failed.");
  const digest = Array.from(new Uint8Array(await crypto.subtle.digest("SHA-256", bytes))).map((value) => value.toString(16).padStart(2, "0")).join("");
  if (digest !== sha256) throw new Error("Private import file validation failed.");
  const rows = JSON.parse(new TextDecoder().decode(bytes)); if (!Array.isArray(rows) || rows.length !== rowCount) throw new Error("Private import file is incomplete.");
  return { ...entry, rows };
}

/** Cloud saving is opt-in; the caller continues its immediate free local save. */
export function useSavedDrafts() {
  const [drafts, setDrafts] = useState<SavedDraftSummary[]>([]);
  const [status, setStatus] = useState<"idle" | "loading" | "saving" | "saved" | "error">("idle");
  const [error, setError] = useState<string | null>(null);
  const [conflict, setConflict] = useState<SavedDraftConflict | null>(null);
  const [opened, setOpened] = useState<SavedDraftDetail | null>(null);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const epoch = useRef(0);

  const refresh = useCallback(async () => {
    const refreshEpoch = epoch.current;
    setStatus("loading"); setError(null);
    try { const next = await request<SavedDraftSummary[]>("/api/v1/account/draft-pro/drafts"); if (refreshEpoch === epoch.current) { setDrafts(next); setStatus("idle"); } }
    catch (cause) { if (refreshEpoch === epoch.current) { setStatus("error"); setError(cause instanceof Error ? cause.message : "Saved Drafts are unavailable."); } }
  }, []);
  useEffect(() => {
    void refresh();
    const subscription = supabase.auth.onAuthStateChange?.(() => { epoch.current += 1; if (timer.current) clearTimeout(timer.current); timer.current = null; setOpened(null); setConflict(null); void refresh(); }).data.subscription;
    return () => { epoch.current += 1; if (timer.current) clearTimeout(timer.current); subscription?.unsubscribe(); };
  }, [refresh]);

  const saveNow = useCallback(async (id: string | null, options: SaveOptions) => {
    if (options.privateImports?.length && !options.accountSaveConsent) {
      throw new Error("Confirm saving private imports to your account before uploading them.");
    }
    const saveEpoch = epoch.current;
    setStatus("saving"); setError(null); setConflict(null);
    try {
      // Rows travel only through the private-import chunk uploader. Never put
      // them in this snapshot request or any background calculation request.
      const { privateImports: _privateImports, accountSaveConsent: _accountSaveConsent, ...requestOptions } = options;
      const saved = await request<SavedDraftSummary>(id ? `/api/v1/account/draft-pro/drafts/${id}` : "/api/v1/account/draft-pro/drafts", {
        method: id ? "PUT" : "POST",
        body: JSON.stringify(requestOptions),
      });
      if (saveEpoch !== epoch.current) return saved;
      setDrafts((current) => [saved, ...current.filter((draft) => draft.id !== saved.id)]);
      setOpened((current) => current?.id === saved.id ? { ...current, ...saved } : current);
      setStatus("saved");
      return saved;
    } catch (cause) {
      if (saveEpoch === epoch.current) {
        setStatus("error"); const message = cause instanceof Error ? cause.message : "Could not save this draft."; setError(message);
        setConflict((cause as Error & { conflict?: SavedDraftSummary }).conflict ? { current: (cause as Error & { conflict?: SavedDraftSummary }).conflict } : null);
      }
      throw cause;
    }
  }, []);

  const autosave = useCallback((id: string, options: SaveOptions) => {
    if (timer.current) clearTimeout(timer.current);
    timer.current = setTimeout(() => { void saveNow(id, options).catch(() => undefined); }, 2_000);
  }, [saveNow]);
  const open = useCallback(async (id: string) => { if (timer.current) clearTimeout(timer.current); const openEpoch = epoch.current; const isCurrent = () => openEpoch === epoch.current; const value = await request<SavedDraftDetail>(`/api/v1/account/draft-pro/drafts/${id}`); const imports = await Promise.all(value.privateImports.map((entry) => restoreImportChunks(id, entry, isCurrent))); if (!isCurrent()) throw new Error("Saved draft restore was cancelled."); const restored = { ...value, privateImports: imports }; setOpened(restored); return restored; }, []);
  const rename = useCallback((id: string, name: string, expectedVersion: number) => request<SavedDraftSummary>(`/api/v1/account/draft-pro/drafts/${id}`, { method: "PATCH", body: JSON.stringify({ action: "rename", name, expectedVersion }) }), []);
  const duplicate = useCallback((id: string, name: string, expectedVersion: number) => request<SavedDraftSummary>(`/api/v1/account/draft-pro/drafts/${id}`, { method: "POST", body: JSON.stringify({ action: "duplicate", name, expectedVersion }) }), []);
  const remove = useCallback((id: string, expectedVersion: number) => request<void>(`/api/v1/account/draft-pro/drafts/${id}`, { method: "DELETE", body: JSON.stringify({ expectedVersion }) }), []);
  const reloadConflict = useCallback(async () => conflict?.current ? open(conflict.current.id) : null, [conflict, open]);
  const saveAsAnother = useCallback((options: SaveOptions, name: string) => saveNow(null, { ...options, name, expectedVersion: undefined }), [saveNow]);
  return { drafts, status, error, conflict, opened, refresh, saveNow, autosave, open, rename, duplicate, remove, reloadConflict, saveAsAnother };
}
