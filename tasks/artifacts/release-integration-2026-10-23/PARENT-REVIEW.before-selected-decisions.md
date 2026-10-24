# Release integration review checkpoint — October 23

**No master push is ready.** The current shared checkout is `octoberBranch` at `431ffcd673b42ad4a149dc3f9dfb03005dbec75a`. This packet records verified fixes, exact draft composition and remaining acceptance decisions; it is not an aggregate-test-count release approval. No release-owner Git mutation, deployment, production application request, provider call or DB operation has occurred.

## Identities and custody

- Live remote master was read as `d4c2632d39ee8a59fa683f44a0e1d21c55db66bd` (Release C); local master `457435eb3010c5b3dd92d2e1a46d9c75d851780a` is stale. Live remote octoberBranch was `782805fee6fe241c53341fb89a0809e04f601cd0`. Re-read remote master before any eventual publish.
- Another owner committed Game Grid as `431ffcd673…`; its 27 files matched the release task's initial source snapshot exactly (`CONCURRENT-COMMIT.json`). The new 13-file correction is uncommitted and independently accepted for scoped integration. A fresh lead comparison found zero drift across all 35 reviewed paths (`GAME-GRID-ACCEPTANCE.json`).
- The ledger owner retains the exclusive docs/index window, now expanded to the Claude unfinished-work review, RSO/FORGE handover, individually screened forge-gate-kit files, and LEDGER.json/LEDGER.md. Screening and explicit-path staging belong to that owner; this task does not claim that screening is complete. Release has not staged anything and will not mutate Git before that window is released. Shared application edits remain preserved.
- The Claude review was actually read in full: 190 lines / 23,735 bytes. Its SHA and all current packet comparisons are in `PARENT-REVIEW-PINS.json`.
- After Game Grid acceptance, TJ assigned its existing UI owner a separate follow-up: remove Game Grid's SurfaceWorkflowLinks and stabilize desktop/mobile loading without the full-width 4WG flash. The accepted 13-file packet remains versioned and preserved. The new work is not covered by that acceptance; page/component/E2E ownership remains with that owner, with no conflicting release edit. Do not commit or pin the moving canonical Grid tree as if it were the accepted packet.

## Concrete changed behavior

| Packet | Exact delta / evidence | Assessment |
|---|---|---|
| Yahoo authority correction | `confirmed-news-correction/CANDIDATE.json` pins currentPlanningRead.ts, executionAdapter.test.ts, forgeDailyBridge.test.ts; full delta `packet.patch` | Removes one call that trusted serialized provider labels before minting runtime authority. Fresh server-confirmed 1/0 remains intact. Positive Yahoo confirmation support still incomplete. |
| Baseline participation identity | `../rso-correctness-2026-10-23/CANDIDATE.json`, `baseline-identity.patch` SHA `ff7ef648a48d2a65d6f3fe2f891c37d743576b69f7ae13aeb2e1a61da6f50659` | Three files; preserves issued model identity and participation cutoff when baseline means replace detailed means. Original failing oracle is now an ordinary passing test. |
| Game Grid correction | `/Users/tim/Documents/Codex/2026-10-22/task-3/evidence/release-fixes/CANDIDATE.json`, patch SHA `e7b43c8894d7a30af1faa1fa487caccc4d684e9dae8ba09cc23fe2baef160b66` | ACCEPT for scoped integration. Independent 15 unit/7 Chromium cases pass; all 13 patch files match and all 35 reviewed paths remain stable. No publishing approval implied. |
| Held model preservation | `production-model-prototype/MODEL-HOLD-PINS.json`, `model-hold.patch` SHA `21ec95351084069548f15413d3224fdf44af3d99a30aebd771e02734a08b20cd` | Eight-file isolated draft, zero canonical model edits. Preserves approved daily producer/legacy reader behavior rather than activating held Q8/aligned-count changes. Not yet a releasable composition. |

