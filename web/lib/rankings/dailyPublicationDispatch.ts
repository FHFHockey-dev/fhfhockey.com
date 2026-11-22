import { prepareDailyRankingPair, publishDailyRankingPair } from "./dailyRankingPair";
import { createDailyPublicationClients } from "./dailyPublicationClient";
import { DAILY_RANKINGS_SEASON, dailyPublicationWindow } from "./dailyPublicationPolicy";
import {
  claimRankingDispatch, latestRankingPublicationCutoff, recordRankingDispatch,
} from "./publicationDispatchLedger";
import { readRankingPublicationReadiness, type RankingPublicationReadiness } from "./publicationReadiness";

export async function runDailyRankingPublication() {
  const started = Date.now();
  const mode = process.env.RANKINGS_DAILY_PUBLICATION;
  const window = dailyPublicationWindow(mode, new Date(started));
  if (window.status !== "open" && window.status !== "late") return window;
  if (window.status === "late" && window.deadline - started <= 5000) {
    return { status: "blocked", date: window.target, reason: "late_dispatch" };
  }
  const releaseSha = process.env.VERCEL_GIT_COMMIT_SHA;
  if (mode !== "daily" && (!releaseSha || !/^[0-9a-f]{40}$/.test(releaseSha) ||
      releaseSha !== process.env.RANKINGS_DAILY_PUBLICATION_RELEASE)) {
    return { status: "blocked", date: window.target, reason: "unapproved_release" };
  }
  const clients = createDailyPublicationClients(window.deadline);
  const season = DAILY_RANKINGS_SEASON;
  const date = window.target;
  const claim = await claimRankingDispatch(clients.work, { season, date });
  if (claim.outcome !== "claimed" || !claim.id) {
    return { status: claim.outcome, date, id: claim.id, reason: claim.reason };
  }
  const id = claim.id;
  let stage = "admission";
  let publishing = false;
  let evidence: Record<string, unknown> = { priorCutoff: claim.priorCutoff, releaseSha, mode };

  async function finish(status: "blocked" | "complete" | "ambiguous" | "failed", reason?: string) {
    await recordRankingDispatch(clients.terminal, {
      id, stage, status, reason,
      evidence: { ...evidence, elapsedMs: Date.now() - started, dbRequestsBeforeReceipt: clients.requestCount() },
    });
    return { status, id, date, reason };
  }

  function unready(result: Exclude<RankingPublicationReadiness, { status: "ready" }>) {
    if (result.status === "no_slate") return finish("blocked", "no_slate");
    evidence.readinessDetails = result.details;
    const failed = result.reason === "readiness_read_failed" || result.reason === "invalid_readiness_receipt";
    return finish(failed ? "failed" : "blocked", result.reason);
  }

  try {
    if (window.status === "late") return finish("blocked", "late_dispatch");
    if (!claim.priorCutoff) return finish("blocked", "missing_previous_marked_pair");
    if (claim.priorCutoff >= date) return finish("blocked", "already_served");
    const input = { client: clients.work, season, lastServedDate: claim.priorCutoff, cutoffDate: date };
    const readiness = await readRankingPublicationReadiness(input);
    if (readiness.status !== "ready") return unready(readiness);
    evidence = {
      ...evidence, readyAt: readiness.readyAt, sourceDigest: readiness.sourceDigest,
      cohortCount: readiness.expectedPlayerIds.length,
    };
    stage = "building";
    await recordRankingDispatch(clients.work, { id, stage, status: "running", evidence });
    const pair = await prepareDailyRankingPair(clients.work, season, readiness);
    // Both outputs are prepared in memory. A correction or restarted upstream job
    // during the build invalidates this dispatch before its first publication write.
    const checked = await readRankingPublicationReadiness(input);
    if (checked.status !== "ready") return unready(checked);
    if (checked.sourceDigest !== readiness.sourceDigest) return finish("blocked", "source_revision_changed");
    evidence.expectedRankingRows = pair.expectedRankingRows;
    stage = "publishing";
    await recordRankingDispatch(clients.work, { id, stage, status: "running", evidence });
    publishing = true;
    const result = await publishDailyRankingPair(clients.work, pair);
    stage = "readback";
    const durable = await latestRankingPublicationCutoff(clients.work, season);
    if (durable !== date) throw new Error("The verified five-marker cutoff differs from the target.");
    evidence = { ...evidence, durableCutoff: durable, rankingRows: result.rankings.dbWrittenRows,
      compositeRows: result.composites.dbWrittenRows, windows: result.rankings.windows };
  } catch (error) {
    const reason = error instanceof Error ? error.message.slice(0, 600) : "Rankings dispatch failed.";
    return finish(publishing ? "ambiguous" : "failed", reason);
  }
  return finish("complete");
}
