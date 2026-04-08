import fs from "node:fs/promises";
import path from "node:path";

import { createClient } from "@supabase/supabase-js";
import dotenv from "dotenv";

dotenv.config({ path: path.resolve(process.cwd(), ".env.local") });

type LocalTeamRow = {
  teamId: number;
  teamLabel: string;
  gamesPlayed: number;
  wins: number;
  losses: number;
  otl: number;
  points: number;
  gf: number;
  ga: number;
  sf: number;
  sa: number;
  cf: number;
  ca: number;
  ff: number;
  fa: number;
};

type OfficialStandingsRow = {
  teamAbbrev?: { default?: string };
  gamesPlayed?: number;
  wins?: number;
  losses?: number;
  otLosses?: number;
  points?: number;
  goalFor?: number;
  goalAgainst?: number;
};

type OfficialSummaryRow = {
  teamId?: number;
  gamesPlayed?: number;
  wins?: number;
  losses?: number;
  otLosses?: number;
  points?: number;
  goalsFor?: number;
  goalsAgainst?: number;
  shotsForPerGame?: number;
  shotsAgainstPerGame?: number;
};

type OfficialShootingRow = {
  teamId?: number;
  gamesPlayed?: number;
  shots5v5?: number;
  satFor?: number;
  satAgainst?: number;
  usatFor?: number;
  usatAgainst?: number;
};

type AuditMetricDiff = {
  metric: string;
  local: number | null;
  official: number | null;
  delta: number | null;
};

type TeamAuditRow = {
  teamId: number;
  teamAbbrev: string;
  allStrengths: AuditMetricDiff[];
  fiveOnFive: AuditMetricDiff[];
};

type WgoSeasonRow = {
  game_id: number | null;
  payload: {
    homeTeam?: { id?: unknown; sog?: unknown } | null;
    awayTeam?: { id?: unknown; sog?: unknown } | null;
  } | null;
  source_url: string | null;
};

type LocalApiResponse = {
  rows: LocalTeamRow[];
};

function parseIntegerArg(value: string | undefined, fallback: number) {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : fallback;
}

function parseStringArg(value: string | undefined, fallback: string) {
  return typeof value === "string" && value.trim().length > 0 ? value.trim() : fallback;
}

