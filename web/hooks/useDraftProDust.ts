import { useEffect, useMemo, useState } from "react";

import { type DraftProDustInput, type DraftProDustResult } from "lib/draft-pro/dust";
import supabase from "lib/supabase/client";

export type UseDraftProDustState = {
  status: "idle" | "loading" | "ready" | "error";
  result: DraftProDustResult | null;
  error: string | null;
};

export const DRAFT_PRO_DUST_PRIVATE_IMPORT_SAVE_REQUIRED =
  "Save this private import to your account before using it for DUST.";

export type DraftProDustRequestInput = Omit<DraftProDustInput, "schedule"> & {
  gameKey: string;
  startWeek: number;
  endWeek: number;
};

/** Adapter only: debounce and abort stale premium calculations; it owns no formulas. */
export function useDraftProDust(input: DraftProDustRequestInput | null, enabled: boolean): UseDraftProDustState {
  const [state, setState] = useState<UseDraftProDustState>({ status: "idle", result: null, error: null });
  const privateImportSaveRequired = input?.inputOrigin === "private_import" && !input.privateImportAccountSaved;
  const body = useMemo(() => input && !privateImportSaveRequired ? JSON.stringify({
    season: input.season,
    lineupMode: input.lineupMode,
    sort: input.sort,
    inputOrigin: input.inputOrigin,
    privateImportAccountSaved: input.privateImportAccountSaved,
    gameKey: input.gameKey,
    startWeek: input.startWeek,
    endWeek: input.endWeek,
    roster: input.roster,
    candidates: input.candidates,
    rosterSlots: input.rosterSlots,
  }) : null, [input, privateImportSaveRequired]);

  useEffect(() => {
    if (privateImportSaveRequired) {
      setState({
        status: "error",
        result: null,
        error: DRAFT_PRO_DUST_PRIVATE_IMPORT_SAVE_REQUIRED,
      });
      return;
    }
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
  }, [body, enabled, privateImportSaveRequired]);
  return state;
}
