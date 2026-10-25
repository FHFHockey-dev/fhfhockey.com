import { createHash } from "node:crypto";
import type { SupabaseClient } from "@supabase/supabase-js";
import { assertYahooLeagueGameContext, resolveYahooGameContext } from "../integrations/yahoo/gameContext";
import { YahooLiveDraftError } from "../integrations/yahoo/liveDraft";
import type { YahooLiveDraftClient } from "../integrations/yahoo/liveDraftDatabase";
import { fetchYahooBoardResource } from "../integrations/yahoo/providerClient";
import { yahooFields } from "../integrations/yahoo/starterBoard";
import { YAHOO_UNIVERSE_PAGE_STARTS, yahooUniverseContext, yahooUniverseRequestUrls, type YahooUniverseReceipt, type YahooUniverseScope } from "./yahooUniverse";

/** v2 FORGE `universe` stage, provider half: three read-only Yahoo GETs through the existing provider client and
 * token manager (refresh included), after the same owned-team, league and game-context checks the RSO snapshot
 * makes. Only the three planned response bodies are retained; token traffic passes through unrecorded. */
export type YahooUniverseAllocation = YahooUniverseScope & { version: "forge-daily-yahoo-universe-allocation-v1"; userId: string; externalTeamId: string };
export const YAHOO_UNIVERSE_CAPTURE_LIMITS = Object.freeze({ requests: 3, bodyBytes: 1024 * 1024, totalBytes: 3 * 1024 * 1024, spacingMs: 1000 });
const fail = (reason: string): never => { throw new Error(reason); };
const uuid = /^[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}$/i;

export function validateYahooUniverseAllocation(value: any): YahooUniverseAllocation {
  if (!value || value.version !== "forge-daily-yahoo-universe-allocation-v1" || !uuid.test(value.userId ?? "") || !uuid.test(value.externalTeamId ?? "")) fail("invalid_allocation");
  yahooUniverseContext(value);
  return { version: value.version, userId: value.userId, externalTeamId: value.externalTeamId, leagueKey: value.leagueKey, teamKey: value.teamKey, seasonId: value.seasonId };
}

export async function captureYahooUniverseOriginals(args: { db: SupabaseClient<any>; allocation: YahooUniverseAllocation; date: string;
  event: (action: string, fields: Record<string, unknown>) => void; network?: typeof fetch; wait?: (ms: number) => Promise<void>; now?: () => Date }) {
  const { db, allocation, date } = args, network = args.network ?? fetch, now = args.now ?? (() => new Date());
  const wait = args.wait ?? ((ms: number) => new Promise<void>(resolve => setTimeout(resolve, ms)));
  const urls = yahooUniverseRequestUrls(allocation, date);
  const { data: team, error: teamError } = await db.from("external_teams").select("id,external_team_key,external_league_id,connected_account_id,team_metadata")
    .eq("id", allocation.externalTeamId).eq("user_id", allocation.userId).eq("provider", "yahoo").maybeSingle();
  if (teamError || !team || team.external_team_key !== allocation.teamKey || yahooFields(team.team_metadata).is_owned !== true) throw new Error("owned_team_unverified");
  const { data: league, error: leagueError } = await db.from("external_leagues").select("id,external_league_key,connected_account_id")
    .eq("id", team.external_league_id).eq("user_id", allocation.userId).eq("provider", "yahoo").maybeSingle();
  if (leagueError || !league || league.external_league_key !== allocation.leagueKey || league.connected_account_id !== team.connected_account_id) fail("league_unverified");
  const context = await resolveYahooGameContext(db as unknown as YahooLiveDraftClient);
  assertYahooLeagueGameContext(allocation.leagueKey, context);
  if (context.targetSeasonId !== allocation.seasonId) fail("season_context_mismatch");
  const retained = new Map<string, YahooUniverseReceipt>();
  let total = 0, teeFailure: string | null = null;
  const tee: typeof fetch = async (input, init) => {
    const url = typeof input === "string" ? input : input instanceof URL ? input.href : input.url;
    const response = await network(input, init);
    if (!urls.includes(url) || !response.ok) return response;
    const rawBody = await response.clone().text(), bytes = Buffer.byteLength(rawBody);
    total += bytes;
    // The provider client reports a throw here as unavailable; keep the actual reason for the ledger.
    if (bytes > YAHOO_UNIVERSE_CAPTURE_LIMITS.bodyBytes || total > YAHOO_UNIVERSE_CAPTURE_LIMITS.totalBytes) fail(teeFailure = "yahoo_body_bound");
    const responded = Date.parse(response.headers.get("date") ?? "");
    retained.set(url, { url, capturedAt: now().toISOString(), responseDate: Number.isFinite(responded) ? new Date(responded).toISOString() : null,
      bodySha256: createHash("sha256").update(rawBody, "utf8").digest("hex"), rawBody });
    return response;
  };
  const resources = [{ type: "roster" as const, teamKey: allocation.teamKey, date },
    ...YAHOO_UNIVERSE_PAGE_STARTS.map(start => ({ type: "available_players" as const, start }))];
  const receipts: YahooUniverseReceipt[] = [];
  for (const [index, resource] of resources.entries()) {
    if (index) await wait(YAHOO_UNIVERSE_CAPTURE_LIMITS.spacingMs);
    args.event("request_intent", { index: index + 1, url: urls[index] });
    try {
      const result = await fetchYahooBoardResource({ client: db as unknown as YahooLiveDraftClient, userId: allocation.userId,
        connectedAccountId: team.connected_account_id, context, leagueKey: allocation.leagueKey, format: "standard_json",
        fetchImpl: tee, now: now(), resource });
      const receipt = retained.get(urls[index]) ?? fail("yahoo_body_not_retained");
      args.event("response_completed", { index: index + 1, url: urls[index], httpStatus: result.transport.httpStatus,
        bytes: Buffer.byteLength(receipt.rawBody), sha256: receipt.bodySha256, responseDate: receipt.responseDate,
        tokenRefreshAttempted: result.transport.tokenRefreshAttempted, tokenRefreshOutcome: result.transport.tokenRefreshOutcome });
      receipts.push(receipt);
    } catch (error) {
      const reason = teeFailure ?? (error instanceof YahooLiveDraftError ? error.code : error instanceof Error ? error.message : "unknown");
      const retryAfterSeconds = error instanceof YahooLiveDraftError ? error.retryAfterSeconds : null;
      args.event("request_failed", { index: index + 1, url: urls[index], reason, retryAfterSeconds });
      return { receipts, failures: [{ url: urls[index], reason, retryAfterSeconds }], attempted: index + 1 };
    }
  }
  return { receipts, failures: [] as Array<{ url: string; reason: string; retryAfterSeconds: number | null }>, attempted: resources.length };
}
