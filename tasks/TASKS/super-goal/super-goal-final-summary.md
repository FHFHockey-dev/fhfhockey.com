# FHFH Comprehensive Completion, Audit, and Optimization — Final Summary

> **Status: ACTIVE — NOT COMPLETE.** This is the required final-report skeleton. Populate verified results only after all completion gates pass.

## Repository-wide totals

| Metric | Verified total |
|---|---:|
| Source/supporting artifacts inventoried | 221 current; final pending |
| Initiatives identified | Pending final reconciliation |
| PRDs created/repaired | 4 current |
| Task lists created/repaired | 9 current |
| Source/master checkbox rows represented | 4,541/4,541 current imported ledger; 3,917 checked claims |
| Wave-A initiatives completed | 13/18 verified |
| Wave-B initiatives completed | 1/15 verified |
| Wave-C initiatives audited | 0/final dynamic total |
| P0 findings opened/closed | 2/1 current (Yahoo tracked-token exposure closed; newly transcript-exposed production cron bearer containment open) |
| P1 findings opened/closed | 28/19 current (`A-AUTH` provider ownership, Patreon bearer handoff, OAuth callback fragment/title containment, and browser-autofill credential containment plus local Cron/NST audit/status/source/cursor and season/WGO/missing-secret authorization findings are closed; migration, deployment, and production evidence remain open) |
| P2 findings opened/closed | 14/10 current (`A-AUTH` auth-table advisor remediation, Cron/NST tooling, pagination, catalog, fan-out, HTTP/audit-count/diagnostic, and single-player identity findings are closed; Patreon active-supporter evidence, OAuth PKCE migration, cross-table persistence, and durable-cardinality work remain gated or open) |
| P3 findings opened/closed | 0/0 current |
| Tests/checks/builds executed | Ongoing; current full Vitest passed 400 files/1,860 tests; A-AUTH callback/reset containment passes 4 files/33 tests and expired-session recovery passes 5 files/15 tests plus project TypeScript, scoped lint/diff checks, full local/production builds, READY/aliased deployments, value-free recovery assertions, clean target runtime evidence, and guarded provider/session cleanup; the combined Fantrax/ESPN/Patreon/account group passes 11 files/54 tests plus TypeScript, Sass, formatting, React/security review, and scoped diff checks; the final local Cron/NST remediation gate passes 10 files/99 tests and the auth-boundary gate passes 5 files/56 tests, plus full TypeScript, scoped legacy ESLint, implementation-file Prettier, forbidden-pattern/conflict scans, and scoped diff integrity (the repo-wide check only reports unrelated pre-existing whitespace in the brand-style reference); earlier database/deployment/Yahoo evidence remains recorded below |
| Remaining approved exceptions | 4 (`A-FORGE-V1` runtime/shadow evidence; `A-FORGE-DASH` historical sustainability/goalie freshness; `A-PRED` evidence-gated no-production state; `A-AUTH` Patreon generic-supporter-only with no concrete tier feature grants) |

## Platform and operations

### Authentication and user settings (`A-AUTH`)

