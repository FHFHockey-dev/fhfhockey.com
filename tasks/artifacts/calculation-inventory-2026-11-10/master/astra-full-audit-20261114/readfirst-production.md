# Astra read-first: production records, 2026-11-14

Bounded records worker `/root/readfirst_production`; runtime verified `gpt-6-astra` / `high` from local rollout `01a1db71-a255-7462-a174-7aa5a1af4b2a`. Chef is `gpt-6-astra` / `xhigh`. Checkout at start: `octoberBranch`, `6d77ede6998314d1700562ab598f38fe182323c9`.

This is a prerequisite reading record and action map, **not a code, SQL, runner, production-state or approval-transcript audit**. No app/test/production script was executed; no database, provider, page or remote request was made. Only this report and the assigned diary were written. Historical approvals below are **reported in records**, not independently authenticated TJ pop-ups. None authorizes a new action.

All shortened paths below are relative to `tasks/artifacts/calculation-inventory-2026-11-10/master/production/`; `Q` means `PRODUCTION-QUEUE.md`. Hashes pin the local bytes read, not the hosted state or historical deployed bytes.

## Reading completed and scope limits

- Fully read `ASTRA-FULL-AUDIT-PROMPT-20261114.md`, repository `AGENTS.md` and `mise-en-place.md`.
- Fully read Q (516 lines), every non-cache Markdown packet in the assigned directories, `ITEM6-SCHEMA-VERIFY-PLAN.md`, and `RELEASE-NEXT-HANDOFF.md`.
- PP `REPORT.md`: read lines 247–745, containing §§10–18, the preserved open-item section and reproduction notes. §§1–9 (lines 1–246) were **not assigned and not read**, except its heading inventory.
- Also fully read the four Q-linked root plans needed to resolve early queue actions: `GOALIE-REBUILD-2026-27-PLAN.md`, `FORGE-INPUTS-PLAN-2026-11-13.md`, `GAME-2026020159-RECOVERY-PLAN.md`, `REMAINING-PRODUCTION-PLAN-2026-11-13.md`.
- `trend-bands-2026-11-13/`, `rolling-resume/`, `release-433-followups/` contain **only their runner**, aside from a rolling Python cache. No separate written packet or run receipt is present in those directories. The relevant narrative is Q and the root plans. Runners are inventoried below, **not code-audited**.
- Small retained receipts were read as identified below. Larger payloads, source exports, SQL/runner implementations, proofs, tests, authority rows, original TJ sessions, diaries and mailboxes were **not audited**. No mathematical result was independently recomputed. A direct display of `xg-demotion.../registry-backup.json` truncated; its content is explicitly **partial**, not a full reading. It was subsequently inventoried only.
- Narrow memory lookup found no task-specific record and contributed no audit evidence.

## Production-action matrix: numbered queue

Status means documentary status. “Reported complete” never means independently verified current production.

| Queue | Action and reported approval | Bounds / dependency | Readback and status; next evidence needed |
|---|---|---|---|
| 0a | Migrations 125–136, 138–140; Q:8 gives authority/commit receipts, no individual approval text | Individual database actions | **Approval/source-definition audit pending** with authority worker; commits `d08318dce`, `7c3116717`, `82f643878`, `74c85b556` are references, not readbacks here. |
| 0b | 2026-27 goalie partitions; “Run as planned” in goalie plan:3 | 298 regular-season games, 44 dates 09-29..11-11, one date per call, ≥5 s gaps; ≤1 retry; guard ≤5 active/10 s; 200 s stop; no provider | Plan:51–58 reports 44 calls, 14,094 partitions, all rev 2, zero retries, one cache warm, 75 goalies served. **Reported complete; estimate was 2,400 rows, actual 14,094**. Original approval/cost reconciliation needed. |
| 0c | Migration 141, `1aa886c92` (Q:10) | `goalie_totals_unified`, regular season | Authority/application/rollback audit pending; Q has no standalone approval/readback here. Supersession of 135 belongs to DB review. |
| 1 | Strength v2 re-normalization; 298 games (Q:34–50); continuation approvals in recovery plan | ≤25 games per window initially; ~1,200 NHL GETs; 10 s gaps; 200 s stop; later single-game phases A–E | Initial saturation incident stopped at 146/298. Q:15 reports final 298/298. Ten-plus-one HTML recoveries described below. Exact phase approvals/runners/readbacks still needed; queue alone does not prove each continuation stayed bounded. |
| 2 | Summary-only refresh, after re-normalization (Q:52–79,16) | Team 7-day windows, one dry run; player 44 date calls; goalie 44 dates; ≥10 s gaps, 150 s stop, stronger probe/IO guard; no providers | Q:16 reports team 41,720 rows in 7 windows, player 43,764 partitions, goalie 14,094/rev2. Sweep proposal was replaced because it rewarmed caches. No new smoke budget. **Reported complete**, raw per-window receipts not inspected. |
| 3 | xG v2 features/model/rebuild work; retirement approved under “All steps now” (Q:194–201) | Exact cfg9bac2706 registry row, transaction, backups, ≤5 reader checks | Retirement receipt confirms UPDATE 1/COMMIT and inactive/non-champion/retired; two retained API JSONs show no active model. Full v2 features/training/aggregates are **not closed by retirement**. Existing cfg9bac2706 aggregates remain; audit every consumer. |
| 4 | FORGE strength input rebuild, Q originally “to prepare” | Codex DRM repair all 298 games | FORGE plan:5–9 reports already done 19:07–23:24Z 11-12, 596 team rows, current materializer versions. No duplicate rebuild needed; Codex approval/readbacks elsewhere. |
| 5 | Rolling recompute and trend v3; “Dry run, then run”, “Run with bypass”, later resumptions | 764 skaters ×5 strengths, 09-29..11-11; 25→20→12→8 players/call, last phases ≥60 s gaps; no truncation/providers | FORGE plan:42–66; bypass accepted freshness status failures; two slow stops and DB incident. Final 10,727 rows/strength, 764 players, sampled support field 100%. Trend v3 **forward-only via job392**, v2 history retained by TJ. Original resume approvals and diagnostics remain to reconcile. |
| 6 | Trend history, “Later, paced” (Q:214,220–221) | 10 players/call, ≥60 s gaps, pause 11:58–12:08, stop non-200/error/>60 s/guard; 09-29..11-12 | Reported 77 calls, 769 players, 666,376 bands, max9.5 s. Root plan proposed 764 players; frozen roster/diff not retained in this folder. No run receipt here: **narrative-only completion**. |
| 7 | v3 power then v4; CTPI/SOS v2 follow-ups | v3 45 dates; v4 46 dates 09-29..11-13; CTPI 2 chunks; SOS one cutoff | Q:196,273–283,231–235. v4 retained receipt supports 1,425 v4+47 legacy carries; CTPI 1,102 candidate rows, v1 9,489 unchanged; SOS32 teams×84 fixtures, legacy15,680 unchanged. CTPI **predictive approval still gated**, beta is separate. |
| 8 | Rankings “Write now”; composites “Publish now”; TOI “Rebuild now” (Q:204–213) | Dry runs first; composites ≤1,000 rows; 12 four-day TOI batches/new snapshot | 50,320 rankings; 764 composites/v3 snapshot11-11; TOI39,506 rows/299 games, 1,643 partial across13 games. BEAST5v5 counts2/24/53/63 differ from simulation2/30/49/67. All-strength BEAST recheck and snapshot publication atomicity **not established by these packets**. |
| 9 | WiGO natural cron231 check after08:50 (Q:215–217) | No blanket rewrite of historical career universe | 988/990 listed players,1,976 rows; audit failure for two identities; 14-row repair later completed. Plan's “all7,845 rows fresh” expectation explicitly wrong. Next natural successful WiGO readback not in assigned evidence. |
| 10 | FORGE run/H1 | Q:82 lets game307 pass; Codex coordinates separate approval | Q:218 reports natural pipeline all11 stages and runs succeeded11-13..15; **does not establish all H1/reserve/native input qualifications**. |
| 11 | Reserve migration101 “Table now, flag next release” (Q:189–192); flag set by TJ before#433 (Q:229) | `psql -1`, source hash, no concurrent pressure; flag requires deployment | 28 columns,RLS,one SELECT policy,pkey+2indexes,read grants; 107applied/8pending then. **First reserve rows/actual FORGE consumption not shown**; keep separate from goalie/power checks. |
| 12 | Index123/124 read-only need check then “All steps now” (Q:111–118,194–202) | 124 transaction/small tables;123 CONCURRENTLY alone,outside transaction,15min timeout | 124valid192kB+88kB;12337s/17MB valid+ready; ledger inserted. Need compare live definition/authority source where123 plain-index source was operationally adapted. |
| 13 | Pause SKO cron327, TJ “send it” (Q:27) | Exact job only; reversible active flip | job327 `45 10 * * *`, activefalse, only match. Later API withholding smoke503 at#434. No seven-day usage proof. |
| 14 | Legacy request logs, read approval Q:86–91 | Requested7days; tools initially console-only1day | Q:237–244 later dashboard request logs find0requests/~24h; **one day does not rule out occasional use**. Original Q:244 “rules out daily caller” is only observation-window evidence. |
| 15 | Goalie materialized snapshot refresh, “send it” (Q:29) | One plain REFRESH6.2s | 402rows/3seasons→476/5; samples match live view; reports no app readers. Full receipt not retained here. |
| 16/16b | Ledger-schema and forecast-calendar default flags (Q:30–31,84) | Code+tests+release, former Scout claims | Initial table remains pending even after follow-up releases; **actual landed flag values/reader coverage not proved in assigned production packet**. Chef's decisions/lane/source review must settle. |
| 17 | Debrief/audit prompt | Records only | Reading/reporting action, not production qualification. |

