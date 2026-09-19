import { withCronJobAudit } from "lib/cron/withCronJobAudit";
import { isValidNhlSeasonId } from "lib/NHL/server";
import { rosterSeasonForDate } from "lib/sources/playerIdentity";
import adminOnly from "utils/adminOnlyMiddleware";
import { fetchNhlRosterPreview, type Player } from "lib/sources/nhlRosterPreview";

export default withCronJobAudit(adminOnly(async function handler(req, res) {
  try {
    const { supabase } = req;
    const seasonId = req.query.seasonId == null ? rosterSeasonForDate() : Number(req.query.seasonId);
    if (!isValidNhlSeasonId(seasonId)) throw new Error("Invalid seasonId; expected consecutive YYYY years.");
    const dryRun = req.query.dryRun !== "false";
    if (!dryRun && seasonId !== rosterSeasonForDate()) {
      throw new Error("Historical roster refresh is dry-run only; current player memberships must be preserved.");
    }
    const players = await fetchNhlRosterPreview(seasonId);
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

    res.json({
      message: "Successfully updated the players & rosters tables.",
      success: true
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
