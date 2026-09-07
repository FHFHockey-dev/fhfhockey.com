import { useCallback, useEffect, useMemo, useRef, useState } from "react";

import { useDraftProAccess } from "hooks/useDraftProAccess";
import { useSavedDrafts, type SaveOptions } from "hooks/useSavedDrafts";
import {
  serializeSavedDraft,
  restoreBrowserSnapshot,
  toNormalizedPrivateImports,
  type BrowserDraftSnapshot,
  type NormalizedPrivateImport,
} from "lib/draft-pro/savedDrafts";
import type { DraftProSnapshot } from "lib/draft-pro/contracts";
import type { SessionCsvEntry } from "lib/draftDashboard/csvImportSession";
import {
  SavedDraftsPanel,
  type SavedDraftAnnotationPlayer,
  type SavedDraftAnnotations,
} from "./SavedDraftsPanel";

type Props = {
  getBrowserSnapshot: () => BrowserDraftSnapshot;
  applyBrowserSnapshot: (snapshot: BrowserDraftSnapshot) => BrowserDraftSnapshot | false;
  players: readonly SavedDraftAnnotationPlayer[];
  annotations: SavedDraftAnnotations;
  onAnnotationsChange: (next: SavedDraftAnnotations) => void;
};

const canonicalize = (entry: unknown): unknown => Array.isArray(entry)
  ? entry.map(canonicalize)
  : entry && typeof entry === "object"
    ? Object.fromEntries(Object.entries(entry as Record<string, unknown>).sort(([left], [right]) => left.localeCompare(right)).map(([key, child]) => [key, canonicalize(child)]))
    : entry;

const restore = (snapshot: DraftProSnapshot, imports: readonly NormalizedPrivateImport[]) =>
  restoreBrowserSnapshot(snapshot, imports) as BrowserDraftSnapshot;
const contentFingerprint = (snapshot: BrowserDraftSnapshot, imports: readonly NormalizedPrivateImport[]) =>
  JSON.stringify(canonicalize(restoreBrowserSnapshot(serializeSavedDraft(snapshot), imports)));

