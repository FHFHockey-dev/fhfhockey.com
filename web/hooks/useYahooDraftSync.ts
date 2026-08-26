import { useCallback, useEffect, useRef, useState } from "react";

import {
  normalizeYahooDraftListResponse,
  normalizeYahooDraftStateResponse,
  yahooUnsupportedLeagueMessage,
  type YahooDraftLeague,
  type YahooDraftRankingOption,
  type YahooDraftState,
} from "lib/draftDashboard/yahooLiveDraft";
import supabase from "lib/supabase/client";

const ACTIVE_RECONCILIATION_MS = 30_000;
const BACKGROUND_RECONCILIATION_MS = 120_000;

export function getYahooDraftPollIntervalMs(args: {
  status: string;
  providerStatus?: string | null;
  visible: boolean;
}): number | null {
  if (["stopped", "complete", "reauth_required", "error"].includes(args.status)) {
    return null;
  }
  return args.visible && args.status === "active"
    ? ACTIVE_RECONCILIATION_MS
    : BACKGROUND_RECONCILIATION_MS;
}

type RequestState = "idle" | "loading" | "ready" | "error";

export interface UseYahooDraftSyncResult {
  enabled: boolean;
  leagues: YahooDraftLeague[];
  ranking: YahooDraftRankingOption | null;
  selectedLeagueId: string;
  sessionId: string | null;
  draftState: YahooDraftState | null;
  requestState: RequestState;
  error: string | null;
  terminalSessionMissing: boolean;
  isConnected: boolean;
  isPolling: boolean;
  setSelectedLeagueId: (leagueId: string) => void;
  connect: () => Promise<void>;
  refreshAccount: () => Promise<void>;
  refreshDraft: () => Promise<void>;
  start: (externalLeagueId?: string) => Promise<boolean>;
  stop: () => Promise<YahooDraftState | null>;
  resumeSession: (sessionId: string, externalLeagueId?: string | null) => void;
  clearSession: () => void;
}

type ApiErrorBody = { error?: unknown; message?: unknown };

function errorMessage(body: unknown, fallback: string): string {
  if (body && typeof body === "object") {
    const candidate = body as ApiErrorBody;
    if (typeof candidate.error === "string" && candidate.error) {
      return candidate.error;
    }
    if (typeof candidate.message === "string" && candidate.message) {
      return candidate.message;
    }
    if (
      candidate.error &&
      typeof candidate.error === "object" &&
      "message" in candidate.error &&
      typeof candidate.error.message === "string"
    ) {
      return candidate.error.message;
    }
  }
  return fallback;
}

function apiErrorCode(body: unknown): string | null {
  if (!body || typeof body !== "object") return null;
  const candidate = body as {
    code?: unknown;
    error?: { code?: unknown } | unknown;
  };
  if (typeof candidate.code === "string") return candidate.code;
  if (
    candidate.error &&
    typeof candidate.error === "object" &&
    "code" in candidate.error &&
    typeof candidate.error.code === "string"
  ) {
    return candidate.error.code;
  }
  return null;
}

async function requestJson(
  url: string,
  init?: RequestInit,
): Promise<{ response: Response; body: unknown }> {
  const { data, error } = await supabase.auth.getSession();
  if (error || !data.session?.access_token) {
    throw new Error("Sign in to connect Yahoo Fantasy.");
  }
  const response = await fetch(url, {
    ...init,
    headers: {
      Accept: "application/json",
      Authorization: `Bearer ${data.session.access_token}`,
      ...(init?.body ? { "Content-Type": "application/json" } : {}),
      ...(init?.headers || {}),
    },
  });
  const body = await response.json().catch(() => null);
  return { response, body };
}

function draftStateUrl(sessionId: string): string {
  return `/api/v1/account/yahoo/draft-sessions/${encodeURIComponent(sessionId)}`;
}

