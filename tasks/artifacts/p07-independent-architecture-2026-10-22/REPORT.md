# P07 independent architecture finding

**Hold P07 integration. Recommend fresh server rebinding at the quantitative execution boundary; no signing secret, schema or new database storage is required.** Saved/offline manager work remains usable for schedule capacity; saved forecast claims must not become current numeric authority.

Reviewed branch `octoberBranch`, HEAD `67b9efda5901a5f8c25a25889572e85527056f7a`. All 17 candidate source/test hashes matched at start. `START-HASHES.json` also pins eight caller/transport/instruction files. All25 reviewed files remained unchanged at the final check, although concurrent HEAD advanced to `d77602cf7fbdd4549588127603ebf0b535138b99`. Final comparison is in `END-HASHES.json`. This is an architecture review, not approval of the complete candidate.

## Findings and actual boundary

1. **P1 / confirmed / high confidence — saved metadata can impersonate approved bridge selection.** `web/lib/player-forecasts/rsoUsePolicy.ts:97` returns a raw row unchanged when its revision appears in the supplied bridge list. Lines111–112 similarly exempt retained detailed inputs. The independent original C08 oracle fails: expected totals false, received true. The other17 policy tests pass. Impact is unreviewed numerical evidence being permitted in RSO; this test does not demonstrate an account-access or private-data leak. The packet was already held for this defect; no claim that it is deployed.

2. **P1 / inspected architecture — ownership and transport do not repair provenance.** Public `data.ts:18` calls trusted selection/admission, with private/no-store at21; `rosterScheduleData/planning.ts:183` selects bridge only under existing legacy/absence/opt-in conditions, before the target gate at202. These are useful boundaries. But `workspace.ts:144–155` validates and stores the submitted snapshot and its permissions; GET at140–142 returns that payload. Ownership/authentication protects the account record, not model provenance. `RosterScheduleOptimizer.tsx:599` directly returns `account.snapshot` for saved view. The hook passes the whole snapshot at `useRosterPlanning.ts:22`; the worker calls the planner directly at `rosterPlanning.worker.ts:5`, and fallback does so at hook:28. JSON schema validity, a revision prefix, public content hash, matching model label, client boolean or fresh-looking timestamp cannot upgrade this payload.

3. **P1 acceptance scope / code-observed, not separately rendered — worker-only enforcement is incomplete.** `CompactSchedule.tsx:254–255` and `RosterScheduleOptimizer.tsx:1183–1185` call the contribution resolver without `consumer: "rso"`; the gate only executes for that explicit consumer (`planningContributions.ts:43–49`). These paths render goalie starter/evidence information. Both must use the same admitted in-memory view, or an RSO resolver with the same authority. Simply adding the flag is insufficient while the forged bridge exception remains. This review did not run a UI exploit or browser test.

## Smallest trustworthy correction

**Keep selection on the current server; rebind in a single RSO execution adapter before planning.** The adapter must own the same-origin, no-store GET to the existing public `/api/v1/roster-schedule-optimizer/data` contract. The browser worker invokes that adapter itself, as does the no-worker fallback. It must not accept an authority-bearing response/allowlist supplied inside a worker message or saved snapshot. Keep the planner local; no new server-side optimizer endpoint or private league upload is needed.

- Treat all loaded/imported/preserved snapshots as manager/provider context, not forecast authority. Before quantitative work, replace the whole forecast input graph from the actual current server response: raw/resolved forecasts, detailed/participation inputs, baseline and participation source arrays, forecast manifest and forecast-specific exclusions/evidence. Never combine client-owned numeric values with server-approved revision IDs or bindings. Native rate/model paths remain usable when present in the fresh admitted response.
- Preserve roster, rules, legal slots, manager locks, selected intent, realized totals and explicit manager matchup inputs in their existing roles. Preserve provider ownership and synchronization checks; the public rebind requests only season/range/time-zone, never account/league IDs, credentials or provider POST. Keep existing identity/revision admission when joining fresh forecasts to retained schedule/provider context. A mismatch stays unavailable; do not silently rewrite historical context to make a forecast match.
- Within the execution adapter, create runtime-only authority from the response it fetched, bound to the complete fresh input graph and current run/context. Bridge authorization comes from that live trusted selection, not from an arbitrary supplied revision list. No generic exported "trust this JSON" constructor, serialized trusted bit, or caller-supplied policy can grant authority. Keep `restrictRsoForecast`/untrusted resolver default-denying; pass any internal capability outside `PlanningSnapshot`. A realm-local identity/capability must be minted again after the worker fetch, never treated as authenticated after structured clone.
- Return an admitted display view together with the plan result. All numeric/evidence consumers, including the two goalie callers, use this view. Raw saved inputs remain available for preservation/download but cannot be rerun or displayed as newly authorized forecasts.
- Decode/expand only the actual live read inside that boundary. Keep the existing compact bridge wire and four-million-byte response budget. Saved bridge wire remains a lossless representation, not a permission receipt. Keep the approved bridge's exact existing selection conditions and explicit `start_chart` caller in `gameExpectationReader.ts:31`; do not broaden or remove either.
- Failed/aborted/mismatched/unavailable reads produce schedule-only capacity with forecast quality unavailable. They must not fall back to old numeric evidence. `refreshForecastInputs.ts:15` currently returns the old snapshot when a rebind is rejected, so it is not a sufficient security boundary unchanged. A strict adapter must distinguish rejected refresh and clear authority.

