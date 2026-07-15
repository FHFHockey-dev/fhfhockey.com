import YahooFantasy from "yahoo-fantasy";
import type { SupabaseClient } from "@supabase/supabase-js";

import type { Database, Json } from "lib/supabase/database-generated.types";

import {
  YAHOO_PROVIDER,
  getYahooClientCredentials,
} from "./config";

const YAHOO_TEAM_ROSTER_CACHE_MS = 15 * 60 * 1000;

type ExternalTeamRow = Database["public"]["Tables"]["external_teams"]["Row"];

type YahooTokenRow = {
  access_token: string | null;
  refresh_token: string | null;
  token_type: string | null;
  provider_user_id: string | null;
};

type YahooRosterCache = {
  players: Json[];
  fetchedAt: string;
};

type YahooRosterFetchContext = {
  externalTeamKey: string;
  connectedAccountId: string;
  userId: string;
  redirectUri: string;
  accessToken: string;
  refreshToken: string;
  tokenType: string | null;
  providerUserId: string | null;
  client: SupabaseClient<Database>;
};

type LoadYahooTeamRosterOptions = {
  userId: string;
  externalTeamId: string;
  redirectUri: string;
  client?: SupabaseClient<Database>;
  now?: () => Date;
  cacheTtlMs?: number;
  fetchRoster?: (context: YahooRosterFetchContext) => Promise<Json[]>;
};

export type YahooTeamRosterResult = {
  externalTeamId: string;
  externalTeamKey: string;
  teamName: string | null;
  players: Json[];
  rosterSnapshot: Json;
  fetchedAt: string;
  cached: boolean;
};

export class YahooTeamRosterError extends Error {
  constructor(
    message: string,
    public readonly statusCode: number,
  ) {
    super(message);
    this.name = "YahooTeamRosterError";
  }
}

function isJsonObject(value: Json | null | undefined): value is Record<string, Json | undefined> {
  return Boolean(value) && !Array.isArray(value) && typeof value === "object";
}

function getJsonText(value: Json | undefined) {
  return typeof value === "string" ? value : null;
}

export function getCachedYahooTeamRoster(
  rosterSnapshot: Json | null | undefined,
  now: Date,
  cacheTtlMs = YAHOO_TEAM_ROSTER_CACHE_MS,
): YahooRosterCache | null {
  if (!isJsonObject(rosterSnapshot)) {
    return null;
  }

  const visibility = getJsonText(rosterSnapshot.visibility);
  const fetchedAt =
    getJsonText(rosterSnapshot.fetched_at) ||
    getJsonText(rosterSnapshot.cached_at);
  const players = Array.isArray(rosterSnapshot.players)
    ? rosterSnapshot.players
    : null;

  if (
    (visibility !== "league" && visibility !== "owned") ||
    !fetchedAt ||
    !players
  ) {
    return null;
  }

  const fetchedAtMs = new Date(fetchedAt).getTime();
  if (
    !Number.isFinite(fetchedAtMs) ||
    now.getTime() - fetchedAtMs < 0 ||
    now.getTime() - fetchedAtMs > cacheTtlMs
  ) {
    return null;
  }

  return { players, fetchedAt };
}

async function loadYahooTokens(
  client: SupabaseClient<Database>,
  connectedAccountId: string,
  userId: string,
) {
  const { data, error } = await (client as any).rpc(
    "get_connected_account_tokens_secure",
    {
      p_connected_account_id: connectedAccountId,
      p_user_id: userId,
    },
  );

  if (error) {
    throw new Error(`Failed to load Yahoo provider tokens: ${error.message}`);
  }

  const token = (Array.isArray(data) ? data[0] : data) as YahooTokenRow | null;
  if (!token?.access_token || !token.refresh_token) {
    throw new YahooTeamRosterError(
      "Yahoo tokens are unavailable. Reconnect Yahoo and try again.",
      409,
    );
  }

  return token;
}

