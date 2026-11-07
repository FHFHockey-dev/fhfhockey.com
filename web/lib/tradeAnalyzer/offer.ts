import type { Asset, Result } from "lib/tradeValue/contracts";

export const MAX_ROSTER_PLAYERS = 100;
export const MAX_OTHER_ASSETS = 20;
export type TeamId = "a" | "b";
export type ManualPlayer = { id: string; name: string; positions: string; status: string };
export type OtherAsset = Exclude<Asset, { kind: "player" }>;
export type OfferTeam = {
  id: TeamId; name: string; roster: ManualPlayer[]; rosterReviewed: boolean;
  totalCapacity: number | null; capacityReviewed: boolean;
  givePlayerIds: string[]; dropPlayerIds: string[]; otherAssets: OtherAsset[];
};
export type OfferInput = { effectiveDate: string; teams: [OfferTeam, OfferTeam] };
export type OfferIssue = { code: string; teamId?: TeamId; message: string };
export type CapacityPreview = { total: number; beforeCount: number; beforeExcess: number; afterExchangeCount: number;
  requiredDrops: number; afterCount: number; additionalDrops: number };
export type TeamPreview = { teamId: TeamId; before: ManualPlayer[]; afterExchange: Result<ManualPlayer[]>;
  after: Result<ManualPlayer[]>; drops: ManualPlayer[]; capacity: Result<CapacityPreview> };

/** Local row identifiers only; changing roster text requires reviewing selections again. */
export function rosterFromText(team: TeamId, text: string): ManualPlayer[] {
  return text.split(/\r?\n/).filter(line => line.trim()).map((line, index) => {
    const [name = "", positions = "", ...status] = line.split("|");
    return { id: `manual:${team}:${index + 1}`, name: name.trim(), positions: positions.trim(), status: status.join("|").trim() };
  });
}

/** Unknown pick metadata stays unknown; entered text is never market evidence. */
export function assetsFromText(text: string): OtherAsset[] {
  return text.split(/\r?\n/).filter(line => line.trim()).map(line => {
    const pick = line.trim().match(/^pick:\s*(.*)$/i);
    return pick ? { kind: "pick", rawText: pick[1], season: null, round: null, originalOwnerText: null, conditionText: null }
      : { kind: "unknown", rawText: line.trim() };
  });
}

const unavailable = <T>(...reasons: string[]): Result<T> => ({ status: "unavailable", reasons });
const repeated = (values: string[]) => new Set(values).size !== values.length;
const normalized = (value: string) => value.trim().toLocaleLowerCase();