- **PRD:** `tasks/TASKS/auth-user-settings-platform/prd/prd-auth-user-settings-platform.md`
- **Task list:** `tasks/TASKS/auth-user-settings-platform/tasks-prd-auth-user-settings-platform.md`
- **Current status:** Wave-A execution remains open at 184/205 source rows. Migration history, Vault/RPC boundaries, production ownership integrity, auth RLS performance, required public deploy configuration, the full Yahoo connected-account/callback foundation, credential-free Fantrax/ESPN manual-import foundations, the local Patreon API v2/member-entitlement foundation, the owner-approved generic-supporter-only Patreon policy, live OAuth configuration/deployment, the corrected bearer-token handoff, duplicate-identity rejection, complete disconnect/Vault cleanup, targeted local-auth reset, and production-verified callback/reset containment, expired-session recovery, and autofill-exposed credential containment are verified; 21 rows remain, including email mailbox evidence, Patreon active-supporter evidence, localhost/provider round-trip evidence, remaining broad credential rotations, and PKCE remediation.
- **Goal:** Provide secure Supabase site auth, user-owned settings/teams, isolated provider connections, Vault-backed tokens, guarded sync operations, and site-owned entitlement boundaries.
- **Implementation/evidence:** Production has 4/4 pre-existing Vault-referenced provider token rows outside the cleaned Patreon probe, no plaintext token columns or public-client Vault grants, service-role-only privileged wrappers, eleven validated composite ownership constraints with covering indexes, and 36 scalar-initplan owner policies. The canonical chain converged idempotently on temporary data-less branch `5799c88f-514b-4520-9883-3b13f5d99797`; the three already-live baselines were registered without DDL replay and both hardening deltas applied. Rollback-only integrity/RLS probes and target advisors pass. Deployment `dpl_CmirzkNJK8DfqdnojEDvTiUKHZ71` is READY and aliased to `fhfhockey.com`; the successful build includes `/api/v1/account/yahoo/team-roster`. One authenticated production refresh returned HTTP 200, refreshed 39 teams across five leagues, created exactly one completed manual audit run with a cleared dedupe key and five-minute cooldown, immediately disabled the UI action, and produced no target route error cluster. The temporary validation branch was deleted and confirmed absent. The owner-scoped on-demand opponent-roster endpoint, 15-minute database cache, secure token refresh persistence, and accessible roster viewer pass 3 files/22 tests plus TypeScript and live evidence: one Adorable Puppies provider load returned 21 players, persisted `league`/`on_demand` metadata, and an immediate repeat visibly used cache with an unchanged fetch timestamp; both target POSTs were HTTP 200 and the error cluster was empty. Fantrax and ESPN option A add no provider credentials or schema: authenticated owner-scoped CSV/JSON imports normalize up to 50 leagues/250 teams/10,000 rows, group roster records, update matching keys without deleting omitted data, preserve owner defaults unless explicitly replaced, independently switch active context, paginate complete state reads, and expose resilient import/default/active/status/error UX. Import runs record provider-isolated in-flight dedupe, stale recovery, failure, 15-second cooldown, and `Retry-After`. The Patreon local foundation requests only `identity`, filters explicit v2 member/tier fields for the configured FHFH campaign, uses stable user/member IDs for anti-sharing, converts uniqueness races to 409, persists rotated refresh tokens before follow-up reads, stores provider tokens through the existing Vault RPCs, materializes only generic `patreon_supporter` eligibility, guards re-sync with dedupe/stale recovery/60-second cooldown, and cascades token-secret cleanup on disconnect. The combined Fantrax/ESPN/Patreon/account group passes 11 files/54 tests plus TypeScript, Sass, formatting, React/security review, and scoped diff checks, including an explicit successful active generic-entitlement write. Corrected Patreon deployment `dpl_46Zukj28HpTpMyHwudhmzKvgkGzc` is READY/aliased; one production identity-only connect plus guarded resync created one connected account, one Vault-backed token row with two secret references, and two completed sync runs. The creator identity correctly had no paid membership. A rollback-safe duplicate-identity probe was rejected with zero retained rows, and authenticated disconnect removed all target account/entitlement/token/sync rows and both Vault secrets; target Patreon routes had no runtime error cluster. Callback-containment deployment `dpl_BXxbdjaCrj85guU33rGgS9UoaaS7` is READY/aliased and completed one fresh Google return with the callback already credential-free before Chrome metadata exposure, clean authenticated fallback/account state, zero target error clusters/5xx rows, an information-only Supabase 302/302/200 lifecycle, removal of the Google project connection, exact deletion of the sole probe session and refresh token, and confirmed expiry without reuse of the originally surfaced JWT. Expired-session deployment `dpl_2yad83EZq4A5oiQNovUPocLVxQMg` is READY/aliased; the same Chrome profile reached the signed-out fallback, a fresh value-free reset assertion set passed, and deployment-scoped runtime evidence showed two HTTP 200s and no `/auth` error cluster. For P1 `NEW 48.0`, the owner confirmed the exposed FHFH password was rotated, affected sessions were contained, and the saved Chrome credential was updated or removed; a fresh value-free production check then proved `/auth` fallback/reset reachability, signed-out header state, and absence of the stale signed-in branch without snapshots, input-value reads, cookies, or browser-storage inspection.
- **Open checkpoint:** A-AUTH has 21 open rows. Fantrax 25.0–25.4, ESPN 26.0–26.3/NEW 39.0, local Patreon 27.0–27.4/NEW 40.0, generic-only policy NEW 41.0, live Patreon NEW 42.1–42.4/42.6–42.7, P1 NEW 43.0, targeted reset NEW 34.0/34.5, P1 production containment NEW 45.0–45.4, expired-session recovery `47.0`–`47.3`, and P1 credential containment NEW 48.0 are closed. Production custom SMTP plus confirmation/recovery handoff returned HTTP 200 without Auth-log error, but Outlook receipt/callback evidence remains open. NEW 42.5/44.0 still requires a real active patron or a separate exact active-supporter evidence exception; repeat creator enablement does not satisfy it. Localhost Google, Yahoo redirect-round-trip, remaining broad credential rotations, and P2 NEW 46.0 remain separate checkpoints; PKCE stays deferred until the email templates and mailbox-backed flows are explicitly compatible.

### Cron audit email and NST remediation (`A-CRON-EMAIL`, `B-CRON-NST`)