**Read/revocation budget:** one bounded current public read per quantitative execution generation, shared by the plan and its display evidence; coalesce simultaneous work, abort obsolete work, use existing deadline/response/range limits, and do not retry/poll or call provider refresh. Refactor the current component read at391–406 to avoid a second full read for the same generation. Do not put a fresh GET inside every candidate/search iteration. Keep private preserved work offline without forecasts when reads are suspended.

A fresh read establishes permissions as of that server evaluation, not instantaneous future revocation. Recheck source/review expiry at consumption, reject old/mismatched policy versions, and invalidate obsolete generations. Strict revocation before a later quantitative execution requires another current read. If the lead wants cached reuse across later edits/runs to reduce requests, it must specify a bounded accepted revocation lag and verify that bound; no unbounded caching or claim of immediate revocation is justified. Numeric work while completely offline cannot discover new server revocations.

## Exact implementation authority / coordination

Root must assign one lead and extend the19-file lease before edits to:
- `web/hooks/useRosterPlanning.ts`, `web/hooks/useRosterPlanning.test.tsx`;
- `web/hooks/rosterPlanning.worker.ts` and a narrowly scoped worker/adapter test;
- `web/components/RosterScheduleOptimizer/RosterScheduleOptimizer.tsx`, its existing component test;
- `web/components/RosterScheduleOptimizer/CompactSchedule.tsx`, its nearest test if changed;
- one focused RSO current-read execution module/test, and `refreshForecastInputs.ts` only if adapting it instead of isolating strict admission.

Coordinate exact test paths and any shared component ownership before editing. Reuse existing P07 policy/planner/data-route leases. Workspace persistence, preservation code and bridge wire should remain byte-preserving and normally need no edits. No new capability/entitlement, provider request, production catalog approval, database migration or secret is needed for the recommended local correction. No implementation is authorized by this review.

If authoritative offline quantitative replay is a non-negotiable requirement, the recommendation cannot fully provide it. Then request explicit authorization for a dedicated server signing key and rotation/public verification contract (or a separately designed trusted server receipt store), exact signed payload/scope/expiry and a bounded revocation policy. Existing Supabase/provider credentials must not be repurposed. Even signatures alone cannot provide instantaneous offline revocation. Do not create that infrastructure speculatively.

## Independent acceptance gates for the correction

- Original C08 remains unchanged and passes; add retained-contribution and packed saved-snapshot variants.
- Forge every saved permission/binding/bridge field, remove bindings, transplant an approved revision onto changed target means/participation or another game/player/range. They cannot alter the current admitted graph or grant use.
- Genuine current bridge still works under legacy/absence/opt-in; native permission denial never triggers bridge; future/revoked/expired/mismatched/ambiguous scopes stay denied per target/use. A positive native adapter stays held until authentic configuration/artifact identity exists.
- Mock the actual GET boundary, not a trusted-JSON factory. Cover saved GET/PUT round trip, provider retained fallback, preservation suspension and offline/error/rejected refresh. Manager capacity, locks, intent and realized inputs survive.
- Worker and fallback produce the same results; two display callers cannot expose denied numeric/evidence inputs. Account/range/intent/read-generation switches and late responses do not restore stale authority.
- A fresh read after revocation removes old permissions. Source/review expiry invalidates a running/cached result. Verify the selected reuse budget explicitly.
- Show one bounded read per generation and no provider calls, no candidate-loop reads, no added private URL fields, response/wire limits intact, Start Chart unchanged.

## Verification and limits

Independent Node22.11.0/npm10.9.0 run in a private scratch tree with network functions blocked: **17 passed, 1 intentionally failing C08 oracle**. Exact commands/log in `COMMANDS.md` and `offline-policy-oracle.log`. Current caller traces and hashes were read offline. No application edits, network/service/DB calls, credential access, installs, browser execution, commits or deployment. The owner541-pass/type/lint receipts were read, not rerun or relabeled independent. No full security audit, production-state proof, cost measurement or predictive/model qualification is claimed.

Review is complete; implementation, ownership assignment and independent fixed-candidate acceptance are separate. No tool action was denied, pending or uncertain. P07 integration remains blocked by the demonstrated C08 defect and the unimplemented authority correction.

