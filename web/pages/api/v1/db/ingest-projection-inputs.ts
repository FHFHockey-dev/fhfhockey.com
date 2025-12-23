import type { NextApiRequest, NextApiResponse } from "next";
import { withCronJobAudit } from "lib/cron/withCronJobAudit";
import supabase from "lib/supabase/server";

import { fetchPbpGame, upsertPbpGameAndPlays } from "lib/projections/ingest/pbp";
import { upsertShiftTotalsForGame } from "lib/projections/ingest/shifts";

type Result = {
  success: boolean;
  startDate: string;
  endDate: string;
  gamesProcessed: number;
  pbpGamesUpserted: number;
  pbpPlaysUpserted: number;
  shiftRowsUpserted: number;
  skipped: number;
  errors: Array<{ gameId: number; message: string }>;
};

function assertSupabase() {
  if (!supabase) throw new Error("Supabase server client not available");
}

function getParam(req: NextApiRequest, key: string): string | null {
  const v = req.query[key];
  if (typeof v === "string" && v.trim()) return v.trim();
  return null;
}

function isoDateOnly(d: string): string {
  return d.slice(0, 10);
}

async function hasPbp(gameId: number): Promise<boolean> {
  assertSupabase();
  const { data, error } = await supabase
    .from("pbp_games")
    .select("id")
    .eq("id", gameId)
    .maybeSingle();
  if (error) throw error;
  return Boolean(data?.id);
}

async function hasShiftTotals(gameId: number): Promise<boolean> {
  assertSupabase();
  const { count, error } = await supabase
    .from("shift_charts")
    .select("id", { count: "exact", head: true })
    .eq("game_id", gameId);
  if (error) throw error;
  return (count ?? 0) > 0;
}

async function listGamesInRange(startDate: string, endDate: string) {
  assertSupabase();
  const { data, error } = await supabase
    .from("games")
    .select("id,date")
    .gte("date", startDate)
    .lte("date", endDate)
    .order("date", { ascending: true });
  if (error) throw error;
  return (data ?? []) as Array<{ id: number; date: string }>;
}

async function handler(req: NextApiRequest, res: NextApiResponse<Result>) {
  if (req.method !== "POST" && req.method !== "GET") {
    res.setHeader("Allow", ["GET", "POST"]);
    return res.status(405).json({
      success: false,
      startDate: "",
      endDate: "",
      gamesProcessed: 0,
      pbpGamesUpserted: 0,
      pbpPlaysUpserted: 0,
      shiftRowsUpserted: 0,
      skipped: 0,
      errors: [{ gameId: -1 as any, message: "Method not allowed" }]
    });
  }

  const startDate = getParam(req, "startDate") ?? isoDateOnly(new Date().toISOString());
  const endDate = getParam(req, "endDate") ?? startDate;
  const force = (getParam(req, "force") ?? "false").toLowerCase() === "true";

  const games = await listGamesInRange(startDate, endDate);

  const result: Result = {
    success: true,
    startDate,
    endDate,
    gamesProcessed: 0,
    pbpGamesUpserted: 0,
    pbpPlaysUpserted: 0,
    shiftRowsUpserted: 0,
    skipped: 0,
    errors: []
  };

  for (const g of games) {
    try {
      const gameId = g.id;
      const pbpExists = force ? false : await hasPbp(gameId);
      const shiftsExist = force ? false : await hasShiftTotals(gameId);

      if (pbpExists && shiftsExist) {
        result.skipped += 1;
        continue;
      }

      let pbpPlaysUpserted = 0;
      if (!pbpExists) {
        const pbp = await fetchPbpGame(gameId);
        const up = await upsertPbpGameAndPlays(pbp);
        result.pbpGamesUpserted += 1;
        pbpPlaysUpserted = up.playsUpserted;
        result.pbpPlaysUpserted += pbpPlaysUpserted;
      }

      if (!shiftsExist) {
        const up = await upsertShiftTotalsForGame(gameId);
        result.shiftRowsUpserted += up.rowsUpserted;
      }

      result.gamesProcessed += 1;
    } catch (e) {
      result.success = false;
      result.errors.push({
        gameId: g.id,
        message: (e as any)?.message ?? String(e)
      });
    }
  }

  return res.status(200).json(result);
}

export default withCronJobAudit(handler, {
  jobName: "ingest-projection-inputs"
});

