import type {
  DraftSettings,
  DraftedPlayer,
} from "components/DraftDashboard/DraftDashboard";
import type { ProjectionSourceControls } from "./sourceControlPreferences";
import { getEffectiveSourceShares } from "./sourceWeights";
import { allocateGroupedRosterSlots } from "./forwardGrouping";
import { validateKeeperBatch, type KeeperEntry } from "./keepers";
import { validatePickTradeBatch, type PickTradeEntry } from "./pickTrades";
import { normalizeDraftOrderPattern } from "./draftOrder";
import { PROJECTION_SOURCES_CONFIG } from "lib/projectionsConfig/projectionSourcesConfig";

export type SettingsDomain = "league" | "roster" | "scoring" | "projections";
export interface SettingsIssue {
  domain: SettingsDomain;
  target: string;
  message: string;
  severity: "error" | "warning";
}
export interface SettingsValidationInput {
  settings: DraftSettings;
  myTeamId: string;
  goalieScoring: Record<string, number>;
  skaterSources: ProjectionSourceControls;
  goalieSources: ProjectionSourceControls;
  draftedPlayers?: DraftedPlayer[];
  keepers?: KeeperEntry[];
  trades?: PickTradeEntry[];
  playerEligibility?: ReadonlyMap<string, string[]>;
  forwardGrouping?: "split" | "fwd";
}

export function validateDraftSettings({
  settings,
  myTeamId,
  goalieScoring,
  skaterSources,
  goalieSources,
  draftedPlayers = [],
  keepers = [],
  trades = [],
  playerEligibility,
  forwardGrouping = "split",
}: SettingsValidationInput) {
  const issues: SettingsIssue[] = [];
  const add = (
    domain: SettingsDomain,
    target: string,
    message: string,
    severity: SettingsIssue["severity"] = "error",
  ) => issues.push({ domain, target, message, severity });
  const spots = Object.values(settings.rosterConfig).reduce(
    (sum, count) => sum + count,
    0,
  );
  if (
    !Number.isInteger(settings.teamCount) ||
    settings.teamCount < 2 ||
    settings.teamCount > 40
  )
    add("league", "teamCount", "Choose between 2 and 40 teams.");
  if (
    settings.draftOrder.length !== settings.teamCount ||
    new Set(settings.draftOrder).size !== settings.teamCount ||
    settings.draftOrder.some((id) => !id.trim())
  )
    add(
      "league",
      "teamCount",
      "Draft order must contain each team exactly once.",
    );
  if (!settings.draftOrder.includes(myTeamId))
    add("league", "myTeam", "Choose your team from the draft order.");
  if (
    settings.leagueType &&
    !["points", "categories"].includes(settings.leagueType)
  )
    add("league", "leagueType", "Choose a supported league type.");
  if (
    settings.draftOrderMode &&
    !["standard", "snake", "custom"].includes(settings.draftOrderMode)
  )
    add("league", "draft-order-mode", "Choose a supported draft order.");
  if (
    settings.reversedRounds?.some(
      (round) => !Number.isInteger(round) || round < 1 || round > spots,
    )
  )
    add(
      "league",
      "draft-order-mode",
      "Reversed rounds must be within the roster's draft rounds.",
    );
  for (const [position, count] of Object.entries(settings.rosterConfig)) {
    if (!Number.isInteger(count) || count < 0 || count > 40)
      add(
        "roster",
        `pos-${position}`,
        `${position.toUpperCase()} slots must be a whole number between 0 and 40.`,
      );
  }
  if (!(spots > 0) || spots > 100)
    add("roster", "pos-C", "Configure between 1 and 100 total roster spots.");
  const reservedRound = Math.max(
    0,
    ...keepers.filter((k) => k.cost !== "none").map((k) => k.round),
    ...trades.map((t) => t.round),
    ...draftedPlayers.map((p) => p.round),
  );
  if (spots < reservedRound)
    add(
      "roster",
      "pos-bench",
      `Keep at least ${reservedRound} roster spots to preserve completed or reserved rounds.`,
    );
  const assignments = [
    ...draftedPlayers,
    ...keepers.filter(
      (k) => !draftedPlayers.some((p) => p.playerId === k.playerId),
    ),
  ];
  if (assignments.some((p) => !settings.draftOrder.includes(p.teamId)))
    add(
      "league",
      "teamCount",
      "A drafted player or keeper belongs to a team outside this draft order.",
    );
  for (const teamId of settings.draftOrder) {
    const players = assignments.filter((p) => p.teamId === teamId);
    if (players.length > spots) {
      add(
        "roster",
        "pos-bench",
        `${teamId} has ${players.length} players but only ${spots} roster spots. Increase capacity or correct picks; no players have been removed.`,
      );
    } else if (
      players.length &&
      playerEligibility &&
      players.every((p) => playerEligibility.has(p.playerId))
    ) {
      const allocation = allocateGroupedRosterSlots({
        players: players.map((p) => ({
          id: p.playerId,
          eligibility: playerEligibility.get(p.playerId)!,
        })),
        rosterConfig: settings.rosterConfig,
        grouping: forwardGrouping,
      });
      if (allocation.counts.BENCH > settings.rosterConfig.bench)
        add(
          "roster",
          "pos-bench",
          `${teamId}'s drafted positions exceed the available slots and bench. Restore capacity or correct the roster; all picks are preserved.`,
        );
    }
  }
  if (!settings.isKeeper && keepers.length)
    add(
      "league",
      "keeper-league",
      "Keep Keeper League enabled while keepers are assigned.",
    );
  const scoring =
    settings.leagueType === "categories"
      ? [settings.categoryWeights || {}]
      : [settings.scoringCategories, goalieScoring];
  if (
    !scoring.some((group) =>
      Object.values(group).some(
        (value) => Number.isFinite(value) && value !== 0,
      ),
    )
  )
    add(
      "scoring",
      "draft-domain-scoring",
      "Add at least one scoring category with a nonzero weight.",
    );
  if (
    scoring.some((group) =>
      Object.values(group).some(
        (value) =>
          !Number.isFinite(value) ||
          (settings.leagueType === "categories" && value < 0),
      ),
    )
  )
    add(
      "scoring",
      "draft-domain-scoring",
      "Scoring weights must be finite numbers; category weights cannot be negative.",
    );
  if (
    settings.leagueType !== "categories" &&
    (settings.rosterConfig.G || 0) > 0 &&
    !Object.values(goalieScoring).some((v) => v !== 0)
  )
    add(
      "scoring",
      "draft-domain-scoring",
      "Goalie slots are configured but goalie scoring is empty.",
      "warning",
    );
  const totals = [skaterSources, goalieSources].map((controls, index) => {
    const group = index ? "Goalie" : "Skater";
    const selected = Object.values(controls).filter((c) => c.isSelected);
    if (!selected.some((c) => c.weight > 0 && Number.isFinite(c.weight)))
      add(
        "projections",
        `sources-${index ? "goalie" : "skater"}`,
        `${group} projections need an enabled source with a positive weight.`,
      );
    if (
      Object.values(controls).some(
        (c) => !Number.isFinite(c.weight) || c.weight < 0 || c.weight > 2,
      )
    )
      add(
        "projections",
        `sources-${index ? "goalie" : "skater"}`,
        `${group} source multipliers must be between 0 and 2.`,
      );
    return Math.round(
      Object.values(getEffectiveSourceShares(controls)).reduce(
        (sum, share) => sum + share,
        0,
      ) * 100,
    );
  });
  const errors = issues.filter((issue) => issue.severity === "error");
  return {
    valid: errors.length === 0,
    issues,
    errors,
    warnings: issues.filter((issue) => issue.severity === "warning"),
    spots,
    scoringCount: scoring.reduce(
      (sum, group) => sum + Object.keys(group).length,
      0,
    ),
    skaterWeight: totals[0],
    goalieWeight: totals[1],
    domains: Object.fromEntries(
      (["league", "roster", "scoring", "projections"] as const).map(
        (domain) => [domain, !errors.some((issue) => issue.domain === domain)],
      ),
    ) as Record<SettingsDomain, boolean>,
  };
}