The eight model paths are skater-stage.ts, run-forge-projections.ts, apiHelpers.ts, `/api/v1/forge/{players,goalies}.ts` and `/api/v1/projections/{players,goalies,teams}.ts`. Standalone research helpers remain available in the draft, but their presence does not qualify or activate native model output. `production-model-prototype/FOLLOWUP-HOLD.md` describes the incompatible positive qualification fixtures and later hybrid-timing gate.

The reproducible model/source draft archive remains `production-model-prototype/draft-source.tar.gz`, SHA `1f8d472f70682d07b0c6b0d6aca8ad278e2c411c740295e88066cd7c5376d1c5`, 3,684 files. It predates the latest Game Grid correction and confirmation-test extension; do not call it the final combined candidate.

## New Claude custody handover mapped to existing work

I read `tasks/artifacts/cross-platform/2026-10-23-claude-to-codex-rso-forge-handover.md` in full. Ownership transfer does not settle release or product decisions and does not authorize captures.

- **R1:** maps to the pinned Yahoo current-read correction and confirmation controls above. Spoofed/saved labels cannot mutate forecasts; actual trusted Yahoo quantitative integration remains absent. Its private-read proposal is reviewed as a direction, not accepted implementation. No duplicate R1 worker or source lease was started.
- **R4:** maps to the completed three-file baseline fix. The former unchanged `it.fails` oracle passes as an ordinary test, with newer-cutoff and negative controls. Preserving issued identity in the rebuilt row and consulting its participation cutoff resolves the reproduced defect without the handover's proposed new receipt/save-schema fields. No schema change is needed for this demonstrated case.
- **F7:** maps to `unreleased-skater-*.patch` and the isolated eight-file `model-hold.patch`. The latter is a production-behavior-preservation draft, not two accepted revert/flag alternatives. No canonical model edit occurred. The durable revert-versus-flags choice remains pending, as do final producer/native-qualification compatibility and hybrid timing.

The ledger owner is reconciling R1–R7/F1–F10 and the gate kit. This task has not launched new handover work. Each model capture still requires explicit TJ approval per test; baseline recapture is not authorized by access to the gate kit. Browser runs and D4 replay remain in the designated Claude lane; no live Yahoo league operation is authorized.

## Lead review of worker work

I inspected the actual baseline diff and its control assertions. Retaining original model identity is limited to borrowed, unmodeled issued participation; rate policy identity stays in the per-target inputs. The policy compares that participation's own cutoff rather than a newer aggregate baseline-rate cutoff. Detailed-source binding and explicit modeled participation retain their existing paths. Negative controls deny revoked/expired reviews, changed model/cutoff/artifact, altered participation identity, missing bindings and revoked revisions. A target/use-specific zero control preserves legitimate zero without opening comparison permissions. No schema addition or production review-catalog entry was introduced. All three hashes still match the worker receipt. This is a bounded source/receipt review by the integrating lead, not a claim of a new full-suite run.

I inspected Game Grid's real implementation, not only the reported counts. Portal containment includes the visible card and gap; Escape/outside focus/pointer closes it. The new shared-read cache is limited to public teams/schedules, has per-subscriber cancellation, removes an obsolete pending owner by identity, and refuses to retain cancelled/late results. Odds-bearing windows can satisfy raw readers; raw results cannot satisfy an odds request. Hooks abort their subscriptions and check obsolescence before continuing the chain. Conditional odds upgrade on 7→10 days is explicit. The independent reviewer now verifies the unchanged original-card-ID oracle, above-trigger gap traversal, keyboard/touch dismissal, cancellation/replacement races and slow-reader behavior. I read that full receipt at `/Users/tim/Documents/Codex/2026-10-23/task-2/review-r1/REPORT.md`; SHA `a09799aaf28196c0224015fc2a1099d405adb0b423c72e4ac93a07fa6581d569`. Its 13 packet pins and all 35 scope pins still match canonical. The reviewer normalized only the isolated browser port from 3112 to 43113.

No changes were made to these workers' files during review. Their exact pins and no-drift comparisons are attached, rather than inferred from commit names.

## Scoped source excerpts for parent inspection

