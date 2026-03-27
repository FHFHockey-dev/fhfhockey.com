import YahooFantasy from "yahoo-fantasy";

import serviceRoleClient from "lib/supabase/server";
import type { Database, Json } from "lib/supabase/database-generated.types";

import { YAHOO_GAME_CODE, YAHOO_PROVIDER, getYahooClientCredentials } from "./config";

type ConnectedAccountRow = Database["public"]["Tables"]["connected_accounts"]["Row"];
type ExternalLeagueRow = Database["public"]["Tables"]["external_leagues"]["Row"];
type ExternalTeamRow = Database["public"]["Tables"]["external_teams"]["Row"];
type UserProviderPreferencesRow =
  Database["public"]["Tables"]["user_provider_preferences"]["Row"];

type YahooDiscoverySummary = {
  leagueCount: number;
  teamCount: number;
  defaultExternalLeagueId: string | null;
  defaultExternalTeamId: string | null;
};

type YahooSyncOptions = {
  userId: string;
  connectedAccount: ConnectedAccountRow;
  accessToken: string;
  refreshToken: string;
  tokenType?: string | null;
  providerUserId?: string | null;
  redirectUri: string;
};

function flattenYahooLeagues(games: Array<any>) {
  return games.flatMap((game) =>
    Array.isArray(game?.leagues)
      ? game.leagues.map((league: any) => ({
          ...league,
          game_key: league.game_key || game.game_key || null,
          game_id: league.game_id || game.game_id || null,
          game_code: league.game_code || game.code || null,
          game_name: game.name || null,
        }))
      : []
  );
}

function flattenYahooTeams(games: Array<any>) {
  return games.flatMap((game) =>
    Array.isArray(game?.teams)
      ? game.teams.map((team: any) => ({
          ...team,
          game_key: team.game_key || game.game_key || null,
          game_id: team.game_id || game.game_id || null,
          game_code: team.game_code || game.code || null,
          game_name: game.name || null,
        }))
      : []
  );
}

function toJsonObject(value: Record<string, unknown>): Json {
  return value as Json;
}

function jsonObjectOrEmpty(value: Json) {
  return value && !Array.isArray(value) && typeof value === "object"
    ? (value as Record<string, unknown>)
    : {};
}

async function upsertConnectedAccountTokens(args: {
  connectedAccountId: string;
  userId: string;
  accessToken: string;
  refreshToken: string;
  tokenType?: string | null;
  providerUserId?: string | null;
}) {
  const { error } = await (serviceRoleClient as any).rpc(
    "upsert_connected_account_tokens_secure",
    {
      p_connected_account_id: args.connectedAccountId,
      p_user_id: args.userId,
      p_provider: YAHOO_PROVIDER,
      p_access_token: args.accessToken,
      p_refresh_token: args.refreshToken,
      p_token_type: args.tokenType ?? null,
      p_scopes: [],
      p_provider_user_id: args.providerUserId ?? null,
      p_secret_metadata: {
        provider: YAHOO_PROVIDER,
      },
    }
  );

  if (error) {
    throw new Error(`Failed to store Yahoo provider tokens: ${error.message}`);
  }
}

async function upsertYahooPreferences(args: {
  userId: string;
  connectedAccountId: string;
  defaultLeagueId: string | null;
  defaultTeamId: string | null;
  activeContext: Json;
}) {
  const { error } = await serviceRoleClient.from("user_provider_preferences").upsert(
    {
      user_id: args.userId,
      provider: YAHOO_PROVIDER,
      connected_account_id: args.connectedAccountId,
      default_external_league_id: args.defaultLeagueId,
      default_external_team_id: args.defaultTeamId,
      refresh_on_login: false,
      active_context: args.activeContext,
    },
    {
      onConflict: "user_id,provider",
    }
  );

  if (error) {
    throw new Error(`Failed to store Yahoo provider preferences: ${error.message}`);
  }

  const { error: settingsError } = await serviceRoleClient.from("user_settings").upsert(
    {
      user_id: args.userId,
      active_context: args.activeContext,
    },
    {
      onConflict: "user_id",
    }
  );

  if (settingsError) {
    throw new Error(`Failed to persist Yahoo active context: ${settingsError.message}`);
  }
}

