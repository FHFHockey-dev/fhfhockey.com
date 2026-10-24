# P03 timeline xG independent review — 2026-10-22

**Qualified acceptance for the pinned P03 timeline source-admission/display packet. No new blocking defect demonstrated.** This is not broad S04/S08 acceptance, model requalification, a registry/current-champion audit, or production validation.

## Verified behavior

- Actual xG query requires matching team/season, `source_model_approved=true`, and `source_prediction_type=shot_goal`; it selects those provenance fields plus game ID/date. The unfiltered empty-result fallback is removed. Adapter admission independently rejects false/null/missing/coerced approval, unsupported prediction type, absent date, and invalid/nonpositive game identity.
- Approved same-game revisions retain the existing feature-version/update preference. An independent filter/order/projection-aware fixture mixes rejected provenance, other teams/seasons, and multiple revisions: only the preferred admissible version contributes. Missing xGF in that version stays null while xGA=0 survives; older categories are not used to fill the preferred version's gap.
- Multiple distinct game IDs in one daily slot suppress both ambiguous xG values/ID without losing the source date or independently valid WGO fields. xG game identity is retained as metadata; the WGO dated observation is not promoted to an exact-game join merely because its date matches.
- Date union preserves WGO-only/xG-only observations with no forward fill. Each xG category separately maps missing/nonfinite/negative values to null and preserves numeric zero. Null-bearing chart rows remain present and `connectNulls` is false.
- Resolved errors and actual rejected promises from either source preserve the other source and show a safe source warning. Both failures produce a generic load error. Private rejection text is not exposed.
- WGO sample size is retained/displayed, xG table columns say `(game)`, counts/best/recent labels say observations, and the delta explicitly compares five available observations. Independent six-valid-plus-one-null-date data gives a +5.00 delta with zero retained and the gap preserved.

The local aggregate writer was read at `web/lib/xg/aggregates.ts` around lines 429–451 and 635–652: its admission requires approved `shot_goal` predictions and carries those flags into team-game rows. The local schema comment corroborates that intended table contract. WGO extraction stores dated `games_played` samples. No writer/schema/data was modified or executed.

## Independent checks and evidence

Fresh source snapshot: `/tmp/fhfh-queue-check-vq86bjk4/isolation/snapshot/web`. Node **22.11.0**, npm **10.9.0**. Cleared synthetic environment, isolated home/tmp, socket/HTTP(S)/unmocked-fetch denial, installed dependencies reused. Supabase and chart rendering are mocked.

| Check | Actual result | Evidence |
| --- | --- | --- |
| Owner's mounted/helper suites | **27 passed** | [log](owner-tests.log) |
| Independent filter/order/rejection/ambiguity/delta suite | **5 passed** | [fixture](reviewTimelineAdmission.test.tsx), [log](independent-tests.log) |
| Packet-scoped TypeScript | **Passed**, exit 0 | [log](typecheck.log) |
| Four-file ESLint | **Passed**, exit 0, no diagnostics | [log](lint.log) |
| Scoped diff whitespace | **Passed** | `git diff --check -- web/components/MetricsTimeline` |
| Four canonical/snapshot after hashes | **Matched before/after** | [start](hash-verification-start.json), [end](hash-verification-end.json) |
| Preserved before files / reverse-applied packet | All declared before hashes and new-file absence match | [start](hash-verification-start.json) |
| Accepted A7–A9 packet | All **13 hashes unchanged** before/after | [end](hash-verification-end.json) |

Ran the two owner test files and `lib/reviewTimelineAdmission.test.tsx` using the packet's inspected `run-tests.sh` with the fresh snapshot. Scoped checks used `run-check.sh`, `npm exec --offline -- tsc --noEmit --project tsconfig.p03.json`, and the four-file ESLint command from the owner report. The owner's 7-fail/1-control baseline log was inspected as historical evidence, not independently rerun or counted as fresh evidence.

## Candidate identity

Branch `octoberBranch`; tested/final observed HEAD `fd58ba2452c0175b201e50285df156cb7f91b4f4`. Other agents advanced HEAD before this snapshot; acceptance is for the exact dirty-file hashes, not their unrelated commits.

- CANDIDATE SHA-256: `480166b2afec0e96ab1decaa8e6e728b5d3eae65db77784e28fa7bae34690b3f`.
- Patch SHA-256: `1964b22ee8a8615ae79936e27ebabef28b8c11ed8695dc15bc77b85c0cc3bf5c`.

| File | SHA-256 |
| --- | --- |
| `web/components/MetricsTimeline/MetricsTimeline.tsx` | `07bb3c3919ae684504551ab05afddada6dfe9fb71b8af282ccd11ea562779ebe` |
| `web/components/MetricsTimeline/metricsTimelineData.ts` | `59ad16886a71aa2c8d0e0d555f1b426439b6b6242dcc887d187dee85eb9bd441` |
| `web/components/MetricsTimeline/metricsTimelineData.test.ts` | `fabc0c29b1e1e772fb6e8f9461f881584ebff7cb58ecab2b2588608ce5c13622` |
| `web/components/MetricsTimeline/MetricsTimeline.test.tsx` | `83766270718f896c4d810509d1c4a6b67036c8dac65534aadc26be23720465b4` |

## Limits retained

Approval is enforced **as stored in the aggregate rows**. Historical flag accuracy, revocations, calibration, current registry/champion choice, and model qualification are not established. The unchanged per-game ordering preference is not a new model-selection policy. Positive game ID plus nonempty source date does not independently validate the upstream game's membership/date or the completeness of all expected games.

No upstream/date-universe/pagination completeness proof; no browser visual/AT/timezone verification; no live Supabase/model/source validation; no broader WGO numeric-data cleanup or source schema changes. The Recharts stub confirms supplied data/props rather than rendered visual gaps. Entirely absent upstream dates cannot be inferred from the supplied rows.

No app/owner-artifact edits, credentials/env-file reads, network/provider/production/NST calls, dependency installs, builds, commits, pushes, migrations or deployments. No denied, pending, or uncertain external action. No demonstrated P03 blocker remains; parent owns integration and broader held work.
