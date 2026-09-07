import { useCallback, useEffect, useRef, useState } from "react";

import type { DraftProAccess } from "lib/draft-pro/contracts";
import supabase from "lib/supabase/client";

export type DraftProAccessState = {
  status: "idle" | "loading" | "ready" | "error";
  access: DraftProAccess | null;
  error: string | null;
};

const EMPTY_STATE: DraftProAccessState = { status: "idle", access: null, error: null };

/** Server access is authoritative. This adapter fails closed between refreshes. */
export function useDraftProAccess() {
  const [state, setState] = useState<DraftProAccessState>(EMPTY_STATE);
  const controllerRef = useRef<AbortController | null>(null);
  const timerRef = useRef<number | null>(null);

  const clearPending = useCallback(() => {
    controllerRef.current?.abort();
    controllerRef.current = null;
    if (timerRef.current !== null) window.clearTimeout(timerRef.current);
    timerRef.current = null;
  }, []);

  const refresh = useCallback(async (token?: string | null) => {
    clearPending();
    const accessToken = token === undefined
      ? (await supabase.auth.getSession()).data.session?.access_token
      : token;
    if (!accessToken) {
      setState(EMPTY_STATE);
      return null;
    }
    const controller = new AbortController();
    controllerRef.current = controller;
    setState({ status: "loading", access: null, error: null });
    try {
      const response = await fetch("/api/v1/account/draft-pro", {
        headers: { Authorization: `Bearer ${accessToken}` },
        signal: controller.signal,
      });
      const body = await response.json().catch(() => null);
      if (!response.ok || !body?.data?.access) {
        throw new Error(body?.error?.message ?? "Draft Pro access is unavailable.");
      }
      if (controller.signal.aborted) return null;
      const access = body.data.access as DraftProAccess;
      setState({ status: "ready", access, error: null });
      const deadlines = [access.expiresAt, access.nextVerificationAt]
        .flatMap((value) => value ? [new Date(value).getTime()] : [])
        .filter((value) => Number.isFinite(value) && value > Date.now());
      if (deadlines.length) {
        timerRef.current = window.setTimeout(() => void refresh(accessToken), Math.max(1_000, Math.min(...deadlines) - Date.now() + 50));
      }
      return access;
    } catch (error) {
      if (controller.signal.aborted) return null;
      setState({ status: "error", access: null, error: error instanceof Error ? error.message : "Draft Pro access is unavailable." });
      return null;
    }
  }, [clearPending]);

  useEffect(() => {
    void refresh();
    const listener = () => void refresh();
    window.addEventListener("focus", listener);
    const subscription = supabase.auth.onAuthStateChange?.((_event, session) => {
      void refresh(session?.access_token ?? null);
    }).data.subscription;
    return () => {
      window.removeEventListener("focus", listener);
      subscription?.unsubscribe();
      clearPending();
    };
  }, [clearPending, refresh]);

  return { ...state, refresh };
}
