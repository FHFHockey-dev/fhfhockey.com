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
      kind: "stateful",
      note: "Broad rolling rebuild with concurrency knobs and large player scope."
    },
    {
      kind: "dependency_sensitive",
      note:
        "Downstream FORGE and Start Chart freshness depend on this output; local remediation validation now succeeds within budget."
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
      note: "Consumes the shared NST key budget and should stay coordinated with the other direct NST routes."
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
      kind: "stateful",
      note: "Runtime varies with how far behind goalie_start_projections currently is."
    },
    {
      kind: "stateful",
      note: "The route resumes from latest existing state rather than a direct target window."
    }
  ],
  "ingest-projection-inputs": [
    {
      kind: "stateful",
      note:
        "Recent-game ingest reads multiple upstream tables, but the bounded resumable path now returns actionable progress cleanly."
    },
    {
      kind: "stateful",
      note: "Chunking and resumability make runtime depend on backlog and data state."
    }
  ],
  "build-forge-derived-v2": [
    {
      kind: "stateful",
      note:
        "Runs multiple derived-table builders in one request, but the per-date bounded path now completes cleanly in local validation."
    },
    {
      kind: "dependency_sensitive",
      note: "FORGE projection freshness depends directly on this stage completing."
    }
  ],
  "run-forge-projection-v2": [
    {
      kind: "bottleneck",
      note:
        "Preflight no longer blocks the route incorrectly; the remaining blocker is execution-time DB statement timeout risk."
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
  ],
  "update-nst-goalies": [
    {
      kind: "rate_limited",
      note:
        "Direct NST scraper; small bounded runs now burst only when the computed request budget stays under the shared 80-page/5-minute and 180-page/hour NST key ceilings."
    },
    {
      kind: "stateful",
      note: "Runtime depends on resume point, queued dates, and max pending URL cap."
    }
  ],
  "update-nst-player-reports": [
    {
      kind: "rate_limited",
      note:
        "Direct NST scraper; this route also spends the shared NST key budget even when run manually or as a targeted repair path."
    },
    {
      kind: "stateful",
      note: "Runtime depends on active-player scope, season selection, and retry behavior."
    }
  ],
  "update-nst-last-ten": [
    {
      kind: "rate_limited",
      note:
        "Direct NST scraper; treat it as another consumer of the shared NST key budget rather than an isolated helper route."
    },
    {
      kind: "stateful",
      note: "Runtime depends on target date windows and whether tables already contain the requested rows."
    }
  ],
  "check-missing-goalie-data": [
    {
      kind: "rate_limited",
      note:
        "Direct NST verification route; manual repair runs still draw from the same shared NST key budget as scheduled jobs."
    },
    {
      kind: "stateful",
      note: "Observed runtime depends on missing-date scans and the bounded repair window."
    }
  ],
  "update-nst-team-daily": [
    {
      kind: "rate_limited",
      note:
        "Direct NST route; burst mode is now selected from request-count math under the shared NST key budget rather than date-count assumptions."
    },
    {
      kind: "stateful",
      note: "Incremental and manual ranges remain backlog-sensitive."
    }
  ],
  "update-nst-team-daily-incremental": [
    {
      kind: "rate_limited",
      note:
        "Scheduled direct NST route; it shares the same NST key budget as gamelog, goalies, current-season, and team-stats jobs."
    },
    {
      kind: "stateful",
      note: "Incremental runtime depends on how many unfilled dates are still pending."
    }
  ],
  "update-nst-team-stats-all": [
    {
      kind: "rate_limited",
      note:
        "Direct NST team-stats route; small compliant runs can now burst when they stay inside the shared NST key budget instead of paying the legacy fixed 21s gap."
    },
    {
      kind: "stateful",
      note: "Whether season tables run depends on backlog state and remaining runtime budget."
    }
  ],
  "update-wigo-table-stats": [
    {
      kind: "bottleneck",
      note:
        "Route still appears long-running after remediation; local validation did not complete within the 180s probe window."
    }
  ],
  "update-season-stats-current-season": [
    {
      kind: "bottleneck",
      note:
        "Route still hangs past the 180s validation probe, so the current issue is long-running execution rather than HTML error leakage."
    }
  ],
  "update-sko-stats-full-season": [
    {
      kind: "dependency_sensitive",
      note:
        "Current blocker is a real schema mismatch in sko_skater_stats (missing assists_5v5), not proxy HTML leakage."
    }
  ],
  "update-wgo-averages": [
    {
      kind: "dependency_sensitive",
      note:
        "Current blocker is a structured upstream transport/dependency failure rather than raw HTML leakage."
    }
  ],
  "run-projection-accuracy": [
    {
      kind: "dependency_sensitive",
      note:
        "Current failure mode is now cleanly downstream-dependent on a succeeded projection run for the target date."
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
