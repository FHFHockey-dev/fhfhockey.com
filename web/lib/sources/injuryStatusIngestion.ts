import * as cheerio from "cheerio";

import { teamsInfo } from "lib/teamsInfo";

const BELL_MEDIA_INJURIES_URL =
  "https://stats.sports.bellmedia.ca/sports/hockey/leagues/nhl/playerInjuries?brand=tsn&type=json";
const RETURNING_STATUS_TTL_DAYS = 7;

export type PlayerStatusState = "injured" | "returning";
export type GameDayTweetsNewsClassification =
  | "injury"
  | "returning"
  | "questionable"
  | "transaction"
  | "other";

export type TeamStatusDirectoryEntry = {
  id: number;
  abbreviation: string;
  name: string;
  shortName: string;
  location: string | null;
};

export type RosterStatusEntry = {
  playerId: number;
  fullName: string;
  lastName: string;
  teamId: number | null;
};

export type ParsedGameDayTweetsNewsItem = {
  classification: GameDayTweetsNewsClassification;
  playerId: number | null;
  playerName: string;
  teamId: number | null;
  teamAbbreviation: string | null;
  sourceHandle: string | null;
  sourceUrl: string;
  tweetUrl: string | null;
  postedLabel: string | null;
  text: string;
};

export type PlayerStatusHistoryRow = {
  capture_key: string;
  snapshot_date: string;
  observed_at: string;
  player_id: number | null;
  player_name: string;
  team_id: number | null;
  team_abbreviation: string | null;
  status_state: PlayerStatusState;
  raw_status: string | null;
  status_detail: string | null;
  source_name: string;
  source_url: string | null;
  source_rank: number;
  status_expires_at: string | null;
  metadata: Record<string, unknown>;
  updated_at: string;
};

export type CurrentPlayerStatusRow = {
  snapshot_date: string;
  observed_at: string;
  player_id: number | null;
  player_name: string;
  team_id: number | null;
  team_abbreviation: string | null;
  status_state: PlayerStatusState;
  raw_status: string | null;
  status_detail: string | null;
  source_name: string;
  source_url: string | null;
  source_rank: number;
  status_expires_at: string | null;
  updated_at: string;
};

export type HomepagePlayerStatusRow = {
  date: string;
  team: string | null;
  player: {
    id: number | null;
    displayName: string;
  };
  status: string;
  description: string | null;
  statusState: PlayerStatusState;
};

type SelectCurrentPlayerStatusArgs = {
  rows: Array<CurrentPlayerStatusRow | Record<string, unknown>>;
  now?: string | number | Date;
};

type BellMediaInjuryTeam = {
  competitor?: {
    shortName?: string | null;
    name?: string | null;
  } | null;
  playerInjuries?: Array<{
    date?: string | null;
    status?: string | null;
    description?: string | null;
    player?: {
      displayName?: string | null;
    } | null;
  }> | null;
};

