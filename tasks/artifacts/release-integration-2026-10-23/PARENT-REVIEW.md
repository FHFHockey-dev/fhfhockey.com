**Release-owner checkpoint for parent vetting — October 23**

No release commit or master push is ready. The canonical checkout remains `octoberBranch` at `2a5092d37cb863ec92a2a4e609999cf226bfa4a5`, with unrelated concurrent work preserved and no staged release files. This owner performed no Git mutation, deployment, live Yahoo/NST call, DB operation, migration application or credential/env change. Earlier review text is preserved as `PARENT-REVIEW.before-selected-decisions.md`.

The trusted Yahoo and selected Release C packets are independently accepted within scope. The composed checkpoint passes app TypeScript, scoped lint and fourteen route cases; final release acceptance remains open. Paths below are relative to `tasks/artifacts/release-integration-2026-10-23/` unless stated otherwise.

**1. Trusted Yahoo confirmations: implemented, independently accepted**

`trusted-yahoo/CANDIDATE.json` pins 15 paths, 14 changed; its unchanged hook test is included for provenance. Patch SHA-256 `7013599e82c6c2b8bc2512e3d95abd2b73db6d58c69c8e8c3456847c3030f001`; source archive `78e986e8b065e2c07cb971b6ae654f474b52545e5caf1856a33fe4bf5785214a`. Current canonical hashes still match.

The exact lease is the new Yahoo `planningConfirmations` helper/test and `planningConfirmationRoute.test.ts`; new `/api/v1/roster-schedule-optimizer/yahoo-current-data.ts`; currentPlanningRead, executionAdapter/test and new privatePlanningRead; new yahooPlanningReadBroker/test; rosterPlanningExecution, rosterPlanning.worker, useRosterPlanning and its unchanged test; one option line in RosterScheduleOptimizer.tsx. Full repository paths are in the manifest.

The private POST validates real Bearer authentication and existing provider-access policy, then checks owned account/team/league, season, exact game/team/player and current provider evidence. It uses one bounded current-roster resource, not the full planning snapshot loader or per-candidate provider reads. ProviderClient's existing one-time 401 refresh/retry remains; no new application retry loop was added. Cache age and provider Date reduce a maximum 120-second evidence lifetime. Invalid, stale, ambiguous or mismatched evidence is rejected.

The main-thread broker owns the authenticated fetch. It transfers an ephemeral MessagePort separately from request JSON, binds principal/team/range/timezone and nonce, checks session identity before/after the fetch and through computation, and cancels obsolete work. Tokens never enter saved snapshots or worker request JSON. Worker and fallback use the same adapter. The entire saved forecast graph is replaced; provider expiry is checked again before publication. A failed read preserves schedule, locks and manager intent without retaining old numeric authority.

Relevant source excerpts for review:

```ts
// web/pages/api/v1/roster-schedule-optimizer/yahoo-current-data.ts
const user = await requireApiUser(req, res); if (!user) return;
await requireProviderSyncAccess(user.id);
const current = await loadPlanningData(serviceRoleClient, query,
  { now, forgeDailyBridge: true, consumer: "rso" });
const { data, expiresAt } = await loadYahooPlanningConfirmations({
  db: serviceRoleClient, userId: user.id, teamId, leagueId, query, data: current, now,
});
```

```ts
// web/hooks/yahooPlanningReadBroker.ts
if (!session?.access_token || session.user.id !== principalId
  || closed || readController.signal.aborted) throw new Error();
// Only this broker sends the Bearer token to the fixed private endpoint.
// Its MessagePort, not serialized request metadata, carries the response.
```

Verified source-confirmed starting/not-starting can set 100%/0%. Unknown marks do not override. Existing trusted news likely/projected floors remain 80%/65%, preserving a higher prior; those are TJ-selected policy values, not calibrated probabilities. Conditional goalie abilities and legitimate zeros remain distinct from participation. Saved Yahoo labels alone cannot authorize changes. Native target reviews remain empty and Start Chart remains separate.

Evidence: 104 distinct passing cases across six files, scoped TypeScript pass, lint zero errors with six pre-existing RSO hook warnings reproduced on preserved baseline bytes. Tests include actual worker and fallback, positive 1/0/unknown, spoofed labels, missing runtime channel, wrong principal/scope/nonce, stale/revoked reads, expiry during computation, coalescing, logout, cancellation and token absence. No live Yahoo test occurred. Exact commands, earlier failed harness attempts, immutable source and remaining limitations are in `trusted-yahoo/REPORT.md`, `COMMAND.json`, `STATIC.json` and attempt receipts.

**2. Selected Release C restoration: implemented, independently accepted**

`selected-model-baseline/CANDIDATE.json` pins 15 changed files: nine source and six tests. Patch SHA-256 `fe0347df83454378072103b669bfee9a594fb69138215e281b5e9fac14f54c2c`; source archive `362c8020b99d5b7993d8c0028e6293ac588da1e62dfc76a4298dd28b75e41556`. Canonical pins and protected native/bridge dependencies match.