- **Category:** Active Wave-A operations foundation plus dependency-ordered Wave-B remediation.
- **PRD:** `tasks/TASKS/cron-operations/prd/prd-cron-nst-audit-remediation.md`
- **Task lists:** `tasks/TASKS/cron-operations/tasks-cron-audit-email-failures.md`; `tasks/TASKS/cron-operations/tasks-prd-cron-nst-audit-remediation.md`
- **Current status:** A-CRON-EMAIL is 52/62 with 10 open; B-CRON-NST is 21/41 with 20 open. Local audit/status/source/cursor/pagination/diagnostic/player-identity remediation and the season/WGO/missing-secret authorization boundaries are verified. P0 CRON_SECRET containment is finalized: same-source deployment is READY/current; all 59 literals are canonical-Vault-backed; jobs 280/330 retain their approved inactive state; the two existing-Vault jobs and all 57 formerly active literals were restored through 24 gated batches with 61/61 activation parity and 47/47 green status-only probes; old/missing reject and current authorizes; the candidate, executable helpers, temporary scripts, and known pg_net debris are gone. Historical provider/transcript/cron-history/WAL/backup/log retention is documented without claiming global erasure. Approved option-A work is now the active checkpoint; adjacent review added one P1 privileged-RPC boundary, one P2 goalie prune-index requirement, one P1 clean-branch migration-history reproducibility blocker, and one P1 deferred SQL-expression runtime blocker now under correction.
- **Goal:** Restore trustworthy scheduled-job authorization, persistence, audit status, row counts, source completeness, NST ownership, and end-to-end cron-report evidence without secret-bearing diagnostics or false success.
- **Implementation/evidence:** A narrow local `immutable_unaccent` migration fixes the empty-`search_path` function boundary while preserving strict/immutable/parallel-safe semantics and the verified auxiliary catalog contract. WGO date acquisition validates every required page before persistence, emits bounded sanitized fetch/write/prune failures, writes replacements before stale-ID pruning, retains good rows on acquisition/upsert failure, and retains a safe superset on prune failure. Single-player WGO reads validate and normalize a positive safe NHL ID before source work, use it in all three predicates/audit context, and exclude off-target rows. Dynamic, daily, and recent game-stat paths acquire/materialize all sources before writes, share exact-FK parent repair plus one full-batch skater/goalie retry, require complete two-team and finished-game player sources, prove exact status advancement, propagate structured failures, keep current games pending, and preserve only explicit pre-write quarantine. The missing-secret helper/auth-check and season/WGO writer boundaries now fail closed and admit only the exact configured cron bearer or an authenticated admin. The final local Cron/NST gate passes 10 files/99 tests and the auth-boundary group passes 5 files/56 tests, plus full TypeScript, scoped legacy ESLint, implementation-file Prettier, forbidden-pattern/conflict scans, and scoped diff integrity; the repo-wide diff check is blocked only by unrelated pre-existing trailing whitespace in the brand-style reference.
- **Open checkpoint:** A-CRON-EMAIL P0 `10.0`–`10.6` is closed with value-free production evidence. Owner-approved option A governs B-CRON-NST `NEW 29.0`/`31.0`/`32.0` plus dependency-aligned `34.0`/`35.0`; `NEW 36.0` now precedes ordinary branch recreation because the production project's registered migration history leaves a fresh data-less branch at zero tables/migrations. The failed branch was deleted after evidence capture, and the adjacent Draft Ranker migration passed isolated executable replay, so no unsupported historical rewrite has been made. After a supported authoritative baseline or equivalent schema-only validation contract is established, validate both option-A migrations and rollback/ACL/cardinality probes, then apply production migrations in a quiet contiguous cutover, deploy the stable Cron release, and run bounded WGO `2026-06-14` plus stats game `2025030417` production probes. All remaining P1/P2 rows stay open until their required evidence exists.

### Initiative summary template

- **Initiative / stable ID:** Pending
- **PRD path(s):** Pending
- **Task-list path(s):** Pending
- **Final status/count:** Pending
- **Goal:** Pending
- **Source/supporting documents:** Pending
- **Implementation and verification evidence:** Pending
- **Audit findings and completed improvements:** Pending
- **Approved exceptions/external dependencies:** None unless explicitly recorded

## Contextual rankings and analytics

Initiative sections pending verified Wave-A/B completion and Wave-C audit.

## Underlying stats and site surfaces

### Site surface expansion roadmap (`A-SITE`)