These are the relevant source hunks, not a replacement for the complete pinned patches. Paths are relative to `/Users/tim/Code/fhfhockey.com`.

`web/lib/rosterScheduleOptimizer/currentPlanningRead.ts` removes the saved-label transformation immediately before runtime authority is constructed:

```diff
-import { applyProviderGoalieStarts } from "./providerGoalieStarts";
 const forecasts = [...decoded.forecasts, ...expandBridgeForecasts(body.bridgeForecasts, decoded)];
-data = { ...decoded, forecasts: snapshot.context.provider === "yahoo" && !options.publicContext
-  ? applyProviderGoalieStarts(forecasts, { marked: snapshot.players, catalog: decoded.players, games: decoded.games,
-    bridgeRevisionIds: new Set(policy.bridgeRevisionIds), now: evaluatedAt }) : forecasts };
+// Saved/provider snapshots can carry Yahoo labels, but serialized marks are
+// not current server evidence and cannot change rows before authority is minted.
+data = { ...decoded, forecasts };
```

The unchanged server bridge still applies accepted `confirmed` as 1 and `ruled_out` as 0. The removed call is specifically the transformation based on serialized snapshot players. Implementation SHA: `9f2f29c50a6af4e7d6c12265e4ed1552ffa52e79b171f568cf7230aac046daab`. Tests are in `web/lib/rosterScheduleOptimizer/executionAdapter.test.ts` and `web/lib/rosterScheduleData/forgeDailyBridge.test.ts`.

`web/lib/player-forecasts/resolvedPlanningForecast.ts` preserves the issued identity when a baseline borrows its participation:

```diff
-modelVersion: sources.find(source => source.kind === "detailed")?.policyVersion ?? sources[0]?.policyVersion ?? original.modelVersion,
+modelVersion: sources.find(source => source.kind === "detailed")?.policyVersion
+  ?? (participation.some(row => !row.model) ? original.modelVersion : sources[0]?.policyVersion ?? original.modelVersion),
```

`web/lib/player-forecasts/rsoUsePolicy.ts` binds that borrowed participation to its own cutoff:

```diff
-const source = forecast.contributions?.[target]?.inputs?.detailed;
+const inputs = forecast.contributions?.[target]?.inputs;
+const source = inputs?.detailed;
+const participation = inputs?.participation && !inputs.participation.model ? inputs.participation : undefined;
 const bound = binding?.targetKey === target && binding.codeVersion === (source?.policyVersion ?? forecast.modelVersion)
-  && binding.cutoffAt === (source?.cutoffAt ?? forecast.cutoffAt);
+  && binding.cutoffAt === (source?.cutoffAt ?? participation?.cutoffAt ?? forecast.cutoffAt);
```

Their respective SHAs are `f6304a1e1bff4a0ad20a8177b9e2cfc17a193761c0d9edce07cebd6e7a6b4d07` and `3130a3cfb2bd028af42d0dc4a6bdaa72935a08823dc185aceaf830f330eb3215`. Tests are in `web/lib/rosterScheduleOptimizer/planningReproducibility.test.ts`, SHA `dc4e9bcacd4e5ece49d8a26469b61af7c7005275a69a1b6f27e4ba8cd5fbf60c`. No catalog reviews are added.

Game Grid's accepted `web/components/GameGrid/OpportunitySparkline.tsx` uses trigger-plus-card containment and explicit interaction state:

```tsx
const contains = useCallback((target: EventTarget | null) => target instanceof Node &&
  Boolean(trigger.current?.contains(target) || card.current?.contains(target)), []);
const leave = (target: EventTarget | null) => {
  if (contains(target)) return;
  hovered.current = false;
  if (!keyboardFocused.current && !pinned.current) setOpen(false);
};
```

Its SCSS makes the six-pixel gap part of the hit-tested card region, rather than exposing the row underneath:

```diff
-.card {
+.cardRegion {
   position: fixed;
   z-index: v.$mobile-z-index-modal;
   box-sizing: border-box;
   width: 236px;
   max-width: calc(100vw - 16px);
+  padding-block: 6px;
+}
+.card {
+  position: relative;
-  pointer-events: none;
```

