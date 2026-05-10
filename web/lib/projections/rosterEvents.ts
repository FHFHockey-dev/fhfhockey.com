import type { TweetPatternReviewExportRow } from "lib/sources/tweetPatternReview";

export type ForgeRosterEventType =
  | "INJURY_OUT"
  | "DTD"
  | "RETURN"
  | "CALLUP"
  | "SENDDOWN"
  | "LINE_CHANGE"
  | "PP_UNIT_CHANGE"
  | "GOALIE_START_CONFIRMED"
  | "GOALIE_START_LIKELY";

export type ForgeRosterEventInsert = {
  team_id: number | null;
  player_id: number | null;
  event_type: ForgeRosterEventType;
  confidence: number;
  effective_from: string;
  effective_to: string | null;
  payload: Record<string, unknown>;
  source_text: string | null;
};

export type RosterEventPreflightInput = {
  asOfDate: string;
  events: Array<{
    event_type: string;
    team_id: number | null;
    player_id: number | null;
    effective_from: string;
    effective_to?: string | null;
  }>;
  hasCurrentLineCombinations: boolean;
  hasGoaliePriors: boolean;
  lineCombinationAgeDays: number | null;
  rosterAssignmentAgeDays: number | null;
  acceptedGoalieSourceAgeHours: number | null;
};

export type RosterEventPreflightGate = {
  code: string;
  severity: "warn" | "block";
  message: string;
};

const LINEUP_HARD_STALE_DAYS = 3;
const LINEUP_WARN_STALE_DAYS = 1;
const ROSTER_ASSIGNMENT_WARN_DAYS = 3;
const ACCEPTED_GOALIE_WARN_HOURS = 18;

function toFiniteNumber(value: unknown): number | null {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : null;
}

function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}

function normalizeText(value: string | null | undefined): string | null {
  const normalized = value?.replace(/\s+/g, " ").trim();
  return normalized || null;
}

function primaryReviewText(row: TweetPatternReviewExportRow): string | null {
  return normalizeText(
    row.review_text ??
      (row as unknown as { raw_text?: string | null }).raw_text ??
      (row as unknown as { enriched_text?: string | null }).enriched_text ??
      null
  );
}

function resolveEventType(
  category: string,
  subcategory: string | null
): ForgeRosterEventType | null {
  const c = category.toUpperCase();
  const s = (subcategory ?? "").toUpperCase();

  if (c === "GOALIE START") {
    return s.includes("CONFIRMED")
      ? "GOALIE_START_CONFIRMED"
      : "GOALIE_START_LIKELY";
  }
  if (c === "INJURY") {
    if (s.includes("OUT") || s.includes("NON PARTICIPANT")) return "INJURY_OUT";
    if (s.includes("RETURN")) return "RETURN";
    return "DTD";
  }
  if (c === "SCRATCHES") return "INJURY_OUT";
  if (c === "RETURN") return "RETURN";
  if (c === "TRANSACTION") {
    if (s.includes("SENT")) return "SENDDOWN";
    if (s.includes("CALL")) return "CALLUP";
    return null;
  }
  if (c === "LINEUP" || c === "LINE COMBINATION") {
    return s.includes("POWER PLAY") ? "PP_UNIT_CHANGE" : "LINE_CHANGE";
  }
  return null;
}

function confidenceForEventType(type: ForgeRosterEventType): number {
  if (type === "GOALIE_START_CONFIRMED" || type === "INJURY_OUT") return 0.95;
  if (type === "GOALIE_START_LIKELY" || type === "DTD") return 0.75;
  return 0.7;
}

