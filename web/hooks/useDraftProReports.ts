import { useCallback, useEffect, useRef, useState } from "react";
import supabase from "lib/supabase/client";
import { scenarioFingerprint } from "lib/draft-pro/scenarios";
import type {
  DraftProReport,
  DraftProReportType,
  ReportInput,
} from "lib/draft-pro/reports";

export type DraftProReportSummary = Readonly<{
  id: string;
  report_type: DraftProReportType;
  source_fingerprint: string;
  created_at: string;
}>;
type State = {
  saved: DraftProReportSummary[];
  report: DraftProReport | null;
  status: "idle" | "loading" | "error";
  error: string | null;
  listLoading: boolean;
  listError: string | null;
};
type Retry = () => Promise<unknown>;

export function useDraftProReports(
  eligible: boolean,
  contextFingerprint: string | null,
) {
  const [state, setState] = useState<State>({
    saved: [],
    report: null,
    status: "idle",
    error: null,
    listLoading: false,
    listError: null,
  });
  const actionGeneration = useRef(0);
  const listGeneration = useRef(0);
  const accountGeneration = useRef(0);
  const actionController = useRef<AbortController | null>(null);
  const listController = useRef<AbortController | null>(null);
  const accountId = useRef<string | null>(null);
  const mounted = useRef(false);
  const eligibleRef = useRef(eligible);
  const contextRef = useRef(contextFingerprint);
  const retryRef = useRef<Retry | null>(null);
  const cancelAction = useCallback(() => {
    actionGeneration.current += 1;
    actionController.current?.abort();
    actionController.current = null;
  }, []);
  const cancelList = useCallback(() => {
    listGeneration.current += 1;
    listController.current?.abort();
    listController.current = null;
  }, []);
  const request = useCallback(
    async <T>(
      path: string,
      init: RequestInit | undefined,
      generation: number,
      kind: "action" | "list",
    ) => {
      const session = (await supabase.auth.getSession()).data.session;
      const current = kind === "action" ? actionGeneration : listGeneration;
      const holder = kind === "action" ? actionController : listController;
      if (!mounted.current || generation !== current.current)
        throw new DOMException("Cancelled", "AbortError");
      if (!session?.access_token) throw new Error("Sign in to use reports.");
      const controller = new AbortController();
      holder.current?.abort();
      holder.current = controller;
      const response = await fetch(path, {
        ...init,
        signal: controller.signal,
        headers: {
          Authorization: `Bearer ${session.access_token}`,
          "Content-Type": "application/json",
          ...init?.headers,
        },
      });
      const body = await response.json().catch(() => ({}));
      if (!mounted.current || generation !== current.current)
        throw new DOMException("Cancelled", "AbortError");
      if (!response.ok)
        throw new Error(body.error?.message ?? "Reports are unavailable.");
      return body.data as T;
    },
    [],
  );
  const list = useCallback(async () => {
    const generation = ++listGeneration.current;
    setState((current) => ({ ...current, listLoading: true, listError: null }));
    try {
      const saved = await request<DraftProReportSummary[]>(
        "/api/v1/account/draft-pro/reports",
        undefined,
        generation,
        "list",
      );
      if (generation === listGeneration.current)
        setState((current) => ({ ...current, saved, listLoading: false }));
      return saved;
    } catch (cause) {
      if (
        mounted.current &&
        generation === listGeneration.current &&
        (cause as Error).name !== "AbortError"
      )
        setState((current) => ({
          ...current,
          listLoading: false,
          listError:
            cause instanceof Error
              ? cause.message
              : "Could not load saved reports.",
        }));
      return null;
    }
  }, [request]);
  const generate = useCallback(
    async (
      input: ReportInput,
      reportType: DraftProReportType,
    refs: {
      draftId?: string | null;
      privateImportDraftId?: string | null;
      scenarioId?: string | null;
        snapshot?: unknown;
      } = {},
    ) => {
      const expected = scenarioFingerprint(input);
      const retry = () => generate(input, reportType, refs);
      if (!eligibleRef.current || contextRef.current !== expected) return null;
      const generation = ++actionGeneration.current;
      retryRef.current = retry;
      setState((current) => ({ ...current, status: "loading", error: null }));
      try {
        const row = await request<{
          payload: DraftProReport;
          id: string;
          report_type: DraftProReportType;
          source_fingerprint: string;
          created_at: string;
        }>(
          "/api/v1/account/draft-pro/reports",
          {
            method: "POST",
            body: JSON.stringify({ ...refs, reportType, input }),
          },
          generation,
          "action",
        );
        if (
          !eligibleRef.current ||
          contextRef.current !== expected ||
          generation !== actionGeneration.current
        )
          return null;
        retryRef.current = null;
        setState((current) => ({
          ...current,
          report: row.payload,
          status: "idle",
          saved: [
            {
              id: row.id,
              report_type: row.report_type,
              source_fingerprint: row.source_fingerprint,
              created_at: row.created_at,
            },
            ...current.saved.filter((item) => item.id !== row.id),
          ],
        }));
        return row.payload;
      } catch (cause) {
        if (
          mounted.current &&
          generation === actionGeneration.current &&
          (cause as Error).name !== "AbortError"
        ) {
          retryRef.current = retry;
          setState((current) => ({
            ...current,
            status: "error",
            error:
              cause instanceof Error
                ? cause.message
                : "Reports are unavailable.",
          }));
        }
        return null;
      }
    },
    [request],
  );
  const open = useCallback(
    async (id: string) => {
      const retry = () => open(id);
      if (!eligibleRef.current) return null;
      const generation = ++actionGeneration.current;
      retryRef.current = retry;
      setState((current) => ({ ...current, status: "loading", error: null }));
      try {
        const row = await request<{ payload: DraftProReport }>(
          `/api/v1/account/draft-pro/reports/${id}`,
          undefined,
          generation,
          "action",
        );
        if (!eligibleRef.current || generation !== actionGeneration.current)
          return null;
        retryRef.current = null;
        setState((current) => ({
          ...current,
          report: row.payload,
          status: "idle",
        }));
        return row.payload;
      } catch (cause) {
        if (
          mounted.current &&
          generation === actionGeneration.current &&
          (cause as Error).name !== "AbortError"
        ) {
          retryRef.current = retry;
          setState((current) => ({
            ...current,
            status: "error",
            error:
              cause instanceof Error ? cause.message : "Could not open report.",
          }));
        }
        return null;
      }
    },
    [request],
  );
  const retry = useCallback(
    () => retryRef.current?.() ?? Promise.resolve(null),
    [],
  );
  useEffect(() => {
    eligibleRef.current = eligible;
    contextRef.current = contextFingerprint;
    cancelAction();
    retryRef.current = null;
    setState((current) => ({
      ...current,
      report: null,
      status: "idle",
      error: null,
    }));
  }, [cancelAction, contextFingerprint, eligible]);
  useEffect(() => {
    mounted.current = true;
    let active = true;
    const initial = accountGeneration.current;
    void supabase.auth.getSession().then(({ data }) => {
      if (!active || initial !== accountGeneration.current) return;
      accountId.current = data.session?.user?.id ?? null;
      if (accountId.current) void list();
    });
    const subscription = supabase.auth.onAuthStateChange?.(
      (_event, session) => {
        if (!active) return;
        const next = session?.user?.id ?? null;
        if (next === accountId.current) return;
        accountId.current = next;
        accountGeneration.current += 1;
        cancelAction();
        cancelList();
        retryRef.current = null;
        setState({
          saved: [],
          report: null,
          status: "idle",
          error: null,
          listLoading: false,
          listError: null,
        });
        if (next) void list();
      },
    ).data.subscription;
    return () => {
      active = false;
      mounted.current = false;
      accountGeneration.current += 1;
      cancelAction();
      cancelList();
      subscription?.unsubscribe();
    };
  }, [cancelAction, cancelList, list]);
  return { ...state, list, generate, open, retry };
}