The accepted public schedule client keeps odds-bearing and raw variants distinct in `web/lib/NHL/client/index.ts`:

```tsx
const oddsPath = `/schedule/${startDate}`;
// A complete odds-bearing window also serves fixture-only readers, never the reverse.
const path = includeOdds || scheduleReads.has(oddsPath) ? oddsPath : `${oddsPath}?includeOdds=0`;
return scheduleReads.read(path, signal => get<ScheduleData>(path, signal), opts.signal);
```

`web/lib/NHL/client/sharedRead.ts` releases a subscriber without aborting other readers, and checks ownership before removing the pending request:

```tsx
shared.subscribers--;
if (shared.subscribers === 0 && pending.get(key) === shared) {
  pending.delete(key);
  shared.controller.abort();
}
```

The full 13-file correction also includes `web/components/GameGrid/utils/useFourWeekSchedule.ts`, its test, `useSchedule.ts`, `web/hooks/useTeams.ts`, `web/e2e/game-grid-previews.spec.ts`, `sharedRead.test.ts`, `client/index.test.tsx`, and `web/lib/dashboard/clientFetchCache.ts` with its test. The last cache now prunes expired entries and caps completed entries at 64; pending requests remain separate. The accepted complete patch, not these excerpts, is the reconstruction authority.

## Tests and controls actually run

All local JS checks used Node22.11.0 and npm with existing dependencies, isolated source, environment-file loading disabled, synthetic configuration and denied network. Counts below overlap and must not be summed into one release total.

| Selection | Result | Reproduction record |
|---|---|---|
| Current audit/integration boundary, eight files | 340/340 pass; old 13 fixture failures and warm-cache issue no longer reproduce | CURRENT-COMMAND.json, current-boundary-tests.json |
| New serialized Yahoo authority oracle | Original: 1 control pass / 2 unsafe cases fail. Fixed focused selection: 73/73 pass | provider-start-authority.test.ts, provider-start-authority.json, PROVIDER-CORRECTION-COMMAND.json, provider-authority-fixed.json |
| Native/serving/planning/migration selection | 482 pass / 1 harness failure; private-export output was incorrectly under isolated repository | VERIFICATION-COMMANDS.json, release-gates.json |
| Corrected export harness, TMPDIR outside source | 104/104 pass; product guard unchanged | START-CHART-RECHECK-COMMAND.json, start-chart-export-recheck.json |
| Full application typecheck on original frozen current snapshot | Pass: `npm exec --offline --no -- tsc --noEmit --incremental false`; not a claim about later combined edits | current-types.log, VERIFICATION-RESULTS.json |
| Latest trusted confirmation/bridge tests | 42/42 pass, including 11 new positive/negative controls; scoped TS and lint pass | confirmed-news-correction/COMMANDS.json, tests.json, TYPES.json, lint.log |
| Existing functions contract | 58/58 pass with isolated Python/network guards | FUNCTIONS-COMMAND.json, functions-contract.log |
| Baseline worker selection | 392 distinct tests/11 files, scoped TS/lint pass; hashes matched during lead review | ../rso-correctness-2026-10-23/CANDIDATE.json |
| Independent Yahoo source-to-worker follow-up | Settled-policy 16/16 pass, including 0.9 prior remaining 0.9 under either floor. Historical 12/2 receipt preserved; parser 3 pass / 75 intentionally skipped | ../rso-correctness-2026-10-23/settled-policy-review/REPORT.md and CANDIDATE.json |
| Game Grid worker and independent reviewer | Worker: 49 unit/5 Chromium, scoped TS/lint pass. Independent: 15 unit/7 Chromium pass, ACCEPT; counts overlap | External release-fixes packet and review-r1/REPORT.md above |
| Model preservation draft | Scoped/full draft types pass; iteration2 had 292 pass/3 constant expectations fail; five selected checks passed after hybrid overlay, not a full rerun. Earlier 10 native positive fixtures remain incompatible with legacy producer | production-model-prototype iteration logs/receipts and FOLLOWUP-HOLD.md |

