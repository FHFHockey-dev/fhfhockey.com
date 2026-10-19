# Sprint cross-check audit — 2026-10-19 (Claude)

**Read-only audit and plan.** Nothing was fixed. No live system, schedule, database or deployment was touched. It checks Codex's 2026-10-19 sprint audit (`/Users/tim/Downloads/AUDIT.md`; working files in `/private/tmp/fhfh-sprint-audit-2026-10-19/`, which is temporary and lost on reboot) against current code. It then follows the product chain: FORGE forecasts → RSO roster decisions → Start Chart. Decisions API/Luna and FA Portal are out of scope.

## State at audit time (2026-10-19, 12:05–12:30Z)

| Item | Value |
|---|---|
| Branch / HEAD | `octoberBranch` at `865cbbf12`. `web/` source is byte-identical to sprint checkpoint `317f8f57e` (only `supportedBaselineMigration.test.ts` changed) |
| Production | `master` = `fa950fd29` (R2, 58 `web/` paths), deployed 05:42Z (Chef register) |
| Dirty files | `tasks/artifacts/forge-continuation-2026-10-17/LEDGER.md` and `tasks/sprint-2026-10-18/CHEF-REGISTER-2026-10-19.md`. Both belong to the active Chef session (`local_4317ea20`) and were not touched |
| Concurrent work | The Chef ran the FORGE v1 live run from 11:50 to 12:06Z (LEDGER §13). This audit avoided its ports, build folders and the heavy lock |
| Authorship | `317f8f57e` is a checkpoint of many sessions' work. This audit does not attribute every file to one author |

**Method.**
- Chef (Opus 5.5, xhigh) re-checked Codex's four findings and re-ran its two reproductions.
- Four read-only Sous agents (Opus, high effort requested; the runtime gives no effort readback) each made one bounded pass:
  - the forecast consumer chain;
  - the staged FORGE v2 patches;
  - a sweep of sprint and R2 code for the two reproduced bug classes;
  - the code behind the failing production jobs reported in `PROD-READS-2026-10-19.md`.
- Chef spot-checked each agent's key claims against source.
- No recursive reviewers. Agent cost was about 0.94 M tokens.

## Executive assessment

- **The sprint's local work is mostly sound, and R2 is verifiably working.** The sustainability fix (P1-1) shows 642 scored players on 10-19, against 250 per day before. The security fixes shipped as a clean curated candidate.
- **The product chain is not delivering in-season forecasts to users.**
  - Production reads show no successful legacy FORGE run since 2026-09-29 (A-01).
  - The production player reader still serves that 3-week-old run and labels it `ready` (A-02).
  - Today's native v1 issuance was held at publish by a scope gate (A-04).
  - Even if it had published, no production reader can read it (A-11).
- **The next priority is a trustworthy daily forecast and honest staleness, not more lanes.**
- **Codex's four findings are all still open.** Two needed correcting:
  - The private-import leak is broader in production than on the branch (A-06).
  - The consumer null disagreement is branch-only. In production all readers agree, but they treat unknown as zero (A-08).
- **New:**
  - Four production jobs fail silently once real slates arrive (240 s function limits, a stuck queue, an unreachable source), because the cron accounting counts 0 rows as success (A-01, A-05, A-12, A-19, A-21).
  - FORGE v2 has five more pre-rollout gaps. Two of them block the Oct 27 rolling switch.

Evidence labels: **reproduced** (failing test or live run), **code-confirmed** (read in source), **reported** (production reads, not re-queried here), **hypothesis**.

## Re-check of Codex's four findings

