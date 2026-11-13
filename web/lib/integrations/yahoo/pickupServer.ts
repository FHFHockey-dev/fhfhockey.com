import serviceRoleClient from "lib/supabase/server";
import { resolveYahooGameContext, assertYahooLeagueGameContext } from "./gameContext";
import { fetchYahooBoardResource } from "./providerClient";
import { YahooLiveDraftError } from "./liveDraft";
import { parseYahooPickupRosters, type YahooPickupContext } from "./pickup";

export async function loadYahooPickupContext(userId: string, client = serviceRoleClient): Promise<YahooPickupContext | null> {
  const [preferences, settings] = await Promise.all([
    client.from("user_provider_preferences").select("default_external_team_id").eq("user_id", userId).eq("provider", "yahoo").maybeSingle(),
    client.from("user_settings").select("active_context").eq("user_id", userId).maybeSingle(),
  ]);
  if (preferences.error || settings.error) throw new YahooLiveDraftError("Yahoo settings unavailable.", 503, "yahoo_pickup_settings_unavailable");
  const active = settings.data?.active_context;
  const selectedId = active && typeof active === "object" && !Array.isArray(active) && active.provider === "yahoo"
    ? active.external_team_id : preferences.data?.default_external_team_id;
  if (typeof selectedId !== "string" || !selectedId) return null;
  const { data: team, error } = await client.from("external_teams").select("*")
    .eq("id", selectedId).eq("user_id", userId).eq("provider", "yahoo").maybeSingle();
  if (error) throw new YahooLiveDraftError("Yahoo team unavailable.", 503, "yahoo_pickup_team_unavailable");
  const metadata = team?.team_metadata;
  if (!team || !metadata || typeof metadata !== "object" || Array.isArray(metadata) || metadata.is_owned !== true) {
    throw new YahooLiveDraftError("Select your Yahoo team in account settings.", 409, "yahoo_team_required");
  }
  const { data: league, error: leagueError } = await client.from("external_leagues").select("external_league_key,league_name,connected_account_id")
    .eq("id", team.external_league_id).eq("user_id", userId).eq("provider", "yahoo").maybeSingle();
  if (leagueError || !league || league.connected_account_id !== team.connected_account_id) throw new YahooLiveDraftError("Yahoo league unavailable.", 503, "yahoo_pickup_league_unavailable");
  const context = await resolveYahooGameContext(client);
  assertYahooLeagueGameContext(league.external_league_key, context);
  const result = await fetchYahooBoardResource({
    client, userId, connectedAccountId: team.connected_account_id, context,
    leagueKey: league.external_league_key, resource: { type: "league_rosters" }, format: "standard_json",
  });
  let rosters: ReturnType<typeof parseYahooPickupRosters>;
  try {
    rosters = parseYahooPickupRosters(result.payload, league.external_league_key, team.external_team_key);
  } catch {
    // Never expose the payload/identity details or treat an incomplete pool as empty.
    throw new YahooLiveDraftError("Yahoo roster response is incomplete or invalid.", 503, "yahoo_pickup_roster_invalid");
  }
  return {
    ...rosters,
    leagueName: league.league_name || league.external_league_key,
    teamName: team.team_name || team.external_team_key,
    gameKey: context.gameKey, season: Number(context.season), fetchedAt: new Date().toISOString(),
  };
}
