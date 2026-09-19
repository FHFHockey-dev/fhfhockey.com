import { rosterSeasonForDate } from "./playerIdentity";

export type NhlProspectIdentity = {
  nhlId: number | null;
  lifecycleStatus?: "active_nhl" | "active_prospect" | "inactive" | "review_required";
  firstName: string;
  lastName: string;
  fullName: string;
  birthDate: string | null;
  position: string | null;
  height: number | null;
  weight: number | null;
  country: string | null;
  currentTeamId: number | null;
  sourceUrl: string;
  checkedAt: string;
  draft: { year: number; round: number; pick: number; overall: number; teamId: number; teamAbbreviation: string; club: string | null; league: string | null; sourceUrl: string } | null;
};
const positive = (value: unknown): number | null => Number.isSafeInteger(Number(value)) && Number(value) > 0 ? Number(value) : null;
const name = (value: any): string => typeof value === "string" ? value.trim() : typeof value?.default === "string" ? value.default.trim() : "";
const position = (value: unknown): string | null => ({ LW: "L", RW: "R", L: "L", R: "R", C: "C", D: "D", G: "G" }[String(value)] ?? null);

class NhlRateLimitError extends Error {}

async function readNhl(url: string) {
  const response = await fetch(url, { signal: AbortSignal.timeout(10_000) });
  if (response.status === 429) throw new NhlRateLimitError("NHL rate limit reached; resume from the last completed cursor after backoff.");
  if (!response.ok) throw new Error(`NHL identity source returned ${response.status}`);
  return response.json();
}

/** Exact NHL IDs only. A profile's current team is organization evidence, not a roster assignment. */
export async function fetchNhlPlayerIdentity(playerId: number, includeDraft = false): Promise<NhlProspectIdentity> {
  if (!Number.isSafeInteger(playerId) || playerId < 1_000_000 || playerId > 9_999_999) throw new Error("Enter a seven-digit NHL player ID.");
  const sourceUrl = `https://api-web.nhle.com/v1/player/${playerId}/landing`;
  const data = await readNhl(sourceUrl);
  const firstName = name(data.firstName), lastName = name(data.lastName);
  if (data.playerId !== playerId || !firstName || !lastName || !/^\d{4}-\d{2}-\d{2}$/.test(data.birthDate ?? "") || !position(data.position)) throw new Error("NHL profile did not verify this player identity.");
  const draft = includeDraft && positive(data.draftDetails?.year)
    ? (await fetchNhlDraftClass(data.draftDetails.year)).find((player) => player.nhlId === playerId)?.draft ?? null : null;
  return { nhlId: playerId, lifecycleStatus: data.isActive === false ? "inactive"
    : Array.isArray(data.seasonTotals) && data.seasonTotals.some((season: any) => season.leagueAbbrev === "NHL" && season.gamesPlayed > 0) ? "active_nhl" : "active_prospect", firstName, lastName, fullName: `${firstName} ${lastName}`, birthDate: data.birthDate,
    position: position(data.position), height: positive(data.heightInCentimeters), weight: positive(data.weightInKilograms),
    country: data.birthCountry ?? null, currentTeamId: data.isActive === true ? positive(data.currentTeamId) : null,
    sourceUrl, checkedAt: new Date().toISOString(), draft };
}

