import { useEffect, useMemo, useState } from "react";

import { type DraftProDustInput, type DraftProDustResult } from "lib/draft-pro/dust";
import supabase from "lib/supabase/client";

export type UseDraftProDustState = {
  status: "idle" | "loading" | "ready" | "error";
  result: DraftProDustResult | null;
  error: string | null;
};

export type DraftProDustRequestInput = Omit<DraftProDustInput, "schedule"> & {
  gameKey: string;
  startWeek: number;
  endWeek: number;
};

/** Adapter only: debounce and abort stale premium calculations; it owns no formulas. */
export function useDraftProDust(input: DraftProDustRequestInput | null, enabled: boolean): UseDraftProDustState {
  const [state, setState] = useState<UseDraftProDustState>({ status: "idle", result: null, error: null });
  const body = useMemo(() => input ? JSON.stringify({
    season: input.season,
    lineupMode: input.lineupMode,
    gameKey: input.gameKey,
    startWeek: input.startWeek,
    endWeek: input.endWeek,
    roster: input.roster,
    candidates: input.candidates,
    rosterSlots: input.rosterSlots,
  }) : null, [input]);

  useEffect(() => {
    if (!enabled || !body) {
      setState({ status: "idle", result: null, error: null });
      return;
    }
    const controller = new AbortController();
    const timer = window.setTimeout(() => {
      void (async () => {
        setState((current) => ({ ...current, status: "loading", error: null }));
        const { data } = await supabase.auth.getSession();
        if (!data.session?.access_token) throw new Error("Sign in to use DUST.");
        const response = await fetch("/api/v1/draft-pro/dust", {
          method: "POST",
          headers: { "Content-Type": "application/json", Authorization: `Bearer ${data.session.access_token}` },
          body,
          signal: controller.signal,
        });
        const payload = await response.json().catch(() => null);
        if (!response.ok || !payload?.success) throw new Error(payload?.error?.message ?? "DUST could not be calculated.");
        if (!controller.signal.aborted) setState({ status: "ready", result: payload.data as DraftProDustResult, error: null });
      })().catch((error: unknown) => {
        if (!controller.signal.aborted) setState({ status: "error", result: null, error: error instanceof Error ? error.message : "DUST could not be calculated." });
      });
    }, 200);
    return () => { controller.abort(); window.clearTimeout(timer); };
  }, [body, enabled]);
  return state;
}