export function useYahooDraftSync(
  authenticated = true,
): UseYahooDraftSyncResult {
  const [enabled, setEnabled] = useState(false);
  const [leagues, setLeagues] = useState<YahooDraftLeague[]>([]);
  const [ranking, setRanking] = useState<YahooDraftRankingOption | null>(null);
  const [selectedLeagueId, setSelectedLeagueId] = useState("");
  const [sessionId, setSessionId] = useState<string | null>(null);
  const [draftState, setDraftState] = useState<YahooDraftState | null>(null);
  const [requestState, setRequestState] = useState<RequestState>("idle");
  const [error, setError] = useState<string | null>(null);
  const [terminalSessionMissing, setTerminalSessionMissing] = useState(false);
  const [isPolling, setIsPolling] = useState(false);
  const [isVisible, setIsVisible] = useState(true);
  const stateRequestRef = useRef<Promise<void> | null>(null);
  const stateRequestQueuedRef = useRef(false);
  const pollRequestRef = useRef<Promise<void> | null>(null);

  const loadSessionState = useCallback(async (id: string) => {
    if (stateRequestRef.current) {
      stateRequestQueuedRef.current = true;
      return stateRequestRef.current;
    }
    const request = (async () => {
      do {
        stateRequestQueuedRef.current = false;
        try {
          const { response, body } = await requestJson(draftStateUrl(id));
          if (!response.ok) {
            if (response.status === 404) {
              setSessionId(null);
              setDraftState(null);
              setTerminalSessionMissing(true);
            }
            throw new Error(
              errorMessage(body, "Yahoo draft state could not be refreshed."),
            );
          }
          const next = normalizeYahooDraftStateResponse(body);
          if (!next) throw new Error("Yahoo returned an invalid draft snapshot.");
          setDraftState(next);
          setSessionId(next.session.id);
          setError(null);
          setTerminalSessionMissing(false);
          setRequestState("ready");
        } catch (caught) {
          setError(
            caught instanceof Error
              ? caught.message
              : "Yahoo draft state could not be refreshed.",
          );
          setRequestState("error");
        }
      } while (stateRequestQueuedRef.current);
      stateRequestRef.current = null;
    })();
    stateRequestRef.current = request;
    return request;
  }, []);

  const loadList = useCallback(async () => {
    setRequestState((current) => (current === "idle" ? "loading" : current));
    try {
      const { response, body } = await requestJson(
        "/api/v1/account/yahoo/draft-sessions",
      );
      if (!response.ok) {
        // Signed-out and disabled deployments both stay inaccessible.
        if (
          response.status === 401 ||
          response.status === 403 ||
          response.status === 404 ||
          (response.status === 503 &&
            apiErrorCode(body) === "yahoo_live_draft_disabled")
        ) {
          setEnabled(false);
          setLeagues([]);
          setRequestState("ready");
          return;
        }
        throw new Error(
          errorMessage(body, "Yahoo draft companion could not be loaded."),
        );
      }
      const normalized = normalizeYahooDraftListResponse(body);
      setEnabled(normalized.enabled);
      setLeagues(normalized.enabled ? normalized.leagues : []);
      setRanking(normalized.enabled ? normalized.ranking : null);
      setSelectedLeagueId((current) =>
        normalized.leagues.some((league) => league.externalLeagueId === current)
          ? current
          : normalized.leagues[0]?.externalLeagueId || "",
      );
      setError(null);
      setRequestState("ready");
    } catch (caught) {
      setEnabled(false);
      setError(
        caught instanceof Error
          ? caught.message
          : "Yahoo draft companion could not be loaded.",
      );
      setRequestState("error");
    }
  }, []);

  useEffect(() => {
    if (!authenticated) {
      setEnabled(false);
      setLeagues([]);
      setRequestState("idle");
      return;
    }
    void loadList();
  }, [authenticated, loadList]);

  const connect = useCallback(async () => {
    setError(null);
    try {
      const { response, body } = await requestJson(
        "/api/v1/account/yahoo/connect",
        {
          method: "POST",
          body: JSON.stringify({ next: "/draft-dashboard" }),
        },
      );
      if (!response.ok) {
        throw new Error(errorMessage(body, "Yahoo connection could not start."));
      }
      const authorizationUrl =
        body && typeof body === "object"
          ? (body as { authorizationUrl?: unknown }).authorizationUrl
          : null;
      if (typeof authorizationUrl !== "string" || !authorizationUrl) {
        throw new Error("Yahoo did not return an authorization URL.");
      }
      window.location.assign(authorizationUrl);
    } catch (caught) {
      setError(
        caught instanceof Error
          ? caught.message
          : "Yahoo connection could not start.",
      );
    }
  }, []);

  const refreshAccount = useCallback(async () => {
    setRequestState("loading");
    setError(null);
    try {
      const { response, body } = await requestJson(
        "/api/v1/account/yahoo/refresh",
        { method: "POST" },
      );
      if (!response.ok) {
        throw new Error(errorMessage(body, "Yahoo leagues could not be refreshed."));
      }
      await loadList();
    } catch (caught) {
      setError(
        caught instanceof Error
          ? caught.message
          : "Yahoo leagues could not be refreshed.",
      );
      setRequestState("error");
    }
  }, [loadList]);

  const start = useCallback(
    async (externalLeagueId = selectedLeagueId) => {
      if (!externalLeagueId) {
        setError("Choose a Yahoo league before starting live sync.");
        return false;
      }
      const selectedLeague = leagues.find(
        (league) => league.externalLeagueId === externalLeagueId,
      );
      if (selectedLeague?.supported === false) {
        setError(yahooUnsupportedLeagueMessage(selectedLeague.unsupportedReason));
        return false;
      }
      setRequestState("loading");
      setError(null);
      const existingSession = selectedLeague?.session;
      if (
        existingSession &&
        ["active", "predraft", "complete"].includes(existingSession.status)
      ) {
        setSelectedLeagueId(externalLeagueId);
        setSessionId(existingSession.id);
        setTerminalSessionMissing(false);
        return true;
      }
      try {
        const { response, body } = await requestJson(
          "/api/v1/account/yahoo/draft-sessions",
          {
            method: "POST",
            body: JSON.stringify({
              externalLeagueId,
              ...(ranking?.id ? { draftRankingId: ranking.id } : {}),
            }),
          },
        );
        if (!response.ok) {
          throw new Error(errorMessage(body, "Yahoo live sync could not start."));
        }
        const next = normalizeYahooDraftStateResponse(body);
        const returnedSession =
          body && typeof body === "object"
            ? (body as { session?: { id?: unknown } }).session
            : null;
        const nextSessionId =
          next?.session.id ||
          (typeof returnedSession?.id === "string" ? returnedSession.id : null);
        if (!nextSessionId) {
          throw new Error("Yahoo did not return a draft session.");
        }
        setSelectedLeagueId(externalLeagueId);
        setSessionId(nextSessionId);
        setTerminalSessionMissing(false);
        if (next) setDraftState(next);
        // The session effect subscribes before its authoritative GET so a pick
        // cannot land in the subscribe/fetch gap.
        return true;
      } catch (caught) {
        setError(
          caught instanceof Error
            ? caught.message
            : "Yahoo live sync could not start.",
        );
        setRequestState("error");
        return false;
      }
    },
    [leagues, ranking?.id, selectedLeagueId],
  );

  const refreshDraft = useCallback(async () => {
    if (!sessionId) return;
    if (pollRequestRef.current) return pollRequestRef.current;
    setIsPolling(true);
    const request = (async () => {
      try {
        const { response, body } = await requestJson(
          `${draftStateUrl(sessionId)}/poll`,
          { method: "POST" },
        );
        if (!response.ok) {
          throw new Error(errorMessage(body, "Yahoo draft poll failed."));
        }
        const next = normalizeYahooDraftStateResponse(body);
        if (next) {
          setDraftState(next);
          setError(null);
          setRequestState("ready");
        } else {
          await loadSessionState(sessionId);
        }
      } catch (caught) {
        setError(
          caught instanceof Error ? caught.message : "Yahoo draft poll failed.",
        );
        setRequestState("error");
      } finally {
        pollRequestRef.current = null;
        setIsPolling(false);
      }
    })();
    pollRequestRef.current = request;
    return request;
  }, [loadSessionState, sessionId]);

  const stop = useCallback(async () => {
    if (!sessionId) return null;
    setRequestState("loading");
    setError(null);
    try {
      const { response, body } = await requestJson(
        `${draftStateUrl(sessionId)}/stop`,
        { method: "POST" },
      );
      if (!response.ok) {
        throw new Error(errorMessage(body, "Yahoo live sync could not stop."));
      }
      const next = normalizeYahooDraftStateResponse(body);
      if (!next) {
        throw new Error("Yahoo did not return the final draft snapshot.");
      }
      setDraftState(next);
      setRequestState("ready");
      return next;
    } catch (caught) {
      setError(
        caught instanceof Error
          ? caught.message
          : "Yahoo live sync could not stop.",
      );
      setRequestState("error");
      throw caught;
    }
  }, [sessionId]);

  const resumeSession = useCallback(
    (id: string, externalLeagueId?: string | null) => {
      if (!id) return;
      if (externalLeagueId) setSelectedLeagueId(externalLeagueId);
      setSessionId(id);
      setTerminalSessionMissing(false);
      setRequestState("loading");
    },
    [],
  );

  const clearSession = useCallback(() => {
    setSessionId(null);
    setDraftState(null);
    setTerminalSessionMissing(false);
    setIsPolling(false);
  }, []);

  // Subscribe before the first resumed-session GET. Realtime invalidates; HTTP
  // remains the authoritative snapshot and handles missed/coalesced events.
  useEffect(() => {
    if (!enabled || !sessionId) return;
    let active = true;
    let initialFetchStarted = false;
    const invalidate = () => {
      if (active) void loadSessionState(sessionId);
    };
    const fetchInitialSnapshot = () => {
      if (!active || initialFetchStarted) return;
      initialFetchStarted = true;
      void loadSessionState(sessionId);
    };
    const fallbackTimer = window.setTimeout(fetchInitialSnapshot, 1_500);
    const channel = supabase
      .channel(`yahoo-draft-${sessionId}`)
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "yahoo_draft_sessions",
          filter: `id=eq.${sessionId}`,
        },
        invalidate,
      )
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "yahoo_draft_picks",
          filter: `session_id=eq.${sessionId}`,
        },
        invalidate,
      )
      .subscribe((status) => {
        if (
          status === "SUBSCRIBED" ||
          status === "CHANNEL_ERROR" ||
          status === "TIMED_OUT" ||
          status === "CLOSED"
        ) {
          fetchInitialSnapshot();
        }
      });

    return () => {
      active = false;
      window.clearTimeout(fallbackTimer);
      void supabase.removeChannel(channel);
    };
  }, [enabled, loadSessionState, sessionId]);

  useEffect(() => {
    if (!enabled || !sessionId || !draftState) return;
    const interval = getYahooDraftPollIntervalMs({
      status: draftState.session.status,
      providerStatus: draftState.session.providerStatus,
      visible: isVisible,
    });
    if (interval == null) return;
    // This is a low-rate authoritative GET fallback. The durable worker owns
    // provider cadence; Realtime remains the primary browser invalidation path.
    const timer = window.setInterval(
      () => void loadSessionState(sessionId),
      interval,
    );
    return () => window.clearInterval(timer);
  }, [draftState, enabled, isVisible, loadSessionState, sessionId]);

  useEffect(() => {
    if (!enabled || !sessionId) return;
    const reconcile = () => {
      if (!navigator.onLine) return;
      void loadSessionState(sessionId);
      // A nudge is lease- and rate-limit-aware and never performs provider I/O
      // in this request. It helps the worker prioritize a resumed browser.
      void refreshDraft();
    };
    const onVisibility = () => {
      const visible = document.visibilityState === "visible";
      setIsVisible(visible);
      if (visible) reconcile();
    };
    setIsVisible(document.visibilityState === "visible");
    window.addEventListener("online", reconcile);
    document.addEventListener("visibilitychange", onVisibility);
    return () => {
      window.removeEventListener("online", reconcile);
      document.removeEventListener("visibilitychange", onVisibility);
    };
  }, [enabled, loadSessionState, refreshDraft, sessionId]);

  return {
    enabled,
    leagues,
    ranking,
    selectedLeagueId,
    sessionId,
    draftState,
    requestState,
    error,
    terminalSessionMissing,
    isConnected: leagues.length > 0,
    isPolling,
    setSelectedLeagueId,
    connect,
    refreshAccount,
    refreshDraft,
    start,
    stop,
    resumeSession,
    clearSession,
  };
}