## Later actions and separate authority boundaries

| Action | Approval and bounds reported in records | Readback and limitation |
|---|---|---|
| Game 159 and ten more OT recoveries | Recovery plan:56–104: TJ chose qualified official HTML; one new captured snapshot and normalization RPC per game, old JSON retained. Ten-game plan:159 requires 60-second gaps. | Plan:105–119 records 159 snapshot 97127, 788 shifts, 332 events, 40 roster rows, both goalies matching official TOI. Lines 161–166 describe ten more games “back to back,” 3–5 seconds per game, one reconciled prewrite retry. Pacing-change approval not included. |
| 2025-26 goalie rebuild | Q:92,156–160: summary-only approved; stopped on an unplayed playoff game, resumed only raw-backed played games. | 178 + 35 calls, 1,394 games, 65,164 partitions; 23 unplayed games excluded. Original revised-inventory approval not quoted. |
| Cron 305 | Q:162–164: “Move 305 to 10:25,” exact schedule change. | Readback `25 10 * * *`, same route, active. Runtime history not independently inspected. |
| Migrations 142/143 | Q:166–169: “After the rebuild.” | Nullable v2 skill/check; traded-player percent_games examples corrected; unmatched teams remain NULL. Definitions and authority handled by Chef separately. |
| H1 alias restore and database restarts | Q:138–142: “Restore now,” promote existing Git deployment, no build. Q:181: “Wait and watch,” one probe/minute for at most ten minutes; TJ later restarted DB at 02:08. | Alias/healthz reported; **no H1 write for game 307**. DB incidents matter for future guard review. |
| Migrations 144–146 and #433 follow-ups | Q:223: “Yes, after trend bands”; Q:231: “Run them after release.” | Three applies; 1,409 games with stored states, CTPI 622 + 480 candidate rows, SOS 32 teams with 84 fixtures. Follow-up folder has runner only, no retained raw receipt. |
| WGO 14-row repair | F18 REPORT:3–10,76–89: TJ pop-ups; exact all-null identity/id/player/date/season/TOI guard; four NHL GETs. | Retained readback has 14 before/after rows, DO, zero bad frames. Restoring game_id to NULL is blocked by the NOT VALID constraint. Wider legacy backfill open. |
| Mahura NST repair and continuation | F18 REPORT:11–31,57–68: two dates, 20 URLs each, ≥60 seconds between, no concurrent NST job; partial failure stops; new TJ approval for ES/PK reruns. | Reported 20 + about 10 + 4 + 4 requests, 16/16 non-PP datasets per date. No retained timing/admission/audit log here. Partial run wrote nine datasets; failed es_rates request reportedly never reached DB. Exact rate-limit compliance unverified. |
| Migration 148 and penalty-shot derived rebuild | Q:305 “Apply now”; Q:316–322 “Run it, Claude”; eight frozen games, guards, 10-second gaps, 200-second timeout. | Retained log has eight 42-row calls and DONE; Q reports 16 team and 304 player split rows, eight shots/two goals, official parity. 2025-26 deliberately excluded. |
| Penalty-shot player/goalie canary, then seven | Q:323–335: separate one-game approval and “Run the other 7”; 16 calls, no providers, 1,158 current player partitions and 376 goalie partitions, 18 orphans unchanged. | Log supports eight player/game completions. Canary before-file overwritten on second invocation; original log preserves all-strengths values but no ES baseline. |
| Penalty-shot team refresh | Q:345–349: approved eight-game read-only diff, then “Run it, Claude”; per-game re-diff and write, 16 calls. | Retained team log: 1,120 generated, 54 changed, eight writes of 140 rows, DONE. Raw field-level comparisons not rerun. |
| Penalty-shot served checks | Q:336–360: initial 24 GETs, team 16 GETs, strict 24 GETs; strict pass explicitly approved “Run the 24 GETs.” | Strict result retained: ALL_OK, 24 requests, 200/MISS. Initial 24 and team 16 do not quote standalone budget approval in Q. Find original approvals before judging; do not reopen closed A3 findings without new evidence. |
| Item 6 catalog check/apply | ITEM6 plan:18–33: six catalog SELECTs; Q:372–377: standalone next-safe-window approval. First precheck stopped on SET parsing, nothing applied. | Atomic apply 19:45:17; five nullable columns, six markers, function md5 `72c23e8270dda6e82c60ef5c01c0b67e`, grants unchanged. Readers ship with writer #440. |
| Goalie item 1 helper count | Q:361–370; RELEASE handoff:24–36: one approved aggregate SELECT. | 2,764 valid GA/SA pairs; zero excluded; old/new blended baseline about .8935. Actual next cron 364/FORGE consumption still requires its separate receipt. |
| PP export/local dry run | Q:387–416; REPORT:515–572: 309 games, 31 batches, ≥5 seconds, read-only transactions, ten-second timeout; candidate `8f73d2931`. | Retained dry-run/export hashes match; 618 clocks, 609 available, nine N/A; 16 changed team-games, 15 deletes, 23 PP updates, 14 unit-relative updates, five inserts. Temporary CREATE outside read-only transaction disclosed. Raw CSVs external/unread. |
| Migration 149 | Q:417–431: “Apply at next window”; minute windows, source hash, five-second lock/thirty-second statement timeout; atomic DDL/ledger. | Applied 20:36:48; 47,688 existing rows unchanged, clock empty, seven constraints/RLS/grants. Function timeouts present in source but omitted from packet's expected config row. |
| PP writes flag/deploy | Q:432–448: #441 “writes off,” then TJ sets flag and “Initiate redeploy.” | `dpl_DgmG26oS5SJcVNNoEQBrhohqjc1y`, master `f5c7adc2d`, one extra build, three GETs plus HEAD. CLI listing hides value; subsequent successful write supports enabled behavior. Cron 388 also changes path from this deploy. |
| PP refresh | Q:449–457: “Run it now”; approved hash, 31 batches of ≤10 games, concurrency one, ≥5 seconds, 60-second stop, readback per batch. | Retained log says all 31 match. Q reports 7,180 stamped rows/618 clocks and 40,498 other-season rows unchanged. Log maximum 5.47 seconds conflicts with Q's 4.9 seconds, but not the bound. Input drift is checked after writing per packet. |
| PP serving flag/deploy | Q:458–479: conditional approval after checks; #442 then serving flag and separate build. | `dpl_3dTQdAD3RHsEhP3nvtn5yZHSmzpn`; three API requests/two views; 112 seconds/93.33%, zero N/A. **Lines PowerPlayCombos for game 131 not checked live**; offline cross-surface evidence only. #443 later resolves that game's timeline mismatch label. |
| Forced cron 388 | Q:480–485: direct TJ pop-up, exact command once, schedule unchanged. | Request 1098 HTTP 200/audit success; 379 player values and 34 existing clock rows unchanged apart from timestamps. **Four unavailable clock rows added for unplayed 310/311 instead of expected skip.** Finality and write-scope audit needed. |
| Forced item 6 game 309 write | Q:486–488: separate approval, one GET, about three to four NHL reads. | Two team/four goalie/36 skater rows unchanged apart from timestamps; zero nulls written. Verifies complete-source path, **not unknown-source null write/display**. |
| F19 cron move | Q:505–516: “Release it” and “Claude moves it to 12:40.” | #445 tests and smoke reported; no forced run. First natural 11-15 12:40 run pending. Shared Fluid auto-news cause is explicitly inference. |

## Release receipts and verification exceptions

All are record-reported, not freshly checked. Q generally reports one fhfhockey build plus three canceled companions and no-build watches on branch/ours-merge pushes.

