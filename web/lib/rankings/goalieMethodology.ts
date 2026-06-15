export type GoalieQualityStartMode = "classic_save_pct" | "modern_gsax";

export type GoalieStartShareBucket =
  | "workhorse"
  | "lead_tandem"
  | "secondary_tandem"
  | "backup"
  | "spot_start";

export type GoalieDeploymentBucket =
  | "g1_workhorse"
  | "g1_starter"
  | "g1a_tandem_lead"
  | "g1b_tandem_secondary"
  | "g2_backup"
  | "g2_reserve";

export type GoalieRoleFilter = "all" | GoalieDeploymentBucket;

export const GOALIE_ROLE_FILTER_OPTIONS: Array<{
  value: GoalieRoleFilter;
  label: string;
}> = [
  { value: "all", label: "All Goalie Roles" },
  { value: "g1_workhorse", label: "G1 Workhorse" },
  { value: "g1_starter", label: "G1 Starter" },
  { value: "g1a_tandem_lead", label: "G1A Tandem Lead" },
  { value: "g1b_tandem_secondary", label: "G1B Tandem Secondary" },
  { value: "g2_backup", label: "G2 Backup" },
  { value: "g2_reserve", label: "G2 Reserve" },
];

export type GoalieGameForMethodology = {
  goalieId: number;
  gameId?: number | null;
  date?: string | null;
  started: boolean;
  shotsAgainst: number | null;
  saves: number | null;
  goalsAgainst: number | null;
  goalsSavedAboveExpected?: number | null;
  xgAgainst?: number | null;
  won?: boolean | null;
};

export type GoalieStartForNetshare = {
  goalieId: number;
  date: string;
  started: boolean;
  isEmergencyCallup?: boolean;
  topTwoUnavailableGoalieIds?: readonly number[];
  absenceConfidence?: "low" | "medium" | "high";
};

export type AdjustedCoreNetshareResult = {
  coreStarts: number;
  totalStarts: number;
  excludedEmergencyStarts: number;
  adjustedCoreNetshare: number | null;
  warnings: string[];
};

type QualityStartThresholds = {
  leagueAverageSavePct: number;
  lowShotClassicSavePct: number;
  lowShotThreshold: number;
  reallyBadSavePct: number;
  reallyBadGsax: number;
  stealGsax: number;
  stealSavePct: number;
  stealShotsAgainst: number;
};

const DEFAULT_THRESHOLDS: QualityStartThresholds = {
  leagueAverageSavePct: 0.9,
  lowShotClassicSavePct: 0.885,
  lowShotThreshold: 20,
  reallyBadSavePct: 0.85,
  reallyBadGsax: -2,
  stealGsax: 1,
  stealSavePct: 0.93,
  stealShotsAgainst: 30,
};

function finite(value: number | null | undefined): number | null {
  return typeof value === "number" && Number.isFinite(value) ? value : null;
}

function round(value: number, decimals = 6) {
  return Number(value.toFixed(decimals));
}

function savePct(game: GoalieGameForMethodology) {
  const shotsAgainst = finite(game.shotsAgainst);
  const saves = finite(game.saves);
  if (shotsAgainst == null || saves == null || shotsAgainst <= 0) return null;
  return saves / shotsAgainst;
}

export function calculateGoalieGsax(game: {
  goalsSavedAboveExpected?: number | null;
  xgAgainst?: number | null;
  goalsAgainst?: number | null;
}) {
  const provided = finite(game.goalsSavedAboveExpected);
  if (provided != null) return provided;
  const xgAgainst = finite(game.xgAgainst);
  const goalsAgainst = finite(game.goalsAgainst);
  if (xgAgainst == null || goalsAgainst == null) return null;
  return round(xgAgainst - goalsAgainst);
}

export function isGoalieQualityStart(
  game: GoalieGameForMethodology,
  options?: {
    mode?: GoalieQualityStartMode;
    thresholds?: Partial<QualityStartThresholds>;
  },
) {
  if (!game.started) return false;
  const mode = options?.mode ?? "modern_gsax";
  const thresholds = { ...DEFAULT_THRESHOLDS, ...options?.thresholds };

  if (mode === "modern_gsax") {
    const gsax = calculateGoalieGsax(game);
    return gsax != null && gsax >= 0;
  }

  const pct = savePct(game);
  const shotsAgainst = finite(game.shotsAgainst);
  if (pct == null || shotsAgainst == null) return false;
  if (shotsAgainst < thresholds.lowShotThreshold) {
    return pct >= thresholds.lowShotClassicSavePct;
  }
  return pct >= thresholds.leagueAverageSavePct;
}