| Codex # | Still open? | Evidence now | Correction |
|---|---|---|---|
| 1 Sweep retry | Yes → A-07 | Reproduced: its test re-run at `865cbbf12`, 1 call where 2 are expected | Branch-only, and the route is not scheduled (absent from `web/vercel.json`). Two more problems in the same route were found (A-07) |
| 2 Private-import redaction | Yes → A-06 | Reproduced: the storage message still reaches the client | **Production is worse.** `master` returns `e.message` with status `e.statusCode ?? 400` for every error. The branch narrows that but is bypassed by `StorageApiError.statusCode: string` (`@supabase/storage-js` 2.89.0) |
| 3 Consumer null parity | Yes → A-08 | Code-confirmed | On `master`, Start Chart's `sumProjectionParts` also sums partials, so all readers agree on "unknown = 0". The disagreement exists only on the branch, and would reach production if the Start Chart change (Q-05) shipped alone |
| 4 v2 growth guard (N1) | Yes → A-13 | Code-confirmed in patch 03 (`806ef0ec…`), line ~173 | None; it is a prerequisite for enabling `universeThresholds` |

## Findings register

Each entry gives: ID · project · classification · severity → recommended priority. IDs A-03 (goalie fallback status) and A-10 (run scope and local fence) were merged into A-02, because they share one root cause, so those numbers are unused.

### Fix now

**A-01 · FORGE · reliability risk · High → fix now (diagnose first)**
- **Problem:** the legacy daily pipeline has produced no successful `forge_runs` since 2026-09-29; the 10-05 run failed.
- **Evidence:** reported (Q-08). The structure is code-confirmed; the cause is a hypothesis.
- **Where:**
  - One Vercel cron runs every stage in one function: `web/vercel.json:31`, capped at 240 s by `maxDuration` (`:4-6`).
  - `run-rolling-forge-pipeline.ts:687-708` forces `stopOnFailure=true` on the durable backlog.
  - `run-projection-v2.ts:590-628` (`projection_input_ingest`) refuses with 422 unless shift-chart coverage is complete. That ties it to P1-2.
- **Hypothesis:** in season, the function is killed at 240 s, which leaves no audit row and a run later marked failed by stale cleanup (`run-lifecycle-queries.ts:68-79`). Otherwise a blocking stage fails first.
- **Impact:** every legacy forecast surface is about three weeks stale (see A-02).
- **Status:** deployed and unchanged by R2. Today's 10:05Z run was the first after R2's shift-charts fix and could have recovered.
- **Next:** read today's nested audit rows (E-1). If the 240 s limit is confirmed, split the pipeline into bounded cron calls; that schedule change needs approval.
- **Accept when:** 3 consecutive in-season days each have a succeeded `forge_runs` row for that day's `as_of_date`.
- **Cost:** effort M; risk M; benefit high.
- **Existing IDs:** P1-2, Q-08.

**A-02 · FORGE readers · defect · High → fix now (next release)**
- **Problem:** legacy readers pick runs inconsistently, so stale or wrong runs are served as current.
- **(a) Player reader, deployed:**
  - On `master`, `forge/players.ts` `fetchFallbackRunWithPlayerData` (`:133-175`) falls back to the newest succeeded run with **no age limit**.
  - It still sets `state: "ready"` (`:378-382`) and uses `buildRequestedDateServingState` (`:386`), which carries no gap severity.
  - Users of the FORGE dashboard, Top Adds and player pages see 09-29 numbers as current. Top Adds alone shows "using 2026-09-29".
- **(b) Goalie fallback, deployed:**
  - `forge/goalies.ts` `fetchFallbackRunWithGoalieData` takes the newest `run_id` that has goalie rows with **no run-status check**, so it can serve a failed or still-running run.
  - Every dashboard caller enables this fallback.
- **(c) Run selection, code-confirmed (production occurrence is a hypothesis):**
  - No legacy reader checks `metrics.execution_scope`, so a later single-game run (`begin_forge_game_run`) displaces the full slate.
  - Only Start Chart excludes `git_sha local:*` runs.
  - Game predictions (`game-predictions/featureBuilder.ts:2819-2827`) has no run filter at all.
- **Evidence:** (a) and (b) code-confirmed on `master`; the production response was not observed.
- **Fix:** one shared legacy run selector (succeeded, full-slate scope, non-local sha, maximum age of about 3 days) plus the resolved-data serving contract with gap severity that goalies and Start Chart already use.
- **Accept when:**
  - Vitest: a latest succeeded run 20 days old gives `blocked` or empty, not `ready`.
  - A later scoped run or local run loses to the full-slate run.
  - The goalie fallback skips non-succeeded runs.
