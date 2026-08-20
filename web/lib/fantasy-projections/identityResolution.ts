import type { SupabaseClient } from "@supabase/supabase-js";

import { get } from "lib/NHL/base";

import { checksumCanonicalJson } from "./evaluator";

const POSITIONS = new Set(["C", "L", "R", "D", "G"]);
export const SEASON_IDENTITY_LIFECYCLE_STATUSES = [
  "active_nhl",
  "active_prospect",
  "unsigned_relevant",
] as const;

export type SeasonIdentityLifecycleStatus =
  (typeof SEASON_IDENTITY_LIFECYCLE_STATUSES)[number];

export type SeasonIdentityCandidate = {
  fhfhPlayerId: number;
  canonicalName: string;
  birthYear: number | null;
  position: string | null;
  organizationName: string | null;
  organizationType: string | null;
  lifecycleStatus: string;
  headshotUrl: string | null;
  nhlPlayerId: number | null;
  matchKind: string;
  similarityScore: number;
  mappingAllowed: boolean;
};

export type SeasonPlayerPoolReview = {
  id: string;
  seasonId: number;
  nhlPlayerId: number | null;
  rawPlayerName: string;
  teamId: number | null;
  position: string | null;
  issueCode: string;
};

export type OfficialNhlPlayerEvidence = {
  nhlPlayerId: number;
  firstName: string;
  lastName: string;
  position: "C" | "L" | "R" | "D" | "G";
  birthDate: string;
  birthCity: string | null;
  birthCountry: string;
  heightInCentimeters: number;
  weightInKilograms: number;
  currentTeamId: number;
  teamName: string | null;
  sweaterNumber: number | null;
  headshotUrl: string | null;
  sourceUrl: string;
  observedAt: string;
  sourcePayloadHash: string;
};

export type SeasonIdentityRegistryCandidate = {
  fhfhPlayerId: number;
  nhlPlayerId: number | null;
  canonicalName: string;
  birthDate: string | null;
  position: string | null;
  verificationStatus: string;
  mergedIntoId: number | null;
};

export type SeasonIdentityResolutionPlan = {
  action: "map_existing" | "create_new" | "manual_review";
  fhfhPlayerId: number | null;
  lifecycleStatus: SeasonIdentityLifecycleStatus | null;
  reason: string;
};

type SearchRow = {
  player_id: number;
  canonical_name: string;
  birth_year: number | null;
  canonical_position: string | null;
  current_organization_name: string | null;
  current_organization_type: string | null;
  lifecycle_status: string;
  headshot_url: string | null;
  nhl_player_id: number | null;
  match_kind: string;
  similarity_score: number;
};

function localizedDefault(value: unknown): string | null {
  if (typeof value === "string") return value.trim() || null;
  if (!value || typeof value !== "object" || Array.isArray(value)) return null;
  const localized = (value as Record<string, unknown>).default;
  return typeof localized === "string" ? localized.trim() || null : null;
}

function positiveInteger(value: unknown): number | null {
  const parsed = Number(value);
  return Number.isSafeInteger(parsed) && parsed > 0 ? parsed : null;
}

function optionalInteger(value: unknown): number | null {
  if (value == null || value === "") return null;
  return positiveInteger(value);
}

function normalizedIdentityName(value: string): string {
  return value
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "")
    .trim();
}

