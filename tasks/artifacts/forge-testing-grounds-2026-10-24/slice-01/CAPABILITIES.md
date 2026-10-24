# Testing Grounds first capability result

Local discovery and implementation slice, 2026-10-24. Task 1 is partial. Parent authorized this sole implementation worker after planning; the older planning headers do not supersede that later steer. PRD Library v1 and task list v0 were read completely through the supported read route. The canonical Mac document paths remain absent because installation failed; no transfer retry was made here. See EVIDENCE.json for source identities and full-text hashes.

## Verified implementation boundaries

| Area | Evidence | Consequence |
| --- | --- | --- |
| Pages Router | `web/pages/forge/forecasts.tsx`, `web/pages/db/runner.tsx` | New route can use Pages Router; no route/navigation change in this slice. |
| API authorization | `web/utils/adminOnlyMiddleware.ts` | Verifies Supabase user + admin role, but also admits cron and local-development exceptions. This is not a single-owner identity policy. Do not reuse it unchanged as proof of PRD owner-only authorization. |
| Page gate | `web/components/Admin/AdminPageGate.tsx` | Client admin presentation gate; optional review-token path. Does not establish server page authorization. |
| Investigation | `web/pages/db/runner.tsx` | Bare `/db/runner` opens an admin investigation page. Queue/cancel/run-now are separate requests; new health reports provide only this bare navigation link, no execution query. |
| Existing durable pattern | `web/lib/routeRunner/store.ts`, jobs routes, `route-runner-tick.ts` | Persistent jobs, conditional lease updates and bounded steps exist in code. Tick imports maintenance handlers. Existing queue acceptance is not this feature's immutable/idempotent run acceptance. Live installation/cost/capacity not inspected. |
| Count semantics | `web/lib/player-forecasts/gameContract.ts` | `count_means_only`, fractional nonnegative means; count distributions and expected realized ratios explicitly unsupported. Sources carry separate published/effective/received/verified times. Contract shape is not proof each adapter produces every target. |
| Start event candidate | `web/lib/player-forecasts/modeledGoalieParticipation.ts` | `buildGoalieStartKernel` and `buildFrozenWindowGoalieStartReceipt` explicitly estimate official-starter frequency on declared eligible opportunities. Source labels them experimental and calibration unavailable. Independent mapping/admissibility/pilot decision remains open. Appearance probability is not starter probability. |
| Cutoff ordering | `web/lib/projections/evidenceTime.ts` | Pure microsecond comparison helper, reused for input-health chronology; no DB/provider imports. |
| Tests | `web/vitest.config.mts`, setup, package/tsconfig | Existing Vitest/Zod available; Node 22.11.0 verified. Isolated pure checks need no server or credential. |

## Guided controls: actual candidates, not yet exposed

Existing `web/lib/projections/constants/projection-weights.ts` has:

| Existing constant | Current value | Remaining control contract |
| --- | --- | --- |
| `SKATER_PHYSICAL_PRIOR_MINUTES` | hits 50, blocks 300 | Hours/minutes semantics and fitting path must be pinned; allowable experiment bounds not approved. |
| `SKATER_PHYSICAL_RECENT_SHRINK_MINUTES` | hits 240, blocks 1000 | Same; these are compiled constants, not injectable dashboard parameters. |
| `SKATER_PHYSICAL_PRIOR_SEASON_WEIGHT` | 0.5 | Supported alternatives and compatibility need model-adapter review. |
| `SKATER_ROLE_HISTORY_WINDOW_GAMES` | 10 | Current constant only; no verified configurable registry or historical replay adapter. |

`research/skater-candidates/priors.ts` accepts explicit `k` candidates in a research fitting function. Its alternating-game split-half routine is labeled tuning evidence, not chronologically ordered inner validation for this product. It must not be silently adopted as walk-forward validation. No working controls or arbitrary parameter bounds were invented.

## Required target/event matrix retained

