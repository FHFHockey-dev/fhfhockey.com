export type BenchmarkAnnotationKind =
  | "bottleneck"
  | "rate_limited"
  | "stateful"
  | "special_handling"
  | "side_effect"
  | "batch_loop"
  | "dependency_sensitive";

export type BenchmarkAnnotation = {
  kind: BenchmarkAnnotationKind;
  note: string;
};

const BENCHMARK_NOTES_BY_JOB: Record<string, BenchmarkAnnotation[]> = {
  "update-nst-gamelog": [
    {
      kind: "bottleneck",
      note:
        "Direct NST scraper with date iteration and enforced inter-request pacing."
    },
    {
      kind: "rate_limited",
      note: "Must be treated as a direct NST request-budget consumer."
    },
    {
      kind: "stateful",
      note: "Runtime depends on current resume point and backlog."
    }
  ],
  "update-rolling-player-averages": [
    {
      kind: "bottleneck",
      note: "Broad rolling rebuild with concurrency knobs and large player scope."
    },
    {
      kind: "dependency_sensitive",
      note: "Downstream FORGE and Start Chart freshness depend on this output."
    }
  ],
  "update-nst-tables-all": [
    {
      kind: "bottleneck",
      note: "NST table rebuild can run near the route budget on stale datasets."
    },
    {
      kind: "rate_limited",
      note: "Touches NST directly and should stay spaced from other NST jobs."
    },
    {
      kind: "stateful",
      note: "Observed runtime depends on latest ingested date and resume state."
    }
  ],
  "update-nst-current-season": [
    {
      kind: "bottleneck",
      note: "Current-season NST scraper fans out over active-player mappings."
    },
    {
      kind: "rate_limited",
      note: "Consumes the direct NST request budget."
    }
  ],
  "sync-yahoo-players-to-sheet": [
    {
      kind: "side_effect",
      note: "Writes to Google Sheets and should not be benchmarked blindly in local/dev."
    },
    {
      kind: "special_handling",
      note: "Prefer dry-run or mocked external side effects during audit execution."
    }
  ],
  "daily-cron-report": [
    {
      kind: "side_effect",
      note: "Sends Resend email and is better observed in mocked-email or production-safe mode."
    },
    {
      kind: "special_handling",
      note: "Should run last and should not be benchmarked as a normal local side-effect job."
    }
  ],
  "update-goalie-projections-v2": [
    {
      kind: "bottleneck",
      note: "Runtime varies with how far behind goalie_start_projections currently is."
    },
    {
      kind: "stateful",
      note: "The route resumes from latest existing state rather than a direct target window."
    }
  ],
  "ingest-projection-inputs": [
    {
      kind: "bottleneck",
      note: "Recent-game ingest reads multiple upstream tables under a timeout budget."
    },
    {
      kind: "stateful",
      note: "Chunking and resumability make runtime depend on backlog and data state."
    }
  ],
  "build-forge-derived-v2": [
    {
      kind: "bottleneck",
      note: "Runs multiple derived-table builders in one request under a 4.5-minute budget."
    },
    {
      kind: "dependency_sensitive",
      note: "FORGE projection freshness depends directly on this stage completing."
    }
  ],
  "run-forge-projection-v2": [
    {
      kind: "bottleneck",
      note: "Projection run is preflight-gated and likely to overrun when upstream data lags."
    },
    {
      kind: "dependency_sensitive",
      note: "This is the core downstream FORGE job for dashboard freshness."
    }
  ],
  "rebuild-sustainability-window-z": [
    {
      kind: "bottleneck",
      note: "runAll mode loops windows across all baseline players."
    },
    {
      kind: "batch_loop",
      note: "May need offset-specific sequencing if full-run timing is unstable."
    }
  ],
  "rebuild-sustainability-score": [
    {
      kind: "bottleneck",
      note: "Score rebuild loops player baselines and window outputs before upsert."
    },
    {
      kind: "batch_loop",
      note: "A strong candidate for optimization or explicit sequential batching."
    }
  ],
  "rebuild-sustainability-trend-bands": [
    {
      kind: "bottleneck",
      note: "Trend bands can expand over large per-player history slices."
    },
    {
      kind: "batch_loop",
      note: "May require audit-mode batching if runAll exceeds the cron budget."
    }
  ]
};

export function getBenchmarkAnnotations(jobName: string): BenchmarkAnnotation[] {
  return BENCHMARK_NOTES_BY_JOB[jobName] ?? [];
}

export function hasBenchmarkAnnotationKind(
  annotations: BenchmarkAnnotation[],
  kind: BenchmarkAnnotationKind
): boolean {
  return annotations.some((annotation) => annotation.kind === kind);
}