export function planSeasonIdentityResolution(args: {
  review: SeasonPlayerPoolReview;
  officialPlayer: OfficialNhlPlayerEvidence;
  identities: SeasonIdentityRegistryCandidate[];
}): SeasonIdentityResolutionPlan {
  const { review, officialPlayer } = args;
  if (
    review.nhlPlayerId !== officialPlayer.nhlPlayerId ||
    review.teamId !== officialPlayer.currentTeamId ||
    normalizedIdentityName(review.rawPlayerName) !==
      normalizedIdentityName(`${officialPlayer.firstName} ${officialPlayer.lastName}`)
  ) {
    return {
      action: "manual_review",
      fhfhPlayerId: null,
      lifecycleStatus: null,
      reason: "Official landing evidence does not exactly match the staged NHL ID, name, and organization.",
    };
  }

  const eligible = args.identities.filter(
    (identity) =>
      !identity.mergedIntoId &&
      !["merged", "rejected"].includes(identity.verificationStatus),
  );
  const direct = eligible.filter(
    (identity) => identity.nhlPlayerId === officialPlayer.nhlPlayerId,
  );
  if (direct.length === 1) {
    return {
      action: "map_existing",
      fhfhPlayerId: direct[0].fhfhPlayerId,
      lifecycleStatus: null,
      reason: "Existing eligible FHFH identity already carries the exact official NHL player ID.",
    };
  }
  if (direct.length > 1) {
    return {
      action: "manual_review",
      fhfhPlayerId: null,
      lifecycleStatus: null,
      reason: "Multiple eligible FHFH identities carry the same official NHL player ID.",
    };
  }

  const officialName = normalizedIdentityName(
    `${officialPlayer.firstName} ${officialPlayer.lastName}`,
  );
  const fingerprint = eligible.filter(
    (identity) =>
      identity.nhlPlayerId == null &&
      normalizedIdentityName(identity.canonicalName) === officialName &&
      identity.birthDate === officialPlayer.birthDate &&
      identity.position === officialPlayer.position,
  );
  if (fingerprint.length === 1) {
    return {
      action: "map_existing",
      fhfhPlayerId: fingerprint[0].fhfhPlayerId,
      lifecycleStatus: null,
      reason: "A unique unmapped FHFH identity exactly matches official name, birth date, and position.",
    };
  }
  if (fingerprint.length > 1) {
    return {
      action: "manual_review",
      fhfhPlayerId: null,
      lifecycleStatus: null,
      reason: "Multiple unmapped FHFH identities share the official name, birth date, and position.",
    };
  }

  return {
    action: "create_new",
    fhfhPlayerId: null,
    lifecycleStatus: "active_prospect",
    reason: "No existing eligible identity matches the checksum-verified official NHL identity; create a conservative prospect identity.",
  };
}

export function parseOfficialNhlPlayerEvidence(
  payload: unknown,
  expectedNhlPlayerId: number,
  observedAt = new Date().toISOString(),
): OfficialNhlPlayerEvidence {
  if (!payload || typeof payload !== "object" || Array.isArray(payload)) {
    throw new Error("Official NHL player evidence was not an object.");
  }
  const raw = payload as Record<string, unknown>;
  const nhlPlayerId = positiveInteger(raw.playerId);
  const firstName = localizedDefault(raw.firstName);
  const lastName = localizedDefault(raw.lastName);
  const position = typeof raw.position === "string" ? raw.position : "";
  const birthDate = typeof raw.birthDate === "string" ? raw.birthDate : "";
  const birthCountry =
    typeof raw.birthCountry === "string" ? raw.birthCountry.trim() : "";
  const heightInCentimeters = positiveInteger(raw.heightInCentimeters);
  const weightInKilograms = positiveInteger(raw.weightInKilograms);
  const currentTeamId = positiveInteger(raw.currentTeamId);
  if (
    nhlPlayerId !== expectedNhlPlayerId ||
    !firstName ||
    !lastName ||
    !POSITIONS.has(position) ||
    !/^\d{4}-\d{2}-\d{2}$/.test(birthDate) ||
    Number.isNaN(Date.parse(`${birthDate}T00:00:00Z`)) ||
    !birthCountry ||
    !heightInCentimeters ||
    !weightInKilograms ||
    !currentTeamId ||
    Number.isNaN(Date.parse(observedAt))
  ) {
    throw new Error("Official NHL player evidence was incomplete or mismatched.");
  }

  const sourceUrl = `https://api-web.nhle.com/v1/player/${nhlPlayerId}/landing`;
  const evidenceWithoutHash = {
    nhlPlayerId,
    firstName,
    lastName,
    position: position as OfficialNhlPlayerEvidence["position"],
    birthDate,
    birthCity: localizedDefault(raw.birthCity),
    birthCountry,
    heightInCentimeters,
    weightInKilograms,
    currentTeamId,
    teamName: localizedDefault(raw.fullTeamName),
    sweaterNumber: optionalInteger(raw.sweaterNumber),
    headshotUrl: typeof raw.headshot === "string" ? raw.headshot : null,
    sourceUrl,
    observedAt,
  };
  return {
    ...evidenceWithoutHash,
    sourcePayloadHash: checksumCanonicalJson(evidenceWithoutHash),
  };
}

export async function fetchOfficialNhlPlayerEvidence(
  nhlPlayerId: number,
): Promise<OfficialNhlPlayerEvidence> {
  const payload = await get(`/player/${nhlPlayerId}/landing`);
  return parseOfficialNhlPlayerEvidence(payload, nhlPlayerId);
}