export function buildRosterEventsFromReviewedTweet(
  row: TweetPatternReviewExportRow,
  options: {
    effectiveFrom?: string;
    defaultTtlHours?: number;
  } = {}
): ForgeRosterEventInsert[] {
  if (row.review_status !== "reviewed") return [];

  const assignments = row.review_assignments?.length
    ? row.review_assignments
    : [
        {
          id: "assignment-1",
          category: row.reviewed_category ?? "",
          subcategory: row.reviewed_subcategory ?? null,
          playerIds: [],
          playerNames: [],
          highlightPhrases: row.selected_highlights ?? [],
          notes: row.notes ?? null
        }
      ];
  const effectiveFrom =
    options.effectiveFrom ??
    row.reviewed_at ??
    (row as unknown as { source_created_at?: string | null }).source_created_at ??
    new Date().toISOString();
  const ttlHours = options.defaultTtlHours ?? 30;
  const effectiveTo = new Date(
    new Date(effectiveFrom).getTime() + ttlHours * 60 * 60 * 1000
  ).toISOString();

  return assignments.flatMap((assignment) => {
    const type = resolveEventType(assignment.category, assignment.subcategory);
    if (!type) return [];

    const playerIds =
      assignment.playerIds.length > 0
        ? assignment.playerIds
        : [toFiniteNumber((row as unknown as { player_id?: unknown }).player_id)].filter(
            (id): id is number => id != null
          );
    const teamId = toFiniteNumber((row as unknown as { team_id?: unknown }).team_id);
    const subjectPlayerIds = playerIds.length > 0 || teamId == null ? playerIds : [null];

    return subjectPlayerIds.map((playerId) => ({
      team_id: teamId,
      player_id: playerId,
      event_type: type,
      confidence: clamp(confidenceForEventType(type), 0, 1),
      effective_from: effectiveFrom,
      effective_to: effectiveTo,
      source_text: primaryReviewText(row),
      payload: {
        source: "tweet_pattern_review",
        reviewItemId: row.id,
        assignmentId: assignment.id,
        category: assignment.category,
        subcategory: assignment.subcategory,
        playerNames: assignment.playerNames,
        highlightPhrases: assignment.highlightPhrases,
        notes: assignment.notes,
        sourceAccount: row.source_account ?? row.source_handle ?? null,
        sourceUrl: row.source_url ?? row.tweet_url ?? null,
        tweetUrl: row.tweet_url ?? null,
        teamAbbreviation: row.team_abbreviation ?? null
      }
    }));
  });
}

export function evaluateRosterEventPreflight(
  input: RosterEventPreflightInput
): RosterEventPreflightGate[] {
  const gates: RosterEventPreflightGate[] = [];
  if (!input.hasCurrentLineCombinations) {
    gates.push({
      code: "missing_current_line_combinations",
      severity: "block",
      message: "Current line combinations are missing for at least one team."
    });
  }
  if (!input.hasGoaliePriors) {
    gates.push({
      code: "missing_goalie_priors",
      severity: "block",
      message: "Goalie starter priors are missing for the slate."
    });
  }
  if (
    input.lineCombinationAgeDays != null &&
    input.lineCombinationAgeDays > LINEUP_HARD_STALE_DAYS
  ) {
    gates.push({
      code: "stale_line_combinations_hard",
      severity: "block",
      message: `Line combinations are ${input.lineCombinationAgeDays} days old.`
    });
  } else if (
    input.lineCombinationAgeDays != null &&
    input.lineCombinationAgeDays > LINEUP_WARN_STALE_DAYS
  ) {
    gates.push({
      code: "stale_line_combinations_soft",
      severity: "warn",
      message: `Line combinations are ${input.lineCombinationAgeDays} days old.`
    });
  }
  if (
    input.rosterAssignmentAgeDays != null &&
    input.rosterAssignmentAgeDays > ROSTER_ASSIGNMENT_WARN_DAYS
  ) {
    gates.push({
      code: "stale_roster_assignments",
      severity: "warn",
      message: `Roster assignments are ${input.rosterAssignmentAgeDays} days old.`
    });
  }
  if (
    input.acceptedGoalieSourceAgeHours != null &&
    input.acceptedGoalieSourceAgeHours > ACCEPTED_GOALIE_WARN_HOURS
  ) {
    gates.push({
      code: "stale_accepted_goalie_source",
      severity: "warn",
      message: `Accepted goalie source is ${input.acceptedGoalieSourceAgeHours} hours old.`
    });
  }
  return gates;
}