export function isGoalieReallyBadStart(
  game: GoalieGameForMethodology,
  options?: {
    mode?: GoalieQualityStartMode;
    thresholds?: Partial<QualityStartThresholds>;
  },
) {
  if (!game.started) return false;
  const mode = options?.mode ?? "modern_gsax";
  const thresholds = { ...DEFAULT_THRESHOLDS, ...options?.thresholds };

  if (mode === "modern_gsax") {
    const gsax = calculateGoalieGsax(game);
    return gsax != null && gsax <= thresholds.reallyBadGsax;
  }

  const pct = savePct(game);
  return pct != null && pct <= thresholds.reallyBadSavePct;
}

export function isGoalieStealGame(
  game: GoalieGameForMethodology,
  options?: {
    mode?: GoalieQualityStartMode;
    thresholds?: Partial<QualityStartThresholds>;
  },
) {
  if (!game.started || game.won !== true) return false;
  const mode = options?.mode ?? "modern_gsax";
  const thresholds = { ...DEFAULT_THRESHOLDS, ...options?.thresholds };

  if (mode === "modern_gsax") {
    const gsax = calculateGoalieGsax(game);
    return gsax != null && gsax >= thresholds.stealGsax;
  }

  const pct = savePct(game);
  const shotsAgainst = finite(game.shotsAgainst);
  return (
    pct != null &&
    shotsAgainst != null &&
    shotsAgainst >= thresholds.stealShotsAgainst &&
    pct >= thresholds.stealSavePct
  );
}

export function getGoalieStartsShareBucket(
  startShare: number | null | undefined,
): GoalieStartShareBucket | null {
  const share = finite(startShare);
  if (share == null || share < 0) return null;
  if (share >= 0.65) return "workhorse";
  if (share >= 0.45) return "lead_tandem";
  if (share >= 0.3) return "secondary_tandem";
  if (share >= 0.1) return "backup";
  return "spot_start";
}

export function getGoalieDeploymentBucket(
  startShare: number | null | undefined,
): GoalieDeploymentBucket | null {
  const share = finite(startShare);
  if (share == null || share < 0) return null;
  if (share >= 0.65) return "g1_workhorse";
  if (share >= 0.55) return "g1_starter";
  if (share >= 0.45) return "g1a_tandem_lead";
  if (share >= 0.3) return "g1b_tandem_secondary";
  if (share >= 0.1) return "g2_backup";
  return "g2_reserve";
}

export function formatGoalieDeploymentBucket(
  bucket: GoalieDeploymentBucket | null | undefined,
) {
  if (bucket === "g1_workhorse") return "G1 Workhorse";
  if (bucket === "g1_starter") return "G1 Starter";
  if (bucket === "g1a_tandem_lead") return "G1A Tandem Lead";
  if (bucket === "g1b_tandem_secondary") return "G1B Tandem Secondary";
  if (bucket === "g2_backup") return "G2 Backup";
  if (bucket === "g2_reserve") return "G2 Reserve";
  return null;
}

export function calculateAdjustedCoreNetshare(args: {
  starts: readonly GoalieStartForNetshare[];
  coreGoalieIds: readonly number[];
  minimumAbsenceConfidence?: "medium" | "high";
}): AdjustedCoreNetshareResult {
  const coreGoalieIds = new Set(args.coreGoalieIds);
  const minimumAbsenceConfidence = args.minimumAbsenceConfidence ?? "medium";
  const warnings: string[] = [];
  let coreStarts = 0;
  let totalStarts = 0;
  let excludedEmergencyStarts = 0;

  const confidenceRank = { low: 0, medium: 1, high: 2 } as const;
  const minimumRank = confidenceRank[minimumAbsenceConfidence];

  for (const start of args.starts) {
    if (!start.started) continue;
    const isCoreGoalie = coreGoalieIds.has(start.goalieId);
    const unavailableCoreGoalieCount = new Set(
      start.topTwoUnavailableGoalieIds ?? [],
    );
    const hasTopTwoAbsence =
      args.coreGoalieIds.length >= 2 &&
      args.coreGoalieIds
        .slice(0, 2)
        .every((goalieId) => unavailableCoreGoalieCount.has(goalieId));
    const hasEnoughConfidence =
      confidenceRank[start.absenceConfidence ?? "low"] >= minimumRank;
    const excludeEmergencyStart =
      !isCoreGoalie &&
      start.isEmergencyCallup === true &&
      hasTopTwoAbsence &&
      hasEnoughConfidence;

    if (excludeEmergencyStart) {
      excludedEmergencyStarts += 1;
      continue;
    }

    totalStarts += 1;
    if (isCoreGoalie) coreStarts += 1;
  }

  if (args.coreGoalieIds.length < 2) {
    warnings.push("core_goalie_ids_missing_top_two_context");
  }
  if (totalStarts === 0) {
    warnings.push("no_countable_starts_after_adjustment");
  }

  return {
    coreStarts,
    totalStarts,
    excludedEmergencyStarts,
    adjustedCoreNetshare:
      totalStarts > 0 ? round(coreStarts / totalStarts) : null,
    warnings,
  };
}
