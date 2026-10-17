import { useEffect, useState } from "react";
import type { YahooEligibilityReceipt } from "lib/rosterScheduleOptimizer/yahooEligibility";
const reads = new Map<string, Promise<YahooEligibilityReceipt>>();
export const YAHOO_ELIGIBILITY_READ_LIMIT = 240;

async function readEligibility(season: number, ids: string[]): Promise<YahooEligibilityReceipt> {
  if (ids.length > YAHOO_ELIGIBILITY_READ_LIMIT) throw new Error("Stored Yahoo eligibility scope is too large.");
  const receipts: YahooEligibilityReceipt[] = [];
  for (let index = 0; index < ids.length; index += 60) {
    const batch = ids.slice(index, index + 60);
    const response = await fetch(`/api/v1/roster-schedule-optimizer/eligibility?seasonId=${season}&playerIds=${batch.join(",")}`);
    const body = await response.json();
    if (!response.ok || !body.success || body.receipt?.seasonId !== season || !Array.isArray(body.receipt.players)
      || body.receipt.source !== "yahoo_players" || body.receipt.scope !== "Yahoo default positions"
      || !["ready", "partial", "error"].includes(body.receipt.status) || !Array.isArray(body.receipt.limitations)
      || !Number.isFinite(Date.parse(body.receipt.expiresAt)) || Date.parse(body.receipt.expiresAt) <= Date.now()
      || receipts.length > 0 && body.receipt.expiresAt !== receipts[0].expiresAt
      || body.receipt.players.some((player: YahooEligibilityReceipt["players"][number]) => !player || !batch.includes(player.playerId))
      || new Set(body.receipt.players.map((player: YahooEligibilityReceipt["players"][number]) => player.playerId)).size !== body.receipt.players.length) {
      throw new Error("Stored Yahoo eligibility is unavailable.");
    }
    receipts.push(body.receipt);
  }
  return { ...receipts[0], players: receipts.flatMap(receipt => receipt.players),
    limitations: [...new Set(receipts.flatMap(receipt => receipt.limitations))],
    status: receipts.every(receipt => receipt.status === "ready") ? "ready"
      : receipts.every(receipt => receipt.status === "error") ? "error" : "partial" };
}

export function useYahooEligibility(seasonId: number, playerIds: string[], enabled: boolean, refreshRevision = 0) {
  const key = JSON.stringify([seasonId, [...new Set(playerIds)].sort()]);
  const [state, setState] = useState<{ key: string; receipt: YahooEligibilityReceipt | null; error: string | null } | null>(null);
  const [cycle, setCycle] = useState(0);
  useEffect(() => {
    if (!enabled || !playerIds.length) return;
    let cancelled = false;
    const [season, ids] = JSON.parse(key) as [number, string[]];
    let read = reads.get(key);
    if (!read) {
      read = readEligibility(season, ids);
      reads.set(key, read);
      const owned = read;
      void read.then(receipt => {
        if (receipt.status !== "ready") { if (reads.get(key) === owned) reads.delete(key); return; }
        const timer = setTimeout(() => { if (reads.get(key) === owned) reads.delete(key); }, Math.max(0, Date.parse(receipt.expiresAt) - Date.now()));
      }, () => { if (reads.get(key) === owned) reads.delete(key); });
    }
    void read.then(receipt => { if (!cancelled) setState({ key, receipt, error: null }); },
      () => { if (!cancelled) setState({ key, receipt: null, error: "Stored Yahoo positions unavailable; provider verification remains pending." }); });
    return () => { cancelled = true; };
  }, [key, enabled, playerIds.length, cycle, refreshRevision]);
  useEffect(() => {
    if (!enabled || state?.key !== key || !state.receipt) return;
    const timer = setTimeout(() => { reads.delete(key); setState(null); setCycle(value => value + 1); }, Math.max(0, Date.parse(state.receipt.expiresAt) - Date.now()));
    return () => clearTimeout(timer);
  }, [state, key, enabled]);
  const current = enabled && state?.key === key ? state : null;
  return { receipt: current?.receipt ?? null, error: current?.error ?? null, loading: enabled && playerIds.length > 0 && !current };
}