- **PRD:** `tasks/TASKS/three-pillars-analytics/site-roadmap/prd/prd-fhfh-site-surface-expansion-roadmap.md`
- **Task list:** `tasks/TASKS/three-pillars-analytics/site-roadmap/tasks-prd-fhfh-site-surface-expansion-roadmap.md`
- **Current status:** Wave-A implementation complete, 70/70 source rows; dynamic Wave-C audit pending.
- **Goal:** Consolidate route ownership and connect homepage, Trends, Team HQ, Lines, goalies, Game Grid, WGO, and the existing Rankings synthesis into coherent decision workflows.
- **Supporting material:** `tasks/TASKS/three-pillars-analytics/site-roadmap/prd/fhfh-site-surface-expansion-implementation-map.md`.
- **Implementation/evidence:** completed homepage/Trends/team/lines/splits/context foundations, five-band goalie consistency/workload, tabbed four-week planning, WGO team drivers, gated Player Evaluation Toolkit roadmap, shared-contract/freshness/deferred-scope documentation, and direct Game Grid Team HQ links. Consolidated 12-file regression group passes 47/47; TypeScript/diff checks and named live-browser flows pass.
- **Audit status:** Broad Wave-C correctness/data/reliability/performance/UX/accessibility audit remains tracked as `5.7.4`; no exception is approved.

### Style system and underlying-stats restyle (`A-STYLE`)

- **PRD:** `tasks/TASKS/three-pillars-analytics/site-roadmap/prd/prd-fhfh-style-system-and-underlying-stats-restyle.md`
- **Task list:** `tasks/TASKS/three-pillars-analytics/site-roadmap/tasks-prd-fhfh-style-system-and-underlying-stats-restyle.md`
- **Current status:** Wave-A implementation complete, 87/87 source rows; dynamic Wave-C audit pending.
- **Goal:** Establish a prompt-ready FHFH style system and prove it on Underlying Stats while closing player-data trust, loading, and shared-dialog gaps discovered during implementation.
- **Supporting material:** `tasks/TASKS/rules/fhfh-styles.md`, `web/pages/cssTestingGrounds.tsx`, and the player underlying-stats runbook.
- **Implementation/evidence:** added four-state expected/roster/summary coverage diagnostics with live Martone verification; replaced full background hydration with first-100/on-demand-100 server-sorted loading; retained cumulative Rank/sticky layers and compacted the table-first layout; created a shared modal shell used by Draft Summary, Compare Players, and CSV Import; synchronized the guide, sandbox, and reference registry. Focused groups pass 32/32 and 57/57, TypeScript/diff checks pass, and live player-table/dialog-sandbox renders pass.
- **Audit status:** Dynamic Wave-C audit remains tracked as `5.7.5`; deferred chart/popover/page-empty/callout canon remains explicit rather than silently approved.

## FORGE projections

### Projection model V1 (`A-FORGE-V1`)

- **PRD:** `tasks/TASKS/forge-projections/v1/prd/prd-projection-model.md`
- **Task lists:** `tasks/TASKS/forge-projections/v1/tasks-prd-projection-model.md`, `tasks/TASKS/forge-projections/v1/tasks-skater-forge.md`, and completed nested goalie list `tasks/TASKS/forge-projections/v1/tasks-goalie-forge.md`.
- **Current status:** Wave-A implementation complete; main 40/40, nested skater 55/55, embedded PRD 18/18; dynamic Wave-C audit pending.
- **Goal:** Produce run-scoped, reconciled team/skater/goalie projections with uncertainty, multi-game horizons, accuracy/calibration evidence, safe operations, and explainable canonical readers.
- **Supporting material:** shared goalie/skater operator runbook, FORGE table contracts, promotion gates, rollout contract, and canonical cron inventory.
- **Implementation/evidence:** completed opportunity/share/conversion modeling, role and goalie scenarios, reconciliation, P10/P50/P90 simulation through 10 games, role-bucket and miss-attribution diagnostics, current/naive holdout reports, players API confidence/range metadata, scheduled-team freshness gates, chunk/resume semantics, cron observability, and a versioned candidate/baseline rollback flag. Final focused group passes 93/93; TypeScript and diff checks pass.
- **Approved exception:** Owner approved missing deployed runtime-target success and 14 elapsed matched shadow dates on 2026-07-11. This closes Wave-A implementation bookkeeping but does not authorize or support model promotion/default switching; those actions remain blocked until real evidence exists. Dynamic audit is tracked as `5.7.6`.

### Dashboard component remediation (`A-FORGE-DASH`)

