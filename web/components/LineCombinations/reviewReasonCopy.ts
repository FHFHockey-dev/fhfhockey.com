import type { AuthorityTier, ClaimContext, LineGame } from "lib/lines/types";
import { RELAY_ACCOUNTS } from "lib/lines/authority";

// Plain-language copy for the engine's raw review reason codes (lib/lines).
// Fans never see the codes themselves; unknown codes fall back to a generic line.

const EXACT: Record<string, string> = {
  binding_decision_unverified: "We couldn't confirm which game this report is about.",
  no_game_binding_evidence: "The report doesn't name a game, opponent or date.",
  quoted_publication_time_unresolved: "The original post time of this quoted report is unknown.",
  relative_date_timezone_unresolved: "The report says \"tonight\" or similar, but its time zone is unknown.",
  conflicting_dates: "The report mentions dates that don't agree.",
  ambiguous_game: "The report could match more than one game.",
  claim_phase_unresolved: "We couldn't tell whether this is from before or during the game.",
  claim_kind_unresolved: "We couldn't tell what kind of lineup report this is.",
  claim_confirmation_unresolved: "The report says confirmed, but doesn't show where that comes from.",
  original_provenance_unverified: "The original author and post time haven't been verified yet.",
  event_membership_unverified: "We haven't checked these players against the game roster yet.",
  identity_event_time_unresolved: "We can't check the roster because the report's time is unknown.",
  incomplete_replacement: "The report names who comes in, but not everyone who goes out.",
  effective_time_unresolved: "We couldn't tell when this lineup takes effect.",
  ingestion_time_unresolved: "The time we received this report is missing.",
  ingestion_not_yet_available: "This report arrived after the lineup was set.",
  interpretation_not_yet_available: "This report was read after the lineup was set.",
  missing_timezone: "The report's time zone is unknown.",
  author_excluded: "This account doesn't count as a lineup source.",
  // Sentences the engine writes into unresolved/conflict lists.
  "Evidence is not eligible for selection": "This report can't be used for the lineup yet.",
  "Late entry evidence requires an explicit correction": "This report came after the lineup was set; only a correction from the source can change it.",
  "Entry revision changed without a verified correction chain; the frozen entry is retained": "The lineup changed without a confirmed correction, so we kept the lineup set at puck drop.",
  "Contradictory applicable reports require review": "Sources disagree on this unit.",
};

const IDENTITY: Record<string, string> = {
  missing_player: "isn't matched to a player yet",
  ambiguous: "could be more than one player",
  conflicting_membership: "doesn't match the team's game roster",
  interpretation_mismatch: "was matched to a different player than expected",
  not_in_text: "isn't named in the report text",
};

const EXTRACTION: Record<string, string> = {
  missing_player: "a name we couldn't match to a player",
  ambiguous: "a name that could be more than one player",
  invalid_extraction: "a line we couldn't read",
};

export const GENERIC_REVIEW_COPY = "This report needs a quick review before it can be used.";

export function reviewReasonCopy(code: string): string {
  if (EXACT[code]) return EXACT[code];
  const [prefix, ...rest] = code.split(":");
  if (prefix === "identity" && rest.length >= 2) {
    const status = rest[rest.length - 1]!;
    const name = rest.slice(0, -1).join(":");
    return `"${name}" ${IDENTITY[status] ?? "needs a player match"}.`;
  }
  if (prefix === "extraction" && rest.length >= 1) {
    const [reason, ...text] = rest;
    const what = EXTRACTION[reason!] ?? "a part we couldn't read";
    return text.length && text.join(":").trim() ? `The report has ${what}: "${text.join(":").trim()}".` : `The report has ${what}.`;
  }
  if (prefix === "relation_target_unresolved") return "This correction points at a report we can't find.";
  if (prefix === "candidate_count") return "The report could match more than one game.";
  return GENERIC_REVIEW_COPY;
}