export async function syncYahooDiscovery({
  userId,
  connectedAccount,
  accessToken,
  refreshToken,
  tokenType,
  providerUserId,
  redirectUri,
}: YahooSyncOptions): Promise<YahooDiscoverySummary> {
  const { clientId, clientSecret } = getYahooClientCredentials();
  const yahoo = new YahooFantasy(
    clientId,
    clientSecret,
    async ({
      access_token,
      refresh_token,
      token_type,
    }: {
      access_token: string;
      refresh_token: string;
      token_type?: string;
    }) => {
      await upsertConnectedAccountTokens({
        connectedAccountId: connectedAccount.id,
        userId,
        accessToken: access_token,
        refreshToken: refresh_token,
        tokenType: token_type ?? null,
        providerUserId: providerUserId ?? null,
      });
    },
    redirectUri
  );

  yahoo.setUserToken(accessToken);
  yahoo.setRefreshToken(refreshToken);

  await upsertConnectedAccountTokens({
    connectedAccountId: connectedAccount.id,
    userId,
    accessToken,
    refreshToken,
    tokenType: tokenType ?? null,
    providerUserId: providerUserId ?? null,
  });

  const userGamesResponse = await yahoo.user.games();
  const nhlGames = Array.isArray(userGamesResponse?.games)
    ? userGamesResponse.games.filter((game: any) => game.code === YAHOO_GAME_CODE)
    : [];
  const nhlGameKeys = nhlGames.map((game: any) =>
    String(game.game_key || game.game_id || YAHOO_GAME_CODE)
  );

  if (nhlGameKeys.length === 0) {
    const emptyContext = toJsonObject({
      provider: YAHOO_PROVIDER,
      source_type: "external-provider",
      external_league_id: null,
      external_team_id: null,
      external_league_key: null,
      external_team_key: null,
    });

    await upsertYahooPreferences({
      userId,
      connectedAccountId: connectedAccount.id,
      defaultLeagueId: null,
      defaultTeamId: null,
      activeContext: emptyContext,
    });

    const { error: accountError } = await serviceRoleClient
      .from("connected_accounts")
      .update({
        status: "connected",
        provider_user_id: providerUserId ?? null,
        account_label: "Yahoo Fantasy",
        last_synced_at: new Date().toISOString(),
        metadata: {
          ...jsonObjectOrEmpty(connectedAccount.metadata),
          provider_user_id: providerUserId ?? null,
          available_game_codes: [],
          discovery: {
            league_count: 0,
            team_count: 0,
          },
        },
      })
      .eq("id", connectedAccount.id);

    if (accountError) {
      throw new Error(`Failed to update Yahoo account metadata: ${accountError.message}`);
    }

    return {
      leagueCount: 0,
      teamCount: 0,
      defaultExternalLeagueId: null,
      defaultExternalTeamId: null,
    };
  }

  const [leagueGamesResponse, teamGamesResponse] = await Promise.all([
    yahoo.user.game_leagues(nhlGameKeys),
    yahoo.user.game_teams(nhlGameKeys),
  ]);

  const discoveredLeagues = flattenYahooLeagues(leagueGamesResponse?.games || []);
  const discoveredTeams = flattenYahooTeams(teamGamesResponse?.teams || teamGamesResponse?.games || []);

  const normalizedLeagues = [];
  for (const league of discoveredLeagues) {
    const settingsResponse = await yahoo.league.settings(league.league_key);
    normalizedLeagues.push({
      connected_account_id: connectedAccount.id,
      user_id: userId,
      provider: YAHOO_PROVIDER,
      external_league_key: league.league_key,
      league_name: league.name || null,
      season_key: String(league.season || league.game_key || ""),
      league_metadata: toJsonObject({
        ...league,
        settings_summary: {
          scoring_type: settingsResponse.scoring_type || league.scoring_type || null,
          num_teams: settingsResponse.num_teams || league.num_teams || null,
          draft_status: settingsResponse.draft_status || league.draft_status || null,
        },
      }),
      scoring_settings: toJsonObject({
        scoring_type: settingsResponse.scoring_type || league.scoring_type || null,
        stat_categories: settingsResponse.settings?.stat_categories || [],
        stat_modifiers: settingsResponse.settings?.stat_modifiers || [],
      }),
      roster_settings: toJsonObject({
        roster_positions: settingsResponse.settings?.roster_positions || [],
        weekly_deadline:
          settingsResponse.settings?.weekly_deadline ||
          settingsResponse.weekly_deadline ||
          league.weekly_deadline ||
          null,
        roster_type: settingsResponse.settings?.roster_type || null,
      }),
      imported_at: new Date().toISOString(),
    });
  }

  const leagueUpsertResponse = await serviceRoleClient
    .from("external_leagues")
    .upsert(normalizedLeagues, {
      onConflict: "connected_account_id,external_league_key",
    })
    .select("*");

  if (leagueUpsertResponse.error) {
    throw new Error(`Failed to persist Yahoo leagues: ${leagueUpsertResponse.error.message}`);
  }

  const leagueRows = (leagueUpsertResponse.data || []) as ExternalLeagueRow[];
  const leagueIdByKey = new Map(leagueRows.map((row) => [row.external_league_key, row]));

  const normalizedTeams = [];
  for (const team of discoveredTeams) {
    const matchingLeague = leagueIdByKey.get(String(team.league_key));
    if (!matchingLeague) {
      continue;
    }

    const rosterResponse = await yahoo.team.roster(team.team_key);

    normalizedTeams.push({
      connected_account_id: connectedAccount.id,
      external_league_id: matchingLeague.id,
      user_id: userId,
      provider: YAHOO_PROVIDER,
      external_team_key: team.team_key,
      team_name: team.name || null,
      team_metadata: toJsonObject({
        ...team,
        team_logo_url:
          Array.isArray(team.team_logos) && team.team_logos.length > 0
            ? team.team_logos[0]?.url || null
            : null,
      }),
      roster_snapshot: toJsonObject({
        players: rosterResponse?.roster || [],
      }),
      imported_at: new Date().toISOString(),
    });
  }

  const teamUpsertResponse = await serviceRoleClient
    .from("external_teams")
    .upsert(normalizedTeams, {
      onConflict: "external_league_id,external_team_key",
    })
    .select("*");

  if (teamUpsertResponse.error) {
    throw new Error(`Failed to persist Yahoo teams: ${teamUpsertResponse.error.message}`);
  }

  const teamRows = (teamUpsertResponse.data || []) as ExternalTeamRow[];

  const { data: existingPreferences, error: preferencesError } = await serviceRoleClient
    .from("user_provider_preferences")
    .select("*")
    .eq("user_id", userId)
    .eq("provider", YAHOO_PROVIDER)
    .maybeSingle();

  if (preferencesError) {
    throw new Error(`Failed to load Yahoo provider preferences: ${preferencesError.message}`);
  }

  const nextDefaultTeam =
    teamRows.find((team) => team.id === existingPreferences?.default_external_team_id) ||
    teamRows[0] ||
    null;
  const nextDefaultLeague =
    leagueRows.find((league) => league.id === existingPreferences?.default_external_league_id) ||
    (nextDefaultTeam
      ? leagueRows.find((league) => league.id === nextDefaultTeam.external_league_id) || null
      : leagueRows[0] || null);

  const activeContext = toJsonObject({
    provider: YAHOO_PROVIDER,
    source_type: "external-provider",
    external_league_id: nextDefaultLeague?.id || null,
    external_team_id: nextDefaultTeam?.id || null,
    external_league_key: nextDefaultLeague?.external_league_key || null,
    external_team_key: nextDefaultTeam?.external_team_key || null,
  });

  await upsertYahooPreferences({
    userId,
    connectedAccountId: connectedAccount.id,
    defaultLeagueId: nextDefaultLeague?.id || null,
    defaultTeamId: nextDefaultTeam?.id || null,
    activeContext,
  });

  if (normalizedTeams.length > 0) {
    const discoveredTeamKeys = normalizedTeams.map((team) => team.external_team_key);
    const teamFilter = `(${discoveredTeamKeys.map((key) => `"${key}"`).join(",")})`;
    await serviceRoleClient
      .from("external_teams")
      .delete()
      .eq("connected_account_id", connectedAccount.id)
      .not("external_team_key", "in", teamFilter);
  }

  if (normalizedLeagues.length > 0) {
    const discoveredLeagueKeys = normalizedLeagues.map((league) => league.external_league_key);
    const leagueFilter = `(${discoveredLeagueKeys.map((key) => `"${key}"`).join(",")})`;
    await serviceRoleClient
      .from("external_leagues")
      .delete()
      .eq("connected_account_id", connectedAccount.id)
      .not("external_league_key", "in", leagueFilter);
  }

  const accountLabel =
    nextDefaultTeam?.team_name ||
    nextDefaultLeague?.league_name ||
    "Yahoo Fantasy";

  const { error: accountError } = await serviceRoleClient
    .from("connected_accounts")
    .update({
      status: "connected",
      provider_user_id: providerUserId ?? null,
      account_label: accountLabel,
      last_synced_at: new Date().toISOString(),
      metadata: {
        ...jsonObjectOrEmpty(connectedAccount.metadata),
        provider_user_id: providerUserId ?? null,
        available_game_codes: nhlGames.map((game: any) => game.code),
        discovery: {
          league_count: leagueRows.length,
          team_count: teamRows.length,
        },
      },
    })
    .eq("id", connectedAccount.id);

  if (accountError) {
    throw new Error(`Failed to update Yahoo account record: ${accountError.message}`);
  }

  return {
    leagueCount: leagueRows.length,
    teamCount: teamRows.length,
    defaultExternalLeagueId: nextDefaultLeague?.id || null,
    defaultExternalTeamId: nextDefaultTeam?.id || null,
  };
}