- **Cost:** effort S; risk low; benefit high.

**A-04 · FORGE native v1 · defect · High → fix as soon as the freeze lifts (2026-10-20 17:00Z)**
- **Problem:** the live publish was held: `native_target_scope_mismatch`.
- **Evidence:** reproduced live today (LEDGER §13).
- **Where:**
  - `publishObservedNativeBaselineCadence` (`nativeBaselineCadence.ts:91-95`) requires every seasonal source to bind to a participation or game target.
  - `outputs` emitted 75 sources for 9 means-only players who have no targets.
- **Why it wasn't caught:** the replay ran only `validateCadenceCommand`, never the publish scope check.
- **Status:** the hosted materialize closed (inserts only). No publish, CAS or head.
- **Same root as A-17:** v2 also never reconciles the means set with the participation and universe sets.
- **Fix, after TJ decides whether means-only players are served (LEDGER §13 revisit items 1–3):**
  - emit sources only for players with targets, or emit game-bound targets for them;
  - add the publish dry run to `daily-dry-run.ts`;
  - re-run a dated live run before the method window closes at 2026-10-27 04:00Z.
- **Accept when:** the publish dry run on a reviewed plan is not held, and the replay includes it.
- **Cost:** effort M; benefit high.

**A-05 · Rolling metrics → FORGE inputs · reliability risk · High → fix now (diagnose first)**
- **Problem:** only 4–14 all-strength `rolling_player_game_metrics` rows are written per in-season date.
- **Evidence:** reported (Q-08). The mechanism is code-confirmed; the cause is a hypothesis.
- **Where:** job 278 (`15 8 * * *`) runs `update-rolling-player-averages` → `fetchRollingPlayerAverages.ts`. Per player it reads full history, runs at concurrency 4 and has no internal runtime stop (`:2969-2973`, `:3592-3593`, `:4430-4480`). The function is capped at 240 s.
- **Hypothesis:** the run is killed and only low-ID players are written.
- **Separately:** the pipeline's rolling step dates itself today ET at 06:05 ET, before tonight's games, so it never recomputes yesterday (`run-rolling-forge-pipeline.ts:155-163`).
- **Impact:** the FORGE skater stage reads these rows (`skater-queries.ts:198`). Trends and rankings are affected too.
- **Next:** confirm with E-2. Then run bounded batches using the `web/README.md` controls (`maxPlayers`/`resumeFrom`), target yesterday, and never use `fullRefresh` or truncate. The schedule change needs approval.
- **Accept when:** per completed date, `all`-strength rows ≈ WGO skater-game rows.
- **Cost:** effort S–M; risk low; benefit high.

### Fix before release (branch-only code, or deployed defects to bundle into the next release)

**A-06 · Draft Pro private imports · security risk · Medium → next release (fix now if the flag is on in production)**
- **Evidence:** reproduced.
- **Production (`master`):** the begin, stage and chunk routes return the backend `message` and status for **any** error.
- **Branch:** `private-imports.ts:28`, `[uploadId]/stage.ts:15` and `chunks/[ordinal].ts:17` trust a truthy `statusCode`, which Supabase Storage errors carry as a string.
- **Who can reach it:** only signed-in, entitled users, and only if `DRAFT_PRO_PRIVATE_IMPORTS_ENABLED` is on (value not read; E-6).
- **Fix:** turn `invalidPrivateImport` (`privateImportTransport.ts:18`) and `requireDraftProServerCapability` (`server.ts:98-104`) into an owned error class. Check it with `instanceof`, keep the intentional 400s, and return a fixed 500 for everything else.
- **Also check:** the other Draft Pro duck-typed `statusCode` errors (`reports.ts:77`, `dustRateLimit.ts:16`, `dustSeason.ts`). Their routes were not swept.
- **Accept when:** both numeric and string `statusCode` are tested, plus a PostgREST error and a deliberate validation 400.
- **Cost:** effort S. **Existing ID:** S-20.

