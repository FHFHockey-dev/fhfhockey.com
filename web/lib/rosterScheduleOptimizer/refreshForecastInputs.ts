import type { PlanningContext, PlanningData, PlanningSnapshot } from "./planningTypes";

export type SharedForecastRead = { context: PlanningContext; data: PlanningData; checkedAt: string };

/** A shared read replaces statistical evidence, never provider authority or schedule.
 * The shared resolver still admits each target against the retained exact identities/revisions. */
export function refreshForecastInputs(snapshot: PlanningSnapshot, read: SharedForecastRead): PlanningSnapshot {
  const sameContext = (["provider", "seasonId", "leagueId", "teamId", "startDate", "endDate", "timeZone"] as const)
    .every(key => snapshot.context[key] === read.context[key]);
  const manifest = read.data.forecastManifest;
  const observed = Date.parse(manifest?.asOf ?? "");
  const checked = Date.parse(read.checkedAt), previous = Date.parse(snapshot.context.asOf);
  if (!sameContext || !manifest || manifest.seasonId !== snapshot.context.seasonId
    || !Number.isFinite(observed) || !Number.isFinite(checked) || !Number.isFinite(previous)
    || observed < previous || checked < observed) return snapshot;
  return { ...snapshot,
    id: `${snapshot.id.slice(0, 100)}:forecasts:${manifest.id.slice(0, 48)}:${read.checkedAt}`,
    context: { ...snapshot.context, asOf: read.checkedAt },
    forecasts: read.data.forecasts, baselineSources: read.data.baselineSources, participationSources: read.data.participationSources,
    forecastManifest: manifest, forecastInputExclusions: undefined,
    evidence: { ...snapshot.evidence,
      forecasts: read.data.evidence.forecasts ?? { source: "Shared forecast read", seasonId: manifest.seasonId,
        asOf: manifest.asOf, completeness: "partial", limitations: ["Forecast coverage is unverified."] },
      participation: read.data.evidence.participation ?? { source: "Shared participation read", seasonId: manifest.seasonId,
        asOf: manifest.asOf, completeness: "partial", limitations: ["Participation coverage is unverified."] },
      baselines: read.data.evidence.baselines ?? { source: "Shared baseline read", seasonId: manifest.seasonId,
        asOf: manifest.asOf, completeness: "partial", limitations: ["Baseline coverage is unverified."] },
    },
  };
}