Production skater-stage restores Release C daily count/conversion/assist/bootstrap behavior and explicitly chooses legacy rest buckets. Conversion and assist k values return to Release C; shot priors remain unchanged. The producer stops claiming external-fantasy exclusion for legacy inputs. Public projection readers retain the released legacy contract and existing off-release/horizon fences. The native admission implementation and approval catalog are unchanged.

```diff
// web/lib/projections/stages/skater-stage.ts, production rest call
+ buckets: "legacy",
// web/lib/projections/run-forge-projections.ts, all three provenance sites
- buildForgeInputProvenance({ externalFantasyInputsExcluded: true })
+ buildForgeInputProvenance()
```

The public legacy API can return released estimates that do not meet native target evidence requirements. Those estimates are not requalified native forecasts. The actual reconstructed producer is rejected by the unchanged native consumer:

```ts
// web/scripts/qualify-native-players-offline.test.ts
expect(receipt.result.qualificationEligible).toBe(false);
expect(receipt.result.admission.exclusionCounts.use_not_approved).toBeGreaterThan(0);
// Every target must remain unadmitted; applicable admitted values must remain null.
```

The fifteen paths are skater-stage.ts, projection-weights.ts, run-forge-projections.ts, apiHelpers.ts, five forge/projections API routes, runProjectionV2.test.ts, apiHelpers.runAdmission.test.ts, nativeInputEligibility.test.ts, the forge players/goalies route tests, and qualify-native-players-offline.test.ts. Exact paths and before/after bytes are pinned.

Original verification was 416 pass/30 fail: 29 expectations depended on the newer producer/public-reader contract; one CLI receipt failed because the isolated export lacked Git metadata. Original tests/results are retained. Five test files now express the selected legacy contract and require native rejection, while preserving cutoff, missing-participation, immutable-receipt and no-network controls. All 108 affected tests pass. The harness supplies only read-only origin metadata for two Git lookups, without GIT_DIR or Git mutation; source hashes identify the tested overlay.

Deduplicated evidence is 449 passes: 108 final cases, 338 unchanged earlier cases and three parity cases. Parity covers the actual Release C prior objects, 98 rest combinations, twelve goal-conversion and twenty-four assist-share combinations. Dynamic shot-rate parity was not tested. Final scoped types/lint, diff check and reverse patch dry-run pass. This is compatibility evidence, not model accuracy validation or historical requalification. Full diff/commands/results are in `selected-model-baseline/REPORT.md` and its manifests.

**Other owners and remaining gates**

- Billing correction is independently accepted locally per the parent's receipt: 320 initial tests, then 36 component and three adversarial cases; all 35 current pins match. Inventory: `tasks/artifacts/billing-sales-rollout-2026-10-23/account-rollout-correction/CANDIDATE.json`. Default-off enforcement, new Draft Pro checkout closure and existing entitlements are separated. Previously issued Stripe checkout links remain unverified and untouched. This owner inspected the core server/client behavior diff: unconditional new-sale closure, existing grant/recovery paths and separation of rollout permission from membership. Whole-release acceptance remains separate.
- Game Grid r5 is independently accepted for local integration at packet `526714310534287ee87867c2e4c80ece7d0b5c1f99bd7c6bc51a42b4c47c0056`. All 26 canonical pins match; only SCSS and preview-test paths differ from r4, with 24 unchanged. Independent six-viewport Chromium execution passed with no failures, skips or drift; fresh desktop/mobile pixels were inspected. Desktop title/control heights match, forecast controls are right-aligned and full-bar navigation stays centered. TJ separately accepted the actual r5 screenshot. `game-grid-r5-review/REPORT.md` and `FINAL.json` bind the exact decision and limits; earlier r4 receipts remain immutable.
- News serialization P2 is independently closed with qualified local acceptance relayed by parent: nine original cases and ten actual loader → JSON → homepage checks pass. Current six-file manifest is `/Users/tim/Documents/Codex/2026-10-23/task-4/evidence/attribution-serialization/CANDIDATE.json`; all six canonical hashes and both patch hashes were verified by this owner. Complete patch `25f3b2053eed4c3401a882a6b3c808fedd7787c5097bba72d1555f963e753c9c`. The versioned display attribution preserves rejection across repeated sanitization; the raw loader recomputes from fresh evidence. This owner inspected the correction. Metadata sync loss, the accepted-public-claim producer/loader contract and incomplete duplicate original-source identity remain separate open issues. Distinct rows and claim-validation authority are preserved. `NEWS-SERIALIZATION-ACCEPTANCE.json` records the exact evidence scope.
- The baseline identity three-file packet remains preserved and locally accepted. A1–A10/NST/P07/task10 and other historical acceptances are still tied to their exact pins, not to every current file automatically.
- I read Claude's D4 local replay receipt. It reports the 99-entry chain and intended negative failures passing, with identical final ACLs across supported order/reapply cases. It used local PG17 and documented extension stand-ins; hosted PG15 state is not thereby verified or changed. SQL relocation is approved; no migration application is authorized.
- I read the browser handoff. Its harness is ready but has no release SHA. Validation on HEAD found 41 failures in the repository's RSO E2E spec due to obsolete selectors/UI expectations. This is not a candidate test result; the unchanged spec needs reconciliation before final acceptance. No new Claude task or expanded follow-up was dispatched. Existing browser acceptance needs the exact frozen commit and server-confirmed Yahoo mocks, including Bearer session, scope/nonce and expiry; no real Yahoo access.
- Both new packets have independent scoped acceptance. Parent final review, explicit source/privacy composition, RSO fixture reconciliation and exact-SHA browser acceptance remain pending. Combined checkpoint type/lint passed with the precise limits below. There is no unresolved product choice for the already selected Yahoo/default-off billing/SQL relocation/HOLD restoration/hybrid timing; these are implementation and acceptance gates.