/** Deduplicated plain-language lines for a list of codes. */
export function reviewReasonsCopy(codes: string[]): string[] {
  return [...new Set(codes.map(reviewReasonCopy))];
}

// ---- Shared display copy for the snapshot UI (entry panel, IGA rail, source feed) ----

/** Site date style for a game day ("Nov 6"). Game dates are calendar days, so format in UTC to avoid a day shift. */
export function shortDate(date: string): string {
  const day = new Date(`${date}T12:00:00Z`);
  return Number.isNaN(day.getTime()) ? date : day.toLocaleDateString("en-US", { month: "short", day: "numeric", timeZone: "UTC" });
}
export function gameLabel(game: LineGame): string { return `${shortDate(game.date)} · ${game.awayAbbreviation} at ${game.homeAbbreviation}`; }

export function formatTime(value: string): string {
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? value : date.toLocaleString([], { month: "short", day: "numeric", hour: "numeric", minute: "2-digit" });
}

export const AUTHORITY_COPY: Record<AuthorityTier, string> = {
  team: "Team account", beat: "Beat reporter", aggregator: "Lineup aggregator", unknown: "Unranked source", excluded: "Not used for lineups",
};

export const CONTEXT_COPY: Record<ClaimContext, string> = { warmup: "Warmup", game: "Game", practice: "Practice", projected: "Projected" };

export function bindingCopy(binding: { status: "bound" | "ambiguous" | "unresolved"; gameId: number | null }, games: LineGame[]): string {
  if (binding.status === "bound") {
    const game = games.find((candidate) => candidate.id === binding.gameId);
    return game ? `Linked to ${gameLabel(game)}` : "Linked to a game";
  }
  return binding.status === "ambiguous" ? "Could match more than one game" : "Not linked to a game yet";
}

const REVISION_COPY: Record<string, string> = {
  "Entry frozen at actual start": "Set when the game started",
  "Entry frozen at first observed live transition": "Set when we first saw the game live",
  "Applicable pregame evidence": "Built from pregame reports",
  "Entry lineup corrected": "Corrected by the original source",
  "Entry evidence retracted": "Retracted by the original source",
};
export function revisionReasonCopy(reason: string): string { return REVISION_COPY[reason] ?? reviewReasonCopy(reason); }

// ---- Attribution (TJ, 2026-11-06): the source is always the original author of the quoted post. ----
// Relay accounts (DFOFantasy, NHL_Rosters, CcCMiddleton, GameDayLines, GameDayNewsNHL, GameDayGoalies)
// are never shown as a source, even when the data names them as the author. FHFHockey is a normal source (TJ).
const HIDDEN_AUTHORS = new Set([...RELAY_ACCOUNTS, "dfo_fantasy"]);
const handleOf = (value: string | null | undefined) => value?.replace(/^@/, "").trim().toLowerCase() || null;
const urlHandle = (url: string | null | undefined) => handleOf(url?.match(/^https?:\/\/(?:www\.)?(?:x|twitter)\.com\/([^/?#]+)\//i)?.[1]);

export const ORIGINAL_SOURCE_PENDING = "Original source not identified";

/** The handle to show as the source, or null when only a relay account is known. */
export function sourceAuthor(handle: string | null | undefined): string | null {
  const normal = handleOf(handle);
  return normal && !HIDDEN_AUTHORS.has(normal) ? handle!.replace(/^@/, "").trim() : null;
}

/** A link to the original post: the original id or URL first, else a source URL that is not a relay's. */
export function originalPostUrl(author: string | null, original: string | null | undefined, url: string | null | undefined): string | null {
  if (!author) return null;
  if (original && /^\d+$/.test(original)) return `https://x.com/${author}/status/${original}`;
  for (const candidate of [original, url]) {
    const handle = urlHandle(candidate);
    if (candidate && handle && !HIDDEN_AUTHORS.has(handle)) return candidate;
  }
  return null;
}
