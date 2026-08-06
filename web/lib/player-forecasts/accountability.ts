import type {
  PlayerForecastAccountabilityCandle,
  PlayerForecastAccountabilityCheckpoint,
  PlayerForecastCandle,
  PlayerForecastRevision,
} from "./contracts";

type Outcome = {
  gameId: number;
  playerId: number;
  targetKey: string;
  value: number;
  settlementStatus: "provisional" | "final" | "corrected";
};

function revisionValue(revision: PlayerForecastRevision): number | null {
  return revision.pointEstimate ?? revision.probability;
}

export function buildPlayerForecastCandles(args: {
  revisions: PlayerForecastRevision[];
  outcomes?: Outcome[];
}): PlayerForecastCandle[] {
  const outcomes = new Map(
    (args.outcomes ?? []).map((outcome) => [
      `${outcome.gameId}:${outcome.playerId}:${outcome.targetKey}`,
      outcome,
    ]),
  );
  const groups = new Map<string, PlayerForecastRevision[]>();

  for (const revision of args.revisions) {
    const value = revisionValue(revision);
    const issuedMs = Date.parse(revision.issuedAt);
    const startMs = Date.parse(revision.scheduledStartAt);
    if (value == null || !Number.isFinite(value)) continue;
    if (!Number.isFinite(issuedMs) || !Number.isFinite(startMs) || issuedMs >= startMs) {
      continue;
    }
    const key = [
      revision.gameId,
      revision.playerId,
      revision.targetKey,
      revision.conditioning,
      revision.artifactChecksum ?? revision.modelVersion ?? "unversioned",
    ].join(":");
    const group = groups.get(key) ?? [];
    group.push(revision);
    groups.set(key, group);
  }

  return Array.from(groups.values())
    .flatMap((group): PlayerForecastCandle[] => {
      const revisions = [...group].sort((left, right) =>
        left.issuedAt.localeCompare(right.issuedAt),
      );
      const first = revisions[0];
      const final = revisions[revisions.length - 1];
      if (!first || !final) return [];
      const values = revisions.map(revisionValue).filter((value): value is number => value != null);
      const outcome = outcomes.get(
        `${final.gameId}:${final.playerId}:${final.targetKey}`,
      );
      return [{
        gameId: final.gameId,
        playerId: final.playerId,
        playerName: final.playerName,
        modelVersion: final.modelVersion,
        artifactChecksum: final.artifactChecksum,
        targetKey: final.targetKey,
        conditioning: final.conditioning,
        scheduledStartAt: final.scheduledStartAt,
        open: values[0]!,
        high: Math.max(...values),
        low: Math.min(...values),
        close: values[values.length - 1]!,
        openingHorizon: first.teamGameHorizon,
        revisionCount: values.length,
        finalQuantiles: final.quantiles,
        actual: outcome?.value ?? null,
        settlementStatus: outcome?.settlementStatus ?? "unsettled",
        revisions: revisions.map((revision) => ({
          issuedAt: revision.issuedAt,
          value: revisionValue(revision)!,
          horizon: revision.teamGameHorizon,
        })),
      }];
    })
    .sort((left, right) => left.scheduledStartAt.localeCompare(right.scheduledStartAt));
}

export function buildAccountabilityCandles(
  checkpoints: PlayerForecastAccountabilityCheckpoint[],
): PlayerForecastAccountabilityCandle[] {
  const bySlate = new Map<string, PlayerForecastAccountabilityCheckpoint[]>();
  for (const checkpoint of checkpoints) {
    if (!Number.isFinite(checkpoint.compositeSkillScore)) continue;
    const groupKey = `${checkpoint.slateDate}:${checkpoint.modelArtifactId}:${checkpoint.scoringVersion}`;
    const existing = bySlate.get(groupKey) ?? [];
    existing.push(checkpoint);
    bySlate.set(groupKey, existing);
  }

  return Array.from(bySlate.entries())
    .flatMap(([, values]): PlayerForecastAccountabilityCandle[] => {
      const ordered = [...values].sort(
        (left, right) => left.checkpointOrder - right.checkpointOrder,
      );
      const first = ordered[0];
      const final = ordered[ordered.length - 1];
      if (!first || !final) return [];
      const scores = ordered.map((entry) => entry.compositeSkillScore);
      return [{
        slateDate: final.slateDate,
        modelArtifactId: final.modelArtifactId,
        modelVersion: final.modelVersion,
        open: scores[0]!,
        high: Math.max(...scores),
        low: Math.min(...scores),
        close: scores[scores.length - 1]!,
        evaluatedForecasts: final.evaluatedForecasts,
        scoringVersion: final.scoringVersion,
        settlementStatus: final.settlementStatus,
        checkpoints: ordered,
      }];
    })
    .sort((left, right) => left.slateDate.localeCompare(right.slateDate));
}
