// Plain-language labels for the caveat / source-quality keys the rankings APIs return.
// Tooltips, notices and snapshot panels show these instead of raw snake_case keys.

const CAVEAT_LABELS: Record<string, string> = {
  context_influenced_unadjusted_on_ice:
    "On-ice result, not adjusted for teammates or opponents",
  rink_scorekeeper_sensitive_unadjusted: "Rink scorekeepers count this differently",
  fenwick_xg_denominator_matched: "Based on unblocked shot attempts",
  on_ice_shooting_context: "Includes on-ice shooting luck",
  fallback_rolling_player_game_metrics: "Built from rolling game data (snapshot unavailable)",
  sample_below_minimum: "Below the selected minimum sample",
  small_peer_group: "Small peer group",
  raw_contextual_team_style: "Raw team style, not adjusted for score or venue",
  raw_contextual_5v5: "Raw 5v5 context, not adjusted",
  contextual_on_ice: "On-ice context",
  contextual_descriptive_composite: "Descriptive composite, not isolated impact",
  contextual_defensive_impact: "Defense in context, not isolated defensive talent",
  blocked_missing_controls: "Not shown: missing context controls",
  ev_toi_fallback: "Even-strength ice time estimated",
  matched_team_without_player_toi_seconds: "Team-without-player ice time matched by game",
  score_strength_shot_context: "Shot context by score and strength",
  team_style_using_dated_nst_5v5_fallback: "Team style uses an older Natural Stat Trick snapshot",
  partial_wgo_save_source: "Partial NHL.com save data",
  partial_team_without_goalie_5v5_save_source: "Partial team save data without this goalie",
  partial_quality_start_source: "Partial quality-start data",
  partial_goalie_steal_source: "Partial steal data",
  partial_goalie_start_source: "Partial start data",
  partial_source_coverage: "Partial source coverage",
  missing_matching_season_baseline: "No matching season baseline",
  missing_goalie_5v5_save_sample: "No 5v5 save sample",
  missing_component_value: "A component value is missing",
  low_team_without_goalie_5v5_save_sample: "Small sample for the team without this goalie",
  low_role_confidence: "Low role confidence",
  inferred_top_two_adjusted_start_share: "Start share inferred from the top two goalies",
  core_goalie_ids_missing_top_two_context: "Top-two goalie context missing",
  denominator_pending_confirmation: "Denominator not yet confirmed",
  team_unit_toi_source_missing: "Line-usage data missing",
  team_unit_toi_partial_forward_defense_coverage: "Partial forward/defense line coverage",
  team_style_source_missing: "Team style data missing",
  team_game_context_source_missing: "Game-context data missing",
  source_pending: "Source pending",
  wins_above_replacement_source_pending: "WAR is not published yet",
};

// partial_nst_5v5_<part>_source → "Partial Natural Stat Trick 5v5 <part> data"
const NST_PARTS: Record<string, string> = {
  relative_save: "relative save",
  gsaa: "GSAA",
  gsax: "GSAx",
  shot_quality: "shot-quality",
  high_danger: "high-danger",
  style: "team style",
  start_quality: "start-quality",
};

const TOKENS: Record<string, string> = {
  nst: "Natural Stat Trick",
  wgo: "NHL.com",
  xg: "xG",
  toi: "ice time",
  gsax: "GSAx",
  gsaa: "GSAA",
  pp: "PP",
  pk: "PK",
  ev: "even-strength",
};

export function formatCaveat(key: string): string {
  const trimmed = key.trim();
  if (CAVEAT_LABELS[trimmed]) return CAVEAT_LABELS[trimmed];
  // Already a sentence (spaces or capitals): pass through untouched.
  if (!/^[a-z0-9_]+$/.test(trimmed)) return trimmed;
  const nst = /^partial_nst_5v5_(.+)_source$/.exec(trimmed);
  if (nst) {
    const part = NST_PARTS[nst[1]] ?? nst[1].replace(/_/g, " ");
    return `Partial Natural Stat Trick 5v5 ${part} data`;
  }
  // Unknown key: readable words, never raw snake_case.
  const words = trimmed
    .split("_")
    .map((word) => TOKENS[word] ?? word)
    .join(" ");
  return words.charAt(0).toUpperCase() + words.slice(1);
}

export function formatCaveats(keys: readonly string[], separator = "; "): string {
  // Group the per-metric Natural Stat Trick gaps into one phrase instead of six.
  const nstParts: string[] = [];
  const rest: string[] = [];
  for (const key of keys) {
    const match = /^partial_nst_5v5_(.+)_source$/.exec(key.trim());
    if (match) nstParts.push(NST_PARTS[match[1]] ?? match[1].replace(/_/g, " "));
    else rest.push(formatCaveat(key));
  }
  const labels = nstParts.length
    ? [`Partial Natural Stat Trick 5v5 data (${Array.from(new Set(nstParts)).join(", ")})`, ...rest]
    : rest;
  return Array.from(new Set(labels)).join(separator);
}
