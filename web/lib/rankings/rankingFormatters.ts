import type {
  ContextualRankingApiRow,
  ContextualRankingsRequest,
} from "./rankingTypes";

export function formatToiClock(seconds: number | null) {
  if (seconds == null || !Number.isFinite(seconds) || seconds < 0) return "-";
  const rounded = Math.round(seconds);
  const minutes = Math.floor(rounded / 60);
  const rest = rounded % 60;
  return `${minutes}:${String(rest).padStart(2, "0")}`;
}

export function formatPercentile(value: number | null) {
  return value == null || !Number.isFinite(value) ? "-" : `${value.toFixed(1)}%`;
}

export function formatRank(value: number | null) {
  return value == null || !Number.isFinite(value) ? "-" : String(value);
}

export function formatSampleConfidence(value: string | null | undefined) {
  if (value === "high") return "At least twice selected minimums";
  if (value === "medium") return "Meets selected minimums";
  if (value === "low") return "Below selected minimums or sample unavailable";
  return "Sample unavailable";
}

export function formatSampleMinimums(
  sample: Pick<ContextualRankingApiRow["sample"], "gamesPlayed" | "toiSeconds" | "minimumSampleMet">,
) {
  if (sample.gamesPlayed == null || sample.toiSeconds == null ||
    !Number.isFinite(sample.gamesPlayed) || !Number.isFinite(sample.toiSeconds)) return "Sample unavailable";
  return sample.minimumSampleMet ? "Meets selected minimums" : "Below selected minimums";
}

export function formatDeploymentLabel(
  deployment: ContextualRankingApiRow["deployment"],
) {
  const buckets: string[] = [];
  if (deployment.ev) buckets.push(deployment.ev);
  if (deployment.pp) buckets.push(deployment.pp);
  if (deployment.pk) buckets.push(deployment.pk);
  return buckets.length > 0 ? buckets.join(" / ") : "-";
}

export function formatWindowLabel(window: ContextualRankingsRequest["window"]) {
  if (window === "season") return "season to date";
  return `${window.replace("last", "last ")} player games`;
}

export function buildRankingExplanationItems(args: {
  row: ContextualRankingApiRow;
  request: ContextualRankingsRequest;
}) {
  const { row, request } = args;
  const items = [...row.explanationItems];

  items.push(
    `Window: ${formatWindowLabel(request.window)} at ${request.strength.toUpperCase()} strength.`,
  );
  items.push(`Peer group: ${row.peerGroup.type}:${row.peerGroup.key}.`);

  if (row.metric.rawRank != null) {
    items.push(
      `Raw rank ${row.metric.rawRank} of ${row.metric.qualifiedPeerCount}; better than ${formatPercentile(row.metric.percentile)} of other qualified peers.`,
    );
  }

  if (!row.sample.minimumSampleMet) {
    items.push("Sample caveat: minimum GP or TOI was not met before ranking.");
  } else if (row.sample.confidence === "low") {
    items.push("Sample caveat: the sample tier is low relative to selected minimums; it does not measure forecast reliability.");
  }

  if (row.warnings.includes("small_peer_group")) {
    items.push("Peer caveat: this peer group is small, so percentile movement can be noisy.");
  }

  return Array.from(new Set(items));
}
