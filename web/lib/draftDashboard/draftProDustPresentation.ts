import {
  DRAFT_PRO_DUST_FREE_EXAMPLE,
  type DraftProDustResult,
} from "lib/draft-pro/dust";

type DustState = {
  status: "idle" | "loading" | "ready" | "error";
  error: string | null;
  result: DraftProDustResult | null;
};

export function buildDraftProDustNotices({
  projectionDataNotices,
  canUseProDust,
  hasPrivateImport,
  candidateScopeLimited,
  dust,
}: {
  projectionDataNotices: readonly string[];
  canUseProDust: boolean;
  hasPrivateImport: boolean;
  candidateScopeLimited: boolean;
  dust: DustState;
}): string[] {
  const notices = [...projectionDataNotices];
  if (!canUseProDust) {
    notices.push(`DUST illustration only: ${DRAFT_PRO_DUST_FREE_EXAMPLE.playerName} has ${DRAFT_PRO_DUST_FREE_EXAMPLE.marginalBenchGames} projected bench games across ${DRAFT_PRO_DUST_FREE_EXAMPLE.candidateScheduledGames} games. Draft Pro unlocks roster-specific analysis.`);
  } else if (hasPrivateImport) {
    notices.push("Save this private import to your account before using it for DUST. Local rows were not uploaded.");
  } else {
    if (candidateScopeLimited) notices.push("DUST analyzes the top 500 available players by league value in this view.");
    if (dust.status === "error") notices.push(`DUST is unavailable. ${dust.error ?? "Try again after the schedule refreshes."}`);
    else if (dust.result && dust.result.state !== "ready") notices.push(`DUST is unavailable: ${dust.result.diagnostics.join(" ")}`);
    else if (dust.result?.state === "ready") notices.push(`DUST daily lineup window: weeks ${dust.result.window.startWeek ?? "unknown"}–${dust.result.window.endWeek ?? "unknown"}; oldest schedule freshness ${dust.result.freshness.oldestFetchedAt ?? "unknown"}.`);
  }
  return notices;
}