/** Official records include NHL IDs; the draft tracker alone does not. Paginate the records API. */
export async function fetchNhlDraftClass(year: number): Promise<NhlProspectIdentity[]> {
  if (!Number.isInteger(year) || year < 1963 || year > new Date().getUTCFullYear()) throw new Error("Invalid draft year.");
  const sourceUrl = `https://records.nhl.com/site/api/draft?cayenneExp=draftYear=${year}`;
  const rows: any[] = [];
  for (let start = 0; ; start += 100) {
    const result = await readNhl(`${sourceUrl}&start=${start}&limit=100`);
    if (!Array.isArray(result.data) || !Number.isInteger(result.total) || result.total > 1000) throw new Error("Invalid NHL draft response.");
    rows.push(...result.data);
    if (rows.length >= result.total) break;
    if (!result.data.length) throw new Error("Incomplete NHL draft response.");
  }
  const seen = new Set<number>();
  return rows.filter((row) => row.removedOutright !== "Y" && row.firstName && row.lastName && !/^forfeit/i.test(row.playerName ?? "")).map((row) => {
    if (row.draftYear !== year || !positive(row.overallPickNumber) || seen.has(row.overallPickNumber) || !positive(row.draftedByTeamId) || !positive(row.roundNumber) || !positive(row.pickInRound)) throw new Error("Conflicting or invalid NHL draft record.");
    seen.add(row.overallPickNumber);
    const firstName = name(row.firstName), lastName = name(row.lastName);
    return { nhlId: positive(row.playerId), lifecycleStatus: (year >= new Date().getUTCFullYear() - 5 ? "active_prospect" : "review_required") as NhlProspectIdentity["lifecycleStatus"], firstName, lastName, fullName: `${firstName} ${lastName}`,
      birthDate: row.birthDate ?? null, position: position(row.position), height: row.height ? Math.round(row.height * 2.54) : null,
      weight: row.weight ? Math.round(row.weight * 0.45359237) : null, country: row.countryCode ?? null,
      currentTeamId: null, sourceUrl, checkedAt: new Date().toISOString(),
      draft: { year, round: row.roundNumber, pick: row.pickInRound, overall: row.overallPickNumber,
        teamId: row.draftedByTeamId, teamAbbreviation: row.triCode, club: row.amateurClubName ?? null, league: row.amateurLeague ?? null, sourceUrl } };
  }).sort((a, b) => a.draft!.overall - b.draft!.overall);
}

export async function previewNhlDraftBatch(args: { year: number; after?: number; limit?: number; profiles?: boolean }) {
  const after = args.after ?? 0, limit = args.limit ?? 25;
  if (!Number.isInteger(after) || after < 0 || !Number.isInteger(limit) || limit < 1 || limit > 25) throw new Error("Use a nonnegative pick cursor and a limit of 1–25.");
  const all = await fetchNhlDraftClass(args.year);
  const batch = all.filter((player) => player.draft!.overall > after).slice(0, limit);
  const warnings: Array<{ nhlId: number; reason: string }> = [];
  const players: NhlProspectIdentity[] = [];
  for (let index = 0; index < batch.length; index += 5) {
    players.push(...await Promise.all(batch.slice(index, index + 5).map(async (player) => {
      if (!player.nhlId || args.profiles === false) return player;
      try {
        const profile = await fetchNhlPlayerIdentity(player.nhlId);
        // ID and birth date must agree; spelling changes do not create a new identity.
        if (player.birthDate && player.birthDate !== profile.birthDate) throw new Error("Draft/profile birth-date conflict");
        return { ...profile, draft: player.draft };
      } catch (error) {
        if (error instanceof NhlRateLimitError) throw error;
        warnings.push({ nhlId: player.nhlId, reason: error instanceof Error ? error.message : "Profile unavailable" });
        return player;
      }
    })));
  }
  const last = batch.at(-1)?.draft?.overall ?? after;
  return { year: args.year, profileLookupEnabled: args.profiles !== false, total: all.length, players, warnings, nextCursor: all.some((player) => player.draft!.overall > last) ? last : null };
}

export async function importNhlIdentity(supabase: any, identity: NhlProspectIdentity) {
  const result = await supabase.rpc("import_nhl_prospect_identity", { payload: identity, roster_season: rosterSeasonForDate() });
  if (result.error?.code === "P0001" && /conflict|ambiguous|requires manual review|needs review/i.test(result.error.message ?? "")) {
    const dedupeKey = `nhl-prospect:${identity.nhlId ?? `${identity.draft?.year}:${identity.draft?.overall}`}`;
    const existing = await supabase.from("fhfh_player_identity_review_queue").select("id")
      .eq("dedupe_key", dedupeKey).in("status", ["pending", "in_review"]).maybeSingle();
    if (existing.error) throw existing.error;
    if (!existing.data) {
      const queued = await supabase.from("fhfh_player_identity_review_queue").insert({
        review_type: "identity_conflict", raw_name: identity.fullName, dedupe_key: dedupeKey,
        source_evidence: { sourceUrl: identity.sourceUrl, nhlId: identity.nhlId, draft: identity.draft },
        submitted_context: { reason: result.error.message },
      });
      if (queued.error && queued.error.code !== "23505") throw queued.error;
    }
    return { status: "review", nhlId: identity.nhlId, reason: result.error.message };
  }
  if (result.error) throw result.error;
  return result.data;
}
