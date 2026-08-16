import { useCallback, useEffect, useState } from "react";

import supabase from "lib/supabase/client";
import type { FantraxConnectionsResponse } from "lib/integrations/fantrax/contracts";

const EMPTY_CONNECTIONS: FantraxConnectionsResponse = {
  apiEnabled: false,
  accounts: [],
  defaultExternalLeagueId: null,
  defaultExternalTeamId: null,
};

export async function fantraxAccountRequest<T>(
  path: string,
  init: RequestInit = {},
): Promise<T> {
  const {
    data: { session },
  } = await supabase.auth.getSession();
  if (!session?.access_token) {
    throw new Error("Your session expired. Sign in again to use Fantrax.");
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
      typeof body.error === "string" ? body.error : "Fantrax request failed.",
    );
  }
  return body as T;
}

export function useFantraxConnections(enabled = true) {
  const [data, setData] = useState<FantraxConnectionsResponse>(EMPTY_CONNECTIONS);
  const [isLoading, setIsLoading] = useState(enabled);
  const [error, setError] = useState<string | null>(null);

  const reload = useCallback(async () => {
    if (!enabled) return EMPTY_CONNECTIONS;
    setIsLoading(true);
    setError(null);
    try {
      const response = await fantraxAccountRequest<
        Partial<FantraxConnectionsResponse>
      >(
        "/api/v1/account/fantrax/connections",
      );
      const next: FantraxConnectionsResponse = {
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
          : "Fantrax connections could not be loaded.";
      setError(message);
      throw requestError;
    } finally {
      setIsLoading(false);
    }
  }, [enabled]);

  useEffect(() => {
    let active = true;
    if (!enabled) {
      setIsLoading(false);
      return;
    }
    void reload().catch(() => {
      if (!active) return;
    });
    return () => {
      active = false;
    };
  }, [enabled, reload]);

  return { data, isLoading, error, reload };
}
