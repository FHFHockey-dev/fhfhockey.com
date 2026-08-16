import path from "path";

import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import dotenv from "dotenv";

import {
  buildGameDayTweetsLineupSourceFromTweet,
  buildTeamDirectory,
  parseGameDayTweetsLinesPage,
  parseGameDayTweetsPageCount,
  toHistoricalLineSourceRow,
  type ParsedPregameLineupSource,
  type RosterNameEntry,
  type TeamDirectoryEntry,
} from "lib/sources/lineupSourceIngestion";
import { teamsInfo } from "lib/teamsInfo";

const PAGE_SIZE = 1_000;
const UPSERT_BATCH_SIZE = 200;
const DEFAULT_MAX_PAGES = 5;
const DEFAULT_CONCURRENCY = 4;

type Options = {
  apply: boolean;
  teamAbbreviations: string[];
  maxPages: number;
  fromDate: string | null;
  toDate: string | null;
  concurrency: number;
};

type HistoricalCandidate = {
  team: TeamDirectoryEntry;
  source: ParsedPregameLineupSource;
  snapshotDate: string;
};

type TeamSummary = {
  team: string;
  pages: number;
  tweets: number;
  datedTweets: number;
  lineupCandidates: number;
};

type GameRow = {
  id: number;
  date: string;
  homeTeamId: number;
  awayTeamId: number;
};

function parsePositiveInteger(value: string | undefined, fallback: number): number {
  const parsed = Number(value);
  return Number.isInteger(parsed) && parsed > 0 ? parsed : fallback;
}

function parseDateOption(name: string, value: string | undefined): string | null {
  if (!value) return null;
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) {
    throw new Error(`${name} must use YYYY-MM-DD.`);
  }
  return value;
}

function parseOptions(argv: string[]): Options {
  const valueFor = (name: string) =>
    argv.find((argument) => argument.startsWith(`${name}=`))?.slice(name.length + 1);
  const requestedTeams = valueFor("--teams")
    ?.split(",")
    .map((value) => value.trim().toUpperCase())
    .filter(Boolean);
  const teamAbbreviations = requestedTeams?.length
    ? [...new Set(requestedTeams)]
    : Object.keys(teamsInfo);
  const unknownTeams = teamAbbreviations.filter((team) => !teamsInfo[team]);
  if (unknownTeams.length > 0) {
    throw new Error(`Unknown team abbreviation(s): ${unknownTeams.join(", ")}`);
  }

  const fromDate = parseDateOption("--from-date", valueFor("--from-date"));
  const toDate = parseDateOption("--to-date", valueFor("--to-date"));
  if (fromDate && toDate && fromDate > toDate) {
    throw new Error("--from-date cannot be later than --to-date.");
  }

  return {
    apply: argv.includes("--apply"),
    teamAbbreviations,
    maxPages: parsePositiveInteger(valueFor("--max-pages"), DEFAULT_MAX_PAGES),
    fromDate,
    toDate,
    concurrency: parsePositiveInteger(
      valueFor("--concurrency"),
      DEFAULT_CONCURRENCY,
    ),
  };
}