- **PRDs:** `tasks/TASKS/forge-projections/dashboard-health/prd/prd-forge-dashboard-component-health.md` and `prd-forge-dashboard.md`.
- **Task list:** `tasks/TASKS/forge-projections/dashboard-health/tasks-forge-dashboard-component-remediation.md`.
- **Current status:** Wave-A implementation complete; all 75/75 remediation rows close and the initiative enters dynamic Wave C. The retained legacy dashboard now waits for initial URL hydration before mounting data modules. The operational matrix remains 4 green, 3 yellow, and 3 red because approved historical/prospective promotion gates are represented truthfully rather than hidden.
- **Implementation/evidence:** CTPI and skater movement use source-derived recency and cap-safe pagination; dashboard and landing routes render tested page-level mixed-date warnings. Ownership readers use start-year Yahoo seasons plus complete paginated/chunked reads, Top Adds joins stable IDs only, missing overlays are explicit, and player-detail weekly scoring shares the rail schedule context. Team-power and CTPI writers page all large NST/WGO reads, and team power retains the 150-day trend window through the offseason. The isolated master-based writer release `9d5cbb4` deployed READY as `dpl_8n73AQz5yDZAfqQWuArXUgopbVBw`; production writer probes passed (CTPI 32 rows/3.50s, power 32 rows/3.59s, player trend 52,153 source games/17.33s). Option-A commits `6e06064`, `a1b744e`, and `258cbcb` culminated in READY production deployment `dpl_D8gth3djEPB1JLZ6B2fAL44oETVE`. Vercel and Supabase Vault now share the rotated secret; all 60 affected commands migrated; old/new non-mutating auth probes returned 401/200; jobs 308 and 393 use Vault-built headers at 10:05/10:12 UTC. The first weekly invocation returned HTTP 200 in 430 ms with horizon 5, zero games/rows, all gates PASS, and no warnings. Current team ratings have 32/32 non-zero and 32 distinct `trend10` values. The latest-date index replaced the 2M+-row sort with a 2.842 ms index-only scan. The full gate passes 399 files/1,852 tests; the final option-A/auth/no-op group passes 32/32 plus TypeScript and production builds.
- **Remaining promotion condition:** Top Adds remains red until the first prospective non-zero in-season horizon-5 run proves data coverage. This is the owner-selected truthful promotion gate, not unfinished writer, credential, deployment, or cron ownership work.
- **Approved historical exception:** Owner approved preserving the verified 2026-03 sustainability `l10` gap and missing 2026-03-29 FORGE goalie rows rather than rebuilding them with later priors/inputs. Historical scopes remain quarantined and prospective same-day evidence is required before promotion; the exception does not count as repaired data.

### FORGE Command Center (`A-FORGE-CC`)

- **PRD:** `tasks/TASKS/forge-projections/command-center/prd-forge-command-center-rebuild.md`.
- **Task list:** `tasks/TASKS/forge-projections/command-center/tasks-prd-forge-command-center-rebuild.md`.
- **Current status:** Wave-A completion verified at 80/80 rows. The owner approved one-release coexistence on 2026-07-12: `/FORGE` promotes `/forge/command-center` through all three primary actions, and `/forge/dashboard` remains available as the explicitly labeled legacy rollback route.
- **Goal:** Provide a responsive, URL-backed command center for team power, focused slate, Top Adds, player insight, and goalie risk with truthful per-module freshness/error/empty states and context-preserving drill-ins.
- **Implementation/evidence:** exact CAR team-power and CAR-TBL slate values, zero-candidate Top Adds, selected-date skater momentum, and CAR goalie values reconcile against live normalized payloads. Hard reload preserves URL filters. Skater power is now date-bound, closing the observed historical future-data leak. Row-driven modules no longer mask errors as Empty. Player Insight exposes explicit named-row substates. Desktop goalie rows use a full-width band. Six required viewports report no page-width overflow or hidden-overflow text candidates; the legacy comparison forces a 2056px canvas at a 1440px viewport. Promotion links and labels pass 40/40 focused route tests plus TypeScript. Browser navigation proves the landing reaches Command Center, the rollback route remains reachable, and both landing/legacy hydration gates issue only requested-date reads. The current full suite passes 400/1,860, and the post-repair production build passes.
- **Open dependency/follow-up:** A-SUST NEW 8.0 owns canonical player-name population for sustainability hot/cold rows; Command Center visibly degrades those Trust/Fade sub-sections and does not fabricate names. Master NEW-006 owns the Wave-C one-release evidence review and any later final route swap/removal approval.

### FORGE ecosystem pass four (`A-FORGE-P4`)

- **PRD:** `tasks/TASKS/forge-projections/ecosystem-audits/prd/prd-forge-ecosystem-pass-4-audit-remediation.md`.
- **Task list:** `tasks/TASKS/forge-projections/ecosystem-audits/tasks-prd-forge-ecosystem-pass-4-audit-remediation.md`.
- **Current status:** Wave-A implementation complete at 91/91 rows; dynamic Wave-C audit pending under master 5.7.7.
- **Goal:** Re-audit the live FORGE ecosystem across contracts, reader/writer freshness, output plausibility, bounded operations, dashboard UX, legacy isolation, and diagnostic continuity, then remediate verified defects without speculative architecture churn.
- **Supporting material:** pass-three stabilization/quarantine audit, living pass-four audit, FORGE/Trends combination architecture, dashboard component matrix, model contracts, and operational endpoint evidence.
- **Implementation/evidence:** readers now expose stale/degraded state truthfully; recompute smoke paths are bounded; neutralized modifiers remain distinguishable; tiny-sample ranks shrink toward neutral and suppress unsupported deltas; placeholder goalie calls and mixed-recency team context cannot masquerade as actionable same-day evidence; missing numeric fields remain null; legacy sKO chart/data contracts are explicitly quarantined and named `LegacySko*`. The canonical Trends player page now accepts validated group-scoped diagnostic focus, while Sustainability and Hot/Cold links preserve FORGE date/origin/return context and open Finishing or Rates metrics respectively. The final six-file group passes 43/43 tests plus TypeScript, covering goalie metadata, tiny-sample ranks, null preservation, dashboard composition, diagnostic focus, and link contracts.