/** Applies only an entered exchange and explicit drops. No slot solver or valuation. */
export function previewOffer(input: OfferInput) {
  const issues: OfferIssue[] = [];
  let exchangeBlocked = false;
  const issue = (code: string, message: string, teamId?: TeamId, blocksExchange = false) => {
    issues.push({ code, message, ...(teamId ? { teamId } : {}) });
    if (blocksExchange) exchangeBlocked = true;
  };
  const [a, b] = input.teams;
  if (a.id !== "a" || b.id !== "b") issue("team_ids", "The two roster sides must have distinct local team IDs.", undefined, true);
  const validDate = /^\d{4}-\d{2}-\d{2}$/.test(input.effectiveDate)
    && Number.isFinite(Date.parse(input.effectiveDate))
    && new Date(input.effectiveDate).toISOString().slice(0, 10) === input.effectiveDate;
  if (!validDate) issue("effective_date", "Enter a valid effective date. Trade timing and deadlines are not verified.");
  if (!a.name.trim() || !b.name.trim() || normalized(a.name) === normalized(b.name)) issue("team_names", "Enter two distinct team names.");

  const allPlayers = input.teams.flatMap(team => team.roster);
  if (repeated(allPlayers.map(player => player.id)) || allPlayers.some(player => !player.id.trim())) {
    issue("duplicate_identity", "Each player needs a unique local roster ID across both teams.", undefined, true);
  }
  if (repeated(allPlayers.map(player => normalized(player.name)))) {
    issue("ambiguous_name", "Repeated player names need distinct identifying labels; ownership cannot be inferred from a name.", undefined, true);
  }
  for (const team of input.teams) {
    if (team.roster.length > MAX_ROSTER_PLAYERS) issue("roster_limit", `${team.name || team.id}: at most ${MAX_ROSTER_PLAYERS} roster players are supported.`, team.id, true);
    if (team.roster.some(player => !player.name.trim())) issue("player_name", "Every roster row needs a player name.", team.id, true);
    if (!team.rosterReviewed) issue("roster_review", `${team.name || team.id}: confirm the complete before-roster and ownership.`, team.id);
    if (!Number.isSafeInteger(team.totalCapacity) || team.totalCapacity === null || team.totalCapacity < 0 || team.totalCapacity > MAX_ROSTER_PLAYERS) {
      issue("capacity_missing", `${team.name || team.id}: enter the maximum total players, including bench and reserves (0–${MAX_ROSTER_PLAYERS}).`, team.id);
    } else if (!team.capacityReviewed) issue("capacity_review", `${team.name || team.id}: review the total-player limit; active starting slots alone are insufficient.`, team.id);
    if (repeated(team.givePlayerIds)) issue("duplicate_exchange", "A player cannot be offered twice.", team.id, true);
    if (team.givePlayerIds.some(id => !team.roster.some(player => player.id === id))) issue("wrong_owner", "An outgoing player is not on that side’s entered roster.", team.id, true);
    if (team.givePlayerIds.length + team.otherAssets.length === 0) issue("empty_side", `${team.name || team.id}: enter at least one offered player, pick or other asset.`, team.id);
    if (team.otherAssets.length > MAX_OTHER_ASSETS) issue("asset_limit", `At most ${MAX_OTHER_ASSETS} picks or other assets per side are supported.`, team.id);
    if (team.otherAssets.some(asset => !asset.rawText.trim())) issue("asset_text", "Every pick or unknown asset needs its full description.", team.id);
  }
  const extras = input.teams.flatMap(team => team.otherAssets.map(asset => `${asset.kind}:${normalized(asset.rawText)}`));
  if (repeated(extras)) issue("duplicate_asset", "Repeated asset descriptions need distinguishing ownership or conditions. All entered assets are retained.");

  const teams: TeamPreview[] = input.teams.map((team, index) => {
    const other = input.teams[1 - index];
    const afterExchange: Result<ManualPlayer[]> = exchangeBlocked
      ? unavailable("Resolve roster identities and outgoing ownership before previewing either exchange.")
      : { status: "available", value: [...team.roster.filter(player => !team.givePlayerIds.includes(player.id)),
        ...other.roster.filter(player => other.givePlayerIds.includes(player.id))] };
    const invalidDrops = repeated(team.dropPlayerIds) || team.dropPlayerIds.some(id =>
      !team.roster.some(player => player.id === id) || team.givePlayerIds.includes(id));
    if (invalidDrops) issue("invalid_drop", "Select each drop once from retained players on the original roster. Exchanged or incoming players cannot also be dropped.", team.id);
    const drops = team.roster.filter(player => team.dropPlayerIds.includes(player.id));
    const after: Result<ManualPlayer[]> = invalidDrops ? unavailable("Resolve invalid drop selections.")
      : afterExchange.status === "unavailable" ? afterExchange
        : { status: "available", value: afterExchange.value.filter(player => !team.dropPlayerIds.includes(player.id)) };
    let capacity: Result<CapacityPreview> = unavailable("The total-player limit is missing or unreviewed. No free capacity is assumed.");
    if (team.capacityReviewed && team.totalCapacity !== null && Number.isSafeInteger(team.totalCapacity)
      && team.totalCapacity >= 0 && team.totalCapacity <= MAX_ROSTER_PLAYERS && afterExchange.status === "available" && after.status === "available") {
      const total = team.totalCapacity;
      const value = { total, beforeCount: team.roster.length, beforeExcess: Math.max(0, team.roster.length - total),
        afterExchangeCount: afterExchange.value.length, requiredDrops: Math.max(0, afterExchange.value.length - total),
        afterCount: after.value.length, additionalDrops: Math.max(0, after.value.length - total) };
      capacity = { status: "available", value };
      if (value.beforeExcess) issue("before_capacity", `${team.name}: the entered before-roster exceeds the reviewed total-player limit by ${value.beforeExcess}.`, team.id);
      if (value.additionalDrops) issue("drop_required", `${team.name}: select ${value.additionalDrops} additional drop(s) or correct the reviewed capacity. No player is dropped automatically.`, team.id);
    } else if (after.status === "unavailable") capacity = unavailable(...after.reasons);
    return { teamId: team.id, before: team.roster, afterExchange, after, drops, capacity };
  });
  return { issues, entryComplete: issues.length === 0, teams,
    datedLegality: unavailable<never>("Lineup eligibility, active/bench/reserve limits, locks, deadlines, processing time and keeper/cap rules are unverified. Roster counts do not establish trade legality."),
    valuation: unavailable<never>("No qualified league valuation is connected. Picks and unknown assets have no price here."),
    impact: unavailable<never>("No qualified full-roster forecast or lineup-impact contract is connected. Drop costs, displaced starts and net production are unavailable."),
    acceptance: unavailable<never>("The other manager’s preferences and acceptance are unknown."),
    market: unavailable<never>("No observation evidence is loaded. An entered offer is not a market sighting.") };
}