| Release | Master / Q lines | Approval and limit |
|---|---|---|
| #430 | `631a00c19` / 3 | READY, five GETs; publish approval elsewhere. |
| #431 | `502a93b4c` / 144–149 | “Push and merge”; this entry still says building and future alias/smoke check. |
| #432 | `e1ab46318` / 171–188 | “Push and merge”; home timed out at 45 seconds, smoke stopped; after DB recovery home/DRM 200 and game-grid 307. |
| #433 | `4d9b6a10d` / 224–235 | “Yes, watch via GitHub”; connector unavailable, GitHub completed status; five GETs. |
| #434 | `496ab3766` / 245–260 | “Push and merge”; five GETs including expected SKO 503. Candidate-scope sentence ambiguous about excluded held items. |
| #435 | `6f1cb0767` / 261–272 | “Push and merge”; five GETs; v4 rebuild still separately approved. |
| #436 | `4b45d8f1a` / 284–293 | “Push and merge”; five GETs; PP share withheld. |
| #437 | `b6d43efdc` / 306–315 | “Push and merge”; five GETs; migration 147 file inert/pending then. |
| #438 | `ed2002161` / 339–344 | “Push and merge”; five GETs; team PS refresh separate. |
| #439 | `a448842d1` / 361–370 | “Push and merge” after full gate; five GETs; item 2 excluded. |
| #440 | `70ad65546` / 378–386 | “Push and merge”; five GETs; first natural stats job had no eligible games. |
| #441 | `f5c7adc2d` / 432–439 | “Push and merge, writes off”; five GETs; writes-on redeploy separate. |
| #442 | `44de2f107` / 458–479 | Conditional approval; five GETs with serving off; later three API calls/two views. |
| #443 | `4adef4fc8` / 489–504 | “Release if suite passes”; five GETs plus DOM check of qualified 120/578-second bands. |
| #444 | `1afb4b0e8` / 510,515 | Parent/sync mention only; no standalone approval/release receipt in Q. |
| #445 | `51f818cef` / 505–516 | “Release it”; five smoke responses including 307; natural run pending. |
| #446 | `89da739cb` / absent | Named by full audit prompt; no Q receipt. Consult debrief/mailbox. |

These are not blanket clean-suite receipts. Export failures in history/bootstrap-dependent files were checked separately in the checkout. requestBudget, TweetSwipeTrainer and teamStats failures are described as load flakes with isolated passes. Preserve exact candidate and exception. No independent waiver transcript was read and no check was rerun here.

## Conflicts and unfinished evidence for Chef

These are reading flags, not new code findings or severity assignments.

1. **Approval provenance:** packets paraphrase TJ. Migration commits alone do not prove per-action approval. Early resumptions, larger served-request budgets and revised inventories need original pop-up records. Omission neither proves unauthorized action nor verifies authorization.
2. **Chronology:** Q's first table still says “to prepare” for many later completed actions; other packets retain pending states. Q:246 ambiguously describes held Codex items 1/2/6 and beta-card exclusion; Q:262 says still held. Resolve candidate trees, not punctuation.
3. **PP approval timing:** REPORT:565 dates dry-run-only approval at 20:54Z; Q:416 places accepted target before migration at 20:36 and candidate at 20:40. Separate-session approvals may explain it. Q:387 explicitly changes earlier migration→release→dry-run order to local dry run first. Retrieve original timestamps.
4. **Stale PP prose:** DECISION packet says qualified clock has no production caller, while its correction/REPORT say it shipped #434/#436. REPORT §§15–17 retain stages before #443's qualified-interval fix. Do not revive the closed 29-second band defect from old paragraphs. Totals-only guard limitation is explicit at REPORT:677.
5. **PP duration discrepancy:** Q:450 says 2.3–4.9 seconds; retained refresh text:67 says batch 5 took 5.47 seconds. Below the 60-second bound. Log lacks wall-clock timestamps, so spacing/start/end are not independently reconstructable from it.
6. **PS resume/baseline:** summary log:37 re-baselines completed canary with an expected second PS increment, but completion marker prevents writing it again. Original canary before-file overwritten; Q:353–357 acknowledges no original ES row. Preserve A3-02's evidence limit; examine baseline immutability during runner audit. PP drift detection likewise follows mutating call per packet.
7. **Bounds changes:** goalie estimate 2,400 versus 14,094 rows; trend plan 764 versus 769 players; TOI plan ~25-game batches versus twelve four-day batches; goalie inventory includes 23 unplayed; OT plan 60-second gaps versus back-to-back result. Some are explained; exact approved revisions remain to reconcile.
8. **CTPI information history:** v2 failed original non-inferiority rule; descriptive beta is not forecasting qualification. CHECKPOINT:80 discloses a discarded partial 16-team grading run before complete-batch guard. Earlier report already examines 2026-27 out-of-time results. “No batch graded” must not become “no outcomes seen.” Preserve this when assessing preregistration.
9. **Coverage limits:** forced item 6 test wrote no nulls; forced PP cron wrote future unavailable clocks; PowerPlayCombos not checked live; 2025-26 PS and older PP-placeholder populations remain bounded exclusions. In particular, derived legacy totals remain readable but 33 older team-summary games retain old totals.
10. **Natural-run evidence absent here:** post-#439 goalie rows actually consumed by FORGE, first reserve rows, natural power v4 write, post-repair WiGO audit, next scheduled PP run and first F19 12:40 run. Prefer retained receipts; fresh reads require new query-batch approval.
11. **Missing receipts:** rolling/trend/#433 folders have only runners; NST request count is approximate and lacks admission timestamps. Legacy request-use observation covers ~24 hours only. These are evidence gaps, not invented production defects.
12. **Rollback limits:** WGO game_id cannot return NULL under current constraint; PS schema rollback refuses while split rows remain; PP rollback packet is safe only before new writer release. No rollback execution asserted.

## Retained receipts inspected without running producers

- PP `local-dry-run/reconciliation.json`: full small summary. Independently hashed dry run `db94a9de864b9dfa8fa69f24c6be9045dd037ed1937393c3b03dd69d9ec4f15c` and export manifest `bbcba75cebc65e45edd51d201e3f9fef05e20ab37d0280e4d4106bd41805c145` match published pins. Payload math not recomputed.
- PP `refresh-write-2026-11-13T2059Z.txt`: full text; 31 matches/DONE, busiest gate four active/zero seconds. Producer assertions, not raw post-write rows.
- Power `run/rebuild-2026-11-13T1646Z.jsonl`: selected event fields; 46 calls/readbacks, one guard wait, final line 105 has zero problems and 1,425 v4/47 legacy; line 107 is non-JSON `exit 0`. Issued and pre-run TSV hashes both equal `84d4ac83d69fbf2df5cc38ee85c9f7157e10c732360798bf27139b47ca9d4f8d`.
- PS rebuild log fully read: actual execute start 17:48:17Z versus queue's approximate 17:46, eight DONE and exit 0. Team run log fully read: 1,120 generated/54 changed/16 calls.
- PS summary log: event summaries and canary baselines selected; 59 lines, sha `4003ac05191993e492aadd9e16d1b1465d957966ebcf8db4332e894123386bd1` matches Q. Original all-strengths baseline line 2, later already-refreshed baseline line 37. Strict landing result: top-level verdict/request metadata, 24 GETs, ALL_OK. Raw responses not mathematically reverified.
- xG aggregate counts, demotion receipt, xG Lab and team-timeline JSON fully read. Registry backup partial/truncated; no all-consumer verification asserted.
- F18 WGO readback fully read: 14 targets before/after, DO, zero bad frames. Four trimmed NHL game logs inventoried only.

## Exact local file inventory and reading hashes

The following generated inventory includes all substantive files actually present in the nine assigned directories, including gitignored logs and payloads. Cache files (`__pycache__`, `.pytest_cache`, `.DS_Store`) are excluded. `full packet` means full written text read, `PP §§10–18` means only the assigned range, `receipt full` means full small receipt read, `receipt selected` means selected metadata/fields, `inventory only` means content unaudited. Hashing a file is not reading/auditing it. Root packets are listed first.