### FORGE living pass four (`A-FORGE-LIVE`)

- **PRD:** `tasks/TASKS/forge-projections/ecosystem-audits/prd-forge-pass-4-living-audit-remediation.md`.
- **Task list:** `tasks/TASKS/forge-projections/ecosystem-audits/tasks-prd-forge-pass-4-living-audit-remediation.md`.
- **Current status:** Wave A complete at 63/63 rows; dynamic Wave-C audit pending under master 5.7.8.
- **Goal:** Run a living end-to-end FORGE audit, promote calibrated gradient boosting into the shot-level xG path, close dashboard correctness/style/output gaps, and prove operational paths against the 4:30 budget.
- **Implementation/evidence:** newer A-FORGE-DASH/P4/CC evidence closes stale living-list control, component, styling, output, density, visual, browser, and pool-recovery rows. `xgboost_js` is the calibrated training default and production scorer for validated approved artifacts. The legacy game-goal route declares its non-shot-level model contract. Player trend rebuilds accept bounded player-id chunks with cap-safe reads/writes. Single-date projection runs accept bounded `gameIds`, filter the slate before downstream work, and record selected-game scope. The first isolated probe found a fallback-pool statement timeout; qualifying the read with the resolved season changed the measured PostgreSQL plan from 4.583s to 16ms using the existing index. Preview `dpl_9upPoBLks2mqM2ny6KHpHy8tqaHB` then completed game `2025021305` in 15.157s. Supabase run `9f490284-84d8-4510-b60c-c97c9e2dd66f` is `succeeded` with exact selected-game telemetry and matching 29 player, 2 team, and 2 goalie physical rows; the cron audit records HTTP 200/success. The release passes 86/86 focused tests, TypeScript, a full build, and diff integrity.
- **Accepted exceptions:** None for the timing gate. The probe deployment remains isolated and was not promoted or aliased to production.

## Prediction and xG models

### NHL game prediction model (`A-PRED`)

