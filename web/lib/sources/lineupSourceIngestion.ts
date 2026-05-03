import * as cheerio from "cheerio";

import type { Team } from "lib/NHL/types";
import { teamHashtagsByAbbreviation, teamsInfo } from "lib/teamsInfo";
import { parseTweetOEmbedHtml } from "lib/sources/tweetLineupParsing";

export type PregameSourceStatus = "observed" | "rejected";
export type PregameLineupSourceName = "nhl.com" | "dailyfaceoff" | "gamedaytweets";
export type GameDayTweetsClassification =
  | "lineup"
  | "practice_lines"
  | "power_play"
  | "goalie_start"
  | "injury"
  | "other";

export type RosterNameEntry = {
  playerId: number;
  fullName: string;
  lastName: string;
  aliases?: string[];
};

export type TeamDirectoryEntry = Team & {
  slug: string;
  location: string | null;
  shortName: string | null;
  hashtags: string[];
};

export type InjuryMention = {
  playerName: string;
  note: string | null;
};

export type NameValidationResult = {
  matchedPlayerIds: number[];
  matchedNames: string[];
  unmatchedNames: string[];
};

export type ParsedGameDayTweet = {
  classification: GameDayTweetsClassification;
  sourceHandle: string | null;
  sourceUrl: string | null;
  tweetUrl: string | null;
  postedLabel: string | null;
  postedAt: string | null;
  text: string;
  structureSignals: {
    forwardLineCount: number;
    defensePairCount: number;
    keywordHits: string[];
  };
  matchedPlayerIds: number[];
  matchedNames: string[];
  unmatchedNames: string[];
};

export type ParsedPregameLineupSource = {
  team: TeamDirectoryEntry;
  sourceName: PregameLineupSourceName;
  sourceUrl: string;
  sourceRank: number;
  isOfficial: boolean;
  status: PregameSourceStatus;
  observedAt: string | null;
  freshnessExpiresAt: string | null;
  forwards: string[][];
  defensePairs: string[][];
  goalies: string[];
  scratches: string[];
  injuries: InjuryMention[];
  validation: NameValidationResult;
  metadata: Record<string, unknown>;
};

export type HistoricalLineSourceRow = {
  capture_key: string;
  snapshot_date: string;
  observed_at: string;
  tweet_posted_at: string | null;
  game_id: number | null;
  team_id: number;
  team_abbreviation: string;
  team_name: string;
  source: string;
  source_url: string | null;
  source_label: string | null;
  status: string;
  line_1_player_ids: Array<number | null> | null;
  line_1_player_names: string[] | null;
  line_2_player_ids: Array<number | null> | null;
  line_2_player_names: string[] | null;
  line_3_player_ids: Array<number | null> | null;
  line_3_player_names: string[] | null;
  line_4_player_ids: Array<number | null> | null;
  line_4_player_names: string[] | null;
  pair_1_player_ids: Array<number | null> | null;
  pair_1_player_names: string[] | null;
  pair_2_player_ids: Array<number | null> | null;
  pair_2_player_names: string[] | null;
  pair_3_player_ids: Array<number | null> | null;
  pair_3_player_names: string[] | null;
  goalie_1_player_id: number | null;
  goalie_1_name: string | null;
  goalie_2_player_id: number | null;
  goalie_2_name: string | null;
  scratches_player_ids: Array<number | null> | null;
  scratches_player_names: string[] | null;
  injured_player_ids: Array<number | null> | null;
  injured_player_names: string[] | null;
  raw_payload: Record<string, unknown>;
  metadata: Record<string, unknown>;
  updated_at: string;
};

export type GoalieStartConfidenceLabel =
  | "confirmed"
  | "likely"
  | "unconfirmed"
  | "projected"
  | "model";

export type ParsedGoalieStartSource = {
  team: TeamDirectoryEntry;
  sourceName:
    | "nhl.com"
    | "dailyfaceoff"
    | "gamedaytweets"
    | "goalie_start_projections";
  sourceUrl: string;
  sourceRank: number;
  isOfficial: boolean;
  status: PregameSourceStatus;
  goalieName: string;
  goaliePlayerId: number | null;
  backupGoalieName: string | null;
  startStatus: GoalieStartConfidenceLabel;
  confidenceScore: number | null;
  observedAt: string | null;
  freshnessExpiresAt: string | null;
  metadata: Record<string, unknown>;
};

const LINE_DASH_PATTERN = /\s+[–—-]{2,}\s+/g;
const MULTISPACE_PATTERN = /\s+/g;
const HOURS_TO_MS = 60 * 60 * 1000;
const LINEUP_SOURCE_TTL_HOURS: Record<PregameLineupSourceName, number> = {
  "nhl.com": 18,
  dailyfaceoff: 8,
  gamedaytweets: 6
};
const GOALIE_SOURCE_TTL_HOURS: Record<ParsedGoalieStartSource["sourceName"], number> = {
  dailyfaceoff: 8,
  gamedaytweets: 6,
  "nhl.com": 18,
  goalie_start_projections: 4
};
const GDT_LINEUP_KEYWORDS = [
  "lineup",
  "lines",
  "line combinations",
  "line combos",
  "combo",
  "line rushes",
  "rushes",
  "warmups",
  "pregame",
  "morning skate",
  "projected lines"
];
const GDT_PRACTICE_KEYWORDS = ["practice lines", "pairings", "practice", "rushes"];
const GDT_POWERPLAY_KEYWORDS = ["power play", "pp1", "pp2"];
const GDT_GOALIE_KEYWORDS = [
  "starting goalie",
  "starting",
  "starter",
  "crease",
  "starts",
  "in net",
  "lead the",
  "lead the ",
  "our guess"
];
const GDT_INJURY_KEYWORDS = [
  "injury",
  "injured",
  "hurt",
  "out",
  "returns",
  "returning",
  "signed",
  "recalled",
  "promoted"
];
const GDT_REGEX_NAME_SEPARATOR = String.raw`(?:-|–|—|/|\\|•|\u2022)`;
const GDT_INLINE_LINE_PATTERN = new RegExp(
  String.raw`([A-Z][A-Za-z.'’` + "`" + String.raw`-]+(?:\s+[A-Z][A-Za-z.'’` + "`" + String.raw`-]+){0,2}\s*` +
    GDT_REGEX_NAME_SEPARATOR +
    String.raw`\s*[A-Z][A-Za-z.'’` + "`" + String.raw`-]+(?:\s+[A-Z][A-Za-z.'’` + "`" + String.raw`-]+){0,2}\s*` +
    GDT_REGEX_NAME_SEPARATOR +
    String.raw`\s*[A-Z][A-Za-z.'’` + "`" + String.raw`-]+(?:\s+[A-Z][A-Za-z.'’` + "`" + String.raw`-]+){0,2})`,
  "g"
);
const GDT_INLINE_PAIR_PATTERN = new RegExp(
  String.raw`([A-Z][A-Za-z.'’` + "`" + String.raw`-]+(?:\s+[A-Z][A-Za-z.'’` + "`" + String.raw`-]+){0,2}\s*` +
    GDT_REGEX_NAME_SEPARATOR +
    String.raw`\s*[A-Z][A-Za-z.'’` + "`" + String.raw`-]+(?:\s+[A-Z][A-Za-z.'’` + "`" + String.raw`-]+){0,2})`,
  "g"
);
const GDT_ALIAS_OVERRIDES: Record<string, string[]> = {
  "joel eriksson ek": ["jeek"]
};

