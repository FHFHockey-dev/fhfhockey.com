import { withCronJobAudit } from "lib/cron/withCronJobAudit";
import { getCurrentSeason } from "lib/NHL/server";
import adminOnly from "utils/adminOnlyMiddleware";

type RefreshRpcRow = {
  deleted_rows: number;
  inserted_rows: number;
};

function parsePositiveInteger(value: string | string[] | undefined): number | null {
  const rawValue = Array.isArray(value) ? value[0] : value;
  if (!rawValue) return null;
  const parsed = Number(rawValue);
  if (!Number.isFinite(parsed) || parsed <= 0) return null;
  return Math.floor(parsed);
}

function parseAction(value: string | string[] | undefined): "current" | "all" {
  const rawValue = Array.isArray(value) ? value[0] : value;
  return rawValue === "all" ? "all" : "current";
}

export default withCronJobAudit(
  adminOnly(async (req, res) => {
    const action = parseAction(req.query.action);
    const explicitSeasonId = parsePositiveInteger(req.query.seasonId);
    const playerId = parsePositiveInteger(req.query.playerId);
    const currentSeason = action === "current" ? await getCurrentSeason() : null;
    const seasonId =
      explicitSeasonId ??
      (action === "current" ? Number(currentSeason?.seasonId) : null);

    const { data, error } = await (req.supabase as any).rpc(
      "refresh_player_lineup_deployment_tallies",
      {
        p_season_id: seasonId,
        p_player_id: playerId
      }
    );

    if (error) {
      return res.status(500).json({
        success: false,
        message: "Failed to refresh player lineup deployment tallies.",
        error: error.message,
        requestedScope: {
          action,
          seasonId,
          playerId
        }
      });
    }

    const summary = ((data ?? []) as RefreshRpcRow[])[0] ?? {
      deleted_rows: 0,
      inserted_rows: 0
    };

    return res.json({
      success: true,
      message: `Refreshed ${summary.inserted_rows} lineup deployment tally row(s).`,
      deletedRows: summary.deleted_rows,
      insertedRows: summary.inserted_rows,
      requestedScope: {
        action,
        seasonId,
        playerId
      }
    });
  }),
  { jobName: "update-lineup-deployment-tallies" }
);