**A-07 · Gamecenter sweep (branch-only, unscheduled; owner unknown) · defect · Medium → before scheduling or shipping**
- **(a) Retry gap (Codex 1):** after a team-refresh failure the game is skipped forever. Reproduced.
- **(b) Bounded selection before the staleness test:** `:109-114` takes the oldest 1,000 rows first. The incomplete lane can also starve behind permanently failing games (`:85-97`, `:217-225`).
- **(c) xG-affected list truncated:** `:178-189` has `.limit(5_000)` with no order, but `max_rows=1000` (`supabase/config.toml:18`). About 8–10 games fill the cap.
- **(d) Status:** returns 200 with partial failures; `endDate` is a UTC date; the admin 500 echoes the backend message.
- **Fix:**
  - stage-aware completion (one marker per derived stage, or advance only when every stage finishes);
  - paged or cursor selection;
  - a per-game xG probe;
  - 207 on partial failure.
- **Accept when:** Codex's retry test passes, a 15-failing-games fixture still normalizes a newer game, and more than 1,000 xG rows report all games.

**A-08 · Forecast consumers · defect · Medium → before the Start Chart null change (Q-05) or the serving slice ships**
- **Problem:** there is no shared missing-head contract.
- **Branch:** `start-chart.ts:741-746` returns null when ES or PP is unknown, while two readers substitute zero:
  - `forge/players.ts:329-341`;
  - `run-projection-accuracy.ts:1741-1754`.
- **Also on the branch:** `run-projection-accuracy.ts:2051` uses `proj_win_prob ?? 0` now that the writer stores null (6e14053ff). That biases win calibration.
- **On `master`:** `featureBuilder.ts:1233-1240` makes partial ES+PP sums.
- **Evidence:** code-confirmed.
- **Fix:** one helper for modeled-head totals, used by every reader and by the accuracy accumulators. The accuracy job skips unknowns and counts them.
- **Accept when:** a same-row fixture with ES 0.2 and PP null gives unknown in all three consumers and is excluded from accuracy.
- **Existing ID:** Q-05.

**A-09 · FORGE provenance label · incomplete requirement · Medium → before the serving slice ships**
- **Problem:** the label is gated inconsistently, and only a branch-only writer emits it. Code-confirmed.
- **Same unlabelled run, different results:**
  - Start Chart serves it with a flag (`start-chart.ts:913-914`).
  - `forge/players`, `forge/goalies` and `projections/*` return 422.
  - `forge/players` swallows only 404, so an unlabelled exact-date run becomes an error, not a fallback.
- **Release risk:** the label writer (`run-forge-projections.ts:482/550/600`) is `branchOnlyRuntime` in `slice.json`, while the stricter `calibrationEligibility.ts` is in the slice. Shipping the slice without the writer makes accuracy reject every run.
- **Production today:** 0 of 382 succeeded runs carry the label (P1-4).
- **Fix:** one policy across readers (refuse, or serve flagged; TJ decides), and ship the writer together with the gate.
- **Accept when:** a 5-reader × labelled/unlabelled test matrix passes.
- **Existing IDs:** P1-4, B-series serving blockers.

**A-12 · NST team daily → CTPI · defect · Medium → next release**
- **Problem:** incremental mode can never get past its latest stored date.
- **Evidence:** code-confirmed. The queue starts at that date, inclusive and ascending (`update-nst-team-daily.ts:552-566`), and runs 1 date per run when there is no burst (`:721-726`). That date is already complete, so it is skipped.
- **Result:** from the June final onward, every run returns `success:true`, and CTPI (job 279) writes 0 rows from an empty source (`update-team-ctpi-daily.ts:298-307`).
- **Impact:**
  - Trends Recent Team Form and Start Chart's CTPI context (`start-chart.ts:1056`) are frozen at 2026-06-15.
  - Game-prediction CTPI features are already excluded, and CTPI publication stays `legacy_unapproved` by design.
