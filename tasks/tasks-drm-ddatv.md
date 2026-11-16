# DRM DDATV execution list

Requirements: `/Users/tim/.codex/attachments/38f477dc-10b3-466e-9324-e36204c8f313/goal-objective.md`. Evidence and interim reports: `tasks/artifacts/drm-ddatv-2026-11-12/`. Local implementation and acceptance are complete. Production activation is separate, unexecuted work under explicit release/repair controls; see `RELEASE-REPAIR-PLAN.md`.

## Relevant Files

- `web/pages/drm.tsx`, `web/__tests__/pages/drm.test.tsx`: calendar scope and controls (calendar worker).
- `web/components/DateRangeMatrix/index.tsx`, `index.accessibility.test.tsx`: rendered matrix/TOI ordering (Chef).
- `web/components/DateRangeMatrix/fetchAggregatedData.ts`, `useTOIData.tsx`, `useDateRangeMatrixData.ts`: reader and coverage (root; user transferred the triage candidate paths).
- `web/lib/projections/ingest/shifts.ts`, `web/pages/api/v1/db/shift-charts.ts`: source/strength generation (root; transferred for DRM integration).
- `web/lib/rankings/teamUnitToiBuilder.ts`: existing simultaneous 5v5-unit implementation to assess for reuse; read-only initially.
- `web/lib/sources/projectedLineups.ts`, `tweetProjectionStorage.ts`, `web/lib/lines/`: historical report contracts and sanitization; read-only inventory complete.

## Notes

- User decisions Nov 12: one main line per player, observed alternatives separately; main lines use 5v5, other ES time separate. The default aggregated path now uses observed units; legacy Raw QA remains explicitly separate.
- History decision: game dates for reliably linked reports; practice and uncertain/unlinked sources separately by publication; switch to publication filtering. Never infer a game date. Legacy report IDs alone do not qualify a game link.
- Only canonical octoberBranch edits. No commits/releases/production repair implied. User explicitly transferred the 21 triage candidate paths for DRM integration.
- Concurrency: two sol/high workers under verified astra/xhigh Chef; both finished and handed their files to root. No remote workload beyond bounded reads. The archive connection recovered after a healthy metadata/activity check; saved scoped diagnostics supersede the first timeout.

## Tasks

- [x] 1.0 Inventory and first data-quality checkpoint.
  - [x] 1.1 Reconcile prior interval/strength evidence, leases, diaries and actual source hashes.
  - [x] 1.2 Check production alias, relevant migration ledger entries, cron order and two representative games read-only.
  - [x] 1.3 Save PHASE-1 report with sources, known defects and unverified stages.
- [x] 2.0 Independently audit current assignment and denominators with reproducible numeric cases.
  - [x] 2.1 Execute real helper/reducer probes; distinguish synthetic trios from simultaneous observed units.
  - [x] 2.2 Resolve main lineup repetition and 5v5 definition with user.
- [x] 3.0 Repair independent calendar and matrix behavior (does not require producer handoff).
  - [x] 3.1 Calendar 7/14/30 days and season-to-date, correct Eastern/DST boundaries, custom/race preservation.
  - [x] 3.2 Total TOI sorts cumulative seconds with deterministic ties; rendered-order and keyboard regressions pass.
  - [x] 3.3 Review all control/data states and responsive/accessibility behavior with isolated source-to-display fixtures.
- [x] 4.0 Repair and qualify source foundations (depends on prior owner's handoff).
  - [x] 4.1 Review exposure clock correction, versions, exact fixtures and remaining scientific limits. Forwarded completion read; all 21 candidate hashes match; five-game 760-clock/3,420-pair evidence reused. User confirmed path transfer.
  - [x] 4.2 Expected completed games and roster completeness; absent/pending/invalid/stale coverage remains explicit.
  - [x] 4.3 Reuse/extend simultaneous-unit facts with source lineage; avoid synthetic fillers, pooled-player-second confusion and unsupported positions.
- [x] 5.0 Implement measured lineup and strength views (depends on 2 and 4).
  - [x] 5.1 Main non-repeating observed lines/pairs; alternatives, ties and incomplete assignments visible.
  - [x] 5.2 All / ES / PP / PK views; separate 5v5, other ES and PP measures; do not invent PP1/PP2 confidence.
  - [x] 5.3 Custom line cards and full roster share exact same accepted scope as matrix; observed-unit replacement is complete.
- [x] 6.0 Historical line evidence.
  - [x] 6.1 Trace intake, identities, publication/observation clocks, revisions, attribution and public readers.
  - [x] 6.2 Establish bounded real source coverage/access and clock basis. Recovered connection; VGK Nov4–10 sample saved. Wider coverage remains unknown.
  - [x] 6.3 Read-only paginated retained-history view, safe source links, preserved versions/recorded correction kinds and explicit unknown coverage/correction completeness; no provider execution on GET. 42 backend tests, 5 component tests and browser cases pass.
  - [x] 6.4 Separate reports from observed ice-time assignments and show discrepancies.
- [x] 7.0 Integrated local acceptance and release/repair handoff.
  - [x] 7.1 Source-to-display unit/integration/browser cases and representative captured-real-data comparison.
  - [x] 7.2 Proportionate type/lint checks, final ownership/diff inspection, local test instructions and explicit remaining limits.
  - [x] 7.3 Reviewable candidate and bounded production rebuild plan; obtain separate approval if release/production repair requested. Do not claim production accuracy beforehand.

## Outstanding production work (not authorized or executed)

- Release an exact reviewed candidate SHA after linked-project/build preflight.
- Approve and execute the five-game source-aware v6 pilot, then scope the complete historical population separately.
- Wider report capture and correction completeness remain unverified; do not represent retained history as exhaustive.

Final local evidence and reproduction commands: `tasks/artifacts/drm-ddatv-2026-11-12/DELIVERY.md`.