function createSupabaseClient(): SupabaseClient {
  const webDirectory = path.resolve(__dirname, "..");
  dotenv.config({ path: path.join(webDirectory, ".env.local") });
  dotenv.config({ path: path.join(webDirectory, "scripts", ".env") });
  dotenv.config({ path: path.resolve(webDirectory, "..", ".env.local") });

  const url = process.env.NEXT_PUBLIC_SUPABASE_URL?.trim();
  const key =
    process.env.SUPABASE_SERVICE_ROLE_KEY?.trim() ??
    process.env.NEXT_SUPABASE_SERVICE_ROLE_KEY?.trim();
  if (!url || !key) {
    throw new Error(
      "Missing NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY.",
    );
  }

  return createClient(url, key, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
}

function buildRequestedTeams(abbreviations: string[]): TeamDirectoryEntry[] {
  const directory = buildTeamDirectory(
    Object.entries(teamsInfo).map(([abbreviation, team]) => ({
      id: team.id,
      name: team.name,
      abbreviation,
      logo: "",
    })),
  );
  const requested = new Set(abbreviations);
  return directory.filter((team) => requested.has(team.abbreviation));
}

async function fetchHtml(url: string): Promise<string> {
  const response = await fetch(url, {
    headers: {
      Accept: "text/html,application/xhtml+xml",
      "User-Agent": "fhfhockey/1.0 (+https://fhfhockey.com)",
    },
  });
  if (!response.ok) {
    throw new Error(`GameDayTweets request failed (${response.status}) for ${url}`);
  }
  return response.text();
}

async function fetchRosterByTeam(
  supabase: SupabaseClient,
  teamIds: number[],
): Promise<Map<number, RosterNameEntry[]>> {
  const rosterByTeam = new Map<number, Map<number, RosterNameEntry>>();

  for (let offset = 0; ; offset += PAGE_SIZE) {
    const { data, error } = await supabase
      .from("rosters")
      .select("teamId, playerId, players!inner(fullName, lastName)")
      .in("teamId", teamIds)
      .order("teamId", { ascending: true })
      .order("playerId", { ascending: true })
      .range(offset, offset + PAGE_SIZE - 1);
    if (error) throw error;

    for (const row of data ?? []) {
      const teamId = Number((row as any).teamId);
      const playerId = Number((row as any).playerId);
      const player = (row as any).players;
      if (!Number.isFinite(teamId) || !Number.isFinite(playerId) || !player?.fullName) {
        continue;
      }
      if (!rosterByTeam.has(teamId)) rosterByTeam.set(teamId, new Map());
      rosterByTeam.get(teamId)?.set(playerId, {
        playerId,
        fullName: String(player.fullName),
        lastName: String(player.lastName ?? ""),
      });
    }

    if ((data?.length ?? 0) < PAGE_SIZE) break;
  }

  return new Map(
    [...rosterByTeam.entries()].map(([teamId, entries]) => [
      teamId,
      [...entries.values()],
    ]),
  );
}

async function mapWithConcurrency<T, R>(
  values: T[],
  concurrency: number,
  worker: (value: T) => Promise<R>,
): Promise<R[]> {
  const results = new Array<R>(values.length);
  let nextIndex = 0;
  const runners = Array.from(
    { length: Math.min(concurrency, values.length) },
    async () => {
      while (nextIndex < values.length) {
        const index = nextIndex++;
        results[index] = await worker(values[index]);
      }
    },
  );
  await Promise.all(runners);
  return results;
}

function isDateInScope(date: string, options: Options): boolean {
  return (
    (!options.fromDate || date >= options.fromDate) &&
    (!options.toDate || date <= options.toDate)
  );
}

async function fetchTeamCandidates(args: {
  team: TeamDirectoryEntry;
  rosterEntries: RosterNameEntry[];
  options: Options;
}): Promise<{ candidates: HistoricalCandidate[]; summary: TeamSummary }> {
  const baseUrl = `https://www.gamedaytweets.com/lines?team=${args.team.abbreviation}`;
  const firstHtml = await fetchHtml(baseUrl);
  const pageCount = Math.min(
    args.options.maxPages,
    parseGameDayTweetsPageCount(firstHtml),
  );
  const candidates: HistoricalCandidate[] = [];
  const seenTweets = new Set<string>();
  let tweetCount = 0;
  let datedTweetCount = 0;

  for (let page = 1; page <= pageCount; page += 1) {
    const sourceUrl = page === 1 ? baseUrl : `${baseUrl}&page=${page}`;
    const html = page === 1 ? firstHtml : await fetchHtml(sourceUrl);
    const parsed = parseGameDayTweetsLinesPage({
      html,
      team: args.team,
      rosterEntries: args.rosterEntries,
      sourceUrl,
    });
    tweetCount += parsed.tweets.length;

    for (const tweet of parsed.tweets) {
      if (!tweet.postedAt) continue;
      datedTweetCount += 1;
      const snapshotDate = tweet.postedAt.slice(0, 10);
      if (!isDateInScope(snapshotDate, args.options)) continue;
      const dedupeKey = tweet.tweetUrl ?? `${snapshotDate}:${tweet.text}`;
      if (seenTweets.has(dedupeKey)) continue;
      seenTweets.add(dedupeKey);

      const parsedSource = buildGameDayTweetsLineupSourceFromTweet({
        team: args.team,
        rosterEntries: args.rosterEntries,
        sourceUrl,
        tweet,
      });
      if (!parsedSource) continue;

      candidates.push({
        team: args.team,
        snapshotDate,
        source: {
          ...parsedSource,
          observedAt: tweet.postedAt,
          freshnessExpiresAt: null,
        },
      });
    }
  }

  return {
    candidates,
    summary: {
      team: args.team.abbreviation,
      pages: pageCount,
      tweets: tweetCount,
      datedTweets: datedTweetCount,
      lineupCandidates: candidates.length,
    },
  };
}

async function fetchGames(
  supabase: SupabaseClient,
  fromDate: string,
  toDate: string,
): Promise<GameRow[]> {
  const games: GameRow[] = [];

  for (let offset = 0; ; offset += PAGE_SIZE) {
    const { data, error } = await supabase
      .from("games")
      .select("id, date, homeTeamId, awayTeamId")
      .gte("date", fromDate)
      .lte("date", toDate)
      .order("date", { ascending: true })
      .order("id", { ascending: true })
      .range(offset, offset + PAGE_SIZE - 1);
    if (error) throw error;
    games.push(...((data ?? []) as GameRow[]));
    if ((data?.length ?? 0) < PAGE_SIZE) break;
  }

  return games;
}

function buildGameIdLookup(games: GameRow[]): Map<string, number> {
  const lookup = new Map<string, number>();
  for (const game of games) {
    lookup.set(`${game.date}:${game.homeTeamId}`, game.id);
    lookup.set(`${game.date}:${game.awayTeamId}`, game.id);
  }
  return lookup;
}

async function main() {
  const options = parseOptions(process.argv.slice(2));
  const supabase = createSupabaseClient();
  const teams = buildRequestedTeams(options.teamAbbreviations);
  const rosterByTeam = await fetchRosterByTeam(
    supabase,
    teams.map((team) => team.id),
  );
  const teamResults = await mapWithConcurrency(
    teams,
    options.concurrency,
    async (team) =>
      fetchTeamCandidates({
        team,
        rosterEntries: rosterByTeam.get(team.id) ?? [],
        options,
      }),
  );
  const candidates = teamResults.flatMap((result) => result.candidates);
  const dates = candidates.map((candidate) => candidate.snapshotDate).sort();
  const games =
    dates.length > 0
      ? await fetchGames(supabase, dates[0], dates[dates.length - 1])
      : [];
  const gameIdByDateAndTeam = buildGameIdLookup(games);
  const rowsByCaptureKey = new Map(
    candidates.map((candidate) => {
      const row = toHistoricalLineSourceRow({
        snapshotDate: candidate.snapshotDate,
        gameId:
          gameIdByDateAndTeam.get(
            `${candidate.snapshotDate}:${candidate.team.id}`,
          ) ?? null,
        source: candidate.source,
        rosterEntries: rosterByTeam.get(candidate.team.id) ?? [],
      });
      return [row.capture_key, row] as const;
    }),
  );
  const rows = [...rowsByCaptureKey.values()];

  if (options.apply) {
    for (let index = 0; index < rows.length; index += UPSERT_BATCH_SIZE) {
      const { error } = await supabase
        .from("lines_gdl")
        .upsert(rows.slice(index, index + UPSERT_BATCH_SIZE) as any, {
          onConflict: "capture_key",
        });
      if (error) throw error;
    }
  }

  const matchedGames = rows.filter((row) => row.game_id != null).length;
  console.log(
    JSON.stringify(
      {
        mode: options.apply ? "apply" : "dry-run",
        dateRange: dates.length > 0 ? [dates[0], dates[dates.length - 1]] : null,
        teams: teams.length,
        pages: teamResults.reduce((sum, result) => sum + result.summary.pages, 0),
        tweets: teamResults.reduce((sum, result) => sum + result.summary.tweets, 0),
        lineupCandidates: candidates.length,
        rows: rows.length,
        matchedGames,
        rowsWithoutGames: rows.length - matchedGames,
        teamSummaries: teamResults.map((result) => result.summary),
      },
      null,
      2,
    ),
  );
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : error);
  process.exitCode = 1;
});