function delay(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function getErrorMessage(error: unknown) {
  if (error instanceof Error) {
    return error.message;
  }

  if (typeof error === "string") {
    return error;
  }

  if (error != null && typeof error === "object" && "message" in error) {
    const message = (error as { message?: unknown }).message;
    if (typeof message === "string") {
      return message;
    }
  }

  return String(error ?? "Unknown error");
}

function getErrorStatus(error: unknown): number | null {
  if (error != null && typeof error === "object") {
    if ("status" in error) {
      const status = Number((error as { status?: unknown }).status);
      if (Number.isFinite(status)) {
        return status;
      }
    }

    if ("code" in error) {
      const code = Number((error as { code?: unknown }).code);
      if (Number.isFinite(code)) {
        return code;
      }
    }
  }

  return null;
}

function isRetryableError(error: unknown) {
  const status = getErrorStatus(error);
  if (status === 408 || status === 409 || status === 425 || status === 429) {
    return true;
  }

  if (status != null && status >= 500) {
    return true;
  }

  const message = getErrorMessage(error).toLowerCase();
  return [
    "http 408",
    "http 409",
    "http 425",
    "http 429",
    "http 500",
    "http 502",
    "http 503",
    "http 504",
    "http 520",
    "cloudflare",
    "timed out",
    "timeout",
    "econnreset",
    "etimedout",
    "fetch failed",
    "gateway",
  ].some((fragment) => message.includes(fragment));
}

async function withRetry<T>(label: string, work: () => Promise<T>, maxAttempts = 5): Promise<T> {
  let lastError: unknown;

  for (let attempt = 1; attempt <= maxAttempts; attempt += 1) {
    try {
      return await work();
    } catch (error) {
      lastError = error;
      if (attempt >= maxAttempts || !isRetryableError(error)) {
        break;
      }

      const waitMs = Math.min(1000 * 2 ** (attempt - 1), 10000);
      console.warn(
        `[audit-team-underlying-vs-nhl] ${label} failed on attempt ${attempt}/${maxAttempts}; retrying in ${waitMs}ms: ${getErrorMessage(error)}`
      );
      await delay(waitMs);
    }
  }

  throw lastError instanceof Error
    ? lastError
    : new Error(`[audit-team-underlying-vs-nhl] ${label} failed: ${getErrorMessage(lastError)}`);
}

async function fetchJson<T>(url: string): Promise<T> {
  return withRetry(`fetch ${url}`, async () => {
    const response = await fetch(url, {
      headers: {
        Accept: "application/json",
        "User-Agent": "fhfhockey-audit/1.0 (+https://fhfhockey.com)",
      },
    });

    if (!response.ok) {
      throw Object.assign(new Error(`Failed to fetch ${url}: HTTP ${response.status}`), {
        status: response.status,
      });
    }

    return (await response.json()) as T;
  });
}

async function fetchLocalRows(args: {
  baseUrl: string;
  seasonId: number;
  strength: "allStrengths" | "fiveOnFive";
}): Promise<Map<string, LocalTeamRow>> {
  const url = new URL("/api/v1/underlying-stats/teams", args.baseUrl);
  url.searchParams.set("fromSeasonId", String(args.seasonId));
  url.searchParams.set("throughSeasonId", String(args.seasonId));
  url.searchParams.set("seasonType", "regularSeason");
  url.searchParams.set("strength", args.strength);
  url.searchParams.set("scoreState", "allScores");
  url.searchParams.set("displayMode", "counts");
  url.searchParams.set("venue", "all");
  url.searchParams.set("scope", "none");
  url.searchParams.set("sortKey", "points");
  url.searchParams.set("sortDirection", "desc");
  url.searchParams.set("page", "1");
  url.searchParams.set("pageSize", "100");

  const response = await fetchJson<LocalApiResponse>(url.toString());
  return new Map(response.rows.map((row) => [row.teamLabel, row]));
}

async function fetchOfficialStandings(standingsDate: string): Promise<Map<string, OfficialStandingsRow>> {
  const response = await fetchJson<{ standings?: OfficialStandingsRow[] }>(
    `https://api-web.nhle.com/v1/standings/${standingsDate}`
  );

  return new Map(
    (response.standings ?? [])
      .filter((row) => typeof row.teamAbbrev?.default === "string")
      .map((row) => [row.teamAbbrev!.default!, row])
  );
}

async function fetchOfficialSeasonSummary(seasonId: number): Promise<Map<number, OfficialSummaryRow>> {
  const url =
    "https://api.nhle.com/stats/rest/en/team/summary?isAggregate=false&isGame=false" +
    "&sort=%5B%7B%22property%22:%22points%22,%22direction%22:%22DESC%22%7D,%7B%22property%22:%22wins%22,%22direction%22:%22DESC%22%7D,%7B%22property%22:%22teamId%22,%22direction%22:%22ASC%22%7D%5D" +
    `&start=0&limit=50&cayenneExp=gameTypeId=2%20and%20seasonId%3C=${seasonId}%20and%20seasonId%3E=${seasonId}`;
  const response = await fetchJson<{ data?: OfficialSummaryRow[] }>(url);

  return new Map(
    (response.data ?? [])
      .filter((row) => Number.isFinite(row.teamId))
      .map((row) => [Number(row.teamId), row])
  );
}

async function fetchOfficialFiveOnFiveSummary(seasonId: number): Promise<Map<number, OfficialShootingRow>> {
  const url =
    "https://api.nhle.com/stats/rest/en/team/summaryshooting?isAggregate=false&isGame=false" +
    "&sort=%5B%7B%22property%22:%22satTotal%22,%22direction%22:%22DESC%22%7D,%7B%22property%22:%22teamId%22,%22direction%22:%22ASC%22%7D%5D" +
    `&start=0&limit=50&cayenneExp=gameTypeId=2%20and%20seasonId%3C=${seasonId}%20and%20seasonId%3E=${seasonId}`;
  const response = await fetchJson<{ data?: OfficialShootingRow[] }>(url);

  return new Map(
    (response.data ?? [])
      .filter((row) => Number.isFinite(row.teamId))
      .map((row) => [Number(row.teamId), row])
  );
}

async function fetchOfficialSeasonShotTotals(seasonId: number): Promise<Map<number, { sf: number; sa: number }>> {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!supabaseUrl || !supabaseKey) {
    throw new Error("Missing Supabase env vars required for WGO audit totals.");
  }

  const supabase = createClient(supabaseUrl, supabaseKey);
  const rows: WgoSeasonRow[] = [];
  const pageSize = 250;

  for (let from = 0; ; from += pageSize) {
    const to = from + pageSize - 1;
    const page = await withRetry(
      `Supabase landing payload page ${from}-${to}`,
      async () => {
        const { data, error } = await supabase
          .from("nhl_api_game_payloads_raw")
          .select("game_id,payload,source_url")
          .eq("endpoint", "landing")
          .eq("season_id", seasonId)
          .range(from, to);

        if (error) {
          throw error;
        }

        return (data ?? []) as WgoSeasonRow[];
      }
    );
    rows.push(...page);

    if (page.length < 1000) {
      break;
    }
  }

  const totals = new Map<number, { sf: number; sa: number }>();
  const seenGameIds = new Set<number>();
  for (const row of rows) {
    const gameId = Number(row.game_id);
    if (
      !Number.isFinite(gameId) ||
      seenGameIds.has(gameId) ||
      (typeof row.source_url === "string" && row.source_url.startsWith("derived://"))
    ) {
      continue;
    }

    seenGameIds.add(gameId);

    const homeTeamId = Number(row.payload?.homeTeam?.id);
    const awayTeamId = Number(row.payload?.awayTeam?.id);
    const homeSog = Number(row.payload?.homeTeam?.sog);
    const awaySog = Number(row.payload?.awayTeam?.sog);

    if (
      !Number.isFinite(homeTeamId) ||
      !Number.isFinite(awayTeamId) ||
      !Number.isFinite(homeSog) ||
      !Number.isFinite(awaySog)
    ) {
      continue;
    }

    const homeTotals = totals.get(homeTeamId) ?? { sf: 0, sa: 0 };
    homeTotals.sf += homeSog;
    homeTotals.sa += awaySog;
    totals.set(homeTeamId, homeTotals);

    const awayTotals = totals.get(awayTeamId) ?? { sf: 0, sa: 0 };
    awayTotals.sf += awaySog;
    awayTotals.sa += homeSog;
    totals.set(awayTeamId, awayTotals);
  }

  return totals;
}

