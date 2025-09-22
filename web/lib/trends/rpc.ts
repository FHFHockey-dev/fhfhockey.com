import type { PostgrestError, SupabaseClient } from "@supabase/supabase-js";

import type { Database } from "../supabase/database-generated.types";
import type { RpcControlOptions, RpcPayload } from "./types";

export type RpcCallResult = {
  data: RpcPayload | null;
  error: PostgrestError | null;
};

export async function callSkoPlayerSeries(
  client: SupabaseClient<Database>,
  playerId: number,
  options: RpcControlOptions = {}
): Promise<RpcCallResult> {
  const rpcParams: Record<string, number> = {
    p_player_id: playerId
  };

  if (options.span !== undefined) {
    rpcParams.p_span = options.span;
  }
  if (options.lambdaHot !== undefined) {
    rpcParams.p_lambda_hot = options.lambdaHot;
  }
  if (options.lambdaCold !== undefined) {
    rpcParams.p_lambda_cold = options.lambdaCold;
  }
  if (options.lHot !== undefined) {
    rpcParams.p_l_hot = options.lHot;
  }
  if (options.lCold !== undefined) {
    rpcParams.p_l_cold = options.lCold;
  }

  // web/lib/trends/rpc.ts
  const { data, error } = await (client as any).rpc(
    "rpc_sko_player_series",
    rpcParams
  );

  return {
    data: (data as RpcPayload | null) ?? null,
    error
  };
}
