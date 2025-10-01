import { NextApiRequest, NextApiResponse } from "next";
import supabase from "lib/supabase";
import {
  buildBaselinePayload,
  computePPControls
} from "lib/baselines/aggregations";

// ----------------- Strict Types -----------------
type PositionCode = "C" | "LW" | "RW" | "D" | "G" | null;

interface PlayerStatsUnifiedRow {
  player_id: number; // int4
  date: string; // ISO yyyy-mm-dd
  season_id: number | null; // int4
  player_name: string | null;
  position_code: PositionCode;
  // Power play usage inputs we need
  pp_toi_pct_per_game: number | null;
}

interface PlayerTotalsUnifiedRow {
  player_id: number; // int4
  season_id: number | null; // int4
  player_name: string | null;
  position_code: PositionCode;
  // fields used for PP reference share
  pp_toi_pct_of_team: number | null;
  materialized_at: string;
}

interface BaselineWindows {
  // shape produced by buildBaselinePayload (trimmed for brevity; keep as your real return type)
  win_l3: Record<string, unknown>;
  win_l5: Record<string, unknown>;
  win_l10: Record<string, unknown>;
  win_l20: Record<string, unknown>;
  win_season_prev: unknown;
  win_3yr: Record<string, unknown>;
  win_career: Record<string, unknown>;
}

interface BaselineRecord {
  player_id: string;
  season_id: number | null;
  snapshot_date: string; // yyyy-mm-dd
  position_code: PositionCode;
  player_name: string | null;
  // windows
  win_l3: BaselineWindows["win_l3"];
  win_l5: BaselineWindows["win_l5"];
  win_l10: BaselineWindows["win_l10"];
  win_l20: BaselineWindows["win_l20"];
  win_season_prev: BaselineWindows["win_season_prev"];
  win_3yr: BaselineWindows["win_3yr"];
  win_career: BaselineWindows["win_career"];
  // PP controls
  pp_share_sm: number | null;
  pp_share_ref: number | null;
  pp_share_delta: number | null;
  pp_share_rel: number | null;
  pp1_flag: boolean;
  band_widen_factor: number | null;
  computed_at: string; // ISO timestamp
}

// -------------- Implementation -----------------
const BATCH_SIZE = 100;