export type DraftSettingsValidation = ReturnType<typeof validateDraftSettings>;

// Validate the complete portable session before any setter can partially apply it.
export function bookmarkImportError(
  data: any,
  availableCustomSourceIds?: string[],
): string | null {
  const record = (value: any) =>
    value && typeof value === "object" && !Array.isArray(value);
  const numbers = (value: any) =>
    record(value) &&
    Object.values(value).every(
      (v) => typeof v === "number" && Number.isFinite(v),
    );
  if (!record(data) || ![2, 3].includes(data.v))
    return "Unsupported bookmark. Use a v2 or v3 draft bookmark.";
  const s = data.settings;
  if (
    !record(s) ||
    !numbers(s.rosterConfig) ||
    !Number.isFinite(s.rosterConfig.bench) ||
    !Number.isFinite(s.rosterConfig.utility) ||
    !numbers(s.scoringCategories) ||
    !Array.isArray(s.draftOrder) ||
    !s.draftOrder.every((id: unknown) => typeof id === "string") ||
    (s.categoryWeights && !numbers(s.categoryWeights)) ||
    (s.reversedRounds && !Array.isArray(s.reversedRounds))
  )
    return "Invalid bookmark settings. The current draft has not changed.";
  if (
    !Number.isInteger(s.teamCount) ||
    s.teamCount < 2 ||
    s.teamCount > 40 ||
    Object.values<number>(s.rosterConfig).some(
      (count) => !Number.isInteger(count) || count < 0 || count > 40,
    ) ||
    Object.values<number>(s.rosterConfig).reduce((a, b) => a + b, 0) > 100
  )
    return "Invalid team count or roster capacity in bookmark.";
  if (
    !Array.isArray(data.draftedPlayers) ||
    data.draftedPlayers.some(
      (p: any) =>
        !record(p) ||
        typeof p.playerId !== "string" ||
        !s.draftOrder.includes(p.teamId) ||
        !Number.isInteger(p.pickNumber) ||
        p.pickNumber < 1 ||
        p.round !== Math.ceil(p.pickNumber / s.teamCount) ||
        p.pickInRound !== ((p.pickNumber - 1) % s.teamCount) + 1,
    ) ||
    new Set(data.draftedPlayers.map((p: any) => p.playerId)).size !==
      data.draftedPlayers.length ||
    new Set(data.draftedPlayers.map((p: any) => p.pickNumber)).size !==
      data.draftedPlayers.length
  )
    return "Invalid or duplicate draft picks in bookmark.";
  for (const [index, controls] of [
    data.sourceControls,
    data.goalieSourceControls,
  ].entries()) {
    if (
      controls !== undefined &&
      (!record(controls) ||
        Object.values(controls).some(
          (c: any) =>
            !record(c) ||
            typeof c.isSelected !== "boolean" ||
            !Number.isFinite(c.weight) ||
            c.weight < 0 ||
            c.weight > 2,
        ))
    )
      return "Invalid projection source weights in bookmark.";
    if (
      controls &&
      Object.keys(controls).some(
        (id) =>
          !id.startsWith("custom_csv") &&
          !PROJECTION_SOURCES_CONFIG.some(
            (source) =>
              source.id === id &&
              source.playerType === (index ? "goalie" : "skater"),
          ),
      )
    )
      return "Bookmark contains an unsupported projection source.";
    if (
      controls &&
      availableCustomSourceIds &&
      Object.entries(controls).some(
        ([id, control]: [string, any]) =>
          id.startsWith("custom_csv") &&
          control.isSelected &&
          !availableCustomSourceIds.includes(id),
      )
    )
      return "This bookmark uses a custom projection CSV that is missing from this tab. Import that CSV before importing the bookmark.";
  }
  if (data.goalieScoringCategories && !numbers(data.goalieScoringCategories))
    return "Invalid goalie scoring in bookmark.";
  if (
    data.customTeamNames &&
    (!record(data.customTeamNames) ||
      Object.values(data.customTeamNames).some(
        (name) => typeof name !== "string",
      ))
  )
    return "Invalid team names in bookmark.";
  if (
    !Number.isInteger(data.currentPick) ||
    data.currentPick < 1 ||
    data.currentPick >
      s.teamCount *
        Object.values<number>(s.rosterConfig).reduce((a, b) => a + b, 0) +
        1
  )
    return "Invalid current pick in bookmark.";
  for (const entries of [data.keepers, data.pickTrades]) {
    if (
      entries !== undefined &&
      (!Array.isArray(entries) || entries.some((entry: any) => !record(entry)))
    )
      return "Invalid keepers or traded picks in bookmark.";
  }
  const spots = Object.values<number>(s.rosterConfig).reduce(
    (a, b) => a + b,
    0,
  );
  const keeperResult = validateKeeperBatch(data.keepers || [], {
    teamCount: s.teamCount,
    roundCount: spots,
    teamIds: s.draftOrder,
    playerIds: [...data.draftedPlayers, ...(data.keepers || [])].map(
      (p: any) => p.playerId,
    ),
    draftedPlayers: data.draftedPlayers.filter((p: any) => !p.isKeeper),
    rosterCapacity: spots,
  });
  if (!keeperResult.ok)
    return `Invalid keepers: ${keeperResult.errors.join(" ")}`;
  if (
    data.pickOwnerOverrides &&
    (!record(data.pickOwnerOverrides) ||
      Object.entries(data.pickOwnerOverrides).some(
        ([key, owner]) => !/^\d+-\d+$/.test(key) || typeof owner !== "string",
      ))
  )
    return "Invalid traded pick ownership in bookmark.";
  const tradeCandidates =
    data.pickTrades ||
    Object.entries(data.pickOwnerOverrides || {}).map(([key, owner]) => {
      const [round, pickInRound] = key.split("-").map(Number);
      return { round, pickInRound, currentTeamId: owner };
    });
  if (
    new Set(tradeCandidates.map((t: any) => `${t.round}-${t.pickInRound}`))
      .size !== tradeCandidates.length
  )
    return "Duplicate traded picks in bookmark.";
  const tradeResult = validatePickTradeBatch(tradeCandidates, {
    draftOrder: s.draftOrder,
    roundCount: spots,
    orderPattern: normalizeDraftOrderPattern(
      { mode: s.draftOrderMode, reversedRounds: s.reversedRounds },
      spots,
      data.isSnakeDraft ?? true,
    ),
    keepers: keeperResult.keepers,
  });
  if (!tradeResult.ok)
    return `Invalid traded picks: ${tradeResult.errors.join(" ")}`;
  const validation = validateDraftSettings({
    settings: s,
    myTeamId: data.myTeamId,
    goalieScoring: data.goalieScoringCategories || {},
    skaterSources: data.sourceControls || {
      default: { isSelected: true, weight: 1 },
    },
    goalieSources: data.goalieSourceControls || {
      default: { isSelected: true, weight: 1 },
    },
    draftedPlayers: data.draftedPlayers,
    keepers: keeperResult.keepers,
    trades: tradeResult.trades,
  });
  return validation.errors[0]?.message || null;
}