function normalizeWhitespace(value: string): string {
  return value.replace(/\u00a0/g, " ").replace(MULTISPACE_PATTERN, " ").trim();
}

function addHoursIso(value: string, hours: number): string {
  return new Date(Date.parse(value) + hours * HOURS_TO_MS).toISOString();
}

function resolveFreshnessExpiry(args: {
  observedAt?: string | null;
  freshnessExpiresAt?: string | null;
  ttlHours?: number | null;
}): string | null {
  if (args.freshnessExpiresAt) {
    return args.freshnessExpiresAt;
  }
  if (!args.observedAt || !args.ttlHours || !Number.isFinite(Date.parse(args.observedAt))) {
    return null;
  }
  return addHoursIso(args.observedAt, args.ttlHours);
}

function isSourceFresh(args: {
  status: PregameSourceStatus;
  observedAt?: string | null;
  freshnessExpiresAt?: string | null;
  now?: string | number | Date;
}): boolean {
  if (args.status !== "observed") return false;
  if (!args.freshnessExpiresAt) return true;
  const expiresAt = Date.parse(args.freshnessExpiresAt);
  if (!Number.isFinite(expiresAt)) return true;
  const now =
    args.now instanceof Date
      ? args.now.getTime()
      : typeof args.now === "string"
        ? Date.parse(args.now)
        : typeof args.now === "number"
          ? args.now
          : Date.now();
  return !Number.isFinite(now) || expiresAt > now;
}

function normalizeTeamLabel(value: string): string {
  return normalizeWhitespace(value)
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase();
}

function normalizeLineText(value: string): string {
  return normalizeWhitespace(value)
    .replace(LINE_DASH_PATTERN, " -- ")
    .replace(/[–—]/g, "-");
}

function toTeamSlug(teamName: string): string {
  return normalizeTeamLabel(teamName)
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

export function buildTeamDirectory(teams: Team[]): TeamDirectoryEntry[] {
  return teams.map((team) => {
    const catalogEntry =
      teamsInfo[team.abbreviation as keyof typeof teamsInfo] ??
      Object.values(teamsInfo).find((entry) => entry.id === team.id) ??
      null;
    const nameParts = team.name.split(" ");
    const shortName = catalogEntry?.shortName ?? nameParts.slice(-1)[0] ?? team.name;
    const location = catalogEntry?.location ?? (nameParts.length > 1 ? team.name.replace(new RegExp(`\\s+${shortName}$`), "") : null);

    return {
      ...team,
      slug: toTeamSlug(team.name),
      shortName,
      location,
      hashtags: teamHashtagsByAbbreviation[team.abbreviation] ?? []
    };
  });
}

export function buildNhlLineupProjectionsUrl(seasonId: number): string {
  const seasonText = String(seasonId);
  const startYear = seasonText.slice(0, 4);
  const endYear = seasonText.slice(6, 8);
  return `https://www.nhl.com/news/nhl-lineup-projections-${startYear}-${endYear}-season`;
}

function resolveTeamEntry(
  teamLabel: string,
  teams: TeamDirectoryEntry[]
): TeamDirectoryEntry | null {
  const normalizedLabel = normalizeTeamLabel(teamLabel).replace(/\s+projected lineup$/, "");

  return (
    teams.find((team) => {
      const candidates = [
        team.name,
        team.shortName,
        team.location,
        `${team.location ?? ""} ${team.shortName ?? ""}`.trim(),
        team.abbreviation
      ]
        .filter((value): value is string => Boolean(value))
        .map((value) => normalizeTeamLabel(value));

      return candidates.includes(normalizedLabel);
    }) ?? null
  );
}

function splitCommaList(value: string): string[] {
  return value
    .split(",")
    .map((item) => normalizeWhitespace(item))
    .filter(Boolean);
}

function parseInjuryList(value: string): InjuryMention[] {
  return value
    .split(/;\s*/)
    .map((item) => normalizeWhitespace(item))
    .filter(Boolean)
    .map((item) => {
      const noteMatch = item.match(/^(.*?)\s*\(([^)]+)\)$/);
      if (!noteMatch) {
        return {
          playerName: item,
          note: null
        };
      }

      return {
        playerName: normalizeWhitespace(noteMatch[1] ?? item),
        note: normalizeWhitespace(noteMatch[2] ?? "")
      };
    });
}

function parsePlayerLine(value: string): string[] {
  const normalized = normalizeLineText(value);
  const spacedSplit = normalized
    .split(/\s+--\s+|\s+-\s+/)
    .map((item) => normalizeWhitespace(item))
    .filter(Boolean);

  if (spacedSplit.length > 1) {
    return spacedSplit;
  }

  return normalized
    .split(/\s*(?:--|[-–—/\\•])\s*/)
    .map((item) => normalizeWhitespace(item))
    .filter(Boolean);
}

export function extractStructuredPlayerGroupsFromText(text: string): {
  forwards: string[][];
  defensePairs: string[][];
  goalies: string[];
} {
  const lines = text
    .split(/\n+/)
    .map((line) => normalizeWhitespace(line))
    .filter(Boolean);

  const parsedGroups = lines
    .map((line) => parsePlayerLine(line))
    .filter((group) => group.length > 0 && group.length <= 3);

  return {
    forwards: parsedGroups.filter((group) => group.length === 3).slice(0, 4),
    defensePairs: parsedGroups.filter((group) => group.length === 2).slice(0, 3),
    goalies: parsedGroups.filter((group) => group.length === 1).map((group) => group[0]!).slice(0, 2)
  };
}

function dedupeNames(names: string[]): string[] {
  const seen = new Set<string>();
  const result: string[] = [];
  for (const name of names) {
    const key = normalizeTeamLabel(name);
    if (!key || seen.has(key)) continue;
    seen.add(key);
    result.push(name);
  }
  return result;
}

function buildRosterSearchNeedles(rosterEntry: RosterNameEntry): string[] {
  const needles = new Set<string>();
  const normalizedFullName = normalizeTeamLabel(rosterEntry.fullName);
  const normalizedLastName = normalizeTeamLabel(rosterEntry.lastName);
  if (normalizedFullName) needles.add(normalizedFullName);
  if (normalizedLastName) needles.add(normalizedLastName);

  const parts = rosterEntry.fullName
    .split(/\s+/)
    .map((part) => normalizeWhitespace(part))
    .filter(Boolean);
  if (parts.length >= 2) {
    const initial = normalizeTeamLabel(parts[0]?.[0] ?? "");
    const surname = normalizeTeamLabel(parts.slice(1).join(" "));
    if (initial && surname) {
      needles.add(`${initial} ${surname}`);
      needles.add(`${initial}. ${surname}`);
    }
  }

  for (const alias of GDT_ALIAS_OVERRIDES[normalizedFullName] ?? []) {
    needles.add(normalizeTeamLabel(alias));
  }
  for (const alias of rosterEntry.aliases ?? []) {
    needles.add(normalizeTeamLabel(alias));
  }

  return Array.from(needles.values()).filter(Boolean);
}

function mapNamesToPlayerIdsOrdered(
  names: string[],
  rosterEntries: RosterNameEntry[]
): Array<number | null> {
  const rosterByLastName = new Map<string, RosterNameEntry[]>();

  for (const rosterEntry of rosterEntries) {
    const normalizedLastName = normalizeTeamLabel(rosterEntry.lastName);
    if (!rosterByLastName.has(normalizedLastName)) {
      rosterByLastName.set(normalizedLastName, []);
    }
    rosterByLastName.get(normalizedLastName)?.push(rosterEntry);
  }

  return names.map((name) => {
    const resolvedEntry = resolveTweetNameToRosterEntry(name, rosterEntries);
    if (resolvedEntry) return resolvedEntry.playerId;

    const normalizedName = normalizeTeamLabel(name);
    const lastName = normalizedName.split(" ").pop() ?? normalizedName;
    const byLastName = rosterByLastName.get(lastName) ?? [];
    if (byLastName.length === 1) {
      return byLastName[0].playerId;
    }

    return null;
  });
}