// Supabase limits select pages to 1000 rows. Helper to fetch all pages by range
async function fetchAllFromView(
  table: string,
  select: string,
  applyBuilder?: (b: any) => any
) {
  const PAGE = 1000;
  let from = 0;
  const out: any[] = [];
  while (true) {
    const to = from + PAGE - 1;
    let q: any = (supabase as any).from(table).select(select).range(from, to);
    if (applyBuilder) q = applyBuilder(q);
    const { data, error } = await q;
    if (error) throw error;
    if (!data || data.length === 0) break;
    out.push(...data);
    if (data.length < PAGE) break;
    from += PAGE;
  }
  return out;
}

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse
) {
  const DRY_RUN =
    process.env.BASELINE_DRY_RUN === "true" ||
    (req.query && (req.query.dry === "1" || req.query.dry === "true"));

  const start = Date.now();

  try {
    console.log("Starting rebuild-baselines job");

    const sinceDate = new Date(Date.now() - 365 * 24 * 3600 * 1000)
      .toISOString()
      .slice(0, 10);

    // Only select what we need, keep types narrow. Paginate 1k pages until exhausted.
    const rawPlayers = (await fetchAllFromView(
      "player_stats_unified",
      "player_id, player_name, position_code",
      (q: any) => q.gte("date", sinceDate).not("player_id", "is", null)
    )) as any[];

    if (!rawPlayers || rawPlayers.length === 0) {
      return res
        .status(404)
        .json({ success: false, message: "No players found" });
    }

    const players = rawPlayers as Pick<
      PlayerStatsUnifiedRow,
      "player_id" | "player_name" | "position_code"
    >[];

    // Deduplicate on int key
    const uniquePlayers = new Map<
      number,
      { player_name: string | null; position_code: PositionCode }
    >();
    for (const p of players) {
      if (typeof p.player_id !== "number") continue;
      if (!uniquePlayers.has(p.player_id)) {
        uniquePlayers.set(p.player_id, {
          player_name: p.player_name ?? null,
          position_code: p.position_code ?? null
        });
      }
    }
    const playerIds = Array.from(uniquePlayers.keys()); // number[]

    let processed = 0;
    const allUpsertRecords: BaselineRecord[] = [];

    for (let i = 0; i < playerIds.length; i += BATCH_SIZE) {
      const batch = playerIds.slice(i, i + BATCH_SIZE);

      // Paginate game rows and totals rows to avoid 1k limit
      const gameRows = (await fetchAllFromView(
        "player_stats_unified",
        "*",
        (q: any) => q.in("player_id", batch).order("date", { ascending: false })
      )) as PlayerStatsUnifiedRow[];

      const totalsRows = (await fetchAllFromView(
        "player_totals_unified",
        "*",
        (q: any) => q.in("player_id", batch)
      )) as PlayerTotalsUnifiedRow[];

      // group rows
      const gamesByPlayer = new Map<number, PlayerStatsUnifiedRow[]>();
      (gameRows ?? []).forEach((g) => {
        const pid = g.player_id;
        const arr = gamesByPlayer.get(pid) ?? [];
        arr.push(g);
        gamesByPlayer.set(pid, arr);
      });

      const totalsByPlayer = new Map<number, PlayerTotalsUnifiedRow[]>();
      (totalsRows ?? []).forEach((t) => {
        const pid = t.player_id;
        const arr = totalsByPlayer.get(pid) ?? [];
        arr.push(t);
        totalsByPlayer.set(pid, arr);
      });

      const upsertRecords: BaselineRecord[] = [];
      const snapshot_date = new Date().toISOString().slice(0, 10);

      for (const pid of batch) {
        const meta = uniquePlayers.get(pid) ?? {
          player_name: null,
          position_code: null
        };
        const rows_all = gamesByPlayer.get(pid) ?? [];
        const seasonTotals = (totalsByPlayer.get(pid) ?? [])
          .slice()
          .sort((a, b) => (b.season_id ?? 0) - (a.season_id ?? 0));
        const lastSeason = seasonTotals[0] ?? null;

        // Build baselines (ensure your buildBaselinePayload accepts these types)
        const baseline = buildBaselinePayload({
          player_id: String(pid),
          season_id: lastSeason?.season_id ?? null,
          snapshot_date,
          position_code: meta.position_code,
          player_name: meta.player_name,
          rows_all,
          last_season_totals: lastSeason,
          seasonTotals
        }) as unknown as BaselineWindows;

        // PP controls
        const ppRefShare =
          lastSeason?.pp_toi_pct_of_team ??
          //   lastSeason?.pp_toi_pct_per_game ??
          0;

        const pp = computePPControls(rows_all, ppRefShare);

        const record: BaselineRecord = {
          player_id: String(pid),
          season_id: lastSeason?.season_id ?? null,
          snapshot_date,
          position_code: meta.position_code,
          player_name: meta.player_name,
          win_l3: baseline.win_l3,
          win_l5: baseline.win_l5,
          win_l10: baseline.win_l10,
          win_l20: baseline.win_l20,
          win_season_prev: baseline.win_season_prev,
          win_3yr: baseline.win_3yr,
          win_career: baseline.win_career,
          pp_share_sm: pp.pp_share_sm,
          pp_share_ref: pp.pp_share_ref,
          pp_share_delta: pp.pp_share_delta,
          pp_share_rel: pp.pp_share_rel,
          pp1_flag: !!pp.pp1_flag,
          band_widen_factor: pp.band_widen_factor,
          computed_at: new Date().toISOString()
        };

        upsertRecords.push(record);
      }

      if (upsertRecords.length > 0) {
        allUpsertRecords.push(...upsertRecords);
        if (!DRY_RUN) {
          const { error: upsertError } = await ((supabase as any)
            .from("player_baselines")
            .upsert(upsertRecords as any, {
              onConflict: "player_id,snapshot_date"
            }) as any);

          if (upsertError) {
            console.error(
              "Upsert error. Sample record:",
              JSON.stringify(upsertRecords[0], null, 2)
            );
            throw upsertError;
          }
        }
      }

      processed += batch.length;
    }

    const durationSec = ((Date.now() - start) / 1000).toFixed(2);
    console.log(
      `Rebuild completed: processed=${processed} duration_s=${durationSec} dry_run=${DRY_RUN}`
    );

    if (DRY_RUN) {
      return res.status(200).json({
        success: true,
        processed,
        duration: durationSec,
        dry_run: true,
        sample_records: allUpsertRecords.slice(0, 100)
      });
    }

    return res
      .status(200)
      .json({ success: true, processed, duration: durationSec });
  } catch (error: any) {
    console.error("Error building baselines:", error?.message || error);
    return res
      .status(500)
      .json({ success: false, message: error?.message || String(error) });
  }
}
