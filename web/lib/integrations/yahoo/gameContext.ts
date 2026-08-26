import serviceRoleClient from "lib/supabase/server";

import {
  getYahooLiveDraftSeasonConfig,
  YAHOO_GAME_CODE,
} from "./config";
import { YahooLiveDraftError } from "./liveDraft";
import type { YahooLiveDraftClient } from "./liveDraftDatabase";

export type YahooGameContext = {
  gameCode: typeof YAHOO_GAME_CODE;
  gameKey: string;
  season: string;
  targetSeasonId: number;
};

export async function resolveYahooGameContext(
  client: YahooLiveDraftClient = serviceRoleClient as unknown as YahooLiveDraftClient,
  environment: NodeJS.ProcessEnv = process.env,
): Promise<YahooGameContext> {
  const configured = getYahooLiveDraftSeasonConfig(environment);
  const { data, error } = await client
    .from("yahoo_game_keys")
    .select("game_id,game_key,code,season")
    .eq("code", YAHOO_GAME_CODE)
    .eq("season", Number(configured.season));

  if (error) {
    throw new YahooLiveDraftError(
      "Yahoo game context could not be loaded.",
      503,
      "yahoo_game_context_unavailable",
    );
  }
  if (!data || data.length !== 1) {
    throw new YahooLiveDraftError(
      "Yahoo game context is missing or ambiguous for the configured season.",
      503,
      "yahoo_game_context_mismatch",
    );
  }

  const row = data[0];
  const gameKey = String(row.game_key ?? row.game_id ?? "").trim();
  if (
    row.code !== YAHOO_GAME_CODE ||
    String(row.season) !== configured.season ||
    !/^\d+$/u.test(gameKey)
  ) {
    throw new YahooLiveDraftError(
      "Yahoo provider and canonical game context do not agree.",
      503,
      "yahoo_game_context_mismatch",
    );
  }

  return {
    gameCode: YAHOO_GAME_CODE,
    gameKey,
    season: configured.season,
    targetSeasonId: configured.targetSeasonId,
  };
}

export function yahooLeagueGameKey(leagueKey: string) {
  return leagueKey.match(/^(\d+)[.]l[.]\d+$/u)?.[1] ?? null;
}

export function assertYahooLeagueGameContext(
  leagueKey: string,
  context: YahooGameContext,
) {
  if (yahooLeagueGameKey(leagueKey) !== context.gameKey) {
    throw new YahooLiveDraftError(
      "This Yahoo league is not part of the configured NHL season.",
      409,
      "yahoo_game_mismatch",
    );
  }
  return leagueKey;
}