The Yahoo positive controls demonstrate accepted server `confirmed`→1 and `ruled_out`→0, contradictory browser marks ignored, conditional saves/GA unchanged, and expected totals scaled once. Unknown, stale, unaccepted or mismatched evidence is rejected. TJ subsequently explicitly selected the existing likely 80% / projected 65% floors. Those are chosen policy values, not empirically calibrated probabilities, and do not become confirmed status. The separate artifact's two unchanged-prior failures remain historical scope evidence; they are superseded as acceptance requirements by this decision. The reviewer updated only artifact expectations and added higher-prior controls: 16/16 now pass. Current source and the release owner's existing passing controls already matched the selected policy, so no application change or release-owner test rerun was needed.

Exact latest focused commands, run from the isolated snapshot's `web/` directory using its network-denial environment:

```sh
npm test -- --run --config audit.vitest.config.mts lib/rosterScheduleData/forgeDailyBridge.test.ts lib/projections/dailyBoardEvidence.test.ts --reporter=json --outputFile=/Users/tim/Code/fhfhockey.com/tasks/artifacts/release-integration-2026-10-23/confirmed-news-correction/tests.json
npm exec --offline --no -- eslint lib/rosterScheduleData/forgeDailyBridge.test.ts
npm exec --offline --no -- tsc --noEmit --project audit.confirmation-tsconfig.json
```

The first command executed 42 cases in the bridge file. The second named test path does not exist; no test execution is claimed for it. Full arguments, environment, snapshot pins and actual results for all other selections are in the command/receipt files listed above. No tests were repeated merely to update this review packet.

## Blocking decisions and exclusions

1. **CR-TJ-03, trusted Yahoo source:** the public generation read has no fresh authenticated Yahoo receipt. `confirmed-news-correction/REPORT.md` proposes the smallest bounded private generation read and identifies the Bearer-auth/worker transport constraint. No new implementation or provider requests were made. Existing E2E expectations that saved labels change probabilities cannot be accepted as-is.
2. **CR-TJ-04, paid sync:** confirmed in providerSyncAccessServer.ts and the Yahoo/Fantrax call sites. Shipping current gates denies free sync; billing purchase availability is a separate unresolved product decision. Do not silently choose a kill flag, exclusion or paywall behavior.
3. **CR-TJ-02, SQL relocation:** the accepted byte-preserving relocation restores 99 active/99 registered migration sources. Current review explicitly requests TJ's decision before release inclusion. No migration application is authorized or attempted; unknown/pending registry entries are not grants to apply them.
4. **CR-TJ-08 and held models:** hybrid prior release timing is pending. Q8 rest, Q7/per-goal/ES/PP held experiments and skater aligned-count changes must not be reactivated by merging the branch wholesale. Final producer/native-qualification compatibility is still unresolved; the strict empty native review catalog remains.
5. **Independent acceptance:** Game Grid's original blocking review is superseded by the accepted 13-file correction at the checked hashes. Its newly assigned loading-shell/link-removal follow-up needs its own pinned packet and independent review. Claude-lane CR-REL-04 browser acceptance for P07/task10/P04 remains pending. The nonblocking Game Grid Info palette-copy mismatch and one odds-bearing 7→10 upgrade request remain documented limits.
6. **Release composition/privacy:** the branch contains thousands of task/artifact changes, private-evidence candidates, diary files, dependency cache/output and unqualified research. NONRELEASE-CATEGORIES.json is a filename classification, not a secret-scan clearance. Do not blanket stage or merge. A final explicit source-path manifest and provenance/exclusion check remain necessary; existing private exports, secrets and unapproved SQL must not ship. Preserve their local bytes/history; no destructive cleanup or history rewrite.

The new Claude section3 queue has not been dispatched by this task. D4 replay/browser ownership stays with the parent-designated Claude lane, and hosted 89→90 application remains a separately authorized action before October30. No broader migration, cron, credential, provider, billing or model-gate authority is implied.

