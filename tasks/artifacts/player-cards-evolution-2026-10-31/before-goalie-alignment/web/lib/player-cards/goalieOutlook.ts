import type { StartChartGoalie } from "../projections/startChartContract";

/** Temporary consumer fixture interface. Claude's shared producer owns final admission. */
export const GOALIE_CARD_CONTRACT = "fhfh-goalie-card-consumer-proposal-v1" as const;
export type GoalieDimension = "opponentShotsFor" | "teamShotsAgainst" | "opponentXgf" | "teamXga" | "opponentChancesFor" | "teamChancesAgainst" | "opponentPowerPlay" | "teamPenaltyKill" | "teamPenaltyExposure" | "teamGoalsFor" | "opponentGoalsAgainst";
export const GOALIE_DIMENSIONS: Record<GoalieDimension, { label: string; group: "Volume upside" | "Ratio exposure" | "Win support" }> = {
  opponentShotsFor: { label: "Opponent shots for", group: "Volume upside" }, teamShotsAgainst: { label: "Team shots against", group: "Volume upside" },
  opponentXgf: { label: "Opponent xGF", group: "Ratio exposure" }, teamXga: { label: "Team xGA", group: "Ratio exposure" }, opponentChancesFor: { label: "Opponent chances for", group: "Ratio exposure" }, teamChancesAgainst: { label: "Team chances against", group: "Ratio exposure" }, opponentPowerPlay: { label: "Opponent PP", group: "Ratio exposure" }, teamPenaltyKill: { label: "Team PK", group: "Ratio exposure" }, teamPenaltyExposure: { label: "Team penalty exposure", group: "Ratio exposure" }, teamGoalsFor: { label: "Team goals for", group: "Win support" }, opponentGoalsAgainst: { label: "Opponent goals against", group: "Win support" },
};
export type GoalieInventory = {
  version: typeof GOALIE_CARD_CONTRACT; source: "synthetic"; player: { id: number; name: string; team: string; season: number }; observedAt: string; sourceVersion: string;
  games: { id: number; start: string; team: string; opponent: string; status: "scheduled" | "postponed" | "cancelled";
    confirmation: { status: "confirmed" | "probable" | "unknown" | "conflicting"; source: string | null; updatedAt: string | null; stale: boolean; appearanceKind: "start" | "relief" | "unknown" };
    dimensions: Partial<Record<GoalieDimension, { value: number | null; unit: string; basis: string; strength: string; source: string; model: string | null; updatedAt: string | null; stale: boolean }>>;
    forecast: { admitted: boolean; receipt: string | null; conditionalBasis: "given-start"; version: string; horizon: string; uncertainty: string; target: StartChartGoalie } | null;
  }[];
};
export type GoalieOutlook = { state: "fixture" | "unavailable"; player: GoalieInventory["player"]; observedAt: string; reason: string | null; games: { id: number; heading: string; confirmation: string; forecast: string; dimensions: { label: string; group: string; text: string }[] }[] };
const time = (s: string | null) => s === null ? NaN : Date.parse(s);
export function goalieOutlook(input: GoalieInventory | null, selected: GoalieInventory["player"]): GoalieOutlook {
  const empty = (reason: string): GoalieOutlook => ({ state: "unavailable", player: { ...selected }, observedAt: input?.observedAt || "Unavailable", reason, games: [] });
  if (!input) return empty("Shared goalie inventory unavailable. No start forecast is inferred from appearance share.");
  if (input.version !== GOALIE_CARD_CONTRACT || input.source !== "synthetic") return empty("Shared producer interface/admission receipt pending; this proposal accepts fixtures only.");
  if (input.player.id !== selected.id || input.player.team !== selected.team || input.player.season !== selected.season) return empty("Goalie identity, current team or season mismatch; stale selection cleared.");
  if (!Number.isFinite(time(input.observedAt)) || !input.sourceVersion || new Set(input.games.map(g => g.id)).size !== input.games.length || input.games.some(g => g.team !== selected.team || !Number.isSafeInteger(g.id) || !Number.isFinite(time(g.start)) || !g.opponent)) return empty("Goalie schedule identity or source time is unverified.");
  return { state: "fixture", player: { ...selected }, observedAt: input.observedAt, reason: input.games.length ? null : "No scheduled games in supplied inventory.", games: input.games.map(g => {
    const c = g.confirmation, confirmationValid = g.status === "scheduled" && !c.stale && !!c.source && Number.isFinite(time(c.updatedAt)) && time(c.updatedAt) <= time(input.observedAt) && c.appearanceKind === "start";
    const confirmation = confirmationValid ? `${c.status} · ${c.source} · ${c.updatedAt}` : `Unknown starter · ${c.appearanceKind === "relief" ? "relief is not an official start" : c.stale ? "stale source" : "source/confirmation unavailable"}`;
    const f = g.forecast;
    const validForecast = g.status === "scheduled" && f?.admitted && !!f.receipt && f.target.player_id === selected.id && !f.target.is_stale && f.conditionalBasis === "given-start" && !!f.version && !!f.horizon && !!f.uncertainty && Number.isFinite(f.target.projected_gsaa_per_60) && Number.isFinite(time(f.target.source_updated_at)) && time(f.target.source_updated_at) <= time(input.observedAt);
    return { id: g.id, heading: `${g.start} · ${g.team} vs ${g.opponent} · ${g.status}`, confirmation, forecast: validForecast ? `Synthetic conditional forecast given a start: ${f!.target.projected_gsaa_per_60} GSAA/60; ${f!.version}; ${f!.horizon}; ${f!.uncertainty}. Start probability not inferred.` : "Conditional forecast unavailable; no start odds inferred from workload.", dimensions: (Object.keys(GOALIE_DIMENSIONS) as GoalieDimension[]).map(key => {
      const d = g.dimensions[key], def = GOALIE_DIMENSIONS[key];
      const valid = d && d.value !== null && Number.isFinite(d.value) && d.value >= 0 && !!d.source && !!d.unit && !!d.basis && !!d.strength && !d.stale && Number.isFinite(time(d.updatedAt)) && time(d.updatedAt) <= time(input.observedAt) && (!key.toLowerCase().includes("xg") || !!d.model);
      return { ...def, text: valid ? `${d!.value} ${d!.unit} · ${d!.basis} · ${d!.strength} · ${d!.source}${d!.model ? ` (${d!.model})` : ""} · ${d!.updatedAt}` : "Unavailable: missing, stale or unqualified source dimension." };
    }) };
  }) };
}