- **Fix:** advance past a complete latest date, floor the queue at the current season start, and have CTPI report a skip or failure on an in-season 0-row run.
- **Backfill:** about 12 dates at 21 s spacing needs a bounded, approved plan.
- **Confirm with:** E-3.
- **Cost:** effort S.

**A-13 to A-18 · FORGE v2 staged patches · before the named milestone**

All are code-confirmed in the patches applied in scratch; A-13 is confirmed by Chef and A-14 by Chef's arithmetic.

| ID | Problem | Gate | Smallest fix / accept when |
|---|---|---|---|
| A-13 | Codex 4 / N1: a missing previous universe counts as 0 additions, so the growth threshold fails open (03 ~:173) | Before enabling `universeThresholds` | Fail with `universe_previous_required` when the flag is on and `change` is null; add a CLI test |
| A-14 | Rolling mode gives every member inputs. 62 skaters × 20 + 7 goalies × 40 = 1,520, over the materializer's 1,500 limit (`nativeInputMaterialization.ts:98`). It fails late, with a misleading message | Before `rollingFirstIssuance` (Oct 27) | Check the bound offline in `inputs-v2`, then split the request or get an approved limit. Accept when a synthetic 62/7 at horizon 20 fails at `inputs-v2` |
| A-15 | Nothing plans rolling capture: `rollingHistoryBoxscoreUrls` has no caller, and `dailyCapturePlan` fetches only the frozen weeks and template clubs. The means CLI rejects `universe.json` (`universe_shape`) | Before Oct 27 | A `capture-v2` plan from the universe's clubs, and the means CLI reading the universe directly |
| A-16 | `inputs-v2` dropped v1's `capture_differs_from_plan` (`forge-daily.ts:120-121`). A missing future week skips games silently, and no gate sees it | Before the first live v2 run | Reuse the plan-equality check, with a test where a dropped week or roster fails |
| A-17 | Means freshness, completeness and universe binding are unchecked. The receipt shows `planStatus: requests_pending`, 2 members with no means, and a policy missing (5 of 6). Same root as A-04 | Before the first live v2 run | Require the means cutoff date to equal the run date, the coverage set to equal the universe, and a complete plan (or an approved ceiling) |
| A-18 | `--approval-ref` accepts any string. Policy terms come unpinned from the operator's templates file, and duplicate templates resolve to the first | Before the first live `outputs-v2` | Pin the ref and a terms hash in `NATIVE_DAILY_APPROVED_METHODS`; fail `fresh_means_policy_template_ambiguous` |

### Worthwhile next

**A-11 · Native forecast serving · incomplete requirement · High for the chain → needs a TJ decision now; build after A-04**
- **Problem:** no production reader exists for native issuance. Code-confirmed.
- **What `master` has:** no catalog-head reader. `nativeCatalogHead.ts`, `nativeContributionAdmission.ts`, `gameExpectationReader.ts` and the participation stores are all branch-only.
- **Branch fallback:** without `PLAYER_FORECAST_NATIVE_CATALOG_HEAD_ID`, the branch silently uses the legacy pins (`nativeCatalogHead.ts:76`). `STARTER_BOARD_SERVING_ENABLED=false` gates only game revisions.
- **Source split:** on the branch, the Start Chart page reads `game_expectations` (`pages/start-chart.tsx:442`), while the FORGE dashboard cards stay on legacy. Once activated, the two will disagree.
- **Next:** decide the activation path: ship the catalog consumers plus the head env, with one server-side source for every Start Chart caller.
- **Accept when:** with the head set, RSO `/data` and `game_expectations` show `forecastedOpportunities > 0` for the issued date and go empty after `expiresAt`, and the Start Chart page and dashboard pass a parity test on the same slate.

**A-19 · Cron observability · reliability risk · High → after A-01/A-05 diagnosis**
- **Problem:** the cron accounting counts 0 rows as success, and a function killed at 240 s writes no audit row. Code-confirmed.
- **Where:**
  - `withCronJobAudit.ts:162-194` and `:266-270` fail only on a throw, a 207 or a status of 400 or more.
  - `cron-report.ts:358-374` downgrades only hard-coded "skipped" shapes.
  - Report job 234 is inactive.