export function resolveTweetNameToRosterEntry(
  rawName: string,
  rosterEntries: RosterNameEntry[]
): RosterNameEntry | null {
  const normalizedName = normalizeTeamLabel(rawName);
  if (!normalizedName) return null;

  for (const rosterEntry of rosterEntries) {
    const needles = buildRosterSearchNeedles(rosterEntry);
    if (needles.includes(normalizedName)) {
      return rosterEntry;
    }
  }

  const lastName = normalizedName.split(" ").pop() ?? normalizedName;
  const lastNameMatches = rosterEntries.filter(
    (entry) => normalizeTeamLabel(entry.lastName) === lastName
  );
  return lastNameMatches.length === 1 ? lastNameMatches[0]! : null;
}

export function validateLineupNames(
  names: string[],
  rosterEntries: RosterNameEntry[]
): NameValidationResult {
  const matchedPlayerIds = new Set<number>();
  const matchedNames = new Set<string>();
  const unmatchedNames: string[] = [];

  const rosterByLastName = new Map<string, RosterNameEntry[]>();

  for (const rosterEntry of rosterEntries) {
    const normalizedLastName = normalizeTeamLabel(rosterEntry.lastName);
    if (!rosterByLastName.has(normalizedLastName)) {
      rosterByLastName.set(normalizedLastName, []);
    }
    rosterByLastName.get(normalizedLastName)?.push(rosterEntry);
  }

  for (const name of dedupeNames(names)) {
    const resolvedEntry = resolveTweetNameToRosterEntry(name, rosterEntries);
    if (resolvedEntry) {
      matchedPlayerIds.add(resolvedEntry.playerId);
      matchedNames.add(resolvedEntry.fullName);
      continue;
    }

    const normalizedName = normalizeTeamLabel(name);
    const lastName = normalizedName.split(" ").pop() ?? normalizedName;
    const lastNameMatches = rosterByLastName.get(lastName) ?? [];
    if (lastNameMatches.length === 1) {
      matchedPlayerIds.add(lastNameMatches[0].playerId);
      matchedNames.add(lastNameMatches[0].fullName);
      continue;
    }

    unmatchedNames.push(name);
  }

  return {
    matchedPlayerIds: Array.from(matchedPlayerIds.values()).sort((a, b) => a - b),
    matchedNames: Array.from(matchedNames.values()).sort((a, b) => a.localeCompare(b)),
    unmatchedNames
  };
}

function buildSourceRecord(args: {
  team: TeamDirectoryEntry;
  sourceName: PregameLineupSourceName;
  sourceUrl: string;
  sourceRank: number;
  isOfficial: boolean;
  status: PregameSourceStatus;
  observedAt?: string | null;
  freshnessExpiresAt?: string | null;
  forwards?: string[][];
  defensePairs?: string[][];
  goalies?: string[];
  scratches?: string[];
  injuries?: InjuryMention[];
  rosterEntries?: RosterNameEntry[];
  metadata?: Record<string, unknown>;
}): ParsedPregameLineupSource {
  const namesToValidate = [
    ...(args.forwards ?? []).flat(),
    ...(args.defensePairs ?? []).flat(),
    ...(args.goalies ?? []),
    ...(args.scratches ?? []),
    ...(args.injuries ?? []).map((item) => item.playerName)
  ];

  return {
    team: args.team,
    sourceName: args.sourceName,
    sourceUrl: args.sourceUrl,
    sourceRank: args.sourceRank,
    isOfficial: args.isOfficial,
    status: args.status,
    observedAt: args.observedAt ?? null,
    freshnessExpiresAt: resolveFreshnessExpiry({
      observedAt: args.observedAt ?? null,
      freshnessExpiresAt: args.freshnessExpiresAt ?? null,
      ttlHours: LINEUP_SOURCE_TTL_HOURS[args.sourceName]
    }),
    forwards: args.forwards ?? [],
    defensePairs: args.defensePairs ?? [],
    goalies: args.goalies ?? [],
    scratches: args.scratches ?? [],
    injuries: args.injuries ?? [],
    validation: validateLineupNames(namesToValidate, args.rosterEntries ?? []),
    metadata: args.metadata ?? {}
  };
}

function parseNhlTeamBlock(
  block: string
): Pick<
  ParsedPregameLineupSource,
  "forwards" | "defensePairs" | "goalies" | "scratches" | "injuries"
> {
  const lines = block
    .split(/\n+/)
    .map((item) => normalizeWhitespace(item))
    .filter(Boolean);

  const playerGroups: string[][] = [];
  let scratches: string[] = [];
  let injuries: InjuryMention[] = [];

  for (const line of lines) {
    if (/^\*\*status report\*\*$/i.test(line)) break;
    const scratchedMatch = line.match(/^\*\*scratched:\*\*\s*(.+)$/i);
    if (scratchedMatch) {
      scratches = splitCommaList(scratchedMatch[1] ?? "");
      continue;
    }
    const injuredMatch = line.match(/^\*\*injured:\*\*\s*(.+)$/i);
    if (injuredMatch) {
      injuries = parseInjuryList(injuredMatch[1] ?? "");
      continue;
    }

    const parsedGroup = parsePlayerLine(line);
    if (parsedGroup.length > 0) {
      playerGroups.push(parsedGroup);
    }
  }

  const forwards = playerGroups.filter((group) => group.length === 3).slice(0, 4);
  const defensePairs = playerGroups.filter((group) => group.length === 2).slice(0, 3);
  const groupedNames = new Set(
    [...forwards.flat(), ...defensePairs.flat()].map((name) => normalizeTeamLabel(name))
  );
  const goalies = playerGroups
    .filter((group) => group.length === 1)
    .map((group) => group[0])
    .filter((name) => !groupedNames.has(normalizeTeamLabel(name)))
    .slice(0, 2);

  return {
    forwards,
    defensePairs,
    goalies,
    scratches,
    injuries
  };
}

export function parseNhlLineupProjectionsPage(args: {
  html: string;
  teams: TeamDirectoryEntry[];
  sourceUrl: string;
  observedAt?: string | null;
  rosterByTeam?: Map<number, RosterNameEntry[]>;
}): ParsedPregameLineupSource[] {
  const $ = cheerio.load(args.html);
  const bodyText = $("body").text().replace(/\r/g, "");
  const normalizedText = `\n${bodyText.replace(/\u00a0/g, " ")}`;
  const blockPattern =
    /(?:^|\n+)\s*\*{0,2}([A-Za-zÀ-ÿ .'-]+?) projected lineup\*{0,2}\s*\n+([\s\S]*?)(?=(?:\n+\s*\*{0,2}[A-Za-zÀ-ÿ .'-]+? projected lineup\*{0,2}\s*\n)|$)/gi;

  const results: ParsedPregameLineupSource[] = [];
  let match: RegExpExecArray | null;

  while ((match = blockPattern.exec(normalizedText)) !== null) {
    const teamLabel = normalizeWhitespace(match[1] ?? "");
    const team = resolveTeamEntry(teamLabel, args.teams);
    if (!team) continue;

    const parsedBlock = parseNhlTeamBlock(match[2] ?? "");
    results.push(
      buildSourceRecord({
        team,
        sourceName: "nhl.com",
        sourceUrl: args.sourceUrl,
        sourceRank: 1,
        isOfficial: true,
        status: "observed",
        observedAt: args.observedAt ?? new Date().toISOString(),
        freshnessExpiresAt: null,
        rosterEntries: args.rosterByTeam?.get(team.id) ?? [],
        metadata: {
          teamLabel
        },
        ...parsedBlock
      })
    );
  }

  return results;
}

