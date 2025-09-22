import type { NextApiRequest, NextApiResponse } from "next";

import supabase from "../../../../lib/supabase/server";
import type {
  PlayerSeries,
  RpcControlOptions,
  RpcPayload,
  RpcSeriesEntry,
  TimeSeriesPoint
} from "../../../../lib/trends/types";
import { callSkoPlayerSeries } from "../../../../lib/trends/rpc";
import {
  buildBaselineDensity,
  seasonIdToString,
  seasonStringToId
} from "../../../../lib/trends/utils";
import { buildMockPlayerSeries } from "../../../../lib/trends/mockData";

const DEFAULT_SEASON = "2024-25";

function parseIntegerParam(
  value: string | string[] | undefined,
  options: { min?: number; max?: number } = {}
): number | undefined {
  if (!value || Array.isArray(value)) {
    return undefined;
  }
  const parsed = Number.parseInt(value, 10);
  if (Number.isNaN(parsed)) {
    return undefined;
  }
  if (options.min !== undefined && parsed < options.min) {
    return options.min;
  }
  if (options.max !== undefined && parsed > options.max) {
    return options.max;
  }
  return parsed;
}

function parseNumericParam(
  value: string | string[] | undefined
): number | undefined {
  if (!value || Array.isArray(value)) {
    return undefined;
  }
  const parsed = Number.parseFloat(value);
  return Number.isNaN(parsed) ? undefined : parsed;
}

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse<PlayerSeries | { error: string }>
) {
  if (req.method !== "GET") {
    res.setHeader("Allow", "GET");
    res.status(405).json({ error: "Method not allowed" });
    return;
  }

  const { playerId } = req.query;
  if (!playerId || Array.isArray(playerId)) {
    res.status(400).json({ error: "playerId is required" });
    return;
  }

  const numericPlayerId = Number(playerId);
  if (Number.isNaN(numericPlayerId)) {
    res.status(400).json({ error: "playerId must be numeric" });
    return;
  }

  const seasonParam = req.query.season;
  const season =
    !seasonParam || Array.isArray(seasonParam) ? DEFAULT_SEASON : seasonParam;
  const seasonId = seasonStringToId(season);

  const playerIdString = String(playerId);

  const respondWithMock = (reason: string) => {
    console.warn(
      `[trends] ${reason}; serving mock payload for player ${playerIdString} (${season}).`
    );
    const mockSeries = buildMockPlayerSeries(playerIdString, season);
    res.status(200).json(mockSeries);
  };

  const span = parseIntegerParam(req.query.span, { min: 2, max: 20 });
  const lambdaHot = parseNumericParam(req.query.lambdaHot);
  const lambdaCold = parseNumericParam(req.query.lambdaCold);
  const lHot = parseIntegerParam(req.query.lHot, { min: 1, max: 10 });
  const lCold = parseIntegerParam(req.query.lCold, { min: 1, max: 10 });

  const rpcOptions: RpcControlOptions = {};
  if (span !== undefined) rpcOptions.span = span;
  if (lambdaHot !== undefined) rpcOptions.lambdaHot = lambdaHot;
  if (lambdaCold !== undefined) rpcOptions.lambdaCold = lambdaCold;
  if (lHot !== undefined) rpcOptions.lHot = lHot;
  if (lCold !== undefined) rpcOptions.lCold = lCold;

  const { data, error } = await callSkoPlayerSeries(
    supabase,
    numericPlayerId,
    rpcOptions
  );

  if (error) {
    console.error("rpc_sko_player_series error", error);
    respondWithMock(`Supabase RPC failed: ${error.message ?? "unknown error"}`);
    return;
  }

  if (!data) {
    respondWithMock("Supabase RPC returned null payload");
    return;
  }

  const rpcPayload = data as RpcPayload;

  const baselineMu = rpcPayload.baseline?.mu0 ?? 0;
  const baselineSigma = rpcPayload.baseline?.sigma0 ?? 0;
  const nTrain = rpcPayload.baseline?.n_train ?? 0;
  const density = buildBaselineDensity(baselineMu, baselineSigma);

  const rawSeries = (rpcPayload.series ?? []).filter(Boolean) as RpcSeriesEntry[];
  const filteredSeries =
    seasonId === null
      ? rawSeries
      : rawSeries.filter((entry) => entry.season_id === seasonId);

  const timeSeries = filteredSeries.map<TimeSeriesPoint>((entry) => {
    const streak =
      entry.hot_flag === 1 ? "hot" : entry.cold_flag === 1 ? "cold" : null;
    return {
      seasonId: entry.season_id,
      gameId: entry.game_id,
      date: entry.date,
      sko: entry.sko,
      skoRaw: entry.sko_raw,
      streak,
      ewma: entry.ewma,
      hotFlag: entry.hot_flag === 1,
      coldFlag: entry.cold_flag === 1,
      hotStreakId: entry.hot_streak_id,
      coldStreakId: entry.cold_streak_id,
      components: {
        shots_z: entry.features?.shots_z ?? null,
        ixg_z: entry.features?.ixg_z ?? null,
        ixg_per_60_z: entry.features?.ixg_per_60_z ?? null,
        toi_z: entry.features?.toi_z ?? null,
        pp_toi_z: entry.features?.pp_toi_z ?? null,
        oz_fo_pct_z: entry.features?.oz_fo_pct_z ?? null,
        onice_sh_pct_z: entry.features?.onice_sh_pct_z ?? null,
        shooting_pct_z: entry.features?.shooting_pct_z ?? null
      }
    };
  });

  const derivedSeason =
    seasonId !== null
      ? season
      : timeSeries.length > 0 && timeSeries[0].seasonId !== null
        ? seasonIdToString(timeSeries[0].seasonId as number)
        : season;

  const payload: PlayerSeries = {
    playerId: rpcPayload.player_id,
    playerName: rpcPayload.player_name,
    position: (rpcPayload.position_code === "D" ? "D" : "F") as "F" | "D",
    season: derivedSeason,
    baseline: {
      mu0: baselineMu,
      sigma0: baselineSigma,
      nTrain,
      density
    },
    timeSeries,
    isMock: false
  };

  res.status(200).json(payload);
}