The parent's later optimization handoff (`/Users/tim/Documents/Codex/2026-10-23/task/artifacts/OPTIMIZATION-HANDOFF.md`) is retained as a separate optional proposal. Its RSO two-file patch has not been integrated or accepted by this task; reported performance results are not release evidence until reviewed. It shortcuts fingerprints only for identical deep-frozen original rows, not all input preparation. Parent review still requires proof of deep immutability, expiry/revision checks, scope restoration and shared-statline collision safety. The competing Grid helper patch is excluded; the Game Grid owner's independently accepted 13-file candidate is the sole Grid candidate. Optional performance work need not hold an otherwise safe essential release.

## Explicit decisions requested through the parent

These questions come from the supplied Claude review's section2 and the concrete authority gap above; they are not a request to repeat approval for ordinary local fixes.

1. **Paid sync:** should this release enforce the paid-sync restriction while purchasing is unavailable, preserve existing free-sync behavior behind an explicit gate, or exclude the new restriction? Which behavior should users receive until billing is available?
2. **Billing SQL:** approve preserving the sandbox SQL as a draft outside the active migration tree, so the source inventory remains 99/99? This is source relocation only; hosted application is still excluded.
3. **Hybrid prior timing:** include `0dd535e0d` in this release, or retain Release C constants through the first ledger week and ship the refit with the next separately qualified variant?
4. **Yahoo completion:** proceed with the proposed bounded private current-read implementation and its authenticated worker/fallback boundary before release, or explicitly defer Yahoo's quantitative confirmation feature while preserving trusted server-news confirmations and informational Yahoo labels? The original spoofable implementation is not an acceptable option.
5. **F7 durable disposition:** after preserving approved production behavior, should the held model adjustments be reverted from the working branch or retained behind explicit disabled flags? The ownership transfer does not select either approach; the current isolated draft must not be mistaken for approval of a permanent branch strategy.

The candidate's final SHA and exact exclusions still require parent review after these choices and remaining acceptance work. No answer is inferred from silence.

## Publish, verification and rollback plan — not executed

After decisions and independent review, assemble one exact candidate commit without switching or resetting the shared editing branch, using explicit reviewed paths and preserving foreign work. Coordinate the ledger's index window. Parent must inspect the candidate diff against the then-current remote master, its exclusions and negative/positive controls, and accept that exact SHA. Re-run only checks invalidated by the actual composition, including final app types/lint and relevant deduplicated tests. Never force-push or use GIT_DIR.

`VERCEL-CURRENT-INVENTORY.json` records four linked projects and their current triggers. For a candidate changing web and the three reviewed functions files, expected Git entries are web + functions builds, with CMS and root project ignored; previews remain disabled. Do not invoke manual hooks. Confirm exact SHA/environment has no successful/in-progress duplicate deployment immediately before the authorized normal master publish. Read-only metadata showed Release C production deployment READY. No deployment has been triggered by this task.

For an accepted release, first inspect deployment metadata/build status for the exact SHA and expected projects. Proposed smoke budget: at most five sequential read-only requests, stopping once conclusive; final exact routes must be checked and declared before execution. Prefer existing cached public page/static paths. Do not use data, cron, ingestion, provider refresh or recompute endpoints as smoke tests. No smoke requests have occurred.

Retain the current successful Release C deployment ID `dpl_G2REeofNhSMFgHLSDczeD1MS9vMb` and exact prior master SHA for rollback planning. A failed build is not a reason to retry blindly. If a deployed regression is observed, stop smoke requests and present a bounded revert of the exact candidate delta or deployment rollback for explicit approval; do not reset branches, force-push, apply migrations or alter production settings. Sync octoberBranch from an accepted released commit only after reconciling concurrent work safely.

## Coordination limitation

One direct tool message to the baseline worker was rejected by automatic approval review because the original instruction prohibited contacting outside agents and no direct-human override was established. It was not sent and was not retried. Coordination has remained via parent relays, incoming handoffs and the shared ownership receipt. This does not block local verification; it remains a denied communication action, not a denied code operation.
