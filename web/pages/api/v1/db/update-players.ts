/**
 * Update Players API Endpoint
 *
 * This endpoint fetches the latest NHL roster data and syncs it to the database.
 * Admin access required.
 *
 * Query Parameters:
 * - seasonId (optional): NHL season ID (format: YYYY where YYYY represents season start year)
 *   Default: current season
 * - dryRun (optional): Set to "false" to perform actual writes; default is true (dry-run mode)
 *   Note: Non-current season updates are always dry-run only
 *
 * URL Examples:
 *
 * 1. Dry-run for current season (preview changes):
 *    GET /api/v1/db/update-players
 *    or explicitly: /api/v1/db/update-players?dryRun=true
 *
 * 2. Dry-run for a specific past season (view what would be updated):
 *    GET /api/v1/db/update-players?seasonId=2023
 *
 * 3. Execute actual update for current season (writes to database):
 *    GET /api/v1/db/update-players?dryRun=false
 *
 * 4. Combine parameters:
 *    GET /api/v1/db/update-players?seasonId=2024&dryRun=true
 *
 * Response Examples:
 *
 * Dry-run success (200):
 * {
 *   "success": true,
 *   "dryRun": true,
 *   "seasonId": 2025,
 *   "playerCount": 850,
 *   "teams": ["VGK", "LAK", "SJS", ...],
 *   "players": [
 *     { "id": 8476346, "fullName": "Connor McDavid", "teamId": "EDM", "position": "C" },
 *     ...
 *   ]
 * }
 *
 * Live update success (200):
 * {
 *   "message": "Successfully updated the players & rosters tables.",
 *   "success": true,
 *   "canonicalSync": { "enabled": false }
 * }
 *
 * Error (400):
 * {
 *   "message": "Failed to update <error details>",
 *   "success": false
 * }
 */

import { withCronJobAudit } from "lib/cron/withCronJobAudit";
import { isValidNhlSeasonId } from "lib/NHL/server";
import { rosterSeasonForDate } from "lib/sources/playerIdentity";
import adminOnly from "utils/adminOnlyMiddleware";
import { fetchNhlRosterPreview, type Player } from "lib/sources/nhlRosterPreview";
import { syncCurrentCanonicalOrganizations } from "lib/sources/currentOrganizationSync";

export default adminOnly(withCronJobAudit(async function handler(req, res) {
  try {
    const { supabase } = req;
    const seasonId = req.query.seasonId == null ? rosterSeasonForDate() : Number(req.query.seasonId);
    if (!isValidNhlSeasonId(seasonId)) throw new Error("Invalid seasonId; expected consecutive YYYY years.");
    const dryRun = req.query.dryRun !== "false";
    if (!dryRun && seasonId !== rosterSeasonForDate()) {
      throw new Error("Historical roster refresh is dry-run only; current player memberships must be preserved.");
    }
    const players = await fetchNhlRosterPreview(seasonId,
      seasonId === rosterSeasonForDate() ? { rosterView: "current" } : { rosterView: "season" });
    const rosterObservedAt = new Date().toISOString();
    if (!players.length) throw new Error("No roster players returned; no writes performed.");
    if (dryRun) return res.json({ success: true, dryRun: true, seasonId,
      playerCount: players.length, teams: [...new Set(players.map((player) => player.teamId))],
      players: players.map(({ id, fullName, teamId, positionCode }) => ({ id, fullName, teamId, position: positionCode })),
    });
    console.log(`${players.length} players fetched from NHL.com `);
    console.log(`Updating the 'players' table.`);
    const { error: players_error } = await supabase.from("players").upsert(
      players.map((player) => ({
        id: player.id,
        firstName: player.firstName,
        lastName: player.lastName,
        fullName: player.fullName,
        position: player.positionCode,
        birthDate: player.birthDate,
        birthCity: player.birthCity,
        birthCountry: player.birthCountry,
        heightInCentimeters: player.height,
        weightInKilograms: player.weight,
        team_id: player.teamId,
        sweater_number: player.sweaterNumber,
        image_url: player.image
      }))
    );
    if (players_error) throw players_error;

    console.log(`Updating the 'rosters' table.`);
    await syncCurrentRosterMemberships({
      supabase,
      players,
      seasonId
    });

    // Enable only after the restricted RPC and this exact candidate are approved.
    const canonicalSync = process.env.CURRENT_CANONICAL_ROSTER_SYNC_ENABLED === "true"
      ? await syncCurrentCanonicalOrganizations(supabase, { seasonId, observedAt: rosterObservedAt, complete: true, players })
      : { enabled: false };

    res.json({
      message: "Successfully updated the players & rosters tables.",
      success: true,
      canonicalSync
    });
  } catch (e: any) {
    res.status(400).json({
      message: "Failed to update " + e.message,
      success: false
    });

    console.table(e);
  }
}));

const ROSTER_SYNC_BATCH_SIZE = 50;

async function syncCurrentRosterMemberships(args: {
  supabase: any;
  players: Player[];
  seasonId: number;
}) {
  const uniquePlayers = Array.from(
    new Map(args.players.map((player) => [player.id, player])).values()
  );

  for (let i = 0; i < uniquePlayers.length; i += ROSTER_SYNC_BATCH_SIZE) {
    const batch = uniquePlayers.slice(i, i + ROSTER_SYNC_BATCH_SIZE);
    const results = await Promise.all(
      batch.map((player) =>
        args.supabase.rpc("upsert_current_roster_membership", {
          _playerid: player.id,
          _seasonid: args.seasonId,
          _teamid: player.teamId,
          _sweater_number: player.sweaterNumber ?? 0
        })
      )
    );

    const firstError = results.find((result: { error?: any }) => result?.error)?.error;
    if (firstError) throw firstError;
  }
}