- **PRD:** `tasks/TASKS/nhl-game-prediction-model/prd-nhl-game-prediction-model.md`.
- **Task lists:** `tasks-prd-nhl-game-prediction-model.md`, `tasks-prd-game-prediction-accuracy-improvement.md`, and `tasks-prd-nhl-game-prediction-roster-sos-model.md` in the same initiative directory.
- **Current status:** Wave A complete at 228/228 rows: main model 115/115, accuracy 49/49, roster/SOS 64/64; dynamic Wave-C audit is queued.
- **Goal:** Produce leakage-safe, versioned pregame probabilities with honest feature snapshots, roster/goalie/SoS context, accountability scoring, explainable promotion gates, and a verified public surface.
- **Implementation/evidence:** Player-impact prerequisites are populated with current-season daily ratings and prior-season anchors, TOI shrinkage, recency decay, and tested fallbacks. Full daily prior-season ratings are explicitly unnecessary for the first anchor-based pass. Candidate feature snapshots now embed versioned projected-line/current-roster aggregates, sampled-TOI-weighted skater offense/defense and goalie impacts, team special-context, three matchup deltas, strict pregame source cutoffs, coverage, and fallback warnings. A discovered SoS leakage defect is closed: each past opponent rating is selected strictly before that historical game, rather than before the later prediction cutoff. Walk-forward backtests accept multiple explicit training seasons, merge completed games chronologically, retain blind target-season windows, and persist exact training-season metadata. The still-active production model remains unchanged; its metadata truthfully calls the existing contract `forge_team_projection_proxy_v1`. The combined accountability/roster/feature/model group passes 48/48 focused tests and TypeScript.
- **Latest verification:** Logistic fitting, feature normalization, and the smoothed home prior apply versioned 1.0/0.65/0.35/0.20 season-recency weights consistently to initial and replay-added examples. The expanded weighted-logistic/accountability/roster/feature/model group passes 51/51 focused tests and TypeScript; this supersedes the earlier 48-test checkpoint in the implementation narrative above.
- **Rolling/segment evidence:** The sole valid completed-season roll (2024-25 training → 2025-26 blind) ran read-only. Phase holdouts recorded early 5/12, middle 7/12, and late 10/29 with Brier/log-loss evidence. Typed signal reports cover 12/12/29 phase-qualified games and expose small-sample inversions such as goalie-start uncertainty changing sign. A discovered standings-season leak was remediated and regression-tested; no evidence was persisted or promoted. The latest focused suite passes 53/53 plus TypeScript.
- **Blend evidence:** Candidate snapshots now carry a versioned 0/10/25/50/82 games-played curve, retain 10% roster context at the season cap, and expose raw plus separately time-weighted roster offense/defense/goalie and recent goal-differential/xG-share fields. This avoids an arbitrary cross-scale composite and leaves production vectors unchanged. The latest focused suite passes 54/54 plus TypeScript.
- **Ablation evidence:** Default-excluded roster-only, time-weighted, SoS-only, and roster+SoS variants ran with `persistEvidence=false`. All tied v4 at 5/12 and worsened probability quality; SoS-only was closest at Brier/log loss `0.363779/0.965023` versus v4 `0.360292/0.958583`. None is promotable.
- **Anchor/per60 evidence:** Goal-differential anchoring improved Brier/log loss to `0.307631/0.817641`; standings anchoring reached 6/12 and `0.291907/0.784130`, but the sample is insufficient for promotion. Exact unshrunk per60 priors slightly beat TOI-shrunk priors (`0.380668/1.008579` vs. `0.381813/1.011246`) while both trailed v4. All candidate keys remain default-excluded and production versions unchanged.
- **Launch/scoring evidence:** The refreshed 45-source audit has zero relation/key blockers and all retained warnings map to implemented source rules. Persisted v4 walk-forward evidence covers 369 games. A bounded regular-season-first/playoff-fallback outcome reader and 401-ID regression close the playoff scoring defect; the read-only v6 May 1–June 17 rerun evaluates 31/53 predictions at 61.2903% accuracy, 0.225645 Brier, 0.643972 log loss, and 0.638655 AUC. Prediction-focused tests pass 72/72, the dedicated evaluation/workflow rerun passes 20/20, and TypeScript passes.
- **Lifecycle safety:** Scoring setup now preserves every existing model-version lifecycle state and creates a candidate only for an absent exact key; a regression proves an existing production row receives no upsert. This closes a defect that could otherwise demote production during metric scoring.
- **Persisted scoring verification:** Owner-approved option A persisted nine v6/v4 candidate metric rows for 31/53 playoff predictions. The immutable history remained 53 rows with SHA-256 `1798dbb4f36b03882416ff32ac4fb0746a77a9867d5ae4b84d2c48ba73c826c6` before and after; the exact model remains `candidate` and the project has zero production model rows.
- **Accepted exception:** Production activation is evidence-gated. Persisted v4 walk-forward evidence trails the goal-differential baseline, v6/v4 has only 31 evaluated playoff predictions, and compiled v6/v5 has no stored evidence. Do not bootstrap/promote or activate production cron until v6/v5 earns adequate in-season validation.
- **Remaining work:** Dynamic Wave-C audit after Waves A/B, including the approved exception, model/feature identity, scoring immutability, source freshness/leakage, promotion safeguards, public-state truthfulness, and cron readiness.

### xG trending completion (`A-XG-TREND`)

- **PRD:** `tasks/TASKS/xg-model/trending-model/prd/prd-xg-trending-model-completion.md`.
- **Task list:** `tasks/TASKS/xg-model/trending-model/tasks-xg-trending-model-completion.md`.
- **Current status:** Wave A complete at 170/170 rows; dynamic Wave-C audit is queued. Calibration/benchmark taxonomy, residual layers, tracking disposition, owner-token leases, registry coverage, operations telemetry, corrected challengers, production flurry materialization, contained candidate shadow scoring, and richer-rebound offline evidence are complete.
- **Goal:** Harden the in-house xG platform with leakage-safe model contracts, calibrated challengers, raw and derived probability surfaces, controlled tracking evidence, durable execution, and truthful operational telemetry.
- **Latest evidence:** Production `dpl_8AiEssYqAd3MRt5KDx6M1D9Fx6E6` is READY with guarded xG mutation routes. The exact active tuple has six complete flurry-adjusted aggregate surfaces, sampled symmetry PASS, and six unchanged raw fingerprints. Corrected logistic `cfg2afcf561` is candidate/inactive/non-champion with 118,610 separate shadow rows; champion lifecycle and prediction hash remain unchanged. Offline artifact `rebound-rich-heads-v1.json` (SHA-256 `4da2637d1d2f51d99e3edbcac1ca2148268815d8123ac0fec9fbc8e54214f402`) covers 145,050 source labels and three promotion-disabled heads; test AUC is 0.5828 danger, 0.6174 freeze/control, and 0.6357 conditional second-chance xG.
- **Open production/strategy boundaries:** The active/champion artifact remains on the superseded leaking contract and is intentionally unchanged. Its historical superiority is invalid promotion evidence. The corrected candidate and all richer-rebound heads require a future explicit promotion checkpoint; richer-rebound registry/prediction row counts are zero.

