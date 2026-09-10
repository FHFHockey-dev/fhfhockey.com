import { useCallback, useEffect, useRef, useState } from "react";
import supabase from "lib/supabase/client";
import { scenarioFingerprint, type ScenarioInput, type ScenarioResult } from "lib/draft-pro/scenarios";

export type DraftProScenarioSummary = Readonly<{ id: string; name: string; updated_at: string }>;
type Status = "idle" | "loading" | "saving" | "error";
type State = { result: ScenarioResult | null; resultInputFingerprint: string | null; openedId: string | null; openedFingerprint: string | null; status: Status; listLoading: boolean; listError: string | null; error: string | null; saved: DraftProScenarioSummary[] };
type Retry = () => Promise<unknown>;

export function useDraftProScenarios(contextFingerprint: string | null, eligible: boolean) {
  const [state, setState] = useState<State>({ result: null, resultInputFingerprint: null, openedId: null, openedFingerprint: null, status: "idle", listLoading: false, listError: null, error: null, saved: [] });
  const actionOperation = useRef(0);
  const listOperation = useRef(0);
  const accountOperation = useRef(0);
  const actionController = useRef<AbortController | null>(null);
  const listController = useRef<AbortController | null>(null);
  const accountId = useRef<string | null>(null);
  const mounted = useRef(true);
  const context = useRef(contextFingerprint);
  const eligibleRef = useRef(eligible);
  const retryRef = useRef<Retry | null>(null);

  const cancelAction = useCallback(() => {
    actionOperation.current += 1;
    actionController.current?.abort();
    actionController.current = null;
  }, []);

  const cancelList = useCallback(() => {
    listOperation.current += 1;
    listController.current?.abort();
    listController.current = null;
  }, []);

  const request = useCallback(async <T,>(path: string, init: RequestInit | undefined, token: number, kind: "action" | "list"): Promise<T> => {
    const session = (await supabase.auth.getSession()).data.session;
    const current = kind === "action" ? actionOperation : listOperation;
    const controller = kind === "action" ? actionController : listController;
    if (!mounted.current || token !== current.current) throw new DOMException("Cancelled", "AbortError");
    if (!session?.access_token) throw new Error("Sign in to use saved scenarios.");
    const next = new AbortController();
    controller.current?.abort();
    controller.current = next;
    const response = await fetch(path, { ...init, signal: next.signal, headers: { Authorization: `Bearer ${session.access_token}`, "Content-Type": "application/json", ...init?.headers } });
    const body = await response.json().catch(() => ({}));
    if (!mounted.current || token !== current.current) throw new DOMException("Cancelled", "AbortError");
    if (!response.ok) throw new Error(body.error?.message ?? "Scenarios are unavailable.");
    return body.data as T;
  }, []);

  const fail = useCallback((cause: unknown, token: number, retry: Retry) => {
    if (!mounted.current || token !== actionOperation.current || (cause as Error).name === "AbortError") return;
    retryRef.current = retry;
    setState((current) => ({ ...current, status: "error", error: cause instanceof Error ? cause.message : "Scenarios are unavailable." }));
  }, []);

  const list = useCallback(async () => {
    const token = ++listOperation.current;
    setState((current) => ({ ...current, listLoading: true, listError: null }));
    try {
      const saved = await request<DraftProScenarioSummary[]>("/api/v1/account/draft-pro/scenarios", undefined, token, "list");
      if (token === listOperation.current) setState((current) => ({ ...current, saved, listLoading: false, listError: null }));
      return saved;
    } catch (cause) { if (mounted.current && token === listOperation.current && (cause as Error).name !== "AbortError") setState((current) => ({ ...current, listLoading: false, listError: cause instanceof Error ? cause.message : "Could not load saved scenarios." })); return null; }
  }, [request]);

  const generate = useCallback(async (input: ScenarioInput, draftId?: string | null) => {
    const expected = scenarioFingerprint(input);
    const retry = () => generate(input, draftId);
    if (!eligibleRef.current || context.current !== expected) return null;
    const token = ++actionOperation.current;
    setState((current) => ({ ...current, status: "loading", error: null }));
    try {
      const result = await request<ScenarioResult>("/api/v1/account/draft-pro/scenarios", { method: "POST", body: JSON.stringify({ action: "analyze", draftId: draftId ?? null, scenario: input }) }, token, "action");
      if (token === actionOperation.current && eligibleRef.current && context.current === expected) { retryRef.current = null; setState((current) => ({ ...current, result, resultInputFingerprint: expected, openedId: null, openedFingerprint: null, status: "idle" })); }
      return result;
    } catch (cause) { fail(cause, token, retry); return null; }
  }, [fail, request]);

  const save = useCallback(async (name: string, input: ScenarioInput, draftId?: string | null) => {
    const expected = scenarioFingerprint(input);
    const retry = () => save(name, input, draftId);
    if (!eligibleRef.current || context.current !== expected) return null;
    const token = ++actionOperation.current;
    setState((current) => ({ ...current, status: "saving", error: null }));
    try {
      const row = await request<{ id: string; name: string; updated_at: string; source_fingerprint: string; result: ScenarioResult }>("/api/v1/account/draft-pro/scenarios", { method: "POST", body: JSON.stringify({ action: "save", name, draftId: draftId ?? null, scenario: input }) }, token, "action");
      if (token === actionOperation.current && eligibleRef.current && context.current === expected) { retryRef.current = null; setState((current) => ({ ...current, result: row.result, resultInputFingerprint: expected, openedId: row.id, openedFingerprint: row.source_fingerprint, status: "idle", saved: [{ id: row.id, name: row.name, updated_at: row.updated_at }, ...current.saved.filter((item) => item.id !== row.id)] })); }
      return row;
    } catch (cause) { fail(cause, token, retry); return null; }
  }, [fail, request]);

  const open = useCallback(async (id: string) => {
    const retry = () => open(id);
    if (!eligibleRef.current) return null;
    const token = ++actionOperation.current;
    setState((current) => ({ ...current, status: "loading", error: null }));
    try {
      const row = await request<{ id: string; source_fingerprint: string; input: ScenarioInput; result: ScenarioResult }>(`/api/v1/account/draft-pro/scenarios/${id}`, undefined, token, "action");
      if (token === actionOperation.current && eligibleRef.current) { retryRef.current = null; setState((current) => ({ ...current, result: row.result, resultInputFingerprint: scenarioFingerprint(row.input), openedId: row.id, openedFingerprint: row.source_fingerprint, status: "idle" })); }
      return row;
    } catch (cause) { fail(cause, token, retry); return null; }
  }, [fail, request]);

  const retry = useCallback(() => retryRef.current?.() ?? Promise.resolve(null), []);

  useEffect(() => {
    context.current = contextFingerprint;
    eligibleRef.current = eligible;
    cancelAction();
    retryRef.current = null;
    setState((current) => ({ ...current, status: "idle", error: null }));
    if (!eligible) {
      setState((current) => ({ ...current, result: null, resultInputFingerprint: null, openedId: null, openedFingerprint: null, status: "idle", error: null }));
    }
  }, [cancelAction, contextFingerprint, eligible]);

  useEffect(() => {
    mounted.current = true;
    let active = true;
    const initialOperation = accountOperation.current;
    void supabase.auth.getSession().then(({ data }) => {
      if (!active || initialOperation !== accountOperation.current) return;
      accountId.current = data.session?.user?.id ?? null;
      if (accountId.current) void list();
    });
    const subscription = supabase.auth.onAuthStateChange?.((_event, session) => {
      if (!active) return;
      const next = session?.user?.id ?? null;
      if (next === accountId.current) return;
      accountId.current = next;
      accountOperation.current += 1;
      cancelAction();
      cancelList();
      retryRef.current = null;
      setState({ result: null, resultInputFingerprint: null, openedId: null, openedFingerprint: null, status: "idle", listLoading: false, listError: null, error: null, saved: [] });
      if (next) void list();
    }).data.subscription;
    return () => { active = false; mounted.current = false; accountOperation.current += 1; cancelAction(); cancelList(); subscription?.unsubscribe(); };
  }, [cancelAction, cancelList, list]);

  return { ...state, stale: Boolean(state.result && state.resultInputFingerprint !== contextFingerprint), contextUnavailable: contextFingerprint === null, generate, list, save, open, retry, cancel: cancelAction };
}