**Exclusions and publish safeguards**

Held Q7/Q8/aligned-count experiments, hybrid k-refit and experiment U/UK branches stay out. Standalone helper availability is not runtime enablement. Optional RSO fingerprint optimization, SoS research-only work, unreviewed gate-kit changes, private league exports, credentials, diaries and unapproved SQL are excluded from application assembly. No blanket staging or wholesale October-branch merge is appropriate; local research remains preserved. The selected baseline remains Release C and its evaluation window does not restart.

Remote master was last observed as `d4c2632d39ee8a59fa683f44a0e1d21c55db66bd`; re-read before publishing. Four linked Vercel projects were inventoried: web, functions, CMS and legacy root. Recheck exact-SHA deployment state and the expected builds/ignored entries before a single authorized normal master push. Do not create duplicate builds or silently change project settings. Final parent acceptance and the frozen commit identity precede that push.

Rollback planning must preserve the last known-good Release C SHA and existing entitlements, without DB/env/cron changes or force push. No rollback/redeploy is executed here. Post-deploy verification should first use deployment metadata for the exact SHA, then at most five declared sequential read-only smoke requests; stop on a conclusive result or failure. No Yahoo sync/private-provider read, cron, ingestion, capture or repair is a smoke test.

Next safe action: receive the assigned RSO fixture candidate, then finalize only the accepted exact composition. Source archives are reproducible test snapshots, not Git commit SHAs. No frozen release SHA is available to give Claude yet.


**Recovery and composition checkpoint, 15:18 UTC**

Read and verified independent Yahoo acceptance (58 distinct selected cases, 21 new adversarial; all 15 source plus three baseline-identity pins unchanged) and selected-restoration acceptance (108 affected + nine unchanged boundary controls; restored behavior, not model qualification). Exact receipt paths/hashes are in `combined-validation-v1/REVIEW-RECONCILIATION.json`.

The new frozen verification archive has 3,468 files and 105 overlaid pins, SHA256 `8569002be726f846a94a05946b9112fe634e007c3b3fb764aaec3a26c818e4a7`. App TypeScript passed with the existing 8 GB setting after a preserved default-heap failure. Scoped lint passed with zero errors/eight recorded warnings. Two route suites passed together: 14/14, no skips. Source hashes did not drift. `combined-validation-v1/REPORT.md` and command/result manifests give reproducible scope and limitations. No full suite was repeated.

TJ requested Grid r5 after r4 acceptance. The existing owner retains only GameGrid.module.scss and game-grid-previews.spec.ts for that narrow refinement; this checkpoint retains r4 and cannot be labelled the final visual candidate. News re-review and RSO fixture reconciliation also remain open. No new source edit, Git/index mutation, production request or deployment by this owner.

Final shared-tree check: Grid r5 CSS/spec and the news source/test pair have advanced beyond this frozen checkpoint. Exact tested/current hashes are in `combined-validation-v1/END-INTEGRITY.json`. No unexpected changes were absorbed or overwritten. The new news pair needs its superseding receipt.

News gate clarified from the15:21UTC ledger receipt: independent review is BLOCKED, with seven direct-source checks passing and two serialization failures. Second sanitization can revive a rejected quote-author conflict or lose a valid provenance-only author. NEWS owns the correction and BILLING-REVIEW owns rechecking the actual double-sanitization path; sync metadata loss remains separate. Grid r5 remains active/unaccepted. The selected Release C acceptance is unchanged.


**Current RSO blocking checkpoint**

The new two-rule command-bar CSS patch26764c95 (sourceee4dcb45) passed actual Sass/isolated Chromium at six widths with original overflow reproduced, twelve normal action clicks and zero requests. Worker reports original application1180×757 Refresh/Save, permissions/exclusions and account-switch cancellation now pass. Later Continue manually is blocked by another notice overlay; full account-case acceptance remains open. Three reconciled summary-card and three category cases pass. The original44-case16pass/28nonpass and later focused7/17,8/10 receipts remain separate; no combined all-green claim. Candidate999 scored-point and savedmanualasOf contracts require bounded source adjudication; <=1px alignment failures remain unrelaxed. No final release SHA or push. Exact CSS receipt: rso-command-bar/CANDIDATE.json and RESULT.json.