function normalizeKey(value: string): string {
  return value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/\u00a0/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function normalizeDisplayText(value: string): string {
  return value.replace(/\u00a0/g, " ").replace(/\s+/g, " ").trim();
}

function addDaysIso(value: string, days: number): string {
  const date = new Date(value);
  date.setUTCDate(date.getUTCDate() + days);
  return date.toISOString();
}

export function buildTeamStatusDirectory(): TeamStatusDirectoryEntry[] {
  return Object.entries(teamsInfo).map(([abbreviation, entry]) => ({
    id: entry.id,
    abbreviation: entry.abbrev ?? abbreviation,
    name: entry.name,
    shortName: entry.shortName,
    location: entry.location ?? null
  }));
}

function resolveTeamDirectoryEntry(
  value: string | null | undefined,
  directory: TeamStatusDirectoryEntry[]
): TeamStatusDirectoryEntry | null {
  const normalizedValue = normalizeKey(value ?? "");
  if (!normalizedValue) return null;

  return (
    directory.find((team) => {
      const candidates = [
        team.abbreviation,
        team.name,
        team.shortName,
        team.location,
        `${team.location ?? ""} ${team.shortName ?? ""}`.trim()
      ]
        .filter((item): item is string => Boolean(item))
        .map((item) => normalizeKey(item));

      return candidates.includes(normalizedValue);
    }) ?? null
  );
}

function resolveRosterEntry(
  playerName: string,
  rosterEntries: RosterStatusEntry[]
): RosterStatusEntry | null {
  const normalizedName = normalizeKey(playerName);
  const byFullName =
    rosterEntries.find((entry) => normalizeKey(entry.fullName) === normalizedName) ?? null;
  if (byFullName) return byFullName;

  const lastName = normalizedName.split(" ").pop() ?? normalizedName;
  const lastNameMatches = rosterEntries.filter(
    (entry) => normalizeKey(entry.lastName) === lastName
  );
  return lastNameMatches.length === 1 ? lastNameMatches[0] : null;
}

function resolveRosterEntryFromLeagueTweet(
  tweetText: string,
  rosterEntries: RosterStatusEntry[]
): RosterStatusEntry | null {
  const normalizedTweet = normalizeKey(tweetText);
  const fullNameMatches = rosterEntries
    .map((entry) => ({
      entry,
      index: normalizedTweet.indexOf(normalizeKey(entry.fullName))
    }))
    .filter((candidate) => candidate.index >= 0)
    .sort((left, right) => left.index - right.index);

  if (fullNameMatches.length > 0) {
    return fullNameMatches[0]?.entry ?? null;
  }

  const lastNameMatches = rosterEntries
    .map((entry) => ({
      entry,
      index: normalizedTweet.indexOf(normalizeKey(entry.lastName))
    }))
    .filter((candidate) => candidate.index >= 0)
    .sort((left, right) => left.index - right.index);

  const firstIndex = lastNameMatches[0]?.index;
  if (typeof firstIndex !== "number") {
    return null;
  }

  const firstWave = lastNameMatches.filter((candidate) => candidate.index === firstIndex);
  return firstWave.length === 1 ? firstWave[0]?.entry ?? null : null;
}

function classifyGameDayTweetsNewsItem(
  value: string
): GameDayTweetsNewsClassification {
  const normalized = normalizeKey(value);

  if (
    /\b(will play|will be in|returns tonight|returns? to the lineup|back in the lineup|available tonight|good to go|set to return|confirmed in)\b/i.test(
      normalized
    )
  ) {
    return "returning";
  }

  if (
    /\b(out|still out|injur|surgery|underwent|tear|torn|ltir|ir|won't play|will not play|ruled out|confirmed out|missed .* with)\b/i.test(
      normalized
    )
  ) {
    return "injury";
  }

  if (/\b(game time decision|gtd|questionable|day-to-day|close|not sure)\b/i.test(normalized)) {
    return "questionable";
  }

  if (
    /\b(recalled|reassigned|assigned|loaned|claimed|waived|trade|traded|signed|retire|retirement|called up)\b/i.test(
      normalized
    )
  ) {
    return "transaction";
  }

  return "other";
}

function buildStatusCaptureKey(args: {
  snapshotDate: string;
  teamId: number | null;
  playerId: number | null;
  playerName: string;
  statusState: PlayerStatusState;
  sourceName: string;
}): string {
  return [
    args.snapshotDate,
    args.teamId ?? "team-null",
    args.playerId ?? normalizeKey(args.playerName),
    args.statusState,
    args.sourceName
  ].join(":");
}

export async function fetchBellMediaInjuries(): Promise<BellMediaInjuryTeam[]> {
  const response = await fetch(BELL_MEDIA_INJURIES_URL, {
    headers: {
      Accept: "application/json",
      "User-Agent": "fhfhockey/1.0 (+https://fhfhockey.com)"
    },
    cache: "no-store"
  });

  const payload = await response.json();
  if (!response.ok) {
    throw new Error(`Bell Media injuries request failed (${response.status}).`);
  }
  if (!Array.isArray(payload)) {
    throw new Error("Bell Media injuries response was not an array.");
  }

  return payload as BellMediaInjuryTeam[];
}

export function parseGameDayTweetsNewsPage(args: {
  html: string;
  sourceUrl: string;
  rosterEntries: RosterStatusEntry[];
  directory: TeamStatusDirectoryEntry[];
}): ParsedGameDayTweetsNewsItem[] {
  const root = cheerio.load(args.html);

  return root("blockquote.tweet")
    .map((_, element) => {
      const tweetRoot = root(element);
      const text = normalizeDisplayText(tweetRoot.text());
      if (!text) return null;

      const rosterMatch = resolveRosterEntryFromLeagueTweet(text, args.rosterEntries);
      const team = rosterMatch
        ? args.directory.find((entry) => entry.id === rosterMatch.teamId) ?? null
        : null;

      return {
        classification: classifyGameDayTweetsNewsItem(text),
        playerId: rosterMatch?.playerId ?? null,
        playerName: rosterMatch?.fullName ?? "",
        teamId: team?.id ?? rosterMatch?.teamId ?? null,
        teamAbbreviation: team?.abbreviation ?? null,
        sourceHandle: tweetRoot.find("a.handle").attr("href") ?? null,
        sourceUrl: args.sourceUrl,
        tweetUrl:
          tweetRoot.find('a[href*="twitter.com/GameDayNewsNHL/status/"]').attr("href") ??
          tweetRoot.find('a[href*="twitter.com/GameDayStatsNHL/status/"]').attr("href") ??
          null,
        postedLabel:
          tweetRoot
            .find('a[href*="twitter.com/GameDayNewsNHL/status/"], a[href*="twitter.com/GameDayStatsNHL/status/"]')
            .last()
            .text()
            .trim() || null,
        text
      } satisfies ParsedGameDayTweetsNewsItem;
    })
    .get()
    .filter((item): item is ParsedGameDayTweetsNewsItem => Boolean(item && item.playerId != null));
}

export function normalizeBellMediaInjuryRows(args: {
  rawTeams: BellMediaInjuryTeam[];
  snapshotDate: string;
  observedAt?: string;
  directory: TeamStatusDirectoryEntry[];
  rosterByTeam: Map<number, RosterStatusEntry[]>;
}): PlayerStatusHistoryRow[] {
  const observedAt = args.observedAt ?? new Date().toISOString();

  return args.rawTeams.flatMap((teamEntry) => {
    const team = resolveTeamDirectoryEntry(
      teamEntry.competitor?.shortName ?? teamEntry.competitor?.name ?? null,
      args.directory
    );

    return (teamEntry.playerInjuries ?? []).flatMap((injury) => {
      const playerName = injury.player?.displayName?.trim() ?? "";
      if (!playerName) return [];

      const rosterMatch = team ? resolveRosterEntry(playerName, args.rosterByTeam.get(team.id) ?? []) : null;
      return [
        {
          capture_key: buildStatusCaptureKey({
            snapshotDate: args.snapshotDate,
            teamId: team?.id ?? rosterMatch?.teamId ?? null,
            playerId: rosterMatch?.playerId ?? null,
            playerName,
            statusState: "injured",
            sourceName: "bell-tsn"
          }),
          snapshot_date: args.snapshotDate,
          observed_at: observedAt,
          player_id: rosterMatch?.playerId ?? null,
          player_name: playerName,
          team_id: team?.id ?? rosterMatch?.teamId ?? null,
          team_abbreviation: team?.abbreviation ?? null,
          status_state: "injured" as const,
          raw_status: injury.status?.trim() ?? null,
          status_detail: injury.description?.trim() ?? null,
          source_name: "bell-tsn",
          source_url: BELL_MEDIA_INJURIES_URL,
          source_rank: 1,
          status_expires_at: null,
          metadata: {
            sourceTeamLabel: teamEntry.competitor?.shortName ?? teamEntry.competitor?.name ?? null
          },
          updated_at: observedAt
        }
      ];
    });
  });
}

export function normalizeGameDayTweetsNewsStatusRows(args: {
  items: ParsedGameDayTweetsNewsItem[];
  snapshotDate: string;
  observedAt?: string;
}): PlayerStatusHistoryRow[] {
  const observedAt = args.observedAt ?? new Date().toISOString();

  return args.items.flatMap((item) => {
    const statusState: PlayerStatusState | null =
      item.classification === "injury"
        ? "injured"
        : item.classification === "returning"
          ? "returning"
          : null;

    if (!statusState || item.playerId == null) {
      return [];
    }

    return [
      {
        capture_key: buildStatusCaptureKey({
          snapshotDate: args.snapshotDate,
          teamId: item.teamId,
          playerId: item.playerId,
          playerName: item.playerName,
          statusState,
          sourceName: "gamedaytweets-news"
        }),
        snapshot_date: args.snapshotDate,
        observed_at: observedAt,
        player_id: item.playerId,
        player_name: item.playerName,
        team_id: item.teamId,
        team_abbreviation: item.teamAbbreviation,
        status_state: statusState,
        raw_status: statusState === "injured" ? "Out" : "Returning",
        status_detail: item.text,
        source_name: "gamedaytweets-news",
        source_url: item.tweetUrl ?? item.sourceUrl,
        source_rank: 2,
        status_expires_at:
          statusState === "returning" ? addDaysIso(observedAt, 3) : null,
        metadata: {
          classification: item.classification,
          postedLabel: item.postedLabel,
          sourceHandle: item.sourceHandle
        },
        updated_at: observedAt
      }
    ];
  });
}

export function detectReturningStatusRows(args: {
  snapshotDate: string;
  observedAt?: string;
  latestStatuses: Array<{
    player_id: number | null;
    player_name: string;
    team_id: number | null;
    team_abbreviation: string | null;
    status_state: PlayerStatusState;
    raw_status: string | null;
  }>;
  currentInjuredRows: PlayerStatusHistoryRow[];
}): PlayerStatusHistoryRow[] {
  const observedAt = args.observedAt ?? new Date().toISOString();
  const currentKeys = new Set(
    args.currentInjuredRows.map((row) =>
      `${row.team_id ?? "team-null"}:${row.player_id ?? normalizeKey(row.player_name)}`
    )
  );

  return args.latestStatuses.flatMap((row) => {
    if (row.status_state !== "injured") return [];

    const key = `${row.team_id ?? "team-null"}:${row.player_id ?? normalizeKey(row.player_name)}`;
    if (currentKeys.has(key)) return [];

    return [
      {
        capture_key: buildStatusCaptureKey({
          snapshotDate: args.snapshotDate,
          teamId: row.team_id,
          playerId: row.player_id,
          playerName: row.player_name,
          statusState: "returning",
          sourceName: "bell-tsn"
        }),
        snapshot_date: args.snapshotDate,
        observed_at: observedAt,
        player_id: row.player_id,
        player_name: row.player_name,
        team_id: row.team_id,
        team_abbreviation: row.team_abbreviation,
        status_state: "returning",
        raw_status: "Returning",
        status_detail: "No longer listed on the injury report.",
        source_name: "bell-tsn",
        source_url: BELL_MEDIA_INJURIES_URL,
        source_rank: 1,
        status_expires_at: addDaysIso(observedAt, RETURNING_STATUS_TTL_DAYS),
        metadata: {
          previousRawStatus: row.raw_status
        },
        updated_at: observedAt
      }
    ];
  });
}

export function mapPlayerStatusRowsToHomepageRows(
  rows: Array<{
    snapshot_date: string;
    player_id: number | null;
    player_name: string;
    team_abbreviation: string | null;
    status_state: PlayerStatusState;
    raw_status: string | null;
    status_detail: string | null;
  }>
): HomepagePlayerStatusRow[] {
  return rows.map((row) => ({
    date: row.snapshot_date,
    team: row.team_abbreviation,
    player: {
      id: row.player_id,
      displayName: row.player_name
    },
    status: row.status_state === "returning" ? "Returning" : row.raw_status ?? "Out",
    description:
      row.status_state === "returning"
        ? row.status_detail ?? "No longer listed on the injury report."
        : row.status_detail,
    statusState: row.status_state
  }));
}

export async function fetchCurrentHomepagePlayerStatuses(args: {
  supabase: any;
}): Promise<HomepagePlayerStatusRow[]> {
  const currentRows = await fetchCurrentPlayerStatusRows(args);
  return mapPlayerStatusRowsToHomepageRows(currentRows);
}

export function selectCurrentPlayerStatusRows(
  args: SelectCurrentPlayerStatusArgs
): CurrentPlayerStatusRow[] {
  const now =
    args.now instanceof Date
      ? args.now.getTime()
      : typeof args.now === "string"
        ? Date.parse(args.now)
        : typeof args.now === "number"
          ? args.now
          : Date.now();
  const currentRows = new Map<string, CurrentPlayerStatusRow>();

  const rows = [...(args.rows as any[])].sort((left, right) => {
    const leftSnapshot = String(left.snapshot_date ?? "");
    const rightSnapshot = String(right.snapshot_date ?? "");
    if (leftSnapshot !== rightSnapshot) {
      return rightSnapshot.localeCompare(leftSnapshot);
    }

    const leftRank = Number(left.source_rank ?? 999);
    const rightRank = Number(right.source_rank ?? 999);
    if (leftRank !== rightRank) {
      return leftRank - rightRank;
    }

    const leftObserved = Date.parse(String(left.observed_at ?? ""));
    const rightObserved = Date.parse(String(right.observed_at ?? ""));
    if (Number.isFinite(leftObserved) || Number.isFinite(rightObserved)) {
      return (Number.isFinite(rightObserved) ? rightObserved : 0) - (Number.isFinite(leftObserved) ? leftObserved : 0);
    }

    const leftUpdated = Date.parse(String(left.updated_at ?? ""));
    const rightUpdated = Date.parse(String(right.updated_at ?? ""));
    return (Number.isFinite(rightUpdated) ? rightUpdated : 0) - (Number.isFinite(leftUpdated) ? leftUpdated : 0);
  });

  for (const rawRow of rows) {
    const expiresAt = rawRow.status_expires_at ? Date.parse(String(rawRow.status_expires_at)) : null;
    if (expiresAt != null && Number.isFinite(expiresAt) && expiresAt <= now) {
      continue;
    }

    const playerId = rawRow.player_id == null ? null : Number(rawRow.player_id);
    const teamId = rawRow.team_id == null ? null : Number(rawRow.team_id);
    const key = [
      playerId ?? -1,
      String(rawRow.player_name ?? "").trim().toLowerCase(),
      teamId ?? -1
    ].join(":");

    if (currentRows.has(key)) continue;

    currentRows.set(key, {
      snapshot_date: String(rawRow.snapshot_date ?? ""),
      observed_at: String(rawRow.observed_at ?? ""),
      player_id: playerId,
      player_name: String(rawRow.player_name ?? ""),
      team_id: teamId,
      team_abbreviation: rawRow.team_abbreviation ? String(rawRow.team_abbreviation) : null,
      status_state: rawRow.status_state as PlayerStatusState,
      raw_status: rawRow.raw_status ? String(rawRow.raw_status) : null,
      status_detail: rawRow.status_detail ? String(rawRow.status_detail) : null,
      source_name: String(rawRow.source_name ?? ""),
      source_url: rawRow.source_url ? String(rawRow.source_url) : null,
      source_rank: Number(rawRow.source_rank ?? 999),
      status_expires_at: rawRow.status_expires_at ? String(rawRow.status_expires_at) : null,
      updated_at: String(rawRow.updated_at ?? "")
    });
  }

  return Array.from(currentRows.values()).sort((a, b) => {
    if (a.snapshot_date !== b.snapshot_date) {
      return b.snapshot_date.localeCompare(a.snapshot_date);
    }
    return a.player_name.localeCompare(b.player_name);
  });
}

export async function fetchCurrentPlayerStatusRows(args: {
  supabase: any;
}): Promise<CurrentPlayerStatusRow[]> {
  const { data, error } = await args.supabase
    .from("player_status_history" as any)
    .select(
      [
        "snapshot_date",
        "observed_at",
        "player_id",
        "player_name",
        "team_id",
        "team_abbreviation",
        "status_state",
        "raw_status",
        "status_detail",
        "source_name",
        "source_url",
        "source_rank",
        "status_expires_at",
        "updated_at"
      ].join(", ")
    )
    .order("snapshot_date", { ascending: false })
    .order("source_rank", { ascending: true })
    .order("observed_at", { ascending: false })
    .order("updated_at", { ascending: false })
    .limit(2000);

  if (error) throw error;
  return selectCurrentPlayerStatusRows({ rows: (data ?? []) as any[] });
}

export function toInjurySourceProvenanceRows(
  rows: PlayerStatusHistoryRow[],
  gameIdByTeamId: Map<number, number>
): Array<{
  snapshot_date: string;
  source_type: string;
  entity_type: string;
  entity_id: number;
  game_id: number;
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
}> {
  return rows
    .filter((row) => row.player_id != null && row.team_id != null)
    .map((row) => ({
      snapshot_date: row.snapshot_date,
      source_type: "injury",
      entity_type: "player",
      entity_id: Number(row.player_id),
      game_id: Number(gameIdByTeamId.get(Number(row.team_id))),
      source_name: row.source_name,
      source_url: row.source_url,
      source_rank: row.source_rank,
      is_official: false,
      status: "observed",
      observed_at: row.observed_at,
      freshness_expires_at: row.status_expires_at,
      payload: {
        statusState: row.status_state,
        rawStatus: row.raw_status,
        statusDetail: row.status_detail
      },
      metadata: row.metadata,
      updated_at: row.updated_at
    }))
    .filter((row) => Number.isFinite(row.game_id));
}

export function toGameDayTweetsNewsProvenanceRows(
  items: ParsedGameDayTweetsNewsItem[],
  snapshotDate: string,
  observedAt: string,
  gameIdByTeamId: Map<number, number>
): Array<{
  snapshot_date: string;
  source_type: string;
  entity_type: string;
  entity_id: number;
  game_id: number;
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
}> {
  return items
    .filter((item) => item.playerId != null && item.teamId != null)
    .map((item) => ({
      snapshot_date: snapshotDate,
      source_type: "news",
      entity_type: "player",
      entity_id: Number(item.playerId),
      game_id: Number(gameIdByTeamId.get(Number(item.teamId))),
      source_name: "gamedaytweets-news",
      source_url: item.tweetUrl ?? item.sourceUrl,
      source_rank: 2,
      is_official: false,
      status: "observed",
      observed_at: observedAt,
      freshness_expires_at: null,
      payload: {
        classification: item.classification,
        text: item.text,
        postedLabel: item.postedLabel
      },
      metadata: {
        sourceHandle: item.sourceHandle,
        teamAbbreviation: item.teamAbbreviation
      },
      updated_at: observedAt
    }))
    .filter((row) => Number.isFinite(row.game_id));
}