### xG release remediation and exception resolution (`A-XG-REL`, `B-XG-EX`)

- **PRD:** `tasks/TASKS/xg-model/release/prd/prd-xg-release-validation-and-exception-resolution.md`.
- **Task lists:** `tasks-xg-release-remediation.md` (32/32) and `tasks-xg-release-exception-resolution.md` (15/15) in the release directory.
- **Current status:** A-XG-REL Wave A complete and B-XG-EX dependency-closed early at 47/47 combined; dynamic Wave-C audits 5.7.10/5.7.11 are queued.
- **Goal:** Preserve NHL event identity, repair true parity bugs, keep approved NHL-correctness divergences visible, and issue a reproducible training-use verdict without conflating that verdict with production cutover.
- **Evidence:** The exception-aware v2 batch records raw PASS for 10/10 games, parity WARN, zero blocking mismatches, 1,021 visible approved-exception mismatches across 184 samples, and training-use PASS for parser/strength/feature/parity version 1. The blocker review reports none, the dated verdict is `release gate satisfied`, and downstream baseline options are 36/36. Current validation/parity tests pass 18/18; relevant validation code is unchanged from the recorded tuple.
- **Conditional dispositions:** Frozen-NST on-ice exact matching was explicitly retired after true zone-start bugs were fixed. Legacy `NULL` and new explicit zero remain intentionally distinct; 156 `shots_blocked` mismatches remain visible as approved-exception evidence rather than being silently normalized.
- **Operational caveat:** A 2026-07-12 fresh runner attempt exited before validation because the direct Supabase Postgres hostname could not resolve (`ENOTFOUND`). It produced no artifact or data write and does not replace or invalidate the version-matched v2 evidence.
- **Production boundary:** Training use is approved only for the validated tuple. Production-reader cutover, authoritative parity publication, and large historical rollout remain separately governed.

## Draft Dashboard and Yahoo

### A-DRAFT — Draft Dashboard

- **PRD:** `tasks/TASKS/draft-dashboard-yahoo/prd/prd-draft-dashboard.md`
- **Task list:** `tasks/TASKS/draft-dashboard-yahoo/tasks-prd-draft-dashboard.md`
- **Current status:** Wave A complete at 91/91; dynamic Wave-C audit 5.7.13 is queued.
- **Goal:** Provide a fast, truthful, session-safe fantasy draft workstation with complete projection/Yahoo consumption, configurable value calculations, keeper/trade ownership, recommendations, comparisons, and reproducible summaries.
- **Evidence:** Complete bounded/paginated reads; collision-safe current-game Yahoo and duplicate-source identity resolution; official-only durable weights and tab-scoped multi-CSV; corrected cached scoring, FWD grouping, replacement, keeper, trade, and recommendation contracts; truthful loading/error/stale/partial/no-source states; privacy-safe summary/bookmark metadata. Consolidated verification passes 36 files/114 tests plus TypeScript, Sass, diff, HTTP-200 route, 2056/900/520 responsive evidence, 12.69ms representative source recompute, and 1.423ms average 10,000-player filter interaction.
- **Approved decision:** Option A retains the completed inline/collapsible settings workstation and supersedes the older all-settings-modal sentence. Workflow-specific CSV, trade, comparison, and summary dialogs remain modal; `B-DRAFT-STYLE` may revisit presentation later.

### A-DRAFT-DEBUG — Draft Dashboard debug/performance

- **Current status:** Wave A complete at 14/14 reconciled rows; dynamic Wave-C audit 5.7.14 is queued.
- **Evidence:** SHA now uses one tested null-safe, non-negative `SHP - SHG` helper for projected and actual data; actual/custom SHG inputs are mapped; registry/source-pair metadata, Points/Categories selectors, empty-category recovery, Draft Board dynamic values, and blended export wiring are reconciled. Focused verification passes 5 files/19 tests plus TypeScript. Current absolute benchmarks are 12.61ms for 1,000 players × 24 stats × 8 sources and 5.59ms for a 10,000-player filter run.
- **Approved exception:** Performance option A accepts the current absolute evidence and excepts only the missing historical `>=30%` relative TTFP comparison; no unsupported percentage claim is made.

## Variance

Initiative sections pending verified Wave-C audit.

## Cleanup and reference documentation

Initiative sections pending verified Wave-B completion and schema/reference audit.

## Completion-gate evidence

All charter questions remain open until source/master synchronization, Wave A/B completion, Wave C audit/remediation, cross-initiative verification, cleanup, diary finalization, and evidence population are complete.
