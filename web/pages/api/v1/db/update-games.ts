import { withCronJobAudit } from "lib/cron/withCronJobAudit";
import { get } from "lib/NHL/base";
import { getCurrentSeason } from "lib/NHL/server";
import type { NextApiRequest, NextApiResponse } from "next";
import supabase from "lib/supabase/server";
import { fetchCurrentSeason } from "utils/fetchCurrentSeason";

import adminOnly from "utils/adminOnlyMiddleware";
import { createHash } from "node:crypto";
import { z } from "zod";

const boundedScheduleRequest = z.object({
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  gameIds: z.array(z.number().int().positive().safe()).min(1).max(16)
    .refine((ids) => new Set(ids).size === ids.length),
  dryRun: z.boolean().default(true),
  expectedPlanHash: z.string().regex(/^[a-f0-9]{64}$/).optional(),
}).strict();

function checkBoundedScheduleDate(date: string, now: number) {
  const parsed = Date.parse(`${date}T00:00:00Z`);
  const today = new Intl.DateTimeFormat("en-CA", { timeZone: "America/New_York", year: "numeric", month: "2-digit", day: "2-digit" }).format(now);
  if (!Number.isFinite(parsed) || new Date(parsed).toISOString().slice(0, 10) !== date
    || date < today || parsed > Date.parse(`${today}T00:00:00Z`) + 7 * 86_400_000) {
    throw new Error("Bounded schedule date must be today or within the next seven Eastern dates");
  }
}

const scheduledGame = z.object({
  id: z.number().int().positive().safe(), season: z.number().int().positive(),
  gameType: z.union([z.literal(1), z.literal(2), z.literal(3)]),
  startTimeUTC: z.string().datetime({ offset: true }),
  gameState: z.enum(["FUT", "PRE"]), gameScheduleState: z.literal("OK"),
  homeTeam: z.object({ id: z.number().int().positive() }),
  awayTeam: z.object({ id: z.number().int().positive() }),
});

/** Deterministic, insert-only plan from one official daily schedule response. */
export function prepareBoundedSchedule(source: unknown, input: unknown, now = Date.now()) {
  const request = boundedScheduleRequest.parse(input);
  checkBoundedScheduleDate(request.date, now);
  const schedule = z.object({ gameWeek: z.array(z.object({ date: z.string(), games: z.array(z.unknown()) })) }).parse(source);
  const days = schedule.gameWeek.filter((day) => day.date === request.date);
  if (days.length !== 1) throw new Error("Official schedule must contain the requested date exactly once");
  const games = [...request.gameIds].sort((a, b) => a - b).map((id) => {
    const matches = days[0].games.filter((game: any) => game?.id === id);
    if (matches.length !== 1) throw new Error("Every requested game must occur exactly once on the official slate");
    const game = scheduledGame.parse(matches[0]);
    const year = Math.floor(game.season / 10000);
    const gameDate = new Intl.DateTimeFormat("en-CA", { timeZone: "America/New_York", year: "numeric", month: "2-digit", day: "2-digit" }).format(new Date(game.startTimeUTC));
    if (game.season !== year * 10000 + year + 1 || String(game.id).slice(0, 6) !== `${year}0${game.gameType}`
      || String(game.id).length !== 10 || game.homeTeam.id === game.awayTeam.id || Date.parse(game.startTimeUTC) <= now || gameDate !== request.date) {
      throw new Error("Official game identity, teams or pregame timing is inconsistent");
    }
    return { id: game.id, date: request.date, seasonId: game.season, startTime: new Date(game.startTimeUTC).toISOString(),
      type: game.gameType, homeTeamId: game.homeTeam.id, awayTeamId: game.awayTeam.id };
  });
  const planHash = createHash("sha256").update(JSON.stringify({ version: 1, date: request.date, games })).digest("hex");
  return { request, games, planHash };
}

async function updateBoundedSchedule(req: NextApiRequest & { supabase: typeof supabase }, res: NextApiResponse) {
  res.setHeader("Cache-Control", "private, no-store");
  if (req.method !== "POST") { res.setHeader("Allow", "POST"); return res.status(405).json({ success: false, message: "Use POST for bounded schedule ingestion" }); }
  const parsed = boundedScheduleRequest.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ success: false, message: "Invalid bounded schedule request" });
  try { checkBoundedScheduleDate(parsed.data.date, Date.now()); }
  catch (error) { return res.status(400).json({ success: false, message: (error as Error).message }); }
  if (!parsed.data.dryRun && !parsed.data.expectedPlanHash) return res.status(400).json({ success: false, message: "Publication requires the reviewed dry-run plan hash" });
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 15_000);
  try {
    const source = await get(`/schedule/${parsed.data.date}`, false, controller.signal);
    const { games, planHash, request } = prepareBoundedSchedule(source, parsed.data);
    if (!request.dryRun && request.expectedPlanHash !== planHash) return res.status(409).json({ success: false, message: "Official schedule changed; review a new dry run" });
    const teamIds = [...new Set(games.flatMap((game) => [game.homeTeamId, game.awayTeamId]))];
    const seasonIds = [...new Set(games.map((game) => game.seasonId))];
    const [saved, teams, seasons] = await Promise.all([
      req.supabase.from("games").select("id,date,seasonId,startTime,type,homeTeamId,awayTeamId").in("id", request.gameIds),
      req.supabase.from("teams").select("id").in("id", teamIds),
      req.supabase.from("seasons").select("id").in("id", seasonIds),
    ]);
    if (saved.error || teams.error || seasons.error || !saved.data || !teams.data || !seasons.data) throw new Error("Schedule read failed");
    const missingTeams = teamIds.filter((id) => !teams.data.some((team) => team.id === id));
    const missingSeasons = seasonIds.filter((id) => !seasons.data.some((season) => season.id === id));
    if (missingTeams.length || missingSeasons.length) return res.status(409).json({ success: false,
      message: "Schedule dependencies must exist before ingestion", missingTeams, missingSeasons });
    const existing = saved.data;
    const conflicts = games.filter((game) => {
      const previous = existing.find((row) => row.id === game.id);
      return previous && Object.entries(game).some(([key, value]) => key === "startTime"
        ? Date.parse(previous.startTime) !== Date.parse(String(value)) : previous[key as keyof typeof previous] !== value);
    }).map((game) => game.id);
    if (conflicts.length) return res.status(409).json({ success: false, message: "Existing games differ; bounded ingestion never overwrites schedule history", conflicts });
    const missing = games.filter((game) => !existing.some((row) => row.id === game.id));
    let rowsInserted = 0;
    if (!request.dryRun && missing.length) {
      if (games.some((game) => Date.parse(game.startTime) <= Date.now())) throw new Error("Game started before insertion");
      // A single insert is atomic. A concurrent duplicate fails instead of
      // overwriting an existing or frozen game's identity and puck-drop time.
      const result = await req.supabase.from("games").insert(missing).select("id");
      if (result.error || result.data?.length !== missing.length) throw new Error("Bounded insert failed; rerun the preview");
      rowsInserted = result.data.length;
    }
    return res.status(200).json({ success: true, dryRun: request.dryRun, date: request.date, planHash, games,
      wouldInsert: missing.map((game) => game.id), rowsInserted });
  } catch {
    return res.status(503).json({ success: false, message: "Bounded schedule unavailable; verify official pregame data and database dependencies, then rerun the preview" });
  } finally { clearTimeout(timer); }
}