async function persistYahooTokens(
  client: SupabaseClient<Database>,
  args: {
    connectedAccountId: string;
    userId: string;
    accessToken: string;
    refreshToken: string;
    tokenType?: string | null;
    providerUserId?: string | null;
  },
) {
  const { error } = await (client as any).rpc(
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
      p_secret_metadata: { provider: YAHOO_PROVIDER },
    },
  );

  if (error) {
    throw new Error(`Failed to store Yahoo provider tokens: ${error.message}`);
  }
}

async function fetchYahooRoster({
  externalTeamKey,
  connectedAccountId,
  userId,
  redirectUri,
  accessToken,
  refreshToken,
  providerUserId,
  client,
}: YahooRosterFetchContext) {
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
      await persistYahooTokens(client, {
        connectedAccountId,
        userId,
        accessToken: access_token,
        refreshToken: refresh_token,
        tokenType: token_type ?? null,
        providerUserId,
      });
    },
    redirectUri,
  );

  yahoo.setUserToken(accessToken);
  yahoo.setRefreshToken(refreshToken);

  const response = await yahoo.team.roster(externalTeamKey);
  return (Array.isArray(response?.roster) ? response.roster : []) as Json[];
}

export async function loadYahooTeamRoster({
  userId,
  externalTeamId,
  redirectUri,
  client,
  now = () => new Date(),
  cacheTtlMs = YAHOO_TEAM_ROSTER_CACHE_MS,
  fetchRoster = fetchYahooRoster,
}: LoadYahooTeamRosterOptions): Promise<YahooTeamRosterResult> {
  const resolvedClient =
    client ?? (await import("lib/supabase/server")).default;
  const { data: team, error: teamError } = await resolvedClient
    .from("external_teams")
    .select("*")
    .eq("id", externalTeamId)
    .eq("user_id", userId)
    .eq("provider", YAHOO_PROVIDER)
    .maybeSingle();

  if (teamError) {
    throw new Error(`Failed to load Yahoo team: ${teamError.message}`);
  }
  if (!team) {
    throw new YahooTeamRosterError("Yahoo team was not found.", 404);
  }

  const currentTime = now();
  const cachedRoster = getCachedYahooTeamRoster(
    team.roster_snapshot,
    currentTime,
    cacheTtlMs,
  );
  if (cachedRoster) {
    return {
      externalTeamId: team.id,
      externalTeamKey: team.external_team_key,
      teamName: team.team_name,
      players: cachedRoster.players,
      rosterSnapshot: team.roster_snapshot,
      fetchedAt: cachedRoster.fetchedAt,
      cached: true,
    };
  }

  const token = await loadYahooTokens(
    resolvedClient,
    team.connected_account_id,
    userId,
  );
  let players: Json[];
  try {
    players = await fetchRoster({
      externalTeamKey: team.external_team_key,
      connectedAccountId: team.connected_account_id,
      userId,
      redirectUri,
      accessToken: token.access_token as string,
      refreshToken: token.refresh_token as string,
      tokenType: token.token_type,
      providerUserId: token.provider_user_id,
      client: resolvedClient,
    });
  } catch (error) {
    throw new YahooTeamRosterError(
      error instanceof Error
        ? `Unable to load Yahoo team roster: ${error.message}`
        : "Unable to load Yahoo team roster.",
      502,
    );
  }

  const fetchedAt = currentTime.toISOString();
  const teamMetadata = isJsonObject(team.team_metadata)
    ? team.team_metadata
    : {};
  const rosterSnapshot = {
    players,
    visibility: teamMetadata.is_owned === true ? "owned" : "league",
    source: "on_demand",
    fetched_at: fetchedAt,
  } as Json;

  const { error: updateError } = await resolvedClient
    .from("external_teams")
    .update({
      roster_snapshot: rosterSnapshot,
      updated_at: fetchedAt,
    })
    .eq("id", team.id)
    .eq("user_id", userId);

  if (updateError) {
    throw new Error(`Failed to cache Yahoo team roster: ${updateError.message}`);
  }

  return {
    externalTeamId: team.id,
    externalTeamKey: team.external_team_key,
    teamName: team.team_name,
    players,
    rosterSnapshot,
    fetchedAt,
    cached: false,
  };
}
