import type { PlanningSnapshot } from "lib/rosterScheduleOptimizer/planningTypes";
import { PLANNING_RESPONSE_BYTE_BUDGET, jsonUtf8Bytes } from "lib/rosterScheduleData/bridgeForecastWire";

/** Main-thread only. The port can request exactly one pre-bound endpoint read;
 * it cannot choose a URL, account/team/range, headers, or response body. Tokens
 * remain local to this function and never enter saved state or worker messages. */
export function yahooPlanningReadBroker(context: PlanningSnapshot["context"], principalId: string, controller: AbortController) {
  const bound = { ...context };
  const channel = new MessageChannel();
  let usedNonce: string | null = null, closed = false, unsubscribe: (() => void) | undefined;
  const readController = new AbortController();
  const close = () => { if (closed) return; closed = true; readController.abort(); unsubscribe?.(); channel.port1.close(); channel.port2.close(); };
  controller.signal.addEventListener("abort", close, { once: true });
  channel.port1.onmessage = async event => {
    const nonce = event.data?.nonce;
    if (usedNonce === nonce && event.data?.cancel === true) { readController.abort(); return; }
    if (usedNonce || closed || controller.signal.aborted || bound.provider !== "yahoo" || typeof nonce !== "string"
      || !/^[a-f0-9]{8}-[a-f0-9]{4}-4[a-f0-9]{3}-[89ab][a-f0-9]{3}-[a-f0-9]{12}$/i.test(nonce)) return;
    usedNonce = nonce;
    try {
      const { default: supabase } = await import("lib/supabase/client");
      if (closed || controller.signal.aborted) return;
      const subscription = supabase.auth.onAuthStateChange((_event, session) => {
        if (session?.user.id !== principalId) controller.abort();
      });
      unsubscribe = () => subscription.data.subscription.unsubscribe();
      if (closed || readController.signal.aborted) { unsubscribe(); return; }
      const session = (await supabase.auth.getSession()).data.session;
      if (!session?.access_token || session.user.id !== principalId || closed || readController.signal.aborted) throw new Error();
      const { seasonId, teamId, leagueId, startDate, endDate, timeZone } = bound;
      const response = await fetch("/api/v1/roster-schedule-optimizer/yahoo-current-data", {
        method: "POST", credentials: "same-origin", cache: "no-store", signal: readController.signal,
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${session.access_token}` },
        body: JSON.stringify({ seasonId, teamId, leagueId, startDate, endDate, timeZone, nonce }),
      });
      const body = await response.json();
      const current = (await supabase.auth.getSession()).data.session;
      if (current?.user.id !== principalId || jsonUtf8Bytes(body) > PLANNING_RESPONSE_BYTE_BUDGET) throw new Error();
      if (!closed && !controller.signal.aborted) channel.port1.postMessage({ nonce, ok: response.ok, body });
    } catch {
      if (!closed && !controller.signal.aborted) channel.port1.postMessage({ nonce, error: true });
    }
  };
  return { port: channel.port2, close: () => { controller.signal.removeEventListener("abort", close); close(); } };
}