- **Effect:** A-01, A-05 and A-12 stayed "green" because summer had no work.
- **Fix:**
  - an expected-work check (an in-season 0-row run is a warning);
  - a missing-audit-row alert for scheduled jobs.
- **Accept when:** fixtures for a 0-row in-season run and for a missing run both surface in the report.
- **Existing ID:** S-06 email proposals.

**A-20 · Sustainability batch skip · defect · Medium-low (deployed in R2) → worthwhile next**
- **Problem:** score rows built while `window_z` was missing (luck terms zeroed, warning only; `score.ts:203-238`) count as current once `window_z` exists, so a manual re-run skips them (`incremental.ts:95-160`).
- **Evidence:** reproduced in a scratch test.
- **When:** only after a failed `window_z` offset cron. This existed before R2 as well.
- **Fix:** have the detector also read `components->warnings`.
- **Accept when:** degraded rows re-run once `window_z` exists, and still skip while it is absent.

**A-22 · FORGE replay evidence · evidence gap · Medium → record it in the apply and run notes**
- **Problem:** both replays (Oct 20 for v1, Oct 21 for v2) prove less than their receipts suggest.
- **What they used:** synthetic universe and approval ref, restamped rosters, harness-built schedule bodies, a simulated closure, and an operator-chosen null gate.
- **What they never exercised:** publish, any flag-on path, live identity matching, or the rolling method.
- **Consequence:** A-04 was caught live, not offline.
- **Fix:** the publish dry run (A-04), plus recording the harness and patch hashes in the receipt.

**A-24 · Rolling route safety · cleanup / safety · Low → include the existing branch fix in the next release**
- **Problem:** production's `update-rolling-player-averages` still maps `fullRefresh=true` to `rpc_truncate`. The branch adds refusals for scoped and dry-run requests (S-03).
- **Risk:** low unless someone invokes it, but it is a standing hazard (rule: never truncate).

### Optional / later

- **A-23** (v2 cleanup, Low): the flags parser uses `key in flags`, so inherited keys such as `toString` are accepted. Use `Object.hasOwn`. Reproduced; it cannot enable a feature.
- **Release reminder (already tracked):** the game-prediction v6 feature bump returns `success:true` with 0 rows written until a v6 model is promoted (S-18). Gate the release on a promoted model.

### Needs evidence (exact bounded read-only checks; TJ approval required, none run here)

| ID | Settles | Read |
|---|---|---|
| E-1 | A-01; whether R2's shift-charts fix unblocked today's 10:05Z run | `select run_time, job_name, status, details->>'statusCode', left(details->>'response',300) from cron_job_audit where run_time > now()-interval '4 days' and job_name in ('run-rolling-forge-pipeline','run-projection-v2','update-shift-charts','/api/v1/db/update-rolling-player-averages','/api/v1/db/ingest-projection-inputs') order by run_time;` |
| E-2 | A-05 | WGO skater-game rows vs `rolling_player_game_metrics` `all` rows and `max(player_id)` per date, 2026-10-14..17 |
| E-3 | A-12 | `select max(date), max(date) filter (where season_id=20262027), count(*) filter (where season_id=20262027) from nst_team_gamelogs_as_rates;` |
| E-4 | A-21 | The last 3 `cron_job_audit` rows for `game-predictions-ingest-espn-odds` (status code and first 300 characters of the response) |
| E-5 | A-02(c) | Count of succeeded `forge_runs` with a non-empty `metrics->execution_scope->requested_game_ids`, or `git_sha like 'local:%'` |
| E-6 | A-06, A-11 | Vercel env **names and targets only**: `DRAFT_PRO_PRIVATE_IMPORTS_ENABLED`, `PLAYER_FORECAST_BASELINE_RELEASE_IDS`, `PLAYER_FORECAST_NATIVE_CATALOG_HEAD_ID`, `STARTER_BOARD_COMPUTE_ENABLED`. Whether the flag is on needs its value, which TJ can check |