export type GameDayTweetOEmbedData = {
  text: string | null;
  postedAt: string | null;
  postedLabel: string | null;
  sourceTweetUrl: string | null;
};

function parseDateLabelToIso(dateLabel: string | null | undefined): string | null {
  if (!dateLabel) return null;
  const parsed = Date.parse(`${String(dateLabel).trim()} 00:00:00 UTC`);
  if (!Number.isFinite(parsed)) {
    return null;
  }
  return new Date(parsed).toISOString();
}

export async function fetchGameDayTweetOEmbedData(
  tweetUrl: string
): Promise<GameDayTweetOEmbedData | null> {
  const endpoint = `https://publish.twitter.com/oembed?omit_script=true&dnt=true&url=${encodeURIComponent(tweetUrl)}`;
  const response = await fetch(endpoint, {
    headers: {
      Accept: "application/json",
      "User-Agent": "fhfhockey/1.0 (+https://fhfhockey.com)"
    },
    cache: "no-store"
  });

  if (!response.ok) {
    return null;
  }

  const payload = (await response.json()) as { html?: string };
  if (!payload.html) {
    return null;
  }

  const parsed = parseTweetOEmbedHtml(payload.html);

  return {
    text: parsed.text,
    postedAt: parseDateLabelToIso(parsed.postedLabel),
    postedLabel: parsed.postedLabel,
    sourceTweetUrl: parsed.sourceTweetUrl
  };
}

function parseLinkedPlayerNamesFromHtml(fragmentHtml: string): string[] {
  const $ = cheerio.load(fragmentHtml);
  return dedupeNames(
    $('a[href^="/players/news/"] span')
      .map((_, element) => normalizeWhitespace($(element).text()))
      .get()
      .filter(Boolean)
  );
}

function extractHtmlBetween(html: string, startMarker: string, endMarker?: string): string {
  const startIndex = html.indexOf(startMarker);
  if (startIndex < 0) return "";
  const sliced = html.slice(startIndex);
  if (!endMarker) return sliced;
  const endIndex = sliced.indexOf(endMarker);
  return endIndex < 0 ? sliced : sliced.slice(0, endIndex);
}

export function parseDailyFaceoffLineCombinationsPage(args: {
  html: string;
  team: TeamDirectoryEntry;
  rosterEntries?: RosterNameEntry[];
  sourceUrl: string;
  observedAt?: string | null;
}): ParsedPregameLineupSource {
  const bodyText = normalizeWhitespace(cheerio.load(args.html)("body").text());
  const sourceMatch = bodyText.match(/Source:\s*([^<]+?)(?=Last updated:|Line Combos|News|Stats|Schedule|$)/i);
  const lastUpdatedMatch = bodyText.match(/Last updated:\s*([0-9TZ:.\-]+)/i);
  const sourceLabel = normalizeWhitespace(sourceMatch?.[1] ?? "");
  const isLastGame = /last game/i.test(sourceLabel);

  const forwardsHtml = extractHtmlBetween(args.html, 'id="forwards"', 'id="defense"');
  const defenseHtml = extractHtmlBetween(args.html, 'id="defense"', 'id="powerplay"');
  const goaliesHtml = extractHtmlBetween(args.html, 'id="goalies"');

  const forwardsFlat = parseLinkedPlayerNamesFromHtml(forwardsHtml).slice(0, 12);
  const defenseFlat = parseLinkedPlayerNamesFromHtml(defenseHtml).slice(0, 6);
  const goalies = parseLinkedPlayerNamesFromHtml(goaliesHtml).slice(0, 2);

  const forwards = Array.from({ length: Math.floor(forwardsFlat.length / 3) }, (_, index) =>
    forwardsFlat.slice(index * 3, index * 3 + 3)
  ).filter((line) => line.length === 3);
  const defensePairs = Array.from(
    { length: Math.floor(defenseFlat.length / 2) },
    (_, index) => defenseFlat.slice(index * 2, index * 2 + 2)
  ).filter((pair) => pair.length === 2);

  return buildSourceRecord({
    team: args.team,
    sourceName: "dailyfaceoff",
    sourceUrl: args.sourceUrl,
    sourceRank: 2,
    isOfficial: false,
    status: isLastGame ? "rejected" : "observed",
    observedAt: args.observedAt ?? lastUpdatedMatch?.[1] ?? new Date().toISOString(),
    freshnessExpiresAt: null,
    rosterEntries: args.rosterEntries ?? [],
    forwards,
    defensePairs,
    goalies,
    metadata: {
      sourceLabel: sourceLabel || null,
      lastUpdated: lastUpdatedMatch?.[1] ?? null,
      pageState: isLastGame ? "last_game" : "current"
    }
  });
}

export function classifyGameDayTweet(text: string): GameDayTweetsClassification {
  const normalized = normalizeTeamLabel(text);
  GDT_INLINE_LINE_PATTERN.lastIndex = 0;

  if (GDT_POWERPLAY_KEYWORDS.some((keyword) => normalized.includes(keyword))) {
    return "power_play";
  }
  if (GDT_GOALIE_KEYWORDS.some((keyword) => normalized.includes(keyword))) {
    return "goalie_start";
  }
  if (GDT_INJURY_KEYWORDS.some((keyword) => normalized.includes(keyword))) {
    return "injury";
  }
  if (GDT_PRACTICE_KEYWORDS.some((keyword) => normalized.includes(keyword))) {
    return "practice_lines";
  }
  if (
    GDT_LINEUP_KEYWORDS.some((keyword) => normalized.includes(keyword)) ||
    GDT_INLINE_LINE_PATTERN.test(text)
  ) {
    return "lineup";
  }
  return "other";
}

export function findGameDayTweetKeywordHits(text: string): string[] {
  const normalized = normalizeTeamLabel(text);
  const keywords = [
    ...GDT_LINEUP_KEYWORDS,
    ...GDT_PRACTICE_KEYWORDS,
    ...GDT_POWERPLAY_KEYWORDS,
    ...GDT_GOALIE_KEYWORDS,
    ...GDT_INJURY_KEYWORDS
  ];

  return dedupeNames(
    keywords.filter((keyword) => normalized.includes(normalizeTeamLabel(keyword)))
  );
}

export function matchRosterNamesInTweet(
  tweetText: string,
  rosterEntries: RosterNameEntry[]
): NameValidationResult {
  const normalizedTweet = normalizeTeamLabel(tweetText);
  const matchedFullNames: string[] = [];
  const matchedLastNames: string[] = [];

  for (const rosterEntry of rosterEntries) {
    const needles = buildRosterSearchNeedles(rosterEntry);
    const normalizedLastName = normalizeTeamLabel(rosterEntry.lastName);
    const matchedSpecificNeedle = needles.find(
      (needle) => needle !== normalizedLastName && normalizedTweet.includes(needle)
    );
    if (matchedSpecificNeedle) {
      matchedFullNames.push(rosterEntry.fullName);
      continue;
    }
    if (normalizedLastName && normalizedTweet.includes(normalizedLastName)) {
      matchedLastNames.push(rosterEntry.lastName);
    }
  }

  return validateLineupNames(
    [...matchedFullNames, ...matchedLastNames],
    rosterEntries
  );
}

