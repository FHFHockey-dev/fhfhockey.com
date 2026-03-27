import type { NextApiRequest, NextApiResponse } from "next";

import serviceRoleClient from "lib/supabase/server";
import type { Database } from "lib/supabase/database-generated.types";
import { syncYahooDiscovery } from "lib/integrations/yahoo/discovery";
import {
  buildYahooAccountRedirect,
  buildYahooCallbackUrl,
  exchangeYahooAuthorizationCode,
  verifyYahooOAuthState,
} from "lib/integrations/yahoo/oauth";
import { YAHOO_PROVIDER } from "lib/integrations/yahoo/config";

type ConnectedAccountRow = Database["public"]["Tables"]["connected_accounts"]["Row"];

async function upsertYahooConnectedAccount(args: {
  userId: string;
  providerUserId?: string | null;
}): Promise<ConnectedAccountRow> {
  const { data: existingAccount, error: existingAccountError } = await serviceRoleClient
    .from("connected_accounts")
    .select("*")
    .eq("user_id", args.userId)
    .eq("provider", YAHOO_PROVIDER)
    .maybeSingle();

  if (existingAccountError) {
    throw new Error(`Failed to load existing Yahoo account row: ${existingAccountError.message}`);
  }

  if (existingAccount) {
    const { data, error } = await serviceRoleClient
      .from("connected_accounts")
      .update({
        status: "syncing",
        provider_user_id: args.providerUserId ?? existingAccount.provider_user_id,
        account_label: existingAccount.account_label || "Yahoo Fantasy",
        metadata: {
          ...((existingAccount.metadata || {}) as Record<string, unknown>),
          provider_user_id:
            args.providerUserId ?? existingAccount.provider_user_id ?? null,
        },
      })
      .eq("id", existingAccount.id)
      .select("*")
      .single();

    if (error || !data) {
      throw new Error(`Failed to update Yahoo account row: ${error?.message || "No data"}`);
    }

    return data;
  }

  const { data, error } = await serviceRoleClient
    .from("connected_accounts")
    .insert({
      user_id: args.userId,
      provider: YAHOO_PROVIDER,
      provider_user_id: args.providerUserId ?? null,
      account_label: "Yahoo Fantasy",
      status: "syncing",
      scopes: [],
      metadata: {
        provider_user_id: args.providerUserId ?? null,
      },
    })
    .select("*")
    .single();

  if (error || !data) {
    throw new Error(`Failed to create Yahoo account row: ${error?.message || "No data"}`);
  }

  return data;
}

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== "GET") {
    res.setHeader("Allow", "GET");
    return res.status(405).json({ error: "Method Not Allowed" });
  }

  let next = "/account?section=connected-accounts";

  try {
    const state = verifyYahooOAuthState(req.query.state);
    next = state.next;

    if (req.query.error) {
      const yahooError = Array.isArray(req.query.error)
        ? req.query.error[0]
        : req.query.error;
      return res.redirect(
        buildYahooAccountRedirect(next, "error", `Yahoo authorization failed: ${yahooError}`)
      );
    }

    const code = Array.isArray(req.query.code) ? req.query.code[0] : req.query.code;
    if (!code) {
      return res.redirect(
        buildYahooAccountRedirect(next, "error", "Yahoo did not return an authorization code.")
      );
    }

    const tokenResponse = await exchangeYahooAuthorizationCode(req, code);
    const connectedAccount = await upsertYahooConnectedAccount({
      userId: state.userId,
      providerUserId: tokenResponse.xoauth_yahoo_guid ?? null,
    });

    const summary = await syncYahooDiscovery({
      userId: state.userId,
      connectedAccount,
      accessToken: tokenResponse.access_token,
      refreshToken: tokenResponse.refresh_token,
      tokenType: tokenResponse.token_type ?? null,
      providerUserId: tokenResponse.xoauth_yahoo_guid ?? null,
      redirectUri: buildYahooCallbackUrl(req),
    });

    return res.redirect(
      buildYahooAccountRedirect(
        next,
        "connected",
        `Yahoo synced ${summary.teamCount} team${summary.teamCount === 1 ? "" : "s"} across ${summary.leagueCount} league${summary.leagueCount === 1 ? "" : "s"}.`
      )
    );
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Yahoo connection could not be completed.";
    return res.redirect(buildYahooAccountRedirect(next, "error", message));
  }
}
