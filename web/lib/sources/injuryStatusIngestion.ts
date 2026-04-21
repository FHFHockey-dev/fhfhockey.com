import { teamsInfo } from "lib/teamsInfo";

const BELL_MEDIA_INJURIES_URL =
  "https://stats.sports.bellmedia.ca/sports/hockey/leagues/nhl/playerInjuries?brand=tsn&type=json";
const RETURNING_STATUS_TTL_DAYS = 7;

export type PlayerStatusState = "injured" | "returning";

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
    .order("observed_at", { ascending: false })
    .order("updated_at", { ascending: false })
    .limit(2000);

  if (error) throw error;

  const now = Date.now();
  const currentRows = new Map<string, CurrentPlayerStatusRow>();
  for (const row of (data ?? []) as any[]) {
    const expiresAt = row.status_expires_at ? Date.parse(String(row.status_expires_at)) : null;
    if (expiresAt != null && Number.isFinite(expiresAt) && expiresAt <= now) {
      continue;
    }

    const playerId = row.player_id == null ? null : Number(row.player_id);
    const teamId = row.team_id == null ? null : Number(row.team_id);
    const key = [
      playerId ?? -1,
      String(row.player_name ?? "").trim().toLowerCase(),
      teamId ?? -1
    ].join(":");

    if (currentRows.has(key)) continue;

    currentRows.set(key, {
      snapshot_date: String(row.snapshot_date ?? ""),
      observed_at: String(row.observed_at ?? ""),
      player_id: playerId,
      player_name: String(row.player_name ?? ""),
      team_id: teamId,
      team_abbreviation: row.team_abbreviation ? String(row.team_abbreviation) : null,
      status_state: row.status_state as PlayerStatusState,
      raw_status: row.raw_status ? String(row.raw_status) : null,
      status_detail: row.status_detail ? String(row.status_detail) : null,
      source_name: String(row.source_name ?? ""),
      source_url: row.source_url ? String(row.source_url) : null,
      source_rank: Number(row.source_rank ?? 0),
      status_expires_at: row.status_expires_at ? String(row.status_expires_at) : null,
      updated_at: String(row.updated_at ?? "")
    });
  }

  return Array.from(currentRows.values()).sort((a, b) => {
    if (a.snapshot_date !== b.snapshot_date) {
      return b.snapshot_date.localeCompare(a.snapshot_date);
    }
    return a.player_name.localeCompare(b.player_name);
  });
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
