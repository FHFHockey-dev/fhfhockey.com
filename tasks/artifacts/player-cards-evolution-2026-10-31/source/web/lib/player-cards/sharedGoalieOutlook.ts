import { GOALIE_INVENTORY_VERSION, type GoalieInventory, type InventoryMetric } from "../socialShare/modules/shared/goalieInventory";
import type { GoalieOutlook } from "./goalieOutlook";

/** Pure downstream consumer of Claude's frozen DTO. No source loader, resolver or credential imports. */
export function sharedGoalieOutlook(inventory: GoalieInventory, selected: GoalieOutlook["player"], mode: "fixture"): GoalieOutlook {
  const empty = (reason: string): GoalieOutlook => ({ state: "unavailable", player: { ...selected }, observedAt: inventory.generatedAt, reason, games: [] });
  if (mode !== "fixture") return empty("Observed shared inventory admission is still pending; no live pipeline claim.");
  const at = Date.parse(inventory.generatedAt);
  if (inventory.version !== GOALIE_INVENTORY_VERSION || inventory.season !== selected.season || !Number.isFinite(at) || ["missing", "blocked", "stale"].includes(inventory.state)) return empty(`Shared inventory unavailable: ${inventory.reasons.join("; ") || "version, season, time or source-state mismatch"}`);
  const matches = inventory.goalies.filter(g => g.goalieId === selected.id && g.team === selected.team);
  if (matches.length !== 1) return empty("Shared goalie identity/current-team match is absent or ambiguous.");
  const entry = matches[0];
  const confirmationSources = inventory.sources.filter(s => s.tables.includes("player_forecast_goalie_start_observations"));
  const confirmationSourceAvailable = confirmationSources.length > 0 && confirmationSources.every(s => s.state === "ready" || s.state === "partial");
  const confirmationWarnings = [...new Set(confirmationSources.flatMap(s => s.reasons))];
  if (!confirmationSourceAvailable) confirmationWarnings.push("Starter confirmation source unavailable; status remains unknown.");
  const date = (s: string) => /^\d{4}-\d{2}-\d{2}$/.test(s) && Number.isFinite(Date.parse(s)) && new Date(s).toISOString().slice(0, 10) === s;
  if (!date(inventory.from) || !date(inventory.through) || inventory.from > inventory.through || new Set(entry.games.map(g => g.gameId)).size !== entry.games.length || entry.games.some(g => g.team !== selected.team || !Number.isSafeInteger(g.gameId) || g.gameId <= 0 || !g.opponent || !date(g.date) || g.date < inventory.from || g.date > inventory.through || g.startTimeUtc !== null && !Number.isFinite(Date.parse(g.startTimeUtc)))) return empty("Shared schedule contains an identity, date-range or duplicate-game mismatch.");
  const metric = (label: string, group: string, m: InventoryMetric) => ({ label, group, text: m.value !== null && Number.isFinite(m.value) && Number.isSafeInteger(m.sampleGames) && m.sampleGames > 0 && m.unit && m.window ? `${m.value} ${m.unit} · ${m.window} · ${m.sampleGames} team games` : "Unavailable: missing metric, unit, window or sample." });
  return { state: "fixture", player: { ...selected }, observedAt: inventory.generatedAt, reason: inventory.state === "partial" ? `Partial inventory: ${inventory.reasons.join("; ") || "some inputs unavailable"}` : entry.games.length ? null : "No scheduled games in supplied shared inventory.", sharedProvenance: {
    version: inventory.version, sourceState: inventory.state,
    sourceNotes: inventory.sources.map(s => `${s.name}: ${s.state}; tables ${s.tables.join(", ")}; as of ${s.asOf || "unknown"}; updated ${s.updatedAt || "unknown"}; ${s.reasons.join("; ")}`),
    confirmationWarnings,
    recentStarts: { ...entry.recentStarts },
  }, games: entry.games.map(g => {
    const c = g.confirmation, f = g.forecast;
    const confirmed = confirmationSourceAvailable && c.state !== "none" && !!c.source.trim() && Number.isFinite(Date.parse(c.observedAt)) && Date.parse(c.observedAt) <= at && (c.expiresAt === null || Number.isFinite(Date.parse(c.expiresAt)) && Date.parse(c.expiresAt) > at);
    const forecast = f.state === "qualified" && Number.isFinite(f.startProbability) && f.startProbability >= 0 && f.startProbability <= 1 && !!f.revisionId && !!f.modelLabel && Number.isFinite(Date.parse(f.issuedAt)) && Date.parse(f.issuedAt) <= at && Number.isFinite(Date.parse(f.expiresAt)) && Date.parse(f.expiresAt) > at;
    return { id: g.gameId, heading: `${g.startTimeUtc || `${g.date} · start time unavailable`} · ${g.team} vs ${g.opponent} · ${g.home ? "home" : "away"}`,
      confirmation: confirmed ? `${c.state} · ${c.source} · ${c.observedAt} · expires ${c.expiresAt || "not supplied"}${c.sourceUrl ? ` · ${c.sourceUrl}` : ""}` : "No current resolved starter confirmation; absence is not evidence of not starting.",
      forecast: forecast ? `Fixture Start Chart start probability ${(f.startProbability * 100).toFixed(1)}%; ${f.modelLabel}; revision ${f.revisionId}; issued ${f.issuedAt}; expires ${f.expiresAt}. Separate from confirmation and workload.` : `Start forecast unavailable: ${f.state === "unavailable" ? f.reason : "expired or incomplete admitted forecast"}. No odds inferred from appearance share.`,
      dimensions: [metric("Opponent shots for", "Volume upside", g.signals.volume.opponentShotsForPerGame), metric("Team shots against", "Volume upside", g.signals.volume.teamShotsAgainstPerGame),
        metric("Opponent xGF", "Ratio exposure", g.signals.ratioExposure.opponentXgfPerGame), metric("Team xGA", "Ratio exposure", g.signals.ratioExposure.teamXgaPerGame), metric("Opponent chances for", "Ratio exposure", g.signals.ratioExposure.opponentScoringChancesPerGame), metric("Team chances against", "Ratio exposure", g.signals.ratioExposure.teamScoringChancesAgainstPerGame), metric("Opponent PP", "Ratio exposure", g.signals.ratioExposure.opponentPowerPlayPct), metric("Team PK", "Ratio exposure", g.signals.ratioExposure.teamPenaltyKillPct), metric("Team penalty exposure", "Ratio exposure", g.signals.ratioExposure.teamTimesShorthandedPerGame),
        metric("Team goals for", "Win support", g.signals.winSupport.teamGoalsForPerGame), metric("Opponent goals against", "Win support", g.signals.winSupport.opponentGoalsAgainstPerGame), metric("Team goal differential", "Win support", g.signals.winSupport.teamGoalDifferentialPerGame)],
    };
  }) };
}