export function extractOrderedRosterHitsFromTweet(
  tweetText: string,
  rosterEntries: RosterNameEntry[]
): string[] {
  const normalizedTweet = normalizeTeamLabel(tweetText);
  const matches = rosterEntries
    .map((rosterEntry) => {
      const needles = buildRosterSearchNeedles(rosterEntry);
      const indexes = needles
        .map((needle) => normalizedTweet.indexOf(needle))
        .filter((index) => index >= 0);
      const fullNameIndex = indexes.length > 0 ? Math.min(...indexes) : -1;
      const lastNameNeedle = normalizeTeamLabel(rosterEntry.lastName);
      const lastNameIndex = lastNameNeedle ? normalizedTweet.indexOf(lastNameNeedle) : -1;
      const index =
        fullNameIndex >= 0
          ? fullNameIndex
          : lastNameIndex >= 0
            ? lastNameIndex
            : Number.POSITIVE_INFINITY;

      return {
        name: rosterEntry.fullName,
        index
      };
    })
    .filter((entry) => Number.isFinite(entry.index))
    .sort((left, right) => left.index - right.index);

  return dedupeNames(matches.map((entry) => entry.name));
}

export function extractStructuredNameGroupsFromTweet(
  tweetText: string
): {
  forwardLineCount: number;
  defensePairCount: number;
} {
  GDT_INLINE_LINE_PATTERN.lastIndex = 0;
  GDT_INLINE_PAIR_PATTERN.lastIndex = 0;
  const forwardLineCount = Array.from(tweetText.matchAll(GDT_INLINE_LINE_PATTERN)).length;
  GDT_INLINE_PAIR_PATTERN.lastIndex = 0;
  const pairCandidates = Array.from(tweetText.matchAll(GDT_INLINE_PAIR_PATTERN)).length;

  return {
    forwardLineCount,
    defensePairCount: Math.max(0, pairCandidates - forwardLineCount * 2)
  };
}