export async function loadPendingSeasonPlayerPoolReview(args: {
  supabase: SupabaseClient<any>;
  reviewId: string;
}): Promise<SeasonPlayerPoolReview> {
  const client = args.supabase as any;
  const [{ data: review, error: reviewError }, { data: superseding, error: supersedingError }] =
    await Promise.all([
      client
        .from("player_forecast_season_player_pool_review")
        .select("id,season_id,nhl_player_id,raw_player_name,team_id,position,issue_code,resolution_status")
        .eq("id", args.reviewId)
        .maybeSingle(),
      client
        .from("player_forecast_season_player_pool_review")
        .select("id")
        .eq("supersedes_id", args.reviewId)
        .limit(1),
    ]);
  if (reviewError) throw reviewError;
  if (supersedingError) throw supersedingError;
  if (
    !review ||
    review.resolution_status !== "pending" ||
    (superseding ?? []).length > 0
  ) {
    throw new Error("Pending player-pool review item was not found.");
  }
  return {
    id: review.id,
    seasonId: Number(review.season_id),
    nhlPlayerId:
      review.nhl_player_id == null ? null : Number(review.nhl_player_id),
    rawPlayerName: review.raw_player_name,
    teamId: review.team_id == null ? null : Number(review.team_id),
    position: review.position,
    issueCode: review.issue_code,
  };
}

export async function searchSeasonIdentityCandidates(args: {
  supabase: SupabaseClient<any>;
  query: string;
  reviewNhlPlayerId: number | null;
  limit?: number;
}): Promise<SeasonIdentityCandidate[]> {
  const query = args.query.trim();
  if (query.length < 2 || query.length > 80) {
    throw new Error("Identity search must contain between 2 and 80 characters.");
  }
  const limit = Math.min(Math.max(args.limit ?? 12, 1), 20);
  const terms = [
    args.reviewNhlPlayerId == null ? null : String(args.reviewNhlPlayerId),
    query,
  ].filter((term, index, all): term is string => Boolean(term) && all.indexOf(term) === index);
  const responses = await Promise.all(
    terms.map((term) =>
      (args.supabase as any).rpc("search_fhfh_draft_players", {
        p_query: term,
        p_include_archived: true,
        p_limit: limit,
      }),
    ),
  );
  for (const response of responses) {
    if (response.error) throw response.error;
  }

  const unique = new Map<number, SearchRow>();
  for (const response of responses) {
    for (const row of (response.data ?? []) as SearchRow[]) {
      if (!unique.has(Number(row.player_id))) unique.set(Number(row.player_id), row);
    }
  }
  return [...unique.values()].slice(0, limit).map((row) => ({
    fhfhPlayerId: Number(row.player_id),
    canonicalName: row.canonical_name,
    birthYear: row.birth_year == null ? null : Number(row.birth_year),
    position: row.canonical_position,
    organizationName: row.current_organization_name,
    organizationType: row.current_organization_type,
    lifecycleStatus: row.lifecycle_status,
    headshotUrl: row.headshot_url,
    nhlPlayerId: row.nhl_player_id == null ? null : Number(row.nhl_player_id),
    matchKind: row.match_kind,
    similarityScore: Number(row.similarity_score ?? 0),
    mappingAllowed:
      row.nhl_player_id == null ||
      Number(row.nhl_player_id) === args.reviewNhlPlayerId,
  }));
}

export async function persistSeasonIdentityResolution(args: {
  supabase: SupabaseClient<any>;
  editorUserId: string;
  reviewId: string;
  action: "map_existing" | "create_new" | "exclude";
  reason: string;
  fhfhPlayerId?: number | null;
  lifecycleStatus?: SeasonIdentityLifecycleStatus | null;
  officialPlayer?: OfficialNhlPlayerEvidence | null;
}): Promise<Record<string, unknown>> {
  if (!args.reason.trim()) throw new Error("A resolution reason is required.");
  if (
    args.action === "map_existing" &&
    (!Number.isSafeInteger(args.fhfhPlayerId) || Number(args.fhfhPlayerId) <= 0)
  ) {
    throw new Error("Select a valid FHFH identity before mapping.");
  }
  if (
    args.action === "create_new" &&
    !SEASON_IDENTITY_LIFECYCLE_STATUSES.includes(
      args.lifecycleStatus as SeasonIdentityLifecycleStatus,
    )
  ) {
    throw new Error("Select a valid lifecycle for the new identity.");
  }
  if (args.action !== "exclude" && !args.officialPlayer) {
    throw new Error("Verified official NHL player evidence is required.");
  }

  const { data, error } = await (args.supabase as any).rpc(
    "resolve_player_forecast_season_identity",
    {
      p_review_id: args.reviewId,
      p_editor_user_id: args.editorUserId,
      p_resolution_action: args.action,
      p_resolution_reason: args.reason.trim(),
      p_fhfh_player_id: args.fhfhPlayerId ?? null,
      p_lifecycle_status: args.lifecycleStatus ?? null,
      p_official_player: args.officialPlayer ?? null,
    },
  );
  if (error) throw error;
  return (data ?? {}) as Record<string, unknown>;
}
