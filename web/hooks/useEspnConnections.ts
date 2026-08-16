import { useCallback, useEffect, useState } from "react";

import supabase from "lib/supabase/client";
import type { EspnConnectionsResponse } from "lib/integrations/espn/contracts";

const EMPTY_CONNECTIONS: EspnConnectionsResponse = {
  apiEnabled: false,
  liveDraftEnabled: false,
  accounts: [],
  defaultExternalLeagueId: null,
  defaultExternalTeamId: null,
};

export async function espnAccountRequest<T>(
  path: string,
  init: RequestInit = {},
): Promise<T> {
  const {
    data: { session },
  } = await supabase.auth.getSession();
  if (!session?.access_token) {
    throw new Error("Your session expired. Sign in again to use ESPN Fantasy.");
  }
  const response = await fetch(path, {
    ...init,
    headers: {
      Authorization: `Bearer ${session.access_token}`,
      ...(init.body ? { "Content-Type": "application/json" } : {}),
      ...init.headers,
    },
  });
  const body = await response.json().catch(() => ({}));
  if (!response.ok) {
    throw new Error(
      typeof body.error === "string" ? body.error : "ESPN Fantasy request failed.",
    );
  }
  return body as T;
}

export function useEspnConnections(enabled = true) {
  const [data, setData] = useState<EspnConnectionsResponse>(EMPTY_CONNECTIONS);
  const [isLoading, setIsLoading] = useState(enabled);
  const [error, setError] = useState<string | null>(null);

  const reload = useCallback(async () => {
    if (!enabled) return EMPTY_CONNECTIONS;
    setIsLoading(true);
    setError(null);
    try {
      const response = await espnAccountRequest<Partial<EspnConnectionsResponse>>(
        "/api/v1/account/espn/connections",
      );
      const next: EspnConnectionsResponse = {
        ...EMPTY_CONNECTIONS,
        ...response,
        accounts: Array.isArray(response.accounts) ? response.accounts : [],
      };
      setData(next);
      return next;
    } catch (requestError) {
      const message =
        requestError instanceof Error
          ? requestError.message
          : "ESPN Fantasy connections could not be loaded.";
      setError(message);
      throw requestError;
    } finally {
      setIsLoading(false);
    }
  }, [enabled]);

  useEffect(() => {
    if (!enabled) {
      setIsLoading(false);
      return;
    }
    void reload().catch(() => undefined);
  }, [enabled, reload]);

  return { data, isLoading, error, reload };
}