| File | Lines / bytes | Reading | SHA-256 |
|---|---:|---|---|
| `PRODUCTION-QUEUE.md` | 516 / 64130 | full packet | `025d790d41854cca24cb9de46f4135dc06ad87f1297fe3b7afa6718f15b7cabe` |
| `ITEM6-SCHEMA-VERIFY-PLAN.md` | 68 / 6596 | full packet | `449fee8468d9b7919b3a8c58a5878fcaf0a28201c70943a8b479170c008a491c` |
| `RELEASE-NEXT-HANDOFF.md` | 133 / 11704 | full packet | `11dc3be9944479896c05428c5b9d42a9bbde703ec723f3d9026118199ce72b78` |
| `GOALIE-REBUILD-2026-27-PLAN.md` | 58 / 5390 | full packet | `0425ad8fd8be1b85ba7e2da08b5057fd7339178721d0e86d64b0d0f41462adc5` |
| `FORGE-INPUTS-PLAN-2026-11-13.md` | 66 / 7258 | full packet | `9a3cbe72b6b5c8824e250b8070e010365740e922e297837c01a3fdc3c6f7123e` |
| `GAME-2026020159-RECOVERY-PLAN.md` | 166 / 13370 | full packet | `c91638dbe5963a62c4f2a75056b99bf448af99af4cfb8e4c418e84730fe71e23` |
| `REMAINING-PRODUCTION-PLAN-2026-11-13.md` | 56 / 4443 | full packet | `a55bf664c93ee43606374190fb3497b9d4f707614fb9534b1d955f021b626bed` |
| `pp-clock-validation-2026-11-13/01-season-inventory.sql` | 8 / 467 | inventory only | `f1a19e87743705131c239962836606c1fb1bd68f572afda63b52317740865ae4` |
| `pp-clock-validation-2026-11-13/02-pbp-coverage.sql` | 8 / 499 | inventory only | `5af4f6b5e6ae95436c30f02b1db1c688878797eacd07946d45c8af4fc6679bb4` |
| `pp-clock-validation-2026-11-13/03-classify-teamgamestats.sql` | 42 / 2251 | inventory only | `a81258a412b929dcc5dee9d0bea0282e5e52a56888fc239cdc22df138c81ac6c` |
| `pp-clock-validation-2026-11-13/03-run-summary.sql` | 8 / 623 | inventory only | `2356956db2ecfb09f31c664a7360717585ea0bfdf279227406a46c4554b8f03b` |
| `pp-clock-validation-2026-11-13/04-fetch-pbp.sh` | 29 / 1629 | inventory only | `eb374bbf120415a995a5e804893c8c1fe4c5221e88e329fcd1d66fdff44de4dc` |
| `pp-clock-validation-2026-11-13/05-compare-clock.ts` | 313 / 16487 | inventory only | `0a2a7a191fbf4b9a18500f23369a89607f3f7049ce88bbd8bcffc524f5f7c7a4` |
| `pp-clock-validation-2026-11-13/06-inspect-games.ts` | 87 / 4801 | inventory only | `bad476e68e1a3485c7bb4b929f4715abde7f1575ebdf9685c9524c2ecfd675ab` |
| `pp-clock-validation-2026-11-13/07-coverage-status.sql` | 8 / 843 | inventory only | `562c378c00f9ebee5a47964e74d009a3ed5a158957c11095b1b4fac40a54604b` |
| `pp-clock-validation-2026-11-13/08-raw-endpoints.sql` | 8 / 554 | inventory only | `4fd111c9e651629bff91161761aea1dc86530c15987dde12c46a34a390b56295` |
| `pp-clock-validation-2026-11-13/09-repair-source-probe.sql` | 14 / 632 | inventory only | `46d376538bd6270adb67f881b70e1943a4e05d49402251399b8a7d7e533ff361` |
| `pp-clock-validation-2026-11-13/10-fetch-shifts.sh` | 29 / 1478 | inventory only | `7e045d326e7b5e4cc15c7e0383d36bc52f72fe837ed53663b0a2040f8c3c5b3d` |
| `pp-clock-validation-2026-11-13/11-shift-numerator-check.ts` | 89 / 5076 | inventory only | `ff647dfe4d0253c2de0028da79db9c63f2b2278a3a226f7ac1962883de869607` |
| `pp-clock-validation-2026-11-13/12-fetch-pp-combinations.sh` | 29 / 1504 | inventory only | `c546ba0e66fc04c59f5b3bf3605aae27d1e9cab137a2bc5869f32a8c52b998c3` |
| `pp-clock-validation-2026-11-13/13-fetch-penalty-summaries.sh` | 20 / 1005 | inventory only | `ed3a3126727ea33ae8b3fb90d65f16320d65f16eb0c66367688e7c7c4aae7605` |
| `pp-clock-validation-2026-11-13/14-share-coverage.ts` | 170 / 10858 | inventory only | `34be1c247cc77dd7c92656ad189a5d060db5370617ea6cc26fa68603625efeeb` |
| `pp-clock-validation-2026-11-13/15-parse-penalty-summary.py` | 58 / 2482 | inventory only | `60e3e87bdd58a91195cd026784a2ef2395c61da54e0e60f8b0885ffb614ca805` |
| `pp-clock-validation-2026-11-13/16-fetch-numerator-provenance.sh` | 37 / 1867 | inventory only | `461dbe7e5548ddb3f49e04364e1d47e2033a97142452840671a312c503b2edb9` |
| `pp-clock-validation-2026-11-13/16-numerator-compare.ts` | 240 / 13968 | inventory only | `4ed6c7f67d93aa92e9dc10f833f11bbeabec3e0482d16a71ce19f672fc26948a` |
| `pp-clock-validation-2026-11-13/17-cost-probe.sql` | 76 / 5618 | inventory only | `088fcd90d050b647339ef2c6cbb6086cc0271805600b1187ad864eb1ced09505` |
| `pp-clock-validation-2026-11-13/18-compute-timing.ts` | 40 / 3944 | inventory only | `78fe36383fbb0a3c99ce7b0b0856b3897fe01be2c5cb59a0eb3669f5940b7b69` |
| `pp-clock-validation-2026-11-13/19-production-pairwise-check.ts` | 27 / 2841 | inventory only | `ea15072fe3ed5e7f1ec49b2ee92c527dbd038e98bc1f76857c6cf61cbb3f3e7f` |
| `pp-clock-validation-2026-11-13/20-refresh-runner.py` | 338 / 17963 | inventory only | `b86a75715047d7e2592a35b36bea8baabda623bd49cf3b384fa67f6a73583275` |
| `pp-clock-validation-2026-11-13/21-export-dry-run-inputs.py` | 110 / 6323 | inventory only | `015653d064d8762b1a5e074fc9532d3017ce25c5a31b04250774c9d4ef5528a3` |
| `pp-clock-validation-2026-11-13/22-local-dry-run.stubs.ts` | 8 / 555 | inventory only | `40336ac7df6b8c8f985f9a0a473979454584e2a8bef7b8190d8ac75ffa3b4f33` |
| `pp-clock-validation-2026-11-13/22-local-dry-run.ts` | 114 / 6464 | inventory only | `62db3adad2bf0495cf416fb9f2ef1ec469344212b1783afee6d802517ba78848` |
| `pp-clock-validation-2026-11-13/23-reconcile-local-dry-run.py` | 98 / 5033 | inventory only | `cfd71c35e738ef849aae44e2803558afcd8788514e10bd9ceed50234b5d60744` |
| `pp-clock-validation-2026-11-13/DECISION-152-PACKET.md` | 67 / 5523 | full packet | `55d35df8b2a70454fc0afa8efb7a543c8837909a6e98404edafb0e69bcbe5020` |
| `pp-clock-validation-2026-11-13/MIGRATION-149-PACKET.md` | 83 / 6369 | full packet | `225e27d67f508ff22335604a17d70916f52103a8f55276ef6fad906d9ceebd8d` |
| `pp-clock-validation-2026-11-13/PP-REFRESH-PLAN.md` | 39 / 4049 | full packet | `934a391a23a7ea724b82429e7755d22699de97590a1587d953cc79843f38cf58` |
| `pp-clock-validation-2026-11-13/REFRESH-APPROVAL-PACKET.md` | 51 / 3872 | full packet | `79b6eb632b09cccc6782c1e711b4d13c183bc542ef01cabec5b6d0d65390db26` |
| `pp-clock-validation-2026-11-13/REPORT.md` | 745 / 71056 | PP §§10–18 (247–745) | `60c4e1e77d206cdf43b921e6cdcc1f599ef742a43d2ed52a0b29186df8b58a7e` |
| `pp-clock-validation-2026-11-13/hygiene.sh` | 8 / 353 | inventory only | `d772fc1d04bbcaf791d52bfa27c4d9936cdd6f8c4ee8e8c634eee60463313d32` |
| `pp-clock-validation-2026-11-13/hygiene.sql` | 5 / 416 | inventory only | `8cd8776ecc42ce611ed5373883395602c5afcc12173fa00837b724950f77461b` |
| `pp-clock-validation-2026-11-13/results/03-teamgamestats-class-by-season.txt` | 122 / 8352 | inventory only | `2e74a87eb3885bb3585b3b8b7b03c36d622ea5588ecf8d8d0a668bed24a23e27` |
| `pp-clock-validation-2026-11-13/results/after-c1-c2/o4-penalty-summary-check.csv` | 11 / 1055 | inventory only | `868793aa673db9300720a1f96669f5cdfd86c5945d92eb49c0f3f083ecd41552` |
| `pp-clock-validation-2026-11-13/results/after-c1-c2/share-coverage-2026-27-regular.csv` | 619 / 65891 | inventory only | `1327a51052552816ce315f40e631b66a2111c49b133a5e9c942c0c8e3da5b7a2` |
| `pp-clock-validation-2026-11-13/results/after-c1-c2/share-coverage-summary.json` | 24 / 562 | inventory only | `e8a8017ad5bc4633fdc526ca85679989cc022c09e92b5ce398e9009586c90175` |
| `pp-clock-validation-2026-11-13/results/after-c1-c2/summary.json` | 363 / 11396 | inventory only | `113032840056480dff07c1862139c792679b142cc747bdbe653d76fbb905255f` |
| `pp-clock-validation-2026-11-13/results/after-c1-c2/team-game-results.csv` | 3791 / 654445 | inventory only | `92fdd26062d070e95649144304b1bc8da4ddad36732816f4088de303619220cf` |
| `pp-clock-validation-2026-11-13/results/after-d152/cost-probe-team10-cold.txt` | 118 / 8335 | inventory only | `54fe7d3011a3716f612163266a53dfa52798fc80aea61240b5f03cf898fe0859` |
| `pp-clock-validation-2026-11-13/results/after-d152/cost-probe-team2-cold.txt` | 127 / 8078 | inventory only | `a4a8b4a5f14c359e18246341fac6adbe0d1ddb6c06ef6c7c077c6ef4c34e06bf` |
| `pp-clock-validation-2026-11-13/results/after-d152/cost-probe-team2-warm.txt` | 117 / 7751 | inventory only | `73902f677caf6a062cbb45c1d287bfef87676ae349657f00da2ed5ed2a797e9e` |
| `pp-clock-validation-2026-11-13/results/after-d152/local-dry-run/dry-run.json` | 1 / 1769289 | inventory only | `db94a9de864b9dfa8fa69f24c6be9045dd037ed1937393c3b03dd69d9ec4f15c` |
| `pp-clock-validation-2026-11-13/results/after-d152/local-dry-run/dry-run.sha256` | 1 / 79 | inventory only | `4e5fbfebdf2fa580da0422d35fe04ea8202dd143987eb45a588509b19fafda79` |
| `pp-clock-validation-2026-11-13/results/after-d152/local-dry-run/export-manifest.json` | 1338 / 33555 | inventory only | `bbcba75cebc65e45edd51d201e3f9fef05e20ab37d0280e4d4106bd41805c145` |
| `pp-clock-validation-2026-11-13/results/after-d152/local-dry-run/reconciliation.json` | 52 / 1043 | receipt full | `123b1e585735a4a0b32f9a1b13edc36f76a9e67462d4238bfe893e45b25cb975` |
| `pp-clock-validation-2026-11-13/results/after-d152/numerator-rows-disagreeing-team-games.csv` | 203 / 20708 | inventory only | `0c7c39032efe85b5e4e120bf3cba352d654ce44d5c3cc3e30b2721cad4e475e2` |
| `pp-clock-validation-2026-11-13/results/after-d152/numerator-summary.json` | 24 / 592 | inventory only | `374db2893aac9dbd108d17aaf21fff783cf3348b14c8675dc6e7bffc61f2d2eb` |
| `pp-clock-validation-2026-11-13/results/after-d152/numerator-team-games.csv` | 610 / 41269 | inventory only | `923e82815f961dbb54b26ed76465260107522a0da34e039353df03caaa231a06` |
| `pp-clock-validation-2026-11-13/results/after-d152/refresh-batches-2026-27-regular.json` | 381 / 5227 | inventory only | `c2c287aa09d5078f5fd472b4e6dc655743c1c658589874699e9678dbc020a5c4` |
| `pp-clock-validation-2026-11-13/results/after-d152/refresh-write-2026-11-13T2059Z.txt` | 94 / 4894 | receipt full | `bc9fd526a5208060e37845cf76e6f1779ac3f5d11a3183862b9f9afb0043a4fb` |
| `pp-clock-validation-2026-11-13/results/after-d152/share-coverage-summary.json` | 24 / 562 | inventory only | `0c55e66a0839b1819be2cffc15d1eb8d5443021b380541347607581b0913e97d` |
| `pp-clock-validation-2026-11-13/results/after-d152/summary.json` | 350 / 10418 | inventory only | `50b2e24497fbdcea1d9661cb0ad76834b8ae9dc076755654908f38bc3224f505` |
| `pp-clock-validation-2026-11-13/results/after-d152/writer-repair-runs.csv` | 36 / 5122 | inventory only | `0f8636859d2625b1687aac42a8ce150a9ead74438b9c731afc676940878d4c3c` |
| `pp-clock-validation-2026-11-13/results/normalization-status-2025-2027.csv` | 342 / 15438 | inventory only | `0545d67f76633e8248a789b1e8a37b1d2772ffe0d7a5e8505318cce8e46803b4` |
| `pp-clock-validation-2026-11-13/results/shift-numerator-check.json` | 79 / 1203 | inventory only | `7e71b8082de425c98f7f9467e27aab15b4bea117a0a59a30a7b0ee76fb82178a` |
| `pp-clock-validation-2026-11-13/results/summary.json` | 150 / 3128 | inventory only | `40a96cbf89257cb4036b47e2fb9f79c9e1ea7330428510dde4f974da924921f6` |
| `pp-clock-validation-2026-11-13/results/team-game-results.csv` | 3791 / 524807 | inventory only | `7376a9523288bc7da5bcf6c4663931dfe2cb5ca88e3e5380b3286116e25fad7c` |
| `pp-clock-validation-2026-11-13/results/whatif-mat15-as-major-team-game-results.csv` | 9 / 1434 | inventory only | `52ed932d1cc48de8bc0adebeb6ebe9dae1959c5add6553d237d9d1db10ca7a1f` |
| `penalty-shot-rebuild-2026-11-13/PLAN.md` | 136 / 11252 | full packet | `cf2085bfe5ab4565c29dba4ac211a4d6b59d6af03fbe4c3dd8de29f537d9e9f4` |
| `penalty-shot-rebuild-2026-11-13/SUMMARY-REFRESH.md` | 173 / 12756 | full packet | `91b0252003e16b50f4e6f1774d77ce33c4114a768a151752b4b5f5bc2f07f145` |
| `penalty-shot-rebuild-2026-11-13/TEAM-REFRESH.md` | 117 / 8673 | full packet | `502a3f0a87e72cfb664dbbbad2e139ba9101826a2f5efb00804b7e3563a068bb` |
| `penalty-shot-rebuild-2026-11-13/landing-verify-20261113T184529Z/2026020065-all.json` | 1 / 12501 | inventory only | `77bbe7125c27f9afaa3ddd7a1d33977b51229287b2e1755215f26a0a566a5c54` |
| `penalty-shot-rebuild-2026-11-13/landing-verify-20261113T184529Z/2026020065-es.json` | 1 / 12520 | inventory only | `dab343166dc2708d8061b5f73efbc5b9a649544f432a6dff172f1646193dab78` |
| `penalty-shot-rebuild-2026-11-13/landing-verify-20261113T184529Z/2026020065-goalie.json` | 1 / 1241 | inventory only | `98ec210a46bc137a54fe42b2cd3719e87db690c094f99f9c3a11646c71f6898f` |
| `penalty-shot-rebuild-2026-11-13/landing-verify-20261113T184529Z/2026020094-all.json` | 1 / 12573 | inventory only | `e8e71cfabf74597b9cdabdabb7f4aaaa840284cea24c43d55f6c45bcae306b01` |
| `penalty-shot-rebuild-2026-11-13/landing-verify-20261113T184529Z/2026020094-es.json` | 1 / 12566 | inventory only | `e8f84a5ff7da0421f9b4f579a418d9b4003ef4d7fdd809d707d8290c5fe43674` |
| `penalty-shot-rebuild-2026-11-13/landing-verify-20261113T184529Z/2026020094-goalie.json` | 1 / 1207 | inventory only | `f5b322220f146b6583e0de82c196bd617510adc5483343928c278578f0670c65` |
| `penalty-shot-rebuild-2026-11-13/landing-verify-20261113T184529Z/2026020101-all.json` | 1 / 12558 | inventory only | `06276022323e7151c96bb1d7edda7b8e0ecd4e0a5a497ac110505bc5649c4657` |
| `penalty-shot-rebuild-2026-11-13/landing-verify-20261113T184529Z/2026020101-es.json` | 1 / 12534 | inventory only | `e2379a2a8c9a1c29758453b30c5cb686e8021c341ab2bee818c5acbc40ce9eda` |
| `penalty-shot-rebuild-2026-11-13/landing-verify-20261113T184529Z/2026020101-goalie.json` | 1 / 1164 | inventory only | `c79b7f4e7a4bcfb934b568fdac4af656bd74d97edde411fe7d162583b876ebb2` |
| `penalty-shot-rebuild-2026-11-13/landing-verify-20261113T184529Z/2026020119-all.json` | 1 / 12551 | inventory only | `eb101a2116b8bc34d69380a2e505b7a864e39b63710b5390dfc1e6f757aafdc4` |
| `penalty-shot-rebuild-2026-11-13/landing-verify-20261113T184529Z/2026020119-es.json` | 1 / 12512 | inventory only | `1c9d94afa51a05e5179835a8097c0f30380b3683c71a9070a2cbadd9840126e5` |
| `penalty-shot-rebuild-2026-11-13/landing-verify-20261113T184529Z/2026020119-goalie.json` | 1 / 1229 | inventory only | `1008396a125ce9e2386e81b3ef41ba15df0db3bdbada62db812aac0e68234fba` |
| `penalty-shot-rebuild-2026-11-13/landing-verify-20261113T184529Z/2026020131-all.json` | 1 / 12597 | inventory only | `4ee5da43f60961e5e8ad68d74a65c596c5aef9965c264a4618a949877e80a103` |
| `penalty-shot-rebuild-2026-11-13/landing-verify-20261113T184529Z/2026020131-es.json` | 1 / 12545 | inventory only | `1d2bf50de169963645fe25b137e25e5f50c9b7567fdcd10378534e5f9ce5d311` |
| `penalty-shot-rebuild-2026-11-13/landing-verify-20261113T184529Z/2026020131-goalie.json` | 1 / 1251 | inventory only | `6950634b135443b461109bc70c41370d0921602550ba6caa10a771bece64dc4c` |
| `penalty-shot-rebuild-2026-11-13/landing-verify-20261113T184529Z/2026020150-all.json` | 1 / 12555 | inventory only | `2cc7694eb27c4bf9f35ad17826b9ad47f61acabb821fb7b1ad7a05a332bfada1` |
| `penalty-shot-rebuild-2026-11-13/landing-verify-20261113T184529Z/2026020150-es.json` | 1 / 12537 | inventory only | `0d2bfbb8818ae6395a29067b36f57220a99e480d6f4580400bd8b6d7c64060aa` |
| `penalty-shot-rebuild-2026-11-13/landing-verify-20261113T184529Z/2026020150-goalie.json` | 1 / 1239 | inventory only | `8fb4c1bbc850900d6550df6bb201b675f588f96736b6466fdffc30bdb09ab389` |
| `penalty-shot-rebuild-2026-11-13/landing-verify-20261113T184529Z/2026020159-all.json` | 1 / 12627 | inventory only | `351566e8e2abc3db1913f637c8f575b064d4345cc3e2a275c17ee087e919a175` |
| `penalty-shot-rebuild-2026-11-13/landing-verify-20261113T184529Z/2026020159-es.json` | 1 / 12591 | inventory only | `b2f7ff4db912cc557fb17ea512895d80519711fbb5ba9970685d255e05e4ddbb` |
| `penalty-shot-rebuild-2026-11-13/landing-verify-20261113T184529Z/2026020159-goalie.json` | 1 / 1263 | inventory only | `0b7c3373abd1ecf15e824ba2b32e0ad24b33bc54cecca3f5ca79495aad65b943` |
| `penalty-shot-rebuild-2026-11-13/landing-verify-20261113T184529Z/2026020203-all.json` | 1 / 12543 | inventory only | `a8ce8b59665c4d8129f4d712acfb0cfbecd93bf4ec786b582e4299bf3f439cec` |
| `penalty-shot-rebuild-2026-11-13/landing-verify-20261113T184529Z/2026020203-es.json` | 1 / 12493 | inventory only | `b582c1cb1f1d83346263c940255265409976864fba654b86e085c8a366879e20` |
| `penalty-shot-rebuild-2026-11-13/landing-verify-20261113T184529Z/2026020203-goalie.json` | 1 / 1167 | inventory only | `d22aa7ff0042a3ac8612ebfb51bcba0f60d67f3e2e0a37078c4dc95d761811ad` |
| `penalty-shot-rebuild-2026-11-13/landing-verify-20261113T184529Z/result.json` | 673 / 19358 | receipt selected | `d3c40e884dc70aa90d41da3622fcfb4c5fc93f039db9989a6cdcb48b243d5b7e` |
| `penalty-shot-rebuild-2026-11-13/ps-rebuild.py` | 403 / 20251 | inventory only | `b6fbc6cb91da7ef0ff697a48640ba63643efdc7dfd21ca65579bd8d1b83d0910` |
| `penalty-shot-rebuild-2026-11-13/rebuild-2026-11-13T1746Z.log` | 27 / 4521 | receipt full | `cb296894ada1abca3b084eae5e3c7a0656a33df6fc22f3d779bcdc9713797acc` |
| `penalty-shot-rebuild-2026-11-13/run/after-2026020065.json` | 1 / 18079 | inventory only | `1374e0411eb6ff5e9c66fb5448c068d9ead1d0570b902a53a3d4e0d45e355ffd` |
| `penalty-shot-rebuild-2026-11-13/run/after-2026020094.json` | 1 / 18050 | inventory only | `c602e7a1ed744497532f6515f2de6e3aff84c4fed256a8ea98a8eba2fd2ff527` |
| `penalty-shot-rebuild-2026-11-13/run/after-2026020101.json` | 1 / 18085 | inventory only | `4ae9042d519838f77998c19c5809f75ce26daf76cb4240df4c69e3b8564f433c` |
| `penalty-shot-rebuild-2026-11-13/run/after-2026020119.json` | 1 / 18054 | inventory only | `d730b8906a9feaa123ef60e7e1f1bf47bda7add7f131d74ef634aec4ccb7d17a` |
| `penalty-shot-rebuild-2026-11-13/run/after-2026020131.json` | 1 / 18079 | inventory only | `a182aa89a31262b185ae5090edeac0f9ab596bccb23c2cdf3dc7fc66e7127414` |
| `penalty-shot-rebuild-2026-11-13/run/after-2026020150.json` | 1 / 18076 | inventory only | `6d2f46460b31ec343d143948fa8cf0e616d740a63931bd6c8ce4e19e3b1f2351` |
| `penalty-shot-rebuild-2026-11-13/run/after-2026020159.json` | 1 / 18031 | inventory only | `b5f0a4fbd5ebcb2d530668b0fda898032d2dc320a673488b33bf4eab629f994b` |
| `penalty-shot-rebuild-2026-11-13/run/after-2026020203.json` | 1 / 18076 | inventory only | `dbe85623ff7e923abbeff05c6de66c09fb905a06f90d8e4d129dc1a919214e55` |
| `penalty-shot-rebuild-2026-11-13/run/before-2026020065.json` | 1 / 18439 | inventory only | `cc52fabc4eefefafb513de04a5d1efc46cda84007a997ca2f823eeb70cf5cf82` |
| `penalty-shot-rebuild-2026-11-13/run/before-2026020094.json` | 1 / 18410 | inventory only | `0d7967c7ae701657551601098c6ce6a477bfc7b84a52e0ba55b74960845cd503` |
| `penalty-shot-rebuild-2026-11-13/run/before-2026020101.json` | 1 / 18445 | inventory only | `d04a6ad945b86b41ef0ce106f0a46acc42fc6893908501478df7b52acb633acd` |
| `penalty-shot-rebuild-2026-11-13/run/before-2026020119.json` | 1 / 18414 | inventory only | `642f357c98cccd2e5dfd54d08e599f712308b18a34caaa56ec857759defb6804` |
| `penalty-shot-rebuild-2026-11-13/run/before-2026020131.json` | 1 / 18439 | inventory only | `e6f0e763d85ae8fa9bfa8afcf331556e0abf16dfe3a484e826151f027a806e90` |
| `penalty-shot-rebuild-2026-11-13/run/before-2026020150.json` | 1 / 18436 | inventory only | `b378804a30d7b0288fbc3597f6cf97f0a5cc70583ee81fd442f4da4f135ec8e0` |
| `penalty-shot-rebuild-2026-11-13/run/before-2026020159.json` | 1 / 18391 | inventory only | `9d302e76355ebd96c76812dd423224bc68d7be6bc9b18e4c5b41605b53a5fe5d` |
| `penalty-shot-rebuild-2026-11-13/run/before-2026020203.json` | 1 / 18436 | inventory only | `bf4b430f50b13af5f400dd5b4d9be8edb103f6c11d1a238d449dc44a11db47db` |
| `penalty-shot-rebuild-2026-11-13/run/ps-rebuild.done` | 8 / 88 | inventory only | `2275546d7f83f3ac03326e97ecde62f9ecfc7ab5bfb530cca6687eec1a0be568` |
| `penalty-shot-rebuild-2026-11-13/run/run.jsonl` | 44 / 8104 | inventory only | `5154f636504fd2bcef5f4b6c8c023f5454c45b3a0c1851ad669cbd183a764e3d` |
| `penalty-shot-rebuild-2026-11-13/run/summary-after-2026020065.jsonl` | 178 / 3326664 | inventory only | `7eef68090bff3545450931ee52b288dca37468cc13b62f10b84f14a95d831ac5` |
| `penalty-shot-rebuild-2026-11-13/run/summary-after-2026020094.jsonl` | 212 / 3688601 | inventory only | `0788f1984a3acb117aabdeca3d9779b7c792690f70f517f59908b574a06fa858` |
| `penalty-shot-rebuild-2026-11-13/run/summary-after-2026020101.jsonl` | 202 / 4468624 | inventory only | `590b4a1b985db9eba0e1b24ac9010da22535d0448fc170867b9c61c1ae672714` |
| `penalty-shot-rebuild-2026-11-13/run/summary-after-2026020119.jsonl` | 194 / 4834661 | inventory only | `76296e80cbf03e97965a4305ecf646f82af567f5318a3497d0caec617c232ebd` |
| `penalty-shot-rebuild-2026-11-13/run/summary-after-2026020131.jsonl` | 178 / 4035298 | inventory only | `b696cbf65e41318b8088c51214019255ca30078690fc39c19879908758ac0a80` |
| `penalty-shot-rebuild-2026-11-13/run/summary-after-2026020150.jsonl` | 210 / 3509627 | inventory only | `f943f78e73305b76c26262b72b61386bb747c7be04bbeff535b615065369e6aa` |
| `penalty-shot-rebuild-2026-11-13/run/summary-after-2026020159.jsonl` | 200 / 3308110 | inventory only | `e10c3f820b7c0ad4c396d4294c2ce28f9cc0a19f387508c5274bd2f605f1dce2` |
| `penalty-shot-rebuild-2026-11-13/run/summary-after-2026020203.jsonl` | 178 / 4371771 | inventory only | `1921639a3c7a376aedb6eed7039a670ee7bc6c1ee10d941e8c1521dbe42b177d` |
| `penalty-shot-rebuild-2026-11-13/run/summary-before-2026020065.jsonl` | 178 / 3326664 | inventory only | `7eef68090bff3545450931ee52b288dca37468cc13b62f10b84f14a95d831ac5` |
| `penalty-shot-rebuild-2026-11-13/run/summary-before-2026020094.jsonl` | 212 / 3688547 | inventory only | `04b93437123d08a829ce85f4f16394d0c0f70cde5384266254656f5557d343e0` |
| `penalty-shot-rebuild-2026-11-13/run/summary-before-2026020101.jsonl` | 202 / 4468477 | inventory only | `0aef2ccbce44daeca0df786ecb05edd8ded1022da848d757744574a47591fb6b` |
| `penalty-shot-rebuild-2026-11-13/run/summary-before-2026020119.jsonl` | 194 / 4834661 | inventory only | `17152eb0e0079fcbde0d2e13a49e21aef66cd3b45ddfbc849eab41e39ca89b80` |
| `penalty-shot-rebuild-2026-11-13/run/summary-before-2026020131.jsonl` | 178 / 4035388 | inventory only | `4a13bb138d650e3211142792b58fcb0a90cdbf4f4f96acafe4c08714a4a2648e` |
| `penalty-shot-rebuild-2026-11-13/run/summary-before-2026020150.jsonl` | 210 / 3509626 | inventory only | `dc2e09d873c8670c2d2421063272e47eeaecf36ec1bc86c6efb3f59e0ba548e6` |
| `penalty-shot-rebuild-2026-11-13/run/summary-before-2026020159.jsonl` | 200 / 3308262 | inventory only | `58bf79ac587a4fd3ce5c0acc2d28163b97a3700ebdfd38ec45aea89647233216` |
| `penalty-shot-rebuild-2026-11-13/run/summary-before-2026020203.jsonl` | 178 / 4371771 | inventory only | `5e042cca323db6a50633c8257812d6ca19dfcef7f76dc82b2bb9ff50d5bd1872` |
| `penalty-shot-rebuild-2026-11-13/run/summary-refresh.done` | 8 / 88 | inventory only | `2275546d7f83f3ac03326e97ecde62f9ecfc7ab5bfb530cca6687eec1a0be568` |
| `penalty-shot-rebuild-2026-11-13/run/summary-run.jsonl` | 59 / 23057 | receipt selected | `4003ac05191993e492aadd9e16d1b1465d957966ebcf8db4332e894123386bd1` |
| `penalty-shot-rebuild-2026-11-13/run/team-before-2026020065.json` | 1 / 106196 | inventory only | `4fc300b905c035f909acfe7ab66d10cc6259cd47d3d2fcc6901bbedf65a763f1` |
| `penalty-shot-rebuild-2026-11-13/run/team-before-2026020094.json` | 1 / 106004 | inventory only | `cb5118b2b126f1e9f93b68b0a7437e547d327536c4b74b938cc1906bfb0651fb` |
| `penalty-shot-rebuild-2026-11-13/run/team-before-2026020101.json` | 1 / 106256 | inventory only | `701d27aee0b25a50bb249ee96d676351dc26a8eca850a4a488102779d07d37b7` |
| `penalty-shot-rebuild-2026-11-13/run/team-before-2026020119.json` | 1 / 106184 | inventory only | `ef640db8108b260b55aa65e33a35299e31d0d78328328cab9ecfcdac48357cb5` |
| `penalty-shot-rebuild-2026-11-13/run/team-before-2026020131.json` | 1 / 106156 | inventory only | `5bbf95543732f8cdea62516fd5caa15c75761f90808cccfc68c6ffe3218e2b1e` |
| `penalty-shot-rebuild-2026-11-13/run/team-before-2026020150.json` | 1 / 106244 | inventory only | `46d64170d981b245b32aa51e636ed55f4c1440cd0d47149c43d5fa4e1f2a6fa4` |
| `penalty-shot-rebuild-2026-11-13/run/team-before-2026020159.json` | 1 / 105984 | inventory only | `fb73d8c67dc05a6bd8fd4b6b26b776255ccfd4e602295aaaef9add461b5595dc` |
| `penalty-shot-rebuild-2026-11-13/run/team-before-2026020203.json` | 1 / 106190 | inventory only | `22f1c2798f26a85da47f9d336383dd8bc2dde1e6c4ba92102ad283cb9fa20e7b` |
| `penalty-shot-rebuild-2026-11-13/run/team-diff-20261113T182558Z.json` | 1255 / 19636 | inventory only | `96bc12cdf7911cb1c550335069d2175a5d1218b506927cb9a01971dad9deaa6a` |
| `penalty-shot-rebuild-2026-11-13/run/team-diff-approved.json` | 1255 / 19636 | inventory only | `96bc12cdf7911cb1c550335069d2175a5d1218b506927cb9a01971dad9deaa6a` |
| `penalty-shot-rebuild-2026-11-13/run/team-refresh.done` | 8 / 88 | inventory only | `2275546d7f83f3ac03326e97ecde62f9ecfc7ab5bfb530cca6687eec1a0be568` |
| `penalty-shot-rebuild-2026-11-13/run/team-run.jsonl` | 12 / 1438 | receipt full | `481c14e25dce84cb7a4c033a54d5e43ce01a361efd1027ca2b5c9056427acc1c` |
| `penalty-shot-rebuild-2026-11-13/summary-refresh.py` | 503 / 26741 | inventory only | `eba89e149346cb5000fe2342390b72645378c3fba21a6963ef6e9f13b0e88749` |
| `penalty-shot-rebuild-2026-11-13/team-refresh.py` | 408 / 21809 | inventory only | `4c5ec17bd5078d70d5617202409b45acbda5f35743083c1d639208f54691d2d2` |
| `penalty-shot-rebuild-2026-11-13/test_ps_rebuild.py` | 206 / 10147 | inventory only | `a0249953013082f32b751f39fd83911f59641f938cb93e3f24a2a7f0bba9623c` |
| `penalty-shot-rebuild-2026-11-13/test_summary_refresh.py` | 213 / 11598 | inventory only | `d5e95a6a7aa2de870b92a764c7a251a50d6684d36ab34912994a42e6cc2eea97` |
| `penalty-shot-rebuild-2026-11-13/test_team_refresh.py` | 294 / 15535 | inventory only | `80042326e4fffab4edd08f487f278d191de9fdceeb6ff2eafd70ca73f6fb659f` |
| `penalty-shot-rebuild-2026-11-13/verify-landing-strict.py` | 231 / 11317 | inventory only | `9bc6f2059eb78ef9cf4263df9f1d578af92a3b2019e550952a0ff4e437db00c0` |
| `penalty-shot-rebuild-2026-11-13/verify-landing.py` | 30 / 2339 | inventory only | `2cc9fdb67cb3dde05c4dd6a8c8c04a9c550767367d9cf245e204ff060dc4e9bc` |
| `penalty-shot-rebuild-2026-11-13/verify-team-landing.py` | 21 / 1453 | inventory only | `d905215383c2503755f6760d3c2050e790d7750e1e53ee7410107abae34f50e3` |
| `power-g5v5-2026-11-13/PLAN.md` | 176 / 14900 | full packet | `63ac4c33196fa965495d6a0cf8b2560d0cc3258907e53873ee82daa4464523d9` |
| `power-g5v5-2026-11-13/PREFLIGHT.md` | 353 / 33053 | full packet | `33db4e914860eb534395513219b34259069de28c6e96115aeaad56c3331a46c2` |
| `power-g5v5-2026-11-13/carry-manifest.sql` | 18 / 1178 | inventory only | `a0a7753d17344a38bf4d34a296218d5fd50a2b1e7b57cfec673310af25621eed` |
| `power-g5v5-2026-11-13/carry-manifest.tsv` | 48 / 15522 | inventory only | `5e68af844ea057c99231a768d7521d486182d0c248628c5aeb763aaea6ab2c31` |
| `power-g5v5-2026-11-13/en-games-shots-toi-reconciliation.csv` | 94 / 5515 | inventory only | `e893a767db295380be45aae98ac7e568e8ea81d8b1dd70dc3d27bbb53f5712b4` |
| `power-g5v5-2026-11-13/en-games-shots-toi-reconciliation.sql` | 28 / 1782 | inventory only | `c86aaba0c83478da7e8f810e22807aca5f2e8222c45186eef91e9b4903517584` |
| `power-g5v5-2026-11-13/en-goals-reconciliation.csv` | 94 / 4209 | inventory only | `d29831709a990434595f2b76846cf757d0fdc7bb3fa71adfd199cd56418fc701` |
| `power-g5v5-2026-11-13/en-goals-reconciliation.sql` | 26 / 1684 | inventory only | `336fd3ea0ddd48cab73f219cc2234e5f28a4d302c568912c68a84099e5aea131` |
| `power-g5v5-2026-11-13/power-g5v5-loop.py` | 579 / 32011 | inventory only | `c01d2e7069e1522fcea46efcfe403c37d30ee5daa4a761b5e5ed7be6d7f4f0e7` |
| `power-g5v5-2026-11-13/preflight-carried-keys.csv` | 48 / 12825 | inventory only | `c18f51c47d4c51197d945750d1fa0c6091b342da515a4c8ca61fbc049c60acd7` |
| `power-g5v5-2026-11-13/preflight-carried-keys.sql` | 40 / 2746 | inventory only | `debb4d2c68d9c330d112f3a5ba30419ee72fe12041aa59f62f88994eb68c3b2f` |
| `power-g5v5-2026-11-13/preflight-window-checks.out` | 158 / 10495 | inventory only | `5f6cb4e645c59a952d3b07122aede0efc1d8405135d6107663a9881f33a40abd` |
| `power-g5v5-2026-11-13/preflight-window-checks.sql` | 48 / 3395 | inventory only | `47bb26178da936a4ad11fb08a42484ec83562bf40c54017e638b4ceb9b183a05` |
| `power-g5v5-2026-11-13/run/issued-rows-2026-09-29_2026-11-13.tsv` | 1473 / 590126 | inventory only | `84d4ac83d69fbf2df5cc38ee85c9f7157e10c732360798bf27139b47ca9d4f8d` |
| `power-g5v5-2026-11-13/run/pre-run-20261113T164613Z.tsv` | 1473 / 590126 | inventory only | `84d4ac83d69fbf2df5cc38ee85c9f7157e10c732360798bf27139b47ca9d4f8d` |
| `power-g5v5-2026-11-13/run/rebuild-2026-11-13T1646Z.jsonl` | 107 / 20447 | receipt selected | `06e5415f0c42bc2f15feefbbbeab4839f1a684521aad5d150518fe896e2b47a2` |
| `power-g5v5-2026-11-13/run/run.jsonl` | 133 / 26916 | inventory only | `1b6dcd64bb89d7515255dba97663f720add74f34918bc158706ec71c245397fa` |
| `power-g5v5-2026-11-13/sample-before-after.tsv` | 193 / 26254 | inventory only | `36f53b60f7853de94551a9729a2861f73f165aea70d3d3f6eb68c3bec3b763d8` |
| `power-g5v5-2026-11-13/test_power_g5v5_loop.py` | 111 / 4625 | inventory only | `d288b874adbc1431c50f70ef78bff068589ffb67a212c4c1f962864e0cc85e58` |
| `ctpi-v2-validation-2026-11-13/CHECKPOINT-PROTOCOL.md` | 94 / 7058 | full packet | `62ef797ce4e497615ae6c9aee0f58ea036f5f36cf79731d7c8ea0a561a831124` |
| `ctpi-v2-validation-2026-11-13/DISPLAY-PLAN.md` | 105 / 7511 | full packet | `3d3bd9fab88901fd2bf6fc1b146f29ffd4b42102ccef819ad706b233201ec1e7` |
| `ctpi-v2-validation-2026-11-13/REPORT.md` | 162 / 14746 | full packet | `7169f243fdbf2d99006361b9a4b37fff5891d151a9c52c137c02d2c04783a2b3` |
| `ctpi-v2-validation-2026-11-13/checkpoints-2025-26-rehearsal-batches.json` | 345 / 8253 | inventory only | `3af21ef46f5194b08c8924e2b8514a63ce4b2b657371919df21f32ac674c87c7` |
| `ctpi-v2-validation-2026-11-13/checkpoints-2025-26-rehearsal-dense.json` | 1353 / 28321 | inventory only | `cbfb98708b99b76501b883d58fc5ac1bdb6ce308f4b89bd8233d07cd54af6e94` |
| `ctpi-v2-validation-2026-11-13/checkpoints-2026-27-game10-look.json` | 626 / 14075 | inventory only | `d6e013c969c85fce4825904e65285ed4c1377a9481ea0170913d9adf87984d1a` |
| `ctpi-v2-validation-2026-11-13/ctpi-v2-checkpoints.ts` | 592 / 22225 | inventory only | `d3fdb516bddcd414aceeef38a2dc061c041f1cb52eab8eea9e7dfdd5da1ffcf6` |
| `ctpi-v2-validation-2026-11-13/ctpi-v2-validation.ts` | 983 / 34161 | inventory only | `b943845aa6ef6bbf8d9f4d650444788236f3b16e90a21522eda982b2d7877a3c` |
| `ctpi-v2-validation-2026-11-13/results.json` | 2088 / 44480 | inventory only | `8e7deded6a2e1e5adb316695b5198cd50535e7cfcbe91d3bcf3e0db72131eb7b` |
| `data-repairs-2026-11-13/REPORT.md` | 95 / 8015 | full packet | `ec1b507e74e3fbdcf3082fcd66a73d38fd8343fb4f559bbeffaa376fe6060fd8` |
| `data-repairs-2026-11-13/nhl-api-gamelogs/8478446-20202021.json` | 83 / 1713 | inventory only | `c3b1f669ad5df5fd5c30c1ab7f567bbe9767620eb0a46db6b377dd859dc9bcb4` |
| `data-repairs-2026-11-13/nhl-api-gamelogs/8478446-20212022.json` | 28 / 542 | inventory only | `8206edd428a18db1066f039a7cd931ff9a0058c29588c655468c67d7ec9e2bd1` |
| `data-repairs-2026-11-13/nhl-api-gamelogs/8478446-20222023.json` | 39 / 776 | inventory only | `f0f946b6fd73af90468e220ea12d140eca70e216192b44f5ee870e7923475f61` |
| `data-repairs-2026-11-13/nhl-api-gamelogs/8481827-20212022.json` | 28 / 543 | inventory only | `c92a2fb306be2fd37ea1449b482088c7318d53ad6f2c981e0a79c7f2f7f2fb01` |
| `data-repairs-2026-11-13/wgo-apply-readback.txt` | 43 / 2288 | receipt full | `29e12b6b7fe16a92460b9facc91406c71c608dd477c1ad7b1a483df51c6b8d0d` |
| `data-repairs-2026-11-13/wgo-legacy-identity-14-rows.sql` | 86 / 5143 | inventory only | `1af10085dcdbd7a771c382fb2be38a696c353cf9232763111532523b02076b7f` |
| `xg-demotion-2026-11-13/aggregate-counts.txt` | 4 / 192 | receipt full | `d39e4b327b88989a621c59e21b71ddb736d02e23127576d8816ebaf2d369efcc` |
| `xg-demotion-2026-11-13/demotion-receipt.txt` | 10 / 367 | receipt full | `f80f1c96198bf830a7eeb7eaaf33e27c5a2a2cd0af15033321d2af097da58ebe` |
| `xg-demotion-2026-11-13/registry-backup.json` | 2 / 54312 | receipt selected | `a84ee0012746c1e23fbe51a2c6473940919c36c3cfe6270ec74b3e9923fbc468` |
| `xg-demotion-2026-11-13/team-timeline.json` | 1 / 60 | receipt full | `df84259dd768fb29fce767fa1a6463a5b898a7604bc6b4a21e072cb348cad228` |
| `xg-demotion-2026-11-13/tl.headers` | 13 / 356 | inventory only | `65e98a35544901caf01b6653e2c9093523cf33971093133c7c49a172ba4219dd` |
| `xg-demotion-2026-11-13/xg-lab.json` | 1 / 766 | receipt full | `51ed2bfb0dbca7d2501a52cae677ef972bcf7a7f9273ed0cdbdc1b0d55f7e5d7` |
| `xg-demotion-2026-11-13/xg.headers` | 13 / 374 | inventory only | `ac6e43d070abc9f1df34a7e5e6bdc579ba84dcba287766a0a1017dfb0a1bd29a` |
| `trend-bands-2026-11-13/trend-bands-history.py` | 113 / 4987 | inventory only | `5fa8432214ab53024649aa822492ac0b797f996104c46563d26f0331e9e12f6d` |
| `rolling-resume/rolling-resume-slow.py` | 113 / 5088 | inventory only | `c655915db71fb993326a5af39ff21000e088f7f489c9a5922e35b3c1c8bb7869` |
| `release-433-followups/post-release.py` | 77 / 3610 | inventory only | `77e23560adfa84ec6ef92cd689be25f5f3bfcf1c063b30a4e1bb43090d7d1088` |
