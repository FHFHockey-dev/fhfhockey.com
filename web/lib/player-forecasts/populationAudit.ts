import type { Player } from "../sources/nhlRosterPreview";
import type { NhlProspectIdentity } from "../sources/nhlProspectIdentity";

export type PopulationIdentity = {
  id: number; nhl_player_id: number; canonical_name: string; birth_date: string | null;
  lifecycle_status: string; verification_status: string; merged_into_id: number | null;
  current_nhl_team_id: number | null; updated_at: string;
};
export type PopulationMembership = {
  playerId: number; teamId: number; seasonId: number; is_current: boolean; created_at: string;
};
export type PopulationCandidate = {
  nhlId: number; identities: PopulationIdentity[]; officialRoster: Player | null;
  memberships: PopulationMembership[]; reasons: string[];
};

/** Audit stored catalog selection separately from official roster presence and participation. */
export function populationAuditCandidates(args: {
  seasonId: number; active: PopulationIdentity[]; excluded: PopulationIdentity[];
  memberships: PopulationMembership[]; official: Player[];
}): PopulationCandidate[] {
  const identities = [...args.active, ...args.excluded];
  const official = new Map<number, Player>();
  const identityIds = new Set<number>();
  for (const row of identities) {
    if (!Number.isSafeInteger(row.id) || !Number.isSafeInteger(row.nhl_player_id)
      || row.nhl_player_id < 1_000_000 || row.nhl_player_id > 9_999_999 || identityIds.has(row.id)) {
      throw new Error("Invalid or duplicate population identity");
    }
    identityIds.add(row.id);
  }
  if (args.active.some(row => row.lifecycle_status !== "active_nhl" || row.verification_status !== "verified"
    || row.merged_into_id !== null)) throw new Error("Active catalog selection is inconsistent");
  for (const player of args.official) {
    if (!Number.isSafeInteger(player.id) || player.id < 1_000_000 || player.id > 9_999_999
      || !Number.isSafeInteger(player.teamId) || player.teamId <= 0
      || !/^\d{4}-\d{2}-\d{2}$/.test(player.birthDate ?? "") || official.has(player.id)) {
      throw new Error("Invalid or conflicting official roster identity");
    }
    official.set(player.id, player);
  }
  for (const row of args.memberships) {
    if (row.seasonId !== args.seasonId || row.is_current !== true || !Number.isSafeInteger(row.teamId) || row.teamId <= 0
      || !Number.isSafeInteger(row.playerId)) throw new Error("Out-of-scope population membership");
  }
  const nhlIds = new Set([...args.active.map(row => row.nhl_player_id), ...official.keys()]);
  return [...nhlIds].sort((a, b) => a - b).flatMap(nhlId => {
    const matches = identities.filter(row => row.nhl_player_id === nhlId);
    const roster = official.get(nhlId) ?? null;
    const memberships = args.memberships.filter(row => row.playerId === nhlId);
    const teamIds = [...new Set(memberships.map(row => row.teamId))];
    const selected = args.active.some(row => row.nhl_player_id === nhlId);
    const reasons: string[] = [];
    if (!roster) reasons.push("absent_official_roster");
    if (!selected) reasons.push(matches.length ? "excluded_from_catalog" : "missing_canonical_identity");
    if (matches.length > 1) reasons.push("conflicting_canonical_identities");
    if (!teamIds.length) reasons.push("missing_current_membership");
    else if (teamIds.length > 1) reasons.push("conflicting_current_memberships");
    else if (roster && teamIds[0] !== roster.teamId) reasons.push("roster_membership_disagreement");
    if (matches.some(row => !row.birth_date)) reasons.push("birth_date_unverified");
    if (roster && matches.some(row => row.birth_date && row.birth_date !== roster.birthDate)) reasons.push("birth_date_disagreement");
    return reasons.length ? [{ nhlId, identities: matches, officialRoster: roster, memberships, reasons }] : [];
  });
}

export function classifyPopulationProfile(candidate: PopulationCandidate, profile: NhlProspectIdentity | null) {
  const base = { nhlId: candidate.nhlId, canonicalIds: candidate.identities.map(row => row.id),
    candidateReasons: candidate.reasons, storedTeamIds: [...new Set(candidate.memberships.map(row => row.teamId))].sort((a, b) => a - b),
    officialTeamId: candidate.officialRoster?.teamId ?? null, profileTeamId: profile?.currentTeamId ?? null,
    nhlActive: profile?.nhlActive ?? null, checkedAt: profile?.checkedAt ?? null };
  if (!profile) return { ...base, classification: "profile_unavailable", proposedLifecycle: null };
  if (profile.nhlId !== candidate.nhlId || !profile.birthDate
    || candidate.identities.length > 1 || candidate.identities.some(row => row.birth_date && row.birth_date !== profile.birthDate)
    || candidate.officialRoster && candidate.officialRoster.birthDate !== profile.birthDate) {
    return { ...base, classification: "identity_conflict", proposedLifecycle: null };
  }
  if (candidate.identities.some(row => !row.birth_date)) {
    return { ...base, classification: "birth_date_unverified", proposedLifecycle: null };
  }
  if (profile.nhlActive !== true && profile.nhlActive !== false) {
    return { ...base, classification: "activity_unknown", proposedLifecycle: null };
  }
  if (candidate.identities.some(row => row.verification_status !== "verified" || row.merged_into_id !== null)) {
    return { ...base, classification: "canonical_identity_review", proposedLifecycle: null };
  }
  if (!candidate.officialRoster) {
    // An organization on a profile is not a current roster assignment; absence cannot end membership.
    return { ...base, classification: profile.nhlActive === false ? "inactive_profile_roster_absent" : "active_profile_roster_absent",
      proposedLifecycle: profile.nhlActive === false ? "inactive" : null };
  }
  if (!profile.nhlActive || profile.currentTeamId !== candidate.officialRoster.teamId) {
    return { ...base, classification: "roster_profile_conflict", proposedLifecycle: null };
  }
  if (!candidate.identities.length) return { ...base, classification: "missing_canonical_identity", proposedLifecycle: null };
  return { ...base, classification: "roster_supported_correction", proposedLifecycle: "active_nhl" };
}