function escapeRegExp(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

export function buildGameDayTweetsLineupSourceFromTweet(args: {
  team: TeamDirectoryEntry;
  rosterEntries?: RosterNameEntry[];
  sourceUrl: string;
  tweet: ParsedGameDayTweet;
  enrichedText?: string | null;
  enrichedPostedAt?: string | null;
  enrichedPostedLabel?: string | null;
  enrichedSourceTweetUrl?: string | null;
}): ParsedPregameLineupSource | null {
  const rosterEntries = args.rosterEntries ?? [];
  const text = args.enrichedText && args.enrichedText.trim() ? args.enrichedText : args.tweet.text;
  const validation = matchRosterNamesInTweet(text, rosterEntries);

  if (
    args.tweet.classification !== "lineup" &&
    args.tweet.classification !== "practice_lines"
  ) {
    return null;
  }

  if (validation.matchedPlayerIds.length < 6) {
    return null;
  }

  const structured = extractStructuredPlayerGroupsFromText(text);
  let forwards = structured.forwards
    .map((line) =>
      line.map((name) => resolveTweetNameToRosterEntry(name, rosterEntries)?.fullName ?? name)
    )
    .filter((line) => line.length === 3);
  let defensePairs = structured.defensePairs
    .map((pair) =>
      pair.map((name) => resolveTweetNameToRosterEntry(name, rosterEntries)?.fullName ?? name)
    )
    .filter((pair) => pair.length === 2);
  let goalies = structured.goalies
    .map((name) => resolveTweetNameToRosterEntry(name, rosterEntries)?.fullName ?? null)
    .filter((name): name is string => Boolean(name));

  if (forwards.length === 0 && defensePairs.length === 0) {
    const orderedRosterHits = extractOrderedRosterHitsFromTweet(text, rosterEntries);
    forwards = Array.from(
      { length: Math.floor(Math.min(orderedRosterHits.length, 12) / 3) },
      (_, index) => orderedRosterHits.slice(index * 3, index * 3 + 3)
    ).filter((line) => line.length === 3);
    const defenseStartIndex = forwards.length * 3;
    const defenseHits = orderedRosterHits.slice(defenseStartIndex, defenseStartIndex + 6);
    defensePairs = Array.from(
      { length: Math.floor(defenseHits.length / 2) },
      (_, index) => defenseHits.slice(index * 2, index * 2 + 2)
    ).filter((pair) => pair.length === 2);
    goalies = orderedRosterHits.slice(forwards.length * 3 + defensePairs.length * 2).slice(0, 2);
  }

  return buildSourceRecord({
    team: args.team,
    sourceName: "gamedaytweets",
    sourceUrl: args.enrichedSourceTweetUrl ?? args.tweet.tweetUrl ?? args.sourceUrl,
    sourceRank: 3,
    isOfficial: false,
    status: "observed",
    observedAt: null,
    freshnessExpiresAt: null,
    rosterEntries,
    forwards,
    defensePairs,
    goalies,
    metadata: {
      candidateClassification: args.tweet.classification,
      tweetUrl: args.enrichedSourceTweetUrl ?? args.tweet.tweetUrl,
      tweetPostedAt: args.enrichedPostedAt ?? args.tweet.postedAt,
      tweetPostedLabel: args.enrichedPostedLabel ?? args.tweet.postedLabel,
      tweetPostedPrecision:
        (args.enrichedPostedAt ?? args.tweet.postedAt) ? "day" : null,
      matchedPlayerIds: validation.matchedPlayerIds,
      matchedNames: validation.matchedNames,
      unmatchedNames: validation.unmatchedNames,
      structureSignals: {
        ...extractStructuredNameGroupsFromTweet(text),
        keywordHits: findGameDayTweetKeywordHits(text)
      },
      text,
      textSource:
        args.enrichedText && args.enrichedText.trim() ? "twitter-oembed" : "gdt-html"
    }
  });
}

export function parseGameDayTweetsLinesPage(args: {
  html: string;
  team: TeamDirectoryEntry;
  rosterEntries?: RosterNameEntry[];
  sourceUrl: string;
}): {
  selectedLineup: ParsedPregameLineupSource | null;
  tweets: ParsedGameDayTweet[];
} {
  const root = cheerio.load(args.html);
  const rosterEntries = args.rosterEntries ?? [];

  const tweets = root("blockquote.tweet")
    .map((_, element) => {
      const tweetRoot = root(element);
      const text = normalizeWhitespace(tweetRoot.text());
      const links = tweetRoot
        .find("a")
        .map((__, link) => root(link).attr("href"))
        .get()
        .filter((href): href is string => Boolean(href));

      const validation = matchRosterNamesInTweet(text, rosterEntries);
      const structureSignals = extractStructuredNameGroupsFromTweet(text);

      return {
        classification: classifyGameDayTweet(text),
        sourceHandle: links.find((href) => /twitter\.com\/[^/]+$/i.test(href)) ?? null,
        sourceUrl: args.sourceUrl,
        tweetUrl: links.find((href) => /twitter\.com\/GameDayLines\/status\//i.test(href)) ?? null,
        postedLabel: text.match(/([A-Z][a-z]{2} \d{1,2}, \d{4})$/)?.[1] ?? null,
        postedAt: parseDateLabelToIso(text.match(/([A-Z][a-z]{2} \d{1,2}, \d{4})$/)?.[1] ?? null),
        text,
        structureSignals: {
          ...structureSignals,
          keywordHits: findGameDayTweetKeywordHits(text)
        },
        matchedPlayerIds: validation.matchedPlayerIds,
        matchedNames: validation.matchedNames,
        unmatchedNames: validation.unmatchedNames
      } satisfies ParsedGameDayTweet;
    })
    .get();

  const candidate = tweets
    .filter(
      (tweet) =>
        (tweet.classification === "lineup" || tweet.classification === "practice_lines") &&
        tweet.matchedPlayerIds.length >= 6
    )
    .sort((left, right) => {
      const leftScore =
        left.structureSignals.forwardLineCount * 6 +
        left.structureSignals.defensePairCount * 3 +
        left.structureSignals.keywordHits.length +
        left.matchedPlayerIds.length;
      const rightScore =
        right.structureSignals.forwardLineCount * 6 +
        right.structureSignals.defensePairCount * 3 +
        right.structureSignals.keywordHits.length +
        right.matchedPlayerIds.length;
      return rightScore - leftScore;
    })[0];

  if (!candidate) {
    return {
      selectedLineup: null,
      tweets
    };
  }

  return {
    selectedLineup: buildGameDayTweetsLineupSourceFromTweet({
      team: args.team,
      rosterEntries,
      sourceUrl: args.sourceUrl,
      tweet: candidate
    }),
    tweets
  };
}

export function selectBestPregameLineupSource(
  sources: Array<ParsedPregameLineupSource | null | undefined>,
  now: string | number | Date = Date.now()
): ParsedPregameLineupSource | null {
  const eligible = sources.filter(
    (source): source is ParsedPregameLineupSource =>
      Boolean(
        source &&
          isSourceFresh({
            status: source.status,
            observedAt: source.observedAt,
            freshnessExpiresAt: source.freshnessExpiresAt,
            now
          })
      )
  );
  if (eligible.length === 0) return null;

  const accepted = eligible.filter((source) => {
    if (source.sourceName === "nhl.com") {
      return source.forwards.length >= 3 && source.goalies.length >= 1;
    }
    if (source.sourceName === "dailyfaceoff") {
      return (
        source.forwards.length >= 3 &&
        source.defensePairs.length >= 2 &&
        source.validation.matchedPlayerIds.length >= 8
      );
    }
    return source.validation.matchedPlayerIds.length >= 6;
  });

  const pool = accepted.length > 0 ? accepted : eligible;
  return pool.sort((left, right) => {
    if (left.sourceRank !== right.sourceRank) {
      return left.sourceRank - right.sourceRank;
    }

    const leftObserved = left.observedAt ? Date.parse(left.observedAt) : 0;
    const rightObserved = right.observedAt ? Date.parse(right.observedAt) : 0;
    if (leftObserved !== rightObserved) {
      return rightObserved - leftObserved;
    }

    return right.validation.matchedPlayerIds.length - left.validation.matchedPlayerIds.length;
  })[0];
}

function buildGoalieStartSource(args: {
  team: TeamDirectoryEntry;
  sourceName:
    | "nhl.com"
    | "dailyfaceoff"
    | "gamedaytweets"
    | "goalie_start_projections";
  sourceUrl: string;
  sourceRank: number;
  isOfficial: boolean;
  status: PregameSourceStatus;
  goalieName: string;
  backupGoalieName?: string | null;
  startStatus: GoalieStartConfidenceLabel;
  confidenceScore?: number | null;
  observedAt?: string | null;
  freshnessExpiresAt?: string | null;
  rosterEntries?: RosterNameEntry[];
  metadata?: Record<string, unknown>;
}): ParsedGoalieStartSource {
  const validation = validateLineupNames([args.goalieName], args.rosterEntries ?? []);
  return {
    team: args.team,
    sourceName: args.sourceName,
    sourceUrl: args.sourceUrl,
    sourceRank: args.sourceRank,
    isOfficial: args.isOfficial,
    status: args.status,
    goalieName: args.goalieName,
    goaliePlayerId: validation.matchedPlayerIds[0] ?? null,
    backupGoalieName: args.backupGoalieName ?? null,
    startStatus: args.startStatus,
    confidenceScore: args.confidenceScore ?? null,
    observedAt: args.observedAt ?? null,
    freshnessExpiresAt: resolveFreshnessExpiry({
      observedAt: args.observedAt ?? null,
      freshnessExpiresAt: args.freshnessExpiresAt ?? null,
      ttlHours: GOALIE_SOURCE_TTL_HOURS[args.sourceName]
    }),
    metadata: {
      ...args.metadata,
      validation
    }
  };
}

function classifyGameDayGoalieStartStatus(
  value: string
): GoalieStartConfidenceLabel {
  const normalized = normalizeTeamLabel(value);
  if (
    /\b(warmup|lead[s]? .* out for warmup|starting|gets the start|gets the nod|will start|in net)\b/i.test(
      normalized
    )
  ) {
    return "confirmed";
  }
  if (/\b(our guess|guess)\b/i.test(normalized)) {
    return "projected";
  }
  if (/\b(likely|expected|should start)\b/i.test(normalized)) {
    return "likely";
  }
  return "unconfirmed";
}

function resolveTeamByFullName(value: string, teams: TeamDirectoryEntry[]): TeamDirectoryEntry | null {
  const normalizedValue = normalizeTeamLabel(value);
  return (
    teams.find((team) => normalizeTeamLabel(team.name) === normalizedValue) ?? null
  );
}

export function parseDailyFaceoffStartingGoaliesPage(args: {
  html: string;
  teams: TeamDirectoryEntry[];
  rosterByTeam?: Map<number, RosterNameEntry[]>;
  sourceUrl: string;
}): ParsedGoalieStartSource[] {
  const text = cheerio.load(args.html)("body").text().replace(/\s+/g, " ").trim();
  const matchupPattern =
    /([A-Z][A-Za-z .'-]+ at [A-Z][A-Za-z .'-]+)(?=\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z)/g;
  const matchupMatches = Array.from(text.matchAll(matchupPattern));
  const results: ParsedGoalieStartSource[] = [];

  for (let index = 0; index < matchupMatches.length; index += 1) {
    const currentMatch = matchupMatches[index];
    const nextMatch = matchupMatches[index + 1];
    const matchupLabel = normalizeWhitespace(currentMatch[1] ?? "");
    const blockStart = (currentMatch.index ?? 0) + currentMatch[0].length;
    const blockEnd = nextMatch?.index ?? text.length;
    const block = text.slice(blockStart, blockEnd);
    const [awayLabel, homeLabel] = matchupLabel.split(/\s+at\s+/i);
    const awayTeam = resolveTeamByFullName(awayLabel ?? "", args.teams);
    const homeTeam = resolveTeamByFullName(homeLabel ?? "", args.teams);
    if (!awayTeam || !homeTeam) continue;

    const extractGoalieFromBlock = (
      goalieName: string | undefined,
      team: TeamDirectoryEntry
    ) => {
      if (!goalieName) return null;
      const goalieIndex = block.indexOf(goalieName);
      if (goalieIndex < 0) return null;
      const segment = block.slice(goalieIndex);
      const match = segment.match(
        new RegExp(
          `^${escapeRegExp(goalieName)}(Confirmed|Likely|Unconfirmed)\\s*(?:(\\d{4}-\\d{2}-\\d{2}T\\d{2}:\\d{2}:\\d{2}\\.\\d{3}Z))?\\s*Show More([\\s\\S]*)$`,
          "i"
        )
      );
      if (!match) return null;
      const trailing = normalizeWhitespace(match[3] ?? "");
      const sourceMatch = trailing.match(/Source:\s*(.+)$/i);
      return buildGoalieStartSource({
        team,
        sourceName: "dailyfaceoff",
        sourceUrl: args.sourceUrl,
        sourceRank: 1,
        isOfficial: false,
        status: "observed",
        goalieName,
        startStatus: normalizeTeamLabel(match[1] ?? "unconfirmed") as GoalieStartConfidenceLabel,
        observedAt: match[2] ?? null,
        rosterEntries: args.rosterByTeam?.get(team.id) ?? [],
        metadata: {
          matchup: matchupLabel,
          sourceLabel: normalizeWhitespace(sourceMatch?.[1] ?? "") || null
        }
      });
    };

    const awayGoalieName = extractOrderedRosterHitsFromTweet(
      block,
      args.rosterByTeam?.get(awayTeam.id) ?? []
    )[0];
    const homeGoalieName = extractOrderedRosterHitsFromTweet(
      block,
      args.rosterByTeam?.get(homeTeam.id) ?? []
    )[0];

    const awayGoalie = extractGoalieFromBlock(awayGoalieName, awayTeam);
    const homeGoalie = extractGoalieFromBlock(homeGoalieName, homeTeam);

    if (awayGoalie) {
      results.push(
        awayGoalie
      );
    }

    if (homeGoalie) {
      results.push(
        homeGoalie
      );
    }
  }

  return results;
}

export function parseGameDayTweetsGoaliesPage(args: {
  html: string;
  teams: TeamDirectoryEntry[];
  rosterByTeam?: Map<number, RosterNameEntry[]>;
  sourceUrl: string;
}): ParsedGoalieStartSource[] {
  const root = cheerio.load(args.html);
  const results: ParsedGoalieStartSource[] = [];

  root("h1.text-3xl").each((_, headerElement) => {
    const header = root(headerElement);
    const teamLabels = header
      .find("div.flex-row")
      .map((__, section) => normalizeWhitespace(root(section).text()))
      .get()
      .filter(Boolean);

    const awayTeam = resolveTeamByFullName(teamLabels[0] ?? "", args.teams);
    const homeTeam = resolveTeamByFullName(teamLabels[1] ?? "", args.teams);
    if (!awayTeam || !homeTeam) return;

    const matchupBody = header.nextAll("div.text-2xl").first();
    if (!matchupBody.length) return;

    const columns = matchupBody
      .children("div.flex-col")
      .toArray()
      .slice(0, 2)
      .map((element) => root(element));
    if (columns.length < 2) return;

    const parseColumn = (
      column: cheerio.Cheerio<any>,
      team: TeamDirectoryEntry
    ) => {
      const rosterEntries = args.rosterByTeam?.get(team.id) ?? [];
      const tweet = column.find("blockquote.tweet").first();
      const guess = column.find("span").filter((__, element) => {
        const text = normalizeWhitespace(root(element).text());
        return /our guess:/i.test(text);
      });

      if (tweet.length > 0) {
        const text = normalizeWhitespace(tweet.text());
        const goalieName = extractOrderedRosterHitsFromTweet(text, rosterEntries)[0] ?? null;
        if (!goalieName) return null;

        return buildGoalieStartSource({
          team,
          sourceName: "gamedaytweets",
          sourceUrl:
            tweet
              .find('a[href*="twitter.com/GameDayGoalies/status/"]')
              .attr("href") ?? args.sourceUrl,
          sourceRank: 2,
          isOfficial: false,
          status: "observed",
          goalieName,
          startStatus: classifyGameDayGoalieStartStatus(text),
          rosterEntries,
          metadata: {
            page: "goalies",
            sourceHandle: tweet.find("a.handle").attr("href") ?? null,
            text
          }
        });
      }

      if (guess.length > 0) {
        const goalieName = normalizeWhitespace(guess.find("strong").first().text());
        if (!goalieName) return null;

        return buildGoalieStartSource({
          team,
          sourceName: "gamedaytweets",
          sourceUrl: args.sourceUrl,
          sourceRank: 2,
          isOfficial: false,
          status: "observed",
          goalieName,
          startStatus: "projected",
          rosterEntries,
          metadata: {
            page: "goalies",
            sourceLabel: "Our Guess"
          }
        });
      }

      return null;
    };

    const awayGoalie = parseColumn(columns[0]!, awayTeam);
    if (awayGoalie) results.push(awayGoalie);

    const homeGoalie = parseColumn(columns[1]!, homeTeam);
    if (homeGoalie) results.push(homeGoalie);
  });

  return results;
}

export function buildGoalieStartSourceFromOfficialLineup(args: {
  lineupSource: ParsedPregameLineupSource;
  rosterEntries?: RosterNameEntry[];
}): ParsedGoalieStartSource | null {
  const starter = args.lineupSource.goalies[0];
  if (!starter) return null;

  return buildGoalieStartSource({
    team: args.lineupSource.team,
    sourceName: "nhl.com",
    sourceUrl: args.lineupSource.sourceUrl,
    sourceRank: 3,
    isOfficial: true,
    status: args.lineupSource.status,
    goalieName: starter,
    backupGoalieName: args.lineupSource.goalies[1] ?? null,
    startStatus: "projected",
    observedAt: args.lineupSource.observedAt,
    rosterEntries: args.rosterEntries ?? [],
    metadata: {
      basedOn: "official-lineup-projections"
    }
  });
}

export function buildGoalieStartSourceFromModel(args: {
  team: TeamDirectoryEntry;
  sourceUrl: string;
  goalieName: string;
  goaliePlayerId: number;
  startProbability: number;
  observedAt?: string | null;
}): ParsedGoalieStartSource {
  return {
    team: args.team,
    sourceName: "goalie_start_projections",
    sourceUrl: args.sourceUrl,
    sourceRank: 4,
    isOfficial: false,
    status: "observed",
    goalieName: args.goalieName,
    goaliePlayerId: args.goaliePlayerId,
    backupGoalieName: null,
    startStatus: "model",
    confidenceScore: args.startProbability,
    observedAt: args.observedAt ?? null,
    freshnessExpiresAt: null,
    metadata: {
      startProbability: args.startProbability
    }
  };
}

export function selectBestGoalieStartSource(
  sources: Array<ParsedGoalieStartSource | null | undefined>,
  now: string | number | Date = Date.now()
): ParsedGoalieStartSource | null {
  const eligible = sources.filter(
    (source): source is ParsedGoalieStartSource =>
      Boolean(
        source &&
          source.goaliePlayerId != null &&
          isSourceFresh({
            status: source.status,
            observedAt: source.observedAt,
            freshnessExpiresAt: source.freshnessExpiresAt,
            now
          })
      )
  );
  if (eligible.length === 0) return null;

  const statusRank = (status: GoalieStartConfidenceLabel) => {
    switch (status) {
      case "confirmed":
        return 1;
      case "likely":
        return 2;
      case "unconfirmed":
        return 3;
      case "projected":
        return 4;
      case "model":
      default:
        return 5;
    }
  };

  return eligible.sort((left, right) => {
    const leftStatusRank = statusRank(left.startStatus);
    const rightStatusRank = statusRank(right.startStatus);
    if (leftStatusRank !== rightStatusRank) {
      return leftStatusRank - rightStatusRank;
    }
    if (left.sourceRank !== right.sourceRank) {
      return left.sourceRank - right.sourceRank;
    }
    return (right.confidenceScore ?? 0) - (left.confidenceScore ?? 0);
  })[0];
}

export type SourceProvenanceSnapshotRow = {
  snapshot_date: string;
  source_type: string;
  entity_type: string;
  entity_id: number;
  game_id: number | null;
  source_name: string;
  source_url: string | null;
  source_rank: number;
  is_official: boolean;
  status: string;
  observed_at: string;
  freshness_expires_at: string | null;
  payload: Record<string, unknown>;
  metadata: Record<string, unknown>;
  updated_at: string;
};

export function toSourceProvenanceSnapshotRow(args: {
  snapshotDate: string;
  gameId: number | null;
  sourceType: "lineup";
  source: ParsedPregameLineupSource;
  selectedSourceName?: PregameLineupSourceName | null;
}): SourceProvenanceSnapshotRow {
  const isSelected = args.selectedSourceName === args.source.sourceName;
  return {
    snapshot_date: args.snapshotDate,
    source_type: args.sourceType,
    entity_type: "team",
    entity_id: args.source.team.id,
    game_id: args.gameId,
    source_name: args.source.sourceName,
    source_url: args.source.sourceUrl,
    source_rank: args.source.sourceRank,
    is_official: args.source.isOfficial,
    status:
      args.source.status === "rejected"
        ? "rejected"
        : isSelected
          ? "observed"
          : "superseded",
    observed_at: args.source.observedAt ?? new Date().toISOString(),
    freshness_expires_at: args.source.freshnessExpiresAt,
    payload: {
      forwards: args.source.forwards,
      defensePairs: args.source.defensePairs,
      goalies: args.source.goalies,
      scratches: args.source.scratches,
      injuries: args.source.injuries
    },
    metadata: {
      ...args.source.metadata,
      validation: args.source.validation,
      selected: isSelected
    },
    updated_at: new Date().toISOString()
  };
}

export function toGoalieStartProvenanceSnapshotRow(args: {
  snapshotDate: string;
  gameId: number | null;
  source: ParsedGoalieStartSource;
  selectedSourceName?: ParsedGoalieStartSource["sourceName"] | null;
}): SourceProvenanceSnapshotRow | null {
  if (args.source.goaliePlayerId == null) {
    return null;
  }

  const isSelected = args.selectedSourceName === args.source.sourceName;
  return {
    snapshot_date: args.snapshotDate,
    source_type: "goalie_start",
    entity_type: "goalie",
    entity_id: args.source.goaliePlayerId,
    game_id: args.gameId,
    source_name: args.source.sourceName,
    source_url: args.source.sourceUrl,
    source_rank: args.source.sourceRank,
    is_official: args.source.isOfficial,
    status: isSelected ? "observed" : "superseded",
    observed_at: args.source.observedAt ?? new Date().toISOString(),
    freshness_expires_at: args.source.freshnessExpiresAt,
    payload: {
      goalieName: args.source.goalieName,
      backupGoalieName: args.source.backupGoalieName,
      startStatus: args.source.startStatus,
      confidenceScore: args.source.confidenceScore
    },
    metadata: args.source.metadata,
    updated_at: new Date().toISOString()
  };
}

export function toHistoricalLineSourceRow(args: {
  snapshotDate: string;
  gameId: number | null;
  source: ParsedPregameLineupSource;
  rosterEntries?: RosterNameEntry[];
}): HistoricalLineSourceRow {
  const rosterEntries = args.rosterEntries ?? [];
  const toStoredForwardOrder = (players: string[] | null) =>
    players && players.length === 3 ? [players[2], players[1], players[0]] : players;
  const toStoredDefenseOrder = (players: string[] | null) =>
    players && players.length === 2 ? [players[1], players[0]] : players;
  const line = (index: number) => toStoredForwardOrder(args.source.forwards[index] ?? null);
  const pair = (index: number) => toStoredDefenseOrder(args.source.defensePairs[index] ?? null);
  const goalie1 = args.source.goalies[0] ?? null;
  const goalie2 = args.source.goalies[1] ?? null;
  const sourceLabel =
    typeof args.source.metadata.sourceLabel === "string"
      ? String(args.source.metadata.sourceLabel)
      : typeof args.source.metadata.candidateClassification === "string"
        ? String(args.source.metadata.candidateClassification)
        : null;
  const observedAt = args.source.observedAt ?? new Date().toISOString();

  return {
    capture_key: [
      args.snapshotDate,
      args.source.team.id,
      args.source.sourceName,
      args.gameId ?? "no-game",
      observedAt,
      args.source.sourceUrl
    ].join(":"),
    snapshot_date: args.snapshotDate,
    observed_at: observedAt,
    tweet_posted_at:
      args.source.sourceName === "gamedaytweets" &&
      typeof args.source.metadata.tweetPostedAt === "string"
        ? String(args.source.metadata.tweetPostedAt)
        : null,
    game_id: args.gameId,
    team_id: args.source.team.id,
    team_abbreviation: args.source.team.abbreviation,
    team_name: args.source.team.name,
    source: args.source.sourceName,
    source_url: args.source.sourceUrl,
    source_label: sourceLabel,
    status: args.source.status,
    line_1_player_ids: line(0) ? mapNamesToPlayerIdsOrdered(line(0) ?? [], rosterEntries) : null,
    line_1_player_names: line(0),
    line_2_player_ids: line(1) ? mapNamesToPlayerIdsOrdered(line(1) ?? [], rosterEntries) : null,
    line_2_player_names: line(1),
    line_3_player_ids: line(2) ? mapNamesToPlayerIdsOrdered(line(2) ?? [], rosterEntries) : null,
    line_3_player_names: line(2),
    line_4_player_ids: line(3) ? mapNamesToPlayerIdsOrdered(line(3) ?? [], rosterEntries) : null,
    line_4_player_names: line(3),
    pair_1_player_ids: pair(0) ? mapNamesToPlayerIdsOrdered(pair(0) ?? [], rosterEntries) : null,
    pair_1_player_names: pair(0),
    pair_2_player_ids: pair(1) ? mapNamesToPlayerIdsOrdered(pair(1) ?? [], rosterEntries) : null,
    pair_2_player_names: pair(1),
    pair_3_player_ids: pair(2) ? mapNamesToPlayerIdsOrdered(pair(2) ?? [], rosterEntries) : null,
    pair_3_player_names: pair(2),
    goalie_1_player_id: goalie1 ? mapNamesToPlayerIdsOrdered([goalie1], rosterEntries)[0] : null,
    goalie_1_name: goalie1,
    goalie_2_player_id: goalie2 ? mapNamesToPlayerIdsOrdered([goalie2], rosterEntries)[0] : null,
    goalie_2_name: goalie2,
    scratches_player_ids:
      args.source.scratches.length > 0
        ? mapNamesToPlayerIdsOrdered(args.source.scratches, rosterEntries)
        : null,
    scratches_player_names:
      args.source.scratches.length > 0 ? args.source.scratches : null,
    injured_player_ids:
      args.source.injuries.length > 0
        ? mapNamesToPlayerIdsOrdered(
            args.source.injuries.map((injury) => injury.playerName),
            rosterEntries
          )
        : null,
    injured_player_names:
      args.source.injuries.length > 0
        ? args.source.injuries.map((injury) => injury.playerName)
        : null,
    raw_payload: {
      forwards: args.source.forwards,
      defensePairs: args.source.defensePairs,
      goalies: args.source.goalies,
      scratches: args.source.scratches,
      injuries: args.source.injuries
    },
    metadata: {
      storedSkaterOrder: ["RW", "C", "LW"],
      storedDefenseOrder: ["RD", "LD"],
      ...args.source.metadata
    },
    updated_at: new Date().toISOString()
  };
}
