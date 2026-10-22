import { useCallback, useEffect, useRef, useState } from "react";

import supabase from "lib/supabase/client";

type AccessTiming = { eligible: boolean; expiresAt: string | null; nextVerificationAt?: string | null };
export type AccountAccessState<T> = {
  status: "idle" | "loading" | "ready" | "error";
  access: T | null;
  error: string | null;
};

const EMPTY_STATE: AccountAccessState<never> = { status: "idle", access: null, error: null };
const MAX_REFRESH_DELAY_MS = 24 * 60 * 60 * 1000;

/** Server access is authoritative. This adapter fails closed between refreshes. */
export function useAccountAccess<T extends AccessTiming>(endpoint: string) {
  const [state, setState] = useState<AccountAccessState<T>>(EMPTY_STATE);
  const controllerRef = useRef<AbortController | null>(null);
  const timerRef = useRef<number | null>(null);
  const epochRef = useRef(0);
  const mountedRef = useRef(false);

  const clearPending = useCallback(() => {
    controllerRef.current?.abort();
    controllerRef.current = null;
    if (timerRef.current !== null) window.clearTimeout(timerRef.current);
    timerRef.current = null;
  }, []);

  const refresh = useCallback(async (token?: string | null) => {
    clearPending();
    const epoch = ++epochRef.current;
    const controller = new AbortController();
    controllerRef.current = controller;
    const isCurrent = () => mountedRef.current && epoch === epochRef.current && !controller.signal.aborted;
    if (token === null) {
      setState(EMPTY_STATE);
      return null;
    }
    setState({ status: "loading", access: null, error: null });
    let accessToken = token;
    try {
      if (accessToken === undefined) {
        accessToken = (await supabase.auth.getSession()).data.session?.access_token;
      }
    } catch (error) {
      if (isCurrent()) setState({ status: "error", access: null, error: error instanceof Error ? error.message : "Premium access is unavailable." });
      return null;
    }
    if (!isCurrent()) return null;
    if (!accessToken) {
      setState(EMPTY_STATE);
      return null;
    }
    try {
      const response = await fetch(endpoint, {
        headers: { Authorization: `Bearer ${accessToken}` },
        signal: controller.signal,
      });
      const body = await response.json().catch(() => null);
      if (!isCurrent()) return null;
      if (response.status === 401) { setState(EMPTY_STATE); return null; }
      if (!response.ok || typeof body?.data?.access?.eligible !== "boolean") {
        throw new Error(body?.error?.message ?? "Premium access is unavailable.");
      }
      if (!isCurrent()) return null;
      const access = body.data.access as T;
      if (access.eligible && access.expiresAt !== null && (!Number.isFinite(Date.parse(access.expiresAt)) || Date.parse(access.expiresAt) <= Date.now())) throw new Error("Premium access has expired. Please check your access again.");
      setState({ status: "ready", access, error: null });
      const deadlines = [access.expiresAt, access.nextVerificationAt]
        .flatMap((value) => value ? [new Date(value).getTime()] : [])
        .filter((value) => Number.isFinite(value) && value > Date.now());
      if (deadlines.length) {
        const delay = Math.max(1, Math.min(MAX_REFRESH_DELAY_MS, Math.min(...deadlines) - Date.now()));
        timerRef.current = window.setTimeout(() => void refresh(), delay);
      }
      return access;
    } catch (error) {
      if (!isCurrent()) return null;
      setState({ status: "error", access: null, error: error instanceof Error ? error.message : "Premium access is unavailable." });
      return null;
    }
  }, [clearPending, endpoint]);

  useEffect(() => {
    mountedRef.current = true;
    void refresh();
    const listener = () => void refresh();
    window.addEventListener("focus", listener);
    const subscription = supabase.auth.onAuthStateChange?.((_event, session) => {
      void refresh(session?.access_token ?? null);
    }).data.subscription;
    return () => {
      mountedRef.current = false;
      epochRef.current += 1;
      window.removeEventListener("focus", listener);
      subscription?.unsubscribe();
      clearPending();
    };
  }, [clearPending, refresh]);

  return { ...state, refresh };
}
