# Frozen NHL context audit

Target `89da739cb45d7d572ed59bfa0b209c79c5d99299`. Seven scope files, 2,320 lines, fully read: rush source/tests, score source/tests, shot-feature tests, strength source/tests. No source edits. Hashes and symbol coverage are in the paired manifest/TSV.

## Findings

| ID | Severity | Evidence and consequence | Proposed repair, subject to TJ approval |
| --- | --- | --- | --- |
| AFULL-NHLCTX1-01 | P1 | `nhlScoreState.ts:108–211` retains 0–0 after a goal with neither owner nor scoreboard. The next home shot receives `tied`, while the canonical timeline in the same module correctly returns null/null. The active feature builder calls this legacy helper at 430 and copies its fields at 559–574. This violates the explicit unknown-is-not-tied contract and can label unknown score situations as tied. Exact probe reproduces both outputs. | Derive feature contexts from the shared nullable timeline; retain pre-event ordering and test unknown goals/re-anchoring. |
| AFULL-NHLCTX1-02 | P1 | `nhlRush.ts:226–267` skips every same-clock candidate before evaluating breaks. Takeaway at 100s, faceoff at 104s, shot at 104s becomes an NST 4s rush sourced from the takeaway, although that mode excludes faceoffs and treats them as breaks. A same-second stoppage likewise fails to break the default feature rush. Moving either break to 103s correctly yields false. Frozen feature builder calls default rush at 438; parity's explicit NST options use this helper too. | Evaluate sequence-breaking events before rejecting zero-duration candidates as rush sources; pin same-clock faceoff/stoppage controls. |

## Coverage and checks

- `nhlRush.ts`: bounded game/period scan, default 10s versus explicit NST 4s/no-faceoff modes, owner-relative defensive/neutral source, opponent turnovers, hard breaks, rebound exclusion, missing time, distance and event count. Cross-game event-ID-only rebound map is a qualification concern only: active per-game callers do not establish a reachable mixed-game defect.
- `nhlScoreState.ts`: pre-event contexts, owner orientation, time buckets, close/leading/trailing windows; separately canonical nullable timeline, goal re-anchor, shootout exclusion, composite event key, overlapping score filters. Legacy `Math.max` differs from canonical re-anchor; grouped under shared-helper divergence, not a separately proven live correction incidence.
- `nhlStrengthState.ts`: validated four-digit format; numeric ID orientation; penalty-shot/no-strength handling; extra attacker deducted before penalty manpower; own/opponent empty-net overlap; legacy EN precedence and away-first exact display. No additional confirmed defect. Exhaustive supplied symmetry/bucket tests read, not run.
- All four supplied test files fully read, including shot-feature outputs, geometric/rebound/rush/possession inputs, empty-net orientation and PS/SO exclusion. These are assertion-source evidence only.
- `nhl2-probe.cjs` passed exact frozen score/rush execution with eight allowlisted pure dependencies and synthetic inputs. Known-owner scoring and one-second-earlier breaks pass controls. `nhl2-probe-output.json` records hashes and results. Feature builder was inspected only at relevant caller/field lines; no full-file credit or feature execution is claimed.
- No Vitest, database, RPC, provider request, application environment, browser, server or build. No production incidence or write claim.