function compareMetric(metric: string, local: number | null | undefined, official: number | null | undefined) {
  const normalizedLocal = local == null ? null : Number(local);
  const normalizedOfficial = official == null ? null : Number(official);

  return {
    metric,
    local: normalizedLocal,
    official: normalizedOfficial,
    delta:
      normalizedLocal == null || normalizedOfficial == null
        ? null
        : normalizedLocal - normalizedOfficial,
  } satisfies AuditMetricDiff;
}

function hasMeaningfulDelta(diff: AuditMetricDiff) {
  if (diff.delta == null) {
    return false;
  }

  return Math.abs(diff.delta) > 0.5;
}

function formatDiffsForConsole(teamAuditRows: TeamAuditRow[]) {
  return teamAuditRows
    .filter(
      (row) =>
        row.allStrengths.some(hasMeaningfulDelta) || row.fiveOnFive.some(hasMeaningfulDelta)
    )
    .map((row) => ({
      team: row.teamAbbrev,
      allStrengths: row.allStrengths.filter(hasMeaningfulDelta),
      fiveOnFive: row.fiveOnFive.filter(hasMeaningfulDelta),
    }));
}

async function main() {
  const seasonId = parseIntegerArg(process.argv[2], 20252026);
  const standingsDate = parseStringArg(process.argv[3], "2026-04-07");
  const baseUrl = parseStringArg(process.argv[4], "http://localhost:3000");
  const outputPath = process.argv[5]
    ? path.resolve(process.cwd(), process.argv[5])
    : path.resolve(process.cwd(), "tmp/team-underlying-audit.json");

  const [localAllStrengths, localFiveOnFive, officialStandings, officialSummary, officialFiveOnFive, officialShotTotals] =
    await Promise.all([
      fetchLocalRows({ baseUrl, seasonId, strength: "allStrengths" }),
      fetchLocalRows({ baseUrl, seasonId, strength: "fiveOnFive" }),
      fetchOfficialStandings(standingsDate),
      fetchOfficialSeasonSummary(seasonId),
      fetchOfficialFiveOnFiveSummary(seasonId),
      fetchOfficialSeasonShotTotals(seasonId),
    ]);

  const auditRows: TeamAuditRow[] = [];

  for (const [teamAbbrev, localAllRow] of localAllStrengths.entries()) {
    const localFiveRow = localFiveOnFive.get(teamAbbrev);
    const standingsRow = officialStandings.get(teamAbbrev);
    const officialSummaryRow = officialSummary.get(localAllRow.teamId);
    const officialFiveRow = officialFiveOnFive.get(localAllRow.teamId);
    const officialShots = officialShotTotals.get(localAllRow.teamId);

    auditRows.push({
      teamId: localAllRow.teamId,
      teamAbbrev,
      allStrengths: [
        compareMetric("gamesPlayed", localAllRow.gamesPlayed, standingsRow?.gamesPlayed),
        compareMetric("wins", localAllRow.wins, standingsRow?.wins),
        compareMetric("losses", localAllRow.losses, standingsRow?.losses),
        compareMetric("otl", localAllRow.otl, standingsRow?.otLosses),
        compareMetric("points", localAllRow.points, standingsRow?.points),
        compareMetric("gf", localAllRow.gf, officialSummaryRow?.goalsFor),
        compareMetric("ga", localAllRow.ga, officialSummaryRow?.goalsAgainst),
        compareMetric("sf", localAllRow.sf, officialShots?.sf ?? null),
        compareMetric("sa", localAllRow.sa, officialShots?.sa ?? null),
      ],
      fiveOnFive: localFiveRow == null
        ? []
        : [
            compareMetric("gamesPlayed", localFiveRow.gamesPlayed, officialFiveRow?.gamesPlayed),
            compareMetric("sf", localFiveRow.sf, officialFiveRow?.shots5v5),
            compareMetric("cf", localFiveRow.cf, officialFiveRow?.satFor),
            compareMetric("ca", localFiveRow.ca, officialFiveRow?.satAgainst),
            compareMetric("ff", localFiveRow.ff, officialFiveRow?.usatFor),
            compareMetric("fa", localFiveRow.fa, officialFiveRow?.usatAgainst),
          ],
    });
  }

  const summary = formatDiffsForConsole(auditRows);

  await fs.mkdir(path.dirname(outputPath), { recursive: true });
  await fs.writeFile(
    outputPath,
    JSON.stringify(
      {
        seasonId,
        standingsDate,
        generatedAt: new Date().toISOString(),
        teamCount: auditRows.length,
        discrepancies: summary,
        fullAudit: auditRows,
      },
      null,
      2
    )
  );

  console.log(
    JSON.stringify(
      {
        seasonId,
        standingsDate,
        outputPath,
        discrepantTeams: summary.length,
        examples: summary.slice(0, 5),
      },
      null,
      2
    )
  );
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});