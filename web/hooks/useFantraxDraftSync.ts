import { useCallback, useEffect, useRef, useState } from "react";

import { fantraxAccountRequest } from "hooks/useFantraxConnections";
import type { FantraxDraftState } from "lib/integrations/fantrax/contracts";

const SESSION_KEY = "fhfh:fantrax:draft-dashboard:live-session:v1";

function restoredSessionId() {
  if (typeof window === "undefined") return null;
  return window.sessionStorage.getItem(SESSION_KEY);
}

export function useFantraxDraftSync(authenticated: boolean) {
  const [enabled, setEnabled] = useState(false);
  const [eligible, setEligible] = useState(false);
  const [sessionId, setSessionId] = useState<string | null>(restoredSessionId);
  const [draftState, setDraftState] = useState<FantraxDraftState | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [isPolling, setIsPolling] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [retryAt, setRetryAt] = useState(0);
  const failures = useRef(0);
  const inFlight = useRef(false);

  const refreshAccess = useCallback(async () => {
    if (!authenticated) return;
    try {
      const result = await fantraxAccountRequest<{ enabled: boolean; eligible: boolean }>(
        "/api/v1/account/fantrax/draft-sessions",
      );
      setEnabled(result.enabled);
      setEligible(result.eligible);
    } catch {
      setEnabled(false);
      setEligible(false);
    }
  }, [authenticated]);

  useEffect(() => { void refreshAccess(); }, [refreshAccess]);

  useEffect(() => {
    if (authenticated) return;
    setEnabled(false);
    setEligible(false);
    setDraftState(null);
    setSessionId(null);
    if (typeof window !== "undefined") window.sessionStorage.removeItem(SESSION_KEY);
  }, [authenticated]);

  useEffect(() => {
    if (!authenticated || !sessionId) return;
    let mounted = true;
    void fantraxAccountRequest<FantraxDraftState>(
      `/api/v1/account/fantrax/draft-sessions/${encodeURIComponent(sessionId)}`,
    ).then((state) => { if (mounted) setDraftState(state); }).catch(() => {
      if (!mounted) return;
      setSessionId(null);
      setDraftState(null);
      window.sessionStorage.removeItem(SESSION_KEY);
    });
    return () => { mounted = false; };
  }, [authenticated, sessionId]);

  const start = useCallback(async (externalLeagueId: string, externalTeamId: string) => {
    setIsLoading(true);
    setError(null);
    try {
      const state = await fantraxAccountRequest<FantraxDraftState>(
        "/api/v1/account/fantrax/draft-sessions",
        { method: "POST", body: JSON.stringify({ externalLeagueId, externalTeamId }) },
      );
      setDraftState(state);
      setSessionId(state.session.id);
      window.sessionStorage.setItem(SESSION_KEY, state.session.id);
      failures.current = 0;
      return state;
    } catch (requestError) {
      setError(requestError instanceof Error ? requestError.message : "Fantrax live sync could not start.");
      return null;
    } finally {
      setIsLoading(false);
    }
  }, []);

  const poll = useCallback(async () => {
    if (!sessionId || inFlight.current || Date.now() < retryAt) return;
    inFlight.current = true;
    setIsPolling(true);
    try {
      const state = await fantraxAccountRequest<FantraxDraftState>(
        `/api/v1/account/fantrax/draft-sessions/${encodeURIComponent(sessionId)}/poll`,
        { method: "POST" },
      );
      setDraftState(state);
      setError(null);
      failures.current = 0;
    } catch (requestError) {
      failures.current += 1;
      setRetryAt(Date.now() + Math.min(300_000, 30_000 * 2 ** Math.min(4, failures.current)));
      setError(requestError instanceof Error ? requestError.message : "Fantrax draft update failed. Continue manually.");
      // A failed provider request cannot hold the local draft controls hostage.
      setDraftState((previous) => previous ? {
        ...previous, session: { ...previous.session, status: "error" },
      } : previous);
    } finally {
      inFlight.current = false;
      setIsPolling(false);
    }
  }, [retryAt, sessionId]);

  useEffect(() => {
    if (!eligible || draftState?.session.status !== "active" || !sessionId) return;
    const timer = window.setInterval(() => {
      if (document.visibilityState === "visible") void poll();
    }, 30_000);
    return () => window.clearInterval(timer);
  }, [draftState?.session.status, eligible, poll, sessionId]);

  const stop = useCallback(async () => {
    if (sessionId) {
      try {
        const state = await fantraxAccountRequest<FantraxDraftState>(
          `/api/v1/account/fantrax/draft-sessions/${encodeURIComponent(sessionId)}/stop`,
          { method: "POST" },
        );
        setDraftState(state);
      } catch {
        setDraftState((previous) => previous ? {
          ...previous, session: { ...previous.session, status: "stopped" },
        } : previous);
      }
    }
    setSessionId(null);
    window.sessionStorage.removeItem(SESSION_KEY);
  }, [sessionId]);

  return { enabled, eligible, draftState, isLoading, isPolling, error, start, poll, stop, refreshAccess };
}