**A-21 · Game predictions · reliability risk · Low–medium → needs evidence (E-4)**
- **Problem:** `game-predictions-ingest-espn-odds` failed 42 times in 14 days. That is every run of the 3 daily jobs.
- **Likely cause (hypothesis):** ESPN refuses Vercel egress with a 403. Supporting evidence: commit `1f9c76e00` added 403 classification, and the master-reconciliation register cites "ESPN odds 403s".
- **Code-confirmed:** `Promise.all` with no timeout, so one bad date fails the whole window (`espnOdds.ts:587-603`).
- **Impact:** market odds are missing from predictions and the homepage pulse. It is not part of the FORGE → RSO → Start Chart chain.
- **Next:**
  - If it is a 403: a source decision. Pausing 2 of the 3 jobs to stop wasted invocations needs approval.
  - Otherwise: per-date `allSettled`.

## Already working well (preserve)

- **`consumerRevisionAdmission` (shared by RSO and Start Chart):**
  - hard expiry (minimum of published + 36 h and game start);
  - captured-read receipts;
  - roster and schedule revision equality;
  - unknown kept separate from zero.
- **Native catalog fails closed:** an invalid or expired head clears the pins.
- **v2 safety gates:**
  - the rolling switch fails closed;
  - the method gate runs before any write;
  - outputs never overwrite an existing directory;
  - with the flags off, v1 behaviour is unchanged (patch 01 is a pure extraction; patch 02 changes nothing without rolling pins).
- **Live-run discipline:** the v1 publish gate caught a real scope mismatch, and the Chef declined to edit frozen files or hand-edit a reviewed plan.
- **R2 release practice:**
  - a curated candidate;
  - all 58 manifest blobs match `fa950fd29` (Codex verified this independently);
  - exactly the expected Vercel builds.
- **Error redaction and paging:** R2 error redaction uses class-based checks (rankings, runs, Trends, account routes, `createComment`). Paged readers have unique tie-breaks.
- **Other preserved work:**
  - Sustainability per-player completeness, verified in production on 10-19.
  - The exact-five PP oracle is independent of its implementation.
  - Start Chart's exact-date selection, explicit `partial` mode and local-run filter.
  - Game Grid rejects data from another date.

## Earlier findings now resolved or superseded

| Earlier item | Now |
|---|---|
| P1-1 sustainability scored only players 0–249 | **Resolved in production.** 642 distinct players on 10-19, on R2 code (Chef, 11:16Z) |
| P-B baseline collision | Resolved: all 4 checks passed at 11:32Z |
| v2 blockers B1/B2 | Resolved: the patch 03 re-review was accepted. Codex was right not to reopen them |
| Migrations 84/85 pending | Applied 05:29–05:35Z |
| Codex 2: "not in R2" | Superseded by A-06: production has the older, broader leak |
| Codex 3: three consumers disagree | Superseded by A-08: they disagree only on the branch |
| Codex: "forthcoming v1 run" | It ran and was held (A-04) |
| Q-08: "no FORGE run since 09-29" | Still open as A-01, now with a mechanism; fixing it does not label runs (P1-4 stays separate) |

## Coverage ledger

