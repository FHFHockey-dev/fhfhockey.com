export type RollingPlayerToiSource =
  | "counts"
  | "counts_oi"
  | "rates"
  | "fallback"
  | "wgo"
  | "none";

export type RollingPlayerFallbackToiSource =
  | "counts"
  | "counts_oi"
  | "wgo"
  | "none";

export type RollingPlayerToiTrustTier =
  | "authoritative"
  | "supplementary"
  | "fallback"
  | "none";

export type RollingPlayerWgoToiNormalization =
  | "minutes_to_seconds"
  | "already_seconds"
  | "missing"
  | "invalid";

export type RollingPlayerToiSuspiciousReason =
  | "non_finite"
  | "non_positive"
  | "above_max_seconds";

export type RollingPlayerToiCandidateRejection = {
  source: Exclude<RollingPlayerToiSource, "none">;
  reason: RollingPlayerToiSuspiciousReason;
};

const MAX_REASONABLE_TOI_SECONDS = 4000;

function inspectToiSeconds(
  value: number | null | undefined
):
  | { seconds: number; rejection: null }
  | { seconds: null; rejection: RollingPlayerToiSuspiciousReason | null } {
  if (value === null || value === undefined) {
    return { seconds: null, rejection: null };
  }

  const num = Number(value);
  if (!Number.isFinite(num)) {
    return { seconds: null, rejection: "non_finite" };
  }
  if (num <= 0) {
    return { seconds: null, rejection: "non_positive" };
  }
  if (num >= MAX_REASONABLE_TOI_SECONDS) {
    return { seconds: null, rejection: "above_max_seconds" };
  }

  return { seconds: num, rejection: null };
}

export function normalizeWgoToiPerGame(args: {
  toiPerGame: number | null | undefined;
}): {
  seconds: number | null;
  normalization: RollingPlayerWgoToiNormalization;
  rejection: RollingPlayerToiSuspiciousReason | null;
} {
  if (args.toiPerGame == null) {
    return {
      seconds: null,
      normalization: "missing",
      rejection: null
    };
  }

  const toiValue = Number(args.toiPerGame);
  if (!Number.isFinite(toiValue)) {
    return {
      seconds: null,
      normalization: "invalid",
      rejection: "non_finite"
    };
  }

  const alreadySeconds = toiValue > 200;
  const seconds = Math.round(alreadySeconds ? toiValue : toiValue * 60);
  const inspected = inspectToiSeconds(seconds);

  return {
    seconds: inspected.seconds,
    normalization: inspected.seconds
      ? alreadySeconds
        ? "already_seconds"
        : "minutes_to_seconds"
      : "invalid",
    rejection: inspected.rejection
  };
}

export function resolveFallbackToiSeed(args: {
  countsToi: number | null | undefined;
  countsOiToi: number | null | undefined;
  wgoToiPerGame: number | null | undefined;
}): {
  fallbackToiSeconds: number | null;
  source: RollingPlayerFallbackToiSource;
  rejections: RollingPlayerToiCandidateRejection[];
  wgoNormalization: RollingPlayerWgoToiNormalization;
} {
  const rejections: RollingPlayerToiCandidateRejection[] = [];

  const counts = inspectToiSeconds(args.countsToi);
  if (counts.seconds != null) {
    return {
      fallbackToiSeconds: counts.seconds,
      source: "counts",
      rejections,
      wgoNormalization: "missing"
    };
  }
  if (counts.rejection) {
    rejections.push({ source: "counts", reason: counts.rejection });
  }

  const countsOi = inspectToiSeconds(args.countsOiToi);
  if (countsOi.seconds != null) {
    return {
      fallbackToiSeconds: countsOi.seconds,
      source: "counts_oi",
      rejections,
      wgoNormalization: "missing"
    };
  }
  if (countsOi.rejection) {
    rejections.push({ source: "counts_oi", reason: countsOi.rejection });
  }

  const wgo = normalizeWgoToiPerGame({ toiPerGame: args.wgoToiPerGame });
  if (wgo.seconds != null) {
    return {
      fallbackToiSeconds: wgo.seconds,
      source: "wgo",
      rejections,
      wgoNormalization: wgo.normalization
    };
  }
  if (wgo.rejection) {
    rejections.push({ source: "wgo", reason: wgo.rejection });
  }

  return {
    fallbackToiSeconds: null,
    source: "none",
    rejections,
    wgoNormalization: wgo.normalization
  };
}

export function resolveRollingPlayerToiContext(args: {
  countsToi: number | null | undefined;
  countsOiToi: number | null | undefined;
  ratesToiPerGp: number | null | undefined;
  fallbackToiSeconds: number | null | undefined;
  wgoToiPerGame: number | null | undefined;
}): {
  seconds: number | null;
  source: RollingPlayerToiSource;
  trustTier: RollingPlayerToiTrustTier;
  rejectedCandidates: RollingPlayerToiCandidateRejection[];
  wgoNormalization: RollingPlayerWgoToiNormalization;
} {
  const rejectedCandidates: RollingPlayerToiCandidateRejection[] = [];

  const counts = inspectToiSeconds(args.countsToi);
  if (counts.seconds != null) {
    return {
      seconds: counts.seconds,
      source: "counts",
      trustTier: "authoritative",
      rejectedCandidates,
      wgoNormalization: "missing"
    };
  }
  if (counts.rejection) {
    rejectedCandidates.push({ source: "counts", reason: counts.rejection });
  }

  const countsOi = inspectToiSeconds(args.countsOiToi);
  if (countsOi.seconds != null) {
    return {
      seconds: countsOi.seconds,
      source: "counts_oi",
      trustTier: "authoritative",
      rejectedCandidates,
      wgoNormalization: "missing"
    };
  }
  if (countsOi.rejection) {
    rejectedCandidates.push({ source: "counts_oi", reason: countsOi.rejection });
  }

  const rates = inspectToiSeconds(args.ratesToiPerGp);
  if (rates.seconds != null) {
    return {
      seconds: rates.seconds,
      source: "rates",
      trustTier: "supplementary",
      rejectedCandidates,
      wgoNormalization: "missing"
    };
  }
  if (rates.rejection) {
    rejectedCandidates.push({ source: "rates", reason: rates.rejection });
  }

  const fallback = inspectToiSeconds(args.fallbackToiSeconds);
  if (fallback.seconds != null) {
    return {
      seconds: fallback.seconds,
      source: "fallback",
      trustTier: "fallback",
      rejectedCandidates,
      wgoNormalization:
        args.fallbackToiSeconds != null && args.wgoToiPerGame != null
          ? normalizeWgoToiPerGame({ toiPerGame: args.wgoToiPerGame }).normalization
          : "missing"
    };
  }
  if (fallback.rejection) {
    rejectedCandidates.push({ source: "fallback", reason: fallback.rejection });
  }

  const wgo = normalizeWgoToiPerGame({ toiPerGame: args.wgoToiPerGame });
  if (wgo.seconds != null) {
    return {
      seconds: wgo.seconds,
      source: "wgo",
      trustTier: "fallback",
      rejectedCandidates,
      wgoNormalization: wgo.normalization
    };
  }
  if (wgo.rejection) {
    rejectedCandidates.push({ source: "wgo", reason: wgo.rejection });
  }

  return {
    seconds: null,
    source: "none",
    trustTier: "none",
    rejectedCandidates,
    wgoNormalization: wgo.normalization
  };
}