| Required capability | Verified status in inspected contracts | Remaining gate |
| --- | --- | --- |
| G, A, PPP, SOG, HIT, BLK, PIM means | Each named in game count contract | Pin actual baseline/candidate output availability, as-of adapter and immutable provenance for each. |
| SV, GA, W, SO means; shot/time exposure | Named count targets/goalie accounting and conditional bases | Verify each source/model output, game population and start/appearance/exposure semantics. Do not promote contract presence to working support. |
| SV%, GAA | Expected realized ratios expressly unsupported by count contract | Approve rate definitions/eligible denominators and evaluation adapter; no averages of unrelated ratios. |
| Goal, assist and shots-threshold binary events | No validated count distribution in inspected contract | Find approved binary head/distribution or explicitly approve separate model scope; no `mean = probability` conversion. |
| Goalie win event | W count target exists | No pilot event mapping/validation established in this discovery. |
| Goalie start event | Explicit empirical event head exists | Resolve validation receipt, baseline/candidate mapping, eligibility and uncalibrated-estimate treatment. |

## Decisions for Scout/TJ

1. **Owner boundary:** bind this feature to one verified owner ID using the existing authenticated session, with distinct worker authorization; specify server page/session handling. Admin/cron permission alone is insufficient. No new credential created.
2. **Runner A — isolated bounded steps:** reuse the existing DB lease/CAS pattern and scheduled bounded-function design only after a separate Testing Grounds job/acceptance/store/worker contract is approved. Needs immutable manifests, accepted-output uniqueness, fencing, cancellation-request semantics, sealed artifacts and explicit runtime feasibility. Existing maintenance routes must not become a generic experiment executor.
3. **Runner B — dedicated durable worker:** permits longer fit phases but provider, access, pricing, retention and operating ownership remain unspecified. No vendor selected or infrastructure provisioned. Need explicit choice only after measured fit/runtime requirements; costs are unknown, not assumed free.
4. **Operating plan:** exact concurrent jobs/workers, per-phase and run ceilings, retry/lease bounds, storage/retention, network/source limits. These cannot be inferred from existing cron configuration. No hosted capacity or pricing was queried.
5. **Scientific/pilot contract:** exact baseline and code pins, supported parameters/bounds, authentic snapshot sources, modes/refit schedule, chronological inner validation, cold-start/slices, event thresholds/populations, PR summary/log-loss convention, dependence-aware uncertainty, settlement/reveal rules. No unresolved statistical method selected here.
6. **Release C:** preserve all October 23–30 protected material and existing reveal process. Retained F6 metadata pins release `d4c2632d39ee8a59fa683f44a0e1d21c55db66bd` but explicitly has null/unverified first-issued/served times. October 23–29 is only a tentative seven-day window; October 30 is not a guaranteed reveal. Exact protection/reveal contract must be resolved before connecting real evaluation. This slice uses September synthetic dates only.
7. **Pilot authority:** separate exact data/runtime/budget authorization is still required. No production reads, capture, provider request, repair, fitting, deployment or pilot took place.

## First implementation slice

The four new files implement operational validation/projection and numeric input-field health, with 20 synthetic checks. Work progress uses declared stage denominators; unknown-total fitting has heartbeat/elapsed time only. Health distinguishes zero, missing/null, malformed, duplicate, stale, identity, units, strength and source mapping; future knowledge blocks, later/unknown captures remain reconstructed diagnostics. Clock presence alone never claims historical authenticity. Rechecks require distinct input/report IDs; raw source values never appear in diagnostic samples. No automatic exclusion or repair occurs.

These modules are building blocks only. They do not supply persistent immutable storage, atomic counter acceptance, authorization, complete cohort membership validation, lifecycle transitions, safe evaluation-outcome health, or a durable remote workflow. Outcome rows must never be sent to the input-only diagnostic adapter; outcome-derived counts can leak even when raw samples are omitted. The eventual server projection must enforce that distinction and reveal rules at every boundary.