| Surface | Depth |
|---|---|
| Codex's four findings | **Reviewed:** source re-read, and both reproductions re-run at `865cbbf12` (16 pass, 2 fail as expected) |
| Forecast consumers: Start Chart selection, `forge/players`, `forge/goalies`, accuracy, `apiHelpers`, RSO `planning.ts`, `consumerRevisionAdmission`, `nativeCatalogHead`, Game Grid hook, game-prediction FORGE read | **Reviewed** |
| `planningContributions`, `contributionStore`, `gameExpectations`, `projections/*`, `slice.json`, serving BLOCKERS | Partial |
| FORGE v2 patches 01 and 04, 02 runtime hunks, replay script and receipt | **Reviewed:** applied in scratch; 5 targeted Vitest files, 238/238 pass |
| v2 patch 02 test hunks, `nativeDailyMeansCapture` | Partial |
| R2 runtime paths (all 58), and branch diffs of the sweep, private import, sustainability, rankings, rolling, xG, RSO, Yahoo, NST, goalie-power and Trends paging | **Reviewed** for the five bug classes (backend-trusting errors, early completion markers, null→0, paging, 0-row success) |
| Production job code: CTPI, NST team daily, ESPN odds, FORGE pipeline, rolling recompute, `withCronJobAudit`, `cron-report` | Reviewed or partial (route logic yes; ESPN `parseEvent` and actual pg_cron commands no) |
| `start-chart.ts` (2,200 lines) | Partial: diff hunks, selection and error paths |
| SKO/BLSH, exact-five, GameGrid, homepage, lines and team-stats UI | Regex sweep only |
| Product UX, accessibility, mobile, browser flows; performance and cost measurement; Scout, social and Vesper assets; e2e fixtures; training and qualify scripts; the RSO client optimizer beyond its expiry filter; participation-store internals; `webhooks/`, `functions/`; most of the 516 carry-in paths; transitive lockfile and clean `npm ci` | **Not reviewed** |
| Task documents and evidence assets (about 232 paths) | Not line-reviewed. Codex's `UNREVIEWED.md` list stands |

**Not run:** full suite, tsc, lint, build, browser, any production SQL or request, deploys, schedule changes, repairs.

## Five highest-value next actions (dependency order)

1. **Diagnose the production chain** (E-1, E-2, E-3, E-5; read-only, ≤6 SELECTs with a statement timeout, approval required). This shows why the legacy pipeline and rolling recompute fail in season, and whether R2 already helped.
2. **Local fix bundle for deployed defects, then the next release (R3):**
   - the shared legacy run selector with an age cap and gap severity (A-02);
   - the goalie status check;
   - owned private-import errors (A-06);
   - the NST team-daily queue and CTPI 0-row status (A-12);
   - the rolling-route refusals (A-24).

   Tests only; deploying needs approval.
3. **Repair the pipeline and rolling recompute** according to step 1 (A-01, A-05). These are bounded cron batches and need schedule approval. Add the A-19 expected-work alerts so this cannot go quiet again.
4. **FORGE native, after 2026-10-20 17:00Z:**
   - fix the publish scope (A-04) and add the publish dry run to the replay;
   - re-run v1 before 10-27 04:00Z;
   - apply v2 with A-16, A-17 and A-18;
   - land A-13, A-14 and A-15 before the Oct 27 rolling switch.
5. **Native serving activation (A-11):** use one source for Start Chart, RSO and the dashboard, built on the shared missing-head contract (A-08) and the label policy (A-09).

**Single best bounded task to start:** step 1. The Chef runs E-1, E-2, E-3 and E-5 as read-only SELECTs, one at a time, with `statement_timeout` 8 s, outside scheduled runs. It records results in `PROD-READS-2026-10-19.md` and writes nothing else. This tells us whether the biggest user-facing failure (stale FORGE everywhere) is still live after R2, and what to fix.

**Best task that needs no approval:** A-02 together with A-06, a local patch with tests on `octoberBranch` (no deploy). It can run in parallel because the files don't overlap.

## Decisions and permissions needed from TJ

1. **Approve the read-only checks** E-1 to E-6 (≤6 SQL SELECTs plus 1 Vercel env-name listing; no application or cron requests). Say whether the Chef or a fresh thread runs them.
2. **FORGE v1:** should means-only players be served? That determines the A-04 fix. Also pick a re-run date between 2026-10-20 17:00Z and 2026-10-27 04:00Z.
3. **Unlabelled legacy runs:** refuse them, or serve them flagged, in every reader (A-09).
4. **Native serving activation path** (A-11): when, and in what order relative to the legacy repair.
5. **Schedule changes, once the evidence is in:**
   - split the FORGE pipeline cron (A-01);
   - batch job 278 (A-05);
   - possibly pause 2 of the 3 ESPN odds jobs (A-21);
   - the CTPI backfill plan (A-12).
6. **Still owed from earlier:** confirm the 6 pinned v2 definition hashes, and decide v2 N2.