export default function SavedDraftsWorkspace({ getBrowserSnapshot, applyBrowserSnapshot, players, annotations, onAnnotationsChange }: Props) {
  const { access } = useDraftProAccess();
  const eligible = Boolean(access?.capabilities.includes("saved_drafts"));
  const saved = useSavedDrafts();
  const hydrating = useRef(false);
  const hydrationTarget = useRef<string | null>(null);
  const lastCloudFingerprint = useRef<string | null>(null);
  const pendingCloudFingerprint = useRef<string | null>(null);
  const blockedFingerprint = useRef<string | null>(null);
  const workspaceVersion = useRef(0);
  const operation = useRef(0);
  const openedId = useRef<string | null>(saved.opened?.id ?? null);
  const expectedOpenedId = useRef<string | null>(null);
  const [privateImportsDirty, setPrivateImportsDirty] = useState(false);
  const [restoreError, setRestoreError] = useState<string | null>(null);
  const currentSnapshot = getBrowserSnapshot();
  const importState = useMemo(() => {
    try {
      return { imports: toNormalizedPrivateImports((currentSnapshot.customCsvList ?? []) as unknown as SessionCsvEntry[]), error: null };
    } catch (cause) {
      return { imports: [], error: cause instanceof Error ? cause.message : "Private import rows are unavailable; re-import them before saving." };
    }
  }, [currentSnapshot.customCsvList]);
  const currentImports = importState.imports;
  const fingerprintState = useMemo(() => {
    if (importState.error) return { fingerprint: null, error: importState.error };
    try { return { fingerprint: contentFingerprint(currentSnapshot, currentImports), error: null }; }
    catch (cause) { return { fingerprint: null, error: cause instanceof Error ? cause.message : "This local draft cannot be saved until its settings are fixed." }; }
  }, [currentImports, currentSnapshot, importState.error]);
  const currentFingerprint = fingerprintState.fingerprint;
  const currentError = fingerprintState.error;
  const importsForOpenedDraft = useCallback((imports: readonly NormalizedPrivateImport[]) => imports.map((entry) => {
    const stored = saved.opened?.privateImports.find((candidate) => candidate.sourceId === entry.sourceId);
    return stored ? { ...entry, id: stored.id } : entry;
  }), [saved.opened]);

  const makeSaveOptions = (name: string, snapshot: DraftProSnapshot, imports: readonly NormalizedPrivateImport[], accountSaveConsent: boolean) => ({
    name,
    snapshot,
    privateImports: imports,
    accountSaveConsent,
  });

  const resetLifecycle = useCallback(() => {
    hydrating.current = false;
    hydrationTarget.current = null;
    lastCloudFingerprint.current = null;
    pendingCloudFingerprint.current = null;
    blockedFingerprint.current = null;
    setPrivateImportsDirty(false);
  }, []);

  useEffect(() => {
    const nextOpenedId = saved.opened?.id ?? null;
    if (nextOpenedId === openedId.current) return;
    const previousOpenedId = openedId.current;
    openedId.current = nextOpenedId;
    if (nextOpenedId && expectedOpenedId.current === nextOpenedId) {
      expectedOpenedId.current = null;
      return;
    }
    if (previousOpenedId || !nextOpenedId) {
      operation.current += 1;
      resetLifecycle();
      setRestoreError(null);
    }
  }, [resetLifecycle, saved.opened?.id]);

  useEffect(() => {
    if (!saved.opened || !eligible || !currentFingerprint) return;
    if (currentError) { setPrivateImportsDirty(Boolean(importState.error)); return; }
    if (hydrating.current) {
      // The applied snapshot is the known cloud baseline. The first rendered
      // snapshot may already include a user edit, so a mismatch must continue
      // through the normal autosave path instead of becoming the baseline.
      lastCloudFingerprint.current = hydrationTarget.current ?? currentFingerprint;
      hydrating.current = false;
      hydrationTarget.current = null;
      if (currentFingerprint === lastCloudFingerprint.current) return;
    }
    if (currentFingerprint === lastCloudFingerprint.current) {
      if (pendingCloudFingerprint.current) { operation.current += 1; saved.cancelAutosave(); pendingCloudFingerprint.current = null; }
      return;
    }
    if (!lastCloudFingerprint.current || currentFingerprint === pendingCloudFingerprint.current || currentFingerprint === blockedFingerprint.current) return;
    const cloudImports = saved.opened.privateImports;
    const importsChanged = JSON.stringify(canonicalize(currentImports.map(({ name, sourceId, mapping, rows }) => ({ name, sourceId, mapping, rows })))) !== JSON.stringify(canonicalize(cloudImports.map(({ name, sourceId, mapping, rows }) => ({ name, sourceId, mapping, rows }))));
    if (importsChanged) { setPrivateImportsDirty(true); return; }
    let snapshot: DraftProSnapshot;
    try { snapshot = serializeSavedDraft(currentSnapshot); }
    catch (cause) { setRestoreError(cause instanceof Error ? cause.message : "This local draft cannot be saved until its settings are fixed."); return; }
    setPrivateImportsDirty(false);
    const options = makeSaveOptions(saved.opened.name, snapshot, importsForOpenedDraft(currentImports), false);
    pendingCloudFingerprint.current = currentFingerprint;
    const version = workspaceVersion.current;
    const token = ++operation.current;
    const draftId = saved.opened.id;
    saved.autosave(draftId, options).then(() => { if (token !== operation.current || version !== workspaceVersion.current) return; lastCloudFingerprint.current = currentFingerprint; pendingCloudFingerprint.current = null; blockedFingerprint.current = null; }, () => { if (token !== operation.current || version !== workspaceVersion.current) return; pendingCloudFingerprint.current = null; blockedFingerprint.current = currentFingerprint; });
  }, [currentError, currentFingerprint, currentImports, currentSnapshot, eligible, importState.error, importsForOpenedDraft, saved]);

  const save = async (name: string, id: string | null = null) => {
    const token = ++operation.current;
    try {
      if (currentError) throw new Error(currentError);
      const browser = getBrowserSnapshot();
      const imports = importsForOpenedDraft(toNormalizedPrivateImports((browser.customCsvList ?? []) as unknown as SessionCsvEntry[]));
      const nextFingerprint = contentFingerprint(browser, imports);
      const savedDraft = await saved.saveNow(id, makeSaveOptions(name, serializeSavedDraft(browser), imports, true));
      if (token !== operation.current) return;
      if (!id) expectedOpenedId.current = savedDraft.id;
      setRestoreError(null);
      lastCloudFingerprint.current = nextFingerprint;
      pendingCloudFingerprint.current = null;
      blockedFingerprint.current = null;
      setPrivateImportsDirty(false);
    } catch (cause) {
      if (token !== operation.current) return;
      setRestoreError(cause instanceof Error ? cause.message : "Could not save this draft.");
      throw cause;
    }
  };

  const open = async (id: string) => {
    const version = ++workspaceVersion.current;
    const token = ++operation.current;
    try {
      const preview = await saved.openPreview(id);
      if (token !== operation.current || version !== workspaceVersion.current) return;
      const restored = restore(preview.detail.snapshot, preview.detail.privateImports);
      if (contentFingerprint(restored, preview.detail.privateImports) !== currentFingerprint && !window.confirm("Opening this saved draft will replace different local work. Continue?")) { hydrating.current = false; hydrationTarget.current = null; pendingCloudFingerprint.current = null; blockedFingerprint.current = null; return; }
      let applied: BrowserDraftSnapshot | false = false;
      if (!saved.adopt(preview, () => { applied = applyBrowserSnapshot(restored); return Boolean(applied); }) || !applied) throw new Error("The saved draft could not be applied. Your local draft is unchanged.");
      hydrating.current = true;
      hydrationTarget.current = contentFingerprint(applied, preview.detail.privateImports);
      expectedOpenedId.current = preview.detail.id;
      if (token !== operation.current || version !== workspaceVersion.current) return;
      setRestoreError(null);
    } catch (cause) {
      if (token !== operation.current || version !== workspaceVersion.current) return;
      expectedOpenedId.current = null;
      hydrating.current = false; hydrationTarget.current = null; pendingCloudFingerprint.current = null;
      setRestoreError(cause instanceof Error ? cause.message : "The saved draft could not be restored. Your local draft is unchanged.");
      throw cause;
    }
  };

  const reloadConflict = () => { const token = ++operation.current; void saved.reloadConflict().then((preview) => { if (!preview || token !== operation.current) return; const version = ++workspaceVersion.current; const restored = restore(preview.detail.snapshot, preview.detail.privateImports); if (contentFingerprint(restored, preview.detail.privateImports) !== currentFingerprint && !window.confirm("Reloading this saved draft will replace different local work. Continue?")) return; let applied: BrowserDraftSnapshot | false = false; if (!saved.adopt(preview, () => { applied = applyBrowserSnapshot(restored); return Boolean(applied); }) || !applied) throw new Error("The saved draft could not be applied. Your local draft is unchanged."); hydrating.current = true; hydrationTarget.current = contentFingerprint(applied, preview.detail.privateImports); expectedOpenedId.current = preview.detail.id; if (token === operation.current && version === workspaceVersion.current) setRestoreError(null); }).catch((cause) => { if (token !== operation.current) return; expectedOpenedId.current = null; hydrating.current = false; hydrationTarget.current = null; setRestoreError(cause instanceof Error ? cause.message : "The saved draft could not be restored."); }); };
  const saveAsAnother = () => {
    const name = window.prompt("Save this draft as", `${saved.opened?.name ?? "Draft"} copy`.slice(0, 120))?.trim();
    if (!name) return;
    const token = ++operation.current;
    try {
      if (currentError) throw new Error(currentError);
      const browser = getBrowserSnapshot();
      const imports = toNormalizedPrivateImports((browser.customCsvList ?? []) as unknown as SessionCsvEntry[]);
      const nextFingerprint = contentFingerprint(browser, imports);
      void saved.saveAsAnother(makeSaveOptions(name, serializeSavedDraft(browser), imports, true), name).then((next) => { if (token !== operation.current) return; expectedOpenedId.current = next.id; lastCloudFingerprint.current = nextFingerprint; blockedFingerprint.current = null; }).catch((cause) => { if (token === operation.current) setRestoreError(cause instanceof Error ? cause.message : "Could not save this draft."); });
    } catch (cause) { if (token === operation.current) setRestoreError(cause instanceof Error ? cause.message : "Could not save this draft."); }
  };

  const retry = () => {
    if (!saved.opened || currentError || !currentFingerprint) { void saved.refresh(); return; }
    const options = makeSaveOptions(saved.opened.name, serializeSavedDraft(currentSnapshot), importsForOpenedDraft(currentImports), false);
    const version = workspaceVersion.current;
    const token = ++operation.current;
    pendingCloudFingerprint.current = currentFingerprint;
    blockedFingerprint.current = null;
    saved.saveNow(saved.opened.id, options).then(() => { if (token !== operation.current || version !== workspaceVersion.current) return; lastCloudFingerprint.current = currentFingerprint; pendingCloudFingerprint.current = null; }, (cause) => { if (token !== operation.current || version !== workspaceVersion.current) return; pendingCloudFingerprint.current = null; blockedFingerprint.current = currentFingerprint; setRestoreError(cause instanceof Error ? cause.message : "Could not save this draft."); });
  };

  return <SavedDraftsPanel eligible={eligible} drafts={saved.drafts} status={saved.status} error={restoreError ?? saved.error ?? (currentError === importState.error ? null : currentError)} onOpen={(id) => { void open(id).catch(() => undefined); }} onSave={(name) => { void save(name).catch(() => undefined); }} onSaveChanges={() => { if (saved.opened) void save(saved.opened.name, saved.opened.id).catch(() => undefined); }} privateImportsDirty={privateImportsDirty} privateImportError={importState.error} onRename={(id, name, version) => { void saved.rename(id, name, version).catch(() => undefined); }} onDuplicate={(id, name, version) => { void saved.duplicate(id, name, version).catch(() => undefined); }} onDelete={(id, version) => { void saved.remove(id, version).catch(() => undefined); }} onReloadConflict={saved.conflict ? reloadConflict : undefined} onSaveAsAnother={saved.conflict ? saveAsAnother : undefined} onRefresh={retry} players={saved.opened ? players : undefined} openedWorkspaceAnnotations={saved.opened ? annotations : undefined} onAnnotationsChange={saved.opened ? onAnnotationsChange : undefined} />;
}
