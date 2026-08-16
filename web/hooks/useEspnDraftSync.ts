import { useCallback, useEffect, useRef, useState } from "react";

import { espnAccountRequest } from "hooks/useEspnConnections";
import type {
  EspnConnectionLeague,
  EspnDraftState,
} from "lib/integrations/espn/contracts";
import { ESPN_DRAFT_POLL_INTERVAL_MS } from "lib/integrations/espn/config";

const SESSION_KEY = "fhfh:espn:draft-dashboard:live-session:v1";

type ListResponse = {
  enabled: boolean;
  leagues: EspnConnectionLeague[];
  sessions: Array<{
    id: string;
    externalLeagueId: string;
    status: string;
    providerStatus: string;
  }>;
};

function restoredSessionId() {
  if (typeof window === "undefined") return null;
  try {
    const raw = window.sessionStorage.getItem(SESSION_KEY);
    if (!raw) return null;
    const value = JSON.parse(raw) as { version?: unknown; sessionId?: unknown };
    return value.version === 1 && typeof value.sessionId === "string"
      ? value.sessionId
      : null;
  } catch {
    return null;
  }
}

function persistSession(sessionId: string | null) {
  if (typeof window === "undefined") return;
  if (!sessionId) {
    window.sessionStorage.removeItem(SESSION_KEY);
    return;
  }
  window.sessionStorage.setItem(
    SESSION_KEY,
    JSON.stringify({ version: 1, sessionId }),
  );
}

export function useEspnDraftSync(authenticated = true) {
  const [enabled, setEnabled] = useState(false);
  const [leagues, setLeagues] = useState<EspnConnectionLeague[]>([]);
  const [selectedLeagueId, setSelectedLeagueId] = useState("");
  const [sessionId, setSessionId] = useState<string | null>(restoredSessionId);
  const [draftState, setDraftState] = useState<EspnDraftState | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [isPolling, setIsPolling] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const pollPromiseRef = useRef<Promise<void> | null>(null);

  const loadState = useCallback(async (id: string) => {
    try {
      const next = await espnAccountRequest<EspnDraftState>(
        `/api/v1/account/espn/draft-sessions/${encodeURIComponent(id)}`,
      );
      setDraftState(next);
      setSessionId(next.session.id);
      setSelectedLeagueId(next.session.externalLeagueId);
      persistSession(next.session.id);
      setError(null);
      return next;
    } catch (requestError) {
      const message =
        requestError instanceof Error
          ? requestError.message
          : "ESPN draft state could not be loaded.";
      if (message.toLowerCase().includes("not found")) {
        setSessionId(null);
        setDraftState(null);
        persistSession(null);
      }
      setError(message);
      return null;
    }
  }, []);

  const loadList = useCallback(async () => {
    if (!authenticated) return;
    setIsLoading(true);
    try {
      const response = await espnAccountRequest<ListResponse>(
        "/api/v1/account/espn/draft-sessions",
      );
      setEnabled(response.enabled);
      setLeagues(response.enabled ? response.leagues : []);
      setSelectedLeagueId((current) =>
        response.leagues.some((league) => league.id === current)
          ? current
          : response.leagues.find((league) => league.isDefault)?.id ??
            response.leagues[0]?.id ??
            "",
      );
      setError(null);
    } catch (requestError) {
      setEnabled(false);
      setLeagues([]);
      setError(
        requestError instanceof Error
          ? requestError.message
          : "ESPN live draft could not be loaded.",
      );
    } finally {
      setIsLoading(false);
    }
  }, [authenticated]);

  useEffect(() => {
    if (!authenticated) {
      setEnabled(false);
      setLeagues([]);
      return;
    }
    void loadList();
  }, [authenticated, loadList]);

  useEffect(() => {
    if (!authenticated || !sessionId) return;
    void loadState(sessionId);
  }, [authenticated, loadState, sessionId]);

  const poll = useCallback(async () => {
    if (!sessionId) return;
    if (pollPromiseRef.current) return pollPromiseRef.current;
    setIsPolling(true);
    const request = (async () => {
      try {
        const next = await espnAccountRequest<EspnDraftState>(
          `/api/v1/account/espn/draft-sessions/${encodeURIComponent(sessionId)}/poll`,
          { method: "POST" },
        );
        setDraftState(next);
        setError(null);
      } catch (requestError) {
        setError(
          requestError instanceof Error
            ? requestError.message
            : "ESPN draft poll failed.",
        );
      } finally {
        setIsPolling(false);
        pollPromiseRef.current = null;
      }
    })();
    pollPromiseRef.current = request;
    return request;
  }, [sessionId]);

  useEffect(() => {
    const status = draftState?.session.status;
    if (!sessionId || (status !== "predraft" && status !== "active")) return;
    const timer = window.setInterval(() => {
      if (document.visibilityState === "visible") void poll();
    }, ESPN_DRAFT_POLL_INTERVAL_MS);
    return () => window.clearInterval(timer);
  }, [draftState?.session.status, poll, sessionId]);

  const start = useCallback(async () => {
    if (!selectedLeagueId) {
      setError("Choose an ESPN league before starting live sync.");
      return false;
    }
    const league = leagues.find((candidate) => candidate.id === selectedLeagueId);
    if (!league?.settings.liveDraftSupported) {
      setError("This ESPN league does not expose a supported ordered draft.");
      return false;
    }
    setIsLoading(true);
    setError(null);
    try {
      const team = league.teams.find((candidate) => candidate.isOwned) ?? league.teams[0];
      const next = await espnAccountRequest<EspnDraftState>(
        "/api/v1/account/espn/draft-sessions",
        {
          method: "POST",
          body: JSON.stringify({
            externalLeagueId: league.id,
            externalTeamId: team?.id ?? null,
          }),
        },
      );
      setDraftState(next);
      setSessionId(next.session.id);
      persistSession(next.session.id);
      return true;
    } catch (requestError) {
      setError(
        requestError instanceof Error
          ? requestError.message
          : "ESPN live draft could not start.",
      );
      return false;
    } finally {
      setIsLoading(false);
    }
  }, [leagues, selectedLeagueId]);

  const stop = useCallback(async () => {
    if (!sessionId) return null;
    setIsLoading(true);
    try {
      const next = await espnAccountRequest<EspnDraftState>(
        `/api/v1/account/espn/draft-sessions/${encodeURIComponent(sessionId)}/stop`,
        { method: "POST" },
      );
      setDraftState(next);
      setError(null);
      return next;
    } catch (requestError) {
      setError(
        requestError instanceof Error
          ? requestError.message
          : "ESPN live draft could not stop.",
      );
      return null;
    } finally {
      setIsLoading(false);
    }
  }, [sessionId]);

  const clear = useCallback(() => {
    setSessionId(null);
    setDraftState(null);
    persistSession(null);
  }, []);

  return {
    enabled,
    leagues,
    selectedLeagueId,
    sessionId,
    draftState,
    isLoading,
    isPolling,
    error,
    setSelectedLeagueId,
    reload: loadList,
    refresh: poll,
    start,
    stop,
    clear,
  };
}