async function getScheduleSeasonId(): Promise<number> {
  const current = await getCurrentSeason();
  const endDate = current.seasonEndDate?.slice(0, 10);
  if (!endDate || endDate >= new Date().toISOString().slice(0, 10)) return current.seasonId;

  // The next season's preseason starts before its recorded season start date.
  const { data, error } = await supabase.from("seasons").select("id")
    .gt("id", current.seasonId).order("id", { ascending: true }).limit(1);
  if (error || !data?.[0]?.id) throw new Error("Upcoming schedule season is unavailable");
  return data[0].id;
}

export default withCronJobAudit(adminOnly(async (req, res) => {
  if (req.query.mode !== undefined || req.body?.date !== undefined || req.body?.gameIds !== undefined || req.body?.dryRun !== undefined) {
    if (req.query.mode !== "bounded_slate") return res.status(400).json({ success: false, message: "Unknown schedule ingestion mode" });
    return updateBoundedSchedule(req, res);
  }
  const { supabase } = req;
  try {
    const seasonId = req.query.seasonId ? Number(req.query.seasonId) : await getScheduleSeasonId();
    if (!Number.isSafeInteger(seasonId) || seasonId <= 0) throw new Error("Invalid schedule season");
    const teams = (await getAllTeams(seasonId)) ?? [];
    const taskResults = await Promise.allSettled(
      teams.map(async (team) => ({
        abbreviation: team.abbreviation,
        games: await getGamesByTeam(team.abbreviation, seasonId)
      }))
    );
    const failedTeams: Array<{ abbreviation: string; message: string }> = [];
    let games = taskResults.flatMap((result, index) => {
      const abbreviation = teams[index]?.abbreviation ?? "unknown";
      if (result.status === "fulfilled") {
        return result.value.games;
      }

      failedTeams.push({
        abbreviation,
        message: result.reason?.message ?? String(result.reason)
      });
      return [];
    });

    if (games.length === 0) {
      throw new Error(
        failedTeams.length > 0
          ? `Failed to fetch games for every team. ${failedTeams
              .map((failure) => `${failure.abbreviation}: ${failure.message}`)
              .join("; ")}`
          : "No games returned for any team."
      );
    }

    const gamesMap: any = {};
    games.forEach((game) => {
      gamesMap[game.id] = game;
    });

    games = Object.values(gamesMap);
    // filter out games played by non-nhl teams
    const teamIds = new Set(teams.map((team) => team.id));
    games = games.filter(
      (game) => teamIds.has(game.homeTeam.id) && teamIds.has(game.awayTeam.id)
    );

    await supabase
      .from("games")
      .upsert(
        games.map((game: any) => ({
          id: game.id,
          date: game.gameDate,
          seasonId,
          startTime: game.startTimeUTC,
          type: game.gameType,
          homeTeamId: game.homeTeam.id,
          awayTeamId: game.awayTeam.id
        }))
      )
      .throwOnError();

    res.status(200).json({
      message:
        "Successfully updated the games table. " +
        `${games.length} games in ${seasonId}.`,
      success: true,
      partialFailures: failedTeams.length,
      warnings:
        failedTeams.length > 0
          ? failedTeams.map(
              (failure) => `${failure.abbreviation}: ${failure.message}`
            )
          : []
    });
  } catch (e: any) {
    console.error(e);
    res.status(400).json({
      message: e.message,
      success: false
    });
  }
}));

async function getGamesByTeam(abbreviation: string, season: number) {
  const { games } = await get(
    `/club-schedule-season/${abbreviation}/${season}`
  );

  return games;
}

async function getAllTeams(
  season: number
): Promise<{ abbreviation: string; id: number }[]> {
  const { data: teamIds } = await supabase
    .from("team_season")
    .select("teamId")
    .eq("seasonId", season)
    .throwOnError();
  const { data } = await supabase
    .from("teams")
    .select("id, abbreviation")
    .in("id", teamIds?.map(({ teamId }) => teamId) ?? [])
    .throwOnError();

  return data!;
}
